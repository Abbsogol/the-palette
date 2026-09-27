import { getSessionUser, serviceClient as supabase } from '@/lib/auth'
import { generationIdPattern, generationResult } from '@/lib/generation-result'

export async function GET(request) {
  const user = await getSessionUser(request)
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })
  try {
    const requestId = new URL(request.url).searchParams.get('requestId')
    if (requestId && !generationIdPattern.test(requestId)) return Response.json({ error: 'Invalid request id' }, { status: 400 })
    const { error } = await supabase.rpc('recover_generations', { p_user_id: user.id })
    if (error) throw error
    const headers = { 'Cache-Control': 'no-store' }
    if (requestId) {
      const { data: reservation, error: readError } = await supabase.from('generation_reservations')
        .select('status').eq('id', requestId).eq('user_id', user.id).maybeSingle()
      if (readError) throw readError
      if (!reservation) return Response.json({ error: 'Generation not found' }, { status: 404, headers })
      if (reservation.status === 'completed') return Response.json({ status: 'completed', ...await generationResult(user.id, requestId) }, { headers })
      return Response.json({ status: reservation.status }, { headers })
    }
    const { data, error: balanceError } = await supabase.from('profiles_data').select('credit_balance').eq('id', user.id).single()
    if (balanceError || !data) throw new Error('Balance unavailable')
    return Response.json({ creditsRemaining: data.credit_balance }, { headers })
  } catch {
    return Response.json({ error: 'Could not check generation status. Please try again.' }, { status: 503 })
  }
}
