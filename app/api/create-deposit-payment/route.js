import Stripe from 'stripe'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function POST(request) {
  try {
    const user = await getSessionUser(request)
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { bookingId } = await request.json()

    if (!bookingId) {
      return Response.json({ error: 'Missing bookingId' }, { status: 400 })
    }

    // Fetch the booking + service to get deposit amount
    const { data: booking, error } = await supabase
      .from('bookings')
      .select('*, service:services(name, deposit_amount)')
      .eq('id', bookingId)
      .eq('client_id', user.id)
      .single()

    if (error || !booking) {
      return Response.json({ error: 'Booking not found' }, { status: 404 })
    }

    const depositAmount = booking.service?.deposit_amount
    if (!depositAmount || depositAmount <= 0) {
      return Response.json({ error: 'No deposit required for this booking' }, { status: 400 })
    }

    if (booking.deposit_paid) {
      return Response.json({ error: 'Deposit already paid' }, { status: 400 })
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'aed',
            product_data: {
              name: `Deposit — ${booking.service?.name || 'Appointment'}`,
              description: `Booking deposit for your appointment`,
            },
            unit_amount: Math.round(depositAmount * 100), // AED to fils
          },
          quantity: 1,
        },
      ],
      metadata: {
        type: 'deposit',
        bookingId,
        userId: user.id,
      },
      success_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://laque.app'}/appointments/deposit-success?booking=${bookingId}`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://laque.app'}/appointments`,
    })

    return Response.json({ url: session.url })
  } catch (err) {
    console.error('Create deposit payment error:', err)
    return Response.json({ error: err.message }, { status: 500 })
  }
}
