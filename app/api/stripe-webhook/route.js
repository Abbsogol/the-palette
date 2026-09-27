import Stripe from 'stripe'
import { stripeId } from '@/lib/subscription-plans'
import { serviceClient as supabase } from '@/lib/auth'
import { reconcileLateDepositRefund, refundLateDeposit } from '@/lib/deposit-refund'
import { reconcilePaymentRefund } from '@/lib/refund-status'
import { releaseSubscriptionCheckout } from '@/lib/subscription-checkout'
import { reconcileSubscription } from '@/lib/subscription-reconciliation'
import { resolvePricePlan } from '@/lib/subscription-price'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
async function markRefundPending(intentId) {
  if (!intentId) return
  const { error } = await supabase.rpc('mark_payment_refund_pending', { p_intent: intentId })
  if (error) throw error
}
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
    if (['checkout.session.async_payment_failed', 'checkout.session.expired'].includes(event.type) && object?.mode === 'subscription') {
      const session = await stripe.checkout.sessions.retrieve(object.id)
      if (session.id !== object.id || session.mode !== 'subscription' || !session.metadata?.userId) throw new Error('Checkout identity mismatch')
      const { data: attempt, error } = await supabase.from('subscription_checkouts').select('id,session_id')
        .eq('user_id', session.metadata.userId).eq('id', session.metadata.checkoutAttemptId).maybeSingle()
      if (error) throw error
      if (attempt) await releaseSubscriptionCheckout(supabase, stripe, session.metadata.userId, { ...attempt, session_id: attempt.session_id || session.id }, session)
      return Response.json({ received: true })
    }
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
    if (['refund.created','refund.updated','refund.failed'].includes(event.type)) {
      const eventIntentId = stripeId(object.payment_intent)
      await markRefundPending(eventIntentId)
      const refund = await stripe.refunds.retrieve(object.id)
      if (refund.id !== object.id) throw new Error('Refund identity mismatch')
      const intentId = stripeId(refund.payment_intent)
      if (!intentId) return Response.json({ received: true, ignored: true })
      if (eventIntentId && eventIntentId !== intentId) throw new Error('Refund payment identity mismatch')
      if (!eventIntentId) await markRefundPending(intentId)
      if (!await reconcileLateDepositRefund(supabase, stripe, intentId, event.created, refund)) {
        const intent = await stripe.paymentIntents.retrieve(intentId)
        await reconcilePaymentRefund(supabase, stripe, intent, event.id, refund)
      }
      return Response.json({ received:true })
    }
    if (event.type === 'charge.refunded' && object?.payment_intent) {
      const intentId = stripeId(object.payment_intent)
      await markRefundPending(intentId)
      if (await reconcileLateDepositRefund(supabase, stripe, intentId, event.created)) return Response.json({ received: true })
      const intent = await stripe.paymentIntents.retrieve(intentId)
      await reconcilePaymentRefund(supabase, stripe, intent, event.id)
      return Response.json({ received: true })
    }
    if (['invoice.paid','invoice.payment_failed'].includes(event.type)) {
      const invoice = await stripe.invoices.retrieve(object.id)
      const subscriptionId = stripeId(invoice.parent?.subscription_details?.subscription || invoice.subscription)
      if (!subscriptionId) return Response.json({ received:true })
      if (event.type === 'invoice.payment_failed') {
        await reconcileSubscription(supabase, stripe, {
          subscriptionId, customerId: stripeId(invoice.customer),
          userId: invoice.parent?.subscription_details?.metadata?.userId,
          eventId: event.id, created: event.created,
        })
        return Response.json({ received:true })
      }
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
      if (invoice.status!=='paid' || !['subscription_create','subscription_cycle'].includes(invoice.billing_reason)) {
        return Response.json({ received:true, ignored:true })
      }
      if (invoice.lines?.has_more) throw new Error('Invoice line pagination requires reconciliation')
      const candidates=(invoice.lines?.data || []).filter(line => {
        const detail=line.parent?.subscription_item_details
        return detail && !detail.proration && detail.subscription===subscriptionId && line.quantity===1
      })
      const lines=[]
      for (const line of candidates) {
        const plan=await resolvePricePlan(supabase,line.pricing?.price_details?.price)
        if (plan) lines.push({line,plan})
      }
      if (lines.length!==1 || !Number.isSafeInteger(lines[0].line.period?.start) || !Number.isSafeInteger(lines[0].line.period?.end)) {
        throw new Error('Invoice period or Price is not recognized')
      }
      const {line,plan}=lines[0]
      const { error } = await supabase.rpc('grant_subscription_credits', {
        p_event_id:event.id,p_invoice_id:invoice.id,p_user_id:userId,p_subscription_id:subscriptionId,p_customer_id:customerId,
        p_period_start:line.period.start,p_period_end:line.period.end,p_plan_id:plan,
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
      const result = await reconcileSubscription(supabase, stripe, {
        subscriptionId, customerId: stripeId(object.customer), userId: object.metadata?.userId,
        eventId: event.id, created: event.created, session: subscriptionCheckout ? object : null,
      })
      if (!result) return Response.json({ received: true })
      const { subscription, userId } = result
      if (subscriptionLifecycle && ['canceled', 'incomplete_expired'].includes(subscription.status)) {
        const { data: attempt, error: attemptError } = await supabase.from('subscription_checkouts')
          .select('id,session_id').eq('user_id', userId).maybeSingle()
        if (attemptError) throw attemptError
        if (attempt?.session_id) {
          const session = await stripe.checkout.sessions.retrieve(attempt.session_id)
          // A late cancellation of an older subscription must not release a
          // newer payable checkout owned by the same account.
          if (stripeId(session.subscription) === subscription.id) {
            await releaseSubscriptionCheckout(supabase, stripe, userId, attempt, session)
          }
        }
      }
      return Response.json({ received: true })
    } catch (error) {
      console.error('Subscription transaction failed:', error)
      return Response.json({ error: 'Subscription could not be recorded' }, { status: 500 })
    }
  }

  return Response.json({ received: true })
}
