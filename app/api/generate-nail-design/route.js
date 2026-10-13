import { createHash } from 'node:crypto'
import { generationIdPattern, generationResult } from '@/lib/generation-result'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'
import { mobileUserClient } from '@/lib/mobile-auth'
import { GENERATION_SIZE } from '@/lib/nailLab'
import { buildNailLabPrompt } from '@/lib/nailPrompt'

export const maxDuration = 300 // gpt-image-1 at high quality can exceed 60s; 300 = Vercel Pro ceiling (a Hobby project caps at 60 and will fail the build at this value)

export async function POST(request) {
  let reservationId = null
  let completed = false
  try {
    const user = await getSessionUser(request)
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    const body = await request.json()
    const { freeRegen, parentGenerationId } = body || {}
    if (!generationIdPattern.test(body?.requestId || '')) {
      return Response.json({ error: 'A valid generation request id is required' }, { status: 400 })
    }

    if (!body.vibe || !body.shape || !body.length) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }
    if (typeof body.shape !== 'string' || typeof body.length !== 'string') {
      return Response.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Cap every prompt-composing field before it reaches OpenAI — these were
    // previously unbounded, letting a single request balloon the prompt (and
    // the per-request OpenAI cost) with an arbitrarily large payload, most
    // directly through customText.
    const capStr = (v, max) => (typeof v === 'string' ? v.slice(0, max) : '')
    const capArr = (v, maxItems, maxLen) => (Array.isArray(v) ? v.filter(x => typeof x === 'string').slice(0, maxItems).map(x => x.slice(0, maxLen)) : [])

    const shape = capStr(body.shape, 40)
    const length = capStr(body.length, 40)
    const vibe = Array.isArray(body.vibe) ? capArr(body.vibe, 10, 40) : capStr(body.vibe, 200)
    const colors = capArr(body.colors, 20, 40)
    const occasion = Array.isArray(body.occasion) ? capArr(body.occasion, 10, 40) : capStr(body.occasion, 100)
    const customText = capStr(body.customText, 500)

    if (body.referenceImageUrls != null && (!Array.isArray(body.referenceImageUrls) || body.referenceImageUrls.length)) {
      return Response.json({ error: 'Reference images are not supported yet. Remove them to generate from text.' }, { status: 422 })
    }
    if (freeRegen || parentGenerationId) {
      return Response.json({ error: 'Generated designs cannot be edited. Start a new generation; each new design uses one token.' }, { status: 410 })
    }
    const requestId = body.requestId
    const hash = createHash('sha256').update(JSON.stringify({ vibe, shape, length, colors, occasion, customText })).digest('hex')
    const { data: status, error: reservationError } = await supabase.rpc('claim_generation', {
      p_id: requestId, p_user_id: userId, p_parent_id: null, p_hash: hash,
    })
    if (reservationError) throw new Error('Failed to reserve generation', { cause: reservationError })
    if (status === 'completed') return Response.json(await generationResult(userId, requestId))
    if (status === 'reserved') return Response.json({ status: 'pending', error: 'Your design is still generating. Retry shortly to retrieve it.' }, { status: 202 })
    if (status === 'released') return Response.json({ status: 'released', error: 'This attempt ended. Check your balance before starting a new generation.' }, { status: 410 })
    if (status === 'conflict') return Response.json({ error: 'This request id belongs to another generation.' }, { status: 409 })
    if (status === 'subscription_required') return Response.json({ error: 'An active Nail Lab subscription is required.', code: 'LAB_SUBSCRIPTION_REQUIRED' }, { status: 402 })
    if (status !== 'claimed') {
      return Response.json({ error: 'No design tokens are available or the account is unavailable' }, { status: 402 })
    }
    // Only the worker that won the claim may release it in finally. A replay
    // observing pending/completed work must never cancel the original request.
    reservationId = requestId

    // Preserve the redesigned board prompt behind the atomic reservation.
    // Name hints come only from designs visible to this member.
    let existingNames = []
    try {
      const { data: titleRows } = await mobileUserClient(request).from('designs')
        .select('title').eq('is_published', true).not('title', 'is', null).limit(500)
      existingNames = [...new Set((titleRows || []).map(row => row.title).filter(Boolean))]
    } catch {}
    const { prompt } = buildNailLabPrompt({ shape, length, vibe, colors, occasion, customText, existingNames })

    // Always use standard images/generations — gpt-image-1 returns base64
    const requestBody = {
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: GENERATION_SIZE,
      quality: 'high',
      moderation: 'low',
    }

    const openaiRes = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(40_000),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.json()
      console.error('OpenAI error:', err)
      return Response.json({ error: 'Image generation failed' }, { status: 500 })
    }

    const openaiData = await openaiRes.json()

    // Extract base64 — gpt-image-1 always returns b64_json
    const b64 = openaiData?.data?.[0]?.b64_json

    if (!b64) {
      console.error('No image returned from OpenAI:', openaiData)
      return Response.json({ error: 'No image returned' }, { status: 500 })
    }

    // Upload to Supabase Storage (private bucket)
    const fileName = `${userId}/${reservationId}.png`
    const imageBuffer = Buffer.from(b64, 'base64')
    const { error: uploadError } = await supabase.storage
      .from('nail-lab')
      .upload(fileName, new Uint8Array(imageBuffer), { contentType: 'image/png', upsert: false })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return Response.json({ error: 'Failed to save image' }, { status: 500 })
    }

    // Stable reference stored in the DB — the bucket is private, so this is
    // resolved into a fresh signed URL whenever it's displayed later.
    const { data: { publicUrl: storedImageUrl } } = supabase.storage
      .from('nail-lab')
      .getPublicUrl(fileName)

    // Signed URL for immediate display in this response only.
    const { data: signedData, error: signError } = await supabase.storage
      .from('nail-lab')
      .createSignedUrl(fileName, 3600)

    if (signError || !signedData) {
      console.error('Signed URL error:', signError)
      return Response.json({ error: 'Failed to prepare image' }, { status: 500 })
    }
    const imageUrl = signedData.signedUrl

    // The image record and reservation completion commit together. Releasing
    // after an ambiguous network response cannot refund a completed request.
    const { data: generationId, error: insertError } = await supabase.rpc('complete_generation', {
      p_id: reservationId,
      p_generation: {
        image_url: storedImageUrl,
        vibe: Array.isArray(vibe) ? vibe : [vibe], shape, length, colors,
        occasion: Array.isArray(occasion) ? occasion : [occasion].filter(Boolean),
        custom_text: customText || null, prompt_used: prompt,
      },
    })
    if (insertError || !generationId) throw new Error('Failed to save generation', { cause: insertError })
    completed = true
    const { data: profile } = await supabase.from('profiles_data').select('credit_balance').eq('id', userId).single()

    return Response.json({
      imageUrl,
      generationId,
      creditsRemaining: profile?.credit_balance ?? null,
    })

  } catch (err) {
    console.error('generate-nail-design error:', err)
    return Response.json({ error: 'Generation could not be completed. Please check your history before retrying.' }, { status: 500 })
  } finally {
    if (reservationId && !completed) {
      try {
        const { error } = await supabase.rpc('release_generation', { p_id: reservationId })
        if (error) console.error('Generation reservation needs reconciliation:', reservationId, error)
      } catch (error) {
        console.error('Generation reservation needs reconciliation:', reservationId, error)
      }
    }
  }
}
