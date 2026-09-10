'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'
import { useScrollMemory } from '@/lib/scrollMemory'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m > 0 ? `:${String(m).padStart(2,'0')}` : ''}${ampm}`
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
}

function StatusBadge({ status }) {
  const map = {
    pending:   { label: 'Pending',   bg: 'rgba(255,81,127,0.15)',  color: ACCENT },
    confirmed: { label: 'Confirmed', bg: 'rgba(108,200,130,0.15)', color: '#6CC882' },
    declined:  { label: 'Declined',  bg: 'rgba(224,112,112,0.15)', color: '#E07070' },
    cancelled: { label: 'Cancelled', bg: 'rgba(255,255,255,0.1)',  color: WHITE60 },
  }
  const s = map[status] || map.pending
  return (
    <span style={{ background: s.bg, color: s.color, ...ui(600, 11), padding: '3px 9px', borderRadius: '1000px', letterSpacing: '0.03em' }}>
      {s.label}
    </span>
  )
}

function AppointmentCard({ booking }) {
  const creator = booking.creator
  const service = booking.service
  const showDepositDot = booking.status === 'confirmed' && service?.deposit_amount > 0 && !booking.deposit_paid

  return (
    <Link href={`/appointments/${booking.id}`} style={{ textDecoration: 'none', display: 'block', background: PANEL, border: PANEL_BORDER, borderRadius: '16px', marginBottom: '10px' }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: PANEL_BORDER }}>
            {creator?.avatar_url
              ? <img src={creator.avatar_url} alt={creator.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={ui(600, 16, ACCENT)}>{(creator?.display_name || '?')[0].toUpperCase()}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '3px' }}>
              <p style={{ ...ui(600, 14), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {creator?.display_name || 'Artist'}
              </p>
              <StatusBadge status={booking.status} />
            </div>
            <p style={{ ...ui(300, 12, WHITE60), margin: 0 }}>
              {service?.name} · {fmtDate(booking.booking_date)}
            </p>
            <p style={{ ...ui(300, 12, WHITE60), margin: '2px 0 0' }}>
              {fmt12(booking.start_time)} – {fmt12(booking.end_time)}
              {showDepositDot && <span style={{ color: ACCENT, fontWeight: 600 }}> · Deposit due</span>}
            </p>
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <path d="M5 3L9 7L5 11" stroke={WHITE60} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </Link>
  )
}

export default function AppointmentsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  // Active tab persists per session so back-from-detail lands on the same tab
  // (scroll memory is keyed per tab; the tab itself must survive too).
  const [tab, setTabState] = useState(() => {
    try { return sessionStorage.getItem('lq-tab:/appointments') || 'upcoming' } catch { return 'upcoming' }
  })
  const setTab = (t) => { setTabState(t); try { sessionStorage.setItem('lq-tab:/appointments', t) } catch {} }
  useScrollMemory(tab, !loading)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/profile'); return }

      // Ordered newest-first + capped so the limit drops old history rather
      // than cutting off upcoming appointments, then reversed for display.
      const { data: rawData, error } = await supabase
        .from('bookings')
        .select('*, service:services(*)')
        .eq('client_id', user.id)
        .order('booking_date', { ascending: false })
        .order('start_time', { ascending: false })
        .limit(300)
      if (error) console.error('appointments fetch failed:', error)

      if (!rawData) { setLoading(false); return }
      const data = rawData.slice().reverse()

      // Fetch creator profiles
      const creatorIds = [...new Set(data.map(b => b.creator_id))]
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', creatorIds)

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      setBookings(data.map(b => ({ ...b, creator: profileMap[b.creator_id] || null })))
      setLoading(false)
    }
    init()
  }, [])

  const today = new Date().toISOString().split('T')[0]

  const upcoming = bookings.filter(b => (b.status === 'pending' || b.status === 'confirmed') && b.booking_date >= today)
  const past     = bookings.filter(b => b.status === 'declined' || b.status === 'cancelled' || ((b.status === 'confirmed' || b.status === 'pending') && b.booking_date < today))

  const tabs = [
    { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
    { key: 'past',     label: 'Past',     count: past.length },
  ]

  const activeList = tab === 'upcoming' ? upcoming : past

  const emptyMessages = {
    upcoming: { title: 'No upcoming appointments', sub: 'Book an appointment with a nail artist or salon to get started.' },
    past:     { title: 'No past appointments', sub: 'Your completed and cancelled bookings will appear here.' },
  }

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 16px' }}>
        <BackButton fallback="/profile" />
        <h1 style={{ ...display(24), margin: 0 }}>My Appointments</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.08)', margin: '0 20px 20px' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, background: 'none', border: 'none',
              borderBottom: tab === t.key ? `2px solid ${ACCENT}` : '2px solid transparent',
              ...ui(tab === t.key ? 500 : 400, 13, tab === t.key ? 'var(--lq-white)' : WHITE60),
              padding: '10px 0', cursor: 'pointer',
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{ marginLeft: '5px', background: PANEL, color: WHITE60, ...ui(700, 10), padding: '1px 6px', borderRadius: '1000px' }}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ padding: '0 20px' }}>
        {activeList.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px', color: ACCENT }}>✦</div>
            <p style={{ ...ui(500, 15), margin: '0 0 8px' }}>{emptyMessages[tab].title}</p>
            <p style={{ ...ui(300, 13, WHITE60), margin: '0 0 24px' }}>{emptyMessages[tab].sub}</p>
            {tab === 'upcoming' && (
              <Link href="/search?tab=artists" style={{ background: BTN_GRADIENT, color: 'var(--lq-white)', borderRadius: '1000px', padding: '11px 24px', ...ui(500, 14), textDecoration: 'none' }}>
                Find an artist
              </Link>
            )}
          </div>
        ) : (
          activeList.map(b => <AppointmentCard key={b.id} booking={b} />)
        )}
      </div>
    </Shell>
  )
}
