import { getSessionUser, serviceClient as supabase } from '@/lib/auth'
import { transformDesignImage, toUploadBody, sniffImageFormat } from '@/lib/imageTransform'

export const runtime = 'nodejs' // sharp requires the Node runtime, not Edge

// One authenticated door for every image write that used to hit the designs
// bucket directly from the client (raw, untransformed). Each purpose pins
// its own longest-edge target and storage prefix; everything goes through
// the shared pipeline in lib/imageTransform.js.
const MAX_SIZE_BYTES = 10 * 1024 * 1024

const PURPOSES = {
  // Avatars render at <=124px (x3 DPR ≈ 372) — 512 keeps headroom.
  avatar:        { maxDimension: 512, adminOnly: false, path: (u) => `avatars/${u.id}/${Date.now()}.webp` },
  // Hand photos are a stored reference photo (profile field), viewed at
  // phone width — 1024 preserves usable detail at a fraction of the bytes.
  'hand-photo':  { maxDimension: 1024, adminOnly: false, path: (u) => `hand-photos/${u.id}/${Date.now()}.webp` },
  'admin-design': { maxDimension: 1600, adminOnly: true, path: (_u, slug) => `${Date.now()}-${slug}.webp` },
  'admin-product': { maxDimension: 1600, adminOnly: true, path: () => `product-${Date.now()}.webp` },
}

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData().catch(() => null)
  if (!formData) return Response.json({ error: 'Invalid form data' }, { status: 400 })

  const purpose = PURPOSES[formData.get('purpose')]
  if (!purpose) return Response.json({ error: 'Unknown purpose' }, { status: 400 })

  if (purpose.adminOnly) {
    const { data: profile } = await supabase.from('profiles_data').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return Response.json({ error: 'Forbidden' }, { status: 403 })
  }

  const file = formData.get('file')
  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) return Response.json({ error: 'File is too large (max 10MB)' }, { status: 400 })

  const slug = String(formData.get('slug') || 'image').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image'

  // Format decided by magic bytes, not the client-declared MIME — sharp
  // accepts more formats (SVG, TIFF, ...) than we ever want to ingest.
  const rawBuffer = Buffer.from(await file.arrayBuffer())
  if (!sniffImageFormat(rawBuffer)) return Response.json({ error: 'Unsupported file type' }, { status: 400 })

  let webpBuffer
  try {
    webpBuffer = await transformDesignImage(rawBuffer, { maxDimension: purpose.maxDimension })
  } catch (err) {
    console.error('Image processing error:', err)
    return Response.json({ error: 'Failed to process image' }, { status: 400 })
  }

  const path = purpose.path(user, slug)
  const { error: uploadError } = await supabase.storage
    .from('designs')
    .upload(path, toUploadBody(webpBuffer), { cacheControl: '3600', upsert: false, contentType: 'image/webp' })
  if (uploadError) return Response.json({ error: 'Failed to upload image' }, { status: 500 })

  const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(path)
  return Response.json({ ok: true, publicUrl })
}
