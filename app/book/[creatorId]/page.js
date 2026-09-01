'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Sheet from '@/components/ui/Sheet'

// ── Booking palette from frames 250:2116…2483 ──────────────────────────────
const PANEL = 'rgba(255, 255, 255, 0.06)'
const PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.08)'
const WHITE80 = 'rgba(255, 255, 255, 0.8)'
const WHITE50 = 'rgba(255, 255, 255, 0.5)'
const WHITE40 = 'rgba(255, 255, 255, 0.4)'
const WHITE30 = 'rgba(255, 255, 255, 0.3)'
const ACCENT = '#FF517F'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.35,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.25 })

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']

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

// Local calendar date as YYYY-MM-DD — Date#toISOString() converts to UTC
// first, which shifts the date back a day for any positive UTC offset
// (e.g. Asia/Dubai, UTC+4) once local midnight crosses into the prior UTC day.
function toLocalDateStr(d) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Fixed wine backdrop per the booking frames: base + wine image + 0.6 scrim.
function BookShell({ children }) {
  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      <div aria-hidden className="lq-bg-wine" style={{ position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', zIndex: 0, backgroundColor: '#260D14' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(26, 5, 13, 0.6)' }} />
        <div className="lq-grain" />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}

function BookPageInner() {
  const { creatorId } = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const designId = searchParams.get('designId')
  const prefillServiceId = searchParams.get('serviceId')
  const prefillNote = searchParams.get('note')
  // Entry-aware outcome CTAs: the chat sheet's Book link carries
  // ?from=chat:<conversationId>; profile entries carry nothing.
  const fromParam = searchParams.get('from') || ''
  const fromChatConvId = fromParam.startsWith('chat:') ? fromParam.slice(5) : null

  const [step, setStep] = useState(1) // 1=service, 2=date, 3=time, 4=confirm
  const [currentUser, setCurrentUser] = useState(null)
  const [creator, setCreator] = useState(null)
  const [isPrivateAndBlocked, setIsPrivateAndBlocked] = useState(false)
  const [services, setServices] = useState([])
  const [availability, setAvailability] = useState([]) // active days
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
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

  // Reference design attachment (bookings.reference_design_id, feature-
  // detected so the insert can never break if the column is missing)
  const [refAvailable, setRefAvailable] = useState(false)
  const [refDesign, setRefDesign] = useState(null)
  const [refPickerOpen, setRefPickerOpen] = useState(false)
  const [refLibrary, setRefLibrary] = useState([])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/profile'); return }
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

      const [{ data: prof, error: profError }, { data: svcs, error: svcsError }, { data: avail }, { data: followRow }, { error: refColErr }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url, account_type, is_private').eq('id', creatorId).single(),
        supabase.from('services').select('*').eq('creator_id', creatorId).eq('is_active', true).order('created_at', { ascending: true }),
        supabase.from('availability').select('*').eq('creator_id', creatorId).eq('is_active', true).order('day_of_week', { ascending: true }),
        creatorId === user.id ? { data: null } : supabase.from('follows').select('*').eq('follower_id', user.id).eq('following_id', creatorId).maybeSingle(),
        supabase.from('bookings').select('reference_design_id').limit(1),
      ])

      // A real fetch failure previously rendered identically to "this
      // creator has no bookable services" — surfaced distinctly instead,
      // same as the existing submit-handler error treatment below.
      if ((profError && profError.code !== 'PGRST116') || svcsError) {
        console.error('book page load failed:', profError || svcsError)
        setLoadError(true)
        setLoading(false)
        return
      }

      setCreator(prof)
      setIsPrivateAndBlocked(!!prof?.is_private && creatorId !== user.id && !followRow)
      setServices(svcs || [])
      setAvailability(avail || [])
      setRefAvailable(!refColErr)

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

  // A ?designId= inspiration doubles as the attached reference once the
  // column exists (the note prefill above is unchanged).
  useEffect(() => {
    if (refAvailable && inspDesign && !refDesign) setRefDesign(inspDesign)
  }, [refAvailable, inspDesign])

  // Generate time slots when date + service selected
  useEffect(() => {
    if (!selectedDate || !selectedService) return
    const fetchSlots = async () => {
      setSlotsLoading(true)
      const dow = selectedDate.getDay()
      const dayAvail = availability.find(a => a.day_of_week === dow)
      if (!dayAvail) { setSlots([]); setSlotsLoading(false); return }

      // Get existing bookings for this creator on this date
      const dateStr = toLocalDateStr(selectedDate)
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

  const openRefPicker = async () => {
    setRefPickerOpen(true)
    if (refLibrary.length) return
    const { data } = await supabase
      .from('designs')
      .select('id, title, image_url')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(60)
    setRefLibrary(data || [])
  }

  const [doneBookingId, setDoneBookingId] = useState(null)

  const handleSubmit = async () => {
    if (!selectedService || !selectedDate || !selectedSlot) return
    setSubmitting(true)
    setSubmitError('')

    const dateStr = toLocalDateStr(selectedDate)
    const endTime = addMinutes(selectedSlot, selectedService.duration_minutes)

    const { data: newBooking, error } = await supabase.from('bookings').insert({
      client_id: currentUser.id,
      creator_id: creatorId,
      service_id: selectedService.id,
      booking_date: dateStr,
      start_time: selectedSlot,
      end_time: endTime,
      status: 'pending',
      notes: note.trim() || null,
      ...(refAvailable && refDesign ? { reference_design_id: refDesign.id } : {}),
    }).select().single()

    if (error || !newBooking) {
      setSubmitError('Failed to send booking request. Please try again.')
      setSubmitting(false)
      return
    }

    // Notify the creator
    await supabase.from('notifications').insert({
      user_id: creatorId,
      actor_id: currentUser.id,
      type: 'booking_request',
    })

    // Reward the client for booking
    const { data: { session } } = await supabase.auth.getSession()
    fetch('/api/add-reward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
      body: JSON.stringify({ reason: 'book_appointment', ref_id: newBooking.id }),
    })

    setDoneBookingId(newBooking.id)
    setSubmitting(false)
    setDone(true)
  }

  // Build a 42-day (6-week) calendar grid, aligned to Sun–Sat columns so
  // dates land under their correct weekday header regardless of what
  // weekday "today" happens to be.
  const buildCalendar = () => {
    const activeDows = new Set(availability.map(a => a.day_of_week))
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const startOfWeek = new Date(today)
    startOfWeek.setDate(today.getDate() - today.getDay())
    const days = []
    for (let i = 0; i < 42; i++) {
      const d = new Date(startOfWeek)
      d.setDate(startOfWeek.getDate() + i)
      days.push({ date: d, available: d >= today && activeDows.has(d.getDay()) })
    }
    return days
  }

  if (loading) return (
    <BookShell>
      <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={ui(300, 14, WHITE50)}>Loading…</p>
      </div>
    </BookShell>
  )

  if (loadError) return (
    <BookShell>
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px', textAlign: 'center' }}>
        <p style={ui(600, 15)}>Couldn't load booking details</p>
        <p style={ui(300, 13, WHITE50)}>Please try again in a moment.</p>
        <button onClick={() => window.location.reload()} style={{ background: BTN_GRADIENT, border: 'none', borderRadius: '1000px', padding: '13px 28px', ...ui(500, 14), cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    </BookShell>
  )

  // ── PRIVATE ACCOUNT GUARD ───────────────────────────────────────────────────
  if (isPrivateAndBlocked) return (
    <BookShell>
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={WHITE50} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '16px' }}>
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
          <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <p style={{ ...ui(600, 15), margin: '0 0 6px' }}>This account is private</p>
        <p style={{ ...ui(300, 13, WHITE50), margin: '0 0 24px' }}>Follow {creator?.display_name || 'them'} to book an appointment.</p>
        <Link href={`/creator/${creatorId}`} style={{ background: BTN_GRADIENT, borderRadius: '1000px', padding: '14px 28px', ...ui(500, 14), textDecoration: 'none' }}>
          Back to profile
        </Link>
      </div>
    </BookShell>
  )

  // ── REQUEST SENT (frame 250:2483) — the wizard's true final screen ─────────
  if (done) return (
    <BookShell>
      <div style={{ minHeight: '100dvh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px calc(env(safe-area-inset-bottom) + 40px)', textAlign: 'center' }}>
        <div style={{ width: '68px', height: '68px', borderRadius: '34px', background: PANEL, border: PANEL_BORDER, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M18 3v4M20 5h-4"/>
          </svg>
        </div>
        <h1 style={{ ...display(26), color: ACCENT, margin: '0 0 14px' }}>Request sent!</h1>
        <p style={{ ...ui(400, 14), margin: '0 0 6px' }}>
          Your appointment request has been sent to {creator?.display_name}.
        </p>
        <p style={{ ...ui(300, 13, WHITE50), margin: '0 0 20px' }}>
          We'll notify you when {creator?.display_name} confirms or declines.
        </p>
        <span style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '100px', padding: '7px 14px', ...ui(300, 12, WHITE80), marginBottom: '36px' }}>
          {selectedService?.name} · {DAY_SHORT[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTH_NAMES[selectedDate.getMonth()]} · {fmt12(selectedSlot)}
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', maxWidth: '345px' }}>
          {fromChatConvId ? (
            <>
              <Link href={`/messages/${fromChatConvId}`} style={{ background: BTN_GRADIENT, borderRadius: '1000px', padding: '15px', ...ui(500, 15), textDecoration: 'none', textAlign: 'center' }}>
                Back to chat
              </Link>
              <Link href={doneBookingId ? `/appointments/${doneBookingId}` : '/appointments'} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '1000px', padding: '14px', ...ui(400, 14), textDecoration: 'none', textAlign: 'center' }}>
                View request
              </Link>
            </>
          ) : (
            <>
              <Link href={doneBookingId ? `/appointments/${doneBookingId}` : '/appointments'} style={{ background: BTN_GRADIENT, borderRadius: '1000px', padding: '15px', ...ui(500, 15), textDecoration: 'none', textAlign: 'center' }}>
                View request
              </Link>
              <Link href={`/creator/${creatorId}`} style={{ background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '1000px', padding: '14px', ...ui(400, 14), textDecoration: 'none', textAlign: 'center' }}>
                Back to profile
              </Link>
            </>
          )}
        </div>
      </div>
    </BookShell>
  )

  const calendarDays = buildCalendar()
  const monthLabelDate = selectedDate || new Date()
  const stepHeadings = {
    1: ['Choose a service', null],
    2: ['Pick a date', 'Available dates are highlighted'],
    3: ['Pick a time', selectedDate ? `${DAY_SHORT[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]} · ${selectedService?.name} (${fmtDuration(selectedService?.duration_minutes || 0)})` : null],
    4: ['Review your booking', 'Review and confirm your request.'],
  }
  const [heading, subheading] = stepHeadings[step]

  // Plain-text Continue per the frames; the gradient pill is reserved for
  // the final Send.
  const continueBtn = (enabled, onClick, label = 'Continue') => (
    <button onClick={onClick} disabled={!enabled}
      style={{ width: '100%', height: '52px', background: 'none', border: 'none', ...ui(500, 16, enabled ? 'var(--lq-white)' : WHITE30), cursor: enabled ? 'pointer' : 'default' }}>
      {label}
    </button>
  )

  return (
    <>
      {/* ── Reference design picker ── */}
      {refPickerOpen && (
        <Sheet title="Attach a reference design" onClose={() => setRefPickerOpen(false)}>
          <h2 style={{ ...ui(600, 18), margin: '0 0 4px' }}>Attach a reference design</h2>
          <p style={{ ...ui(300, 13, WHITE50), margin: '0 0 14px' }}>Pick one from the Laque library</p>
          {refLibrary.length === 0 ? (
            <p style={{ ...ui(300, 14, WHITE50), textAlign: 'center', padding: '24px 0' }}>Loading designs…</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', paddingBottom: '16px' }}>
              {refLibrary.map(d => (
                <button key={d.id} onClick={() => { setRefDesign(d); setRefPickerOpen(false) }}
                  style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: refDesign?.id === d.id ? `2px solid ${ACCENT}` : PANEL_BORDER, background: PANEL, aspectRatio: '1/1', padding: 0, cursor: 'pointer' }}>
                  {d.image_url && <img src={d.image_url} alt={d.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                </button>
              ))}
            </div>
          )}
        </Sheet>
      )}

      <BookShell>
        {/* ── Header: gradient blur bar + progress dots (frames' shell) ── */}
        <div style={{ paddingTop: 'env(safe-area-inset-top)', background: 'linear-gradient(0deg, rgba(32,5,11,0) 0%, rgba(32,5,11,0.8) 100%)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px', padding: '8px 16px 8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => step > 1 ? setStep(step - 1) : router.back()}
                aria-label={step > 1 ? 'Previous step' : 'Back'}
                style={{ width: '44px', height: '44px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--lq-white)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div>
                <h1 style={{ ...display(18), margin: 0 }}>Book appointment</h1>
                <p style={{ ...ui(300, 13, WHITE50), margin: '2px 0 0' }}>{creator?.display_name}</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }} aria-label={`Step ${step} of 4`}>
              {[1,2,3,4].map(s => (
                <div key={s} style={{ width: s === step ? '16px' : '6px', height: '6px', borderRadius: '100px', background: s <= step ? ACCENT : 'rgba(255,255,255,0.2)', transition: 'all 0.2s' }} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '20px 16px calc(env(safe-area-inset-bottom) + 32px)' }}>

          <div style={{ marginBottom: '16px' }}>
            <h2 style={{ ...display(20), margin: 0 }}>{heading}</h2>
            {subheading && <p style={{ ...ui(300, 13, WHITE40), margin: '4px 0 0' }}>{subheading}</p>}
          </div>

          {/* ── Inspiration card ── */}
          {inspDesign && step === 1 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,81,127,0.08)', border: '1px solid rgba(255,81,127,0.3)', borderRadius: '14px', padding: '12px 14px', marginBottom: '16px' }}>
              <img src={inspDesign.image_url} alt={inspDesign.title} style={{ width: '52px', height: '52px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ ...ui(600, 10, WHITE50), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px' }}>Inspiration</p>
                <p style={{ ...ui(500, 14), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{inspDesign.title}</p>
              </div>
            </div>
          )}

          {/* ── STEP 1: Choose service (250:2116) ── */}
          {step === 1 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {services.map(s => {
                const sel = selectedService?.id === s.id
                return (
                  <button
                    key={s.id}
                    onClick={() => { setSelectedService(s); setStep(2) }}
                    style={{
                      background: PANEL,
                      border: sel ? `1px solid ${ACCENT}` : PANEL_BORDER,
                      borderRadius: '12px', padding: '16px', textAlign: 'left',
                      cursor: 'pointer', width: '100%',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}
                  >
                    <div>
                      <p style={{ ...ui(500, 15), margin: '0 0 4px' }}>{s.name}</p>
                      {s.description && <p style={{ ...ui(300, 12, WHITE50), margin: '0 0 6px', lineHeight: 1.4 }}>{s.description}</p>}
                      <span style={ui(300, 13, WHITE50)}>{fmtDuration(s.duration_minutes)}</span>
                    </div>
                    <span style={{ ...ui(500, 15, sel ? ACCENT : 'var(--lq-white)'), marginLeft: '16px', whiteSpace: 'nowrap' }}>
                      {s.price > 0 ? `AED ${s.price}` : 'Free'}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* ── STEP 2: Pick a date (250:2180) ── */}
          {step === 2 && (
            <div>
              {/* Calendar card. The frame draws month ‹ › paging; the
                  existing logic is a fixed 6-week window from today, so the
                  arrows are omitted rather than shipped dead (logged). */}
              <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '16px', marginBottom: '8px' }}>
                <p style={{ ...ui(500, 16), textAlign: 'center', margin: '0 0 16px' }}>
                  {MONTH_FULL[monthLabelDate.getMonth()]} {monthLabelDate.getFullYear()}
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '8px' }}>
                  {DAY_SHORT.map(d => (
                    <div key={d} style={{ textAlign: 'center', ...ui(500, 12, WHITE40), padding: '4px 0' }}>{d}</div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px 4px' }}>
                  {calendarDays.map((item, i) => {
                    const isSelected = selectedDate && item.date.toDateString() === selectedDate.toDateString()
                    const isToday = item.date.toDateString() === new Date().toDateString()
                    return (
                      <button
                        key={i}
                        onClick={() => item.available && setSelectedDate(item.date)}
                        disabled={!item.available}
                        style={{
                          height: '32px', borderRadius: '8px',
                          background: isSelected ? ACCENT : isToday ? 'rgba(255,255,255,0.1)' : 'transparent',
                          border: 'none',
                          ...ui(isSelected ? 600 : item.available ? 500 : 400, 14, (isSelected || item.available) ? 'var(--lq-white)' : 'rgba(255,255,255,0.22)'),
                          cursor: item.available ? 'pointer' : 'default',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        {item.date.getDate()}
                      </button>
                    )
                  })}
                </div>
              </div>

              {selectedDate && (
                <p style={{ ...ui(500, 15, ACCENT), textAlign: 'center', padding: '8px 0', margin: 0 }}>
                  {DAY_NAMES[selectedDate.getDay()]}, {selectedDate.getDate()} {MONTH_FULL[selectedDate.getMonth()]} {selectedDate.getFullYear()}
                </p>
              )}

              {continueBtn(!!selectedDate, () => setStep(3))}
            </div>
          )}

          {/* ── STEP 3: Pick a time (250:2327) ── */}
          {step === 3 && (
            <div>
              {slotsLoading ? (
                <p style={{ ...ui(300, 14, WHITE50), textAlign: 'center', padding: '32px 0' }}>Loading slots…</p>
              ) : slots.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <p style={{ ...ui(500, 15), marginBottom: '8px' }}>No slots available</p>
                  <p style={ui(300, 13, WHITE50)}>Try a different date.</p>
                  <button onClick={() => setStep(2)} style={{ marginTop: '16px', background: 'none', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px', padding: '9px 20px', ...ui(300, 13, WHITE80), cursor: 'pointer' }}>
                    ← Change date
                  </button>
                </div>
              ) : (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
                    {slots.map(slot => {
                      const sel = selectedSlot === slot.time
                      return (
                        <button
                          key={slot.time}
                          onClick={() => slot.available && setSelectedSlot(slot.time)}
                          disabled={!slot.available}
                          style={{
                            padding: '13px 8px', borderRadius: '10px',
                            background: sel ? 'rgba(255,255,255,0.14)' : PANEL,
                            border: sel ? `1px solid ${ACCENT}` : PANEL_BORDER,
                            ...ui(sel ? 600 : 400, 13, slot.available ? 'var(--lq-white)' : 'rgba(255,255,255,0.25)'),
                            cursor: slot.available ? 'pointer' : 'not-allowed',
                            textDecoration: slot.available ? 'none' : 'line-through',
                          }}
                        >
                          {fmt12(slot.time)}
                        </button>
                      )
                    })}
                  </div>
                  {continueBtn(!!selectedSlot, () => setStep(4))}
                </>
              )}
            </div>
          )}

          {/* ── STEP 4: Review (250:2408) ── */}
          {step === 4 && (
            <div>
              {/* Summary card */}
              <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '12px', padding: '4px 16px', marginBottom: '16px' }}>
                {[
                  ['Service', selectedService?.name, false],
                  ['Date', `${DAY_NAMES[selectedDate.getDay()]}, ${selectedDate.getDate()} ${MONTH_NAMES[selectedDate.getMonth()]}`, true],
                  ['Time', `${fmt12(selectedSlot)} – ${fmt12(addMinutes(selectedSlot, selectedService?.duration_minutes))}`, true],
                  ['Duration', fmtDuration(selectedService?.duration_minutes || 0), false],
                  ['Price', selectedService?.price > 0 ? `AED ${selectedService?.price}` : 'Free', true],
                ].map(([label, value, accent], i, arr) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                    <span style={ui(400, 14, WHITE50)}>{label}</span>
                    <span style={ui(500, 15, accent ? ACCENT : 'var(--lq-white)')}>{value}</span>
                  </div>
                ))}
              </div>

              {/* Note to artist — writes bookings.notes on the insert */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'flex', gap: '4px', alignItems: 'baseline', marginBottom: '8px' }}>
                  <span style={{ ...ui(500, 11, WHITE30), letterSpacing: '0.04em' }}>NOTE TO ARTIST</span>
                  <span style={ui(300, 10, WHITE30)}>(OPTIONAL)</span>
                </label>
                <textarea
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="Tell the artist about the design you want…"
                  rows={4}
                  aria-label="Note to artist"
                  style={{
                    width: '100%', minHeight: '100px', background: PANEL, border: PANEL_BORDER,
                    borderRadius: '12px', padding: '12px', color: 'var(--lq-white)',
                    fontSize: '14px', fontFamily: 'var(--lq-font-ui)',
                    outline: 'none', resize: 'none', boxSizing: 'border-box',
                  }}
                />
              </div>

              {/* Attach a reference design (feature-detected column) */}
              {refAvailable && (
                refDesign ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: PANEL, border: PANEL_BORDER, borderRadius: '12px', padding: '10px 12px', marginBottom: '20px' }}>
                    <img src={refDesign.image_url} alt={refDesign.title} style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...ui(500, 10, WHITE50), letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 2px' }}>Reference design</p>
                      <p style={{ ...ui(500, 13), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{refDesign.title}</p>
                    </div>
                    <button onClick={() => setRefDesign(null)} aria-label="Remove reference design"
                      style={{ background: 'none', border: 'none', color: WHITE50, cursor: 'pointer', fontSize: '16px', padding: '8px' }}>✕</button>
                  </div>
                ) : (
                  <button onClick={openRefPicker}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '0 0 20px', ...ui(500, 13, ACCENT) }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48"/>
                    </svg>
                    Attach a reference design
                  </button>
                )
              )}

              {submitError && (
                <p style={{ ...ui(400, 13, '#E07070'), textAlign: 'center', marginBottom: '10px' }}>{submitError}</p>
              )}
              <div style={{ padding: '0 8px' }}>
                <button
                  onClick={handleSubmit}
                  disabled={submitting}
                  style={{
                    width: '100%', height: '52px', background: BTN_GRADIENT,
                    border: 'none', borderRadius: '1000px', ...ui(500, 16),
                    cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
                  }}
                >
                  {submitting ? 'Sending…' : 'Send booking request ✦'}
                </button>
                <p style={{ ...ui(300, 12, WHITE30), textAlign: 'center', marginTop: '12px' }}>
                  This is a request — {creator?.display_name} will confirm or decline.
                </p>
              </div>
            </div>
          )}

        </div>
      </BookShell>
    </>
  )
}

export default function BookPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: '#260D14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--lq-font-ui)', fontWeight: 300, fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Loading…</p>
      </div>
    }>
      <BookPageInner />
    </Suspense>
  )
}
