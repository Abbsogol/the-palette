import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

export async function POST(request) {
  const user = await getSessionUser(request)
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { code } = await request.json().catch(() => ({}))
  if (typeof code !== 'string' || !code.trim()) return Response.json({ error: 'Missing fields' }, { status: 400 })

  const upperCode = code.toUpperCase().trim().slice(0, 20)

  const { data: result, error } = await supabase.rpc('apply_referral', { p_user_id: user.id, p_code: upperCode })
  if (error) {
    console.error('apply-referral transaction error:', error)
    return Response.json({ error: 'Failed to apply referral. Please retry.' }, { status: 500 })
  }
  const failures = { invalid: [404, 'Invalid code'], self: [400, 'Cannot refer yourself'], already_referred: [409, 'Already referred'] }
  if (Object.hasOwn(failures, result)) {
    const [status, message] = failures[result]
    return Response.json({ error: message }, { status })
  }
  if (result !== 'applied') return Response.json({ error: 'Referral could not be confirmed' }, { status: 500 })
  return Response.json({ ok: true })
}
