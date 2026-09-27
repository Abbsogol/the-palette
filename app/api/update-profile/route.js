import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

// Profile fields that live on profiles_data.
const ALLOWED_FIELDS = new Set([
  'display_name', 'username', 'avatar_url', 'phone_number', 'location', 'bio',
  'preferred_contact', 'booking_area',
  'nail_shape', 'nail_length', 'nail_colors', 'nail_finishes', 'nail_techniques',
  'occasions', 'budget_range', 'nail_condition', 'skin_undertone', 'hand_photo_url',
])
// Health notes + the client's sharing choice live in client_health_notes (its own
// RLS table). booking_notes lives in client_booking_notes. Neither is on the
// public profiles table any more, so they can't leak through the profile read.
const HEALTH_FIELDS = new Set(['allergies', 'product_sensitivities', 'removal_needed', 'share_with_tech'])

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const fields = {}
  const health = {}
  let hasBookingNotes = false, bookingNotes = null
  for (const key of Object.keys(body || {})) {
    if (ALLOWED_FIELDS.has(key)) fields[key] = body[key]
    else if (HEALTH_FIELDS.has(key)) health[key] = body[key]
    else if (key === 'booking_notes') { hasBookingNotes = true; bookingNotes = body[key] }
  }

  if (Object.keys(fields).length === 0 && Object.keys(health).length === 0 && !hasBookingNotes) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (Object.keys(fields).length > 0) {
    const { error } = await supabase.from('profiles_data').update(fields).eq('id', user.id)
    if (error) {
      console.error('update-profile error:', error.code)
      const message = error.code === '23505' ? 'That username is already taken' : 'Failed to update profile'
      return Response.json({ error: message }, { status: error.code === '23505' ? 409 : 500 })
    }
  }

  if (Object.keys(health).length > 0) {
    const { error } = await supabase.from('client_health_notes')
      .upsert({ user_id: user.id, ...health, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) { console.error('client_health_notes upsert failed:', error.code); return Response.json({ error: 'Failed to save health notes' }, { status: 500 }) }
  }

  if (hasBookingNotes) {
    const { error } = await supabase.from('client_booking_notes')
      .upsert({ user_id: user.id, booking_notes: bookingNotes, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) { console.error('client_booking_notes upsert failed:', error.code); return Response.json({ error: 'Failed to save notes' }, { status: 500 }) }
  }

  return Response.json({ ok: true })
}
