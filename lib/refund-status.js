import { readPaymentRefunds } from '@/lib/deposit-refund'

function paymentIdentity(intent) {
  const metadata = intent.metadata || {}
  const kind = metadata.type
  if (!['credits', 'boost', 'deposit'].includes(kind)) return null
  const userId = kind === 'boost' ? metadata.creatorId : metadata.userId
  const targetId = kind === 'boost' ? metadata.designId : kind === 'deposit' ? metadata.bookingId : null
  const units = kind === 'credits' ? Number(metadata.credits) : kind === 'boost' ? Number(metadata.days) : 0
  if (!userId || !Number.isSafeInteger(units) || (kind === 'credits' && units <= 0) ||
      (kind === 'boost' && ![1, 3, 7].includes(units)) || (kind !== 'credits' && !targetId)) throw new Error('Refund payment metadata invalid')
  return { userId, targetId, kind, units }
}

async function recordedPaymentIdentity(supabase, intentId) {
  // The accepted payment's ownership survives mutable Stripe metadata. The
  // pre-read review marker usually created this row already; the other ledgers
  // also support reconciliation invoked directly before that marker exists.
  for (const table of ['payment_refund_states', 'order_payments', 'credit_payments']) {
    const { data, error } = await supabase.from(table)
      .select(table === 'credit_payments' ? 'user_id,credits' : 'user_id,kind,target_id,units')
      .eq('payment_intent', intentId).maybeSingle()
    if (error) throw error
    if (data) return table === 'credit_payments'
      ? { userId: data.user_id, kind: 'credits', targetId: null, units: data.credits }
      : { userId: data.user_id, kind: data.kind, targetId: data.target_id, units: data.units }
  }
  return null
}

function verifyPresentMetadata(intent, identity) {
  const metadata = intent.metadata || {}
  const fields = { type: identity.kind,
    [identity.kind === 'boost' ? 'creatorId' : 'userId']: identity.userId }
  if (identity.kind === 'boost') fields.designId = identity.targetId
  if (identity.kind === 'deposit') fields.bookingId = identity.targetId
  for (const [key, value] of Object.entries(fields)) {
    if (metadata[key] && metadata[key] !== value) throw new Error('Refund payment identity changed')
  }
  const unitKey = identity.kind === 'credits' ? 'credits' : identity.kind === 'boost' ? 'days' : null
  if (unitKey && metadata[unitKey] && Number(metadata[unitKey]) !== identity.units) throw new Error('Refund payment identity changed')
}

export async function reconcilePaymentRefund(supabase, stripe, intent, eventId, expectedRefund) {
  const identity = await recordedPaymentIdentity(supabase, intent.id) || paymentIdentity(intent)
  if (!identity) return false
  verifyPresentMetadata(intent, identity)
  const { data: token, error: claimError } = await supabase.rpc('claim_payment_refund_check', {
    p_intent: intent.id, p_user_id: identity.userId, p_kind: identity.kind, p_target_id: identity.targetId, p_units: identity.units,
  })
  if (claimError) throw claimError
  if (!token) throw new Error('Payment refund reconciliation is already in progress')
  try {
    // Read under the lease. A delayed event must use today's provider state,
    // while another worker with an older snapshot must retry after this one.
    const current = await stripe.paymentIntents.retrieve(intent.id)
    if (current.id !== intent.id) throw new Error('Refund payment identity changed')
    verifyPresentMetadata(current, identity)
    const { amount, totals } = await readPaymentRefunds(stripe, current, expectedRefund)
    const { data: saved, error: saveError } = await supabase.rpc('finish_payment_refund_check', {
      p_intent: current.id, p_token: token, p_amount: amount, p_succeeded: totals.succeeded, p_pending: totals.pending,
      p_failed: totals.failed, p_requires_action: totals.requiresAction, p_event_id: eventId,
    })
    if (saveError || !saved) throw saveError || new Error('Payment refund reconciliation lease expired')
    return true
  } finally {
    const { error } = await supabase.rpc('release_payment_refund_check', { p_intent: intent.id, p_token: token })
    if (error) throw error
  }
}
