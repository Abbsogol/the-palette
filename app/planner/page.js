'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m > 0 ? `:${String(m).padStart(2,'0')}` : ''}${ampm}`
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getWeekStart(d) {
  const day = new Date(d)
  day.setDate(d.getDate() - d.getDay()) // Sunday
  day.setHours(0,0,0,0)
  return day
}

export default function PlannerPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('id', user.id)
        .single()

      if (!profile || (profile.account_type !== 'creator' && profile.account_type !== 'salon')) {
        router.push('/profile')
        return
      }

      setCurrentUser(user)
      await loadBookings(user.id)
    }
    init()
  }, [])

  const loadBookings = async (userId) => {
    setLoading(true)
    const { data } = await supabase
      .from('bookings')
      .select('*, service:services(name, duration_minutes, price, deposit_amount)')
      .eq('creator_id', userId)
      .in('status', ['confirmed', 'pending'])
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (!data) { setLoading(false); return }

    // Fetch client profiles
    const clientIds = [...new Set(data.map(b => b.client_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url')
      .in('id', clientIds)

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    setBookings(data.map(b => ({ ...b, client: profileMap[b.client_id] || null })))
    setLoading(false)
  }

  // Build the 7 days of the current week
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const todayStr = toDateStr(new Date())

  const prevWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() - 7)
    setWeekStart(d)
  }
  const nextWeek = () => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + 7)
    setWeekStart(d)
  }
  const goToday = () => setWeekStart(getWeekStart(new Date()))

  const bookingsForDay = (dateStr) =>
    bookings.filter(b => b.booking_date === dateStr)

  const weekLabel = () => {
    const end = new Date(weekStart)
    end.setDate(weekStart.getDate() + 6)
    const s = weekStart, e = end
    if (s.getMonth() === e.getMonth()) {
      return `${s.getDate()}–${e.getDate()} ${MONTH_NAMES[s.getMonth()]} ${s.getFullYear()}`
    }
    return `${s.getDate()} ${MONTH_NAMES[s.getMonth()]} – ${e.getDate()} ${MONTH_NAMES[e.getMonth()]} ${e.getFullYear()}`
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '100px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px' }}>
        <Link href="/bookings" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Link>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0, flex: 1 }}>Planner</h1>
        <button
          onClick={goToday}
          style={{ background: 'var(--bg-chip)', border: 'none', borderRadius: '8px', padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Today
        </button>
      </div>

      {/* Week navigation */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px 16px' }}>
        <button onClick={prevWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '6px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 18l-6-6 6-6"/>
          </svg>
        </button>
        <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: 0 }}>{weekLabel()}</p>
        <button onClick={nextWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: '6px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 18l6-6-6-6"/>
          </svg>
        </button>
      </div>

      {/* Day columns */}
      <div style={{ padding: '0 12px', display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px' }}>
        {weekDays.map((day) => {
          const dateStr = toDateStr(day)
          const isToday = dateStr === todayStr
          const dayBookings = bookingsForDay(dateStr)

          return (
            <div key={dateStr} style={{ flex: '0 0 calc(14.28% - 5px)', minWidth: '100px' }}>
              {/* Day header */}
              <div style={{
                textAlign: 'center', padding: '8px 4px 10px',
                borderBottom: isToday ? '2px solid var(--accent)' : '0.5px solid var(--border)',
                marginBottom: '8px',
              }}>
                <p style={{ color: isToday ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', margin: '0 0 2px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                  {DAY_SHORT[day.getDay()]}
                </p>
                <p style={{
                  color: isToday ? 'var(--accent)' : 'var(--text-primary)',
                  fontSize: '18px', fontWeight: isToday ? '700' : '400', margin: 0,
                }}>
                  {day.getDate()}
                </p>
              </div>

              {/* Booking cards for this day */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {dayBookings.length === 0 ? (
                  <div style={{ height: '40px' }} />
                ) : (
                  dayBookings.map(b => {
                    const isExp = expanded === b.id
                    return (
                      <div
                        key={b.id}
                        onClick={() => setExpanded(isExp ? null : b.id)}
                        style={{
                          background: b.status === 'confirmed' ? 'rgba(212,160,192,0.12)' : 'rgba(212,160,192,0.06)',
                          border: `0.5px solid ${b.status === 'confirmed' ? 'rgba(212,160,192,0.4)' : 'var(--border)'}`,
                          borderRadius: '10px', padding: '8px', cursor: 'pointer',
                        }}
                      >
                        <p style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '700', margin: '0 0 2px' }}>
                          {fmt12(b.start_time)}
                        </p>
                        <p style={{ color: 'var(--text-primary)', fontSize: '11px', fontWeight: '600', margin: '0 0 2px', lineHeight: '1.3', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                          {b.client?.display_name || 'Client'}
                        </p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '10px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {b.service?.name}
                        </p>

                        {isExp && (
                          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '0.5px solid var(--border)' }}>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '10px', margin: '0 0 2px' }}>
                              {fmt12(b.start_time)} – {fmt12(b.end_time)}
                            </p>
                            {b.service?.duration_minutes && (
                              <p style={{ color: 'var(--text-secondary)', fontSize: '10px', margin: '0 0 2px' }}>
                                {b.service.duration_minutes < 60
                                  ? `${b.service.duration_minutes} min`
                                  : `${Math.floor(b.service.duration_minutes/60)}h ${b.service.duration_minutes%60>0?b.service.duration_minutes%60+'m':''}`}
                              </p>
                            )}
                            {b.notes && (
                              <p style={{ color: 'var(--text-secondary)', fontSize: '10px', margin: '4px 0 0', fontStyle: 'italic', lineHeight: '1.4' }}>
                                "{b.notes}"
                              </p>
                            )}
                            <div style={{ marginTop: '6px' }}>
                              <span style={{
                                fontSize: '9px', fontWeight: '700', letterSpacing: '0.05em', textTransform: 'uppercase',
                                color: b.status === 'confirmed' ? '#6CC882' : 'var(--accent)',
                                background: b.status === 'confirmed' ? 'rgba(100,200,130,0.12)' : 'rgba(212,160,192,0.15)',
                                padding: '2px 6px', borderRadius: '6px',
                              }}>
                                {b.status}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Weekly summary */}
      <div style={{ margin: '20px 20px 0', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '16px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }}>This week</p>
        <div style={{ display: 'flex', gap: '0', justifyContent: 'space-around' }}>
          {[
            {
              label: 'Appointments',
              value: weekDays.reduce((n, d) => n + bookingsForDay(toDateStr(d)).filter(b => b.status === 'confirmed').length, 0),
            },
            {
              label: 'Pending',
              value: weekDays.reduce((n, d) => n + bookingsForDay(toDateStr(d)).filter(b => b.status === 'pending').length, 0),
            },
            {
              label: 'Busiest day',
              value: (() => {
                const counts = weekDays.map(d => ({ day: DAY_SHORT[d.getDay()], n: bookingsForDay(toDateStr(d)).length }))
                const max = counts.reduce((a, b) => b.n > a.n ? b : a, { day: '—', n: 0 })
                return max.n > 0 ? max.day : '—'
              })(),
            },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '700', margin: '0 0 4px' }}>{value}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
