import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

// Point values for actions a client can self-report via this endpoint.
// invite_friend/joined_via_invite are granted directly by apply-referral's
// own server-side insert (app/api/apply-referral/route.js) and are
// deliberately NOT accepted here — the real app never calls this endpoint
// with those reasons, so any request that does is illegitimate by definition.
const REWARD_POINTS = {
  save_design:      5,
  post_design:      10,
  leave_review:     15,
  book_appointment: 20,
}

// Confirms ref_id names a real row that actually reflects the claimed
// action, owned by the caller — without this, any signed-in user could
// claim any reward for any reason by inventing a fresh ref_id each time.
async function verifyRefId(userId, reason, refId) {
  if (reason === 'save_design') {
    const { data } = await supabase.from('saved_designs').select('design_id').eq('user_id', userId).eq('design_id', refId).maybeSingle()
    return !!data
  }
  if (reason === 'post_design') {
    const { data } = await supabase.from('designs').select('id').eq('id', refId).eq('created_by', userId).maybeSingle()
    return !!data
  }
  if (reason === 'leave_review') {
    const { data } = await supabase.from('reviews').select('id').eq('booking_id', refId).eq('reviewer_id', userId).maybeSingle()
    return !!data
  }
  if (reason === 'book_appointment') {
    const { data } = await supabase.from('bookings').select('id').eq('id', refId).eq('client_id', userId).maybeSingle()
    return !!data
  }
  return false
}

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { reason, ref_id } = await request.json().catch(() => ({}))
  // typeof ... === 'number' also rejects Object.prototype-inherited
  // properties (e.g. reason: 'constructor'), which would otherwise pass a
  // plain `!REWARD_POINTS[reason]` truthy check.
  if (typeof REWARD_POINTS[reason] !== 'number' || typeof ref_id !== 'string' || !ref_id) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const verified = await verifyRefId(user.id, reason, ref_id)
  if (!verified) {
    return Response.json({ error: 'Could not verify this action' }, { status: 403 })
  }

  const points = REWARD_POINTS[reason]
  const { error } = await supabase.from('rewards').insert({ user_id: user.id, points, reason, ref_id })

  if (error) {
    if (error.code === '23505') {
      // Already rewarded for this exact action — treat as a harmless no-op
      return Response.json({ ok: true, points: 0, already: true })
    }
    return Response.json({ error: 'Failed to grant reward' }, { status: 500 })
  }

  return Response.json({ ok: true, points })
}
