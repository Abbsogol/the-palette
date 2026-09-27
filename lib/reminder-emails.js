// The database outbox owns retries; the provider key covers a successful send
// followed by a lost acknowledgment. No live emails are sent by the test suite.
export async function deliverReminderEmails(supabase, resend) {
  const { data: jobs, error } = await supabase.rpc('claim_reminder_emails', { p_limit: 50 })
  if (error) throw error
  let emailsSent = 0, emailsFailed = 0
  for (const job of jobs) {
    const finish = async status => {
      const { data, error } = await supabase.rpc('finish_reminder_email', { p_id: job.id, p_token: job.claim_token, p_status: status })
      if (error || !data) throw new Error('Email acknowledgment was not saved')
    }
    try {
      let payload = job.payload
      if (!payload) {
        const [{ data: authData, error: authError }, { data: profile, error: profileError }] = await Promise.all([
          supabase.auth.admin.getUserById(job.user_id),
          supabase.from('profiles_data').select('display_name').eq('id', job.other_user_id).single(),
        ])
        if (authError || profileError) throw new Error('Recipient lookup unavailable')
        if (!authData?.user?.email) { await finish('skipped'); continue }
        const name = profile?.display_name || 'your appointment partner'
        const service = job.service_name || 'your appointment'
        const when = `${job.booking_date} at ${job.start_time.slice(0, 5)} (${job.time_zone || 'time zone needs confirmation'})`
        payload = {
          from: 'Laque <reminders@laque.app>', to: authData.user.email,
          subject: job.recipient_role === 'client' ? `Reminder: ${service} with ${name}` : `Reminder: appointment with ${name}`,
          text: `Your appointment with ${name} is on ${when}.\n\n— Laque`,
        }
      }
      // Freeze the exact request before sending. Profile/email changes during
      // a retry must not reuse a provider idempotency key with a different body.
      const { data: prepared, error: prepareError } = await supabase.rpc('prepare_reminder_email', {
        p_id: job.id, p_token: job.claim_token, p_payload: payload,
      })
      if (prepareError) throw new Error('Email claim unavailable')
      if (!prepared) {
        const { data: current, error: currentError } = await supabase.from('reminder_emails')
          .select('status').eq('id', job.id).single()
        if (currentError || current?.status !== 'skipped') throw new Error('Email claim unavailable')
        continue
      }
      const { error: sendError } = await resend.emails.send(prepared, { idempotencyKey: `appointment-reminder/${job.id}` })
      if (sendError) throw new Error('Email provider rejected the request')
      await finish('sent')
      emailsSent++
    } catch {
      emailsFailed++
      // If this write fails, the lease expires. Another worker then reuses the
      // same payload and key. Over-age ambiguity goes to needs_review in SQL.
      try { await finish('pending') } catch { /* durable lease remains */ }
    }
  }
  return { emailsSent, emailsFailed, emailDeliveryConfigured: true }
}
