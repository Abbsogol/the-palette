import Stripe from 'stripe'
import { SUBSCRIPTION_PLANS as PLANS } from '@/lib/subscription-plans'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'
import { releaseSubscriptionCheckout } from '@/lib/subscription-checkout'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)


export async function POST(request) {
  try {
    const user = await getSessionUser(request)
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    const { planId } = await request.json()

    if (!planId) {
      return Response.json({ error: 'Missing planId' }, { status: 400 })
    }

    // Object.hasOwn (not just truthiness) — a planId of "constructor" or
    // "__proto__" would otherwise resolve to an inherited Object.prototype
    // value and pass a plain `!plan` check.
    if (typeof planId !== 'string' || !Object.hasOwn(PLANS, planId)) {
      return Response.json({ error: 'Invalid plan' }, { status: 400 })
    }
    if (!PLANS[planId].priceId) {
      return Response.json({ error: 'Subscriptions are not configured for this environment.' }, { status: 503 })
    }

    const { data: profile, error: profileError } = await supabase.from('profiles_data')
      .select('subscription_tier, subscription_status, stripe_customer_id').eq('id', userId).single()
    if (profileError || !profile) return Response.json({ error: 'Unable to verify subscription' }, { status: 503 })
    if (profile.subscription_tier && profile.subscription_tier !== 'free') {
      return Response.json({ error: 'You already have a subscription. Manage your existing plan instead.' }, { status: 409 })
    }
    if (profile.stripe_customer_id) {
      const subscriptions = await stripe.subscriptions.list({ customer: profile.stripe_customer_id, status: 'all', limit: 100 })
      if (subscriptions.has_more || subscriptions.data.some(s => !['canceled', 'incomplete_expired'].includes(s.status))) {
        return Response.json({ error: 'An existing subscription must be managed before starting another.' }, { status: 409 })
      }
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laque.app'
    // A database reservation spans deployments, retries, tabs and plan changes.
    // Existing attempts keep their original Stripe parameters and idempotency key.
    for (let retry = 0; retry < 2; retry++) {
      const { data: attempt, error } = await supabase.rpc('reserve_subscription_checkout_v2', {
        p_user_id: userId, p_plan_id: planId, p_email: user.email, p_base_url: baseUrl, p_price_id: PLANS[planId].priceId,
      })
      if (error) {
        if (error.message?.includes('ALREADY_SUBSCRIBED')) return Response.json({ error: 'You already have a subscription.' }, { status: 409 })
        throw error
      }
      if (!attempt?.id) throw new Error('Missing checkout reservation')
      if (attempt.session_id) {
        const session = await stripe.checkout.sessions.retrieve(attempt.session_id)
        if (await releaseSubscriptionCheckout(supabase, stripe, userId, attempt, session)) continue
        if (session.status === 'complete') return Response.json({ error: 'Your subscription is being processed. Please wait before starting another checkout.' }, { status: 409 })
        if (attempt.plan_id !== planId) return Response.json({ error: 'You already have a checkout open for another plan. Complete it or wait for it to expire.' }, { status: 409 })
        if (session.status !== 'open' || !session.url) throw new Error('Checkout is not available')
        return Response.json({ url: session.url })
      }
      if (attempt.plan_id !== planId) return Response.json({ error: 'A checkout for another plan is being prepared. Please retry that plan.' }, { status: 409 })
      // Stripe may prune idempotency keys after 24 hours. An ambiguous old
      // create must be reconciled, never blindly replayed with a new key.
      if (!attempt.price_id || Date.now() - new Date(attempt.created_at).getTime() > 23 * 3600000) {
        return Response.json({ error: 'We could not confirm your previous checkout. Please contact support before retrying.' }, { status: 503 })
      }
      const session = await stripe.checkout.sessions.create({
        integration_identifier: 'laque_checkout_qmrtxvpa',
        mode: 'subscription',
        ...(attempt.customer_id ? { customer: attempt.customer_id } : { customer_email: attempt.email }),
        line_items: [{ price: attempt.price_id, quantity: 1 }],
        success_url: `${attempt.base_url}/upgrade/success?plan=${attempt.plan_id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${attempt.base_url}/upgrade`,
        metadata: { userId, planId: attempt.plan_id, checkoutAttemptId: attempt.id },
        subscription_data: { metadata: { userId, planId: attempt.plan_id } },
      }, { idempotencyKey: `subscription-${attempt.id}` })
      const { data: saved, error: saveError } = await supabase.from('subscription_checkouts')
        .update({ session_id: session.id }).eq('user_id', userId).eq('id', attempt.id).select('id').single()
      if (saveError || !saved) throw saveError || new Error('Checkout persistence failed')
      return Response.json({ url: session.url })
    }
    return Response.json({ error: 'Checkout changed while processing. Please retry.' }, { status: 409 })

  } catch (err) {
    console.error('create-subscription error:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
