import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { code } = await request.json()
  if (!code) return Response.json({ error: 'Missing fields' }, { status: 400 })

  const upperCode = code.toUpperCase().trim()

  // Check the caller exists and hasn't already been referred
  // profiles_data, not the profiles view — referred_by is masked behind
  // auth.uid() = id in the view, always null for a service-role caller
  // (which would silently defeat the already-referred check below).
  const { data: newUser } = await supabase
    .from('profiles_data')
    .select('id, referred_by')
    .eq('id', user.id)
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
  if (inviter.id === user.id) return Response.json({ error: 'Cannot refer yourself' }, { status: 400 })

  // Mark the caller as referred (profiles_data — referred_by is an
  // expression column in the profiles view, not directly writable there)
  await supabase.from('profiles_data').update({ referred_by: upperCode }).eq('id', user.id)

  // Award both parties. ref_id set to the referred user's id so repeat/retried
  // calls hit the rewards table's uniqueness guard instead of double-paying.
  await supabase.from('rewards').insert([
    { user_id: inviter.id, points: 50, reason: 'invite_friend',     ref_id: user.id },
    { user_id: user.id,    points: 25, reason: 'joined_via_invite', ref_id: user.id },
  ])

  return Response.json({ ok: true })
}
