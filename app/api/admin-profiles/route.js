import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function GET(request) {
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
  const { userId, credits } = await request.json()
  if (!userId || credits == null) return Response.json({ error: 'Missing params' }, { status: 400 })

  const { error } = await supabase.from('profiles').update({ credit_balance: credits }).eq('id', userId)
  if (error) return Response.json({ error: error.message }, { status: 500 })
  return Response.json({ ok: true })
}
