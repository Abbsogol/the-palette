import { createClient } from '@supabase/supabase-js'

function makeSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

async function verifyAdmin(userId, supabase) {
  const { data } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', userId)
    .single()
  return data?.is_admin === true
}

export async function POST(request) {
  const body = await request.json()
  const { action, userId } = body

  if (!userId) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const supabase = makeSupabase()
  const isAdmin = await verifyAdmin(userId, supabase)
  if (!isAdmin) return Response.json({ error: 'Forbidden' }, { status: 403 })

  // ── Stats ───────────────────────────────────────────────────────────────────
  if (action === 'stats') {
    const [
      { count: users },
      { count: designs },
      { count: bookings },
      { count: subscriptions },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('designs').select('*', { count: 'exact', head: true }).eq('is_published', true),
      supabase.from('bookings').select('*', { count: 'exact', head: true }),
      supabase.from('profiles').select('*', { count: 'exact', head: true }).not('subscription_tier', 'is', null),
    ])

    // Recent signups (last 10)
    const { data: recentUsers } = await supabase
      .from('profiles')
      .select('id, display_name, username, account_type, created_at')
      .order('created_at', { ascending: false })
      .limit(10)

    return Response.json({ users, designs, bookings, subscriptions, recentUsers })
  }

  // ── List designs for moderation ──────────────────────────────────────────────
  if (action === 'designs') {
    const { page = 0 } = body
    const PAGE_SIZE = 20
    const { data, count } = await supabase
      .from('designs')
      .select('id, title, image_url, is_published, created_at, created_by, category', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1)

    // Fetch creator names
    const creatorIds = [...new Set((data || []).map(d => d.created_by).filter(Boolean))]
    let creatorMap = {}
    if (creatorIds.length) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name')
        .in('id', creatorIds)
      creatorMap = Object.fromEntries((profiles || []).map(p => [p.id, p.display_name]))
    }

    return Response.json({
      designs: (data || []).map(d => ({ ...d, creator_name: creatorMap[d.created_by] || 'Laque' })),
      total: count,
      pageSize: PAGE_SIZE,
    })
  }

  // ── Unpublish / republish design ─────────────────────────────────────────────
  if (action === 'unpublish') {
    const { designId, publish } = body
    const { error } = await supabase
      .from('designs')
      .update({ is_published: !!publish })
      .eq('id', designId)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  // ── List tags ─────────────────────────────────────────────────────────────────
  if (action === 'tags') {
    const { data } = await supabase
      .from('tags')
      .select('id, name')
      .order('name', { ascending: true })
    return Response.json({ tags: data || [] })
  }

  // ── Add tag ───────────────────────────────────────────────────────────────────
  if (action === 'add-tag') {
    const { name } = body
    if (!name?.trim()) return Response.json({ error: 'Name required' }, { status: 400 })
    const { data, error } = await supabase
      .from('tags')
      .insert({ name: name.trim().toLowerCase() })
      .select()
      .single()
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ tag: data })
  }

  // ── Delete tag ────────────────────────────────────────────────────────────────
  if (action === 'delete-tag') {
    const { tagId } = body
    const { error } = await supabase.from('tags').delete().eq('id', tagId)
    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true })
  }

  // ── Search user ───────────────────────────────────────────────────────────────
  if (action === 'search-user') {
    const { query } = body
    if (!query?.trim()) return Response.json({ users: [] })
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username, account_type, credits, subscription_tier')
      .or(`display_name.ilike.%${query}%,username.ilike.%${query}%`)
      .limit(10)
    return Response.json({ users: data || [] })
  }

  // ── Update credits ────────────────────────────────────────────────────────────
  if (action === 'update-credits') {
    const { targetUserId, amount } = body
    if (!targetUserId || amount === undefined) return Response.json({ error: 'Missing fields' }, { status: 400 })

    const { data: profile } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', targetUserId)
      .single()

    const newBalance = Math.max(0, (profile?.credits || 0) + parseInt(amount))
    const { error } = await supabase
      .from('profiles')
      .update({ credits: newBalance })
      .eq('id', targetUserId)

    if (error) return Response.json({ error: error.message }, { status: 500 })
    return Response.json({ ok: true, newBalance })
  }

  return Response.json({ error: 'Unknown action' }, { status: 400 })
}
