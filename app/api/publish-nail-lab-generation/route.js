import { createClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/auth'

// nail-lab is a private bucket; publishing a generation to the public feed
// requires copying the file into the public designs bucket first.
export async function POST(request) {
  try {
    const user = await getSessionUser(request)
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { generationId } = await request.json()
    if (!generationId) {
      return Response.json({ error: 'Missing generationId' }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    const { data: generation, error: genError } = await supabase
      .from('nail_lab_generations')
      .select('id, user_id, image_url')
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

    return Response.json({ publicUrl })
  } catch (err) {
    console.error('publish-nail-lab-generation error:', err)
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
