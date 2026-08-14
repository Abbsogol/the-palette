import Stripe from 'stripe'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const PACKS = {
  starter: { credits: 5,  amount: 399,  name: 'Starter Pack — 5 Credits' },
  popular: { credits: 15, amount: 999,  name: 'Popular Pack — 15 Credits' },
  pro:     { credits: 40, amount: 2299, name: 'Pro Pack — 40 Credits' },
}

export async function POST(request) {
  try {
    const user = await getSessionUser(request)
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    const { packId } = await request.json()

    if (!packId) {
      return Response.json({ error: 'Missing packId' }, { status: 400 })
    }

    // Object.hasOwn (not just truthiness) — a packId of "constructor" or
    // "__proto__" would otherwise resolve to an inherited Object.prototype
    // value and pass a plain `!pack` check.
    if (typeof packId !== 'string' || !Object.hasOwn(PACKS, packId)) {
      return Response.json({ error: 'Invalid pack' }, { status: 400 })
    }
    const pack = PACKS[packId]

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laque.app'

    // Buckets rapid double-clicks/retries into the same Stripe session instead
    // of creating a second real Checkout Session for one intended purchase.
    const idempotencyKey = `checkout-${userId}-${packId}-${Math.floor(Date.now() / 300000)}`

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: pack.name,
              description: `${pack.credits} Nail Lab AI design credits. Credits never expire.`,
            },
            unit_amount: pack.amount,
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${baseUrl}/buy-credits/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/buy-credits`,
      metadata: {
        userId,
        packId,
        credits: pack.credits.toString(),
      },
    }, { idempotencyKey })

    return Response.json({ url: session.url })

  } catch (err) {
    console.error('create-checkout-session error:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
