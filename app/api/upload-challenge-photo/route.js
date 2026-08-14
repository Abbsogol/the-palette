import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

const ALLOWED_TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' }
const MAX_SIZE_BYTES = 10 * 1024 * 1024 // 10MB
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData().catch(() => null)
  if (!formData) {
    return Response.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const file = formData.get('file')
  const challengeId = formData.get('challengeId')

  if (!file || typeof file === 'string' || typeof file.arrayBuffer !== 'function') {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }
  // Validated as a real UUID before ever touching the storage path — it was
  // previously interpolated as-is, so a crafted value could write outside
  // the intended challenges/<id>/ prefix of the shared designs bucket.
  if (typeof challengeId !== 'string' || !UUID_RE.test(challengeId)) {
    return Response.json({ error: 'Invalid challengeId' }, { status: 400 })
  }
  const ext = ALLOWED_TYPES[file.type]
  if (!ext) {
    return Response.json({ error: 'Unsupported file type' }, { status: 400 })
  }
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: 'File is too large (max 10MB)' }, { status: 400 })
  }

  // Confirm the challenge actually exists and hasn't already ended.
  const { data: challenge } = await supabase
    .from('challenges')
    .select('id, ends_at')
    .eq('id', challengeId)
    .maybeSingle()
  if (!challenge) {
    return Response.json({ error: 'Challenge not found' }, { status: 404 })
  }
  if (challenge.ends_at && new Date(challenge.ends_at) < new Date()) {
    return Response.json({ error: 'This challenge has ended' }, { status: 403 })
  }

  const path = `challenges/${challengeId}/${user.id}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('designs')
    .upload(path, buffer, { upsert: false, contentType: file.type })

  if (uploadError) {
    return Response.json({ error: 'Failed to upload image' }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(path)

  return Response.json({ ok: true, publicUrl })
}
