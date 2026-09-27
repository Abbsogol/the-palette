'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import CheckoutSession from '@/components/CheckoutSession'
import { useAccountAction } from '@/lib/use-account-action'
import { bookingCalendar, calendarKey, dateInZone } from '@/lib/booking-time'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt12(t) {
  if (!t) return ''
  const [rawHour, m] = t.slice(0, 5).split(':').map(Number)
  const h = rawHour % 24
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

export default function BookPage() {
  const { creatorId } = useParams()
  return <CheckoutSession title="Sign in to book an appointment" description="Your appointment and notes belong to your signed-in account.">{userId => <BookingForm key={`${userId}:${creatorId}`} userId={userId} />}</CheckoutSession>
}

function BookingForm({ userId }) {
  const { creatorId } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const designId = searchParams.get('designId')
  const prefillServiceId = searchParams.get('serviceId')
  const prefillNote = searchParams.get('note')

  const [step, setStep] = useState(1) // 1=service, 2=date, 3=time, 4=confirm
  const [currentUser, setCurrentUser] = useState(null)
  const [creator, setCreator] = useState(null)
  const [isPrivateAndBlocked, setIsPrivateAndBlocked] = useState(false)
  const [services, setServices] = useState([])
  const [availability, setAvailability] = useState([]) // active days
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const { run, busy: submitting } = useAccountAction(userId)
  const [timeZone, setTimeZone] = useState(null)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone] = useState(false)

  // Inspiration design (from ?designId=)
  const [inspDesign, setInspDesign] = useState(null)

  // Selections
  const [selectedService, setSelectedService] = useState(null)
  const [selectedDate, setSelectedDate] = useState(null)   // Date object
  const [slotSelection, setSlotSelection] = useState(null)
  const [note, setNote] = useState('')
  const [slotResult, setSlotResult] = useState(null)
  const slotKey = selectedDate && selectedService && timeZone
    ? `${creatorId}:${calendarKey(selectedDate)}:${selectedService.id}:${timeZone}` : null
  const slots = slotResult?.key === slotKey ? slotResult.rows : []
  const slotsError = slotResult?.key === slotKey ? slotResult.error : ''
  const slotsLoading = !!slotKey && slotResult?.key !== slotKey
  const selectedSlot = slotSelection?.key === slotKey && slots.some(slot => slot.time === slotSelection.time && slot.available)
    ? slotSelection.time : null

  useEffect(() => {
    let active = true
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      if (user?.id !== userId) { router.push('/profile'); return }
      setCurrentUser(user)

      // Fetch inspiration design if provided
      if (designId) {
        const { data: d } = await supabase
          .from('designs')
          .select('id, title, image_url')
          .eq('id', designId)
          .single()
        if (d && active) {
          setInspDesign(d)
          setNote(`Inspiration: ${d.title}`)
        }
      }

      const [{ data: prof, error: profError }, { data: svcs, error: svcsError }, { data: avail }, { data: followRow }, { data: settings, error: zoneError }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url, account_type, is_private').eq('id', creatorId).single(),
        supabase.from('services').select('*').eq('creator_id', creatorId).eq('is_active', true).order('created_at', { ascending: true }),
        supabase.from('availability').select('*').eq('creator_id', creatorId).eq('is_active', true).order('day_of_week', { ascending: true }),
        creatorId === user.id ? { data: null } : supabase.from('follows').select('*').eq('follower_id', user.id).eq('following_id', creatorId).maybeSingle(),
        supabase.from('creator_booking_settings').select('time_zone').eq('creator_id', creatorId).maybeSingle(),
      ])

      if (!active) return
      setTimeZone(settings?.time_zone || null)

      // A real fetch failure previously rendered identically to "this
      // creator has no bookable services" — surfaced distinctly instead,
      // same as the existing submit-handler error treatment below.
      if ((profError && profError.code !== 'PGRST116') || svcsError || zoneError) {
        console.error('book page load failed:', profError || svcsError)
        setLoadError(true)
        setLoading(false)
        return
      }

      setCreator(prof)
      setIsPrivateAndBlocked(!!prof?.is_private && creatorId !== user.id && !followRow)
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
      if (prefillNote) setNote(prefillNote)

      setLoading(false)
    }
    init()
    return () => { active = false }
  }, [creatorId, designId, prefillNote, prefillServiceId, router, userId])

  // The database resolves creator-local times and excludes elapsed/DST-invalid
  // slots. A stale response for another date/service must never enable submit.
  useEffect(() => {
    let active = true
    if (!slotKey) return
    supabase.rpc('booking_available_slots', {
      p_creator_id: creatorId, p_date: calendarKey(selectedDate), p_service_id: selectedService.id,
    }).then(({ data, error }) => {
      if (!active) return
      setSlotResult({ key: slotKey,
        rows: error ? [] : (data || []).map(slot => ({ time: slot.start_time.slice(0, 5), available: slot.available })),
        error: error ? 'Available times could not be confirmed. The creator may need to confirm their appointment time zone.' : '',
      })
    }).catch(() => {
      if (active) setSlotResult({ key: slotKey, rows: [], error: 'Available times could not be loaded. Please try another date.' })
    })
    return () => { active = false }
  }, [creatorId, selectedDate, selectedService, slotKey])

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedSlot || !timeZone) return
    setSubmitError('')
    try {
      const result = await run(async session => {
        const { data: newBooking, error } = await supabase.from('bookings').insert({
          client_id: currentUser.id, creator_id: creatorId, service_id: selectedService.id,
          booking_date: calendarKey(selectedDate), start_time: selectedSlot,
          end_time: addMinutes(selectedSlot, selectedService.duration_minutes), time_zone: timeZone,
          status: 'pending', notes: note.trim() || null,
        }).select().single()
        if (error || !newBooking) throw new Error('That appointment time could not be confirmed. Please refresh and choose an available time.')
        fetch('/api/add-reward', {
          method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ reason: 'book_appointment', ref_id: newBooking.id }),
        }).catch(() => {})
        return newBooking
      })
      if (result) setDone(true)
    } catch (error) { setSubmitError(error.message) }
  }

  const buildCalendar = () => bookingCalendar(availability, timeZone)

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

  if (loadError) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px', textAlign: 'center' }}>
      <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>Couldn&apos;t load booking details</p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>Please try again in a moment.</p>
      <button onClick={() => window.location.reload()} style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '12px', padding: '12px 24px', fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
        Retry
      </button>
    </div>
  )

  // ── PRIVATE ACCOUNT GUARD ───────────────────────────────────────────────────
  if (isPrivateAndBlocked) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', margin: '0 0 6px' }}>This account is private</p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 24px' }}>Follow {creator?.display_name || 'them'} to book an appointment.</p>
      <Link href={`/creator/${creatorId}`} style={{ background: 'var(--accent)', color: '#2C0A1E', borderRadius: '12px', padding: '13px 24px', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>
        Back to profile
      </Link>
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
        You&apos;ll get notified once they confirm or decline.
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

      {timeZone ? <p role="status" style={{ padding: '0 20px' }}>All appointment times are in {timeZone.replaceAll('_', ' ')}.</p>
        : <p role="alert" style={{ padding: '0 20px' }}>This creator needs to set their appointment time zone before accepting bookings.</p>}
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
                  const isSelected = selectedDate && item.date.toISOString() === selectedDate.toISOString()
                  const isToday = calendarKey(item.date) === dateInZone(timeZone)
                  return (
                    <button
                      key={i}
                      aria-label={calendarKey(item.date)}
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
                      {item.date.getUTCDate()}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Month label */}
            {selectedDate && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', textAlign: 'center', marginBottom: '20px' }}>
                {DAY_NAMES[selectedDate.getUTCDay()]}, {selectedDate.getUTCDate()} {MONTH_NAMES[selectedDate.getUTCMonth()]} {selectedDate.getUTCFullYear()}
              </p>
            )}

            <button
              onClick={() => setStep(3)}
              disabled={!selectedDate || !timeZone}
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
              {DAY_NAMES[selectedDate.getUTCDay()]}, {selectedDate.getUTCDate()} {MONTH_NAMES[selectedDate.getUTCMonth()]} · {selectedService?.name} ({fmtDuration(selectedService?.duration_minutes)})
            </p>

            {slotsError && <p role="alert">{slotsError}</p>}
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
                      onClick={() => slot.available && setSlotSelection({ key: slotKey, time: slot.time })}
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
                    {DAY_NAMES[selectedDate.getUTCDay()]}, {selectedDate.getUTCDate()} {MONTH_NAMES[selectedDate.getUTCMonth()]}
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

            {submitError && (
              <p style={{ color: '#E07070', fontSize: '13px', textAlign: 'center', marginBottom: '10px' }}>{submitError}</p>
            )}
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
