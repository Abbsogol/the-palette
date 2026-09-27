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
const selectStyle = { width: '100%', background: 'rgba(255,255,255,0.04)', border: PANEL_BORDER, borderRadius: '10px', padding: '9px 10px', ...ui(400, 13), outline: 'none' }

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

function Toggle({ on, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      aria-label={label}
      style={{
        width: '48px', height: '28px', borderRadius: '1000px', border: 'none', cursor: 'pointer',
        background: on ? ACCENT : 'rgba(255,255,255,0.15)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0, padding: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: '3px', left: on ? '23px' : '3px',
        width: '22px', height: '22px', borderRadius: '50%', background: '#fff', transition: 'left 0.2s',
      }} />
    </button>
  )
}

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

  const Shell = ({ children }) => (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}>{children}</div>
    </div>
  )

  if (loading) return (
    <Shell>
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={ui(300, 14, WHITE60)}>Loading…</p>
      </div>
    </Shell>
  )

  const activeDays = DAYS.filter(d => schedule[d.value].is_active)

  return (
    <Shell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <BackButton fallback="/profile" />
          <h1 style={{ ...display(24), margin: 0 }}>My Availability</h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          style={{ background: BTN_GRADIENT, color: 'var(--lq-white)', border: 'none', borderRadius: '1000px', padding: '8px 18px', ...ui(500, 13), cursor: 'pointer', flexShrink: 0 }}
        >
          {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>

      <p style={{ ...ui(300, 13, WHITE60), padding: '0 20px 20px', margin: 0 }}>
        Set the days and hours you&apos;re available for bookings. Clients will see this on your profile.
      </p>

      {/* Summary chip */}
      {activeDays.length > 0 && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ background: 'rgba(255,81,127,0.1)', border: '1px solid rgba(255,81,127,0.3)', borderRadius: '12px', padding: '10px 14px' }}>
            <p style={{ ...ui(500, 12, ACCENT), margin: 0 }}>
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
                background: PANEL,
                border: `1px solid ${s.is_active ? 'rgba(255,81,127,0.4)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '16px',
                padding: '14px 16px',
                opacity: s.is_active ? 1 : 0.62,
                transition: 'all 0.15s',
              }}
            >
              {/* Day toggle row */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: s.is_active ? '14px' : 0 }}>
                <span style={ui(500, 15)}>{day.label}</span>
                <Toggle on={s.is_active} onClick={() => toggleDay(day.value)} label={`Toggle ${day.label} availability`} />
              </div>

              {/* Time pickers — only when active */}
              {s.is_active && (
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...ui(500, 10, WHITE60), letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Opens</label>
                    <select value={s.start_time} onChange={e => setTime(day.value, 'start_time', e.target.value)} style={selectStyle}>
                      {TIME_OPTIONS.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                  <span style={{ ...ui(400, 13, WHITE60), paddingTop: '18px' }}>–</span>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...ui(500, 10, WHITE60), letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '5px' }}>Closes</label>
                    <select value={s.end_time} onChange={e => setTime(day.value, 'end_time', e.target.value)} style={selectStyle}>
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
    </Shell>
  )
}
