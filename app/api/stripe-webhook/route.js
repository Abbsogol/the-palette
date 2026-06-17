import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event

  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object

    const userId = session.metadata?.userId
    const credits = parseInt(session.metadata?.credits || '0', 10)

    if (!userId || !credits) {
      console.error('Missing metadata in webhook:', session.metadata)
      return Response.json({ error: 'Missing metadata' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Atomically add credits
    const { error } = await supabase.rpc('increment_credits', {
      user_id: userId,
      amount: credits,
    })

    if (error) {
      console.error('Failed to add credits:', error)
      return Response.json({ error: 'Failed to add credits' }, { status: 500 })
    }

    console.log(`Added ${credits} credits to user ${userId}`)
  }

  return Response.json({ received: true })
}
