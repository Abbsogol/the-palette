import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

// nail-lab is a private bucket; publishing a generation to the public feed
// requires copying the file into the public designs bucket first, then
// creating/updating the designs row — all server-side, since the designs
// table's owner-scoped write policies silently reject anon-client writes
// that don't carry the right auth context in some cases.
export async function POST(request) {
  try {
    const user = await getSessionUser(request)
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { generationId, designId, asDraft } = await request.json()
    if (!generationId) {
      return Response.json({ error: 'Missing generationId' }, { status: 400 })
    }

    // Already have a design for this generation — just flip its publish state.
    if (designId) {
      const { data: existing, error: fetchError } = await supabase
        .from('designs')
        .select('id, created_by')
        .eq('id', designId)
        .single()

      if (fetchError || !existing || existing.created_by !== user.id) {
        return Response.json({ error: 'Design not found' }, { status: 404 })
      }

      const { error: updateError } = await supabase
        .from('designs')
        .update({ is_published: !asDraft })
        .eq('id', designId)

      if (updateError) {
        return Response.json({ error: updateError.message }, { status: 500 })
      }

      return Response.json({ designId, isPublished: !asDraft })
    }

    const { data: generation, error: genError } = await supabase
      .from('nail_lab_generations')
      .select('id, user_id, image_url, vibe, shape, length')
      .eq('id', generationId)
      .single()

    if (genError || !generation || generation.user_id !== user.id) {
      return Response.json({ error: 'Generation not found' }, { status: 404 })
    }

    const marker = '/nail-lab/'
    const idx = generation.image_url.indexOf(marker)
    const sourcePath = idx === -1 ? generation.image_url : generation.image_url.slice(idx + marker.length)

    const { data: fileData, error: downloadError } = await supabase.storage
      .from('nail-lab')
      .download(sourcePath)

    if (downloadError || !fileData) {
      console.error('nail-lab download error:', downloadError)
      return Response.json({ error: 'Failed to load generated image' }, { status: 500 })
    }

    const destPath = `published/${user.id}/${Date.now()}.png`
    const buffer = Buffer.from(await fileData.arrayBuffer())

    const { error: uploadError } = await supabase.storage
      .from('designs')
      .upload(destPath, buffer, { contentType: 'image/png', upsert: false })

    if (uploadError) {
      console.error('designs upload error:', uploadError)
      return Response.json({ error: 'Failed to publish image' }, { status: 500 })
    }

    const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(destPath)

    const vibes = Array.isArray(generation.vibe) ? generation.vibe : [generation.vibe].filter(Boolean)
    const { data: design, error: insertError } = await supabase
      .from('designs')
      .insert({
        title: vibes.join(' + '),
        image_url: publicUrl,
        shape: generation.shape,
        length: generation.length,
        is_published: !asDraft,
        is_curated: false,
        created_by: user.id,
      })
      .select('id')
      .single()

    if (insertError || !design) {
      console.error('designs insert error:', insertError)
      return Response.json({ error: 'Failed to save design' }, { status: 500 })
    }

    return Response.json({ publicUrl, designId: design.id, isPublished: !asDraft })
  } catch (err) {
    console.error('publish-nail-lab-generation error:', err)
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
