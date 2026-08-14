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
        {depositPaid ? 'Deposit paid ✦' : checking ? 'Confirming your deposit…' : 'Still finalizing'}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 12px', maxWidth: '280px' }}>
        {depositPaid
          ? 'Your deposit has been received. Your appointment is confirmed — see you soon!'
          : checking
          ? 'This only takes a moment.'
          : "We're still waiting for confirmation from Stripe — this can take a minute."}
      </p>

      {timedOut && !depositPaid && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 24px' }}>
          <a onClick={() => window.location.reload()} style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}>Refresh</a> to check again, or view your appointment for the latest status.
        </p>
      )}

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
