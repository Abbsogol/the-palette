import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'
import { sqlSupabase } from '../helpers/sql-supabase'
import { jsonRequest } from '../helpers/supabase'

const mock = vi.hoisted(() => ({ client: {}, user: vi.fn(), subscription: vi.fn(), invoice: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getSessionUser: mock.user, serviceClient: mock.client }))
vi.mock('stripe', () => ({ default: class Stripe {
  subscriptions = { retrieve: mock.subscription }
  invoices = { retrieve: mock.invoice }
  checkout = { sessions: { retrieve: mock.session } }
  webhooks = { constructEvent: body => JSON.parse(body) }
} }))
import { POST as webhook } from '@/app/api/stripe-webhook/route'
import { GET as checkoutStatus } from '@/app/api/subscription-checkout-status/route'
import { SUBSCRIPTION_PLANS } from '@/lib/subscription-plans'

const user = '00000000-0000-4000-8000-000000000821'
const originalPrice = SUBSCRIPTION_PLANS.premium.priceId
const sub = (status = 'active') => ({ id: 'sub_independent', customer: 'cus_independent', status,
  metadata: { userId: user }, items: { data: [{ quantity: 1, price: { id: originalPrice } }] } })
let db
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0]
const deliver = (id, type, object) => webhook(jsonRequest({ id, type, created: 200, data: { object } }))
beforeAll(async () => { db = await createSecurityDatabase() }, 30000)
afterAll(async () => { SUBSCRIPTION_PLANS.premium.priceId = originalPrice; await db?.close() })
beforeEach(async () => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  SUBSCRIPTION_PLANS.premium.priceId = originalPrice
  await db.exec('truncate auth.users, profiles_data, processed_webhook_events cascade')
  await db.query('insert into auth.users(id) values ($1)', [user])
  Object.assign(mock.client, sqlSupabase(db))
  mock.user.mockResolvedValue({ id: user })
  mock.subscription.mockResolvedValue(sub())
})

async function reservedSession() {
  const attempt = await scalar("select reserve_subscription_checkout_v2($1,'premium','test@example.invalid','https://example.invalid',$2)", [user, originalPrice])
  await db.query("update subscription_checkouts set session_id='cs_independent' where user_id=$1", [user])
  const session = { id: 'cs_independent', mode: 'subscription', status: 'complete', payment_status: 'paid',
    customer: 'cus_independent', subscription: 'sub_independent',
    metadata: { userId: user, checkoutAttemptId: attempt.id, planId: 'premium' } }
  mock.session.mockResolvedValue(session)
  return session
}

it('a paid checkout created from its frozen Price still grants its purchased plan after Price rotation', async () => {
  const session = await reservedSession()
  SUBSCRIPTION_PLANS.premium.priceId = 'price_replacement'
  expect((await deliver('evt_frozen_fulfillment', 'checkout.session.completed', session)).status).toBe(200)
  expect(await scalar('select subscription_tier from profiles_data where id=$1', [user])).toBe('premium')
  expect(await scalar('select count(*)::integer from subscription_checkouts')).toBe(0)
})

it('an invoice for the exact previously accepted subscription Price still grants renewal credits after Price rotation', async () => {
  expect((await deliver('evt_bind_original', 'checkout.session.completed', await reservedSession())).status).toBe(200)
  const balance = await scalar('select credit_balance from profiles_data where id=$1', [user])
  SUBSCRIPTION_PLANS.premium.priceId = 'price_replacement'
  mock.invoice.mockResolvedValue({ id: 'in_original_price', customer: 'cus_independent', status: 'paid', billing_reason: 'subscription_cycle',
    parent: { subscription_details: { subscription: 'sub_independent' } }, lines: { data: [{
      parent: { subscription_item_details: { subscription: 'sub_independent', proration: false } }, quantity: 1,
      pricing: { price_details: { price: originalPrice } }, period: { start: 1000, end: 2000 },
    }], has_more: false } })
  expect((await deliver('evt_original_renewal', 'invoice.paid', { id: 'in_original_price' })).status).toBe(200)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [user])).toBe(balance + 5)
  expect(await scalar('select count(*)::integer from subscription_credit_grants')).toBe(1)
})

it('a fulfilled subscription using its accepted Price remains fulfilled in the return-page contract after Price rotation', async () => {
  expect((await deliver('evt_bind_for_status', 'checkout.session.completed', await reservedSession())).status).toBe(200)
  SUBSCRIPTION_PLANS.premium.priceId = 'price_replacement'
  const response = await checkoutStatus(new Request('https://example.invalid/api/subscription-checkout-status?session_id=cs_independent'))
  expect(response.status).toBe(200)
  expect(await response.json()).toEqual({ status: 'fulfilled', planId: 'premium' })
})

it('a terminal unpaid checkout can be released using durable ownership after mutable subscription metadata was cleared', async () => {
  const session = await reservedSession()
  session.payment_status = 'unpaid'
  // The incomplete lifecycle arrives while Checkout is still waiting for payment.
  mock.subscription.mockResolvedValue(sub('incomplete'))
  expect((await deliver('evt_incomplete_binding', 'customer.subscription.updated', sub('incomplete'))).status).toBe(200)
  expect(await scalar('select user_id from subscription_reconciliations')).toBe(user)
  // The terminal snapshot has no metadata; the earlier verified binding survives.
  const terminal = { ...sub('incomplete_expired'), metadata: {} }
  mock.subscription.mockResolvedValue(terminal)
  expect((await deliver('evt_metadata_cleared_terminal', 'customer.subscription.updated', terminal)).status).toBe(200)
  expect(await scalar('select count(*)::integer from subscription_checkouts')).toBe(0)
  await db.as('service_role', null, 'select begin_account_deletion($1)', [user])
  expect(await scalar('select deletion_started_at is not null from profiles_data where id=$1', [user])).toBe(true)
})

it('a checkout redelivery reconciles current revocation after the original fulfillment removed its checkout attempt', async () => {
  const session = await reservedSession()
  expect((await deliver('evt_checkout_redelivery', 'checkout.session.completed', session)).status).toBe(200)
  expect(await scalar('select count(*)::integer from subscription_checkouts')).toBe(0)
  mock.subscription.mockResolvedValue(sub('unpaid'))
  expect((await deliver('evt_checkout_redelivery', 'checkout.session.completed', session)).status).toBe(200)
  expect((await db.query('select subscription_tier,subscription_status from profiles_data where id=$1', [user])).rows[0])
    .toEqual({ subscription_tier: null, subscription_status: 'unpaid' })
})
