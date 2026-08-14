'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m > 0 ? `:${String(m).padStart(2,'0')}` : ''}${ampm}`
}

function fmtDuration(mins) {
  if (!mins) return ''
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h}h ${m}m` : `${h}h`
}

function toDateStr(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getWeekStart(d) {
  const day = new Date(d)
  day.setDate(d.getDate() - d.getDay())
  day.setHours(0,0,0,0)
  return day
}

export default function PlannerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [bookings, setBookings] = useState([])
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()))
  const [selectedDay, setSelectedDay] = useState(() => toDateStr(new Date()))
  const [expanded, setExpanded] = useState(null)
  const dayRefs = useRef({})

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/profile'); return }

      const { data: profile } = await supabase
        .from('profiles').select('account_type').eq('id', user.id).single()

      if (!profile || (profile.account_type !== 'creator' && profile.account_type !== 'salon')) {
        router.push('/profile'); return
      }

      // Ordered newest-first + capped so the limit drops old history rather
      // than cutting off upcoming bookings, then reversed for display.
      const { data: rawData, error } = await supabase
        .from('bookings')
        .select('*, service:services(name, duration_minutes, price)')
        .eq('creator_id', user.id)
        .in('status', ['confirmed', 'pending'])
        .order('booking_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(300)
      if (error) console.error('planner bookings fetch failed:', error)
      const data = rawData ? rawData.slice().reverse() : rawData

      if (data && data.length > 0) {
        const clientIds = [...new Set(data.map(b => b.client_id))]
        const { data: profiles } = await supabase
          .from('profiles').select('id, display_name, avatar_url').in('id', clientIds)
        const pm = Object.fromEntries((profiles || []).map(p => [p.id, p]))
        setBookings(data.map(b => ({ ...b, client: pm[b.client_id] || null })))
      }
      setLoading(false)
    }
    init()
  }, [])

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    return d
  })

  const todayStr = toDateStr(new Date())

  const bookingsForDay = (dateStr) => bookings.filter(b => b.booking_date === dateStr)

  const prevWeek = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d)
    setSelectedDay(toDateStr(d))
  }
  const nextWeek = () => {
    const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d)
    setSelectedDay(toDateStr(d))
  }

  const weekLabel = () => {
    const end = new Date(weekStart); end.setDate(weekStart.getDate() + 6)
    if (weekStart.getMonth() === end.getMonth())
      return `${weekStart.getDate()}–${end.getDate()} ${MONTH_NAMES[weekStart.getMonth()]}`
    return `${weekStart.getDate()} ${MONTH_NAMES[weekStart.getMonth()]} – ${end.getDate()} ${MONTH_NAMES[end.getMonth()]}`
  }

  const selectDay = (dateStr) => {
    setSelectedDay(dateStr)
    const el = dayRefs.current[dateStr]
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const weekBookings = weekDays.reduce((n, d) => n + bookingsForDay(toDateStr(d)).length, 0)
  const confirmedCount = weekDays.reduce((n, d) => n + bookingsForDay(toDateStr(d)).filter(b => b.status === 'confirmed').length, 0)

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '60px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px 12px' }}>
        <Link href="/bookings" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Link>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0, flex: 1 }}>Planner</h1>
        <button
          onClick={() => { setWeekStart(getWeekStart(new Date())); setSelectedDay(todayStr) }}
          style={{ background: 'var(--bg-chip)', border: 'none', borderRadius: '8px', padding: '6px 12px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}
        >
          Today
        </button>
      </div>

      {/* Week nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 8px 16px' }}>
        <button onClick={prevWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px 12px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: 0 }}>{weekLabel()}</p>
        <button onClick={nextWeek} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: '8px 12px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>

      {/* Day pill selector */}
      <div style={{ display: 'flex', gap: '6px', padding: '0 20px 20px', overflowX: 'auto' }}>
        {weekDays.map(day => {
          const dateStr = toDateStr(day)
          const isToday = dateStr === todayStr
          const isSelected = dateStr === selectedDay
          const count = bookingsForDay(dateStr).length
          return (
            <button
              key={dateStr}
              onClick={() => selectDay(dateStr)}
              style={{
                flex: '0 0 auto',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px',
                padding: '10px 14px', borderRadius: '14px', border: 'none', cursor: 'pointer',
                background: isSelected ? 'var(--accent)' : isToday ? 'rgba(212,160,192,0.1)' : 'var(--bg-card)',
                outline: isToday && !isSelected ? '0.5px solid rgba(212,160,192,0.3)' : 'none',
                fontFamily: 'inherit',
              }}
            >
              <span style={{ fontSize: '11px', fontWeight: '600', color: isSelected ? '#2C0A1E' : 'var(--text-secondary)', letterSpacing: '0.04em' }}>
                {DAY_SHORT[day.getDay()]}
              </span>
              <span style={{ fontSize: '17px', fontWeight: '700', color: isSelected ? '#2C0A1E' : isToday ? 'var(--accent)' : 'var(--text-primary)', lineHeight: 1 }}>
                {day.getDate()}
              </span>
              {count > 0 && (
                <span style={{
                  width: '6px', height: '6px', borderRadius: '50%',
                  background: isSelected ? '#2C0A1E' : 'var(--accent)',
                }} />
              )}
            </button>
          )
        })}
      </div>

      {/* Weekly stats bar */}
      {weekBookings > 0 && (
        <div style={{ display: 'flex', gap: '10px', padding: '0 20px 20px' }}>
          <div style={{ flex: 1, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '700', margin: '0 0 2px' }}>{confirmedCount}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>Confirmed</p>
          </div>
          <div style={{ flex: 1, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '700', margin: '0 0 2px' }}>{weekBookings - confirmedCount}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>Pending</p>
          </div>
          <div style={{ flex: 1, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '700', margin: '0 0 2px' }}>{weekBookings}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>This week</p>
          </div>
        </div>
      )}

      {/* Day sections */}
      <div style={{ padding: '0 20px' }}>
        {weekDays.map(day => {
          const dateStr = toDateStr(day)
          const isToday = dateStr === todayStr
          const dayBookings = bookingsForDay(dateStr)

          return (
            <div key={dateStr} ref={el => dayRefs.current[dateStr] = el} style={{ marginBottom: '24px' }}>
              {/* Day header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                  background: isToday ? 'var(--accent)' : 'var(--bg-card)',
                  border: isToday ? 'none' : '0.5px solid var(--border)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '8px', fontWeight: '700', color: isToday ? '#2C0A1E' : 'var(--text-secondary)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    {DAY_SHORT[day.getDay()]}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: '700', color: isToday ? '#2C0A1E' : 'var(--text-primary)', lineHeight: 1 }}>
                    {day.getDate()}
                  </span>
                </div>
                <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
                {dayBookings.length > 0 && (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500' }}>
                    {dayBookings.length} {dayBookings.length === 1 ? 'appt' : 'appts'}
                  </span>
                )}
              </div>

              {dayBookings.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 0 46px', opacity: 0.5 }}>Free</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginLeft: '46px' }}>
                  {dayBookings.map(b => {
                    const isExp = expanded === b.id
                    const isConfirmed = b.status === 'confirmed'
                    return (
                      <div
                        key={b.id}
                        onClick={() => setExpanded(isExp ? null : b.id)}
                        style={{
                          background: 'var(--bg-card)',
                          border: '0.5px solid var(--border)',
                          borderLeft: `3px solid ${isConfirmed ? 'var(--accent)' : 'rgba(212,160,192,0.3)'}`,
                          borderRadius: '12px', padding: '12px 14px',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                              <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '700' }}>{fmt12(b.start_time)}</span>
                              {b.service?.duration_minutes && (
                                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{fmtDuration(b.service.duration_minutes)}</span>
                              )}
                            </div>
                            <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', margin: '0 0 2px' }}>
                              {b.client?.display_name || 'Client'}
                            </p>
                            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>
                              {b.service?.name || 'Service'}
                            </p>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0, marginLeft: '12px' }}>
                            <span style={{
                              fontSize: '10px', fontWeight: '700', letterSpacing: '0.04em', textTransform: 'uppercase',
                              color: isConfirmed ? '#6CC882' : 'var(--accent)',
                              background: isConfirmed ? 'rgba(100,200,130,0.12)' : 'rgba(212,160,192,0.12)',
                              padding: '3px 8px', borderRadius: '6px',
                            }}>{b.status}</span>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                              <path d="M6 9l6 6 6-6"/>
                            </svg>
                          </div>
                        </div>

                        {isExp && (
                          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Time</span>
                              <span style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500' }}>{fmt12(b.start_time)} – {fmt12(b.end_time)}</span>
                            </div>
                            {b.service?.price > 0 && (
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Price</span>
                                <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '600' }}>AED {b.service.price}</span>
                              </div>
                            )}
                            {b.notes && (
                              <div style={{ background: 'var(--bg-chip)', borderRadius: '8px', padding: '8px 10px', marginTop: '4px' }}>
                                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0, lineHeight: '1.5', fontStyle: 'italic' }}>"{b.notes}"</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}

        {weekBookings === 0 && (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <p style={{ fontSize: '28px', margin: '0 0 12px' }}>✦</p>
            <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', margin: '0 0 6px' }}>Nothing this week</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>No confirmed or pending appointments.</p>
          </div>
        )}
      </div>
    </div>
  )
}
