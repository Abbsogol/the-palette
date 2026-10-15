import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

// Profile fields that live on profiles_data.
const ALLOWED_FIELDS = new Set([
  'display_name', 'username', 'avatar_url', 'banner_url', 'phone_number', 'location', 'bio',
  'preferred_contact', 'booking_area', 'specialties',
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

  if ('specialties' in fields) {
    const tags = fields.specialties;
    if (!Array.isArray(tags) || tags.length > 20 || tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.trim().length > 50))
      return Response.json({error:'Choose up to 20 interests or specialties, each under 51 characters.'},{status:400});
    const seen = new Set();
    fields.specialties = tags.map(tag => tag.trim()).filter(tag => {
      const key = tag.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  for (const key of ['avatar_url', 'banner_url']) {
    if (!(key in fields)) continue;
    const value = fields[key];
    if (value === null) continue;
    if (typeof value !== 'string') return Response.json({error:'Choose a valid profile image.'},{status:400});
    const folder = key === 'avatar_url' ? 'avatars' : 'banners';
    const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/designs/${folder}/${user.id}/`;
    if (!value.startsWith(prefix) || !/^[a-zA-Z0-9_.-]+$/.test(value.slice(prefix.length)))
      return Response.json({error:'Upload your own profile image before saving.'},{status:400});
  }
  if ('username' in fields) {
    // Continue validating identity independently of private reference uploads.
    if (typeof fields.username !== 'string') return Response.json({error:'Choose your unique username.'},{status:400});
    fields.username = fields.username.trim().replace(/^@/,'').toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(fields.username)) return Response.json({error:'Use 3–30 lowercase letters, numbers, dots or underscores.'},{status:400});
  }
  if (fields.hand_photo_url != null) {
    const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/mobile-uploads/${user.id}/hand-photos/`
    if (typeof fields.hand_photo_url !== 'string' || !fields.hand_photo_url.startsWith(prefix) || !/^[a-zA-Z0-9_.-]+$/.test(fields.hand_photo_url.slice(prefix.length)))
      return Response.json({ error: 'Upload your own private hand photo before saving.' }, { status: 400 })
  }
  if (Object.keys(fields).length === 0 && Object.keys(health).length === 0 && !hasBookingNotes) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  if (Object.keys(fields).length > 0) {
    const { error } = await supabase.from('profiles_data').update(fields).eq('id', user.id)
    if (error) {
      console.error('update-profile error:')
      const message = error.code === '23505' ? 'That username is already taken' : 'Failed to update profile'
      return Response.json({ error: message }, { status: error.code === '23505' ? 409 : 500 })
    }
  }

  if (Object.keys(health).length > 0) {
    const { error } = await supabase.from('client_health_notes')
      .upsert({ user_id: user.id, ...health, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) { console.error('client_health_notes upsert failed:'); return Response.json({ error: 'Failed to save health notes' }, { status: 500 }) }
  }

  if (hasBookingNotes) {
    const { error } = await supabase.from('client_booking_notes')
      .upsert({ user_id: user.id, booking_notes: bookingNotes, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
    if (error) { console.error('client_booking_notes upsert failed:'); return Response.json({ error: 'Failed to save notes' }, { status: 500 }) }
  }

  return Response.json({ ok: true })
}
