'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

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

export default function AppointmentDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const [booking, setBooking] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [payLoading, setPayLoading] = useState(false)
  const [review, setReview] = useState(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [hoverRating, setHoverRating] = useState(0)
  const [reviewLoading, setReviewLoading] = useState(false)
  const [reviewSubmitted, setReviewSubmitted] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
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
        supabase.from('profiles').select('id, display_name, avatar_url, username, is_verified, account_type').eq('id', data.creator_id).single(),
        supabase.from('reviews').select('*').eq('booking_id', data.id).single(),
      ])

      if (existingReview) {
        setReview(existingReview)
        setReviewRating(existingReview.rating)
        setReviewText(existingReview.text || '')
        setReviewSubmitted(true)
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
      const res = await fetch('/api/create-deposit-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: booking.id, userId: currentUser.id }),
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
    if (review) {
      await supabase.from('reviews').update({ rating: reviewRating, text: reviewText.trim() || null }).eq('id', review.id)
    } else {
      await supabase.from('reviews').insert(payload)
    }
    setReviewSubmitted(true)
    setReviewLoading(false)
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  const { service, creator } = booking
  const statusMap = {
    pending:   { label: 'Pending',   color: 'var(--accent)',    bg: 'rgba(212,160,192,0.12)' },
    confirmed: { label: 'Confirmed', color: '#6CC882',          bg: 'rgba(100,200,130,0.12)' },
    declined:  { label: 'Declined',  color: '#E07070',          bg: 'rgba(200,100,100,0.12)' },
    cancelled: { label: 'Cancelled', color: 'var(--text-secondary)', bg: 'var(--bg-chip)' },
  }
  const s = statusMap[booking.status] || statusMap.pending
  const showDeposit = booking.status === 'confirmed' && service?.deposit_amount > 0 && !booking.deposit_paid

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '60px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px' }}>
        <Link href="/appointments" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Link>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0, flex: 1 }}>Appointment</h1>
        <span style={{ background: s.bg, color: s.color, fontSize: '12px', fontWeight: '600', padding: '4px 12px', borderRadius: '20px' }}>
          {s.label}
        </span>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* Creator card */}
        <Link href={`/creator/${creator?.id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '14px', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '16px', marginBottom: '20px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {creator?.avatar_url
              ? <img src={creator.avatar_url} alt={creator.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: 'var(--accent)', fontSize: '20px', fontWeight: '600' }}>{(creator?.display_name || '?')[0].toUpperCase()}</span>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', margin: 0 }}>{creator?.display_name}</p>
              {creator?.is_verified && (
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" fill="#D4A0C0"/>
                  <path d="M5 8L7 10L11 6" stroke="#2C0A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '2px 0 0' }}>@{creator?.username} · View profile →</p>
          </div>
        </Link>

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
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>Your note</p>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.6', margin: 0 }}>{booking.notes}</p>
          </div>
        )}

        {/* Pay deposit */}
        {showDeposit && (
          <button
            onClick={handlePayDeposit}
            disabled={payLoading}
            style={{
              width: '100%', padding: '14px', background: 'var(--accent)', color: '#2C0A1E',
              border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '600',
              fontFamily: "'DM Sans', sans-serif", cursor: payLoading ? 'not-allowed' : 'pointer',
              opacity: payLoading ? 0.7 : 1, marginBottom: '12px',
            }}
          >
            {payLoading ? 'Redirecting…' : `Pay deposit — AED ${service.deposit_amount}`}
          </button>
        )}

        {/* Message creator */}
        <Link
          href={`/messages?with=${creator?.id}`}
          style={{
            display: 'block', textAlign: 'center', padding: '13px',
            background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: '14px', color: 'var(--text-primary)',
            fontSize: '14px', fontWeight: '500', textDecoration: 'none',
          }}
        >
          Message {creator?.display_name}
        </Link>

        {/* Leave a review — only for confirmed past bookings */}
        {booking.status === 'confirmed' && booking.booking_date < new Date().toISOString().split('T')[0] && (
          <div style={{ marginTop: '20px', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '18px 16px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 14px' }}>
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
                    color: star <= (hoverRating || reviewRating) ? '#F5C842' : 'var(--bg-chip)',
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
                    width: '100%', background: 'var(--bg-chip)', border: '0.5px solid var(--border)',
                    borderRadius: '10px', padding: '10px 12px', color: 'var(--text-primary)',
                    fontSize: '14px', fontFamily: "'DM Sans', sans-serif", resize: 'none',
                    boxSizing: 'border-box', outline: 'none', marginBottom: '12px',
                  }}
                />
                <button
                  onClick={handleSubmitReview}
                  disabled={!reviewRating || reviewLoading}
                  style={{
                    width: '100%', padding: '13px',
                    background: reviewRating ? 'var(--accent)' : 'var(--bg-chip)',
                    color: reviewRating ? '#2C0A1E' : 'var(--text-secondary)',
                    border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600',
                    fontFamily: "'DM Sans', sans-serif",
                    cursor: reviewRating && !reviewLoading ? 'pointer' : 'not-allowed',
                    opacity: reviewLoading ? 0.7 : 1,
                  }}
                >
                  {reviewLoading ? 'Submitting…' : 'Submit review'}
                </button>
              </>
            ) : (
              <div>
                {reviewText && <p style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.55', margin: '0 0 10px' }}>{reviewText}</p>}
                <p style={{ color: '#6CC882', fontSize: '12px', fontWeight: '600', margin: 0 }}>✓ Review submitted</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
