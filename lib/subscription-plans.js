// Keep production defaults compatible while allowing isolated sandbox Prices.
export const SUBSCRIPTION_PLANS = {
  premium: { priceId: process.env.STRIPE_PRICE_PREMIUM || 'price_1TnxOq14PyqGjXgedydlYqto', credits: 5 },
  pro_creator: { priceId: process.env.STRIPE_PRICE_PRO_CREATOR || 'price_1TnxOG14PyqGjXgeKYmTKhQf', credits: 20 },
}
export const stripeId = value => typeof value === 'string' ? value : value?.id
export function planForPrice(price) {
  return Object.entries(SUBSCRIPTION_PLANS).find(([, plan]) => plan.priceId === stripeId(price))?.[0] || null
}
export function subscriptionPlan(subscription) {
  const items = subscription.items?.data
  if (!Array.isArray(items) || items.length !== 1 || subscription.items.has_more) return null
  return planForPrice(items[0].price)
}
