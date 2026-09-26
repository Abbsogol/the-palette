import { beforeEach, expect, it, vi } from 'vitest'
import { database, jsonRequest, ok, user } from '../helpers/supabase'

const mocks = vi.hoisted(() => ({ getSessionUser: vi.fn(), client: {}, constructEvent: vi.fn(), retrieve: vi.fn(), checkout: vi.fn(), subscriptions: vi.fn(), session: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getSessionUser: mocks.getSessionUser, serviceClient: mocks.client }))
vi.mock('stripe', () => ({ default: class Stripe {
  webhooks = { constructEvent: mocks.constructEvent }
  paymentIntents = { retrieve: mocks.retrieve }
  checkout = { sessions: { create: mocks.checkout, retrieve: mocks.session } }
  subscriptions = { list: mocks.subscriptions }
} }))
import { POST as webhook } from '@/app/api/stripe-webhook/route'
import { POST as subscribe } from '@/app/api/create-subscription/route'
import { GET as checkoutStatus } from '@/app/api/credit-checkout-status/route'

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getSessionUser.mockResolvedValue(user)
  mocks.constructEvent.mockImplementation(body => JSON.parse(body))
  mocks.checkout.mockResolvedValue({ url: 'https://checkout.invalid/session' })
  Object.assign(mocks.client, database(() => ok(null)))
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

it('REG-03: two partial refunds reverse only the cumulative entitlement owed', async () => {
  const removals = []
  let reversed = 0
  Object.assign(mocks.client, database(() => ok(null), async (name, args) => {
    expect(name).toBe('apply_credit_payment')
    removals.push(Math.max(0, args.p_refunded_credits - reversed))
    reversed = Math.max(reversed, args.p_refunded_credits)
    return ok(40 - reversed)
  }))
  mocks.retrieve.mockResolvedValue({ metadata: { type: 'credits', userId: user.id, credits: '40' } })
  for (const [id, refunded] of [['event-a', 2500], ['event-b', 5000]]) {
    expect((await webhook(jsonRequest({ id, type: 'charge.refunded', data: { object: {
      id: 'charge-a', payment_intent: 'pi-a', amount: 10000, amount_refunded: refunded, refunded: false,
    } } }))).status).toBe(200)
  }
  expect(removals.reduce((sum, n) => sum + n, 0)).toBe(20)
})

it('REG-04: an already subscribed account cannot start another subscription checkout', async () => {
  Object.assign(mocks.client, database(() => ok({
    id: user.id, subscription_tier: 'premium', stripe_customer_id: 'cus-a', stripe_subscription_id: 'sub-a',
  })))
  await subscribe(jsonRequest({ planId: 'pro_creator' }))
  expect(mocks.checkout).not.toHaveBeenCalled()
})

it('rejects an invalid webhook signature without a database write', async () => {
  mocks.constructEvent.mockImplementation(() => { throw new Error('Invalid signature') })
  expect((await webhook(jsonRequest({}))).status).toBe(400)
  expect(mocks.client.from).not.toHaveBeenCalled()
})

it('does not repeat fulfillment for an already recorded event', async () => {
  Object.assign(mocks.client, database(() => ({ data: null, error: { code: '23505' } })))
  expect((await webhook(jsonRequest({ id: 'duplicate', type: 'checkout.session.completed' }))).status).toBe(200)
  expect(mocks.client.rpc).not.toHaveBeenCalled()
  expect(mocks.client.calls).toHaveLength(1)
})

it.each(['checkout.session.completed', 'checkout.session.async_payment_succeeded'])('fulfills a paid %s through the atomic receipt transaction', async type => {
  Object.assign(mocks.client, database(() => { throw new Error('No separate event write') }, async () => ok(40)))
  const response = await webhook(jsonRequest({ id: 'event-paid', type, data: { object: {
    id: 'cs_paid', mode: 'payment', payment_status: 'paid', payment_intent: 'pi-paid', metadata: { userId: user.id, credits: '40' },
  } } }))
  expect(response.status).toBe(200)
  expect(mocks.client.rpc).toHaveBeenCalledWith('apply_credit_payment', {
    p_event_id: 'event-paid', p_payment_intent: 'pi-paid', p_user_id: user.id, p_credits: 40, p_session_id: 'cs_paid',
  })
})

it('does not grant unpaid checkout credits', async () => {
  expect((await webhook(jsonRequest({ id: 'event-pending', type: 'checkout.session.completed', data: { object: {
    mode: 'payment', payment_status: 'unpaid', metadata: { userId: user.id, credits: '40' },
  } } }))).status).toBe(200)
  expect(mocks.client.rpc).not.toHaveBeenCalled()
  expect(mocks.client.from).not.toHaveBeenCalled()
})

it('blocks another subscription during webhook delay when Stripe already has an active one', async () => {
  Object.assign(mocks.client, database(() => ok({ subscription_tier: null, stripe_customer_id: 'cus-a' })))
  mocks.subscriptions.mockResolvedValue({ data: [{ status: 'active' }], has_more: false })
  expect((await subscribe(jsonRequest({ planId: 'premium' }))).status).toBe(409)
  expect(mocks.checkout).not.toHaveBeenCalled()
})

it('allows a first subscription and reuses its known customer', async () => {
  Object.assign(mocks.client, database(() => ok({ subscription_tier: null, stripe_customer_id: 'cus-a' })))
  mocks.subscriptions.mockResolvedValue({ data: [], has_more: false })
  expect((await subscribe(jsonRequest({ planId: 'premium' }))).status).toBe(200)
  expect(mocks.checkout).toHaveBeenCalledWith(expect.objectContaining({ customer: 'cus-a', mode: 'subscription' }), expect.any(Object))
})

const statusRequest = () => new Request('http://localhost/api/credit-checkout-status?session_id=cs_pending')
it('REG-09 API: a paid session without a durable fulfillment receipt stays pending', async () => {
  mocks.session.mockResolvedValue({ metadata: { userId: user.id, credits: '40' }, mode: 'payment', payment_status: 'paid' })
  expect(await (await checkoutStatus(statusRequest())).json()).toEqual({ status: 'pending' })
})

it('confirms the balance only after this checkout has a receipt', async () => {
  mocks.session.mockResolvedValue({ metadata: { userId: user.id, credits: '40' }, mode: 'payment' })
  Object.assign(mocks.client, database(q => ok(q.table === 'credit_payments' ? { fulfilled: true } : { credit_balance: 40 })))
  const response = await checkoutStatus(statusRequest())
  expect(await response.json()).toEqual({ status: 'fulfilled', creditBalance: 40 })
  expect(response.headers.get('cache-control')).toBe('no-store')
})

it('does not disclose another customer’s checkout or balance', async () => {
  mocks.session.mockResolvedValue({ metadata: { userId: 'other-user', credits: '40' }, mode: 'payment' })
  expect((await checkoutStatus(statusRequest())).status).toBe(404)
  expect(mocks.client.from).not.toHaveBeenCalled()
})

it('requires authentication to confirm checkout', async () => {
  mocks.getSessionUser.mockResolvedValue(null)
  expect((await checkoutStatus(statusRequest())).status).toBe(401)
  expect(mocks.session).not.toHaveBeenCalled()
})
