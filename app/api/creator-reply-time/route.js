import { serviceClient as supabase } from '@/lib/auth'

// Median time for a creator's first reply in their recent conversations.
// Service-role because messages are only readable by participants — this
// returns just the aggregate, never message contents. Backs the profile's
// "Usually replies in ..." line with real data (no fake "1hr"): the client
// shows it only when samples >= 3.
export async function GET(request) {
  const { searchParams } = new URL(request.url)
  const creatorId = searchParams.get('creator')
  if (!creatorId) {
    return Response.json({ error: 'creator required' }, { status: 400 })
  }

  const { data: convs, error: convError } = await supabase
    .from('conversations')
    .select('id')
    .eq('creator_id', creatorId)
    .order('created_at', { ascending: false })
    .limit(30)
  if (convError) return Response.json({ error: 'lookup failed' }, { status: 500 })
  if (!convs?.length) return Response.json({ medianMinutes: null, samples: 0 })

  const { data: msgs, error: msgError } = await supabase
    .from('messages')
    .select('conversation_id, sender_id, created_at')
    .in('conversation_id', convs.map(c => c.id))
    .order('created_at', { ascending: true })
    .limit(2000)
  if (msgError) return Response.json({ error: 'lookup failed' }, { status: 500 })

  const gaps = []
  const byConv = new Map()
  for (const m of msgs || []) {
    if (!byConv.has(m.conversation_id)) byConv.set(m.conversation_id, [])
    byConv.get(m.conversation_id).push(m)
  }
  for (const thread of byConv.values()) {
    const firstClientMsg = thread.find(m => m.sender_id !== creatorId)
    if (!firstClientMsg) continue
    const firstReply = thread.find(m =>
      m.sender_id === creatorId && new Date(m.created_at) > new Date(firstClientMsg.created_at)
    )
    if (!firstReply) continue
    gaps.push((new Date(firstReply.created_at) - new Date(firstClientMsg.created_at)) / 60000)
  }

  if (gaps.length === 0) return Response.json({ medianMinutes: null, samples: 0 })
  gaps.sort((a, b) => a - b)
  const mid = Math.floor(gaps.length / 2)
  const median = gaps.length % 2 ? gaps[mid] : (gaps[mid - 1] + gaps[mid]) / 2

  return Response.json(
    { medianMinutes: Math.round(median), samples: gaps.length },
    { headers: { 'Cache-Control': 's-maxage=3600, stale-while-revalidate=86400' } }
  )
}
