import { getSessionUser, serviceClient } from '@/lib/auth'

export async function POST(request) {
  const user = await getSessionUser(request, { allowDeleting: true, allowSuspended: true })
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  // Commit closure and refund obligations first. A provider outage must never
  // reopen the account or turn a confirmed closure into a misleading failure.
  const { error } = await serviceClient.rpc('close_account', { p_user_id: user.id })
  if (error) return Response.json({ error: 'Account closure could not be confirmed. Please retry or contact contact@laque.app.' }, { status: 503 })
  // Best-effort immediate refresh-token lockout; the durable worker retries.
  try { await serviceClient.auth.admin.updateUserById(user.id, { ban_duration: '876000h' }) } catch { /* closure already committed */ }
  return Response.json({ ok: true, closed: true, cleanup: 'pending', restorable: false }, { status: 202 })
}
