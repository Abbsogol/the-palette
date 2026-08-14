import Stripe from 'stripe'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const VALID_PRICES = { 1: 15, 3: 35, 7: 70 } // days → AED price

export async function POST(request) {
  try {
    const user = await getSessionUser(request)
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { designId, days, price } = await request.json()

    if (!designId || !days) {
      return Response.json({ error: 'Missing fields' }, { status: 400 })
    }

    const expectedPrice = VALID_PRICES[days]
    if (!expectedPrice || price !== expectedPrice) {
      return Response.json({ error: 'Invalid boost option' }, { status: 400 })
    }

    // Verify the design belongs to the authenticated caller
    const { data: design } = await supabase
      .from('designs')
      .select('id, title, created_by')
      .eq('id', designId)
      .eq('created_by', user.id)
      .single()

    if (!design) return Response.json({ error: 'Design not found' }, { status: 404 })

    // Buckets rapid double-clicks/retries into the same Stripe session instead
    // of creating a second real Checkout Session for one intended boost.
    const idempotencyKey = `boost-${user.id}-${designId}-${days}-${Math.floor(Date.now() / 300000)}`

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
        creatorId: user.id,
        days: String(days),
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://laque.app'}/design/${designId}?boosted=1`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://laque.app'}/design/${designId}`,
    }, { idempotencyKey })

    return Response.json({ url: session.url })
  } catch (err) {
    console.error('Create boost payment error:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
