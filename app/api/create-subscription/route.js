import Stripe from 'stripe'
import { serviceClient as supabase } from '@/lib/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const PLANS = {
  pro_creator: {
    priceId: 'price_1TnxOG14PyqGjXgeKYmTKhQf',
    name: 'Laque Pro Creator',
  },
  premium: {
    priceId: 'price_1TnxOq14PyqGjXgedydlYqto',
    name: 'Laque Premium',
  },
}

export async function POST(request) {
  try {
    const { planId, userId } = await request.json()

    if (!planId || !userId) {
      return Response.json({ error: 'Missing planId or userId' }, { status: 400 })
    }

    const plan = PLANS[planId]
    if (!plan) {
      return Response.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Verify user exists + get email
    const { data: { user } } = await supabase.auth.admin.getUserById(userId)
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laque.app'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: user.email,
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      success_url: `${baseUrl}/upgrade/success?plan=${planId}`,
      cancel_url: `${baseUrl}/upgrade`,
      metadata: {
        userId,
        planId,
      },
      subscription_data: {
        metadata: {
          userId,
          planId,
        },
      },
    })

    return Response.json({ url: session.url })

  } catch (err) {
    console.error('create-subscription error:', err)
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
