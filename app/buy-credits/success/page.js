'use client'

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import CheckoutSession from '@/components/CheckoutSession';





const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 8 // ~12s of polling, on top of the immediate first read

function CheckoutResult({sessionId,userId}) {
const [outcome, setOutcome] = useState('pending')
const [heading, description] = {
    fulfilled: ['Credits added ✦', 'Your purchase is recorded. Head to Nail Lab and start creating.'],
    refund_recorded: ['Refund recorded', 'This purchase has a refund recorded. Your current credit balance is shown below.'],
    refund_pending: ['Refund in progress', 'Your refund is still being processed. Your current credit balance is shown below.'],
    payment_review: ['Payment needs review', 'Your refund needs attention. Please contact support before starting a replacement purchase.'],
    failed: ['Payment failed', 'Your payment did not complete. You can try again.'],
    expired: ['Checkout expired', 'This checkout expired. Start a new checkout when you are ready.'],
    pending: ['Confirming your purchase', 'Waiting for payment and credit confirmation.'],
  }[outcome]

  const searchParams = useSearchParams()

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

  return (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px calc(env(safe-area-inset-bottom) + 120px)', textAlign: 'center' }}>
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(255,81,127,0.15)', border: '1px solid rgba(255,81,127,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>

        <h1 style={{ ...display(26), margin: '0 0 8px' }}>{heading}</h1>

        <p style={{ ...ui(300, 14, WHITE60), lineHeight: 1.6, margin: '0 0 28px', maxWidth: '280px' }}>
          {description}
        </p>

        {creditBalance !== null && (
          <div style={{ background: PANEL, borderRadius: '16px', border: PANEL_BORDER, padding: '16px 28px', marginBottom: checking || timedOut ? '12px' : '32px' }}>
            <p style={{ ...ui(500, 11, WHITE60), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>New balance</p>
            <p style={{ ...display(36), color: ACCENT, margin: 0 }}>{creditBalance}</p>
            <p style={{ ...ui(300, 12, WHITE60), margin: '2px 0 0' }}>credits</p>
          </div>
        )}

        {checking && (
          <p style={{ ...ui(300, 12, WHITE60), margin: '0 0 32px' }}>Confirming your balance…</p>
        )}

        {timedOut && (
          <p style={{ ...ui(300, 12, WHITE60), margin: '0 0 32px' }}>
            Still finalizing — <a onClick={() => window.location.reload()} style={{ color: ACCENT, cursor: 'pointer', textDecoration: 'underline' }}>refresh</a> if this doesn&apos;t look right in a moment.
          </p>
        )}

        <Link href="/nail-lab" style={{ background: BTN_GRADIENT, color: 'var(--lq-white)', borderRadius: '1000px', padding: '14px 32px', ...ui(600, 15), textDecoration: 'none', display: 'inline-block', marginBottom: '16px' }}>
          Open Nail Lab
        </Link>

        <Link href="/profile" style={{ ...ui(400, 13, WHITE60), textDecoration: 'none' }}>
          Back to profile
        </Link>
      </div>
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

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  return <CheckoutSession>{userId => <CheckoutResult key={sessionId || 'none'} sessionId={sessionId} userId={userId} />}</CheckoutSession>
}
