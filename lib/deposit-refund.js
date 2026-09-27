import { stripeId } from '@/lib/subscription-plans'

// All refunds for a payment contribute to the outcome, including those made
// manually. A successful refund of only the remainder is not proof that an
// earlier pending refund has reached the customer.
function refundTotals(refunds, intentId, currency, amount) {
  let succeeded = 0, pending = 0, failed = false, requiresAction = false
  const ids = new Set()
  for (const refund of refunds) {
    if (!refund.id || ids.has(refund.id) || stripeId(refund.payment_intent) !== intentId ||
        refund.currency !== currency || !Number.isSafeInteger(refund.amount) || refund.amount <= 0 ||
        !['pending', 'requires_action', 'succeeded', 'failed', 'canceled'].includes(refund.status)) {
      throw new Error('Refund history is invalid')
    }
    ids.add(refund.id)
    if (refund.status === 'succeeded') succeeded += refund.amount
    else if (['pending', 'requires_action'].includes(refund.status)) pending += refund.amount
    else failed = true
    if (refund.status === 'requires_action') requiresAction = true
  }
  if (!Number.isSafeInteger(succeeded + pending) || succeeded + pending > amount) throw new Error('Refund amounts exceed payment')
  return { succeeded, pending, failed, requiresAction }
}

export async function readPaymentRefunds(stripe, intent, expectedRefund) {
  const expectedRefundId = stripeId(expectedRefund)
  const amount = intent.amount_received
  if (!intent.id || !Number.isSafeInteger(amount) || amount <= 0 || typeof intent.currency !== 'string') {
    throw new Error('Captured payment amount is unavailable')
  }
  const refunds = [], ids = new Set()
  let cursor
  // Bound webhook work. An exceptionally large history stays in review rather
  // than being silently truncated or making a refund from incomplete totals.
  for (let pageNumber = 0; pageNumber < 20; pageNumber++) {
    const page = await stripe.refunds.list({ payment_intent: intent.id, limit: 100, ...(cursor ? { starting_after: cursor } : {}) })
    if (!Array.isArray(page.data) || typeof page.has_more !== 'boolean' || page.data.length > 100) throw new Error('Refund history is invalid')
    for (const refund of page.data) {
      if (!refund.id || ids.has(refund.id)) throw new Error('Refund pagination did not advance')
      ids.add(refund.id); refunds.push(refund)
    }
    if (!page.has_more) {
      if (expectedRefundId && !ids.has(expectedRefundId)) throw new Error('Incoming refund is missing from provider history')
      if (expectedRefund && typeof expectedRefund !== 'string') {
        const listed = refunds.find(refund => refund.id === expectedRefundId)
        // Independent provider reads can disagree while a refund changes. Do
        // not acknowledge a failed refund using an older successful listing.
        if (!listed || ['amount', 'currency', 'status'].some(key => listed[key] !== expectedRefund[key])) {
          throw new Error('Incoming refund conflicts with provider history')
        }
      }
      return { amount, refunds, totals: refundTotals(refunds, intent.id, intent.currency, amount) }
    }
    if (!page.data.length) throw new Error('Refund pagination did not advance')
    cursor = page.data.at(-1).id
  }
  throw new Error('Refund history exceeds reconciliation limit')
}

// Used by every refund event, not only refunds created by this application.
// An unrelated payment has no late-deposit obligation and is a safe no-op.
export async function reconcileLateDepositRefund(supabase, stripe, intentId, eventCreated, expectedRefund) {
  if (!intentId) throw new Error('Refund payment identity missing')
  const { data: receipt, error } = await supabase.from('order_payments')
    .select('refund_required,target_id').eq('payment_intent', intentId).maybeSingle()
  if (error) throw error
  if (!receipt?.refund_required) return false
  const { data: token, error: claimError } = await supabase.rpc('claim_deposit_refund_check', { p_intent: intentId })
  if (claimError) throw claimError
  // A newer refund event must retry after the active reader finishes; that
  // reader may have captured a snapshot from before the newer state existed.
  if (!token) throw new Error('Refund reconciliation is already in progress')
  try {
    const intent = await stripe.paymentIntents.retrieve(intentId)
    if (intent.id !== intentId) throw new Error('Deposit identity mismatch')
    const readRefunds = refundId => readPaymentRefunds(stripe, intent, refundId || expectedRefund)
    let state = await readRefunds()
    const { amount } = state
    if (state.totals.succeeded + state.totals.pending < amount && !state.totals.failed && !state.totals.requiresAction) {
      let createError, createdRefund
      try {
        createdRefund = await stripe.refunds.create({ payment_intent: intentId, metadata: { type: 'late_deposit', bookingId: receipt.target_id } },
          { idempotencyKey: `late-deposit-${intentId}` })
      } catch (error) { createError = error }
      // A manual refund can race this request, and an accepted create can lose
      // its response. Read back the actual cumulative outcome before retrying.
      state = await readRefunds(createdRefund?.id)
      if (createError && state.totals.succeeded + state.totals.pending < amount) throw createError
    }
    const { succeeded, pending, failed, requiresAction } = state.totals
    const representative = state.refunds.find(refund => refund.metadata?.type === 'late_deposit') || state.refunds[0]
    const { data: saved, error: saveError } = await supabase.rpc('finish_deposit_refund_check', {
      p_intent: intentId, p_token: token, p_amount: amount, p_succeeded: succeeded, p_pending: pending,
      p_failed: failed, p_requires_action: requiresAction, p_refund_id: representative?.id || null, p_created: eventCreated,
    })
    if (saveError || !saved) throw saveError || new Error('Refund reconciliation lease expired')
    return true
  } finally {
    const { error: releaseError } = await supabase.rpc('release_deposit_refund_check', { p_intent: intentId, p_token: token })
    if (releaseError) throw releaseError
  }
}

export async function refundLateDeposit(supabase, stripe, intentId, eventCreated) {
  return reconcileLateDepositRefund(supabase, stripe, intentId, eventCreated)
}
