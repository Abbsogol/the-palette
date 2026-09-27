import { randomUUID } from 'node:crypto'
import { ownedNailLabPath } from '@/lib/storage-path'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

export async function POST(request) {
  try {
    const user = await getSessionUser(request)
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
    const body = await request.json().catch(() => null)
    if (!body || typeof body.generationId !== 'string' || !body.generationId ||
        (body.asDraft !== undefined && typeof body.asDraft !== 'boolean')) {
      return Response.json({ error: 'Invalid generation request' }, { status: 400 })
    }
    const { generationId, designId, asDraft = false } = body
    const { data: generation, error: genError } = await supabase.from('nail_lab_generations')
      .select('id, user_id, image_url, vibe, shape, length').eq('id', generationId).single()
    if (genError || !generation || generation.user_id !== user.id) {
      return Response.json({ error: 'Generation not found' }, { status: 404 })
    }
    let query = supabase.from('designs').select('id, created_by, source_generation_id, is_published, image_url')
    query = designId ? query.eq('id', designId) : query.eq('created_by', user.id).eq('source_generation_id', generationId)
    const { data: existing, error: readError } = await query.maybeSingle()
    if (readError) return Response.json({ error: 'Failed to load design' }, { status: 500 })
    if (designId && (!existing || existing.created_by !== user.id || existing.source_generation_id !== generationId)) {
      return Response.json({ error: 'Design not found' }, { status: 404 })
    }
    // A board save never changes an existing design's publication state.
    if (existing && (asDraft || existing.is_published)) {
      return Response.json({ designId: existing.id, isPublished: existing.is_published })
    }
    const sourcePath = ownedNailLabPath(generation.image_url, user.id)
    if (!sourcePath) return Response.json({ error: 'Invalid generation image' }, { status: 400 })

    // Drafts retain an owner-only reference. Only explicit publication copies
    // the image into a public bucket; hiding a DB row alone cannot hide a file.
    let imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/nail-lab/${sourcePath}`
    let copiedPath
    if (!asDraft) {
      const { data: fileData, error } = await supabase.storage.from('nail-lab').download(sourcePath)
      if (error || !fileData) return Response.json({ error: 'Failed to load generated image' }, { status: 500 })
      copiedPath = `published/${user.id}/${randomUUID()}.png`
      const buffer = new Uint8Array(await fileData.arrayBuffer())
      const { error: uploadError } = await supabase.storage.from('designs').upload(copiedPath, buffer, { contentType: 'image/png', upsert: false })
      if (uploadError) return Response.json({ error: 'Failed to publish image' }, { status: 500 })
      imageUrl = supabase.storage.from('designs').getPublicUrl(copiedPath).data.publicUrl
    }
    if (existing) {
      const { error } = await supabase.from('designs').update({ is_published: true, image_url: imageUrl }).eq('id', existing.id).eq('created_by', user.id)
      if (error) return Response.json({ error: 'Failed to publish design' }, { status: 500 })
      return Response.json({ designId: existing.id, publicUrl: imageUrl, isPublished: true })
    }
    const vibes = Array.isArray(generation.vibe) ? generation.vibe : [generation.vibe].filter(Boolean)
    const { data: design, error } = await supabase.from('designs').insert({
      title: vibes.join(' + '), image_url: imageUrl, shape: generation.shape, length: generation.length,
      is_published: !asDraft, is_curated: false, created_by: user.id, source_generation_id: generationId,
    }).select('id').single()
    if (error?.code === '23505') {
      const { data: winner } = await supabase.from('designs').select('id, is_published, image_url')
        .eq('created_by', user.id).eq('source_generation_id', generationId).single()
      if (winner) {
        if (!asDraft && !winner.is_published) {
          const { error: promoteError } = await supabase.from('designs').update({ is_published: true, image_url: imageUrl })
            .eq('id', winner.id).eq('created_by', user.id)
          if (promoteError) return Response.json({ error: 'Failed to publish design' }, { status: 500 })
          return Response.json({ designId: winner.id, publicUrl: imageUrl, isPublished: true })
        }
        if (copiedPath) await supabase.storage.from('designs').remove([copiedPath])
        return Response.json({ designId: winner.id, publicUrl: winner.image_url, isPublished: winner.is_published })
      }
    }
    if (error || !design) return Response.json({ error: 'Failed to save design' }, { status: 500 })
    return Response.json({ designId: design.id, publicUrl: imageUrl, isPublished: !asDraft })
  } catch (error) {
    console.error('publish-nail-lab-generation error:', error)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
