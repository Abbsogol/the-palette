import { getSessionUser, serviceClient as supabase } from '@/lib/auth'
import { GENERATION_SIZE } from '@/lib/nailLab'
import { buildNailLabPrompt } from '@/lib/nailPrompt'

export const maxDuration = 300 // gpt-image-1 at high quality can exceed 60s; 300 = Vercel Pro ceiling (a Hobby project caps at 60 and will fail the build at this value)

export async function POST(request) {
  try {
    const user = await getSessionUser(request)
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = user.id

    const body = await request.json()
    const { freeRegen, parentGenerationId } = body

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
    const referenceImageUrls = capArr(body.referenceImageUrls, 10, 500)

    // Check credit balance (skip for free regen)
    // profiles_data, not the profiles view — credit_balance is masked behind
    // auth.uid() = id in the view, which is never true for a service-role caller.
    const { data: profile, error: profileError } = await supabase
      .from('profiles_data')
      .select('credit_balance')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    // A free regen must point at a real, unused, original (non-regen)
    // generation owned by this user — claimed atomically via a conditional
    // update BEFORE generation starts, not via a check-then-flag-after
    // sequence. Two concurrent requests racing a plain read-then-write could
    // both pass the eligibility read and both get a free image from one
    // eligible regen; this update can only ever succeed for one of them.
    if (freeRegen) {
      if (!parentGenerationId) {
        return Response.json({ error: 'Free regen unavailable' }, { status: 403 })
      }
      const { data: claimed, error: claimError } = await supabase
        .from('nail_lab_generations')
        .update({ free_regen_used: true })
        .eq('id', parentGenerationId)
        .eq('user_id', userId)
        .eq('free_regen_used', false)
        .is('parent_generation_id', null)
        .select('id')
        .maybeSingle()

      if (claimError || !claimed) {
        return Response.json({ error: 'Free regen unavailable' }, { status: 403 })
      }
    }

    if (!freeRegen && profile.credit_balance < 1) {
      return Response.json({ error: 'Insufficient credits' }, { status: 402 })
    }

    // If generation fails anywhere after the free-regen flag is claimed
    // above, give it back — the user shouldn't lose their one free regen to
    // an OpenAI/storage hiccup that produced no image.
    const refundFreeRegen = async () => {
      if (freeRegen && parentGenerationId) {
        await supabase.from('nail_lab_generations').update({ free_regen_used: false }).eq('id', parentGenerationId)
      }
    }

    // Build the board prompt. The template, shape paragraphs, background blocks,
    // colour naming and the contrast-based background choice all live in
    // lib/nailPrompt.js — the source of truth. referenceImageUrls are still
    // stored on the record below, but are NO LONGER mentioned in the prompt:
    // the /v1/images/generations call is text-only, so the old "take inspiration
    // from the reference designs" line never actually reached the model.
    // Existing catalogue names → the prompt tells the model not to reuse them, so
    // a generated board's title doesn't clash with a published design. Best-effort:
    // never block a generation if this read fails.
    let existingNames = []
    try {
      const { data: titleRows } = await supabase
        .from('designs').select('title').eq('is_published', true).not('title', 'is', null).limit(500)
      existingNames = [...new Set((titleRows || []).map(r => r.title).filter(Boolean))]
    } catch (e) {
      console.error('nail-lab existing-names fetch failed (continuing without avoid-list):', e)
    }

    const { prompt, background, backgroundReason } = buildNailLabPrompt({
      shape, length, vibe, colors, occasion, customText, existingNames,
    })
    console.log(`nail-lab background: ${background} — ${backgroundReason}`)

    // Always use standard images/generations — gpt-image-1 returns base64.
    // quality 'high' is the maximum gpt-image-1 supports (raises per-image cost).
    // moderation 'low' — the strict default ('auto') was refusing ordinary nail
    // words like "gothic"; these are nail designs, so relax the filter.
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
    })

    if (!openaiRes.ok) {
      let err = null
      try { err = await openaiRes.json() } catch {}
      const oaCode = err?.error?.code || ''
      const oaType = err?.error?.type || ''
      const oaMsg = err?.error?.message || ''
      console.error('OpenAI error:', openaiRes.status, JSON.stringify(err))
      await refundFreeRegen()

      // Content-policy / moderation refusal → tell the user to reword (no credit
      // was taken; the deduction happens only after a successful generation below).
      const isModeration = openaiRes.status === 400 && (
        oaCode === 'moderation_blocked' ||
        oaType === 'image_generation_user_error' ||
        /safety system|content policy|moderation|not allowed|rejected/i.test(oaMsg)
      )
      if (isModeration) {
        return Response.json({ error: 'Some wording in your description was blocked. Try describing the look differently.' }, { status: 400 })
      }
      // Rate limit → the service is busy, retry shortly.
      if (openaiRes.status === 429 || oaCode === 'rate_limit_exceeded') {
        return Response.json({ error: 'The image service is busy right now. Please try again in a moment.' }, { status: 429 })
      }
      // Anything else → surface the actual reason in the response, since the
      // Vercel logs aren't readable — so a repeat failure is diagnosable in-app.
      const reason = oaMsg || oaCode || `HTTP ${openaiRes.status}`
      return Response.json({ error: `Couldn't generate this design (${reason}). Please try again.` }, { status: 500 })
    }

    const openaiData = await openaiRes.json()

    // Extract base64 — gpt-image-1 always returns b64_json
    const b64 = openaiData?.data?.[0]?.b64_json

    if (!b64) {
      console.error('No image returned from OpenAI:', openaiData)
      await refundFreeRegen()
      return Response.json({ error: 'No image returned' }, { status: 500 })
    }

    // Upload to Supabase Storage (private bucket)
    const fileName = `${userId}/${Date.now()}.png`
    const imageBuffer = Buffer.from(b64, 'base64')
    const { error: uploadError } = await supabase.storage
      .from('nail-lab')
      .upload(fileName, imageBuffer, { contentType: 'image/png', upsert: false })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      await refundFreeRegen()
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
      await refundFreeRegen()
      return Response.json({ error: 'Failed to prepare image' }, { status: 500 })
    }
    const imageUrl = signedData.signedUrl

    // Deduct 1 credit (free regens already had their one-time flag claimed
    // atomically above, before generation started). The image is already
    // generated and uploaded by this point, so a decrement failure here is
    // logged for reconciliation rather than discarding the result.
    if (!freeRegen) {
      const { error: decError } = await supabase.rpc('decrement_credits', { user_id: userId })
      if (decError) console.error('decrement_credits failed:', decError)
    }

    // Save generation record
    const { data: generation, error: insertError } = await supabase
      .from('nail_lab_generations')
      .insert({
        user_id: userId,
        image_url: storedImageUrl,
        vibe,
        shape,
        length,
        colors: colors || [],
        occasion: occasion || null,
        custom_text: customText || null,
        prompt_used: prompt,
        reference_image_urls: referenceImageUrls || [],
        credits_used: 1,
        parent_generation_id: parentGenerationId || null,
      })
      .select()
      .single()

    if (insertError || !generation) {
      console.error('nail_lab_generations insert failed:', insertError)
      // The generation record — the only durable reference to what was just
      // charged for — was lost, so refund the credit/free-regen rather than
      // silently keeping the charge.
      if (!freeRegen) {
        await supabase.rpc('increment_credits', { user_id: userId, amount: 1 })
      } else {
        await refundFreeRegen()
      }
      return Response.json({ error: 'Failed to save your generation. Please try again — you have not been charged.' }, { status: 500 })
    }

    return Response.json({
      imageUrl,
      generationId: generation.id,
      creditsRemaining: freeRegen ? profile.credit_balance : profile.credit_balance - 1,
    })

  } catch (err) {
    console.error('generate-nail-design error:', err)
    return Response.json({ error: 'Server error' }, { status: 500 })
  }
}
