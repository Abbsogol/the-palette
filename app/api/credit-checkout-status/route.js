import Stripe from 'stripe'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'
import { stripeId } from '@/lib/subscription-plans'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function GET(request) {
  const user = await getSessionUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  const sessionId = new URL(request.url).searchParams.get('session_id')
  if (!sessionId || !/^cs_[a-zA-Z0-9_]+$/.test(sessionId)) {
    return Response.json({ error: 'Invalid checkout session' }, { status: 400 })
  }
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId)
    if (session.metadata?.userId !== user.id || session.mode !== 'payment' ||
        (session.metadata?.type && session.metadata.type !== 'credits') || !session.metadata?.credits) {
      return Response.json({ error: 'Checkout not found' }, { status: 404 })
    }
    const { data: receipt, error } = await supabase.from('credit_payments')
      .select('fulfilled,refunded_credits,payment_intent').eq('session_id', sessionId).eq('user_id', user.id).maybeSingle()
    if (error) throw error
    const intentId = receipt?.payment_intent || stripeId(session.payment_intent)
    if (intentId) {
      const { data: refund, error: refundError } = await supabase.from('payment_refund_states').select('status')
        .eq('payment_intent', intentId).eq('user_id', user.id).eq('kind', 'credits').maybeSingle()
      if (refundError) throw refundError
      if (refund && refund.status !== 'none') {
        return Response.json({ status: ['refunded','partially_refunded'].includes(refund.status) ? 'refund_recorded' : refund.status }, { headers: { 'Cache-Control':'no-store' } })
      }
    }
    if (!receipt?.fulfilled) {
      const { data: failure, error: failureError } = await supabase.from('checkout_failures')
        .select('status').eq('session_id', sessionId).eq('user_id', user.id).maybeSingle()
      if (failureError) throw failureError
      return Response.json({ status: failure?.status || (session.status === 'expired' ? 'expired' : 'pending') }, { headers: { 'Cache-Control': 'no-store' } })
    }
    const { data: profile, error: balanceError } = await supabase.from('profiles_data')
      .select('credit_balance').eq('id', user.id).single()
    if (balanceError || !profile) throw balanceError || new Error('Profile missing')
    return Response.json({ status: receipt.refunded_credits > 0 ? 'refund_recorded' : 'fulfilled', creditBalance: profile.credit_balance }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Credit checkout status failed:', error)
    return Response.json({ error: 'Unable to confirm checkout' }, { status: 503 })
  }
}
