import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

const ALLOWED_FIELDS = ['is_private', 'message_permission', 'show_saves']
const VALID_MESSAGE_PERMISSIONS = ['everyone', 'followers', 'none']

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object' || Array.isArray(body)) return Response.json({ error: 'Invalid settings' }, { status: 400 })
  for (const field of ['is_private', 'show_saves']) {
    if (field in body && typeof body[field] !== 'boolean') return Response.json({ error: `Invalid ${field}` }, { status: 400 })
  }
  const update = {}
  for (const field of ALLOWED_FIELDS) {
    if (field in body) update[field] = body[field]
  }

  if (Object.keys(update).length === 0) {
    return Response.json({ error: 'No valid fields provided' }, { status: 400 })
  }
  if ('message_permission' in update && !VALID_MESSAGE_PERMISSIONS.includes(update.message_permission)) {
    return Response.json({ error: 'Invalid message_permission' }, { status: 400 })
  }

  const { data, error } = await supabase.from('profiles_data').update(update).eq('id', user.id).select('is_private,message_permission,show_saves').maybeSingle()

  if (error) {
    console.error('update-privacy-settings error:', error)
    return Response.json({ error: 'Failed to update settings' }, { status: 500 })
  }

  if (!data || Object.entries(update).some(([key, value]) => data[key] !== value)) return Response.json({ error: 'Your privacy setting could not be confirmed. Refresh and retry.' }, { status: 503 })
  return Response.json({ ok: true, settings: data }, { headers: { 'Cache-Control': 'no-store' } })
}
