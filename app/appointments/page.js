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
  if (!mins) return ''
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

function AppointmentCard({ booking }) {
  const creator = booking.creator
  const service = booking.service
  const showDepositDot = booking.status === 'confirmed' && service?.deposit_amount > 0 && !booking.deposit_paid

  return (
    <Link href={`/appointments/${booking.id}`} style={{ textDecoration: 'none', display: 'block', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', marginBottom: '10px' }}>
      <div style={{ padding: '14px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {creator?.avatar_url
              ? <img src={creator.avatar_url} alt={creator.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: '600' }}>{(creator?.display_name || '?')[0].toUpperCase()}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '3px' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {creator?.display_name || 'Artist'}
              </p>
              <StatusBadge status={booking.status} />
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>
              {service?.name} · {fmtDate(booking.booking_date)}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '2px 0 0' }}>
              {fmt12(booking.start_time)} – {fmt12(booking.end_time)}
              {showDepositDot && <span style={{ color: 'var(--accent)', fontWeight: '600' }}> · Deposit due</span>}
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

export default function AppointmentsPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUser(user)

      const { data } = await supabase
        .from('bookings')
        .select('*, service:services(*)')
        .eq('client_id', user.id)
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true })

      if (!data) { setLoading(false); return }

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
  const past     = bookings.filter(b => b.status === 'declined' || b.status === 'cancelled' || (b.status === 'confirmed' && b.booking_date < today))

  const tabs = [
    { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
    { key: 'past',     label: 'Past',     count: past.length },
  ]

  const activeList = tab === 'upcoming' ? upcoming : past

  const emptyMessages = {
    upcoming: { title: 'No upcoming appointments', sub: 'Book an appointment with a nail artist or salon to get started.' },
    past:     { title: 'No past appointments', sub: 'Your completed and cancelled bookings will appear here.' },
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
        <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0 }}>My Appointments</h1>
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
              <span style={{ marginLeft: '5px', background: 'var(--bg-chip)', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: '700', padding: '1px 6px', borderRadius: '20px' }}>
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 24px' }}>{emptyMessages[tab].sub}</p>
            {tab === 'upcoming' && (
              <Link href="/search" style={{ background: 'var(--accent)', color: '#2C0A1E', borderRadius: '12px', padding: '11px 24px', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>
                Find an artist
              </Link>
            )}
          </div>
        ) : (
          activeList.map(b => <AppointmentCard key={b.id} booking={b} />)
        )}
      </div>
    </div>
  )
}
