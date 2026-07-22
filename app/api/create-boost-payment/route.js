import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const VALID_PRICES = { 1: 15, 3: 35, 7: 70 } // days → AED price

export async function POST(request) {
  try {
    const { designId, creatorId, days, price } = await request.json()

    if (!designId || !creatorId || !days) {
      return Response.json({ error: 'Missing fields' }, { status: 400 })
    }

    const expectedPrice = VALID_PRICES[days]
    if (!expectedPrice || price !== expectedPrice) {
      return Response.json({ error: 'Invalid boost option' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Verify the design belongs to this creator
    const { data: design } = await supabase
      .from('designs')
      .select('id, title, created_by')
      .eq('id', designId)
      .eq('created_by', creatorId)
      .single()

    if (!design) return Response.json({ error: 'Design not found' }, { status: 404 })

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'aed',
            product_data: {
              name: `Boost "${design.title}"`,
              description: `Promoted placement in the Laque feed for ${days} day${days > 1 ? 's' : ''}`,
            },
            unit_amount: expectedPrice * 100, // AED to fils
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'boost',
        designId,
        creatorId,
        days: String(days),
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://laque.app'}/design/${designId}?boosted=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://laque.app'}/design/${designId}`,
    })

    return Response.json({ url: session.url })
  } catch (err) {
    console.error('Create boost payment error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
