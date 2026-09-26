import Stripe from 'stripe'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

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

    // Buckets rapid double-clicks/retries into the same Stripe session instead
    // of creating a second real Checkout Session for one intended subscribe.
    const idempotencyKey = `subscription-${userId}-${planId}-${Math.floor(Date.now() / 300000)}`

    const session = await stripe.checkout.sessions.create({
      integration_identifier: 'laque_checkout_qmrtxvpa',
      mode: 'subscription',
      ...(profile.stripe_customer_id ? { customer: profile.stripe_customer_id } : { customer_email: user.email }),
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
    }, { idempotencyKey })

    return Response.json({ url: session.url })

  } catch (err) {
    console.error('create-subscription error:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
