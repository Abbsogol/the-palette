'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
      <circle cx="8" cy="8" r="8" fill="rgba(212,160,192,0.15)" />
      <path d="M5 8l2 2 4-4" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function UpgradePage() {
  const router = useRouter()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [subscribing, setSubscribing] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/profile'); return }
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, account_type, subscription_tier')
        .eq('id', session.user.id)
        .single()
      setProfile(data)
      setLoading(false)
    })
  }, [])

  const handleSubscribe = async (planId) => {
    if (!profile) return
    setSubscribing(planId)
    try {
      const res = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId, userId: profile.id }),
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

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '60px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px', borderBottom: '0.5px solid var(--border)' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', color: 'var(--text-primary)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </button>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0 }}>Upgrade</h1>
      </div>

      {/* Hero */}
      <div style={{ padding: '32px 20px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '28px', marginBottom: '12px' }}>✦</div>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '700', margin: '0 0 8px' }}>Unlock the full Laque experience</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, lineHeight: '1.6' }}>Choose the plan that's right for you. Cancel anytime.</p>
      </div>

      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Pro Creator Plan — only show to creator accounts */}
        {isCreator && (
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '18px',
            border: currentTier === 'pro_creator' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
            overflow: 'hidden',
          }}>
            {/* Plan header */}
            <div style={{ padding: '20px 20px 16px', background: 'linear-gradient(135deg, rgba(212,160,192,0.12) 0%, transparent 100%)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
                <div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>For nail artists & salons</p>
                  <h3 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '700', margin: 0 }}>Pro Creator</h3>
                </div>
                {currentTier === 'pro_creator' && (
                  <span style={{ background: 'var(--accent)', color: '#2C0A1E', fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', padding: '4px 10px', borderRadius: '20px' }}>ACTIVE</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '8px' }}>
                <span style={{ color: 'var(--accent)', fontSize: '28px', fontWeight: '700' }}>AED 49</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>/month</span>
              </div>
            </div>

            {/* Features */}
            <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {PRO_CREATOR_FEATURES.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <CheckIcon />
                  <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{f}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div style={{ padding: '4px 20px 20px' }}>
              {currentTier === 'pro_creator' ? (
                <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(212,160,192,0.08)', borderRadius: '12px' }}>
                  <p style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: '500', margin: 0 }}>You're on Pro Creator ✦</p>
                </div>
              ) : (
                <button
                  onClick={() => handleSubscribe('pro_creator')}
                  disabled={subscribing === 'pro_creator'}
                  style={{
                    width: '100%', background: 'var(--accent)', color: '#2C0A1E',
                    border: 'none', borderRadius: '12px', padding: '14px',
                    fontSize: '15px', fontWeight: '700', fontFamily: "'DM Sans', sans-serif",
                    cursor: 'pointer', opacity: subscribing === 'pro_creator' ? 0.7 : 1,
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
          background: 'var(--bg-card)',
          borderRadius: '18px',
          border: currentTier === 'premium' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
          overflow: 'hidden',
        }}>
          {/* Plan header */}
          <div style={{ padding: '20px 20px 16px', background: 'linear-gradient(135deg, rgba(212,160,192,0.07) 0%, transparent 100%)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>For design lovers</p>
                <h3 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '700', margin: 0 }}>Laque Premium</h3>
              </div>
              {currentTier === 'premium' && (
                <span style={{ background: 'var(--accent)', color: '#2C0A1E', fontSize: '10px', fontWeight: '700', letterSpacing: '0.06em', padding: '4px 10px', borderRadius: '20px' }}>ACTIVE</span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px', marginTop: '8px' }}>
              <span style={{ color: 'var(--accent)', fontSize: '28px', fontWeight: '700' }}>AED 19</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>/month</span>
            </div>
          </div>

          {/* Features */}
          <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {PREMIUM_FEATURES.map((f, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <CheckIcon />
                <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ padding: '4px 20px 20px' }}>
            {currentTier === 'premium' ? (
              <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(212,160,192,0.08)', borderRadius: '12px' }}>
                <p style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: '500', margin: 0 }}>You're on Premium ✦</p>
              </div>
            ) : (
              <button
                onClick={() => handleSubscribe('premium')}
                disabled={subscribing === 'premium'}
                style={{
                  width: '100%', background: 'var(--bg-chip)', color: 'var(--text-primary)',
                  border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px',
                  fontSize: '15px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
                  cursor: 'pointer', opacity: subscribing === 'premium' ? 0.7 : 1,
                }}
              >
                {subscribing === 'premium' ? 'Redirecting…' : 'Get Premium'}
              </button>
            )}
          </div>
        </div>

        {/* Fine print */}
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', margin: '4px 0 0', lineHeight: '1.6' }}>
          Billed monthly. Cancel anytime from your account settings.<br />
          All prices include VAT where applicable.
        </p>
      </div>
    </div>
  )
}
