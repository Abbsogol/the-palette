import { Resend } from 'resend'
import { serviceClient as supabase } from '@/lib/auth'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const REMINDER_FROM = 'Laque <reminders@laque.app>'

const fmt12 = (t) => {
  if (!t) return ''
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m > 0 ? `:${String(m).padStart(2, '0')}` : ''}${ampm}`
}

const fmtDate = (dateStr) => {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
}

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

  // Email reminders — best-effort, on top of the in-app notifications above.
  // A client/creator who isn't currently in the app gets no signal at all
  // from the notification rows alone. Gated on RESEND_API_KEY being
  // configured; if it isn't, this whole block is skipped and the in-app
  // notifications (already sent above) are unaffected.
  let emailsSent = 0
  let emailsFailed = 0

  if (resend) {
    const userIds = [...new Set(bookings.flatMap(b => [b.client_id, b.creator_id]))]

    const [{ data: profiles }, ...authResults] = await Promise.all([
      supabase.from('profiles_data').select('id, display_name').in('id', userIds),
      ...userIds.map(id => supabase.auth.admin.getUserById(id)),
    ])
    const nameById = Object.fromEntries((profiles || []).map(p => [p.id, p.display_name || 'there']))
    const emailById = Object.fromEntries(
      authResults.map((r, i) => [userIds[i], r.data?.user?.email || null])
    )

    for (const b of bookings) {
      const when = `${fmtDate(b.booking_date)} at ${fmt12(b.start_time)}`
      const serviceName = b.services?.name || 'your appointment'

      const recipients = [
        { userId: b.client_id, otherName: nameById[b.creator_id], role: 'client' },
        { userId: b.creator_id, otherName: nameById[b.client_id], role: 'creator' },
      ]

      for (const r of recipients) {
        const email = emailById[r.userId]
        if (!email) continue // no auth email on file — skip, in-app notification still covers them

        const subject = r.role === 'client'
          ? `Reminder: ${serviceName} with ${r.otherName} tomorrow`
          : `Reminder: appointment with ${r.otherName} tomorrow`
        const body = r.role === 'client'
          ? `Your appointment for ${serviceName} with ${r.otherName} is tomorrow, ${when}.`
          : `You have an appointment with ${r.otherName} tomorrow, ${when}.`

        try {
          const { error: sendError } = await resend.emails.send({
            from: REMINDER_FROM,
            to: email,
            subject,
            text: `${body}\n\n— Laque`,
          })
          if (sendError) {
            console.error('send-reminders email error:', sendError)
            emailsFailed++
          } else {
            emailsSent++
          }
        } catch (err) {
          console.error('send-reminders email exception:', err)
          emailsFailed++
        }
      }
    }
  }

  return new Response(JSON.stringify({
    sent: notifications.length,
    bookings: bookings.length,
    emailsSent,
    emailsFailed,
  }), { status: 200 })
}
