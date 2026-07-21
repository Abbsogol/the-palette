import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
  // Vercel auto-sets CRON_SECRET and passes it — reject anything else
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  // Tomorrow's date in YYYY-MM-DD
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  const tomorrowStr = tomorrow.toISOString().split('T')[0]

  // Fetch all confirmed bookings for tomorrow
  const { data: bookings, error } = await supabase
    .from('bookings')
    .select('id, client_id, creator_id, booking_date, start_time, services(name)')
    .eq('booking_date', tomorrowStr)
    .eq('status', 'confirmed')

  if (error) {
    console.error('send-reminders error:', error)
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  if (!bookings?.length) {
    return new Response(JSON.stringify({ sent: 0 }), { status: 200 })
  }

  // Build notification rows — one for client, one for creator per booking
  const notifications = []
  for (const b of bookings) {
    // Notify client
    notifications.push({
      user_id: b.client_id,
      actor_id: b.creator_id,
      type: 'appointment_reminder',
    })
    // Notify creator
    notifications.push({
      user_id: b.creator_id,
      actor_id: b.client_id,
      type: 'appointment_reminder',
    })
  }

  const { error: insertError } = await supabase.from('notifications').insert(notifications)

  if (insertError) {
    console.error('send-reminders insert error:', insertError)
    return new Response(JSON.stringify({ error: insertError.message }), { status: 500 })
  }

  return new Response(JSON.stringify({ sent: notifications.length, bookings: bookings.length }), { status: 200 })
}
