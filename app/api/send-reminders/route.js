import { serviceClient as supabase } from '@/lib/auth'

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

  // Atomically claim all confirmed, not-yet-reminded bookings for tomorrow —
  // if this cron fires twice (manual retrigger, Vercel retry), the second
  // run finds reminder_sent_at already set and claims zero rows, instead of
  // sending every affected user a duplicate reminder.
  const { data: bookings, error } = await supabase
    .from('bookings')
    .update({ reminder_sent_at: new Date().toISOString() })
    .eq('booking_date', tomorrowStr)
    .eq('status', 'confirmed')
    .is('reminder_sent_at', null)
    .select('id, client_id, creator_id, booking_date, start_time, services(name)')

  if (error) {
    console.error('send-reminders error:', error)
    return new Response(JSON.stringify({ error: 'Failed to load bookings' }), { status: 500 })
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
    // Give the claim back so tomorrow's retry (or a manual retrigger) can
    // still actually send these reminders instead of treating them as done.
    await supabase.from('bookings').update({ reminder_sent_at: null }).in('id', bookings.map(b => b.id))
    return new Response(JSON.stringify({ error: 'Failed to send reminders' }), { status: 500 })
  }

  return new Response(JSON.stringify({ sent: notifications.length, bookings: bookings.length }), { status: 200 })
}
