'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_NAMES = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']

function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.slice(0,5).split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m > 0 ? `:${String(m).padStart(2,'0')}` : ''}${ampm}`
}

function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAY_NAMES[d.getDay()]}, ${d.getDate()} ${MONTH_NAMES[d.getMonth()]} ${d.getFullYear()}`
}

function fmtDuration(mins) {
  if (!mins) return ''
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`
}

function Row({ label, value, accent }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '0.5px solid var(--border)' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{label}</span>
      <span style={{ color: accent ? 'var(--accent)' : 'var(--text-primary)', fontSize: '13px', fontWeight: '500', textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

export default function BookingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [noteText, setNoteText] = useState('')
  const [noteId, setNoteId] = useState(null)
  const [noteSaving, setNoteSaving] = useState(false)
  const [noteSaved, setNoteSaved] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/profile'); return }
      setCurrentUser(user)

      const { data } = await supabase
        .from('bookings')
        .select('*, service:services(*)')
        .eq('id', id)
        .eq('creator_id', user.id)
        .single()

      if (!data) { router.push('/bookings'); return }

      const [{ data: client }, { data: existingNote }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url, username').eq('id', data.client_id).single(),
        supabase.from('client_notes').select('*').eq('booking_id', id).single(),
      ])

      if (existingNote) {
        setNoteId(existingNote.id)
        setNoteText(existingNote.note)
      }

      setBooking({ ...data, client })
      setLoading(false)
    }
    init()
  }, [id])

  const handleSaveNote = async () => {
    if (!currentUser || noteSaving) return
    setNoteSaving(true)
    setNoteSaved(false)
    if (noteId) {
      await supabase.from('client_notes').update({ note: noteText, updated_at: new Date().toISOString() }).eq('id', noteId)
    } else {
      const { data } = await supabase.from('client_notes').insert({
        booking_id: booking.id,
        creator_id: currentUser.id,
        client_id: booking.client_id,
        note: noteText,
      }).select().single()
      if (data) setNoteId(data.id)
    }
    setNoteSaving(false)
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }

  const handleAccept = async () => {
    setActing('accept')
    await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id)
    await supabase.from('notifications').insert({
      user_id: booking.client_id,
      actor_id: currentUser.id,
      type: 'booking_confirmed',
    })
    setBooking(prev => ({ ...prev, status: 'confirmed' }))
    setActing(null)
  }

  const handleDecline = async () => {
    if (!confirm('Decline this booking request?')) return
    setActing('decline')
    await supabase.from('bookings').update({ status: 'declined' }).eq('id', booking.id)
    await supabase.from('notifications').insert({
      user_id: booking.client_id,
      actor_id: currentUser.id,
      type: 'booking_declined',
    })
    setBooking(prev => ({ ...prev, status: 'declined' }))
    setActing(null)
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  const { service, client } = booking
  const statusMap = {
    pending:   { label: 'Pending',   color: 'var(--accent)',        bg: 'rgba(212,160,192,0.12)' },
    confirmed: { label: 'Confirmed', color: '#6CC882',              bg: 'rgba(100,200,130,0.12)' },
    declined:  { label: 'Declined',  color: '#E07070',              bg: 'rgba(200,100,100,0.12)' },
    cancelled: { label: 'Cancelled', color: 'var(--text-secondary)', bg: 'var(--bg-chip)' },
  }
  const s = statusMap[booking.status] || statusMap.pending

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '60px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px' }}>
        <Link href="/bookings" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Link>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0, flex: 1 }}>Booking</h1>
        <span style={{ background: s.bg, color: s.color, fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '20px' }}>
          {s.label}
        </span>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* Client card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {client?.avatar_url
              ? <img src={client.avatar_url} alt={client.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: 'var(--accent)', fontSize: '20px', fontWeight: '600' }}>{(client?.display_name || '?')[0].toUpperCase()}</span>
            }
          </div>
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', margin: '0 0 2px' }}>{client?.display_name || 'Client'}</p>
            {client?.username && <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>@{client.username}</p>}
          </div>
        </div>

        {/* Details */}
        <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '0 16px', marginBottom: '20px' }}>
          <Row label="Service" value={service?.name || '—'} />
          <Row label="Date" value={fmtDate(booking.booking_date)} />
          <Row label="Time" value={`${fmt12(booking.start_time)} – ${fmt12(booking.end_time)}`} />
          <Row label="Duration" value={fmtDuration(service?.duration_minutes)} />
          {service?.price > 0 && <Row label="Price" value={`AED ${service.price}`} accent />}
          {service?.deposit_amount > 0 && (
            <Row
              label="Deposit"
              value={booking.deposit_paid ? '✓ Paid' : `AED ${service.deposit_amount} — unpaid`}
              accent={booking.deposit_paid}
            />
          )}
        </div>

        {/* Note */}
        {booking.notes && (
          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>Client note</p>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>{booking.notes}</p>
          </div>
        )}

        {/* Accept / Decline — only if pending */}
        {booking.status === 'pending' && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <button
              onClick={handleAccept}
              disabled={!!acting}
              style={{
                flex: 1, padding: '14px', background: 'var(--accent)', color: '#2C0A1E',
                border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '600',
                fontFamily: "'DM Sans', sans-serif", cursor: acting ? 'not-allowed' : 'pointer',
                opacity: acting ? 0.7 : 1,
              }}
            >
              {acting === 'accept' ? 'Confirming…' : 'Accept'}
            </button>
            <button
              onClick={handleDecline}
              disabled={!!acting}
              style={{
                flex: 1, padding: '14px', background: 'rgba(229,115,115,0.1)', color: '#E07070',
                border: '0.5px solid rgba(229,115,115,0.3)', borderRadius: '14px',
                fontSize: '15px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
                cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? 0.7 : 1,
              }}
            >
              {acting === 'decline' ? 'Declining…' : 'Decline'}
            </button>
          </div>
        )}

        {/* Message client */}
        <Link
          href={`/messages?with=${client?.id}`}
          style={{
            display: 'block', textAlign: 'center', padding: '13px',
            background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: '14px', color: 'var(--text-primary)',
            fontSize: '14px', fontWeight: '500', textDecoration: 'none',
          }}
        >
          Message {client?.display_name}
        </Link>

        {/* Private client notes */}
        <div style={{ marginTop: '20px', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '18px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
              Private notes
            </p>
            <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>🔒 Only you can see this</span>
          </div>
          <textarea
            value={noteText}
            onChange={e => { setNoteText(e.target.value); setNoteSaved(false) }}
            placeholder={`Notes about ${client?.display_name || 'this client'}… e.g. prefers short almond, sensitive to acetone`}
            rows={4}
            style={{
              width: '100%', background: 'var(--bg-chip)', border: '0.5px solid var(--border)',
              borderRadius: '10px', padding: '10px 12px', color: 'var(--text-primary)',
              fontSize: '14px', fontFamily: "'DM Sans', sans-serif", resize: 'none',
              boxSizing: 'border-box', outline: 'none', lineHeight: '1.6', marginBottom: '10px',
            }}
          />
          <button
            onClick={handleSaveNote}
            disabled={noteSaving || !noteText.trim()}
            style={{
              width: '100%', padding: '12px',
              background: noteSaved ? 'rgba(100,200,130,0.15)' : noteText.trim() ? 'var(--accent)' : 'var(--bg-chip)',
              color: noteSaved ? '#6CC882' : noteText.trim() ? '#2C0A1E' : 'var(--text-secondary)',
              border: noteSaved ? '0.5px solid rgba(100,200,130,0.3)' : 'none',
              borderRadius: '12px', fontSize: '14px', fontWeight: '600',
              fontFamily: "'DM Sans', sans-serif",
              cursor: noteText.trim() && !noteSaving ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {noteSaving ? 'Saving…' : noteSaved ? '✓ Saved' : 'Save note'}
          </button>
        </div>

      </div>
    </div>
  )
}
