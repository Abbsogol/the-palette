'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
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
  if (mins < 60) return `${mins} min`
  const h = Math.floor(mins / 60), m = mins % 60
  return m > 0 ? `${h} hr ${m} min` : `${h} hr`
}

function addMinutes(timeStr, mins) {
  const [h, m] = timeStr.split(':').map(Number)
  const total = h * 60 + m + mins
  return `${String(Math.floor(total / 60)).padStart(2,'0')}:${String(total % 60).padStart(2,'0')}`
}

function timeToMins(timeStr) {
  const [h, m] = timeStr.slice(0, 5).split(':').map(Number)
  return h * 60 + m
}

export default function BookPage() {
  const { creatorId } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const designId = searchParams.get('designId')
  const prefillServiceId = searchParams.get('serviceId')
  const prefillNote = searchParams.get('note')

  const [step, setStep] = useState(1) // 1=service, 2=date, 3=time, 4=confirm
  const [currentUser, setCurrentUser] = useState(null)
  const [creator, setCreator] = useState(null)
  const [services, setServices] = useState([])
  const [availability, setAvailability] = useState([]) // active days
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  // Inspiration design (from ?designId=)
  const [inspDesign, setInspDesign] = useState(null)

  // Selections
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)   // Date object
  const [selectedSlot, setSelectedSlot] = useState(null)   // '10:00'
  const [note, setNote] = useState('')
  const [slots, setSlots] = useState([])
  const [slotsLoading, setSlotsLoading] = useState(false)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      setCurrentUser(user)

      // Fetch inspiration design if provided
      if (designId) {
        const { data: d } = await supabase
          .from('designs')
          .select('id, title, image_url')
          .eq('id', designId)
          .single()
        if (d) {
          setInspDesign(d)
          setNote(`Inspiration: ${d.title}`)
        }
      }

      const [{ data: prof }, { data: svcs }, { data: avail }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url, account_type').eq('id', creatorId).single(),
        supabase.from('services').select('*').eq('creator_id', creatorId).eq('is_active', true).order('created_at', { ascending: true }),
        supabase.from('availability').select('*').eq('creator_id', creatorId).eq('is_active', true).order('day_of_week', { ascending: true }),
      ])

      setCreator(prof)
      setServices(svcs || [])
      setAvailability(avail || [])

      // Pre-select service + note if coming from Book Again
      if (prefillServiceId && svcs) {
        const match = svcs.find(s => s.id === prefillServiceId)
        if (match) {
          setSelectedService(match)
          setStep(2)
        }
      }
      if (prefillNote) setNote(decodeURIComponent(prefillNote))

      setLoading(false)
    }
    init()
  }, [])

  // Generate time slots when date + service selected
  useEffect(() => {
    if (!selectedDate || !selectedService) return
    const fetchSlots = async () => {
      setSlotsLoading(true)
      const dow = selectedDate.getDay()
      const dayAvail = availability.find(a => a.day_of_week === dow)
      if (!dayAvail) { setSlots([]); setSlotsLoading(false); return }

      // Get existing bookings for this creator on this date
      const dateStr = selectedDate.toISOString().split('T')[0]
      const { data: existingBookings } = await supabase
        .from('bookings')
        .select('start_time, end_time')
        .eq('creator_id', creatorId)
        .eq('booking_date', dateStr)
        .in('status', ['pending', 'confirmed'])

      const booked = (existingBookings || []).map(b => ({
        start: timeToMins(b.start_time),
        end: timeToMins(b.end_time),
      }))

      // Generate 30-min interval slots from open → close - duration
      const openMins = timeToMins(dayAvail.start_time)
      const closeMins = timeToMins(dayAvail.end_time)
      const dur = selectedService.duration_minutes
      const generated = []

      for (let t = openMins; t + dur <= closeMins; t += 30) {
        const slotEnd = t + dur
        const blocked = booked.some(b => t < b.end && slotEnd > b.start)
        const hh = String(Math.floor(t / 60)).padStart(2, '0')
        const mm = String(t % 60).padStart(2, '0')
        generated.push({ time: `${hh}:${mm}`, available: !blocked })
      }

      setSlots(generated)
      setSelectedSlot(null)
      setSlotsLoading(false)
    }
    fetchSlots()
  }, [selectedDate, selectedService])

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedSlot) return
    setSubmitting(true)

    const dateStr = selectedDate.toISOString().split('T')[0]
    const endTime = addMinutes(selectedSlot, selectedService.duration_minutes)

    await supabase.from('bookings').insert({
      client_id: currentUser.id,
      creator_id: creatorId,
      service_id: selectedService.id,
      booking_date: dateStr,
      start_time: selectedSlot,
      end_time: endTime,
      status: 'pending',
      notes: note.trim() || null,
    })

    // Notify the creator
    await supabase.from('notifications').insert({
      user_id: creatorId,
      actor_id: currentUser.id,
      type: 'booking_request',
    })

    setSubmitting(false)
    setDone(true)
  }

  // Build next 42 days, grouped by week for calendar
  const buildCalendar = () => {
    const activeDows = new Set(availability.map(a => a.day_of_week))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const days = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      days.push({ date: d, available: activeDows.has(d.getDay()) })
    }
    return days
  }

  const chevronLeft = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7"/>
    </svg>
  )

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  // ── DONE SCREEN ─────────────────────────────────────────────────────────────
  if (done) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <div style={{ fontSize: '48px', marginBottom: '20px' }}>✦</div>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '600', margin: '0 0 10px' }}>Request sent!</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: '0 0 8px', lineHeight: '1.6' }}>
        Your appointment request has been sent to <strong style={{ color: 'var(--text-primary)' }}>{creator?.display_name}</strong>.
      </p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 32px' }}>
        You'll get notified once they confirm or decline.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '320px' }}>
        <Link href={`/creator/${creatorId}`} style={{ background: 'var(--accent)', color: '#2C0A1E', borderRadius: '12px', padding: '13px', fontSize: '14px', fontWeight: '600', textDecoration: 'none', textAlign: 'center' }}>
          Back to profile
        </Link>
        <Link href="/feed" style={{ background: 'var(--bg-card)', color: 'var(--text-primary)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '13px', fontSize: '14px', fontWeight: '500', textDecoration: 'none', textAlign: 'center' }}>
          Go to feed
        </Link>
      </div>
    </div>
  )

  const calendarDays = buildCalendar()

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '100px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px' }}>
        <button
          onClick={() => step > 1 ? setStep(step - 1) : router.back()}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', display: 'flex', padding: 0 }}
        >
          {chevronLeft}
        </button>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0 }}>Book appointment</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '2px 0 0' }}>{creator?.display_name}</p>
        </div>
        {/* Step indicator */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {[1,2,3,4].map(s => (
            <div key={s} style={{ width: s <= step ? '18px' : '6px', height: '6px', borderRadius: '3px', background: s <= step ? 'var(--accent)' : 'var(--bg-chip)', transition: 'all 0.2s' }} />
          ))}
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* ── Inspiration card ── */}
        {inspDesign && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'rgba(212,160,192,0.08)', border: '0.5px solid rgba(212,160,192,0.3)',
            borderRadius: '14px', padding: '12px 14px', marginBottom: '20px',
          }}>
            <img
              src={inspDesign.image_url}
              alt={inspDesign.title}
              style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px' }}>Inspiration</p>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inspDesign.title}</p>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" stroke="var(--accent)" strokeWidth="1.5" fill="rgba(212,160,192,0.15)"/>
            </svg>
          </div>
        )}

        {/* ── STEP 1: Choose service ── */}
        {step === 1 && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 20px' }}>What service do you want to book?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {services.map(s => (
                <button
                  key={s.id}
                  onClick={() => { setSelectedService(s); setStep(2) }}
                  style={{
                    background: selectedService?.id === s.id ? 'rgba(212,160,192,0.1)' : 'var(--bg-card)',
                    border: `0.5px solid ${selectedService?.id === s.id ? 'var(--accent)' : 'var(--border)'}`,
                    borderRadius: '14px', padding: '16px', textAlign: 'left',
                    cursor: 'pointer', width: '100%', fontFamily: "'DM Sans', sans-serif",
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  }}
                >
                  <div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', margin: '0 0 4px' }}>{s.name}</p>
                    {s.description && <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 6px', lineHeight: '1.4' }}>{s.description}</p>}
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{fmtDuration(s.duration_minutes)}</span>
                  </div>
                  <span style={{ color: 'var(--accent)', fontSize: '15px', fontWeight: '700', marginLeft: '16px', whiteSpace: 'nowrap' }}>
                    {s.price > 0 ? `AED ${s.price}` : 'Free'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── STEP 2: Choose date ── */}
        {step === 2 && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 6px' }}>Pick a date</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '0 0 20px', opacity: 0.7 }}>Highlighted dates are days {creator?.display_name} is available.</p>

            {/* Calendar grid */}
            <div style={{ marginBottom: '24px' }}>
              {/* Day headers */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '8px' }}>
                {DAY_SHORT.map(d => (
                  <div key={d} style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', padding: '4px 0' }}>{d}</div>
                ))}
              </div>
              {/* Day cells */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                {calendarDays.map((item, i) => {
                  const isSelected = selectedDate && item.date.toDateString() === selectedDate.toDateString()
                  const isToday = item.date.toDateString() === new Date().toDateString()
                  return (
                    <button
                      key={i}
                      onClick={() => item.available && setSelectedDate(item.date)}
                      disabled={!item.available}
                      style={{
                        aspectRatio: '1', borderRadius: '10px',
                        background: isSelected ? 'var(--accent)' : isToday ? 'var(--bg-chip)' : 'transparent',
                        border: isToday && !isSelected ? '0.5px solid var(--border)' : 'none',
                        color: isSelected ? '#2C0A1E' : item.available ? 'var(--text-primary)' : 'var(--bg-chip)',
                        fontSize: '13px', fontWeight: isSelected || isToday ? '600' : '400',
                        cursor: item.available ? 'pointer' : 'default',
                        fontFamily: "'DM Sans', sans-serif",
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {item.date.getDate()}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Month label */}
            {selectedDate && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', marginBottom: '20px' }}>
                {DAY_NAMES[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()]} {selectedDate.getFullYear()}
              </p>
            )}

            <button
              onClick={() => setStep(3)}
              disabled={!selectedDate}
              style={{
                width: '100%', background: selectedDate ? 'var(--accent)' : 'var(--bg-chip)',
                color: selectedDate ? '#2C0A1E' : 'var(--text-secondary)',
                border: 'none', borderRadius: '12px', padding: '14px',
                fontSize: '15px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
                cursor: selectedDate ? 'pointer' : 'not-allowed',
              }}
            >
              Continue
            </button>
          </div>
        )}

        {/* ── STEP 3: Choose time ── */}
        {step === 3 && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 4px' }}>Pick a time</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '0 0 20px', opacity: 0.7 }}>
              {DAY_NAMES[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()]} · {selectedService?.name} ({fmtDuration(selectedService?.duration_minutes)})
            </p>

            {slotsLoading ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>Loading slots…</p>
            ) : slots.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 0' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>No slots available</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Try a different date.</p>
                <button onClick={() => setStep(2)} style={{ marginTop: '16px', background: 'none', border: '0.5px solid var(--border)', borderRadius: '20px', padding: '8px 20px', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
                  ← Change date
                </button>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '24px' }}>
                  {slots.map(slot => (
                    <button
                      key={slot.time}
                      onClick={() => slot.available && setSelectedSlot(slot.time)}
                      disabled={!slot.available}
                      style={{
                        padding: '12px 8px', borderRadius: '10px',
                        background: selectedSlot === slot.time ? 'var(--accent)' : slot.available ? 'var(--bg-card)' : 'var(--bg-chip)',
                        border: `0.5px solid ${selectedSlot === slot.time ? 'var(--accent)' : 'var(--border)'}`,
                        color: selectedSlot === slot.time ? '#2C0A1E' : slot.available ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontSize: '13px', fontWeight: selectedSlot === slot.time ? '600' : '400',
                        fontFamily: "'DM Sans', sans-serif",
                        cursor: slot.available ? 'pointer' : 'not-allowed',
                        opacity: slot.available ? 1 : 0.4,
                        textDecoration: slot.available ? 'none' : 'line-through',
                      }}
                    >
                      {fmt12(slot.time)}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setStep(4)}
                  disabled={!selectedSlot}
                  style={{
                    width: '100%', background: selectedSlot ? 'var(--accent)' : 'var(--bg-chip)',
                    color: selectedSlot ? '#2C0A1E' : 'var(--text-secondary)',
                    border: 'none', borderRadius: '12px', padding: '14px',
                    fontSize: '15px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
                    cursor: selectedSlot ? 'pointer' : 'not-allowed',
                  }}
                >
                  Continue
                </button>
              </>
            )}
          </div>
        )}

        {/* ── STEP 4: Confirm ── */}
        {step === 4 && (
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 20px' }}>Review and confirm your request.</p>

            {/* Summary card */}
            <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Service</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>{selectedService?.name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Date</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>
                    {DAY_NAMES[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()]}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Time</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>
                    {fmt12(selectedSlot)} – {fmt12(addMinutes(selectedSlot, selectedService?.duration_minutes))}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Price</span>
                  <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '600' }}>
                    {selectedService?.price > 0 ? `AED ${selectedService?.price}` : 'Free'}
                  </span>
                </div>
              </div>
            </div>

            {/* Note */}
            <div style={{ marginBottom: '24px' }}>
              <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>
                Note to artist <span style={{ opacity: 0.5 }}>(optional)</span>
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                placeholder="e.g. I love the Velvet Noir design, can we do something similar?"
                rows={3}
                style={{
                  width: '100%', background: 'var(--bg-card)', border: '0.5px solid var(--border)',
                  borderRadius: '10px', padding: '12px', color: 'var(--text-primary)',
                  fontSize: '14px', fontFamily: "'DM Sans', sans-serif",
                  outline: 'none', resize: 'none', boxSizing: 'border-box',
                }}
              />
            </div>

            <button
              onClick={handleSubmit}
              disabled={submitting}
              style={{
                width: '100%', background: 'var(--accent)', color: '#2C0A1E',
                border: 'none', borderRadius: '12px', padding: '14px',
                fontSize: '15px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Sending…' : 'Send booking request ✦'}
            </button>

            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', textAlign: 'center', marginTop: '12px' }}>
              This is a request — the artist will confirm or decline.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
