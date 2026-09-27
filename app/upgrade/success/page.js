'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import CheckoutSession from '@/components/CheckoutSession'

const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 8 // ~12s of polling, on top of the immediate first read

function SuccessContent() {
  const params = useSearchParams()
  const sessionId = params.get('session_id')
  return <CheckoutSession>{userId => <SubscriptionResult key={sessionId || 'none'} sessionId={sessionId} userId={userId} />}</CheckoutSession>
}

function SubscriptionResult({ sessionId, userId }) {
  const [outcome, setOutcome] = useState(null)
  const current = outcome?.sessionId === sessionId ? outcome : null
  const confirmed = current?.status === 'fulfilled'
  const isPro = current?.planId === 'pro_creator'
  const checking = !!sessionId && !current
  const timedOut = !sessionId || current?.status === 'pending'
  const terminal = {
    expired: ['Checkout expired', 'This checkout expired. You can start a new subscription checkout.'],
    failed: ['Subscription payment failed', 'This subscription did not activate. You can try a new checkout.'],
    canceled: ['Subscription canceled', 'This subscription is canceled. You can choose a plan again.'],
    payment_required: ['Subscription needs attention', 'Your subscription is not currently active. Open your profile to manage billing and resolve the payment or paused subscription.'],
  }[current?.status]

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
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      {/* Success icon */}
      <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(212,160,192,0.15)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M8 16l5 5 11-10" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h1 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '700', margin: '0 0 10px' }}>
        {confirmed ? `Welcome to ${isPro ? 'Pro Creator' : 'Laque Premium'} ✦` : terminal?.[0] || 'Subscription checkout'}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6', margin: '0 0 12px', maxWidth: '300px' }}>
        {confirmed ? isPro
          ? 'Your Pro Creator subscription is now active. Start accepting bookings and publishing your designs.'
          : 'Your Premium subscription is now active. Enjoy exclusive designs and credits every month.'
          : terminal?.[1] || 'We will confirm your plan once payment and activation are recorded.'}
      </p>

      {checking && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 24px' }}>Confirming your subscription…</p>
      )}
      {timedOut && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 24px' }}>
          Still finalizing — <a onClick={() => window.location.reload()} style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}>refresh</a> if this doesn&apos;t look right in a moment.
        </p>
      )}
      {confirmed && (
        <p style={{ color: 'var(--accent)', fontSize: '12px', margin: '0 0 24px' }}>✓ Subscription confirmed</p>
      )}

      {['expired','failed','canceled'].includes(current?.status) && (
        <Link href="/upgrade" style={{ color: 'var(--accent)', marginBottom: '24px' }}>Choose a plan</Link>
      )}

      <Link
        href="/profile"
        style={{ background: 'var(--accent)', color: '#2C0A1E', textDecoration: 'none', borderRadius: '14px', padding: '14px 32px', fontSize: '15px', fontWeight: '700', display: 'inline-block' }}
      >
        Go to my profile
      </Link>
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
