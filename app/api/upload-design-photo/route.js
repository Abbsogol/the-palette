import { validatedImage } from '@/lib/validated-image'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

export const runtime = 'nodejs' // sharp requires the Node runtime, not Edge

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles_data')
    .select('account_type')
    .eq('id', user.id)
    .single()

  if (!profile || (profile.account_type !== 'creator' && profile.account_type !== 'salon')) {
    return Response.json({ error: 'Only creators and salons can upload designs' }, { status: 403 })
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  const title = formData.get('title') || 'design'

  // Strip everything but alphanumerics — the raw title previously passed
  // through slashes/dots unsanitized into the storage path, letting a
  // crafted title write into other prefixes of the shared designs bucket.
  const safeTitle = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'design'
  const fileName = `${user.id}-${Date.now()}-${safeTitle}.webp`
  let uploadBody
  try { uploadBody = await validatedImage(file) }
  catch (error) { return Response.json({ error: error.message }, { status: 400 }) }

  const { error: uploadError } = await supabase.storage
    .from('designs')
    .upload(fileName, uploadBody, { cacheControl: '3600', upsert: false, contentType: 'image/webp' })

  if (uploadError) {
    return Response.json({ error: 'Failed to upload image' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(fileName)

  return Response.json({ ok: true, publicUrl })
}
