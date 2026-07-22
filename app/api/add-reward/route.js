import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Point values per action
export const REWARD_POINTS = {
  save_design:    5,
  post_design:    10,
  leave_review:   15,
  book_appointment: 20,
}

export async function POST(request) {
  const { user_id, reason } = await request.json()
  if (!user_id || !reason || !REWARD_POINTS[reason]) {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }

  const points = REWARD_POINTS[reason]
  const { error } = await supabase.from('rewards').insert({ user_id, points, reason })
  if (error) return Response.json({ error: error.message }, { status: 500 })

  return Response.json({ ok: true, points })
}
