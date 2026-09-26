'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const POLL_INTERVAL_MS = 1500
const MAX_POLL_ATTEMPTS = 8 // ~12s of polling, on top of the immediate first read

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
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
        if (!sessionId || !session) throw new Error('Sign in to confirm this checkout')
        const response = await fetch(`/api/credit-checkout-status?session_id=${encodeURIComponent(sessionId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
        })
        const result = await response.json()
        if (cancelled) return
        if (!response.ok) throw new Error(result.error || 'Unable to confirm checkout')
        if (result.status === 'fulfilled') {
          setCreditBalance(result.creditBalance)
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
  }, [sessionId])

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
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>

      <h1 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '600', margin: '0 0 8px', letterSpacing: '-0.02em' }}>
        {creditBalance !== null ? 'Credits added ✦' : 'Confirming your purchase'}
      </h1>

      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 28px', maxWidth: '280px' }}>
        {creditBalance !== null ? 'Your purchase is recorded. Head to Nail Lab and start creating.' : 'Waiting for payment and credit confirmation.'}
      </p>

      {creditBalance !== null && (
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '14px',
          border: '0.5px solid var(--border)',
          padding: '16px 28px',
          marginBottom: checking || timedOut ? '12px' : '32px',
        }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>New balance</p>
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

      <Link href="/nail-lab" style={{
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
        Open Nail Lab
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
