import { Resend } from 'resend'
import { serviceClient as supabase } from '@/lib/auth'
import { deliverReminderEmails } from '@/lib/reminder-emails'

export async function GET(request) {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return Response.json({ error: 'Reminder scheduler is not configured' }, { status: 503 })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) return new Response('Unauthorized', { status: 401 })
  try {
    const tomorrow = new Date()
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1)
    const { data: bookings, error } = await supabase.rpc('enqueue_booking_reminders', {
      p_date: tomorrow.toISOString().slice(0, 10),
    })
    if (error) throw error
    const delivery = process.env.RESEND_API_KEY
      ? await deliverReminderEmails(supabase, new Resend(process.env.RESEND_API_KEY))
      : { emailsSent: 0, emailsFailed: 0, emailDeliveryConfigured: false }
    return Response.json({ sent: bookings * 2, bookings, ...delivery }, { status: delivery.emailsFailed ? 503 : 200 })
  } catch (error) {
    console.error('send-reminders error:', error)
    return Response.json({ error: 'Reminder processing failed; retry is safe.' }, { status: 503 })
  }
}
