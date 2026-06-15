import { createClient } from '@supabase/supabase-js'

export async function POST(request) {
  try {
    const body = await request.json()
    const { vibe, shape, length, colors, occasion, customText, referenceImageUrls, userId } = body

    if (!userId || !vibe || !shape || !length) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Server-side Supabase with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )

    // Check credit balance
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('credit_balance')
      .eq('id', userId)
      .single()

    if (profileError || !profile) {
      return Response.json({ error: 'User not found' }, { status: 404 })
    }

    if (profile.credit_balance < 1) {
      return Response.json({ error: 'Insufficient credits' }, { status: 402 })
    }

    // Build prompt
    const colorList = colors && colors.length > 0 ? colors.join(', ') : 'tones that suit the vibe'
    const occasionNote = occasion ? ` Suited for ${occasion}.` : ''
    const customNote = customText ? ` Additional details: ${customText}.` : ''

    // Design name hint based on vibe
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
    const nameHint = vibeNameHints[vibe] || `reflecting the ${vibe} aesthetic`

    const prompt = `A professional nail design reference board. Dark warm charcoal background (#2A2828) throughout the entire image — no white areas anywhere, no light backgrounds, no panels, no frames with white inside.

LAYOUT:
Top center: title text "✦ [DESIGN NAME] ✦" in large elegant serif font coloured to match the nail palette, with subtitle "[DESIGN SUBTITLE]" in small spaced caps directly below it.
Left side — nail sets: two horizontal rows of 5 photorealistic nails each. Label "✦ SET 1" in small text at the left of the first row, "✦ SET 2" at the left of the second row, small ✦ divider between the two rows. Nails float directly on the dark background with soft drop shadows beneath them. No white panels, no boxes, no backgrounds behind the nails. No hands, no fingers, no skin — nails only, floating.
Right side — detail shots: 3 vertically stacked close-up macro shots of the nail surface inside dark rounded rectangle frames. The frames blend into the dark charcoal background — no white, no light colour inside the frames. No hands, no fingers, no skin in any detail shot — nail surface texture only. Below each frame: one bold all-caps label + 2 lines of small italic descriptive text.
Bottom center: small decorative monogram or logo mark.
QUALITY: Photorealistic. Editorial luxury nail lookbook aesthetic. 4K. Clean professional layout. No decorative borders around the whole image. No drop shadows on the overall board.

NAIL DESIGN SPECS — apply these to every nail in the board:
- Shape: ${shape}
- Length: ${length}
- Vibe / aesthetic: ${vibe}
- Colours: ${colorList}${occasionNote}${customNote}

DESIGN NAME: Choose a name that is ${nameHint}. The subtitle should reflect the shape, length, or finish in 2–4 words.`

    // Build OpenAI request — support reference images
    let requestBody
    if (referenceImageUrls && referenceImageUrls.length > 0) {
      // Use responses API for multi-modal (text + images)
      const imageInputs = referenceImageUrls.slice(0, 4).map(url => ({
        type: 'input_image',
        image_url: url,
      }))
      requestBody = {
        model: 'gpt-image-1',
        input: [
          {
            role: 'user',
            content: [
              ...imageInputs,
              { type: 'input_text', text: prompt }
            ]
          }
        ],
        output_format: 'url',
      }
    } else {
      // Standard image generation
      requestBody = {
        model: 'gpt-image-1',
        prompt,
        n: 1,
        size: '1024x1024',
        output_format: 'url',
      }
    }

    // Determine endpoint
    const endpoint = referenceImageUrls && referenceImageUrls.length > 0
      ? 'https://api.openai.com/v1/responses'
      : 'https://api.openai.com/v1/images/generations'

    const openaiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    })

    if (!openaiRes.ok) {
      const err = await openaiRes.json()
      console.error('OpenAI error:', err)
      return Response.json({ error: 'Image generation failed', details: err }, { status: 500 })
    }

    const openaiData = await openaiRes.json()

    // Extract image URL from either endpoint format
    const imageUrl = openaiData?.data?.[0]?.url
      || openaiData?.output?.find(o => o.type === 'image_generation_call')?.result

    if (!imageUrl) {
      return Response.json({ error: 'No image returned', raw: openaiData }, { status: 500 })
    }

    // Deduct 1 credit
    await supabase.rpc('decrement_credits', { user_id: userId })

    // Save generation record
    const { data: generation } = await supabase
      .from('nail_lab_generations')
      .insert({
        user_id: userId,
        image_url: imageUrl,
        vibe,
        shape,
        length,
        colors: colors || [],
        occasion: occasion || null,
        custom_text: customText || null,
        prompt_used: prompt,
        reference_image_urls: referenceImageUrls || [],
        credits_used: 1,
      })
      .select()
      .single()

    return Response.json({
      imageUrl,
      generationId: generation?.id || null,
      creditsRemaining: profile.credit_balance - 1,
    })

  } catch (err) {
    console.error('generate-nail-design error:', err)
    return Response.json({ error: 'Server error', details: err.message }, { status: 500 })
  }
}
