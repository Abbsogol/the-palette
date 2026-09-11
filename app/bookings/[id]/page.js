'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const ROW_BORDER = '1px solid rgba(255,255,255,0.08)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

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
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: ROW_BORDER }}>
      <span style={ui(300, 13, WHITE60)}>{label}</span>
      <span style={{ ...ui(500, 13, accent ? ACCENT : 'var(--lq-white)'), textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  )
}

export default function BookingDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState(null)
  const [refDesign, setRefDesign] = useState(null)
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
        supabase.from('client_notes').select('*').eq('booking_id', id).maybeSingle(),
      ])

      if (existingNote) {
        setNoteId(existingNote.id)
        setNoteText(existingNote.note)
      }

      // Client-attached reference design, when the booking carries one — the
      // artist recreates this look, so it's shown as a full reserved-box,
      // natural-aspect card (image standard). Dimensions come from the backfill.
      if (data.reference_design_id) {
        const { data: ref } = await supabase.from('designs').select('id, title, image_url, image_width, image_height').eq('id', data.reference_design_id).maybeSingle()
        if (ref) setRefDesign(ref)
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
    let saveError = null
    if (noteId) {
      const { error } = await supabase.from('client_notes').update({ note: noteText, updated_at: new Date().toISOString() }).eq('id', noteId)
      saveError = error
    } else {
      const { data, error } = await supabase.from('client_notes').insert({
        booking_id: booking.id,
        creator_id: currentUser.id,
        client_id: booking.client_id,
        note: noteText,
      }).select().single()
      saveError = error
      if (data) setNoteId(data.id)
    }
    setNoteSaving(false)
    if (saveError) {
      alert('Failed to save note. Please try again.')
      return
    }
    setNoteSaved(true)
    setTimeout(() => setNoteSaved(false), 2000)
  }

  const handleAccept = async () => {
    setActing('accept')
    const { error } = await supabase.from('bookings').update({ status: 'confirmed' }).eq('id', booking.id)
    if (error) { alert('Failed to accept booking. Please try again.'); setActing(null); return }
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
    const { error } = await supabase.from('bookings').update({ status: 'declined' }).eq('id', booking.id)
    if (error) { alert('Failed to decline booking. Please try again.'); setActing(null); return }
    await supabase.from('notifications').insert({
      user_id: booking.client_id,
      actor_id: currentUser.id,
      type: 'booking_declined',
    })
    setBooking(prev => ({ ...prev, status: 'declined' }))
    setActing(null)
  }

  const Shell = ({ children }) => (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 60px)' }}>{children}</div>
    </div>
  )

  if (loading) return (
    <Shell>
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={ui(300, 14, WHITE60)}>Loading…</p>
      </div>
    </Shell>
  )

  const { service, client } = booking
  const statusMap = {
    pending:   { label: 'Pending',   color: ACCENT,    bg: 'rgba(255,81,127,0.15)' },
    confirmed: { label: 'Confirmed', color: '#6CC882', bg: 'rgba(108,200,130,0.15)' },
    declined:  { label: 'Declined',  color: '#E07070', bg: 'rgba(224,112,112,0.15)' },
    cancelled: { label: 'Cancelled', color: WHITE60,   bg: 'rgba(255,255,255,0.1)' },
  }
  const s = statusMap[booking.status] || statusMap.pending

  const refHasDims = refDesign?.image_width && refDesign?.image_height

  return (
    <Shell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 16px' }}>
        <BackButton fallback="/bookings" />
        <h1 style={{ ...display(24), margin: 0, flex: 1 }}>Booking</h1>
        <span style={{ background: s.bg, ...ui(600, 12, s.color), padding: '4px 12px', borderRadius: '1000px' }}>
          {s.label}
        </span>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* Client card */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', border: PANEL_BORDER }}>
            {client?.avatar_url
              ? <img src={client.avatar_url} alt={client.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={ui(600, 20, ACCENT)}>{(client?.display_name || '?')[0].toUpperCase()}</span>
            }
          </div>
          <div>
            <p style={{ ...ui(600, 15), margin: '0 0 2px' }}>{client?.display_name || 'Client'}</p>
            {client?.username && <p style={ui(300, 12, WHITE60)}>@{client.username}</p>}
          </div>
        </div>

        {/* Details */}
        <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '0 16px', marginBottom: '16px' }}>
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

        {/* Client note + attached reference design */}
        {(booking.notes || refDesign) && (
          <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
            {booking.notes && (
              <>
                <p style={{ ...ui(600, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>Client note</p>
                <p style={{ ...ui(400, 14), lineHeight: 1.6, margin: refDesign ? '0 0 16px' : 0 }}>{booking.notes}</p>
              </>
            )}
            {refDesign && (
              <Link href={`/design/${refDesign.id}`} style={{ display: 'block', textDecoration: 'none' }}>
                <p style={{ ...ui(600, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>Reference design</p>
                {/* Image standard: reserved box at the design's natural aspect, no crop */}
                <div style={{ borderRadius: '12px', overflow: 'hidden', border: PANEL_BORDER }}>
                  <img
                    src={refDesign.image_url}
                    alt={refDesign.title}
                    width={refDesign.image_width || undefined}
                    height={refDesign.image_height || undefined}
                    style={{ width: '100%', height: 'auto', aspectRatio: refHasDims ? `${refDesign.image_width} / ${refDesign.image_height}` : undefined, display: 'block', background: 'rgba(255,255,255,0.06)' }}
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginTop: '10px' }}>
                  <p style={{ ...ui(500, 13), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{refDesign.title}</p>
                  <span style={ui(400, 16, WHITE60)}>›</span>
                </div>
              </Link>
            )}
          </div>
        )}

        {/* Accept / Decline — only if pending */}
        {booking.status === 'pending' && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
            <button
              onClick={handleAccept}
              disabled={!!acting}
              style={{
                flex: 1, padding: '14px', background: 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)', color: 'var(--lq-white)',
                border: 'none', borderRadius: '1000px', ...ui(600, 15),
                cursor: acting ? 'not-allowed' : 'pointer', opacity: acting ? 0.7 : 1,
              }}
            >
              {acting === 'accept' ? 'Confirming…' : 'Accept'}
            </button>
            <button
              onClick={handleDecline}
              disabled={!!acting}
              style={{
                flex: 1, padding: '14px', background: 'rgba(224,112,112,0.12)',
                border: '1px solid rgba(224,112,112,0.3)', borderRadius: '1000px', ...ui(600, 15, '#E07070'),
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
            background: PANEL, border: PANEL_BORDER, borderRadius: '1000px',
            ...ui(500, 14), textDecoration: 'none',
          }}
        >
          Message {client?.display_name}
        </Link>

        {/* Private client notes */}
        <div style={{ marginTop: '20px', background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '18px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <p style={{ ...ui(600, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
              Private notes
            </p>
            <span style={ui(300, 11, WHITE60)}>🔒 Only you can see this</span>
          </div>
          <textarea
            value={noteText}
            onChange={e => { setNoteText(e.target.value); setNoteSaved(false) }}
            placeholder={`Notes about ${client?.display_name || 'this client'}… e.g. prefers short almond, sensitive to acetone`}
            rows={4}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)', border: PANEL_BORDER,
              borderRadius: '12px', padding: '10px 12px', color: 'var(--lq-white)',
              ...ui(400, 14), resize: 'none',
              boxSizing: 'border-box', outline: 'none', lineHeight: 1.6, marginBottom: '10px',
            }}
          />
          <button
            onClick={handleSaveNote}
            disabled={noteSaving || !noteText.trim()}
            style={{
              width: '100%', padding: '12px',
              background: noteSaved ? 'rgba(108,200,130,0.15)' : noteText.trim() ? 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)' : 'rgba(255,255,255,0.08)',
              border: noteSaved ? '1px solid rgba(108,200,130,0.3)' : 'none',
              borderRadius: '1000px', ...ui(600, 14, noteSaved ? '#6CC882' : noteText.trim() ? 'var(--lq-white)' : WHITE60),
              cursor: noteText.trim() && !noteSaving ? 'pointer' : 'not-allowed',
              transition: 'background 0.2s, color 0.2s',
            }}
          >
            {noteSaving ? 'Saving…' : noteSaved ? '✓ Saved' : 'Save note'}
          </button>
        </div>

      </div>
    </Shell>
  )
}
