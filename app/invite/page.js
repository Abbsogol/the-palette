'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'
import { useScrollMemory } from '@/lib/scrollMemory'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const WHITE80 = 'rgba(255,255,255,0.8)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

export default function InvitePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [code, setCode] = useState(null)
  const [copied, setCopied] = useState(false)
  const [friendCount, setFriendCount] = useState(0)
  const [pointsEarned, setPointsEarned] = useState(0)
  useScrollMemory(null, !loading)

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { router.push('/profile'); return }
      setUser(session.user)

      // Generate or fetch referral code
      const res = await fetch('/api/generate-referral', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
      })
      const json = await res.json().catch(() => ({}))
      if (res.ok && json.code) setCode(json.code)

      // Each invite_friend reward row is exactly one successful referral —
      // counting via profiles.referred_by doesn't work here since that
      // column is masked (auth.uid() = id) for any row that isn't your own.
      const { data: rewardRows, error: rewardsError } = await supabase
        .from('rewards')
        .select('points')
        .eq('user_id', session.user.id)
        .eq('reason', 'invite_friend')
      if (rewardsError) console.error('invite rewards fetch failed:', rewardsError)

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
        title: 'Join me on laQue',
        text: `Discover the most beautiful nail designs on Laque. Use my code ${code} when you sign up and we both get rewards! 💅`,
        url: shareUrl,
      }).catch(() => {})
    } else {
      copyLink()
    }
  }

  if (loading) return (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div style={{ position: 'relative', minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={ui(300, 14, WHITE60)}>Loading…</p>
      </div>
    </div>
  )

  return (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 16px' }}>
        <BackButton fallback="/profile" />
        <h1 style={{ ...display(24), margin: 0 }}>Invite &amp; Earn</h1>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* Hero card */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,81,127,0.18) 0%, rgba(102,0,7,0.22) 100%)',
          border: '1px solid rgba(255,81,127,0.25)',
          borderRadius: '24px',
          padding: '28px 20px 24px',
          marginBottom: '20px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '44px', marginBottom: '14px', lineHeight: 1 }}>💅</div>
          <h2 style={{ ...display(26), margin: '0 0 10px' }}>Share Laque, earn together</h2>
          <p style={{ ...ui(300, 14, WHITE80), lineHeight: 1.7, margin: '0 0 24px' }}>
            You get <strong style={{ color: ACCENT, fontWeight: 500 }}>+50 pts</strong> every time a friend joins with your code. They get <strong style={{ color: ACCENT, fontWeight: 500 }}>+25 pts</strong> too.
          </p>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
            <div style={{ flex: 1, background: PANEL, borderRadius: '14px', padding: '14px 10px', border: PANEL_BORDER }}>
              <p style={{ ...display(26), color: ACCENT, margin: '0 0 3px' }}>{friendCount}</p>
              <p style={ui(300, 11, WHITE60)}>Friends joined</p>
            </div>
            <div style={{ flex: 1, background: PANEL, borderRadius: '14px', padding: '14px 10px', border: PANEL_BORDER }}>
              <p style={{ ...display(26), color: ACCENT, margin: '0 0 3px' }}>{pointsEarned}</p>
              <p style={ui(300, 11, WHITE60)}>Points earned</p>
            </div>
          </div>

          {/* Code display */}
          <div style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px dashed rgba(255,81,127,0.5)',
            borderRadius: '14px', padding: '18px 16px', marginBottom: '14px',
          }}>
            <p style={{ ...ui(500, 11, WHITE60), letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 10px' }}>Your referral code</p>
            <p style={{ color: ACCENT, fontSize: '30px', fontWeight: 700, letterSpacing: '0.12em', margin: '0 0 14px', lineHeight: 1, fontFamily: 'var(--lq-font-ui)' }}>{code}</p>
            <button
              onClick={copyCode}
              style={{
                width: '100%', padding: '12px',
                background: copied ? 'rgba(108,200,130,0.15)' : 'rgba(255,255,255,0.08)',
                color: copied ? '#6CC882' : 'var(--lq-white)',
                border: copied ? '1px solid rgba(108,200,130,0.4)' : PANEL_BORDER,
                borderRadius: '1000px', ...ui(500, 13), cursor: 'pointer',
              }}
            >
              {copied ? '✓ Copied!' : 'Copy code'}
            </button>
          </div>

          {/* Share button */}
          <button
            onClick={share}
            style={{
              width: '100%', padding: '15px', minHeight: '52px',
              background: BTN_GRADIENT, color: 'var(--lq-white)',
              border: 'none', borderRadius: '1000px', ...ui(500, 15), cursor: 'pointer',
            }}
          >
            Share invite link ✦
          </button>
        </div>

        {/* How it works */}
        <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
          <p style={{ ...ui(500, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 14px' }}>How it works</p>
          {[
            { icon: '📤', title: 'Share your code', desc: 'Send your unique code or link to friends, family, or followers.' },
            { icon: '✍️', title: 'Friend signs up', desc: 'They enter your code during onboarding when they join Laque.' },
            { icon: '🎁', title: 'You both earn', desc: 'You get +50 Beauty Rewards points. They get +25 to welcome them.' },
          ].map(({ icon, title, desc }) => (
            <div key={title} style={{ display: 'flex', gap: '14px', marginBottom: '14px' }}>
              <span style={{ fontSize: '22px', lineHeight: 1, flexShrink: 0, marginTop: '2px' }}>{icon}</span>
              <div>
                <p style={{ ...ui(500, 14), margin: '0 0 3px' }}>{title}</p>
                <p style={{ ...ui(300, 13, WHITE60), margin: 0, lineHeight: 1.5 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Link to rewards */}
        <Link href="/rewards" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: PANEL, border: PANEL_BORDER,
          borderRadius: '14px', padding: '14px 16px', textDecoration: 'none',
        }}>
          <p style={{ ...ui(400, 14), margin: 0 }}>✦ View all Beauty Rewards</p>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>

      </div>
      </div>
    </div>
  )
}
