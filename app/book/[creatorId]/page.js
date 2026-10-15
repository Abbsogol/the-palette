'use client'

import { useState, useEffect, Suspense, useRef } from 'react';
import { useRouter, useParams, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import Sheet from '@/components/ui/Sheet';

// ── Booking palette from frames 250:2116…2483 ──────────────────────────────
import CheckoutSession from '@/components/CheckoutSession';
import { useAccountAction } from '@/lib/use-account-action';
import { bookingCalendar, calendarKey, dateInZone } from '@/lib/booking-time';
import { canGoBack } from '@/lib/navHistory';






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
  const ampm = h % 24 < 12 ? 'am' : 'pm'
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

function BookingForm({userId}) {
const { run, busy: submitting } = useAccountAction(userId)

const [timeZone, setTimeZone] = useState(null)

const calendarEnabled = process.env.NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED === 'true'

const [calendarWarningKey, setCalendarWarningKey] = useState('')

const [calendarAcknowledgement, setCalendarAcknowledgement] = useState('')

const requestIdentity = useRef(null)

const [slotSelection, setSlotSelection] = useState(null)

const [slotResult, setSlotResult] = useState(null)

const [selectedDate, setSelectedDate] = useState(null)

const [selectedService, setSelectedService] = useState(null)

const { creatorId } = useParams()

const slotKey = selectedDate && selectedService && timeZone
    ? `${creatorId}:${calendarKey(selectedDate)}:${selectedService.id}:${timeZone}` : null

const slots = slotResult?.key === slotKey ? slotResult.rows : []

const slotsError = slotResult?.key === slotKey ? slotResult.error : ''

const slotsLoading = !!slotKey && slotResult?.key !== slotKey

const selectedSlot = slotSelection?.key === slotKey && slots.some(slot => slot.time === slotSelection.time && slot.available)
    ? slotSelection.time : null

const calendarSelectionKey = `${slotKey}:${selectedSlot}`

const calendarConflict = slots.find(slot => slot.time === selectedSlot && (slot.calendarConflict || slot.calendarUnchecked)) || calendarWarningKey === calendarSelectionKey

const chevronLeft = (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M19 12H5M12 5l-7 7 7 7"/>
    </svg>
  )

const router = useRouter()

const searchParams = useSearchParams()

const designId = searchParams.get('designId')

const prefillServiceId = searchParams.get('serviceId')

const prefillNote = searchParams.get('note')

const fromParam = searchParams.get('from') || ''

const fromChatConvId = fromParam.startsWith('chat:') ? fromParam.slice(5) : null

const [step, setStep] = useState(1)

const [currentUser, setCurrentUser] = useState(null)

const [creator, setCreator] = useState(null)

const [isPrivateAndBlocked, setIsPrivateAndBlocked] = useState(false)

const [services, setServices] = useState([])

const [availability, setAvailability] = useState([])

const [loading, setLoading] = useState(true)

const [notFoundMsg, setNotFoundMsg] = useState(null)

const [loadError, setLoadError] = useState(false)

const [submitError, setSubmitError] = useState('')

const [done, setDone] = useState(false)

const [inspDesign, setInspDesign] = useState(null)

const [note, setNote] = useState('')

const [refAvailable, setRefAvailable] = useState(false)

const [refDesign, setRefDesign] = useState(null)

const [refPickerOpen, setRefPickerOpen] = useState(false)

const [refLibrary, setRefLibrary] = useState([])

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
        supabase.from('profiles').select('id, display_name, avatar_url, account_type, is_private, booking_area, location').eq('id', creatorId).single(),
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

useEffect(() => {
    let active = true
    if (!slotKey) return
    const loadSlots = async () => {
      if (!calendarEnabled) return supabase.rpc('booking_available_slots', { p_creator_id: creatorId, p_date: calendarKey(selectedDate), p_service_id: selectedService.id })
      const { data: { session } } = await supabase.auth.getSession()
      if (!session || session.user.id !== userId) throw new Error('Sign in again to check availability.')
      const q = new URLSearchParams({creatorId, serviceId:selectedService.id, date:calendarKey(selectedDate)})
      const response = await fetch(`/api/mobile/calendar-slots?${q}`, {headers:{Authorization:`Bearer ${session.access_token}`}})
      const result = await response.json()
      return response.ok ? { data:result.slots } : { error:{message:result.error} }
    }
    loadSlots().then(({ data, error }) => {
      if (!active) return
      setSlotResult({ key: slotKey,
        rows: error ? [] : (data || []).map(slot => ({ time: slot.start_time.slice(0, 5), available: slot.available, calendarConflict:slot.client_calendar_conflict, calendarUnchecked:slot.client_calendar_state === "unavailable" })),
        error: error ? `Available times could not be confirmed. ${error.message || 'Please retry.'}` : '',
      })
    }).catch(() => {
      if (active) setSlotResult({ key: slotKey, rows: [], error: 'Available times could not be loaded. Please try another date.' })
    })
    return () => { active = false }
  }, [creatorId, selectedDate, selectedService, slotKey, calendarEnabled, userId])

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
    if (!selectedService || !selectedDate || !selectedSlot || !timeZone) return
    setSubmitError('')
    try {
      const result = await run(async session => {
        let newBooking, error
        if (calendarEnabled) {
          const payload = { creatorId, serviceId:selectedService.id, date:calendarKey(selectedDate), start:selectedSlot, end:addMinutes(selectedSlot, selectedService.duration_minutes), timeZone, price:Number(selectedService.price), deposit:Number(selectedService.deposit_amount || 0), location:creator.booking_area || creator.location || '', notes:note.trim(), ...(designId ? {designId} : {}), allowCalendarConflict:calendarAcknowledgement === calendarSelectionKey }
          const fingerprint = JSON.stringify(payload)
          if (requestIdentity.current?.fingerprint !== fingerprint) requestIdentity.current = {id:crypto.randomUUID(),fingerprint}
          const response = await fetch('/api/mobile/request-booking', {method:'POST', headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({...payload,id:requestIdentity.current.id})})
          const result = await response.json()
          if (!response.ok) {
            if (['CLIENT_CALENDAR_CONFLICT','CLIENT_CALENDAR_UNCHECKED'].includes(result.code)) setCalendarWarningKey(calendarSelectionKey)
            throw new Error(result.error || 'Appointment could not be confirmed.')
          }
          newBooking = result.booking
        } else ({ data:newBooking, error } = await supabase.from('bookings').insert({
          client_id: currentUser.id, creator_id: creatorId, service_id: selectedService.id,
          booking_date: calendarKey(selectedDate), start_time: selectedSlot,
          end_time: addMinutes(selectedSlot, selectedService.duration_minutes), time_zone: timeZone,
          status: 'pending', notes: note.trim() || null,
        }).select().single())
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
        <p style={ui(600, 15)}>Couldn&apos;t load booking details</p>
        <p style={ui(300, 13, WHITE50)}>Please try again in a moment.</p>
        <button onClick={() => window.location.reload()} style={{ background: BTN_GRADIENT, border: 'none', borderRadius: '1000px', padding: '13px 28px', ...ui(500, 14), cursor: 'pointer' }}>
          Retry
        </button>
      </div>
    </BookShell>
  )

if (notFoundMsg) return (
    <BookShell>
      <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px', textAlign: 'center' }}>
        <p style={ui(600, 15)}>{notFoundMsg}</p>
        <Link href="/search" style={{ background: BTN_GRADIENT, borderRadius: '1000px', padding: '13px 28px', ...ui(500, 14), textDecoration: 'none' }}>Find an artist</Link>
      </div>
    </BookShell>
  )

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
          We&apos;ll notify you when {creator?.display_name} confirms or declines.
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
          <p style={{ ...ui(300, 13, WHITE50), margin: '0 0 14px' }}>Pick one from the laQue library</p>
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
                onClick={() => step > 1 ? setStep(step - 1) : (canGoBack() ? router.back() : router.replace(`/creator/${creatorId}`))}
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

          {timeZone && <p style={ui(400, 12, WHITE50)}>All appointment times are in {timeZone}.</p>}
          {!timeZone && <p role="alert">This creator needs to set their appointment time zone before accepting bookings.</p>}
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
              {availability.length === 0 ? (
                <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '32px 20px', textAlign: 'center' }}>
                  <p style={{ ...ui(500, 15), margin: '0 0 8px' }}>{creator?.display_name || 'This artist'} hasn&apos;t opened any booking dates yet</p>
                  <p style={{ ...ui(300, 13, WHITE50), margin: '0 0 20px', lineHeight: 1.5 }}>Check back soon, or send a message to ask about their availability.</p>
                  <Link href={`/messages?with=${creatorId}`} style={{ display: 'inline-block', background: BTN_GRADIENT, borderRadius: '1000px', padding: '13px 28px', ...ui(500, 14), textDecoration: 'none' }}>
                    Message {creator?.display_name || 'artist'}
                  </Link>
                </div>
              ) : (
                <>
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
                        aria-label={calendarKey(item.date)}
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

              {continueBtn(!!selectedDate && !!timeZone, () => setStep(3))}
                </>
              )}
            </div>
          )}

          {/* ── STEP 3: Pick a time (250:2327) ── */}
          {step === 3 && (
            <div>
              {slotsError && <p role="alert">{slotsError}</p>}
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
                          onClick={() => slot.available && setSlotSelection({ key: slotKey, time: slot.time })}
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

              {calendarConflict && <label style={{ ...ui(400, 13), display: 'block', marginBottom: '16px' }}>
                <input type="checkbox" checked={calendarAcknowledgement === calendarSelectionKey}
                  onChange={e => setCalendarAcknowledgement(e.target.checked ? calendarSelectionKey : '')} />
                I understand this time conflicts with my calendar, or my calendar could not be checked, and want to continue.
              </label>}
              {submitError && (
                <p style={{ ...ui(400, 13, '#E07070'), textAlign: 'center', marginBottom: '10px' }}>{submitError}</p>
              )}
              <div style={{ padding: '0 8px' }}>
                <button
                  onClick={handleSubmit}
                  disabled={submitting || (!!calendarConflict && calendarAcknowledgement !== calendarSelectionKey)}
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
  const { creatorId } = useParams()
  return <CheckoutSession title="Sign in to book an appointment" description="Your appointment and notes belong to your signed-in account.">{userId => <BookingForm key={`${userId}:${creatorId}`} userId={userId} />}</CheckoutSession>
}
