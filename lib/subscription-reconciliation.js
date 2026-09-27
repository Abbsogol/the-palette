import { stripeId } from '@/lib/subscription-plans'
import { resolveSubscriptionPlan } from '@/lib/subscription-price'

export async function reconcileSubscription(supabase, stripe, { subscriptionId, customerId, userId, eventId, created, session }) {
  const { data: claim, error: claimError } = await supabase.rpc('claim_subscription_reconciliation', {
    p_subscription_id: subscriptionId, p_customer_id: customerId, p_user_id: userId || null,
  })
  if (claimError) throw claimError
  if (claim?.status === 'deleted') return null
  if (claim?.status !== 'claimed') throw new Error('Subscription reconciliation in progress')
  try {
    // Never reuse a provider snapshot taken before this claim. Expired workers
    // cannot commit after a successor has retrieved and applied newer state.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)
    if (subscription.id !== subscriptionId || stripeId(subscription.customer) !== claim.customerId ||
      (session && (session.metadata?.userId !== claim.userId || stripeId(session.customer) !== claim.customerId))) {
      throw new Error('Subscription identity mismatch')
    }
    const { error } = await supabase.rpc('finish_subscription_reconciliation', {
      p_subscription_id: subscriptionId, p_token: claim.token, p_event_id: eventId,
      p_plan_id: await resolveSubscriptionPlan(supabase, subscription), p_status: subscription.status, p_created: created,
      p_attempt_id: session?.metadata?.checkoutAttemptId || null, p_session_id: session?.id || null,
    })
    if (error) throw error
    return { subscription, userId: claim.userId }
  } catch (error) {
    // Release only this worker's token, preserving the durable review marker.
    await supabase.rpc('release_subscription_reconciliation', { p_subscription_id: subscriptionId, p_token: claim.token })
    throw error
  }
}
