import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

const ALLOWED_FIELDS = new Set([
  'display_name', 'username', 'avatar_url', 'phone_number', 'location', 'bio',
  'preferred_contact', 'booking_area', 'booking_notes',
  'nail_shape', 'nail_length', 'nail_colors', 'nail_finishes', 'nail_techniques',
  'occasions', 'budget_range', 'allergies', 'product_sensitivities',
  'removal_needed', 'nail_condition', 'skin_undertone', 'hand_photo_url',
])

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const fields = {}
  for (const key of Object.keys(body || {})) {
    if (ALLOWED_FIELDS.has(key)) fields[key] = body[key]
  }

  if (Object.keys(fields).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabase.from('profiles_data').update(fields).eq('id', user.id)
  if (error) {
    return Response.json({ error: error.message, code: error.code }, { status: 500 })
  }

  return Response.json({ ok: true })
}
