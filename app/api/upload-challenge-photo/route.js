import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const formData = await request.formData()
  const file = formData.get('file')
  const challengeId = formData.get('challengeId')

  if (!file || !challengeId) {
    return Response.json({ error: 'Missing file or challengeId' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()
  const path = `challenges/${challengeId}/${user.id}-${Date.now()}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('designs')
    .upload(path, buffer, { upsert: false, contentType: file.type })

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(path)

  return Response.json({ ok: true, publicUrl })
}
