import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const { timeZone, schedule } = await request.json()
    if (typeof timeZone !== 'string' || !Array.isArray(schedule)) return Response.json({ error: 'Choose your time zone and working hours.' }, { status: 400 })
    const { error } = await supabase.rpc('save_creator_availability', { p_user_id: user.id, p_time_zone: timeZone, p_schedule: schedule })
    if (error) {
      if (error.message?.includes('CREATOR_REQUIRED')) return Response.json({ error: 'A creator account is required.' }, { status: 403 })
      if (/INVALID_|date\/time|time zone|out of range|invalid input/i.test(error.message || '')) return Response.json({ error: 'Check your time zone and working hours. Closing time must be after opening time.' }, { status: 400 })
      throw error
    }
    return Response.json({ ok: true })
  } catch { return Response.json({ error: 'Availability could not be saved. Please retry.' }, { status: 503 }) }
}
