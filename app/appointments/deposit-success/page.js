'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 8 // ~12s of polling, on top of the immediate first read

function DepositSuccessContent() {
  const params = useSearchParams()
  const bookingId = params.get('booking')
  const sessionId = params.get('session_id')
  const [paymentStatus, setPaymentStatus] = useState('pending')
  const depositPaid = paymentStatus === 'fulfilled'
  const refundOutcome = {
    failed: ['Deposit payment failed', 'Your payment did not complete. You can try again from your appointment.'],
    expired: ['Checkout expired', 'This checkout expired. Open your appointment to try again.'],
    refund_pending: ['Refund in progress', 'This booking was cancelled or declined. Your deposit is being refunded automatically.'],
    refunded: ['Deposit refunded', 'Your deposit refund has been processed. Your bank may take time to display it.'],
    refund_failed: ['Refund needs attention', 'Your refund could not be completed automatically. Please contact support.'],
    payment_review: ['Payment needs review', 'Your payment is recorded and needs review. Please contact support.'],
  }[paymentStatus]
  const [polling, setChecking] = useState(true)
  const checking = !!bookingId && polling
  const [pollTimedOut, setTimedOut] = useState(false)
  const timedOut = !bookingId || pollTimedOut

  useEffect(() => {
    if (!bookingId) return

    let cancelled = false
    let timeoutId
    let attempts = 0

    const fetchStatus = async () => {
      const { data:{ session } } = await supabase.auth.getSession()
      if (!session?.access_token) return 'pending'
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

      if (['failed','expired','fulfilled','refund_pending','refunded','refund_failed','payment_review'].includes(status)) {
        setPaymentStatus(status)
        if (status !== 'refund_pending') { setChecking(false); return }
      }
      if (attempts >= MAX_POLL_ATTEMPTS) { setChecking(false); setTimedOut(true); return }
      timeoutId = setTimeout(tick, POLL_INTERVAL_MS)
    }

    tick()
    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [bookingId, sessionId])

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-primary)',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      textAlign: 'center',
    }}>

      {/* Icon */}
      <div style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: depositPaid ? 'rgba(100,200,130,0.12)' : 'rgba(212,160,192,0.15)',
        border: depositPaid ? '1px solid rgba(100,200,130,0.3)' : '1px solid rgba(212,160,192,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '24px',
      }}>
        {depositPaid ? (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
            <path d="M5 13L9 17L19 7" stroke="#6CC882" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
          </svg>
        )}
      </div>

      <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '600', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
        {refundOutcome ? refundOutcome[0] : depositPaid ? 'Deposit paid ✦' : checking ? 'Confirming your deposit…' : 'Still finalizing'}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 12px', maxWidth: '280px' }}>
        {refundOutcome ? refundOutcome[1] : depositPaid
          ? 'Your deposit has been received. View your appointment for its booking status.'
          : checking
          ? 'This only takes a moment.'
          : "We're still waiting for confirmation from Stripe — this can take a minute."}
      </p>

      {timedOut && !depositPaid && !refundOutcome && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 24px' }}>
          <a onClick={() => window.location.reload()} style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}>Refresh</a> to check again, or view your appointment for the latest status.
        </p>
      )}

      {['refund_failed','payment_review'].includes(paymentStatus) && <Link href="/help" style={{ color:'var(--accent)' }}>Contact support</Link>}

      <Link
        href="/appointments"
        style={{
          background: 'var(--accent)', color: '#2C0A1E',
          borderRadius: '14px', padding: '13px 32px',
          fontSize: '15px', fontWeight: '600',
          textDecoration: 'none', display: 'inline-block',
          marginTop: timedOut && !depositPaid ? 0 : '24px',
        }}
      >
        View my appointments
      </Link>
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
