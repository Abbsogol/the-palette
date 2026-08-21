import { getSessionUser, serviceClient as supabase } from '@/lib/auth'
import { transformDesignImage, toUploadBody } from '@/lib/imageTransform'

export const runtime = 'nodejs' // sharp requires the Node runtime, not Edge

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
        console.error('publish-nail-lab-generation update error:', updateError)
        return Response.json({ error: 'Failed to update design' }, { status: 500 })
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

    // A retried/double-fired publish call for a generation that's already
    // been published shouldn't re-upload and create a second feed entry —
    // just flip the existing one's publish state instead.
    const { data: alreadyPublished } = await supabase
      .from('designs')
      .select('id')
      .eq('source_generation_id', generationId)
      .maybeSingle()

    if (alreadyPublished) {
      const { error: updateError } = await supabase
        .from('designs')
        .update({ is_published: !asDraft })
        .eq('id', alreadyPublished.id)

      if (updateError) {
        console.error('publish-nail-lab-generation update error:', updateError)
        return Response.json({ error: 'Failed to update design' }, { status: 500 })
      }

      return Response.json({ designId: alreadyPublished.id, isPublished: !asDraft })
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

    // Through the shared pipeline — the raw AI PNG is ~2.5MB; publishing it
    // byte-for-byte was the systemic source of the oversized library.
    const destPath = `published/${user.id}/${Date.now()}.webp`
    const buffer = await transformDesignImage(Buffer.from(await fileData.arrayBuffer()))

    const { error: uploadError } = await supabase.storage
      .from('designs')
      .upload(destPath, toUploadBody(buffer), { cacheControl: '3600', contentType: 'image/webp', upsert: false })

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
        source_generation_id: generationId,
      })
      .select('id')
      .single()

    if (insertError?.code === '23505') {
      // Lost a genuine concurrent race against another request publishing the
      // same generation — reuse the row that won instead of erroring out.
      const { data: winner } = await supabase
        .from('designs')
        .select('id')
        .eq('source_generation_id', generationId)
        .single()
      if (winner) return Response.json({ publicUrl, designId: winner.id, isPublished: !asDraft })
    }

    if (insertError || !design) {
      console.error('designs insert error:', insertError)
      return Response.json({ error: 'Failed to save design' }, { status: 500 })
    }

    return Response.json({ publicUrl, designId: design.id, isPublished: !asDraft })
  } catch (err) {
    console.error('publish-nail-lab-generation error:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
