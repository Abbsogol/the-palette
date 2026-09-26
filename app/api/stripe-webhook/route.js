import Stripe from 'stripe'
import { serviceClient as supabase } from '@/lib/auth'

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

  // Credit fulfillment/refunds include the event receipt in the same database
  // transaction as the balance. A crash cannot acknowledge an unpaid grant.
  try {
    const object = event.data?.object
    const checkoutEvent = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)
    if (checkoutEvent && object?.mode === 'payment' && (!object.metadata?.type || object.metadata.type === 'credits')) {
      if (object.payment_status !== 'paid') return Response.json({ received: true, pending: true })
      const credits = Number(object.metadata?.credits)
      if (!object.metadata?.userId || !Number.isSafeInteger(credits) || credits <= 0 || !object.payment_intent || !object.id) {
        return Response.json({ error: 'Invalid credit metadata' }, { status: 400 })
      }
      const { error } = await supabase.rpc('apply_credit_payment', {
        p_event_id: event.id, p_payment_intent: typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent.id,
        p_user_id: object.metadata.userId, p_credits: credits, p_session_id: object.id,
      })
      if (error) throw error
      return Response.json({ received: true })
    }
    if (event.type === 'charge.refunded' && object?.payment_intent) {
      const intentId = typeof object.payment_intent === 'string' ? object.payment_intent : object.payment_intent.id
      const intent = await stripe.paymentIntents.retrieve(intentId)
      if (intent.metadata?.type === 'credits') {
        const credits = Number(intent.metadata.credits)
        if (!intent.metadata.userId || !Number.isSafeInteger(credits) || credits <= 0 ||
            !Number.isSafeInteger(object.amount) || object.amount <= 0 ||
            !Number.isSafeInteger(object.amount_refunded) || object.amount_refunded < 0 || object.amount_refunded > object.amount) {
          return Response.json({ error: 'Invalid refund metadata' }, { status: 400 })
        }
        const { error } = await supabase.rpc('apply_credit_payment', {
          p_event_id: event.id, p_payment_intent: intentId, p_user_id: intent.metadata.userId, p_credits: credits,
          p_refunded_credits: Math.round(credits * object.amount_refunded / object.amount),
        })
        if (error) throw error
        return Response.json({ received: true })
      }
    }
  } catch (error) {
    console.error('Credit payment transaction failed:', error)
    return Response.json({ error: 'Payment could not be recorded' }, { status: 500 })
  }

  // Idempotency guard — skip if this exact Stripe event has already been processed
  const { error: dedupeError } = await supabase
    .from('processed_webhook_events')
    .insert({ event_id: event.id })

  if (dedupeError) {
    if (dedupeError.code === '23505') {
      // Already processed this event — tell Stripe we're done, don't reapply anything
      return Response.json({ received: true, duplicate: true })
    }
    console.error('Failed to record webhook event:', dedupeError)
    return Response.json({ error: 'Failed to record event' }, { status: 500 })
  }

  // If any write below fails — or the handler throws at all — un-record the
  // event first, otherwise a genuine Stripe retry would hit the dedupe guard
  // above and get silently skipped without the failed write ever completing.
  const unrecordEvent = () => supabase.from('processed_webhook_events').delete().eq('event_id', event.id)
  const failWithRetry = async (message, err, status = 500) => {
    console.error(message, err)
    await unrecordEvent()
    return Response.json({ error: message }, { status })
  }

  try {
    // ── Credit pack purchase (one-time payment) ────────────────────────────
    if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)) {
      const session = event.data.object

      // One-time payment — could be credit pack or deposit
      if (session.mode === 'payment' && session.payment_status === 'paid') {
        const { type, bookingId, userId, credits } = session.metadata || {}

        // Boost payment
        if (type === 'boost' && session.metadata?.designId) {
          const { designId, days } = session.metadata
          const daysNum = parseInt(days, 10)
          if (!Number.isFinite(daysNum) || daysNum <= 0) {
            return failWithRetry('Invalid boost metadata:', session.metadata, 400)
          }
          // Extend from now (or from current boosted_until if still active)
          const { data: existing, error: readErr } = await supabase
            .from('designs')
            .select('boosted_until')
            .eq('id', designId)
            .single()
          if (readErr) return failWithRetry('Failed to read design for boost:', readErr)
          const base = existing?.boosted_until && new Date(existing.boosted_until) > new Date()
            ? new Date(existing.boosted_until)
            : new Date()
          const boostedUntil = new Date(base.getTime() + daysNum * 86400000).toISOString()
          const { error: boostErr } = await supabase.from('designs').update({ boosted_until: boostedUntil }).eq('id', designId)
          if (boostErr) return failWithRetry('Failed to apply boost:', boostErr)
          console.log(`Boosted design ${designId} until ${boostedUntil}`)
        }

        // Deposit payment
        if (type === 'deposit' && bookingId) {
          const { error } = await supabase
            .from('bookings')
            .update({ deposit_paid: true })
            .eq('id', bookingId)

          if (error) return failWithRetry('Failed to mark deposit paid:', error)

          console.log(`Deposit paid for booking ${bookingId}`)
        }

      }

      // Subscription checkout completed → activate subscription tier
      if (session.mode === 'subscription' && ['paid', 'no_payment_required'].includes(session.payment_status)) {
        const userId = session.metadata?.userId
        const planId = session.metadata?.planId

        if (!userId || !planId) {
          return failWithRetry('Missing subscription metadata:', session.metadata, 400)
        }

        // profiles_data — subscription_tier/stripe_customer_id are expression
        // columns in the profiles view (masked by auth.uid() = id), not directly writable there
        const { error } = await supabase
          .from('profiles_data')
          .update({ subscription_tier: planId, stripe_customer_id: session.customer })
          .eq('id', userId)

        if (error) return failWithRetry('Failed to update subscription tier:', error)

        console.log(`Activated ${planId} subscription for user ${userId}`)
      }
    }

    // ── Subscription cancelled ─────────────────────────────────────────────
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object
      const userId = subscription.metadata?.userId

      if (userId) {
        const { error } = await supabase
          .from('profiles_data')
          .update({ subscription_tier: null, subscription_status: null })
          .eq('id', userId)

        if (error) return failWithRetry('Failed to clear subscription tier:', error)

        console.log(`Cleared subscription for user ${userId}`)
      }
    }

    // ── Subscription updated (plan change, or a renewal payment failing) ───
    if (event.type === 'customer.subscription.updated') {
      const subscription = event.data.object
      const userId = subscription.metadata?.userId
      const planId = subscription.metadata?.planId

      if (userId && planId && subscription.status === 'active') {
        const { error } = await supabase
          .from('profiles_data')
          .update({ subscription_tier: planId, subscription_status: 'active' })
          .eq('id', userId)

        if (error) return failWithRetry('Failed to update subscription plan:', error)
      } else if (userId && (subscription.status === 'past_due' || subscription.status === 'unpaid')) {
        // Grace period: a renewal charge failed and Stripe is still retrying
        // it. subscription_tier is deliberately left untouched — access
        // stays intact until Stripe either recovers the payment (back to
        // 'active' above) or fully cancels the subscription
        // (customer.subscription.deleted, handled separately). Only the
        // status is recorded, for possible future in-app surfacing.
        const { error } = await supabase
          .from('profiles_data')
          .update({ subscription_status: subscription.status })
          .eq('id', userId)

        if (error) return failWithRetry('Failed to record subscription status:', error)

        console.log(`Subscription ${subscription.status} for user ${userId} — access kept during grace period`)
      }
    }

    // ── Refund issued (e.g. from the Stripe dashboard) ──────────────────────
    if (event.type === 'charge.refunded') {
      const charge = event.data.object
      const paymentIntentId = charge.payment_intent

      if (paymentIntentId) {
        // Metadata lives on the PaymentIntent (set via payment_intent_data
        // at checkout-session creation), not necessarily on the charge
        // itself — retrieved directly rather than assuming charge.metadata
        // mirrors it.
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId)
        const { type, userId, credits, designId, bookingId } = pi.metadata || {}

        if (type === 'boost' && designId && charge.refunded) {
          // Boost is a single all-or-nothing state, so only a FULL refund
          // (charge.refunded, not just amount_refunded > 0) reverses it.
          const { error } = await supabase.from('designs').update({ boosted_until: null }).eq('id', designId)
          if (error) return failWithRetry('Failed to reverse boost on refund:', error)
          console.log(`Reversed boost on design ${designId} (refund on charge ${charge.id})`)
        } else if (type === 'deposit' && bookingId && charge.refunded) {
          const { error } = await supabase.from('bookings').update({ deposit_paid: false }).eq('id', bookingId)
          if (error) return failWithRetry('Failed to reverse deposit on refund:', error)
          console.log(`Reversed deposit-paid on booking ${bookingId} (refund on charge ${charge.id})`)
        } else {
          console.log('charge.refunded with no reversible metadata:', charge.id)
        }
      }
    }

    return Response.json({ received: true })
  } catch (err) {
    return failWithRetry('Unhandled webhook error:', err)
  }
}
