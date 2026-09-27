import { stripeId } from '@/lib/subscription-plans'

export async function recordDepositRefund(supabase, refund, eventCreated) {
  const { error } = await supabase.rpc('record_deposit_refund', {
    p_intent: stripeId(refund.payment_intent), p_refund_id: refund.id,
    p_status: refund.status, p_created: eventCreated,
  })
  if (error) throw error
}

export async function refundLateDeposit(supabase, stripe, intentId, eventCreated) {
  const { data: receipt, error } = await supabase.from('order_payments')
    .select('refund_required,refund_id,refund_status,target_id').eq('payment_intent', intentId).single()
  if (error || !receipt) throw error || new Error('Payment receipt unavailable')
  if (!receipt.refund_required || ['succeeded','failed','canceled'].includes(receipt.refund_status)) return

  let refund
  if (receipt.refund_id) {
    refund = await stripe.refunds.retrieve(receipt.refund_id)
  } else {
    // Recover an accepted refund even if its DB write failed and Stripe's
    // idempotency cache has since expired. Never invent another refund key.
    const existing = await stripe.refunds.list({ payment_intent: intentId, limit: 100 })
    if (existing.has_more) throw new Error('Refund history requires reconciliation')
    refund = existing.data.find(item => item.metadata?.type === 'late_deposit' && item.metadata.bookingId === receipt.target_id)
    if (!refund) {
      refund = await stripe.refunds.create({
        payment_intent: intentId,
        metadata: { type: 'late_deposit', bookingId: receipt.target_id },
      }, { idempotencyKey: `late-deposit-${intentId}` })
    }
  }
  if (stripeId(refund.payment_intent) !== intentId) throw new Error('Refund payment mismatch')
  await recordDepositRefund(supabase, refund, eventCreated)
}
