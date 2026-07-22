'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const LEVELS = [
  { name: 'Bronze',   min: 0,    max: 199,  color: '#CD7F32', emoji: '🥉' },
  { name: 'Silver',   min: 200,  max: 499,  color: '#A8A9AD', emoji: '🥈' },
  { name: 'Gold',     min: 500,  max: 999,  color: '#D4A0C0', emoji: '✦' },
  { name: 'Platinum', min: 1000, max: Infinity, color: '#E8D5F5', emoji: '💎' },
]

const REASON_LABELS = {
  save_design:      { label: 'Saved a design',       points: '+5'  },
  post_design:      { label: 'Posted a design',      points: '+10' },
  leave_review:     { label: 'Left a review',        points: '+15' },
  book_appointment: { label: 'Booked an appointment', points: '+20' },
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
      const { data } = await supabase
        .from('rewards')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
      const rows = data || []
      setHistory(rows)
      setTotalPoints(rows.reduce((sum, r) => sum + r.points, 0))
      setLoading(false)
    })
  }, [])

  const level = getLevel(totalPoints)
  const nextLevel = LEVELS[LEVELS.findIndex(l => l.name === level.name) + 1]
  const progressPct = nextLevel
    ? Math.min(((totalPoints - level.min) / (nextLevel.min - level.min)) * 100, 100)
    : 100

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ paddingBottom: '100px', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ padding: '24px 20px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <Link href="/profile" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0 }}>Beauty Rewards</h1>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* Level card */}
        <div style={{ background: 'linear-gradient(135deg, rgba(212,160,192,0.2) 0%, rgba(155,94,138,0.12) 100%)', border: '0.5px solid rgba(212,160,192,0.3)', borderRadius: '20px', padding: '24px 20px', marginBottom: '20px', textAlign: 'center' }}>
          <p style={{ fontSize: '40px', margin: '0 0 8px', lineHeight: 1 }}>{level.emoji}</p>
          <p style={{ color: level.color, fontSize: '13px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>{level.name}</p>
          <p style={{ color: 'var(--text-primary)', fontSize: '36px', fontWeight: '600', letterSpacing: '-0.02em', margin: '0 0 16px' }}>{totalPoints.toLocaleString()} <span style={{ fontSize: '16px', fontWeight: '400', color: 'var(--text-secondary)' }}>pts</span></p>

          {/* Progress bar */}
          {nextLevel && (
            <>
              <div style={{ width: '100%', height: '6px', background: 'var(--bg-chip)', borderRadius: '6px', marginBottom: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPct}%`, height: '100%', background: 'var(--accent)', borderRadius: '6px', transition: 'width 0.6s ease' }} />
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>
                {nextLevel.min - totalPoints} pts to {nextLevel.emoji} {nextLevel.name}
              </p>
            </>
          )}
          {!nextLevel && (
            <p style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '500', margin: 0 }}>You've reached the highest level 💎</p>
          )}
        </div>

        {/* How to earn */}
        <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>How to earn</p>
          {Object.entries(REASON_LABELS).map(([key, { label, points }]) => (
            <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: '0.5px solid var(--border)' }}>
              <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{label}</span>
              <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '600' }}>{points} pts</span>
            </div>
          ))}
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '12px 0 0', lineHeight: '1.5' }}>
            Points can be redeemed for discounts on credits and appointments — coming soon.
          </p>
        </div>

        {/* History */}
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Activity</p>
        {history.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '24px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>No points yet — start saving designs or booking appointments to earn rewards.</p>
          </div>
        ) : (
          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', overflow: 'hidden' }}>
            {history.map((row, i) => (
              <div key={row.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 16px', borderBottom: i < history.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                <div>
                  <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: '0 0 2px' }}>
                    {REASON_LABELS[row.reason]?.label || row.reason}
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>{timeAgo(row.created_at)}</p>
                </div>
                <span style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: '600' }}>+{row.points}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
