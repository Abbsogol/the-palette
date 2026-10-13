import { expect, it, vi } from 'vitest'
import { LAB_STRIPE_SANDBOX, assertLabSandboxKey, assertLabSandboxPrice, verifyLabStripeSandbox } from '../../lib/lab-stripe-sandbox.mjs'

function price(p) {
  return { id: p.priceId, active: true, livemode: false, currency: 'usd', unit_amount: p.amount, billing_scheme: 'per_unit', type: p.type,
    product: { id: p.productId, active: true, livemode: false }, recurring: p.type === 'recurring' ? { interval: 'month', interval_count: 1, usage_type: 'licensed' } : null }
}
it('rejects live, public, missing or malformed credentials before making a request', () => {
  for (const key of [undefined, '', 'sk_live_fixture', 'rk_live_fixture', 'pk_test_fixture', 'rk_test_fixture\n']) expect(() => assertLabSandboxKey(key)).toThrow()
  expect(() => assertLabSandboxKey('rk_test_fixture')).not.toThrow()
})
it('rejects the other beta Stripe account before reading products', async () => {
  const stripe = { accounts: { retrieve: vi.fn(async () => ({ id: 'acct_other' })) }, prices: { retrieve: vi.fn() } }
  await expect(verifyLabStripeSandbox(stripe)).rejects.toThrow('Wrong Stripe account')
  expect(stripe.prices.retrieve).not.toHaveBeenCalled()
})
it('checks immutable identities, prices, active status and monthly billing terms', () => {
  const expected = LAB_STRIPE_SANDBOX.products[0]
  for (const patch of [{ livemode: true }, { active: false }, { currency: 'aed' }, { unit_amount: 499 }, { id: 'price_other' },
    { product: expected.productId }, { product: { id: expected.productId, active: true, livemode: true } },
    { recurring: { interval: 'year', interval_count: 1, usage_type: 'licensed' } }, { transform_quantity: { divide_by: 2 } }]) {
    expect(() => assertLabSandboxPrice({ ...price(expected), ...patch }, expected)).toThrow()
  }
  const pack = LAB_STRIPE_SANDBOX.products[1]
  expect(() => assertLabSandboxPrice({ ...price(pack), recurring: { interval: 'month' } }, pack)).toThrow()
})
it('verifies the three packages without creating charges or granting entitlements', async () => {
  const stripe = { accounts: { retrieve: vi.fn(async () => ({ id: LAB_STRIPE_SANDBOX.accountId })) }, prices: {
    retrieve: vi.fn(async id => price(LAB_STRIPE_SANDBOX.products.find(p => p.priceId === id))) }, checkout: { sessions: { create: vi.fn() } } }
  const result = await verifyLabStripeSandbox(stripe)
  expect(result).toMatchObject({ livemode: false, catalogVerified: true, checkoutEnabled: false })
  expect(result.products.map(p => [p.usd, p.designs])).toEqual([[5, 15], [10, 30], [25, 100]])
  expect(stripe.prices.retrieve).toHaveBeenCalledTimes(3)
  expect(stripe.checkout.sessions.create).not.toHaveBeenCalled()
})
