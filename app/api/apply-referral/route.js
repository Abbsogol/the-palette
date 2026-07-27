import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(request) {
  const { code, new_user_id } = await request.json()
  if (!code || !new_user_id) return Response.json({ error: 'Missing fields' }, { status: 400 })

  const upperCode = code.toUpperCase().trim()

  // Check new user exists and hasn't already been referred
  // profiles_data, not the profiles view — referred_by is masked behind
  // auth.uid() = id in the view, always null for a service-role caller
  // (which would silently defeat the already-referred check below).
  const { data: newUser } = await supabase
    .from('profiles_data')
    .select('id, referred_by')
    .eq('id', new_user_id)
    .single()
  if (!newUser) return Response.json({ error: 'User not found' }, { status: 404 })
  if (newUser.referred_by) return Response.json({ error: 'Already referred' }, { status: 409 })

  // Find the inviter by referral code
  const { data: inviter } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', upperCode)
    .maybeSingle()
  if (!inviter) return Response.json({ error: 'Invalid code' }, { status: 404 })
  if (inviter.id === new_user_id) return Response.json({ error: 'Cannot refer yourself' }, { status: 400 })

  // Mark new user as referred (profiles_data — referred_by is an
  // expression column in the profiles view, not directly writable there)
  await supabase.from('profiles_data').update({ referred_by: upperCode }).eq('id', new_user_id)

  // Award both parties
  await supabase.from('rewards').insert([
    { user_id: inviter.id,  points: 50, reason: 'invite_friend'     },
    { user_id: new_user_id, points: 25, reason: 'joined_via_invite'  },
  ])

  return Response.json({ ok: true })
}
