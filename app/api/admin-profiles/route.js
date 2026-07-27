import { createClient } from '@supabase/supabase-js'
import { getSessionUser, isAdmin } from '@/lib/auth'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

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
  const query = searchParams.get('q') || ''

  let q = supabase
    .from('profiles')
    .select('id, display_name, username, account_type, credit_balance, subscription_tier')
    .order('created_at', { ascending: false })

  if (query.trim()) {
    q = q.or(`display_name.ilike.%${query}%,username.ilike.%${query}%`).limit(20)
  } else {
    q = q.limit(50)
  }


  const { data, error } = await q
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ users: data || [] })
}

export async function POST(request) {
  const unauthorized = await requireAdmin(request)
  if (unauthorized) return unauthorized

  const { userId, credits } = await request.json()
  if (!userId || credits == null) return Response.json({ error: 'Missing params' }, { status: 400 })

  const { error } = await supabase.from('profiles').update({ credit_balance: credits }).eq('id', userId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
