import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { designId, tagNames } = await request.json()

  if (!designId) {
    return Response.json({ error: 'Missing designId' }, { status: 400 })
  }

  const { data: design } = await supabase
    .from('designs')
    .select('id, created_by')
    .eq('id', designId)
    .single()

  if (!design || design.created_by !== user.id) {
    return Response.json({ error: 'Design not found' }, { status: 404 })
  }

  for (const tagName of (tagNames || [])) {
    const { data: tag } = await supabase
      .from('tags')
      .upsert({ name: tagName }, { onConflict: 'name' })
      .select()
      .single()
    if (tag) {
      await supabase
        .from('design_tags')
        .upsert({ design_id: designId, tag_id: tag.id }, { onConflict: 'design_id,tag_id' })
    }
  }

  const { data: profile } = await supabase
    .from('profiles_data')
    .select('weekly_uploads')
    .eq('id', user.id)
    .single()

  await supabase
    .from('profiles_data')
    .update({ weekly_uploads: (profile?.weekly_uploads || 0) + 1 })
    .eq('id', user.id)

  return Response.json({ ok: true })
}
