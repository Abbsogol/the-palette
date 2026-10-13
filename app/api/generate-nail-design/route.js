import { createHash } from 'node:crypto'
import { generationIdPattern, generationResult } from '@/lib/generation-result'
import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

export const maxDuration = 60 // allow up to 60s for gpt-image-1

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

    // Build prompt
    const vibeList = Array.isArray(vibe) ? vibe.join(' + ') : vibe
    const colorList = colors && colors.length > 0 ? colors.join(', ') : 'tones that suit the vibe'
    const occasionNote = occasion && occasion.length > 0
      ? ` Suited for ${Array.isArray(occasion) ? occasion.join(' or ') : occasion}.`
      : ''
    const customNote = customText ? ` Additional details: ${customText}.` : ''

    // Design name hint based on primary vibe
    const primaryVibe = Array.isArray(vibe) ? vibe[0] : vibe
    const vibeNameHints = {
      'Minimal': 'clean, understated (e.g. "Bare Silk", "Still Water", "Clean Slate")',
      'Moody': 'dark and atmospheric (e.g. "Velvet Noir", "Storm Glass", "Dusk Hour")',
      'Dark': 'bold and dramatic (e.g. "Midnight Lacquer", "Black Onyx", "Shadow Run")',
      'Coastal': 'fresh and watery (e.g. "Salt & Stone", "Sea Glass", "Pearl Tide")',
      'Glam': 'luxurious and shiny (e.g. "Gold Rush", "Chrome Queen", "Mirror Gloss")',
      'Y2K': 'playful and nostalgic (e.g. "Cherry Pop", "Cyber Pink", "2000 Shimmer")',
      'Bridal': 'soft and romantic (e.g. "Ivory Veil", "Blush Bloom", "White Petal")',
      'Abstract': 'artistic and unexpected (e.g. "Ink Drop", "Paint Theory", "Colour Study")',
      'Floral': 'delicate and botanical (e.g. "Rose Sketch", "Petal Press", "Garden Edit")',
      'Pastel': 'soft and dreamy (e.g. "Cotton Cloud", "Lilac Air", "Pale Blush")',
      'Edgy': 'sharp and striking (e.g. "Razor Edge", "Chrome Spike", "Ink Black")',
      'Clean Girl': 'polished and natural (e.g. "Your Nails But Better", "Glazed Skin", "Soft Sheer")',
    }
    const nameHint = vibeNameHints[primaryVibe] || `reflecting the ${primaryVibe} aesthetic`

    const prompt = `A professional nail design reference board. Dark warm charcoal background (\`#2A2828\`) throughout the entire image — no white areas anywhere, no light backgrounds, no panels, no frames with white inside.
TITLE AREA — top center: "✦ [DESIGN NAME] ✦" in large elegant serif font coloured to match the nails. Subtitle in small spaced caps directly below.
LEFT SIDE — nail sets:Exactly 10 nails total on the left panel. Split into 2 rows of 5. "SET 1" label left of the first row of 5 nails. "SET 2" label left of the second row of 5 nails. Small ✦ divider between the two rows. The left panel contains 10 nails and nothing else. No third row. No additional nails below SET 2. Stop at 10.
RIGHT SIDE — detail shots: Exactly 3 close-up macro shots, stacked vertically. Each inside a dark rounded rectangle frame that blends into the background — no light or white inside the frames. Each shot shows only the nail surface — texture, finish, art detail. Absolutely no skin, no fingers, no hands in any detail shot. Nail surface only. All 3 frames must be filled — no empty or black frames. Below each frame: one bold all-caps label + 2 lines small italic text.
BOTTOM CENTER: small decorative monogram.
CRITICAL RULES:

* No skin, no fingers, no hands anywhere in the image — not in the nail rows, not in the detail shots
* All 3 detail frames must contain actual nail surface close-ups — never leave a frame empty or black
* The entire composition must fit within the image — nothing cut off at edges or bottom
* Dark background throughout — \`#2A2828\` — no white, no cream, no light anywhere
Photorealistic. Editorial luxury lookbook. 4K. Clean layout.

NAIL DESIGN SPECS — apply to every nail:
- Shape: ${shape}
- Length: ${length}
- Vibe / aesthetic: ${vibeList}
- Colours: ${colorList}${occasionNote}${customNote}

DESIGN NAME: Choose a name that is ${nameHint}. Subtitle should reflect shape, length or finish in 2–4 words.`

    // Always use standard images/generations — gpt-image-1 returns base64
    const requestBody = {
      model: 'gpt-image-1',
      prompt,
      n: 1,
      size: '1536x1024',
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
