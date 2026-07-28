import { serviceClient as supabase } from '@/lib/auth'

// No ambiguous chars (0/O, 1/I/L)
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function genCode() {
  return Array.from({ length: 8 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
}

export async function POST(request) {
  const { user_id } = await request.json()
  if (!user_id) return Response.json({ error: 'Missing user_id' }, { status: 400 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('referral_code')
    .eq('id', user_id)
    .single()
  if (!profile) return Response.json({ error: 'User not found' }, { status: 404 })

  // Already has a code — return it
  if (profile.referral_code) return Response.json({ code: profile.referral_code })

  // Generate a unique code
  let code
  for (let i = 0; i < 10; i++) {
    const candidate = genCode()
    const { data: clash } = await supabase
      .from('profiles')
      .select('id')
      .eq('referral_code', candidate)
      .maybeSingle()
    if (!clash) { code = candidate; break }
  }
  if (!code) return Response.json({ error: 'Could not generate code' }, { status: 500 })

  await supabase.from('profiles').update({ referral_code: code }).eq('id', user_id)
  return Response.json({ code })
}
