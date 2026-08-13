import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

const ALLOWED_FIELDS = ['is_private', 'message_permission', 'show_saves']
const VALID_MESSAGE_PERMISSIONS = ['everyone', 'followers', 'none']

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
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

  const { error } = await supabase.from('profiles_data').update(update).eq('id', user.id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true })
}
