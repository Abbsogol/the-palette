'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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
        background: 'var(--bg-card)', border: `0.5px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: '16px', padding: '18px 16px', marginBottom: '12px',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', margin: 0, flex: 1, paddingRight: '12px' }}>{challenge.title}</p>
          <span style={{
            background: ended ? 'var(--bg-chip)' : 'rgba(212,160,192,0.15)',
            color: ended ? 'var(--text-secondary)' : 'var(--accent)',
            fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px', flexShrink: 0,
          }}>
            {ended ? 'Ended' : timeLeft}
          </span>
        </div>
        {challenge.description && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', margin: '0 0 10px' }}>{challenge.description}</p>
        )}
        <p style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '500', margin: 0 }}>
          {ended ? 'View results →' : 'Enter & vote →'}
        </p>
      </div>
    </Link>
  )
}

export default function ChallengesPage() {
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)

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
    <div style={{ paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ padding: '24px 20px 20px' }}>
        <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>Community</p>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', letterSpacing: '-0.02em', margin: 0 }}>Nail Challenges</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '6px' }}>Submit your look, vote for your favourites</p>
      </div>

      <div style={{ padding: '0 20px' }}>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>Loading…</p>
        ) : challenges.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>No challenges yet</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Check back soon — we drop new challenges weekly.</p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <>
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Active</p>
                {active.map(c => <ChallengeCard key={c.id} challenge={c} isActive />)}
              </>
            )}
            {past.length > 0 && (
              <>
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '20px 0 10px' }}>Past challenges</p>
                {past.map(c => <ChallengeCard key={c.id} challenge={c} isActive={false} />)}
              </>
            )}
          </>
        )}
      </div>
    </div>
  )
}
