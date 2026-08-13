'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 8 // ~12s of polling, on top of the immediate first read

function SuccessContent() {
  const params = useSearchParams()
  const plan = params.get('plan')

  const isPro = plan === 'pro_creator'
  const [checking, setChecking] = useState(true)
  const [confirmed, setConfirmed] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    if (!plan) { setChecking(false); setTimedOut(true); return }

    let cancelled = false
    let timeoutId
    let attempts = 0

    const tick = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { if (!cancelled) { setChecking(false); setTimedOut(true) }; return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()
      if (cancelled) return
      attempts += 1

      if (profile?.subscription_tier === plan) {
        setConfirmed(true)
        setChecking(false)
        return
      }

      if (attempts >= MAX_POLL_ATTEMPTS) { setChecking(false); setTimedOut(true); return }
      timeoutId = setTimeout(tick, POLL_INTERVAL_MS)
    }

    tick()
    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [plan])

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      {/* Success icon */}
      <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(212,160,192,0.15)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M8 16l5 5 11-10" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h1 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '700', margin: '0 0 10px' }}>
        Welcome to {isPro ? 'Pro Creator' : 'Laque Premium'} ✦
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6', margin: '0 0 12px', maxWidth: '300px' }}>
        {isPro
          ? 'Your Pro Creator subscription is now active. Start accepting bookings and publishing your designs.'
          : 'Your Premium subscription is now active. Enjoy exclusive designs and credits every month.'}
      </p>

      {checking && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 24px' }}>Confirming your subscription…</p>
      )}
      {timedOut && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 24px' }}>
          Still finalizing — <a onClick={() => window.location.reload()} style={{ color: 'var(--accent)', cursor: 'pointer', textDecoration: 'underline' }}>refresh</a> if this doesn't look right in a moment.
        </p>
      )}
      {confirmed && (
        <p style={{ color: 'var(--accent)', fontSize: '12px', margin: '0 0 24px' }}>✓ Subscription confirmed</p>
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
