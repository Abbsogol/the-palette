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

function BookingCard({ booking }) {
  const client = booking.client
  const service = booking.service

  return (
    <Link href={`/bookings/${booking.id}`} style={{ textDecoration: 'none', display: 'block', background: PANEL, border: PANEL_BORDER, borderRadius: '16px', marginBottom: '10px' }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: PANEL_BORDER }}>
            {client?.avatar_url
              ? <img src={client.avatar_url} alt={client.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={ui(600, 16, ACCENT)}>{(client?.display_name || '?')[0].toUpperCase()}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '3px' }}>
              <p style={{ ...ui(600, 14), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {client?.display_name || 'Client'}
              </p>
              <StatusBadge status={booking.status} />
            </div>
            <p style={{ ...ui(300, 12, WHITE60), margin: 0 }}>
              {service?.name} · {fmtDate(booking.booking_date)}
            </p>
            <p style={{ ...ui(300, 12, WHITE60), margin: '2px 0 0' }}>
              {fmt12(booking.start_time)} – {fmt12(booking.end_time)}
              {booking.status === 'pending' && <span style={{ color: ACCENT, fontWeight: 600 }}> · Needs response</span>}
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

export default function BookingsPage() {
  const router = useRouter()
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  // Active tab persists per session so back-from-detail lands on the same tab
  // (scroll memory is keyed per tab; the tab itself must survive too).
  const [tab, setTabState] = useState(() => {
    try { return sessionStorage.getItem('lq-tab:/bookings') || 'requests' } catch { return 'requests' }
  })
  const setTab = (t) => { setTabState(t); try { sessionStorage.setItem('lq-tab:/bookings', t) } catch {} }
  useScrollMemory(tab, !loading)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/profile'); return }
      const { data: profile } = await supabase.from('profiles').select('account_type').eq('id', user.id).single()
      if (!profile || !['nail_artist', 'creator', 'salon'].includes(profile.account_type)) {
        router.push('/profile'); return
      }
      await loadBookings(user.id)
      setLoading(false)
    }
    init()
  }, [])

  const loadBookings = async (userId) => {
    // Ordered newest-first + capped so the limit drops old history rather
    // than cutting off upcoming bookings, then reversed back to
    // chronological order for display.
    const { data, error } = await supabase
      .from('bookings')
      .select('*, service:services(*)')
      .eq('creator_id', userId)
      .order('booking_date', { ascending: false })
      .order('start_time', { ascending: false })
      .limit(300)
    if (error) console.error('bookings fetch failed:', error)
    if (!data) { setBookings([]); return }
    const chronological = data.slice().reverse()

    // Fetch client profiles
    const clientIds = [...new Set(chronological.map(b => b.client_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', clientIds)

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    setBookings(chronological.map(b => ({ ...b, client: profileMap[b.client_id] || null })))
  }

  const today = new Date().toISOString().split('T')[0]

  const pending   = bookings.filter(b => b.status === 'pending')
  const upcoming  = bookings.filter(b => b.status === 'confirmed' && b.booking_date >= today)
  const past      = bookings.filter(b =>
    b.status === 'declined' || b.status === 'cancelled' ||
    (b.status === 'confirmed' && b.booking_date < today)
  )

  const tabs = [
    { key: 'requests', label: 'Requests', count: pending.length },
    { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
    { key: 'past',     label: 'Past',     count: past.length },
  ]

  const activeList = tab === 'requests' ? pending : tab === 'upcoming' ? upcoming : past

  const emptyMessages = {
    requests: { title: 'No pending requests', sub: 'New booking requests from clients will appear here.' },
    upcoming: { title: 'No upcoming bookings', sub: 'Confirmed appointments will show here.' },
    past:     { title: 'No past bookings', sub: 'Completed and cancelled bookings will show here.' },
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
        <h1 style={{ ...display(24), margin: 0, flex: 1 }}>Bookings</h1>
        <Link href="/planner" style={{
          display: 'flex', alignItems: 'center', gap: '6px',
          background: PANEL, border: PANEL_BORDER, borderRadius: '1000px', padding: '7px 13px',
          ...ui(500, 12, WHITE60), textDecoration: 'none',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/>
            <line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          Planner
        </Link>
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
              <span style={{ marginLeft: '5px', background: t.key === 'requests' ? ACCENT : PANEL, color: t.key === 'requests' ? '#260D14' : WHITE60, ...ui(700, 10), padding: '1px 6px', borderRadius: '1000px' }}>
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
            <p style={{ ...ui(300, 13, WHITE60), margin: 0 }}>{emptyMessages[tab].sub}</p>
          </div>
        ) : (
          activeList.map(b => <BookingCard key={b.id} booking={b} />)
        )}
      </div>
    </Shell>
  )
}
