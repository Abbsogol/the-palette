'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const PACKS = [
  {
    id: 'starter',
    name: 'Starter',
    credits: 5,
    price: 3.99,
    priceDisplay: '$3.99',
    perCredit: '$0.80/design',
    description: 'Try it out',
    popular: false,
  },
  {
    id: 'popular',
    name: 'Popular',
    credits: 15,
    price: 9.99,
    priceDisplay: '$9.99',
    perCredit: '$0.67/design',
    description: 'Best value',
    popular: true,
  },
  {
    id: 'pro',
    name: 'Pro',
    credits: 40,
    price: 22.99,
    priceDisplay: '$22.99',
    perCredit: '$0.57/design',
    description: 'For power users',
    popular: false,
  },
]

export default function BuyCreditsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [creditBalance, setCreditBalance] = useState(null)
  const [loading, setLoading] = useState(null) // which pack is loading

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUser(user)
      const { data: profile } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', user.id)
        .single()
      if (profile) setCreditBalance(profile.credit_balance)
    }
    getUser()
  }, [])

  const handleBuy = async (pack) => {
    if (!currentUser) return
    setLoading(pack.id)
    try {
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId: pack.id, userId: currentUser.id }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        alert('Something went wrong. Please try again.')
        setLoading(null)
      }
    } catch (err) {
      console.error(err)
      alert('Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: '12px' }}>
        <Link href="/profile" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Link>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0 }}>Buy Credits</h1>
      </div>

      {/* Current balance */}
      {creditBalance !== null && (
        <div style={{ margin: '0 20px 24px', background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>Current balance</p>
            <p style={{ color: creditBalance > 0 ? 'var(--accent)' : '#E07070', fontSize: '22px', fontWeight: '600', margin: 0, letterSpacing: '-0.02em' }}>
              {creditBalance} credit{creditBalance !== 1 ? 's' : ''}
            </p>
          </div>
          <Link href="/nail-lab" style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
            Go to Nail Lab →
          </Link>
        </div>
      )}

      {/* Hero copy */}
      <div style={{ padding: '0 20px 28px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', margin: 0 }}>
          Each credit generates one AI nail design board in Nail Lab.<br/>Credits never expire.
        </p>
      </div>

      {/* Pack cards */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {PACKS.map((pack) => (
          <div
            key={pack.id}
            style={{
              background: pack.popular ? 'linear-gradient(135deg, rgba(212,160,192,0.12) 0%, rgba(212,160,192,0.04) 100%)' : 'var(--bg-card)',
              borderRadius: '16px',
              border: pack.popular ? '1px solid rgba(212,160,192,0.4)' : '0.5px solid var(--border)',
              padding: '20px',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {pack.popular && (
              <div style={{
                position: 'absolute', top: '12px', right: '12px',
                background: 'var(--accent)', color: '#2C0A1E',
                fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em',
                padding: '3px 8px', borderRadius: '20px',
                textTransform: 'uppercase',
              }}>
                Most Popular
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>{pack.description}</p>
                <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '600', margin: '0 0 2px', letterSpacing: '-0.02em' }}>{pack.name}</h2>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>{pack.perCredit}</p>
              </div>
              <div style={{ textAlign: 'right' }}>
                <p style={{ color: pack.popular ? 'var(--accent)' : 'var(--text-primary)', fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.03em' }}>{pack.priceDisplay}</p>
              </div>
            </div>

            {/* Credits display */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              {Array.from({ length: Math.min(pack.credits, 10) }).map((_, i) => (
                <div key={i} style={{
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: pack.popular ? 'var(--accent)' : 'var(--text-secondary)',
                  opacity: pack.popular ? 0.8 : 0.4,
                }} />
              ))}
              {pack.credits > 10 && (
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>+{pack.credits - 10} more</span>
              )}
              <span style={{ color: pack.popular ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '13px', fontWeight: '500', marginLeft: '4px' }}>
                {pack.credits} credits
              </span>
            </div>

            <button
              onClick={() => handleBuy(pack)}
              disabled={!!loading}
              style={{
                width: '100%',
                background: pack.popular ? 'var(--accent)' : 'var(--bg-chip)',
                color: pack.popular ? '#2C0A1E' : 'var(--text-primary)',
                border: 'none',
                borderRadius: '12px',
                padding: '13px',
                fontSize: '14px',
                fontWeight: '600',
                fontFamily: "'DM Sans', sans-serif",
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading && loading !== pack.id ? 0.5 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {loading === pack.id ? 'Redirecting to payment…' : `Buy ${pack.credits} credits — ${pack.priceDisplay}`}
            </button>
          </div>
        ))}
      </div>

      {/* Footer note */}
      <div style={{ padding: '24px 20px 0', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: '1.6', margin: 0 }}>
          Secure payments via Stripe. Credits are added to your account instantly after payment.
        </p>
      </div>
    </div>
  )
}
