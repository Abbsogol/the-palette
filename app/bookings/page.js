'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

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

function fmtDuration(mins) {
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`
}

function StatusBadge({ status }) {
  const map = {
    pending:   { label: 'Pending',   bg: 'rgba(212,160,192,0.15)', color: 'var(--accent)' },
    confirmed: { label: 'Confirmed', bg: 'rgba(100,200,130,0.15)', color: '#6CC882' },
    declined:  { label: 'Declined',  bg: 'rgba(200,100,100,0.15)', color: '#E07070' },
    cancelled: { label: 'Cancelled', bg: 'rgba(136,136,136,0.15)', color: 'var(--text-secondary)' },
  }
  const s = map[status] || map.pending
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: '11px', fontWeight: '600', padding: '3px 9px', borderRadius: '20px', letterSpacing: '0.03em' }}>
      {s.label}
    </span>
  )
}

function BookingCard({ booking }) {
  const client = booking.client
  const service = booking.service

  return (
    <Link href={`/bookings/${booking.id}`} style={{ textDecoration: 'none', display: 'block', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', marginBottom: '10px' }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {client?.avatar_url
              ? <img src={client.avatar_url} alt={client.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: '600' }}>{(client?.display_name || '?')[0].toUpperCase()}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3px' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {client?.display_name || 'Client'}
              </p>
              <StatusBadge status={booking.status} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>
              {service?.name} · {fmtDate(booking.booking_date)}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '2px 0 0' }}>
              {fmt12(booking.start_time)} – {fmt12(booking.end_time)}
              {booking.status === 'pending' && <span style={{ color: 'var(--accent)', fontWeight: '600' }}> · Needs response</span>}
            </p>
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <path d="M5 3L9 7L5 11" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
    </Link>
  )
}

export default function BookingsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('requests')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('account_type').eq('id', user.id).single()
      if (!profile || !['nail_artist', 'creator', 'salon'].includes(profile.account_type)) {
        router.push('/profile'); return
      }
      setCurrentUser(user)
      await loadBookings(user.id)
      setLoading(false)
    }
    init()
  }, [])

  const loadBookings = async (userId) => {
    const { data } = await supabase
      .from('bookings')
      .select('*, service:services(*)')
      .eq('creator_id', userId)
      .order('booking_date', { ascending: true })
      .order('start_time', { ascending: true })

    if (!data) { setBookings([]); return }

    // Fetch client profiles
    const clientIds = [...new Set(data.map(b => b.client_id))]
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .in('id', clientIds)

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    setBookings(data.map(b => ({ ...b, client: profileMap[b.client_id] || null })))
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

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '100px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px' }}>
        <Link href="/profile" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Link>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0, flex: 1 }}>Bookings</h1>
        <Link href="/planner" style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          background: 'var(--bg-chip)', borderRadius: '8px', padding: '6px 12px',
          color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500', textDecoration: 'none',
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
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', margin: '0 20px 20px' }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, background: 'none', border: 'none',
              borderBottom: tab === t.key ? '2px solid var(--accent)' : '2px solid transparent',
              color: tab === t.key ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '13px', fontWeight: tab === t.key ? '600' : '400',
              fontFamily: "'DM Sans', sans-serif",
              padding: '10px 0', cursor: 'pointer',
            }}
          >
            {t.label}
            {t.count > 0 && (
              <span style={{ marginLeft: '5px', background: t.key === 'requests' ? 'var(--accent)' : 'var(--bg-chip)', color: t.key === 'requests' ? '#2C0A1E' : 'var(--text-secondary)', fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '20px' }}>
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
            <div style={{ fontSize: '28px', marginBottom: '12px' }}>✦</div>
            <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', margin: '0 0 8px' }}>{emptyMessages[tab].title}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>{emptyMessages[tab].sub}</p>
          </div>
        ) : (
          activeList.map(b => <BookingCard key={b.id} booking={b} />)
        )}
      </div>
    </div>
  )
}
