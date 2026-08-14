import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { code } = await request.json().catch(() => ({}))
  if (typeof code !== 'string' || !code.trim()) return Response.json({ error: 'Missing fields' }, { status: 400 })

  const upperCode = code.toUpperCase().trim().slice(0, 20)

  // Find the inviter by referral code (profiles view — referral_code is not
  // masked for this column, confirmed empirically against the real DB).
  const { data: inviter } = await supabase
    .from('profiles')
    .select('id')
    .eq('referral_code', upperCode)
    .maybeSingle()
  if (!inviter) return Response.json({ error: 'Invalid code' }, { status: 404 })
  if (inviter.id === user.id) return Response.json({ error: 'Cannot refer yourself' }, { status: 400 })

  // Atomic conditional update instead of check-then-write: this can only
  // succeed once for a given user, so two concurrent/retried calls with the
  // same code can't both pass and both trigger a reward payout below.
  const { data: claimed, error: claimError } = await supabase
    .from('profiles_data')
    .update({ referred_by: upperCode })
    .eq('id', user.id)
    .is('referred_by', null)
    .select('id')
    .maybeSingle()

  if (claimError) {
    console.error('apply-referral claim error:', claimError)
    return Response.json({ error: 'Failed to apply referral' }, { status: 500 })
  }
  if (!claimed) return Response.json({ error: 'Already referred' }, { status: 409 })

  // Award both parties. ref_id set to the referred user's id so repeat/retried
  // calls hit the rewards table's uniqueness guard instead of double-paying.
  const { error: rewardError } = await supabase.from('rewards').insert([
    { user_id: inviter.id, points: 50, reason: 'invite_friend',     ref_id: user.id },
    { user_id: user.id,    points: 25, reason: 'joined_via_invite', ref_id: user.id },
  ])
  if (rewardError) console.error('apply-referral reward insert error:', rewardError)

  return Response.json({ ok: true })
}
