import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

const json = (body, status = 200) => Response.json(body, { status, headers: { 'cache-control':'no-store' } })
export async function GET(request) {
  const user = await getSessionUser(request)
  if (!user) return json({ error:'Unauthorized' }, 401)
  const params = new URL(request.url).searchParams
  const bookingId = params.get('booking')
  const sessionId = params.get('session_id')
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(bookingId || '')) return json({ error:'Invalid booking' }, 400)
  try {
    const { data:booking, error:bookingError } = await supabase.from('bookings')
      .select('deposit_paid').eq('id',bookingId).eq('client_id',user.id).maybeSingle()
    if (bookingError) throw bookingError
    if (!booking) return json({ error:'Booking not found' }, 404)
    let query = supabase.from('order_payments').select('refund_required,refund_status,refunded,needs_review,fulfilled,created_at')
      .eq('user_id',user.id).eq('kind','deposit').eq('target_id',bookingId)
    if (sessionId) query = query.eq('session_id',sessionId)
    const { data:receipts, error } = await query
    if (error) throw error
    const receipt = receipts?.sort((a,b) => new Date(b.created_at)-new Date(a.created_at))[0]
    if (receipt?.refund_required) {
      const status = receipt.refund_status === 'succeeded' ? 'refunded'
        : ['failed','canceled','requires_action'].includes(receipt.refund_status) ? 'refund_failed' : 'refund_pending'
      return json({ status })
    }
    if (receipt?.refunded) return json({ status:'refunded' })
    if (receipt?.needs_review) return json({ status:'payment_review' })
    if (sessionId && !receipt?.fulfilled) {
      const { data: failure, error: failureError } = await supabase.from('checkout_failures').select('status')
        .eq('session_id',sessionId).eq('user_id',user.id).eq('kind','deposit').eq('target_id',bookingId).maybeSingle()
      if (failureError) throw failureError
      if (failure) return json({ status:failure.status })
    }
    return json({ status:booking.deposit_paid && (receipt?.fulfilled || !sessionId) ? 'fulfilled' : 'pending' })
  } catch { return json({ error:'Unable to confirm deposit' }, 503) }
}
