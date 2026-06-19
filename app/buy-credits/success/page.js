'use client'

import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

function SuccessContent() {
  const searchParams = useSearchParams()
  const sessionId = searchParams.get('session_id')
  const [creditBalance, setCreditBalance] = useState(null)

  useEffect(() => {
    const getBalance = async () => {
      await new Promise(r => setTimeout(r, 2000))
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', user.id)
        .single()
      if (profile) setCreditBalance(profile.credit_balance)
    }
    getBalance()
  }, [])

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
        Credits added ✦
      </h1>

      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 28px', maxWidth: '280px' }}>
        Your credits are ready. Head to Nail Lab and start creating.
      </p>

      {creditBalance !== null && (
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '14px',
          border: '0.5px solid var(--border)',
          padding: '16px 28px',
          marginBottom: '32px',
        }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>New balance</p>
          <p style={{ color: 'var(--accent)', fontSize: '36px', fontWeight: '700', margin: 0, letterSpacing: '-0.03em' }}>{creditBalance}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '2px 0 0' }}>credits</p>
        </div>
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
