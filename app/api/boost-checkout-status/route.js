import { getSessionUser, serviceClient as supabase } from '@/lib/auth'

const json = (body, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
export async function GET(request) {
  const user = await getSessionUser(request)
  if (!user) return json({ error: 'Unauthorized' }, 401)
  const designId = new URL(request.url).searchParams.get('designId')
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(designId || '')) return json({ error: 'Invalid design' }, 400)
  try {
    const { data: design, error: designError } = await supabase.from('designs').select('id')
      .eq('id', designId).eq('created_by', user.id).maybeSingle()
    if (designError) throw designError
    if (!design) return json({ error: 'Design not found' }, 404)
    const [{ data: states, error: statesError }, { data: receipts, error: receiptError }] = await Promise.all([
      supabase.from('payment_refund_states').select('status').eq('user_id', user.id).eq('kind', 'boost').eq('target_id', designId),
      supabase.from('order_payments').select('needs_review').eq('user_id', user.id).eq('kind', 'boost').eq('target_id', designId),
    ])
    if (statesError || receiptError) throw statesError || receiptError
    const status = states?.some(state => state.status === 'payment_review') || receipts?.some(receipt => receipt.needs_review) ? 'payment_review'
      : states?.some(state => state.status === 'refund_pending') ? 'refund_pending'
      : states?.some(state => ['refunded', 'partially_refunded'].includes(state.status)) ? 'refund_recorded' : 'none'
    return json({ status })
  } catch { return json({ error: 'Unable to confirm boost payment' }, 503) }
}
