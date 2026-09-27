import { stripeId } from '@/lib/subscription-plans'

// A completed Checkout Session can still be awaiting payment. Only an
// immutable terminal subscription status proves that it cannot later renew.
export async function subscriptionForCheckout(stripe, session, userId, supabase) {
  const subscriptionId = stripeId(session.subscription)
  const customerId = stripeId(session.customer)
  if (session.mode !== 'subscription' || session.metadata?.userId !== userId || !subscriptionId || !customerId) {
    throw new Error('Subscription checkout identity mismatch')
  }
  const subscription = await stripe.subscriptions.retrieve(subscriptionId)
  if (subscription.id !== subscriptionId || stripeId(subscription.customer) !== customerId) {
    throw new Error('Subscription checkout identity mismatch')
  }
  if (subscription.metadata?.userId !== userId) {
    const { data, error } = await supabase.rpc('subscription_owner_matches', {
      p_subscription_id: subscriptionId, p_customer_id: customerId, p_user_id: userId,
    })
    if (error) throw error
    if (data !== true) throw new Error('Subscription checkout identity mismatch')
  }
  return subscription
}

export async function releaseSubscriptionCheckout(supabase, stripe, userId, attempt, providedSession) {
  if (!attempt?.session_id) return false
  const session = providedSession || await stripe.checkout.sessions.retrieve(attempt.session_id)
  if (session.id !== attempt.session_id || session.mode !== 'subscription' || session.metadata?.userId !== userId ||
    session.metadata?.checkoutAttemptId !== attempt.id) {
    throw new Error('Subscription checkout attempt mismatch')
  }
  if (session.status === 'expired') {
    const { data, error } = await supabase.rpc('expire_subscription_checkout', {
      p_user_id: userId, p_id: attempt.id, p_session_id: attempt.session_id,
    })
    if (error) throw error
    return data === true
  }
  if (session.status !== 'complete' || !session.subscription) return false
  const subscription = await subscriptionForCheckout(stripe, session, userId, supabase)
  if (!['canceled', 'incomplete_expired'].includes(subscription.status)) return false
  const { data, error } = await supabase.rpc('close_terminal_subscription_checkout', {
    p_user_id: userId, p_attempt_id: attempt.id, p_session_id: session.id,
    p_subscription_id: subscription.id, p_customer_id: stripeId(subscription.customer), p_status: subscription.status,
  })
  if (error) throw error
  return data === true
}
