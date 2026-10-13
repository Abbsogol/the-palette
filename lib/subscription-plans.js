// Preserve the existing live website catalog. A different test account must
// supply its own Prices; Stripe object IDs do not transfer between accounts.
const legacyLiveCatalog = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live_')
export const SUBSCRIPTION_PLANS = {
  premium: { priceId: process.env.STRIPE_PRICE_PREMIUM?.trim() || (legacyLiveCatalog ? 'price_1TnxOq14PyqGjXgedydlYqto' : null), credits: 5 },
  pro_creator: { priceId: process.env.STRIPE_PRICE_PRO_CREATOR?.trim() || (legacyLiveCatalog ? 'price_1TnxOG14PyqGjXgeKYmTKhQf' : null), credits: 20 },
}
export const stripeId = value => typeof value === 'string' ? value : value?.id
export function planForPrice(price) {
  const id = stripeId(price)
  if (!id) return null
  return Object.entries(SUBSCRIPTION_PLANS).find(([, plan]) => plan.priceId === id)?.[0] || null
}
export function subscriptionPlan(subscription) {
  const items = subscription.items?.data
  if (!Array.isArray(items) || items.length !== 1 || subscription.items.has_more) return null
  return planForPrice(items[0].price)
}
