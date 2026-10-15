'use client'

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import CheckoutSession from '@/components/CheckoutSession';





const ACCENT = '#FF517F'
const GREEN = '#6CC882'
const WHITE60 = 'rgba(255,255,255,0.6)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 8 // ~12s of polling, on top of the immediate first read

function DepositResult({bookingId,sessionId,userId}) {
const [paymentStatus, setPaymentStatus] = useState('pending')
const depositPaid = paymentStatus === 'fulfilled'
const refundOutcome = {
    failed: ['Deposit payment failed', 'Your payment did not complete. You can try again from your appointment.'],
    expired: ['Checkout expired', 'This checkout expired. Open your appointment to try again.'],
    refund_pending: ['Refund in progress', 'Your deposit refund is still being processed. Refresh this page to check its status.'],
    refunded: ['Deposit refunded', 'Your deposit refund has been processed. Your bank may take time to display it.'],
    partial_refund: ['Partial refund recorded', 'Part of your deposit has been refunded. Contact support if you need help with the remaining amount.'],
    refund_failed: ['Refund needs attention', 'Your refund could not be completed automatically. Please contact support.'],
    payment_review: ['Payment needs review', 'Your payment is recorded and needs review. Please contact support.'],
  }[paymentStatus]
const [polling, setChecking] = useState(true)
const checking = !!bookingId && polling
const [pollTimedOut, setTimedOut] = useState(false)
const timedOut = !bookingId || pollTimedOut

  const params = useSearchParams()





  useEffect(() => {
    if (!bookingId) return

    let cancelled = false
    let timeoutId
    let attempts = 0

    const fetchStatus = async () => {
      const { data:{ session } } = await supabase.auth.getSession()
      if (cancelled || !session?.access_token || session.user?.id !== userId) return 'pending'
      const query = new URLSearchParams({ booking:bookingId })
      if (sessionId) query.set('session_id',sessionId)
      const response = await fetch(`/api/deposit-checkout-status?${query}`, { headers:{ Authorization:`Bearer ${session.access_token}` } })
      if (!response.ok) return 'pending'
      return (await response.json()).status
    }

    // Same shape as buy-credits/success: the redirect back from Stripe can
    // arrive before or after the webhook actually writes deposit_paid, so
    // this poll handles the race in either direction instead of trusting
    // the URL alone.
    const tick = async () => {
      const status = await fetchStatus().catch(() => 'pending')
      if (cancelled) return
      attempts += 1

      if (['failed','expired','fulfilled','refund_pending','refunded','partial_refund','refund_failed','payment_review'].includes(status)) {
        setPaymentStatus(status)
        if (status !== 'refund_pending') { setChecking(false); return }
      }
      if (attempts >= MAX_POLL_ATTEMPTS) { setChecking(false); setTimedOut(true); return }
      timeoutId = setTimeout(tick, POLL_INTERVAL_MS)
    }

    tick()
    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [bookingId, sessionId, userId])

  return (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '32px 24px calc(env(safe-area-inset-bottom) + 120px)', textAlign: 'center' }}>

        {/* Icon */}
        <div style={{
          width: '72px', height: '72px', borderRadius: '50%',
          background: depositPaid ? 'rgba(108,200,130,0.12)' : 'rgba(255,81,127,0.15)',
          border: depositPaid ? '1px solid rgba(108,200,130,0.3)' : '1px solid rgba(255,81,127,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px',
        }}>
          {depositPaid ? (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <path d="M5 13L9 17L19 7" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          ) : (
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
            </svg>
          )}
        </div>

        <h1 style={{ ...display(24), margin: '0 0 10px' }}>
          {refundOutcome?.[0] || (depositPaid ? 'Deposit paid ✦' : checking ? 'Confirming your deposit…' : 'Still finalizing')}
        </h1>
        <p style={{ ...ui(300, 14, WHITE60), lineHeight: 1.6, margin: '0 0 12px', maxWidth: '280px' }}>
          {refundOutcome?.[1] || (depositPaid
            ? 'Your deposit has been received. View your appointment for the creator’s confirmation status.'
            : checking
            ? 'This only takes a moment.'
            : "We're still waiting for confirmation from Stripe — this can take a minute.")}
        </p>

        {timedOut && !depositPaid && (
          <p style={{ ...ui(300, 12, WHITE60), margin: '0 0 24px' }}>
            <a onClick={() => window.location.reload()} style={{ color: ACCENT, cursor: 'pointer', textDecoration: 'underline' }}>Refresh</a> to check again, or view your appointment for the latest status.
          </p>
        )}

        <Link
          href="/appointments"
          style={{
            background: BTN_GRADIENT, color: 'var(--lq-white)',
            borderRadius: '1000px', padding: '13px 32px', ...ui(600, 15),
            textDecoration: 'none', display: 'inline-block',
            marginTop: timedOut && !depositPaid ? 0 : '24px',
          }}
        >
          View my appointments
        </Link>
      </div>
    </div>
  )
}

export default function DepositSuccessPage() {
  return (
    <Suspense>
      <DepositSuccessContent />
    </Suspense>
  )
}

function DepositSuccessContent() {
  const params = useSearchParams()
  const bookingId = params.get('booking')
  const sessionId = params.get('session_id')
  return <CheckoutSession>{userId => <DepositResult key={`${bookingId || 'none'}:${sessionId || 'none'}`} bookingId={bookingId} sessionId={sessionId} userId={userId} />}</CheckoutSession>
}
