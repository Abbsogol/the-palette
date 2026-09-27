import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'
import { database, jsonRequest, ok } from '../helpers/supabase'

const mock = vi.hoisted(() => ({ client: {}, user: vi.fn(), create: vi.fn(), session: vi.fn(), subscription: vi.fn(), list: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getSessionUser: mock.user, serviceClient: mock.client }))
vi.mock('stripe', () => ({ default: class Stripe {
  checkout = { sessions: { create: mock.create, retrieve: mock.session } }
  subscriptions = { retrieve: mock.subscription, list: mock.list }
  webhooks = { constructEvent: body => JSON.parse(body) }
} }))
import { POST as subscribe } from '@/app/api/create-subscription/route'
import { GET as status } from '@/app/api/subscription-checkout-status/route'
import { POST as webhook } from '@/app/api/stripe-webhook/route'
import { POST as deleteAccount } from '@/app/api/delete-account/route'

const user = '00000000-0000-4000-8000-000000000501'
const other = '00000000-0000-4000-8000-000000000502'
const price = 'price_1TnxOq14PyqGjXgedydlYqto'
const proPrice = 'price_1TnxOG14PyqGjXgeKYmTKhQf'
let db, sessions, currentSubscription
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0]
const profile = async () => (await db.query('select * from profiles_data where id=$1', [user])).rows[0]
const attempt = async () => (await db.query('select * from subscription_checkouts where user_id=$1', [user])).rows[0]
const rpcKeys = {
  reserve_subscription_checkout_v2: ['p_user_id', 'p_plan_id', 'p_email', 'p_base_url', 'p_price_id'],
  expire_subscription_checkout: ['p_user_id', 'p_id', 'p_session_id'],
  close_terminal_subscription_checkout: ['p_user_id', 'p_attempt_id', 'p_session_id', 'p_subscription_id', 'p_customer_id', 'p_status'],
  resolve_subscription_price: ['p_price_id','p_plan_id'],
  subscription_owner_matches: ['p_subscription_id','p_customer_id','p_user_id'],
  claim_subscription_reconciliation: ['p_subscription_id','p_customer_id','p_user_id'],
  finish_subscription_reconciliation: ['p_subscription_id','p_token','p_event_id','p_plan_id','p_status','p_created','p_attempt_id','p_session_id'],
  release_subscription_reconciliation: ['p_subscription_id','p_token'],
  begin_account_deletion: ['p_user_id'], delete_account: ['p_user_id'], account_storage_objects: ['p_user_id'],
}
beforeAll(async () => { db = await createSecurityDatabase() }, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await db.exec('truncate auth.users, profiles_data, processed_webhook_events cascade')
  await db.query('insert into auth.users(id) values ($1),($2)', [user, other])
  mock.user.mockResolvedValue({ id: user, email: 'subscriber@example.invalid' })
  Object.assign(mock.client, database(async q => {
    try {
      if (['deposit_checkouts', 'payment_checkouts'].includes(q.table) && q.operation === 'select') return ok([])
      if (q.table === 'profiles_data' && q.operation === 'select') return ok(await profile())
      if (q.table === 'subscription_checkouts' && q.operation === 'select') {
        const row = await attempt()
        return ok(row && q.filters.every(([, key, value]) => row[key] === value) ? row : null)
      }
      if (q.table === 'subscription_checkouts' && q.operation === 'update') {
        const id = q.filters.find(f => f[1] === 'id')[2]
        return ok((await db.as('service_role', null, 'update subscription_checkouts set session_id=$1 where user_id=$2 and id=$3 returning id', [q.values.session_id, user, id])).rows[0])
      }
      throw new Error(`Unexpected query ${q.table} ${q.operation}`)
    } catch (error) { return { data: null, error } }
  }, async (name, args) => {
    const keys = rpcKeys[name]
    if (!keys) throw new Error(`Unexpected RPC ${name}`)
    try {
      if (name === 'account_storage_objects') return ok((await db.as('service_role', null, 'select * from account_storage_objects($1)', [args.p_user_id])).rows)
      const result = await db.as('service_role', null, `select ${name}(${keys.map((_, i) => `$${i + 1}`).join(',')}) as result`, keys.map(k => args[k]))
      return ok(result.rows[0].result)
    } catch (error) { return { data: null, error } }
  }))
  sessions = new Map()
  mock.create.mockImplementation(async (params, options) => {
    if (!sessions.has(options.idempotencyKey)) sessions.set(options.idempotencyKey, {
      id: `cs_${sessions.size + 1}`, status: 'open', url: `https://checkout.invalid/${sessions.size + 1}`,
      mode: 'subscription', metadata: params.metadata, payment_status: 'unpaid',
    })
    return sessions.get(options.idempotencyKey)
  })
  mock.session.mockImplementation(async id => [...sessions.values()].find(s => s.id === id))
  currentSubscription = { id: 'sub_current', customer: 'cus_current', status: 'active', metadata: { userId: user }, items: { data: [{ price: { id: price } }] } }
  mock.subscription.mockImplementation(async () => currentSubscription)
  mock.list.mockResolvedValue({ data: [], has_more: false })
})

const requestStatus = () => status(new Request('http://localhost/api/subscription-checkout-status?session_id=cs_1'))
async function completedCheckout({ paid = false, bound = false } = {}) {
  expect((await subscribe(jsonRequest({ planId: 'premium' }))).status).toBe(200)
  const session = [...sessions.values()][0]
  Object.assign(session, { status: 'complete', payment_status: paid ? 'paid' : 'unpaid', subscription: 'sub_current', customer: 'cus_current' })
  if (bound) await db.query("update profiles_data set stripe_customer_id='cus_current',stripe_subscription_id='sub_current',subscription_tier='premium',subscription_status='active' where id=$1", [user])
  return session
}

it.each(['incomplete_expired', 'canceled'])('a completed checkout with terminal %s subscription can retry safely', async terminal => {
  await completedCheckout()
  currentSubscription.status = terminal
  const old = await attempt()
  expect((await subscribe(jsonRequest({ planId: 'premium' }))).status).toBe(200)
  expect((await attempt()).id).not.toBe(old.id)
  expect(sessions.size).toBe(2)
  expect(await scalar('select count(*)::integer from subscription_cancellations')).toBe(1)
})

it('exhausted collection retries revoke unpaid plan entitlements without deleting subscription identity', async () => {
  await completedCheckout({ paid: true, bound: true })
  currentSubscription.status = 'unpaid'
  const response = await webhook(jsonRequest({ id: 'evt_unpaid', type: 'customer.subscription.updated', created: 100, data: { object: currentSubscription } }))
  expect(response.status).toBe(200)
  expect(await profile()).toMatchObject({ subscription_tier: null, subscription_status: 'unpaid', stripe_subscription_id: 'sub_current' })
})

it.each(['unpaid', 'past_due', 'paused'])('a paid original checkout does not claim activation while current subscription is %s', async subscriptionStatus => {
  await completedCheckout({ paid: true, bound: true })
  currentSubscription.status = subscriptionStatus
  expect(await (await requestStatus()).json()).toMatchObject({ status: 'payment_required' })
})

it.each([['incomplete_expired', 'failed'], ['canceled', 'canceled']])('status explains terminal %s instead of polling forever', async (terminal, outcome) => {
  await completedCheckout()
  currentSubscription.status = terminal
  expect(await (await requestStatus()).json()).toEqual({ status: outcome })
})

it('expired checkout status is terminal and does not report activation', async () => {
  await completedCheckout()
  ;[...sessions.values()][0].status = 'expired'
  expect(await (await requestStatus()).json()).toEqual({ status: 'expired' })
})

it('current Stripe plan must match the persisted plan before checkout claims activation', async () => {
  await completedCheckout({ paid: true, bound: true })
  currentSubscription.items.data[0].price.id = proPrice
  expect(await (await requestStatus()).json()).toEqual({ status: 'pending' })
})

it.each(['active', 'trialing', 'incomplete', 'past_due', 'unpaid', 'paused'])('does not release a completed checkout for a still recoverable %s subscription', async state => {
  await completedCheckout()
  currentSubscription.status = state
  const old = await attempt()
  expect((await subscribe(jsonRequest({ planId: 'premium' }))).status).toBe(409)
  expect((await attempt()).id).toBe(old.id)
  expect(sessions.size).toBe(1)
})

it.each(['customer', 'user', 'attempt', 'subscription'])('terminal cleanup fails closed when the %s identity differs', async mismatch => {
  const session = await completedCheckout()
  currentSubscription.status = 'incomplete_expired'
  if (mismatch === 'customer') currentSubscription.customer = 'cus_other'
  if (mismatch === 'user') currentSubscription.metadata.userId = other
  if (mismatch === 'attempt') session.metadata.checkoutAttemptId = other
  if (mismatch === 'subscription') currentSubscription.id = 'sub_other'
  const old = await attempt()
  expect((await subscribe(jsonRequest({ planId: 'premium' }))).status).toBe(500)
  expect((await attempt()).id).toBe(old.id)
  expect(sessions.size).toBe(1)
})

it('concurrent retry of a terminal checkout creates at most one new payable session', async () => {
  await completedCheckout()
  currentSubscription.status = 'incomplete_expired'
  const responses = await Promise.all([subscribe(jsonRequest({ planId: 'premium' })), subscribe(jsonRequest({ planId: 'premium' }))])
  expect(responses.every(response => [200, 409].includes(response.status))).toBe(true)
  expect(responses.some(response => response.status === 200)).toBe(true)
  expect(sessions.size).toBe(2)
  expect((await attempt()).session_id).toBe('cs_2')
})

it('a delayed terminal close cannot remove a newer checkout attempt', async () => {
  await completedCheckout()
  const old = await attempt()
  currentSubscription.status = 'incomplete_expired'
  expect((await subscribe(jsonRequest({ planId: 'premium' }))).status).toBe(200)
  const next = await attempt()
  const result = await db.as('service_role', null, "select close_terminal_subscription_checkout($1,$2,$3,'sub_current','cus_current','incomplete_expired') as closed", [user, old.id, old.session_id])
  expect(result.rows[0].closed).toBe(false)
  expect((await attempt()).id).toBe(next.id)
})

it('a failed Stripe status read retains the checkout and returns a retryable error', async () => {
  await completedCheckout()
  mock.subscription.mockRejectedValue(new Error('Stripe is unavailable'))
  expect((await subscribe(jsonRequest({ planId: 'premium' }))).status).toBe(500)
  expect((await requestStatus()).status).toBe(503)
  expect(await attempt()).toBeTruthy()
  expect(sessions.size).toBe(1)
})

it.each([null, other])('subscription status is private from viewer %s', async viewer => {
  await completedCheckout({ paid: true, bound: true })
  mock.user.mockResolvedValue(viewer ? { id: viewer } : null)
  expect((await requestStatus()).status).toBe(viewer ? 404 : 401)
})

it.each(['anon', 'authenticated'])('browser role %s cannot close another subscription attempt', async role => {
  await completedCheckout()
  const current = await attempt()
  await expect(db.as(role, user, "select close_terminal_subscription_checkout($1,$2,$3,'sub_current','cus_current','incomplete_expired')", [user, current.id, current.session_id])).rejects.toThrow()
  expect((await attempt()).id).toBe(current.id)
})

it('a terminal completed checkout no longer prevents full account deletion', async () => {
  await completedCheckout({ paid: true, bound: true })
  currentSubscription.status = 'canceled'
  expect((await deleteAccount(jsonRequest({}))).status).toBe(200)
  expect(await profile()).toBeUndefined()
  expect(await scalar('select count(*)::integer from auth.users where id=$1', [user])).toBe(0)
  expect(await scalar('select count(*)::integer from auth.users where id=$1', [other])).toBe(1)
})

it.each(['unpaid', 'paused', 'incomplete'])('a remaining %s billing relationship blocks deletion even without premium access', async subscriptionStatus => {
  await db.query('update profiles_data set stripe_customer_id=$2,stripe_subscription_id=$3,subscription_status=$4,subscription_tier=null where id=$1', [user, 'cus_current', 'sub_current', subscriptionStatus])
  expect((await deleteAccount(jsonRequest({}))).status).toBe(409)
  expect(await profile()).toBeTruthy()
  expect(await scalar('select count(*)::integer from auth.users where id=$1', [user])).toBe(1)
  await expect(db.as('authenticated', user, 'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
  await expect(db.as('service_role', null, "select reserve_subscription_checkout_v2($1,'premium','user@example.invalid','https://example.invalid','price_test')", [user])).rejects.toThrow('ALREADY_SUBSCRIBED')
})

const sendEvent = (type, object, id = 'evt_terminal') => webhook(jsonRequest({ id, type, created: 200, data: { object } }))
it.each([false, true])('an expired checkout webhook releases exactly its attempt even with lost save=%s', async lostSave => {
  await subscribe(jsonRequest({ planId: 'premium' }))
  const session = [...sessions.values()][0]
  session.status = 'expired'
  if (lostSave) await db.query('update subscription_checkouts set session_id=null where user_id=$1', [user])
  expect((await sendEvent('checkout.session.expired', session)).status).toBe(200)
  expect(await attempt()).toBeUndefined()
  expect((await sendEvent('checkout.session.expired', session)).status).toBe(200)
})
it.each([false, true])('a failed terminal subscription webhook releases its attempt even with lost save=%s', async lostSave => {
  const session = await completedCheckout()
  currentSubscription.status = 'incomplete_expired'
  if (lostSave) await db.query('update subscription_checkouts set session_id=null where user_id=$1', [user])
  expect((await sendEvent('checkout.session.async_payment_failed', session)).status).toBe(200)
  expect(await attempt()).toBeUndefined()
  expect(await scalar('select count(*)::integer from subscription_accounts where subscription_id=$1 and user_id=$2', ['sub_current', user])).toBe(1)
})
it('a failure webhook preserves an incomplete subscription that can still collect payment', async () => {
  const session = await completedCheckout()
  currentSubscription.status = 'incomplete'
  const old = await attempt()
  expect((await sendEvent('checkout.session.async_payment_failed', session)).status).toBe(200)
  expect((await attempt()).id).toBe(old.id)
})
it('a delayed failure webhook cannot release a newer checkout for the same account', async () => {
  const session = await completedCheckout()
  currentSubscription.status = 'incomplete_expired'
  expect((await subscribe(jsonRequest({ planId: 'premium' }))).status).toBe(200)
  const newer = await attempt()
  expect((await sendEvent('checkout.session.async_payment_failed', session)).status).toBe(200)
  expect((await attempt()).id).toBe(newer.id)
})
it('terminal lifecycle event alone releases the matching completed checkout', async () => {
  await completedCheckout()
  currentSubscription.status = 'canceled'
  expect((await sendEvent('customer.subscription.deleted', currentSubscription)).status).toBe(200)
  expect(await attempt()).toBeUndefined()
  expect(await scalar('select count(*)::integer from subscription_accounts where subscription_id=$1 and user_id=$2', ['sub_current', user])).toBe(1)
})
it('a late old cancellation does not release the account\'s new checkout', async () => {
  const session = await completedCheckout()
  currentSubscription.id = 'sub_old'
  currentSubscription.status = 'canceled'
  expect((await sendEvent('customer.subscription.deleted', currentSubscription)).status).toBe(200)
  expect((await attempt()).session_id).toBe(session.id)
})
it.each(['session', 'mode', 'owner', 'attempt'])('expiry release rejects mismatched %s identity', async mismatch => {
  await subscribe(jsonRequest({ planId: 'premium' }))
  const session = [...sessions.values()][0]
  session.status = 'expired'
  if (mismatch === 'session') mock.session.mockResolvedValue({ ...session, id: 'cs_other' })
  if (mismatch === 'mode') session.mode = 'payment'
  if (mismatch === 'owner') session.metadata.userId = other
  if (mismatch === 'attempt') session.metadata.checkoutAttemptId = other
  expect((await subscribe(jsonRequest({ planId: 'premium' }))).status).toBe(500)
  expect(await attempt()).toBeTruthy()
  expect(sessions.size).toBe(1)
})
