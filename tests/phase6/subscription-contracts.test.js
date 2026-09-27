import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'
import { sqlSupabase } from '../helpers/sql-supabase'
import { jsonRequest } from '../helpers/supabase'
import pg from 'pg'

const mock = vi.hoisted(() => ({ client: {}, user: vi.fn(), subscription: vi.fn(), invoice: vi.fn(), create: vi.fn(), list: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getSessionUser: mock.user, serviceClient: mock.client }))
vi.mock('stripe', () => ({ default: class Stripe {
  subscriptions = { retrieve: mock.subscription, list: mock.list }
  invoices = { retrieve: mock.invoice }
  checkout = { sessions: { create: mock.create, retrieve: mock.session } }
  webhooks = { constructEvent: body => JSON.parse(body) }
} }))
import { POST as webhook } from '@/app/api/stripe-webhook/route'
import { POST as subscribe } from '@/app/api/create-subscription/route'
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans'

const user = '00000000-0000-4000-8000-000000000801'
const price = SUBSCRIPTION_PLANS.premium.priceId
const subscription = (status = 'active') => ({ id: 'sub_owned', customer: 'cus_owned', status, metadata: { userId: user }, items: { data: [{ id: 'si_owned', quantity: 1, price: { id: price } }] } })
let db
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0]
beforeAll(async () => { db = await createSecurityDatabase() }, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  await db.exec('truncate auth.users, profiles_data, processed_webhook_events cascade')
  await db.query('insert into auth.users(id) values ($1)', [user])
  Object.assign(mock.client, sqlSupabase(db))
  mock.user.mockResolvedValue({ id: user, email: 'subscriber@example.invalid' })
  mock.subscription.mockResolvedValue(subscription())
  mock.list.mockResolvedValue({ data: [], has_more: false })
  SUBSCRIPTION_PLANS.premium.priceId = price
})
const event = (id, status, created = 200) => webhook(jsonRequest({ id, type: 'customer.subscription.updated', created, data: { object: subscription(status) } }))
async function bound() {
  await db.query("update profiles_data set stripe_customer_id='cus_owned',stripe_subscription_id='sub_owned',subscription_status='active',subscription_tier='premium' where id=$1", [user])
  await db.query("insert into subscription_accounts(subscription_id,user_id,customer_id) values ('sub_owned',$1,'cus_owned')", [user])
}

it('same-second overlapping lifecycle events cannot restore an unpaid plan from an older provider read', async () => {
  await bound()
  let reached, release
  const captured = new Promise(resolve => { reached = resolve })
  const gate = new Promise(resolve => { release = resolve })
  const rpc = mock.client.rpc
  mock.client.rpc = vi.fn(async (name, args) => {
    if (name === 'finish_subscription_reconciliation' && args.p_event_id === 'evt_old_active') {
      reached()
      await gate
    }
    return rpc(name, args)
  })
  mock.subscription.mockResolvedValueOnce(subscription('active'))
  const old = event('evt_old_active', 'active')
  await captured
  mock.subscription.mockResolvedValue(subscription('unpaid'))
  // Overlap is retried before taking another provider snapshot.
  expect((await event('evt_new_unpaid', 'unpaid')).status).toBe(500)
  expect(mock.subscription).toHaveBeenCalledTimes(1)
  release()
  expect((await old).status).toBe(200)
  expect((await event('evt_new_unpaid', 'unpaid')).status).toBe(200)
  expect((await db.query('select subscription_tier,subscription_status from profiles_data where id=$1', [user])).rows[0])
    .toEqual({ subscription_tier: null, subscription_status: 'unpaid' })
})

it('verified subscription ownership still revokes canceled access when mutable provider metadata was cleared', async () => {
  await bound()
  mock.subscription.mockResolvedValue({ ...subscription('canceled'), metadata: {} })
  expect((await event('evt_canceled', 'canceled')).status).toBe(200)
  expect(await scalar('select subscription_tier from profiles_data where id=$1', [user])).toBeNull()
})

it('an ambiguous subscription create retries its original Price after a deployment changes the configured Price', async () => {
  let first
  mock.create.mockImplementation(async (params) => {
    if (!first) { first = structuredClone(params); throw new Error('Response lost after Stripe accepted checkout') }
    if (JSON.stringify(params) !== JSON.stringify(first)) throw new Error('Stripe idempotency_error: Parameters do not match original request')
    return { id: 'cs_original', url: 'https://checkout.invalid/original' }
  })
  expect((await subscribe(jsonRequest({ planId: 'premium' }))).status).toBe(500)
  SUBSCRIPTION_PLANS.premium.priceId = 'price_new_deployment'
  try {
    const retry = await subscribe(jsonRequest({ planId: 'premium' }))
    expect(retry.status).toBe(200)
    expect(await retry.json()).toEqual({ url: 'https://checkout.invalid/original' })
    expect(mock.create.mock.calls[1][0].line_items[0].price).toBe(price)
  } finally { SUBSCRIPTION_PLANS.premium.priceId = price }
})

it('an expired worker cannot restore access after a replacement lease records unpaid', async () => {
  await bound()
  let reached, release
  const captured = new Promise(resolve => { reached = resolve })
  const gate = new Promise(resolve => { release = resolve })
  const rpc = mock.client.rpc
  mock.client.rpc = vi.fn(async (name, args) => {
    if (name === 'finish_subscription_reconciliation' && args.p_event_id === 'evt_expired_worker') {
      reached(); await gate
    }
    return rpc(name, args)
  })
  mock.subscription.mockResolvedValueOnce(subscription('active'))
  const old = event('evt_expired_worker', 'active')
  await captured
  await db.exec("update subscription_reconciliations set claim_until=now()-interval '1 second'")
  mock.subscription.mockResolvedValue(subscription('unpaid'))
  expect((await event('evt_successor', 'unpaid')).status).toBe(200)
  release()
  expect((await old).status).toBe(500)
  expect((await db.query('select subscription_tier,subscription_status from profiles_data where id=$1', [user])).rows[0])
    .toEqual({ subscription_tier: null, subscription_status: 'unpaid' })
  expect(await scalar("select count(*)::integer from processed_webhook_events where event_id='evt_expired_worker'")).toBe(0)
  expect(await scalar('select needs_review from subscription_reconciliations')).toBe(false)
})

it('an older event reconciles a current recovery after a newer event revoked access', async () => {
  await bound()
  mock.subscription.mockResolvedValue(subscription('unpaid'))
  expect((await event('evt_unpaid_first', 'unpaid', 500)).status).toBe(200)
  mock.subscription.mockResolvedValue(subscription('active'))
  expect((await event('evt_delayed_recovery', 'unpaid', 100)).status).toBe(200)
  expect((await db.query('select subscription_tier,subscription_status from profiles_data where id=$1', [user])).rows[0])
    .toEqual({ subscription_tier: 'premium', subscription_status: 'active' })
})

it('failed provider reads preserve a deletion barrier after lease release and can recover by retry', async () => {
  await bound()
  await db.query("update profiles_data set subscription_tier=null,subscription_status='canceled' where id=$1", [user])
  mock.subscription.mockRejectedValueOnce(new Error('Stripe timeout'))
  expect((await event('evt_provider_timeout', 'canceled')).status).toBe(500)
  expect((await db.query('select needs_review,claim_token from subscription_reconciliations')).rows[0])
    .toEqual({ needs_review: true, claim_token: null })
  await expect(db.as('service_role', null, 'select begin_account_deletion($1)', [user])).rejects.toThrow('BILLING_IN_PROGRESS')
  mock.subscription.mockResolvedValue(subscription('canceled'))
  expect((await event('evt_provider_timeout', 'canceled')).status).toBe(200)
  await db.as('service_role', null, 'select begin_account_deletion($1)', [user])
  expect(await scalar('select deletion_started_at is not null from profiles_data where id=$1', [user])).toBe(true)
})

it('deletion started before a claim prevents provider work and cannot recreate billing state', async () => {
  await db.as('service_role', null, 'select begin_account_deletion($1)', [user])
  expect((await event('evt_after_deletion', 'active')).status).toBe(500)
  expect(mock.subscription).not.toHaveBeenCalled()
  expect(await scalar('select count(*)::integer from subscription_reconciliations')).toBe(0)
})

it('invoice payment failure uses the same current-state lease and stable ownership', async () => {
  await bound()
  mock.invoice.mockResolvedValue({ id: 'in_failed', customer: 'cus_owned', parent: { subscription_details: { subscription: 'sub_owned' } } })
  mock.subscription.mockResolvedValue({ ...subscription('unpaid'), metadata: {} })
  const response = await webhook(jsonRequest({ id: 'evt_invoice_failed', type: 'invoice.payment_failed', created: 200, data: { object: { id: 'in_failed' } } }))
  expect(response.status).toBe(200)
  expect(await scalar('select subscription_tier from profiles_data where id=$1', [user])).toBeNull()
  expect(await scalar('select needs_review from subscription_reconciliations')).toBe(false)
})

it.each(['customer', 'id'])('a different retrieved subscription %s cannot overwrite the bound account', async mismatch => {
  await bound()
  mock.subscription.mockResolvedValue({ ...subscription('canceled'), [mismatch]: mismatch === 'customer' ? 'cus_other' : 'sub_other' })
  expect((await event('evt_identity_conflict', 'canceled')).status).toBe(500)
  expect(await scalar('select subscription_tier from profiles_data where id=$1', [user])).toBe('premium')
  expect(await scalar('select needs_review from subscription_reconciliations')).toBe(true)
})

it('legacy ambiguous checkout without a recorded Price cannot replay new deployment parameters', async () => {
  await db.query("select reserve_subscription_checkout($1,'premium','subscriber@example.invalid','https://example.invalid')", [user])
  expect((await subscribe(jsonRequest({ planId: 'premium' }))).status).toBe(503)
  expect(mock.create).not.toHaveBeenCalled()
  expect(await scalar('select count(*)::integer from subscription_checkouts')).toBe(1)
})

it('browser roles cannot claim or finish reconciliation, and service workers cannot bypass the fence', async () => {
  for (const role of ['anon', 'authenticated']) {
    await expect(db.as(role, user, "select claim_subscription_reconciliation('sub_owned','cus_owned',$1)", [user])).rejects.toThrow('permission denied')
    await expect(db.as(role, user, "select finish_subscription_reconciliation('sub_owned',gen_random_uuid(),'evt_untrusted','premium','active',200)")).rejects.toThrow('permission denied')
    await expect(db.as(role, user, 'select * from subscription_reconciliations')).rejects.toThrow('permission denied')
    await expect(db.as(role, user, "select resolve_subscription_price('price_untrusted','premium')")).rejects.toThrow('permission denied')
    await expect(db.as(role, user, "select subscription_owner_matches('sub_owned','cus_owned',$1)", [user])).rejects.toThrow('permission denied')
  }
  await expect(db.as('service_role', null, "select apply_subscription_event('evt_unfenced',$1,'sub_owned','cus_owned','premium','active',200)", [user])).rejects.toThrow('permission denied')
})

it('verified Price mappings survive configuration changes but reject reassignment to another plan', async () => {
  await db.as('service_role', null, "select resolve_subscription_price('price_verified','premium')")
  await expect(db.as('service_role', null, "select resolve_subscription_price('price_verified','pro_creator')")).rejects.toThrow('SUBSCRIPTION_PRICE_CONFLICT')
  expect(await scalar("select resolve_subscription_price('price_verified',null)")).toBe('premium')
  expect(await scalar("select resolve_subscription_price('price_never_verified',null)")).toBeNull()
})

it.each(['unpaid', 'paused', 'incomplete'])('an unknown Price cannot retain the old paid tier when current billing state is %s', async status => {
  await bound()
  mock.subscription.mockResolvedValue({ ...subscription(status), items: { data: [{ price: { id: 'price_unrecognized_inactive' } }] } })
  expect((await event(`evt_unknown_${status}`, status)).status).toBe(200)
  expect((await db.query('select subscription_tier,subscription_status from profiles_data where id=$1', [user])).rows[0])
    .toEqual({ subscription_tier: null, subscription_status: status })
})

it('redelivery of an already recorded event reconciles a changed current subscription without granting credits again', async () => {
  await bound()
  expect((await event('evt_redelivered', 'active')).status).toBe(200)
  const before = await scalar('select credit_balance from profiles_data where id=$1', [user])
  mock.subscription.mockResolvedValue(subscription('unpaid'))
  expect((await event('evt_redelivered', 'active')).status).toBe(200)
  expect((await db.query('select subscription_tier,subscription_status from profiles_data where id=$1', [user])).rows[0])
    .toEqual({ subscription_tier: null, subscription_status: 'unpaid' })
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(before)
  expect(await scalar("select count(*)::integer from processed_webhook_events where event_id='evt_redelivered'")).toBe(1)
})

it.skipIf(!process.env.DATABASE_TEST_URL)('native concurrent deletion holds the profile lock through its guard and excludes a new subscription claim', async () => {
  const url = new URL(process.env.DATABASE_TEST_URL)
  url.pathname = `/${await scalar('select current_database()')}`
  const blocker = new pg.Client({ connectionString: url.href })
  await blocker.connect()
  await blocker.query('select pg_advisory_lock(864271501)')
  await db.exec(`create function pause_subscription_deletion() returns trigger language plpgsql as $$
    begin if new.deletion_started_at is not null and old.deletion_started_at is null then
      perform pg_advisory_xact_lock(864271501); end if; return new; end $$;
    create trigger pause_subscription_deletion before update on profiles_data for each row execute function pause_subscription_deletion()`)
  let deleting, reconciling
  try {
    deleting = db.as('service_role', null, 'select begin_account_deletion($1)', [user])
    let waiting = false
    for (let retry = 0; retry < 100; retry++) {
      waiting = await scalar("select exists(select from pg_stat_activity where datname=current_database() and query like 'select begin_account_deletion%' and wait_event='advisory')")
      if (waiting) break
      await new Promise(resolve => setTimeout(resolve, 10))
    }
    expect(waiting).toBe(true)
    reconciling = event('evt_during_deletion', 'active')
    await blocker.query('select pg_advisory_unlock(864271501)')
    await deleting
    expect((await reconciling).status).toBe(500)
    expect(mock.subscription).not.toHaveBeenCalled()
    expect(await scalar('select count(*)::integer from subscription_reconciliations')).toBe(0)
  } finally {
    await blocker.query('select pg_advisory_unlock_all()')
    await Promise.allSettled([deleting, reconciling])
    await blocker.end()
    await db.exec('drop trigger pause_subscription_deletion on profiles_data; drop function pause_subscription_deletion()')
  }
})
