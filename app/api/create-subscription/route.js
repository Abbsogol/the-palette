import Stripe from 'stripe'
import { getSessionUser } from '@/lib/auth'

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
    const plan = PLANS[planId]

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
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
