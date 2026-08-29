'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ── Palette from the booking frames (250:2526 Confirmed is the model) ──────
const PANEL = 'rgba(255, 255, 255, 0.06)'
const PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.08)'
const WHITE50 = 'rgba(255, 255, 255, 0.5)'
const WHITE30 = 'rgba(255, 255, 255, 0.3)'
const ACCENT = '#FF517F'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.35,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.25 })

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

// Booking reference, display-only convention (frame 250:2526 "#LQ-2826"):
// "#LQ-" + the first six hex characters of the booking UUID, uppercased.
// Six hex = 16.7M values (collision-safe at any plausible volume), short
// enough to read aloud. Derived from the immutable id — never parsed back.
const bookingRef = (id) => `#LQ-${id.replace(/-/g, '').slice(0, 6).toUpperCase()}`

// Client-side ICS for "Add to calendar" — all real booking data.
function downloadIcs(booking, creator) {
  const d = booking.booking_date.replace(/-/g, '')
  const t = (time) => time.slice(0, 5).replace(':', '') + '00'
  const esc = (s) => String(s || '').replace(/[\\;,]/g, (m) => '\\' + m)
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//laQue//booking//EN',
    'BEGIN:VEVENT',
    `UID:${booking.id}@laque.app`,
    `DTSTART:${d}T${t(booking.start_time)}`,
    `DTEND:${d}T${t(booking.end_time)}`,
    `SUMMARY:${esc(booking.service?.name || 'Appointment')} — ${esc(creator?.display_name || 'laQue')}`,
    creator?.location ? `LOCATION:${esc(creator.display_name)}, ${esc(creator.location)}` : null,
    `DESCRIPTION:laQue booking ${bookingRef(booking.id)}`,
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean)
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `laque-appointment-${bookingRef(booking.id).slice(1)}.ics`
  a.click()
  URL.revokeObjectURL(url)
}

export default function AppointmentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payLoading, setPayLoading] = useState(false)
  const [refDesign, setRefDesign] = useState(null)
  const [review, setReview] = useState(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/profile'); return }
      setCurrentUser(user)

      const { data } = await supabase
        .from('bookings')
        .select('*, service:services(*)')
        .eq('id', id)
        .eq('client_id', user.id)
        .single()

      if (!data) { router.push('/appointments'); return }

      // Fetch creator profile + existing review in parallel
      const [{ data: creator }, { data: existingReview }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url, username, is_verified, account_type, location').eq('id', data.creator_id).single(),
        supabase.from('reviews').select('*').eq('booking_id', data.id).maybeSingle(),
      ])

      if (existingReview) {
        setReview(existingReview)
        setReviewRating(existingReview.rating)
        setReviewText(existingReview.text || '')
        setReviewSubmitted(true)
      }

      // Attached reference design (column may predate some rows — optional)
      if (data.reference_design_id) {
        const { data: ref } = await supabase.from('designs').select('id, title, image_url').eq('id', data.reference_design_id).maybeSingle()
        if (ref) setRefDesign(ref)
      }

      setBooking({ ...data, creator })
      setLoading(false)
    }
    init()
  }, [id])

  const handlePayDeposit = async () => {
    if (payLoading) return
    setPayLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-deposit-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ bookingId: booking.id }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else { alert(data.error || 'Something went wrong.'); setPayLoading(false) }
    } catch { alert('Something went wrong.'); setPayLoading(false) }
  }

  const handleSubmitReview = async () => {
    if (!reviewRating) return
    setReviewLoading(true)
    const payload = {
      booking_id: booking.id,
      reviewer_id: currentUser.id,
      creator_id: booking.creator_id,
      rating: reviewRating,
      text: reviewText.trim() || null,
    }
    let reviewError = null
    if (review) {
      const { error } = await supabase.from('reviews').update({ rating: reviewRating, text: reviewText.trim() || null }).eq('id', review.id)
      reviewError = error
    } else {
      const { error } = await supabase.from('reviews').insert(payload)
      reviewError = error
      if (!error) {
        // Reward for leaving a review (first time only)
        const { data: { session } } = await supabase.auth.getSession()
        fetch('/api/add-reward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: JSON.stringify({ reason: 'leave_review', ref_id: booking.id }),
        })
      }
    }
    setReviewLoading(false)
    if (reviewError) {
      alert('Failed to submit review. Please try again.')
      return
    }
    setReviewSubmitted(true)
  }

  const shell = (children) => (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      <div aria-hidden className="lq-bg-wine" style={{ position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', zIndex: 0, backgroundColor: '#260D14' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26, 5, 13, 0.6)' }} />
        <div className="lq-grain" />
      </div>
      <div style={{ position: 'relative', zIndex: 1, padding: 'calc(env(safe-area-inset-top) + 12px) 20px calc(env(safe-area-inset-bottom) + 120px)' }}>
        {children}
      </div>
    </div>
  )

  if (loading) return shell(
    <p style={{ ...ui(300, 14, WHITE50), textAlign: 'center', padding: '48px 0' }}>Loading…</p>
  )

  const { service, creator } = booking
  const statusMap = {
    pending:   { label: 'Pending',   color: '#FFB84C', bg: 'rgba(255,184,76,0.15)' },
    confirmed: { label: 'Confirmed', color: '#10B981', bg: 'rgba(16,185,129,0.15)' },
    declined:  { label: 'Declined',  color: '#E07070', bg: 'rgba(224,112,112,0.15)' },
    cancelled: { label: 'Cancelled', color: WHITE50,   bg: 'rgba(255,255,255,0.08)' },
  }
  const s = statusMap[booking.status] || statusMap.pending
  const showDeposit = booking.status === 'confirmed' && service?.deposit_amount > 0 && !booking.deposit_paid

  // Status-led hero: Confirmed per frame 250:2526; Declined is the honest
  // extrapolated counterpart (no reason invented — the app records none);
  // Pending stays quiet and factual.
  const hero = {
    confirmed: {
      icon: (
        <div style={{ width: '64px', height: '64px', borderRadius: '32px', background: BTN_GRADIENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        </div>
      ),
      title: 'Appointment confirmed',
      sub: `${creator?.display_name} accepted your booking`,
    },
    declined: {
      icon: (
        <div style={{ width: '64px', height: '64px', borderRadius: '32px', background: PANEL, border: PANEL_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#E07070" strokeWidth="1.8" strokeLinecap="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>
        </div>
      ),
      title: 'Booking declined',
      sub: `${creator?.display_name} couldn't take this appointment`,
    },
    pending: {
      icon: (
        <div style={{ width: '64px', height: '64px', borderRadius: '32px', background: PANEL, border: PANEL_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#FFB84C" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 14"/></svg>
        </div>
      ),
      title: 'Request pending',
      sub: `Waiting for ${creator?.display_name} to confirm`,
    },
  }[booking.status]

  const cardRows = [
    ['Artist', (
      <span key="a" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ width: '20px', height: '20px', borderRadius: '10px', background: creator?.avatar_url ? 'transparent' : BTN_GRADIENT, overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {creator?.avatar_url
            ? <img src={creator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={ui(600, 10)}>{(creator?.display_name || '?')[0].toUpperCase()}</span>}
        </span>
        {creator?.display_name}
      </span>
    ), false],
    ['Service', service?.name || '—', false],
    ['Date', fmtDate(booking.booking_date), false],
    ['Time', `${fmt12(booking.start_time)} – ${fmt12(booking.end_time)}`, false],
    ['Duration', fmtDuration(service?.duration_minutes), false],
    ...(service?.price > 0 ? [['Price', `AED ${service.price}`, true]] : []),
    ...(service?.deposit_amount > 0 ? [['Deposit', booking.deposit_paid ? '✓ Paid' : `AED ${service.deposit_amount} — unpaid`, booking.deposit_paid]] : []),
    ...(creator?.location ? [['Location', `${creator.display_name}, ${creator.location}`, false]] : []),
    ['Ref', bookingRef(booking.id), false],
  ]

  return shell(
    <>
      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', minHeight: '44px' }}>
        <Link href="/appointments" aria-label="Back to appointments"
          style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px', padding: '8px', display: 'flex', color: 'var(--lq-white)' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <h1 style={{ ...display(18), margin: 0, flex: 1 }}>Appointment</h1>
        <span style={{ background: s.bg, color: s.color, ...ui(600, 12, s.color), padding: '4px 12px', borderRadius: '100px' }}>
          {s.label}
        </span>
      </div>

      {/* ── Status hero ── */}
      {hero && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', margin: '8px 0 24px', textAlign: 'center' }}>
          {hero.icon}
          <h2 style={{ ...display(26), margin: '10px 0 0' }}>{hero.title}</h2>
          <p style={{ ...ui(300, 14, WHITE50), margin: 0 }}>{hero.sub}</p>
        </div>
      )}

      {/* ── Detail card (250:2526) ── */}
      <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '4px 16px', marginBottom: '16px' }}>
        {cardRows.map(([label, value, accent], i, arr) => (
          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
            <span style={ui(400, 14, WHITE50)}>{label}</span>
            <span style={{ ...ui(500, 15, accent ? ACCENT : 'var(--lq-white)'), textAlign: 'right', maxWidth: '65%' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* Add to calendar — real, client-side ICS */}
      {booking.status === 'confirmed' && (
        <button onClick={() => downloadIcs(booking, creator)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', margin: '0 auto 20px', background: 'none', border: 'none', cursor: 'pointer', ...ui(500, 13, ACCENT) }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="4"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Add to calendar
        </button>
      )}

      {/* Your note + reference design */}
      {(booking.notes || refDesign) && (
        <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '16px', marginBottom: '16px' }}>
          {booking.notes && (
            <>
              <p style={{ ...ui(600, 11, WHITE50), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>Your note</p>
              <p style={{ ...ui(400, 14), lineHeight: 1.6, margin: refDesign ? '0 0 14px' : 0 }}>{booking.notes}</p>
            </>
          )}
          {refDesign && (
            <Link href={`/design/${refDesign.id}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
              <img src={refDesign.image_url} alt={refDesign.title} style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...ui(500, 10, WHITE50), letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 2px' }}>Reference design</p>
                <p style={{ ...ui(500, 13), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{refDesign.title}</p>
              </div>
              <span style={ui(400, 16, WHITE30)}>›</span>
            </Link>
          )}
        </div>
      )}

      {/* Pay deposit — existing post-confirmation flow, surfaced at the
          moment it applies (Sogol ②). Endpoint and handler untouched. */}
      {showDeposit && (
        <button
          onClick={handlePayDeposit}
          disabled={payLoading}
          style={{
            width: '100%', height: '52px', background: BTN_GRADIENT,
            border: 'none', borderRadius: '1000px', ...ui(500, 15),
            cursor: payLoading ? 'not-allowed' : 'pointer',
            opacity: payLoading ? 0.7 : 1, marginBottom: '12px',
          }}
        >
          {payLoading ? 'Redirecting…' : `Pay deposit — AED ${service.deposit_amount}`}
        </button>
      )}

      {/* Book again */}
      <Link
        href={`/book/${creator?.id}?serviceId=${service?.id}${booking.notes ? `&note=${encodeURIComponent(booking.notes)}` : ''}`}
        style={{
          display: 'block', textAlign: 'center', height: '52px', lineHeight: '52px',
          background: showDeposit ? 'none' : BTN_GRADIENT,
          border: showDeposit ? '1px solid rgba(255,255,255,0.2)' : 'none',
          borderRadius: '1000px', ...ui(500, 15),
          textDecoration: 'none', marginBottom: '10px', boxSizing: 'border-box',
        }}
      >
        Book again
      </Link>

      {/* Message creator */}
      <Link
        href={`/messages?with=${creator?.id}`}
        style={{
          display: 'block', textAlign: 'center', padding: '14px',
          background: 'none', border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '1000px', ...ui(400, 14),
          textDecoration: 'none',
        }}
      >
        Message {creator?.display_name}
      </Link>

      {/* Leave a review — only for confirmed past bookings */}
      {booking.status === 'confirmed' && booking.booking_date < new Date().toISOString().split('T')[0] && (
        <div style={{ marginTop: '20px', background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '18px 16px' }}>
          <p style={{ ...ui(600, 11, WHITE50), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 14px' }}>
            {reviewSubmitted ? 'Your review' : 'Leave a review'}
          </p>

          {/* Stars */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px' }}>
            {[1,2,3,4,5].map(star => (
              <button
                key={star}
                onClick={() => !reviewSubmitted && setReviewRating(star)}
                onMouseEnter={() => !reviewSubmitted && setHoverRating(star)}
                onMouseLeave={() => !reviewSubmitted && setHoverRating(0)}
                style={{
                  background: 'none', border: 'none', padding: '2px', cursor: reviewSubmitted ? 'default' : 'pointer',
                  fontSize: '28px', lineHeight: 1,
                  color: star <= (hoverRating || reviewRating) ? '#F5C842' : 'rgba(255,255,255,0.15)',
                  filter: star <= (hoverRating || reviewRating) ? 'drop-shadow(0 0 4px rgba(245,200,66,0.4))' : 'none',
                  transition: 'color 0.1s, filter 0.1s',
                }}
              >
                ★
              </button>
            ))}
          </div>

          {/* Text */}
          {!reviewSubmitted ? (
            <>
              <textarea
                value={reviewText}
                onChange={e => setReviewText(e.target.value)}
                placeholder="Share your experience (optional)"
                rows={3}
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.04)', border: PANEL_BORDER,
                  borderRadius: '12px', padding: '10px 12px', color: 'var(--lq-white)',
                  fontSize: '14px', fontFamily: 'var(--lq-font-ui)', resize: 'none',
                  boxSizing: 'border-box', outline: 'none', marginBottom: '12px',
                }}
              />
              <button
                onClick={handleSubmitReview}
                disabled={!reviewRating || reviewLoading}
                style={{
                  width: '100%', padding: '14px',
                  background: reviewRating ? BTN_GRADIENT : 'rgba(255,255,255,0.08)',
                  border: 'none', borderRadius: '1000px', ...ui(500, 14, reviewRating ? 'var(--lq-white)' : WHITE50),
                  cursor: reviewRating && !reviewLoading ? 'pointer' : 'not-allowed',
                  opacity: reviewLoading ? 0.7 : 1,
                }}
              >
                {reviewLoading ? 'Submitting…' : 'Submit review'}
              </button>
            </>
          ) : (
            <div>
              {reviewText && <p style={{ ...ui(400, 14), lineHeight: 1.55, margin: '0 0 10px' }}>{reviewText}</p>}
              <p style={{ ...ui(600, 12, '#10B981'), margin: 0 }}>✓ Review submitted</p>
            </div>
          )}
        </div>
      )}
    </>
  )
}
