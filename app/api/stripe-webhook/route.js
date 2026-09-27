import Stripe from 'stripe'
import { planForPrice, stripeId, subscriptionPlan } from '@/lib/subscription-plans'
import { serviceClient as supabase } from '@/lib/auth'
import { recordDepositRefund, refundLateDeposit } from '@/lib/deposit-refund'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
async function settleCheckout(session) {
  if (!session.metadata?.checkoutAttemptId || session.metadata.type === 'deposit') return
  const { error } = await supabase.rpc('settle_payment_checkout', {
    p_user_id:session.metadata.userId || session.metadata.creatorId,
    p_attempt_id:session.metadata.checkoutAttemptId,p_session_id:session.id,
  })
  if (error) throw error
}

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

  try {
    const object = event.data?.object
    if (['checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type) && object?.mode === 'payment') {
      const session = await stripe.checkout.sessions.retrieve(object.id)
      if (session.id !== object.id || session.mode !== 'payment') throw new Error('Checkout identity mismatch')
      // Ignore stale failures if Stripe now reports success or processing.
      const terminal = event.type === 'checkout.session.expired' ? session.status === 'expired'
        : session.status === 'complete' && session.payment_status === 'unpaid'
      if (!terminal || session.payment_status === 'paid') return Response.json({ received: true, ignored: true })
      const kind = session.metadata?.type || 'credits'
      if (!['credits','boost','deposit'].includes(kind)) return Response.json({ received: true, ignored: true })
      const userId = kind === 'boost' ? session.metadata?.creatorId : session.metadata?.userId
      if (!userId) throw new Error('Checkout account missing')
      const { error } = await supabase.rpc('close_failed_checkout', {
        p_session_id: session.id, p_user_id: userId, p_kind: kind,
        p_status: event.type === 'checkout.session.expired' ? 'expired' : 'failed',
        p_attempt_id: session.metadata?.checkoutAttemptId || null,
        p_target_id: kind === 'deposit' ? session.metadata?.bookingId : kind === 'boost' ? session.metadata?.designId : null,
      })
      if (error) throw error
      return Response.json({ received: true })
    }
    const paidCheckout = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type)
    if (paidCheckout && object?.mode === 'payment' && ['boost','deposit'].includes(object.metadata?.type)) {
      if (object.payment_status !== 'paid') return Response.json({ received: true, pending: true })
      const meta = object.metadata
      const { error } = await supabase.rpc('apply_order_payment', {
        p_event_id:event.id, p_intent:stripeId(object.payment_intent), p_user_id:meta.type==='boost'?meta.creatorId:meta.userId,
        p_kind:meta.type, p_target_id:meta.type==='boost'?meta.designId:meta.bookingId,
        p_units:meta.type==='boost'?Number(meta.days):0, p_session_id:object.id,
      })
      if (error) throw error
      if (meta.type === 'deposit') await refundLateDeposit(supabase, stripe, stripeId(object.payment_intent), event.created)
      await settleCheckout(object)
      return Response.json({ received:true })
    }
    if (['refund.created','refund.updated','refund.failed'].includes(event.type) && object?.metadata?.type === 'late_deposit') {
      const refund = await stripe.refunds.retrieve(object.id)
      await recordDepositRefund(supabase, refund, event.created)
      return Response.json({ received:true })
    }
    if (event.type === 'charge.refunded' && object?.payment_intent) {
      const intent = await stripe.paymentIntents.retrieve(stripeId(object.payment_intent))
      const meta = intent.metadata || {}
      if (['boost','deposit'].includes(meta.type)) {
        if (!Number.isSafeInteger(object.amount) || object.amount<=0 || !Number.isSafeInteger(object.amount_refunded) || object.amount_refunded<0 || object.amount_refunded>object.amount) {
          return Response.json({ error:'Invalid refund amount' },{ status:400 })
        }
        // These entitlements are reversed only on a full refund. Partial
        // credit-pack refunds follow their separate cumulative credit ledger.
        if (object.amount_refunded<object.amount) return Response.json({ received:true })
        const { error } = await supabase.rpc('apply_order_payment', {
          p_event_id:event.id, p_intent:stripeId(object.payment_intent), p_user_id:meta.type==='boost'?meta.creatorId:meta.userId,
          p_kind:meta.type, p_target_id:meta.type==='boost'?meta.designId:meta.bookingId,
          p_units:meta.type==='boost'?Number(meta.days):0, p_refunded:true,
        })
        if (error) throw error
        return Response.json({ received:true })
      }
    }
    if (['invoice.paid','invoice.payment_failed'].includes(event.type)) {
      const invoice = await stripe.invoices.retrieve(object.id)
      const subscriptionId = stripeId(invoice.parent?.subscription_details?.subscription || invoice.subscription)
      if (!subscriptionId) return Response.json({ received:true })
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const customerId = stripeId(subscription.customer)
      if (stripeId(invoice.customer)!==customerId) throw new Error('Invoice customer mismatch')
      const { data: owner, error: ownerError } = await supabase.from('subscription_accounts')
        .select('user_id').eq('subscription_id',subscriptionId).eq('customer_id',customerId).maybeSingle()
      if (ownerError) throw ownerError
      const { data: profile, error: profileError } = await supabase.from('profiles_data')
        .select('id').eq('stripe_subscription_id',subscriptionId).eq('stripe_customer_id',customerId).maybeSingle()
      if (profileError) throw profileError
      // Metadata is only a bootstrap fallback while checkout is still binding.
      const userId = owner?.user_id || profile?.id || subscription.metadata?.userId
      if (!userId) throw new Error('Invoice account not bound')
      if (event.type==='invoice.payment_failed') {
        const { error } = await supabase.rpc('apply_subscription_event', {
          p_event_id:event.id,p_user_id:userId,p_subscription_id:subscriptionId,p_customer_id:customerId,
          p_plan_id:subscriptionPlan(subscription),p_status:subscription.status,p_created:event.created,
        })
        if (error) throw error
        return Response.json({ received:true })
      }
      if (invoice.status!=='paid' || !['subscription_create','subscription_cycle'].includes(invoice.billing_reason)) {
        return Response.json({ received:true, ignored:true })
      }
      if (invoice.lines?.has_more) throw new Error('Invoice line pagination requires reconciliation')
      const lines=(invoice.lines?.data || []).filter(line => {
        const detail=line.parent?.subscription_item_details
        return detail && !detail.proration && detail.subscription===subscriptionId && line.quantity===1 &&
          planForPrice(line.pricing?.price_details?.price)
      })
      if (lines.length!==1 || !Number.isSafeInteger(lines[0].period?.start) || !Number.isSafeInteger(lines[0].period?.end)) {
        throw new Error('Invoice period or Price is not recognized')
      }
      const line=lines[0]
      const { error } = await supabase.rpc('grant_subscription_credits', {
        p_event_id:event.id,p_invoice_id:invoice.id,p_user_id:userId,p_subscription_id:subscriptionId,p_customer_id:customerId,
        p_period_start:line.period.start,p_period_end:line.period.end,p_plan_id:planForPrice(line.pricing.price_details.price),
      })
      if (error) throw error
      return Response.json({ received:true })
    }
  } catch (error) {
    console.error('Payment transaction failed:',error)
    return Response.json({ error:'Payment could not be recorded' },{ status:500 })
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
      await settleCheckout(object)
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

  const object = event.data?.object
  const subscriptionCheckout = ['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type) && object?.mode === 'subscription'
  const subscriptionLifecycle = ['customer.subscription.deleted', 'customer.subscription.updated', 'customer.subscription.paused', 'customer.subscription.resumed'].includes(event.type)
  if (subscriptionCheckout || subscriptionLifecycle) {
    if (subscriptionCheckout && !['paid', 'no_payment_required'].includes(object.payment_status)) {
      return Response.json({ received: true, pending: true })
    }
    try {
      const subscriptionId = subscriptionCheckout
        ? (typeof object.subscription === 'string' ? object.subscription : object.subscription?.id) : object.id
      if (!subscriptionId) return Response.json({ error: 'Missing subscription identity' }, { status: 400 })
      // Stripe events can arrive out of order. Read current state rather than
      // reactivating a subscription from an old checkout/update snapshot.
      const subscription = await stripe.subscriptions.retrieve(subscriptionId)
      const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id
      const sessionCustomer = typeof object.customer === 'string' ? object.customer : object.customer?.id
      const userId = subscription.metadata?.userId
      if (!userId || (subscriptionCheckout && (object.metadata?.userId !== userId || sessionCustomer !== customerId))) {
        return Response.json({ error: 'Subscription identity mismatch' }, { status: 400 })
      }
      const { error } = await supabase.rpc('apply_subscription_event', {
        p_event_id: event.id, p_user_id: userId, p_subscription_id: subscription.id,
        p_customer_id: customerId, p_plan_id: subscriptionPlan(subscription),
        p_status: subscription.status, p_created: event.created,
        p_attempt_id: subscriptionCheckout ? object.metadata?.checkoutAttemptId || null : null,
        p_session_id: subscriptionCheckout ? object.id : null,
      })
      if (error) throw error
      return Response.json({ received: true })
    } catch (error) {
      console.error('Subscription transaction failed:', error)
      return Response.json({ error: 'Subscription could not be recorded' }, { status: 500 })
    }
  }

  return Response.json({ received: true })
}
