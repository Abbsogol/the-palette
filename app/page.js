'use client'

// Onboarding carousel — replaces the scrolling marketing landing entirely
// (Sogol, 2026-09-02). Slides from frames 136:2214 + 144:2387/2418/2448,
// plus two harvested from landing 262:2452 with verified-live claims only.
// Shown once per device via lq-onboarded (fail-open: unreadable storage
// shows the carousel); signed-in users bypass straight to /feed.

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { LaqueWordmark } from '@/components/ui/icons'

const BLUSH = '#FFEDED'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
// Bottom overlay — stops verbatim from frame 144:2391 (bottom → top).
const OVERLAY = 'linear-gradient(0deg, rgba(32,5,11,0.6) 13.314%, rgb(32,5,11) 37.887%, rgba(32,5,11,0) 99.981%)'
// Mask ramp mirroring the overlay's alpha so the backdrop blur fades with it
// (same technique as the Nail Lab CTA wash — a hard blur edge would show).
const OVERLAY_MASK = 'linear-gradient(to top, black 0%, black 38%, transparent 100%)'

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color,
})
const display = (size) => ({
  fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)',
})

const SLIDES = [
  { img: '/redesign/onboarding/slide-1.webp', splash: true },
  { img: '/redesign/onboarding/slide-2.webp', title: 'Full colour specs', body: 'Hex codes, gel brand, shade names, finish type. No more vague inspo' },
  { img: '/redesign/onboarding/slide-3.webp', title: 'Search & filter', body: 'By shape, length, technique, or occasion. Everyday to editorial' },
  { img: '/redesign/onboarding/slide-4.webp', title: 'Save & share', body: 'Heart the looks you love and send a direct link straight to your nail tech' },
  { img: '/redesign/onboarding/slide-5.webp', title: 'Create your own', body: 'Describe your dream set and Nail Lab generates it in seconds — ready to save or publish to the library' },
  { img: '/redesign/onboarding/slide-6.webp', title: 'For nail artists', body: 'Post your work with full specs and take bookings right in the app. 5 free uploads a week — Pro Creator for unlimited', creator: true },
]
const NUMBERED = SLIDES.length - 1
const ONBOARDED_KEY = 'lq-onboarded'

export default function OnboardingPage() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [index, setIndex] = useState(0)
  const [reduced, setReduced] = useState(false)
  const touchRef = useRef(null)
  const indexRef = useRef(0)
  indexRef.current = index

  // Once-only + signed-in bypass. Storage must fail OPEN: if it throws,
  // show the carousel rather than erroring.
  useEffect(() => {
    let cancelled = false
    try {
      if (localStorage.getItem(ONBOARDED_KEY) === '1') { router.replace('/feed'); return }
    } catch {}
    ;(async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!cancelled && session) { router.replace('/feed'); return }
      } catch {}
      if (!cancelled) setReady(true)
    })()
    return () => { cancelled = true }
  }, [router])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = (e) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const finish = () => {
    try { localStorage.setItem(ONBOARDED_KEY, '1') } catch {}
    router.replace('/feed')
  }
  const advance = () => {
    if (indexRef.current >= SLIDES.length - 1) finish()
    else setIndex(indexRef.current + 1)
  }
  const step = (dir) => {
    setIndex(Math.max(0, Math.min(SLIDES.length - 1, indexRef.current + dir)))
  }

  useEffect(() => {
    if (!ready) return
    const onKey = (e) => {
      if (e.key === 'ArrowRight') step(1)
      else if (e.key === 'ArrowLeft') step(-1)
      else if (e.key === 'Escape') finish()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready])

  const onTouchStart = (e) => {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
  }
  const onTouchEnd = (e) => {
    const start = touchRef.current
    touchRef.current = null
    if (!start) return
    const dx = e.changedTouches[0].clientX - start.x
    const dy = e.changedTouches[0].clientY - start.y
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) step(dx < 0 ? 1 : -1)
  }

  if (!ready) return <div style={{ minHeight: '100dvh' }} className="lq-bg-wine" />

  const slide = (s, i) => {
    const active = i === index
    const last = i === SLIDES.length - 1
    return (
      <section
        key={s.img}
        aria-hidden={!active}
        aria-roledescription="slide"
        aria-label={s.splash ? 'Welcome' : `${String(i).padStart(2, '0')} of ${String(NUMBERED).padStart(2, '0')} — ${s.title}`}
        style={reduced ? {
          position: 'absolute', inset: 0, opacity: active ? 1 : 0,
          transition: 'opacity 260ms ease', pointerEvents: active ? 'auto' : 'none',
          overflow: 'hidden',
        } : {
          position: 'relative', flex: `0 0 ${100 / SLIDES.length}%`, height: '100%', overflow: 'hidden',
        }}
      >
        <img
          src={s.img}
          alt=""
          loading={i < 2 ? 'eager' : 'lazy'}
          fetchPriority={i === 0 ? 'high' : undefined}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center' }}
        />
        {/* Bottom wash (frame 144:2391): gradient + blur fading on one ramp */}
        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: '76%',
          background: OVERLAY,
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          maskImage: OVERLAY_MASK, WebkitMaskImage: OVERLAY_MASK,
          pointerEvents: 'none',
        }} />

        {!s.splash && (
          <button
            onClick={finish}
            style={{
              position: 'absolute', top: 'calc(env(safe-area-inset-top) + 14px)', right: '14px',
              background: 'none', border: 'none', padding: '10px 12px', minHeight: '44px',
              ...ui(300, 20, BLUSH), cursor: 'pointer', zIndex: 2,
            }}
          >
            Skip
          </button>
        )}

        {s.splash ? (
          <div style={{
            position: 'absolute', left: '50%', top: 'calc(50% + 95px)', transform: 'translate(-50%, -50%)',
            width: '312px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center',
          }}>
            <h1 style={{ margin: 0, color: 'var(--lq-white)' }}>
              <LaqueWordmark height={100} />
            </h1>
            <p style={{ ...ui(300, 20), lineHeight: 1.1, margin: 0, whiteSpace: 'pre-line' }}>
              {'Your next nail set, designed,\ntried on, and booked'}
            </p>
          </div>
        ) : (
          <div style={{
            position: 'absolute', left: '50%', top: 'calc(50% + 96px)', transform: 'translate(-50%, -50%)',
            width: '345px', maxWidth: 'calc(100% - 48px)', display: 'flex', flexDirection: 'column',
            gap: '32px', alignItems: 'center', textAlign: 'center',
          }}>
            <p style={{ ...ui(300, 20), lineHeight: 1.1, margin: 0 }}>
              {String(i).padStart(2, '0')}/{String(NUMBERED).padStart(2, '0')}
            </p>
            <div>
              <h2 style={{ ...display(32), textTransform: 'uppercase', lineHeight: 1.2, margin: 0 }}>{s.title}</h2>
              <p style={{ ...ui(300, 20, BLUSH), lineHeight: 1.1, margin: 0 }}>{s.body}</p>
            </div>
          </div>
        )}

        <div style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          padding: '0 24px calc(env(safe-area-inset-bottom) + 24px)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', zIndex: 2,
        }}>
          <button
            onClick={last ? finish : advance}
            style={{
              width: '100%', maxWidth: '345px', height: '54px', background: BTN_GRADIENT,
              border: 'none', borderRadius: '1000px', ...ui(400, 18), cursor: 'pointer',
            }}
          >
            {last ? 'Explore Design' : 'Next'}
          </button>
          {s.creator && (
            <Link
              href="/profile"
              style={{
                ...ui(400, 15, BLUSH), textDecoration: 'underline', textUnderlineOffset: '3px',
                padding: '12px', minHeight: '44px', display: 'inline-flex', alignItems: 'center',
              }}
            >
              Join as a Creator
            </Link>
          )}
        </div>
      </section>
    )
  }

  return (
    <main
      aria-roledescription="carousel"
      aria-label="Welcome to laQue"
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position: 'fixed', inset: 0, overflow: 'hidden', background: 'var(--lq-wine, #260D14)' }}
    >
      {reduced ? (
        SLIDES.map(slide)
      ) : (
        <div style={{
          display: 'flex', height: '100%', width: `${SLIDES.length * 100}%`,
          transform: `translateX(-${index * (100 / SLIDES.length)}%)`,
          transition: 'transform 420ms cubic-bezier(0.22, 0.61, 0.36, 1)',
        }}>
          {SLIDES.map(slide)}
        </div>
      )}
    </main>
  )
}
