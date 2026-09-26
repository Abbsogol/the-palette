import { beforeEach, expect, it, vi } from 'vitest'
import { database, jsonRequest, ok, user } from '../helpers/supabase'

const mocks = vi.hoisted(() => ({ getSessionUser: vi.fn(), client: {}, constructEvent: vi.fn(), retrieve: vi.fn(), checkout: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getSessionUser: mocks.getSessionUser, serviceClient: mocks.client }))
vi.mock('stripe', () => ({ default: class Stripe {
  webhooks = { constructEvent: mocks.constructEvent }
  paymentIntents = { retrieve: mocks.retrieve }
  checkout = { sessions: { create: mocks.checkout } }
} }))
import { POST as webhook } from '@/app/api/stripe-webhook/route'
import { POST as subscribe } from '@/app/api/create-subscription/route'

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
  Object.assign(mocks.client, database(() => ok(null), async (_name, args) => { removals.push(args.amount); return ok(null) }))
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
