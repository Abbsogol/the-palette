'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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

const PRO_CREATOR_FEATURES = [
  'Accept client bookings',
  'Publish your nail designs',
  'Analytics dashboard',
  'Verified badge on your profile',
  'Priority placement in search',
  '20 Nail Lab AI credits/month',
]

const PREMIUM_FEATURES = [
  'Unlimited moodboards',
  'Access to exclusive designs',
  'Early access to weekly drops',
  '5 Nail Lab AI credits/month',
  'Colour match tool (coming soon)',
]

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="8" fill="rgba(255,81,127,0.18)" />
      <path d="M5 8l2 2 4-4" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function UpgradePage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [subscribing, setSubscribing] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/profile'); return }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, account_type, subscription_tier')
        .eq('id', session.user.id)
        .single()
      if (error) { console.error('profile fetch failed:', error); setLoadError(true) }
      setProfile(data)
      setLoading(false)
    })
  }, [])

  const handleSubscribe = async (planId) => {
    if (!profile) return
    setSubscribing(planId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ planId }),
      })
      const { url, error } = await res.json()
      if (error) { alert('Something went wrong. Please try again.'); setSubscribing(null); return }
      window.location.href = url
    } catch {
      alert('Something went wrong. Please try again.')
      setSubscribing(null)
    }
  }

  const isCreator = profile?.account_type && ['nail_artist', 'creator', 'salon'].includes(profile.account_type)
  const currentTier = profile?.subscription_tier

  const Shell = ({ children }) => (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 60px)' }}>{children}</div>
    </div>
  )

  if (loading) return (
    <Shell>
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={ui(300, 14, WHITE60)}>Loading…</p>
      </div>
    </Shell>
  )

  // Don't show the "not subscribed" upgrade options if the profile fetch
  // itself failed — a real subscriber could otherwise be misled into
  // thinking they need to pay again.
  if (loadError) return (
    <Shell>
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px', textAlign: 'center' }}>
        <p style={ui(600, 15)}>Couldn&apos;t load your subscription status</p>
        <p style={ui(300, 13, WHITE60)}>Please try again in a moment.</p>
        <button onClick={() => window.location.reload()} style={{ background: BTN_GRADIENT, color: 'var(--lq-white)', border: 'none', borderRadius: '1000px', padding: '12px 24px', ...ui(600, 14), cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    </Shell>
  )

  return (
    <Shell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 16px' }}>
        <BackButton fallback="/profile" />
        <h1 style={{ ...display(24), margin: 0 }}>Upgrade</h1>
      </div>

      {/* Hero */}
      <div style={{ padding: '20px 20px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '12px', color: ACCENT }}>✦</div>
        <h2 style={{ ...display(26), margin: '0 0 8px' }}>Unlock the full Laque experience</h2>
        <p style={{ ...ui(300, 14, WHITE60), margin: 0, lineHeight: 1.6 }}>Choose the plan that&apos;s right for you. Cancel anytime.</p>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Pro Creator Plan — only show to creator accounts */}
        {isCreator && (
          <div style={{
            background: PANEL,
            borderRadius: '20px',
            border: currentTier === 'pro_creator' ? `1.5px solid ${ACCENT}` : PANEL_BORDER,
            overflow: 'hidden',
          }}>
            {/* Plan header */}
            <div style={{ padding: '20px 20px 16px', background: 'linear-gradient(135deg, rgba(255,81,127,0.14) 0%, transparent 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div>
                  <p style={{ ...ui(500, 11, WHITE60), letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>For nail artists &amp; salons</p>
                  <h3 style={{ ...display(22), margin: 0 }}>Pro Creator</h3>
                </div>
                {currentTier === 'pro_creator' && (
                  <span style={{ background: BTN_GRADIENT, color: 'var(--lq-white)', ...ui(700, 10), letterSpacing: '0.06em', padding: '4px 10px', borderRadius: '1000px' }}>ACTIVE</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '8px' }}>
                <span style={ui(700, 28, ACCENT)}>AED 49</span>
                <span style={ui(300, 13, WHITE60)}>/month</span>
              </div>
            </div>

            {/* Features */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {PRO_CREATOR_FEATURES.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckIcon />
                  <span style={ui(400, 14)}>{f}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ padding: '4px 20px 20px' }}>
              {currentTier === 'pro_creator' ? (
                <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,81,127,0.1)', borderRadius: '12px' }}>
                  <p style={{ ...ui(500, 14, ACCENT), margin: 0 }}>You&apos;re on Pro Creator ✦</p>
                </div>
              ) : (
                <button
                  onClick={() => handleSubscribe('pro_creator')}
                  disabled={subscribing === 'pro_creator'}
                  style={{
                    width: '100%', background: BTN_GRADIENT, color: 'var(--lq-white)',
                    border: 'none', borderRadius: '1000px', padding: '14px',
                    ...ui(700, 15), cursor: 'pointer', opacity: subscribing === 'pro_creator' ? 0.7 : 1,
                  }}
                >
                  {subscribing === 'pro_creator' ? 'Redirecting…' : 'Get Pro Creator'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Premium Plan — for all users */}
        <div style={{
          background: PANEL,
          borderRadius: '20px',
          border: currentTier === 'premium' ? `1.5px solid ${ACCENT}` : PANEL_BORDER,
          overflow: 'hidden',
        }}>
          {/* Plan header */}
          <div style={{ padding: '20px 20px 16px', background: 'linear-gradient(135deg, rgba(255,81,127,0.08) 0%, transparent 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div>
                <p style={{ ...ui(500, 11, WHITE60), letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>For design lovers</p>
                <h3 style={{ ...display(22), margin: 0 }}>Laque Premium</h3>
              </div>
              {currentTier === 'premium' && (
                <span style={{ background: BTN_GRADIENT, color: 'var(--lq-white)', ...ui(700, 10), letterSpacing: '0.06em', padding: '4px 10px', borderRadius: '1000px' }}>ACTIVE</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '8px' }}>
              <span style={ui(700, 28, ACCENT)}>AED 19</span>
              <span style={ui(300, 13, WHITE60)}>/month</span>
            </div>
          </div>

          {/* Features */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {PREMIUM_FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckIcon />
                <span style={ui(400, 14)}>{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ padding: '4px 20px 20px' }}>
            {currentTier === 'premium' ? (
              <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(255,81,127,0.1)', borderRadius: '12px' }}>
                <p style={{ ...ui(500, 14, ACCENT), margin: 0 }}>You&apos;re on Premium ✦</p>
              </div>
            ) : (
              <button
                onClick={() => handleSubscribe('premium')}
                disabled={subscribing === 'premium'}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.08)', color: 'var(--lq-white)',
                  border: PANEL_BORDER, borderRadius: '1000px', padding: '14px',
                  ...ui(600, 15), cursor: 'pointer', opacity: subscribing === 'premium' ? 0.7 : 1,
                }}
              >
                {subscribing === 'premium' ? 'Redirecting…' : 'Get Premium'}
              </button>
            )}
          </div>
        </div>

        {/* Fine print */}
        <p style={{ ...ui(300, 12, WHITE60), textAlign: 'center', margin: '4px 0 0', lineHeight: 1.6 }}>
          Billed monthly. Cancel anytime from your account settings.<br />
          All prices include VAT where applicable.
        </p>
      </div>
    </Shell>
  )
}
