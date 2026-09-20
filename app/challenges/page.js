'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'
import { useScrollMemory } from '@/lib/scrollMemory'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const PANEL = 'rgba(255,255,255,0.06)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })
const sectionLabel = { ...ui(600, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase' }

function useCountdown(endsAt) {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt) - Date.now()
      if (diff <= 0) { setTimeLeft('Ended'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      if (d > 0) setTimeLeft(`${d}d ${h}h left`)
      else if (h > 0) setTimeLeft(`${h}h ${m}m left`)
      else setTimeLeft(`${m}m left`)
    }
    calc()
    const t = setInterval(calc, 60000)
    return () => clearInterval(t)
  }, [endsAt])
  return timeLeft
}

function ChallengeCard({ challenge, isActive }) {
  const timeLeft = useCountdown(challenge.ends_at)
  const ended = new Date(challenge.ends_at) < new Date()
  return (
    <Link href={`/challenges/${challenge.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div style={{
        background: PANEL, border: `1px solid ${isActive ? 'rgba(255,81,127,0.4)' : 'rgba(255,255,255,0.1)'}`,
        borderRadius: '16px', padding: '18px 16px', marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
          <p style={{ ...ui(600, 15), margin: 0, flex: 1 }}>{challenge.title}</p>
          <span style={{
            background: ended ? 'rgba(255,255,255,0.08)' : 'rgba(255,81,127,0.15)',
            ...ui(600, 11, ended ? WHITE60 : ACCENT),
            padding: '4px 10px', borderRadius: '1000px', flexShrink: 0,
          }}>
            {ended ? 'Ended' : timeLeft}
          </span>
        </div>
        {challenge.description && (
          <p style={{ ...ui(300, 13, WHITE60), lineHeight: 1.5, margin: '0 0 10px' }}>{challenge.description}</p>
        )}
        <p style={{ ...ui(500, 12, ACCENT), margin: 0 }}>
          {ended ? 'View results →' : 'Enter & vote →'}
        </p>
      </div>
    </Link>
  )
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  useScrollMemory(null, !loading)

  useEffect(() => {
    supabase.from('challenges').select('*').order('ends_at', { ascending: false }).limit(100).then(({ data, error }) => {
      if (error) console.error('challenges fetch failed:', error)
      setChallenges(data || [])
      setLoading(false)
    })
  }, [])

  const now = new Date()
  const active = challenges.filter(c => new Date(c.ends_at) > now)
  const past   = challenges.filter(c => new Date(c.ends_at) <= now)

  return (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 8px' }}>
          <BackButton fallback="/feed" />
          <div>
            <p style={{ ...sectionLabel, margin: '0 0 2px' }}>Community</p>
            <h1 style={{ ...display(24), margin: 0 }}>Nail Challenges</h1>
          </div>
        </div>
        <p style={{ ...ui(300, 14, WHITE60), padding: '0 20px 20px', margin: 0 }}>Submit your look, vote for your favourites</p>

        <div style={{ padding: '0 20px' }}>
          {loading ? (
            <p style={{ ...ui(300, 14, WHITE60), textAlign: 'center', padding: '48px 0' }}>Loading…</p>
          ) : challenges.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ ...ui(500, 15), marginBottom: '8px' }}>No challenges yet</p>
              <p style={ui(300, 13, WHITE60)}>No challenges running right now — check back soon.</p>
            </div>
          ) : (
            <>
              {active.length > 0 && (
                <>
                  <p style={{ ...sectionLabel, color: WHITE60, display: 'block', marginBottom: '10px' }}>Active</p>
                  {active.map(c => <ChallengeCard key={c.id} challenge={c} isActive />)}
                </>
              )}
              {past.length > 0 && (
                <>
                  <p style={{ ...sectionLabel, color: WHITE60, display: 'block', margin: '20px 0 10px' }}>Past challenges</p>
                  {past.map(c => <ChallengeCard key={c.id} challenge={c} isActive={false} />)}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
