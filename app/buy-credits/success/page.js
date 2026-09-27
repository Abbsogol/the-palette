'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import CheckoutSession from '@/components/CheckoutSession'

const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 8 // ~12s of polling, on top of the immediate first read

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  return <CheckoutSession>{userId => <CheckoutResult key={sessionId || 'none'} sessionId={sessionId} userId={userId} />}</CheckoutSession>
}

function CheckoutResult({ sessionId, userId }) {
  const [outcome, setOutcome] = useState('pending')
  const [creditBalance, setCreditBalance] = useState(null)
  const [checking, setChecking] = useState(true)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    let cancelled = false
    let timeoutId
    let attempts = 0
    const tick = async () => {
      attempts += 1
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (!sessionId || !session || session.user?.id !== userId) throw new Error('Sign in to confirm this checkout')
        const response = await fetch(`/api/credit-checkout-status?session_id=${encodeURIComponent(sessionId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
        })
        const result = await response.json()
        if (cancelled) return
        if (!response.ok) throw new Error(result.error || 'Unable to confirm checkout')
        if (['fulfilled','refund_recorded','refund_pending','payment_review','failed','expired'].includes(result.status)) {
          setOutcome(result.status)
          setCreditBalance(result.creditBalance ?? null)
          setChecking(false)
          return
        }
      } catch {
        if (cancelled) return
      }
      if (attempts >= MAX_POLL_ATTEMPTS) { setChecking(false); setTimedOut(true); return }
      timeoutId = setTimeout(tick, POLL_INTERVAL_MS)
    }

    tick()
    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [sessionId, userId])

  const [heading, description] = {
    fulfilled: ['Credits added ✦', 'Your purchase is recorded. Head to Nail Lab and start creating.'],
    refund_recorded: ['Refund recorded', 'This purchase has a refund recorded. Your current credit balance is shown below.'],
    refund_pending: ['Refund in progress', 'Your refund is still being processed. Your current credit balance is shown below.'],
    payment_review: ['Payment needs review', 'Your refund needs attention. Please contact support before starting a replacement purchase.'],
    failed: ['Payment failed', 'Your payment did not complete. You can try again.'],
    expired: ['Checkout expired', 'This checkout expired. Start a new checkout when you are ready.'],
    pending: ['Confirming your purchase', 'Waiting for payment and credit confirmation.'],
  }[outcome]
  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-primary)',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      textAlign: 'center',
    }}>
      <div style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: 'rgba(212,160,192,0.15)',
        border: '1px solid rgba(212,160,192,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '24px',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {outcome === 'fulfilled' ? <polyline points="20 6 9 17 4 12"/> : <circle cx="12" cy="12" r="9"/>}
        </svg>
      </div>

      <h1 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '600', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        {heading}
      </h1>

      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 28px', maxWidth: '280px' }}>
        {description}
      </p>

      {creditBalance !== null && (
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '14px',
          border: '0.5px solid var(--border)',
          padding: '16px 28px',
          marginBottom: checking || timedOut ? '12px' : '32px',
        }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>Current balance</p>
          <p style={{ color: 'var(--accent)', fontSize: '36px', fontWeight: '700', margin: 0, letterSpacing: '-0.03em' }}>{creditBalance}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '2px 0 0' }}>credits</p>
        </div>
      )}

      {checking && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 32px' }}>Confirming your balance…</p>
      )}

      {timedOut && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 32px' }}>
          Still finalizing — <a onClick={() => window.location.reload()} style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}>refresh</a> if this doesn&apos;t look right in a moment.
        </p>
      )}

      <Link href={['failed','expired'].includes(outcome) ? '/buy-credits' : '/nail-lab'} style={{
        background: 'var(--accent)',
        color: '#2C0A1E',
        borderRadius: '14px',
        padding: '14px 32px',
        fontSize: '15px',
        fontWeight: '600',
        textDecoration: 'none',
        fontFamily: "'DM Sans', sans-serif",
        display: 'inline-block',
        marginBottom: '16px',
      }}>
        {['failed','expired'].includes(outcome) ? 'Try checkout again' : 'Open Nail Lab'}
      </Link>

      <Link href="/profile" style={{ color: 'var(--text-secondary)', fontSize: '13px', textDecoration: 'none' }}>
        Back to profile
      </Link>
    </div>
  )
}

export default function BuyCreditsSuccessPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
