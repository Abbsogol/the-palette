'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const DAYS = [
  { label: 'Sunday',    short: 'Sun', value: 0 },
  { label: 'Monday',    short: 'Mon', value: 1 },
  { label: 'Tuesday',   short: 'Tue', value: 2 },
  { label: 'Wednesday', short: 'Wed', value: 3 },
  { label: 'Thursday',  short: 'Thu', value: 4 },
  { label: 'Friday',    short: 'Fri', value: 5 },
  { label: 'Saturday',  short: 'Sat', value: 6 },
]

const TIME_OPTIONS = []
for (let h = 6; h <= 23; h++) {
  for (let m of [0, 30]) {
    const hour12 = h % 12 === 0 ? 12 : h % 12
    const ampm = h < 12 ? 'am' : 'pm'
    const label = `${hour12}:${m === 0 ? '00' : '30'} ${ampm}`
    const value = `${String(h).padStart(2, '0')}:${m === 0 ? '00' : '30'}`
    TIME_OPTIONS.push({ label, value })
  }
}

const DEFAULT_START = '10:00'
const DEFAULT_END = '19:00'

export default function AvailabilityPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Schedule: day_of_week → { is_active, start_time, end_time }
  const [schedule, setSchedule] = useState(() =>
    Object.fromEntries(DAYS.map(d => [d.value, { is_active: false, start_time: DEFAULT_START, end_time: DEFAULT_END }]))
  )

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/profile'); return }
      const { data: profile } = await supabase.from('profiles').select('account_type').eq('id', user.id).single()
      if (!profile || !['nail_artist', 'creator', 'salon'].includes(profile.account_type)) {
        router.push('/profile'); return
      }
      setCurrentUser(user)

      // Load existing availability
      const { data: rows } = await supabase
        .from('availability')
        .select('*')
        .eq('creator_id', user.id)

      if (rows && rows.length > 0) {
        const loaded = { ...schedule }
        rows.forEach(r => {
          loaded[r.day_of_week] = {
            is_active: r.is_active,
            start_time: r.start_time.slice(0, 5),
            end_time: r.end_time.slice(0, 5),
          }
        })
        setSchedule(loaded)
      }

      setLoading(false)
    }
    init()
  }, [])

  const toggleDay = (day) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], is_active: !prev[day].is_active }
    }))
    setSaved(false)
  }

  const setTime = (day, field, value) => {
    setSchedule(prev => ({
      ...prev,
      [day]: { ...prev[day], [field]: value }
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)

    // Upsert all 7 days
    const rows = DAYS.map(d => ({
      creator_id: currentUser.id,
      day_of_week: d.value,
      is_active: schedule[d.value].is_active,
      start_time: schedule[d.value].start_time,
      end_time: schedule[d.value].end_time,
    }))

    const { error } = await supabase
      .from('availability')
      .upsert(rows, { onConflict: 'creator_id,day_of_week' })

    setSaving(false)
    if (error) {
      alert('Failed to save availability. Please try again.')
      return
    }
    setSaved(true)
  }

  const chevronRight = (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 4l4 4-4 4" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  const activeDays = DAYS.filter(d => schedule[d.value].is_active)

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '100px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/profile" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </Link>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0 }}>My Availability</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '20px', padding: '7px 16px', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', padding: '0 20px 20px', margin: 0 }}>
        Set the days and hours you're available for bookings. Clients will see this on your profile.
      </p>

      {/* Summary chip */}
      {activeDays.length > 0 && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ background: 'rgba(212,160,192,0.1)', border: '0.5px solid rgba(212,160,192,0.3)', borderRadius: '10px', padding: '10px 14px' }}>
            <p style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '500', margin: 0 }}>
              Available: {activeDays.map(d => d.short).join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Days */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {DAYS.map(day => {
          const s = schedule[day.value]
          return (
            <div
              key={day.value}
              style={{
                background: 'var(--bg-card)',
                border: `0.5px solid ${s.is_active ? 'rgba(212,160,192,0.4)' : 'var(--border)'}`,
                borderRadius: '14px',
                padding: '14px 16px',
                opacity: s.is_active ? 1 : 0.6,
                transition: 'all 0.15s',
              }}
            >
              {/* Day toggle row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: s.is_active ? '14px' : 0 }}>
                <span style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500' }}>{day.label}</span>
                {/* Toggle switch */}
                <button
                  type="button"
                  onClick={() => toggleDay(day.value)}
                  aria-pressed={s.is_active}
                  aria-label={`Toggle ${day.label} availability`}
                  style={{
                    width: '44px', height: '26px', borderRadius: '13px',
                    background: s.is_active ? 'var(--accent)' : 'var(--bg-chip)',
                    position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0,
                    border: 'none', padding: 0,
                  }}
                >
                  <div style={{
                    position: 'absolute', top: '3px',
                    left: s.is_active ? '21px' : '3px',
                    width: '20px', height: '20px', borderRadius: '50%',
                    background: s.is_active ? '#2C0A1E' : 'var(--text-secondary)',
                    transition: 'left 0.2s',
                  }} />
                </button>
              </div>

              {/* Time pickers — only when active */}
              {s.is_active && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Opens</label>
                    <select
                      value={s.start_time}
                      onChange={e => setTime(day.value, 'start_time', e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '9px 10px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
                    >
                      {TIME_OPTIONS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px', paddingTop: '18px' }}>–</span>
                  <div style={{ flex: 1 }}>
                    <label style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Closes</label>
                    <select
                      value={s.end_time}
                      onChange={e => setTime(day.value, 'end_time', e.target.value)}
                      style={{ width: '100%', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '9px 10px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
                    >
                      {TIME_OPTIONS.filter(t => t.value > s.start_time).map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

    </div>
  )
}
