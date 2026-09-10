'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

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
      if (!user) { router.push('/profile'); return }
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
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ packId: pack.id }),
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
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 60px)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 16px' }}>
          <BackButton fallback="/profile" />
          <h1 style={{ ...display(24), margin: 0 }}>Buy Credits</h1>
        </div>

        {/* Current balance */}
        {creditBalance !== null && (
          <div style={{ margin: '0 20px 24px', background: PANEL, borderRadius: '16px', border: PANEL_BORDER, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ ...ui(500, 11, WHITE60), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>Current balance</p>
              <p style={{ ...ui(600, 22, creditBalance > 0 ? ACCENT : '#E07070'), margin: 0, letterSpacing: '-0.02em' }}>
                {creditBalance} credit{creditBalance !== 1 ? 's' : ''}
              </p>
            </div>
            <Link href="/nail-lab" style={{ ...ui(500, 13, ACCENT), textDecoration: 'none' }}>
              Go to Nail Lab →
            </Link>
          </div>
        )}

        {/* Hero copy */}
        <div style={{ padding: '0 20px 28px', textAlign: 'center' }}>
          <p style={{ ...ui(300, 13, WHITE60), lineHeight: 1.6, margin: 0 }}>
            Each credit generates one AI nail design board in Nail Lab.<br/>Credits never expire.
          </p>
        </div>

        {/* Pack cards */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {PACKS.map((pack) => (
            <div
              key={pack.id}
              style={{
                background: pack.popular ? 'linear-gradient(135deg, rgba(255,81,127,0.14) 0%, rgba(255,81,127,0.04) 100%)' : PANEL,
                borderRadius: '18px',
                border: pack.popular ? '1px solid rgba(255,81,127,0.4)' : PANEL_BORDER,
                padding: '20px',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {pack.popular && (
                <div style={{
                  position: 'absolute', top: '12px', right: '12px',
                  background: BTN_GRADIENT, color: 'var(--lq-white)',
                  ...ui(700, 10), letterSpacing: '0.06em',
                  padding: '3px 8px', borderRadius: '1000px',
                  textTransform: 'uppercase',
                }}>
                  Most Popular
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
                <div>
                  <p style={{ ...ui(500, 11, WHITE60), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>{pack.description}</p>
                  <h2 style={{ ...display(22), margin: '0 0 3px' }}>{pack.name}</h2>
                  <p style={{ ...ui(300, 12, WHITE60), margin: 0 }}>{pack.perCredit}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ ...ui(700, 28, pack.popular ? ACCENT : 'var(--lq-white)'), margin: 0, letterSpacing: '-0.03em' }}>{pack.priceDisplay}</p>
                </div>
              </div>

              {/* Credits display */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                {Array.from({ length: Math.min(pack.credits, 10) }).map((_, i) => (
                  <div key={i} style={{
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: pack.popular ? ACCENT : 'rgba(255,255,255,0.4)',
                  }} />
                ))}
                {pack.credits > 10 && (
                  <span style={ui(300, 11, WHITE60)}>+{pack.credits - 10} more</span>
                )}
                <span style={{ ...ui(500, 13, pack.popular ? ACCENT : WHITE60), marginLeft: '4px' }}>
                  {pack.credits} credits
                </span>
              </div>

              <button
                onClick={() => handleBuy(pack)}
                disabled={!!loading}
                style={{
                  width: '100%',
                  background: pack.popular ? BTN_GRADIENT : 'rgba(255,255,255,0.08)',
                  color: 'var(--lq-white)',
                  border: pack.popular ? 'none' : PANEL_BORDER,
                  borderRadius: '1000px',
                  padding: '13px',
                  ...ui(600, 14),
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
          <p style={{ ...ui(300, 11, WHITE60), lineHeight: 1.6, margin: 0 }}>
            Secure payments via Stripe. Credits are added to your account instantly after payment.
          </p>
        </div>
      </div>
    </div>
  )
}
