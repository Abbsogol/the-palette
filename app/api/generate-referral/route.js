import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

// No ambiguous chars (0/O, 1/I/L)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function genCode() {
  return Array.from({ length: 8 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
}

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const { data: code, error } = await supabase.rpc('ensure_referral_code', { p_user_id:user.id, p_candidate:genCode() })
    if (!error && code) return Response.json({ code })
    if (error?.code !== '23505') break
  }
  return Response.json({ error:'Could not generate referral code. Please retry.' },{ status:503 })
}
