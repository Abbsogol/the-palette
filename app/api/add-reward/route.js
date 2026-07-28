import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

// Point values per action
const REWARD_POINTS = {
  save_design:       5,
  post_design:       10,
  leave_review:      15,
  book_appointment:  20,
  invite_friend:     50,
  joined_via_invite: 25,
}

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { reason, ref_id } = await request.json()
  if (!reason || !REWARD_POINTS[reason] || !ref_id) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const points = REWARD_POINTS[reason]
  const { error } = await supabase.from('rewards').insert({ user_id: user.id, points, reason, ref_id })

  if (error) {
    if (error.code === '23505') {
      // Already rewarded for this exact action — treat as a harmless no-op
      return Response.json({ ok: true, points: 0, already: true })
    }
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ ok: true, points })
}
