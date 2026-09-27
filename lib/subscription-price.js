import { planForPrice, stripeId } from '@/lib/subscription-plans'

// Register only a Price recognized by this server's configured plans. The
// durable mapping lets old purchases survive a later Price rotation.
export async function resolvePricePlan(supabase, price) {
  const priceId = stripeId(price)
  if (!priceId) return null
  const { data, error } = await supabase.rpc('resolve_subscription_price', {
    p_price_id: priceId, p_plan_id: planForPrice(price),
  })
  if (error) throw error
  return data
}

export async function resolveSubscriptionPlan(supabase, subscription) {
  const items = subscription.items?.data
  if (!Array.isArray(items) || items.length !== 1 || subscription.items.has_more) return null
  return resolvePricePlan(supabase, items[0].price)
}
