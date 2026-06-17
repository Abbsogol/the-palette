import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const PACKS = {
  starter: { credits: 5,  amount: 399,  name: 'Starter Pack — 5 Credits' },
  popular: { credits: 15, amount: 999,  name: 'Popular Pack — 15 Credits' },
  pro:     { credits: 40, amount: 2299, name: 'Pro Pack — 40 Credits' },
}

export async function POST(request) {
  try {
    const { packId, userId } = await request.json()

    if (!packId || !userId) {
      return Response.json({ error: 'Missing packId or userId' }, { status: 400 })
    }

    const pack = PACKS[packId]
    if (!pack) {
      return Response.json({ error: 'Invalid pack' }, { status: 400 })
    }

    // Verify user exists
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .single()

    if (!profile) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://laque.app'

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
    })

    return Response.json({ url: session.url })

  } catch (err) {
    console.error('create-checkout-session error:', err)
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
