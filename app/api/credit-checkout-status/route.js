import Stripe from 'stripe'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

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
      .select('fulfilled').eq('session_id', sessionId).eq('user_id', user.id).maybeSingle()
    if (error) throw error
    if (!receipt?.fulfilled) return Response.json({ status: session.status === 'expired' ? 'expired' : 'pending' })
    const { data: profile, error: balanceError } = await supabase.from('profiles_data')
      .select('credit_balance').eq('id', user.id).single()
    if (balanceError || !profile) throw balanceError || new Error('Profile missing')
    return Response.json({ status: 'fulfilled', creditBalance: profile.credit_balance }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error('Credit checkout status failed:', error)
    return Response.json({ error: 'Unable to confirm checkout' }, { status: 503 })
  }
}
