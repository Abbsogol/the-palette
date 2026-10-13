'use client'

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import CheckoutSession from '@/components/CheckoutSession';





const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 8 // ~12s of polling, on top of the immediate first read

function SubscriptionResult({sessionId,userId}) {
const [outcome, setOutcome] = useState(null)
const current = outcome?.sessionId === sessionId ? outcome : null
const confirmed = current?.status === 'fulfilled'
const checking = !!sessionId && !current
const timedOut = !sessionId || current?.status === 'pending'
const terminal = {
    expired: ['Checkout expired', 'This checkout expired. You can start a new subscription checkout.'],
    failed: ['Subscription payment failed', 'This subscription did not activate. You can try a new checkout.'],
    canceled: ['Subscription canceled', 'This subscription is canceled. You can choose a plan again.'],
    payment_required: ['Subscription needs attention', 'Your subscription is not currently active. Open your profile to manage billing and resolve the payment or paused subscription.'],
  }[current?.status]

  const params = useSearchParams()
  const plan = params.get('plan')

  const isPro = current?.planId === 'pro_creator'




  useEffect(() => {
    if (!sessionId) return

    let cancelled = false
    let timeoutId
    let attempts = 0

    const tick = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled) return
        if (!session || session.user?.id !== userId) { setOutcome({ sessionId, status: 'pending' }); return }
        const response = await fetch(`/api/subscription-checkout-status?session_id=${encodeURIComponent(sessionId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        })
        const result = await response.json()
        if (cancelled) return
        if (response.ok && result.status === 'fulfilled' && ['premium','pro_creator'].includes(result.planId)) {
          setOutcome({ sessionId, status: 'fulfilled', planId: result.planId })
          return
        }
        if (response.ok && ['expired','failed','canceled','payment_required'].includes(result.status)) {
          setOutcome({ sessionId, status: result.status })
          return
        }
      } catch { /* A failed status read cannot confirm a subscription. */ }
      if (cancelled) return
      attempts += 1
      if (attempts >= MAX_POLL_ATTEMPTS) { setOutcome({ sessionId, status: 'pending' }); return }
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
        {/* Success icon */}
        <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(255,81,127,0.15)', border: `1.5px solid ${ACCENT}`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <path d="M8 16l5 5 11-10" stroke={ACCENT} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>

        <h1 style={{ ...display(26), margin: '0 0 10px' }}>
          {confirmed ? `Welcome to ${isPro ? 'Pro Creator' : 'Laque Premium'} ✦` : terminal?.[0] || 'Subscription checkout'}
        </h1>
        <p style={{ ...ui(300, 15, WHITE60), lineHeight: 1.6, margin: '0 0 12px', maxWidth: '300px' }}>
          {terminal?.[1] || (!confirmed ? 'Waiting for verified subscription confirmation.' : isPro
            ? 'Your Pro Creator subscription is now active. Start accepting bookings and publishing your designs.'
            : 'Your Premium subscription is now active. Enjoy exclusive designs and credits every month.')}
        </p>

        {checking && (
          <p style={{ ...ui(300, 12, WHITE60), margin: '0 0 24px' }}>Confirming your subscription…</p>
        )}
        {timedOut && (
          <p style={{ ...ui(300, 12, WHITE60), margin: '0 0 24px' }}>
            Still finalizing — <a onClick={() => window.location.reload()} style={{ color: ACCENT, cursor: 'pointer', textDecoration: 'underline' }}>refresh</a> if this doesn&apos;t look right in a moment.
          </p>
        )}
        {confirmed && (
          <p style={{ ...ui(500, 12, ACCENT), margin: '0 0 24px' }}>✓ Subscription confirmed</p>
        )}

        {terminal && <Link href="/upgrade" style={{ ...ui(500, 14, ACCENT), marginBottom: '16px' }}>Choose a plan</Link>}
        <Link
          href="/profile"
          style={{ background: BTN_GRADIENT, color: 'var(--lq-white)', textDecoration: 'none', borderRadius: '1000px', padding: '14px 32px', ...ui(600, 15), display: 'inline-block' }}
        >
          Go to my profile
        </Link>
      </div>
    </div>
  )
}

export default function UpgradeSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  )
}

function SuccessContent() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  return <CheckoutSession>{userId => <SubscriptionResult key={sessionId || 'none'} sessionId={sessionId} userId={userId} />}</CheckoutSession>
}
