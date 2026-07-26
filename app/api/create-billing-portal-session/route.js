import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  try {
    const user = await getSessionUser(request)
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single()

    if (!profile?.stripe_customer_id) {
      return Response.json({ error: 'No active subscription found' }, { status: 404 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laque.app'

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${baseUrl}/profile`,
    })

    return Response.json({ url: portalSession.url })

  } catch (err) {
    console.error('create-billing-portal-session error:', err)
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
