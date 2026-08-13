import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

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

  const formData = await request.formData()
  const file = formData.get('file')
  const title = formData.get('title') || 'design'

  if (!file) {
    return Response.json({ error: 'No file provided' }, { status: 400 })
  }

  const ext = file.name.split('.').pop()
  const fileName = `${user.id}-${Date.now()}-${String(title).toLowerCase().replace(/\s+/g, '-')}.${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  const { error: uploadError } = await supabase.storage
    .from('designs')
    .upload(fileName, buffer, { cacheControl: '3600', upsert: false, contentType: file.type })

  if (uploadError) {
    return Response.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(fileName)

  return Response.json({ ok: true, publicUrl })
}
