import sharp from 'sharp'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

export const runtime = 'nodejs' // sharp requires the Node runtime, not Edge

const ALLOWED_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB — input cap, pre-resize
const MAX_DIMENSION = 1600 // longest edge, post-resize — no stored photo needs to be bigger than this for a ≤480px column at up to ~3x DPR

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
  const fileName = `${user.id}-${Date.now()}-${safeTitle}.webp`
  const rawBuffer = Buffer.from(await file.arrayBuffer())

  // Resize + re-encode to WebP regardless of input format — a raw phone
  // camera photo (commonly 3000x4000px, several MB) was previously stored
  // and served byte-for-byte unmodified for every 130-180px thumbnail
  // across the app. Single output format (no dual-storage/negotiation
  // needed — WebP has had universal support, including Safari, for years).
  let buffer
  try {
    buffer = await sharp(rawBuffer)
      .resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer()
  } catch (err) {
    console.error('Image processing error:', err)
    return Response.json({ error: 'Failed to process image' }, { status: 400 })
  }

  const { error: uploadError } = await supabase.storage
    .from('designs')
    .upload(fileName, buffer, { cacheControl: '3600', upsert: false, contentType: 'image/webp' })

  if (uploadError) {
    return Response.json({ error: 'Failed to upload image' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(fileName)

  return Response.json({ ok: true, publicUrl })
}
