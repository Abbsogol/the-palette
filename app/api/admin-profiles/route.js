import { getSessionUser, isAdmin, serviceClient as supabase } from '@/lib/auth'

export const dynamic = 'force-dynamic'

async function requireAdmin(request) {
  const user = await getSessionUser(request)
  if (!user || !(await isAdmin(user.id))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

export async function GET(request) {
  const unauthorized = await requireAdmin(request)
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(request.url)
  const query = (searchParams.get('q') || '').trim()

  // profiles_data, not the profiles view — credit_balance/subscription_tier
  // are masked behind auth.uid() = id in the view, always null for service-role.
  const select = 'id, display_name, username, account_type, credit_balance, subscription_tier'

  if (query) {
    // Two separate .ilike() queries instead of one raw .or() string — a
    // comma or parenthesis typed into the search box could otherwise alter
    // the filter logic (same pattern used in app/search/page.js).
    const [{ data: byName, error: nameError }, { data: byUsername, error: userError }] = await Promise.all([
      supabase.from('profiles_data').select(select).ilike('display_name', `%${query}%`).order('created_at', { ascending: false }).limit(20),
      supabase.from('profiles_data').select(select).ilike('username', `%${query}%`).order('created_at', { ascending: false }).limit(20),
    ])
    if (nameError || userError) return Response.json({ error: 'Search failed' }, { status: 500 })
    const merged = [...(byName || [])]
    const seen = new Set(merged.map(p => p.id))
    ;(byUsername || []).forEach(p => { if (!seen.has(p.id)) merged.push(p) })
    return Response.json({ users: merged.slice(0, 20) })
  }

  const { data, error } = await supabase.from('profiles_data').select(select).order('created_at', { ascending: false }).limit(50)
  if (error) return Response.json({ error: 'Failed to load users' }, { status: 500 })
  return Response.json({ users: data || [] })
}

export async function POST(request) {
  const unauthorized = await requireAdmin(request)
  if (unauthorized) return unauthorized

  const { userId, credits } = await request.json().catch(() => ({}))
  if (typeof userId !== 'string' || !userId || typeof credits !== 'number' || !Number.isFinite(credits)) {
    return Response.json({ error: 'Missing or invalid params' }, { status: 400 })
  }

  const { error } = await supabase.from('profiles_data').update({ credit_balance: credits }).eq('id', userId)
  if (error) return Response.json({ error: 'Failed to update credits' }, { status: 500 })
  return Response.json({ ok: true })
}
