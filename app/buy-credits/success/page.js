'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
    let lastValue // undefined until the first read

    const fetchBalance = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return null
      const { data: profile } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', user.id)
        .single()
      return profile ? profile.credit_balance : null
    }

    const tick = async () => {
      const balance = await fetchBalance()
      if (cancelled) return
      attempts += 1

      if (balance !== null) setCreditBalance(balance)

      // Settled once a read agrees with the previous one — handles both a
      // webhook that already landed (stable on the very first read) and one
      // that's still catching up (value changes, then stabilizes).
      const settled = balance !== null && balance === lastValue
      lastValue = balance

      if (settled) { setChecking(false); return }
      if (attempts >= MAX_POLL_ATTEMPTS) { setChecking(false); setTimedOut(true); return }
      timeoutId = setTimeout(tick, POLL_INTERVAL_MS)
    }

    tick()
    return () => { cancelled = true; clearTimeout(timeoutId) }
  }, [])

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

        <h1 style={{ ...display(26), margin: '0 0 8px' }}>Credits added ✦</h1>

        <p style={{ ...ui(300, 14, WHITE60), lineHeight: 1.6, margin: '0 0 28px', maxWidth: '280px' }}>
          Your credits are ready. Head to Nail Lab and start creating.
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
      <div className="lq-bg-wine" style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--lq-font-ui)', fontWeight: 300, fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>Loading…</p>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  )
}
