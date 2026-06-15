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
    const colorList = colors && colors.length > 0 ? colors.join(', ') : 'neutral tones'
    const occasionLine = occasion ? ` Perfect for ${occasion}.` : ''
    const customLine = customText ? ` Additional details: ${customText}.` : ''

    const shapeDescriptions = {
      'Almond': 'tapered sides with a rounded peak, elegant and elongating',
      'Stiletto': 'dramatically tapered to a sharp point, bold and edgy',
      'Coffin': 'tapered sides with a flat square tip, modern and statement-making',
      'Square': 'straight sides with a flat square tip, clean and classic',
      'Oval': 'rounded sides and tip, soft and feminine',
      'Squoval': 'straight sides with softly rounded corners, practical yet polished',
    }

    const shapeDesc = shapeDescriptions[shape] || shape

    const prompt = `Create a professional nail design board in the exact Laque studio format:

LAYOUT: Dark background (#141414 near-black). Two rows of nail images. Left side: 4 full nails shown straight on (2 top, 2 bottom). Right side: 3-4 smaller inset detail/macro shots showing texture and finish up close. Design name in elegant thin sans-serif font at top.

NAIL DESIGN SPECS:
- Shape: ${shape} (${shapeDesc})
- Length: ${length}
- Vibe: ${vibe}
- Colors: ${colorList}${occasionLine}${customLine}

STYLE: Editorial, moody, and high-end — like a luxury nail salon lookbook. Nails should look photorealistic with accurate light reflection, depth, and texture. No hands, just nails on a dark surface or floating. Composition should feel intentional and curated.

Design name at top should reflect the vibe in 1-3 words (e.g. "Velvet Noir", "Cherry Glass", "Salt & Stone").`

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
