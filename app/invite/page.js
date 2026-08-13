'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function InvitePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [code, setCode] = useState(null)
  const [copied, setCopied] = useState(false)
  const [friendCount, setFriendCount] = useState(0)
  const [pointsEarned, setPointsEarned] = useState(0)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/profile'); return }
      setUser(session.user)

      // Generate or fetch referral code
      const res = await fetch('/api/generate-referral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: session.user.id }),
      })
      const { code: userCode } = await res.json()
      setCode(userCode)

      // Each invite_friend reward row is exactly one successful referral —
      // counting via profiles.referred_by doesn't work here since that
      // column is masked (auth.uid() = id) for any row that isn't your own.
      const { data: rewardRows } = await supabase
        .from('rewards')
        .select('points')
        .eq('user_id', session.user.id)
        .eq('reason', 'invite_friend')

      setFriendCount((rewardRows || []).length)
      setPointsEarned((rewardRows || []).reduce((sum, r) => sum + r.points, 0))
      setLoading(false)
    }
    init()
  }, [])

  const shareUrl = code ? `https://laque.app/onboarding?ref=${code}` : ''

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback
    }
  }

  const share = async () => {
    if (navigator.share) {
      navigator.share({
        title: 'Join me on Laque',
        text: `Discover the most beautiful nail designs on Laque. Use my code ${code} when you sign up and we both get rewards! 💅`,
        url: shareUrl,
      }).catch(() => {})
    } else {
      copyLink()
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px' }}>
        <Link href="/profile" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Link>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0 }}>Invite & Earn</h1>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* Hero card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(212,160,192,0.2) 0%, rgba(155,94,138,0.12) 100%)',
          border: '0.5px solid rgba(212,160,192,0.3)',
          borderRadius: '20px',
          padding: '28px 20px 24px',
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '44px', marginBottom: '14px', lineHeight: 1 }}>💅</div>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em', margin: '0 0 10px' }}>
            Share Laque, earn together
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.7', margin: '0 0 24px' }}>
            You get <strong style={{ color: 'var(--accent)' }}>+50 pts</strong> every time a friend joins with your code. They get <strong style={{ color: 'var(--accent)' }}>+25 pts</strong> too.
          </p>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: '14px', padding: '14px 10px', border: '0.5px solid var(--border)' }}>
              <p style={{ color: 'var(--accent)', fontSize: '26px', fontWeight: '600', letterSpacing: '-0.02em', margin: '0 0 3px' }}>{friendCount}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>Friends joined</p>
            </div>
            <div style={{ flex: 1, background: 'var(--bg-card)', borderRadius: '14px', padding: '14px 10px', border: '0.5px solid var(--border)' }}>
              <p style={{ color: 'var(--accent)', fontSize: '26px', fontWeight: '600', letterSpacing: '-0.02em', margin: '0 0 3px' }}>{pointsEarned}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>Points earned</p>
            </div>
          </div>

          {/* Code display */}
          <div style={{
            background: 'var(--bg-card)',
            border: '1px dashed rgba(212,160,192,0.5)',
            borderRadius: '14px',
            padding: '18px 16px',
            marginBottom: '14px',
          }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>Your referral code</p>
            <p style={{ color: 'var(--accent)', fontSize: '30px', fontWeight: '700', letterSpacing: '0.12em', margin: '0 0 14px', lineHeight: 1 }}>{code}</p>
            <button
              onClick={copyCode}
              style={{
                width: '100%', padding: '11px',
                background: copied ? 'rgba(108,200,130,0.15)' : 'var(--bg-chip)',
                color: copied ? '#6CC882' : 'var(--text-primary)',
                border: copied ? '0.5px solid rgba(108,200,130,0.4)' : '0.5px solid var(--border)',
                borderRadius: '10px', fontSize: '13px', fontWeight: '600',
                fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              {copied ? '✓ Copied!' : 'Copy code'}
            </button>
          </div>

          {/* Share button */}
          <button
            onClick={share}
            style={{
              width: '100%', padding: '14px',
              background: 'var(--accent)', color: '#2C0A1E',
              border: 'none', borderRadius: '12px',
              fontSize: '15px', fontWeight: '600',
              fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
            }}
          >
            Share invite link ✦
          </button>
        </div>

        {/* How it works */}
        <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 14px' }}>How it works</p>
          {[
            { icon: '📤', title: 'Share your code', desc: 'Send your unique code or link to friends, family, or followers.' },
            { icon: '✍️', title: 'Friend signs up', desc: 'They enter your code during onboarding when they join Laque.' },
            { icon: '🎁', title: 'You both earn', desc: 'You get +50 Beauty Rewards points. They get +25 to welcome them.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
              <span style={{ fontSize: '22px', lineHeight: 1, flexShrink: 0, marginTop: '2px' }}>{icon}</span>
              <div>
                <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: '0 0 3px' }}>{title}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0, lineHeight: '1.5' }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Link to rewards */}
        <Link href="/rewards" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: 'var(--bg-card)', border: '0.5px solid var(--border)',
          borderRadius: '12px', padding: '14px 16px', textDecoration: 'none',
        }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '14px', margin: 0 }}>✦ View all Beauty Rewards</p>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="#888888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>

      </div>
    </div>
  )
}
