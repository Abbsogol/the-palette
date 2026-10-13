import { randomUUID } from 'node:crypto'
import { getSessionUser, serviceClient } from '@/lib/auth'
import { mobileJson } from '@/lib/mobile-auth'
import { validatedImageMeta } from '@/lib/validated-image'
import { POST as uploadMemberImage } from '@/app/api/mobile/upload/route'

export const runtime = 'nodejs'

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) return mobileJson({ error: 'Unauthorized' }, 401)
  const form = await request.formData().catch(() => null)
  if (!form) return mobileJson({ error: 'Invalid form data' }, 400)
  const purpose = form.get('purpose')
  if (purpose === 'admin-design' || purpose === 'admin-product')
    return mobileJson({ error: 'Use the protected Admin Studio content tools.' }, 410)
  if (purpose === 'avatar' || purpose === 'chat-photo') {
    form.set('kind', purpose === 'avatar' ? 'profile-avatar' : 'message')
    const response = await uploadMemberImage(new Request(request.url, {
      method: 'POST', headers: { authorization: request.headers.get('authorization') || '' }, body: form,
    }))
    const result = await response.json()
    return mobileJson(response.ok ? { ...result, publicUrl: result.privateUrl } : result, response.status)
  }
  if (purpose !== 'hand-photo') return mobileJson({ error: 'Unknown purpose' }, 400)
  let image
  try { image = await validatedImageMeta(form.get('file'), { maxDimension: 1024 }) }
  catch (error) { return mobileJson({ error: error.message }, 400) }
  const bucket = 'mobile-uploads', path = `${user.id}/hand-photos/${randomUUID()}.webp`
  const queued = await serviceClient.from('mobile_media_cleanup').insert({ bucket, path, user_id: user.id })
  if (queued.error) return mobileJson({ error: 'Upload could not be prepared' }, 503)
  const uploaded = await serviceClient.storage.from(bucket).upload(path, image.bytes, { contentType: 'image/webp', upsert: false })
  if (uploaded.error) return mobileJson({ error: 'Image upload failed. Please retry.' }, 503)
  // Stable reference to a PRIVATE bucket. It is not a fetchable public URL.
  return mobileJson({ publicUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`, width: image.width, height: image.height })
}
