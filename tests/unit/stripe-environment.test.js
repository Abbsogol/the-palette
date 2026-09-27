import { afterEach, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({
  getSessionUser: vi.fn(async () => ({ id: 'sandbox-user' })),
  serviceClient: { from: vi.fn(), rpc: vi.fn() },
}))
vi.mock('@/lib/auth', () => auth)
const createCheckout = vi.hoisted(() => vi.fn())
vi.mock('stripe', () => ({ default: class Stripe {
  checkout = { sessions: { create: createCheckout } }
} }))

afterEach(() => { vi.unstubAllEnvs(); vi.resetModules() })
async function plans(key, premium = '', pro = '') {
  vi.resetModules()
  vi.stubEnv('STRIPE_SECRET_KEY', key)
  vi.stubEnv('STRIPE_PRICE_PREMIUM', premium)
  vi.stubEnv('STRIPE_PRICE_PRO_CREATOR', pro)
  return import('../../lib/subscription-plans.js')
}

it('does not reuse legacy live Prices when a test account has no configured catalog', async () => {
  const { SUBSCRIPTION_PLANS, planForPrice } = await plans('sk_test_fixture')
  expect(SUBSCRIPTION_PLANS.premium.priceId).toBeNull()
  expect(SUBSCRIPTION_PLANS.pro_creator.priceId).toBeNull()
  expect(planForPrice(undefined)).toBeNull()
  expect(planForPrice(null)).toBeNull()
  expect(planForPrice('price_1TnxOq14PyqGjXgedydlYqto')).toBeNull()
})

it('resolves only the explicitly configured sandbox catalog', async () => {
  const { planForPrice } = await plans('sk_test_fixture', 'price_sandbox_premium', 'price_sandbox_pro')
  expect(planForPrice({ id: 'price_sandbox_premium' })).toBe('premium')
  expect(planForPrice('price_sandbox_pro')).toBe('pro_creator')
  expect(planForPrice('price_1TnxOq14PyqGjXgedydlYqto')).toBeNull()
})

it('returns a configuration error before reserving a checkout without sandbox Prices', async () => {
  await plans('sk_test_fixture')
  const { POST } = await import('../../app/api/create-subscription/route.js')
  const response = await POST(new Request('http://localhost/api/create-subscription', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ planId: 'premium' }),
  }))
  expect(response.status).toBe(503)
  expect(auth.serviceClient.from).not.toHaveBeenCalled()
  expect(auth.serviceClient.rpc).not.toHaveBeenCalled()
  expect(createCheckout).not.toHaveBeenCalled()
})

it('preserves the existing live website catalog when no live override is configured', async () => {
  const { planForPrice } = await plans('sk_live_fixture')
  expect(planForPrice('price_1TnxOq14PyqGjXgedydlYqto')).toBe('premium')
  expect(planForPrice('price_1TnxOG14PyqGjXgeKYmTKhQf')).toBe('pro_creator')
})
