'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const ROW_BORDER = '1px solid rgba(255,255,255,0.08)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size, color = 'var(--lq-white)') => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color, lineHeight: 1.2 })
const sectionLabel = { ...ui(600, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase' }

const LEVELS = [
  { name: 'Bronze',   min: 0,    max: 199,  color: '#CD7F32', emoji: '🥉' },
  { name: 'Silver',   min: 200,  max: 499,  color: '#A8A9AD', emoji: '🥈' },
  { name: 'Gold',     min: 500,  max: 999,  color: '#D4A0C0', emoji: '✦' },
  { name: 'Platinum', min: 1000, max: Infinity, color: '#E8D5F5', emoji: '💎' },
]

const REASON_LABELS = {
  save_design:       { label: 'Saved a design',        points: '+5'  },
  post_design:       { label: 'Posted a design',       points: '+10' },
  leave_review:      { label: 'Left a review',         points: '+15' },
  book_appointment:  { label: 'Booked an appointment', points: '+20' },
  invite_friend:     { label: 'Invited a friend',      points: '+50' },
  joined_via_invite: { label: 'Joined via invite',     points: '+25' },
}

function getLevel(total) {
  return LEVELS.find(l => total >= l.min && total <= l.max) || LEVELS[0]
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  if (d >= 1) return `${d}d ago`
  if (h >= 1) return `${h}h ago`
  return 'Just now'
}

export default function RewardsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [totalPoints, setTotalPoints] = useState(0)
  const [history, setHistory] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/profile'); return }
      // Two queries: a capped one for the displayed history list, and a
      // separate lightweight (points-only, no row cap) one for the total —
      // capping the total's own source rows would silently understate it.
      const [{ data, error }, { data: allPoints, error: sumError }] = await Promise.all([
        supabase.from('rewards').select('*').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('rewards').select('points').eq('user_id', session.user.id),
      ])
      if (error) console.error('rewards fetch failed:', error)
      if (sumError) console.error('rewards total fetch failed:', sumError)
      const rows = data || []
      setHistory(rows)
      setTotalPoints((allPoints || []).reduce((sum, r) => sum + r.points, 0))
      setLoading(false)
    })
  }, [])

  const level = getLevel(totalPoints)
  const nextLevel = LEVELS[LEVELS.findIndex(l => l.name === level.name) + 1]
  const progressPct = nextLevel
    ? Math.min(((totalPoints - level.min) / (nextLevel.min - level.min)) * 100, 100)
    : 100

  const Shell = ({ children }) => (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>{children}</div>
    </div>
  )

  if (loading) return (
    <Shell>
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={ui(300, 14, WHITE60)}>Loading…</p>
      </div>
    </Shell>
  )

  return (
    <Shell>
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top) + 16px) 20px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackButton fallback="/profile" />
        <h1 style={{ ...display(24), margin: 0 }}>Beauty Rewards</h1>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* Level card */}
        <div style={{ background: 'linear-gradient(135deg, rgba(255,81,127,0.22) 0%, rgba(102,0,7,0.18) 100%)', border: '1px solid rgba(255,81,127,0.3)', borderRadius: '20px', padding: '24px 20px', marginBottom: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '40px', margin: '0 0 8px', lineHeight: 1 }}>{level.emoji}</p>
          <p style={{ ...ui(700, 13, level.color), letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 6px' }}>{level.name}</p>
          <p style={{ ...display(38), margin: '0 0 16px', letterSpacing: '-0.02em' }}>{totalPoints.toLocaleString()} <span style={ui(400, 16, WHITE60)}>pts</span></p>

          {/* Progress bar */}
          {nextLevel && (
            <>
              <div style={{ width: '100%', height: '6px', background: 'rgba(255,255,255,0.12)', borderRadius: '1000px', marginBottom: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPct}%`, height: '100%', background: ACCENT, borderRadius: '1000px', transition: 'width 0.6s ease' }} />
              </div>
              <p style={ui(300, 12, WHITE60)}>
                {nextLevel.min - totalPoints} pts to {nextLevel.emoji} {nextLevel.name}
              </p>
            </>
          )}
          {!nextLevel && (
            <p style={{ ...ui(500, 13, ACCENT), margin: 0 }}>You&apos;ve reached the highest level 💎</p>
          )}
        </div>

        {/* How to earn */}
        <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
          <p style={{ ...sectionLabel, margin: '0 0 12px' }}>How to earn</p>
          {Object.entries(REASON_LABELS).filter(([key]) => key !== 'joined_via_invite').map(([key, { label, points }]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: ROW_BORDER }}>
              <span style={ui(400, 13)}>{label}</span>
              <span style={ui(600, 13, ACCENT)}>{points} pts</span>
            </div>
          ))}
          <p style={{ ...ui(300, 11, WHITE60), margin: '12px 0 0', lineHeight: 1.5 }}>
            Points can be redeemed for discounts on credits and appointments — coming soon.
          </p>
        </div>

        {/* History */}
        <p style={{ ...sectionLabel, margin: '0 0 10px' }}>Activity</p>
        {history.length === 0 ? (
          <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '24px', textAlign: 'center' }}>
            <p style={ui(300, 13, WHITE60)}>No points yet — start saving designs or booking appointments to earn rewards.</p>
          </div>
        ) : (
          <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', overflow: 'hidden' }}>
            {history.map((row, i) => (
              <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: i < history.length - 1 ? ROW_BORDER : 'none' }}>
                <div>
                  <p style={{ ...ui(500, 13), margin: '0 0 2px' }}>
                    {REASON_LABELS[row.reason]?.label || row.reason}
                  </p>
                  <p style={ui(300, 11, WHITE60)}>{timeAgo(row.created_at)}</p>
                </div>
                <span style={ui(600, 14, ACCENT)}>+{row.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Shell>
  )
}
