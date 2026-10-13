// Read-only sandbox setup. Never reuse the deposit key or legacy Lab catalog.
export const LAB_STRIPE_SANDBOX = Object.freeze({
  accountId: 'acct_1UOYhj2MrQDGVNuk',
  domain: 'laque-beta.vercel.app',
  products: [
    { key: 'monthly', productId: 'prod_laque_lab_monthly_beta_v1', priceId: 'price_1UOcXm2MrQDGVNukehimtNus', amount: 500, designs: 15, type: 'recurring' },
    { key: 'tokens30', productId: 'prod_laque_lab_tokens30_beta_v1', priceId: 'price_1UOcXy2MrQDGVNukhRkOnIcB', amount: 1000, designs: 30, type: 'one_time' },
    { key: 'tokens100', productId: 'prod_laque_lab_tokens100_beta_v1', priceId: 'price_1UOcY02MrQDGVNuksYQl6X39', amount: 2500, designs: 100, type: 'one_time' },
  ],
})

export function assertLabSandboxKey(key) {
  if (typeof key !== 'string' || key.trim() !== key || !/^(rk|sk)_test_[A-Za-z0-9]+$/.test(key)) {
    throw new Error('Configure a sandbox-only LAB_STRIPE_SANDBOX_KEY on the server.')
  }
}

export function assertLabSandboxPrice(price, expected) {
  const product = price?.product
  if (!price || price.id !== expected.priceId || price.livemode !== false || price.active !== true ||
      price.currency !== 'usd' || price.unit_amount !== expected.amount || price.billing_scheme !== 'per_unit' ||
      price.custom_unit_amount || price.transform_quantity || price.type !== expected.type ||
      typeof product !== 'object' || product?.id !== expected.productId || product.livemode !== false ||
      product.active !== true || product.deleted) throw new Error(`Sandbox package mismatch: ${expected.key}.`)
  if (expected.type === 'recurring') {
    if (price.recurring?.interval !== 'month' || price.recurring.interval_count !== 1 ||
        price.recurring.usage_type !== 'licensed') throw new Error('The Lab subscription must be a fixed monthly price.')
  } else if (price.recurring) throw new Error('Design tokens must be one-time packs.')
}

export async function verifyLabStripeSandbox(stripe) {
  const account = await stripe.accounts.retrieve()
  if (account.id !== LAB_STRIPE_SANDBOX.accountId) throw new Error('Wrong Stripe account. Keep existing deposit credentials separate.')
  const prices = await Promise.all(LAB_STRIPE_SANDBOX.products.map(async expected => {
    const price = await stripe.prices.retrieve(expected.priceId, { expand: ['product'] })
    assertLabSandboxPrice(price, expected)
    return { key: expected.key, priceId: expected.priceId, usd: expected.amount / 100, designs: expected.designs, type: expected.type }
  }))
  return { accountId: account.id, livemode: false, catalogVerified: true, checkoutEnabled: false, products: prices }
}
