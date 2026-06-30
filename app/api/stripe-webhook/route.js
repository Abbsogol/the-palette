import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )

  // ── Credit pack purchase (one-time payment) ──────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    // One-time payment = credit pack
    if (session.mode === 'payment') {
      const userId = session.metadata?.userId
      const credits = parseInt(session.metadata?.credits || '0', 10)

      if (!userId || !credits) {
        console.error('Missing metadata in webhook:', session.metadata)
        return Response.json({ error: 'Missing metadata' }, { status: 400 })
      }

      const { error } = await supabase.rpc('increment_credits', {
        user_id: userId,
        amount: credits,
      })

      if (error) {
        console.error('Failed to add credits:', error)
        return Response.json({ error: 'Failed to add credits' }, { status: 500 })
      }

      console.log(`Added ${credits} credits to user ${userId}`)
    }

    // Subscription checkout completed → activate subscription tier
    if (session.mode === 'subscription') {
      const userId = session.metadata?.userId
      const planId = session.metadata?.planId

      if (!userId || !planId) {
        console.error('Missing subscription metadata:', session.metadata)
        return Response.json({ error: 'Missing metadata' }, { status: 400 })
      }

      const { error } = await supabase
        .from('profiles')
        .update({ subscription_tier: planId })
        .eq('id', userId)

      if (error) {
        console.error('Failed to update subscription tier:', error)
        return Response.json({ error: 'Failed to update subscription' }, { status: 500 })
      }

      console.log(`Activated ${planId} subscription for user ${userId}`)
    }
  }

  // ── Subscription cancelled ───────────────────────────────────────────────
  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object
    const userId = subscription.metadata?.userId

    if (userId) {
      const { error } = await supabase
        .from('profiles')
        .update({ subscription_tier: null })
        .eq('id', userId)

      if (error) {
        console.error('Failed to clear subscription tier:', error)
      } else {
        console.log(`Cleared subscription for user ${userId}`)
      }
    }
  }

  // ── Subscription updated (e.g. plan change) ──────────────────────────────
  if (event.type === 'customer.subscription.updated') {
    const subscription = event.data.object
    const userId = subscription.metadata?.userId
    const planId = subscription.metadata?.planId

    if (userId && planId && subscription.status === 'active') {
      await supabase
        .from('profiles')
        .update({ subscription_tier: planId })
        .eq('id', userId)
    }
  }

  return Response.json({ received: true })
}
