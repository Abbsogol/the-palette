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

  // profiles_data, not the profiles view — referral_code is masked behind
  // auth.uid() = id in the view, always null for a service-role caller.
  const { data: profile } = await supabase
    .from('profiles_data')
    .select('referral_code')
    .eq('id', user.id)
    .single()
  if (!profile) return Response.json({ error: 'User not found' }, { status: 404 })

  // Already has a code — return it
  if (profile.referral_code) return Response.json({ code: profile.referral_code })

  // Generate a unique code
  let code
  for (let i = 0; i < 10; i++) {
    const candidate = genCode()
    const { data: clash } = await supabase
      .from('profiles_data')
      .select('id')
      .eq('referral_code', candidate)
      .maybeSingle()
    if (!clash) { code = candidate; break }
  }
  if (!code) return Response.json({ error: 'Could not generate code' }, { status: 500 })

  const { error } = await supabase.from('profiles_data').update({ referral_code: code }).eq('id', user.id)
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ code })
}
