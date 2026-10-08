import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

const ALLOWED_FIELDS = new Set([
  'display_name', 'username', 'avatar_url', 'banner_url', 'phone_number', 'location', 'bio',
  'preferred_contact', 'booking_area', 'booking_notes', 'specialties',
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
    if (typeof fields.username !== 'string') return Response.json({error:'Choose your unique username.'},{status:400});
    fields.username = fields.username.trim().replace(/^@/,'').toLowerCase();
    if (!/^[a-z0-9_.]{3,30}$/.test(fields.username)) return Response.json({error:'Use 3–30 lowercase letters, numbers, dots or underscores.'},{status:400});
  }
  if (Object.keys(fields).length === 0) {
    return Response.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const { error } = await supabase.from('profiles_data').update(fields).eq('id', user.id)
  if (error) {
    console.error('update-profile error:', error)
    const message = error.code === '23505' ? 'That username is already taken' : 'Failed to update profile'
    return Response.json({ error: message }, { status: error.code === '23505' ? 409 : 500 })
  }

  return Response.json({ ok: true })
}
