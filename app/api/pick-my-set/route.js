import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { prompt } = await request.json().catch(() => ({}))
  if (typeof prompt !== 'string' || !prompt.trim()) {
    return Response.json({ error: 'No prompt provided' }, { status: 400 })
  }
  if (prompt.length > 500) {
    return Response.json({ error: 'Prompt is too long' }, { status: 400 })
  }

  // Fetch all published designs (lightweight fields only)
  const { data: designs, error } = await supabase
    .from('designs')
    .select('id, title, shape, occasion, technique, category')
    .eq('is_published', true)
    .eq('is_curated', true)

  if (error || !designs?.length) {
    return Response.json({ error: 'Could not load designs' }, { status: 500 })
  }

  // Build a compact design list for the prompt
  const designList = designs.map(d =>
    `ID:${d.id} | ${d.title} | shape:${d.shape || '?'} | occasion:${d.occasion || '?'} | technique:${d.technique || '?'} | category:${d.category || '?'}`
  ).join('\n')

  const systemPrompt = `You are a nail design expert. Given a list of nail designs and a user's request, pick exactly 6 designs that best match the request. Reply with ONLY a JSON array of 6 design IDs, like: ["id1","id2","id3","id4","id5","id6"]. No explanation, no markdown, just the JSON array.`

  const userMessage = `User wants: "${prompt.trim()}"\n\nAvailable designs:\n${designList}`

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.4,
      max_tokens: 200,
    }),
  })

  if (!res.ok) {
    const err = await res.json()
    return Response.json({ error: err?.error?.message || 'OpenAI error' }, { status: 500 })
  }

  const data = await res.json()
  const raw = data.choices?.[0]?.message?.content?.trim() || '[]'

  let ids = []
  try { ids = JSON.parse(raw) } catch { ids = [] }

  // Only accept ids that were actually part of the candidate set offered
  // to the model — never trust its output as valid on its own, since a
  // crafted prompt could coax it into returning an id we never gave it
  // (e.g. an unpublished design), bypassing the is_published/is_curated
  // filter this route is supposed to enforce.
  const validIds = new Set(designs.map(d => d.id))
  ids = Array.isArray(ids) ? ids.filter(id => typeof id === 'string' && validIds.has(id)) : []

  // Fetch full design data for matched IDs
  if (!ids.length) return Response.json({ designs: [] })

  const { data: matched } = await supabase
    .from('designs')
    .select('*')
    .in('id', ids)

  // Return in the order GPT picked them
  const ordered = ids
    .map(id => matched?.find(d => d.id === id))
    .filter(Boolean)

  return Response.json({ designs: ordered })
}
