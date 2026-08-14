import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

const ALLOWED_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB

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

  // formData allows the same key to be a plain text field instead of a real
  // file, and client-declared MIME type/size can't be trusted as-is.
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return Response.json({ error: 'Unsupported file type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: 'File is too large (max 10MB)' }, { status: 400 })
  }

  // Strip everything but alphanumerics — the raw title previously passed
  // through slashes/dots unsanitized into the storage path, letting a
  // crafted title write into other prefixes of the shared designs bucket.
  const safeTitle = String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'design'
  const fileName = `${user.id}-${Date.now()}-${safeTitle}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('designs')
    .upload(fileName, buffer, { cacheControl: '3600', upsert: false, contentType: file.type })

  if (uploadError) {
    return Response.json({ error: 'Failed to upload image' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(fileName)

  return Response.json({ ok: true, publicUrl })
}
