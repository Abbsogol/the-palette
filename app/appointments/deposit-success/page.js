'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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

function DepositSuccessContent() {
  const params = useSearchParams()
  const bookingId = params.get('booking')
  const [depositPaid, setDepositPaid] = useState(null)
  const [checking, setChecking] = useState(true)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!bookingId) { setChecking(false); setTimedOut(true); return }

    let cancelled = false
    let timeoutId
    let attempts = 0

    const fetchPaid = async () => {
      const { data: booking } = await supabase
        .from('bookings')
        .select('deposit_paid')
        .eq('id', bookingId)
        .maybeSingle()
      return booking ? !!booking.deposit_paid : null
    }

    // Same shape as buy-credits/success: the redirect back from Stripe can
    // arrive before or after the webhook actually writes deposit_paid, so
    // this poll handles the race in either direction instead of trusting
    // the URL alone.
    const tick = async () => {
      const paid = await fetchPaid()
      if (cancelled) return
      attempts += 1

      if (paid) { setDepositPaid(true); setChecking(false); return }
      if (attempts >= MAX_POLL_ATTEMPTS) { setChecking(false); setTimedOut(true); return }
      timeoutId = setTimeout(tick, POLL_INTERVAL_MS)
    }

    tick()
    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [bookingId])

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
          {depositPaid ? 'Deposit paid ✦' : checking ? 'Confirming your deposit…' : 'Still finalizing'}
        </h1>
        <p style={{ ...ui(300, 14, WHITE60), lineHeight: 1.6, margin: '0 0 12px', maxWidth: '280px' }}>
          {depositPaid
            ? 'Your deposit has been received. Your appointment is confirmed — see you soon!'
            : checking
            ? 'This only takes a moment.'
            : "We're still waiting for confirmation from Stripe — this can take a minute."}
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
