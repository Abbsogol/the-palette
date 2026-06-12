'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ── Deck: stacked → fanned positions ─────────────────────────────────────────
const DECK_STACK = [
  { rotate: -9, x:  3, y:  0 },
  { rotate: -4, x: -2, y: -3 },
  { rotate:  1, x:  0, y: -5 },
  { rotate:  5, x:  2, y: -3 },
  { rotate:  9, x: -1, y:  0 },
  { rotate: -2, x:  1, y:  2 },
]
const DECK_FAN = [
  { rotate: -34, x: -160, y: 32 },
  { rotate: -20, x:  -95, y:  6 },
  { rotate:  -7, x:  -34, y: -16 },
  { rotate:   7, x:   34, y: -16 },
  { rotate:  20, x:   95, y:   6 },
  { rotate:  34, x:  160, y:  32 },
]

// ── Ribbon dimensions ─────────────────────────────────────────────────────────
const RIBBON_IMG_W = 110
const RIBBON_GAP   = 10
const RIBBON_COUNT = 8
const RIBBON_UNIT  = (RIBBON_IMG_W + RIBBON_GAP) * RIBBON_COUNT  // ~960px

export default function LandingPage() {
  const wrapperRef     = useRef(null)
  const canvasRef      = useRef(null)
  const heroRef        = useRef(null)
  const featRef        = useRef(null)
  const creatRef       = useRef(null)
  const cardRefs       = useRef([])
  const featRibbonRef  = useRef(null)
  const creatRibbonRef = useRef(null)
  const [designs, setDesigns] = useState([])

  // Load 28 designs:
  // [0–5]   → hero deck (6 cards)
  // [6–13]  → features ribbon (8 images × 2)
  // [14–21] → creator ribbon  (8 images × 2)
  useEffect(() => {
    supabase.from('designs').select('id, image_url')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(28)
      .then(({ data }) => setDesigns(data || []))
  }, [])

  // ── Animation + scroll engine ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const cl   = (v, a, b) => Math.max(a, Math.min(b, v))
    const map  = (v, a, b, c, d) => c + (d - c) * cl((v - a) / (b - a), 0, 1)
    const mix  = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * cl(t, 0, 1)))
    const lerp = (a, b, t) => a + (b - a) * cl(t, 0, 1)

    let stars = [], drifters = [], raf
    let scrollP = 0

    // Colour palette per section
    const PAL = {
      hero:     { t:[38,8,28],   b:[8,4,14],   n1:[90,32,70],  n2:[65,20,96]  },
      features: { t:[55,14,32],  b:[20,6,16],  n1:[110,28,55], n2:[75,18,55]  },
      creator:  { t:[42,8,38],   b:[15,4,24],  n1:[80,18,75],  n2:[55,12,90]  },
    }

    function getPal(p) {
      if (p < 0.42) {
        const t = map(p, 0.20, 0.42, 0, 1)
        return {
          t:  mix(PAL.hero.t,     PAL.features.t,  t),
          b:  mix(PAL.hero.b,     PAL.features.b,  t),
          n1: mix(PAL.hero.n1,    PAL.features.n1, t),
          n2: mix(PAL.hero.n2,    PAL.features.n2, t),
        }
      } else {
        const t = map(p, 0.57, 0.75, 0, 1)
        return {
          t:  mix(PAL.features.t,  PAL.creator.t,  t),
          b:  mix(PAL.features.b,  PAL.creator.b,  t),
          n1: mix(PAL.features.n1, PAL.creator.n1, t),
          n2: mix(PAL.features.n2, PAL.creator.n2, t),
        }
      }
    }

    const DRIFT_COLS = [
      [212,160,192],[200,125,162],[240,205,222],
      [220,175,155],[255,215,230],[170,90,128],
    ]

    function initParticles() {
      const W = canvas.width, H = canvas.height
      stars = Array.from({ length: 100 }, () => ({
        x: Math.random() * W, y: Math.random() * H,
        r: Math.random() * 1.4 + 0.25,
        a: Math.random() * 0.52 + 0.10,
        t: Math.random() * Math.PI * 2,
        s: Math.random() * 0.003 + 0.001,
        pink: Math.random() > 0.82,
      }))
      drifters = Array.from({ length: 160 }, () => {
        const col = DRIFT_COLS[Math.floor(Math.random() * DRIFT_COLS.length)]
        return {
          x: Math.random() * W, y: Math.random() * H,
          r: Math.random() * 2.0 + 0.55,
          maxA: Math.random() * 0.50 + 0.18,
          vy: -(Math.random() * 0.35 + 0.08),
          vx: (Math.random() - 0.5) * 0.12,
          tw: Math.random() * Math.PI * 2,
          ts: Math.random() * 0.014 + 0.004,
          wx: Math.random() * Math.PI * 2,
          ws: Math.random() * 0.007 + 0.002,
          col,
          sparkTimer: Math.random() * 200 + 60,
          sparking: false, sparkA: 0,
        }
      })
    }

    function resize() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      initParticles()
    }

    function draw() {
      const W = canvas.width, H = canvas.height
      const pal = getPal(scrollP)

      // Dark base
      ctx.fillStyle = '#0b0909'
      ctx.fillRect(0, 0, W, H)

      // Colour wash gradient
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, `rgba(${pal.t.join(',')},0.60)`)
      bg.addColorStop(1, `rgba(${pal.b.join(',')},0.55)`)
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      // Nebula glows
      ;[[W*.55, H*.18, W*.34, pal.n1, 0.09],[W*1.42, H*.74, W*.28, pal.n2, 0.07]]
        .forEach(([ox,oy,or_,col,oa]) => {
          const g = ctx.createRadialGradient(ox,oy,0,ox,oy,or_)
          g.addColorStop(0, `rgba(${col.join(',')},${oa})`)
          g.addColorStop(1, `rgba(${col.join(',')},0)`)
          ctx.fillStyle = g
          ctx.beginPath(); ctx.arc(ox,oy,or_,0,Math.PI*2); ctx.fill()
        })

      // Stars
      stars.forEach(s => {
        s.t += s.s
        const a = s.a * (0.52 + 0.48 * Math.sin(s.t))
        ctx.fillStyle = s.pink ? `rgba(212,160,192,${a})` : `rgba(255,255,255,${a})`
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI*2); ctx.fill()
      })

      // Drifting particles
      const spMult = 1 + scrollP * 1.4
      drifters.forEach(p => {
        p.tw += p.ts; p.wx += p.ws
        p.x += p.vx + Math.sin(p.wx) * 0.45
        p.y += p.vy * spMult
        if (p.y < -6)   { p.y = H + 6; p.x = Math.random() * W }
        if (p.x < -14)  p.x = W + 14
        if (p.x > W+14) p.x = -14

        let a = p.maxA * (0.3 + 0.7 * Math.sin(p.tw))
        a = Math.max(0, a)

        if (!p.sparking) {
          if (--p.sparkTimer <= 0) {
            p.sparking = true; p.sparkA = 0
            p.sparkTimer = 150 + Math.random() * 320
          }
        } else {
          p.sparkA += p.sparkA < 0.5 ? 0.10 : -0.07
          if (p.sparkA <= 0) { p.sparking = false; p.sparkA = 0 }
          a = Math.max(a, p.sparkA * p.maxA * 1.9)
        }
        a = Math.min(1, a)

        const [r,g,b] = p.col
        if (p.r > 1.3) {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r*2.8, 0, Math.PI*2)
          ctx.fillStyle = `rgba(${r},${g},${b},${(a*0.13).toFixed(3)})`
          ctx.fill()
        }
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2)
        ctx.fillStyle = `rgba(${r},${g},${b},${a.toFixed(3)})`
        ctx.fill()
      })

      raf = requestAnimationFrame(draw)
    }

    // ── DOM updates driven by scroll progress ─────────────────────────────────
    function updateDOM(p) {
      scrollP = p

      // Hero fade out
      const heroEl = heroRef.current
      if (heroEl) {
        const op = Math.max(0, 1 - map(p, 0.18, 0.25, 0, 1))
        heroEl.style.opacity       = op
        heroEl.style.pointerEvents = op > 0.05 ? 'auto' : 'none'
      }

      // Deck fan (0 → 18% scroll progress)
      const fanP = map(p, 0, 0.18, 0, 1)
      cardRefs.current.forEach((el, i) => {
        if (!el || !DECK_STACK[i] || !DECK_FAN[i]) return
        const s = DECK_STACK[i], f = DECK_FAN[i]
        el.style.transform = `translate(${lerp(s.x, f.x, fanP)}px, ${lerp(s.y, f.y, fanP)}px) rotate(${lerp(s.rotate, f.rotate, fanP)}deg)`
      })

      // Features fade in/out
      const featEl = featRef.current
      if (featEl) {
        const op = Math.max(0, map(p, 0.24, 0.30, 0, 1) * (1 - map(p, 0.54, 0.60, 0, 1)))
        featEl.style.opacity       = op
        featEl.style.pointerEvents = op > 0.05 ? 'auto' : 'none'
      }

      // Features ribbon — slides LEFT across features section
      const featRibbon = featRibbonRef.current
      if (featRibbon) {
        const rp = map(p, 0.28, 0.60, 0, 1)
        featRibbon.style.transform = `translateX(${-(rp * RIBBON_UNIT)}px)`
      }

      // Creator fade in
      const creatEl = creatRef.current
      if (creatEl) {
        const op = Math.max(0, map(p, 0.62, 0.68, 0, 1))
        creatEl.style.opacity       = op
        creatEl.style.pointerEvents = op > 0.05 ? 'auto' : 'none'
      }

      // Creator ribbon — slides RIGHT (opposite direction)
      const creatRibbon = creatRibbonRef.current
      if (creatRibbon) {
        const rp = map(p, 0.66, 0.98, 0, 1)
        creatRibbon.style.transform = `translateX(${-((1 - rp) * RIBBON_UNIT)}px)`
      }
    }

    // ── GSAP ScrollTrigger (CDN) ──────────────────────────────────────────────
    let stCleanup = null
    ;(async () => {
      try {
        const [gsapMod, stMod] = await Promise.all([
          import('https://esm.sh/gsap@3.12.5'),
          import('https://esm.sh/gsap@3.12.5/ScrollTrigger'),
        ])
        const gsap          = gsapMod.gsap || gsapMod.default
        const ScrollTrigger = stMod.ScrollTrigger || stMod.default
        gsap.registerPlugin(ScrollTrigger)
        const wrapper = wrapperRef.current
        if (!wrapper) return
        const st = ScrollTrigger.create({
          trigger: wrapper, start: 'top top', end: 'bottom bottom',
          scrub: 1.2,
          onUpdate: self => updateDOM(self.progress),
        })
        stCleanup = () => { st.kill(); ScrollTrigger.getAll().forEach(t => t.kill()) }
      } catch {
        // Native lerp fallback
        let target = 0, current = 0, fallbackRaf
        const onScroll = () => {
          const wrapper = wrapperRef.current
          if (!wrapper) return
          const end = wrapper.offsetTop + wrapper.offsetHeight - window.innerHeight
          target = end > 0 ? Math.min(window.scrollY / end, 1) : 0
        }
        const tick = () => {
          current += (target - current) * 0.08
          updateDOM(current)
          fallbackRaf = requestAnimationFrame(tick)
        }
        window.addEventListener('scroll', onScroll, { passive: true })
        tick()
        stCleanup = () => {
          window.removeEventListener('scroll', onScroll)
          cancelAnimationFrame(fallbackRaf)
        }
      }
    })()

    resize()
    window.addEventListener('resize', resize)
    raf = requestAnimationFrame(draw)
    updateDOM(0)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      if (stCleanup) stCleanup()
    }
  }, [])

  // ── JSX ───────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        html, body { background: #0b0909 !important; }

        @keyframes fadeUp    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulseGlow { 0%,100%{box-shadow:0 0 0 0 rgba(212,160,192,0.35)} 50%{box-shadow:0 0 0 10px rgba(212,160,192,0)} }

        /* ── Deck cards ── */
        .lq-card {
          position: absolute;
          width: 108px; height: 132px;
          border-radius: 14px; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.10);
          box-shadow: 0 12px 40px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.4);
          will-change: transform;
          margin-left: -54px;
          margin-top: -66px;
        }
        .lq-card img {
          width: 100%; height: 100%; object-fit: cover; display: block;
          opacity: 0; transition: opacity 0.5s ease;
        }
        .lq-card img.loaded { opacity: 1; }

        /* ── Ribbon ── */
        .lq-ribbon-wrap {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          overflow: hidden;
          pointer-events: none;
          display: flex;
          align-items: center;
        }
        .lq-ribbon-track {
          display: flex;
          gap: 10px;
          padding: 0 10px;
          will-change: transform;
          flex-shrink: 0;
        }
        .lq-ribbon-img {
          flex-shrink: 0;
          width: 110px; height: 136px;
          border-radius: 12px; overflow: hidden;
          border: 1px solid rgba(255,255,255,0.08);
        }
        .lq-ribbon-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .lq-fade-l {
          position: absolute; top: 0; left: 0; height: 100%; width: 80px;
          background: linear-gradient(to right, rgba(11,9,9,0.96), transparent);
          pointer-events: none; z-index: 2;
        }
        .lq-fade-r {
          position: absolute; top: 0; right: 0; height: 100%; width: 80px;
          background: linear-gradient(to left, rgba(11,9,9,0.96), transparent);
          pointer-events: none; z-index: 2;
        }

        /* ── CTAs ── */
        .lq-cta-primary {
          background: var(--accent); color: #2C0A1E;
          padding: 14px 28px; border-radius: 14px;
          font-weight: 600; font-size: 15px; text-decoration: none;
          display: inline-flex; align-items: center; gap: 8px;
          font-family: 'DM Sans', sans-serif;
          animation: pulseGlow 2.8s ease-in-out 1.2s infinite;
          transition: transform 0.18s ease, opacity 0.18s ease;
        }
        .lq-cta-primary:hover { transform: scale(1.03); opacity: 0.92; }

        .lq-cta-secondary {
          background: transparent; color: var(--text-secondary);
          padding: 14px 22px; border-radius: 14px;
          font-weight: 500; font-size: 15px; text-decoration: none;
          display: inline-flex; align-items: center;
          border: 0.5px solid var(--border);
          font-family: 'DM Sans', sans-serif;
          transition: border-color 0.18s ease, color 0.18s ease;
        }
        .lq-cta-secondary:hover { border-color: var(--text-secondary); color: var(--text-primary); }

        .lq-cta-creator {
          background: transparent; color: var(--accent);
          padding: 14px 24px; border-radius: 14px;
          font-weight: 600; font-size: 15px; text-decoration: none;
          display: inline-flex; align-items: center; gap: 8px;
          font-family: 'DM Sans', sans-serif;
          border: 1px solid rgba(212,160,192,0.5);
          transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
        }
        .lq-cta-creator:hover { background: rgba(212,160,192,0.08); border-color: var(--accent); transform: translateY(-1px); }
      `}</style>

      {/* ── Canvas: cosmic bg + particle drift + colour wash ── */}
      <canvas ref={canvasRef} style={{
        position: 'fixed', top: 0, left: 0,
        width: '100vw', height: '100vh',
        zIndex: 0, pointerEvents: 'none', display: 'block',
      }} />

      {/* ── Scrollable container ── */}
      <div ref={wrapperRef} style={{ position: 'relative', height: '420vh', zIndex: 3 }}>

        {/* ════ HERO ════ */}
        <div style={{ height: '140vh' }}>
          <section ref={heroRef} style={{
            height: '100svh', minHeight: '600px',
            position: 'sticky', top: 0, zIndex: 2,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center',
            paddingTop: '13vh',
            overflow: 'hidden',
          }}>

            {/* Wordmark block */}
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', textAlign: 'center',
              padding: '0 32px', position: 'relative', zIndex: 2,
            }}>
              {/* Beta pill */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                background: 'rgba(212,160,192,0.1)', border: '0.5px solid rgba(212,160,192,0.25)',
                borderRadius: '20px', padding: '4px 12px 4px 8px',
                marginBottom: '16px', animation: 'fadeUp 0.5s ease 0.1s both',
              }}>
                <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--accent)', display:'inline-block' }} />
                <span style={{ color:'var(--accent)', fontSize:'11px', fontWeight:'500', letterSpacing:'0.07em', textTransform:'uppercase' }}>Beta</span>
              </div>

              <h1 style={{
                fontSize: 'clamp(68px, 20vw, 92px)', fontWeight: '500',
                color: 'var(--text-primary)', letterSpacing: '-0.045em',
                lineHeight: '0.9', marginBottom: '14px',
                animation: 'fadeUp 0.6s ease 0.2s both',
              }}>Laque</h1>

              <p style={{
                fontSize: '15px', color: 'var(--text-secondary)',
                lineHeight: '1.55', marginBottom: '24px', maxWidth: '240px',
                animation: 'fadeUp 0.6s ease 0.35s both',
              }}>
                Your next nail set,{' '}
                <span style={{ color:'var(--text-primary)', fontWeight:'500' }}>designed, tried on, and booked.</span>
              </p>

              <div style={{
                display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center',
                animation: 'fadeUp 0.6s ease 0.48s both',
              }}>
                <Link href="/feed" className="lq-cta-primary">
                  Explore Designs
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
                <Link href="/profile" className="lq-cta-secondary">Join as Creator</Link>
              </div>
            </div>

            {/* Deck of cards — fanned by scroll */}
            <div style={{
              position: 'relative', width: '100%', height: '200px',
              marginTop: '36px', flexShrink: 0, overflow: 'visible',
            }}>
              <div style={{ position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 }}>
                {designs.slice(0, 6).map((d, i) => (
                  <div
                    key={d.id}
                    ref={el => { cardRefs.current[i] = el }}
                    className="lq-card"
                    style={{
                      transform: `translate(${DECK_STACK[i].x}px, ${DECK_STACK[i].y}px) rotate(${DECK_STACK[i].rotate}deg)`,
                    }}
                  >
                    {d.image_url && (
                      <img
                        src={d.image_url} alt=""
                        onLoad={e => e.currentTarget.classList.add('loaded')}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Scroll hint */}
            <div style={{
              position: 'absolute', bottom: '24px',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
              animation: 'fadeUp 0.6s ease 0.9s both', zIndex: 2,
            }}>
              <span style={{ color:'var(--text-secondary)', fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase' }}>Scroll</span>
              <div style={{ width:'1px', height:'24px', background:'linear-gradient(to bottom, var(--text-secondary), transparent)' }} />
            </div>
          </section>
        </div>

        {/* ════ FEATURES ════ */}
        <div style={{ height: '140vh' }}>
          <section ref={featRef} style={{
            height: '100svh', minHeight: '580px',
            position: 'sticky', top: 0, zIndex: 2,
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center',
            overflow: 'hidden',
            opacity: 0,
          }}>

            {/* Ribbon — slides LEFT */}
            <div className="lq-ribbon-wrap">
              <div ref={featRibbonRef} className="lq-ribbon-track" style={{ opacity: 0.48 }}>
                {[...Array(2)].flatMap((_, rep) =>
                  designs.slice(6, 14).map((d, i) =>
                    d?.image_url ? (
                      <div key={`f-${rep}-${i}`} className="lq-ribbon-img">
                        <img src={d.image_url} alt="" />
                      </div>
                    ) : null
                  )
                )}
              </div>
              <div className="lq-fade-l" />
              <div className="lq-fade-r" />
            </div>

            {/* Readability overlay */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(11,9,9,0.50), rgba(11,9,9,0.68), rgba(11,9,9,0.50))',
              pointerEvents: 'none', zIndex: 1,
            }} />

            {/* Text */}
            <div style={{ position: 'relative', zIndex: 2, padding: '0 28px' }}>
              <p style={{
                color: 'var(--accent)', fontSize: '11px', fontWeight: '500',
                letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '14px',
              }}>Why Laque</p>

              <h2 style={{
                fontSize: 'clamp(24px, 7vw, 32px)', fontWeight: '600',
                color: 'var(--text-primary)', letterSpacing: '-0.03em',
                lineHeight: '1.2', marginBottom: '28px',
              }}>
                Find the look.<br />
                <span style={{ color:'var(--accent)' }}>Know every detail.</span>
              </h2>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {[
                  { title: 'Full colour specs',  desc: 'Hex codes, gel brand, shade names, finish type. No more vague inspo.' },
                  { title: 'Search & filter',    desc: 'By shape, length, technique, or occasion. Everyday to editorial.' },
                  { title: 'Save & share',        desc: 'Bookmark looks and send a direct link straight to your nail tech.' },
                ].map(f => (
                  <div key={f.title} style={{ borderLeft: '2px solid rgba(212,160,192,0.45)', paddingLeft: '14px' }}>
                    <p style={{ color:'var(--text-primary)', fontWeight:'600', fontSize:'15px', marginBottom:'4px' }}>{f.title}</p>
                    <p style={{ color:'var(--text-secondary)', fontSize:'13px', lineHeight:'1.6' }}>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ════ CREATOR ════ */}
        <div style={{ height: '140vh' }}>
          <section ref={creatRef} style={{
            height: '100svh', minHeight: '580px',
            position: 'sticky', top: 0, zIndex: 2,
            display: 'flex', flexDirection: 'column',
            justifyContent: 'center',
            overflow: 'hidden',
            opacity: 0,
          }}>

            {/* Ribbon — slides RIGHT */}
            <div className="lq-ribbon-wrap">
              <div ref={creatRibbonRef} className="lq-ribbon-track" style={{ opacity: 0.48 }}>
                {[...Array(2)].flatMap((_, rep) =>
                  designs.slice(14, 22).map((d, i) =>
                    d?.image_url ? (
                      <div key={`c-${rep}-${i}`} className="lq-ribbon-img">
                        <img src={d.image_url} alt="" />
                      </div>
                    ) : null
                  )
                )}
              </div>
              <div className="lq-fade-l" />
              <div className="lq-fade-r" />
            </div>

            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to bottom, rgba(11,9,9,0.50), rgba(11,9,9,0.68), rgba(11,9,9,0.50))',
              pointerEvents: 'none', zIndex: 1,
            }} />

            <div style={{ position: 'relative', zIndex: 2, padding: '0 28px' }}>
              {/* Pill */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '7px',
                background: 'rgba(212,160,192,0.1)', border: '0.5px solid rgba(212,160,192,0.3)',
                borderRadius: '20px', padding: '5px 12px 5px 8px',
                width: 'fit-content', marginBottom: '18px',
              }}>
                <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'var(--accent)', display:'inline-block', flexShrink:0 }} />
                <span style={{ color:'var(--accent)', fontSize:'11px', fontWeight:'500', letterSpacing:'0.07em', textTransform:'uppercase' }}>For nail artists & salons</span>
              </div>

              <h2 style={{
                fontSize: 'clamp(24px, 7vw, 34px)', fontWeight: '600',
                color: 'var(--text-primary)', letterSpacing: '-0.03em',
                lineHeight: '1.15', marginBottom: '14px',
              }}>
                Turn your nail work{' '}
                <span style={{ color:'var(--accent)' }}>into bookings.</span>
              </h2>

              <p style={{
                fontSize: '14px', color: 'var(--text-secondary)',
                lineHeight: '1.65', marginBottom: '24px', maxWidth: '300px',
              }}>
                Post your sets with full specs. Reach clients already browsing for their next look.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
                {[
                  'Post designs with full specs — colour codes, techniques, price',
                  'Receive appointment requests from clients browsing your work',
                  'Manage your portfolio, calendar, and client notes',
                ].map(text => (
                  <div key={text} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ width:'4px', height:'4px', borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />
                    <span style={{ color:'var(--text-primary)', fontSize:'13px', lineHeight:'1.45' }}>{text}</span>
                  </div>
                ))}
              </div>

              {/* Pricing hint */}
              <p style={{ color:'var(--text-secondary)', fontSize:'12px', marginBottom:'20px', opacity:0.7 }}>
                5 uploads/week free · <span style={{ color:'var(--accent)' }}>Pro from $15/mo</span>
              </p>

              <Link href="/profile" className="lq-cta-creator">
                Join as a creator
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          </section>
        </div>

      </div>{/* end 420vh wrapper */}

      {/* ════ PRICING SECTION ════ */}
      <section style={{
        padding: '52px 24px 56px',
        background: 'var(--bg-primary)',
        position: 'relative', zIndex: 3,
        borderTop: '0.5px solid var(--border)',
      }}>
        <p style={{
          color: 'var(--accent)', fontSize: '11px', fontWeight: '500',
          letterSpacing: '0.09em', textTransform: 'uppercase',
          marginBottom: '10px', textAlign: 'center',
        }}>Pricing</p>
        <h2 style={{
          fontSize: 'clamp(22px, 6vw, 28px)', fontWeight: '600',
          color: 'var(--text-primary)', letterSpacing: '-0.03em',
          textAlign: 'center', marginBottom: '8px',
        }}>Pick your plan</h2>
        <p style={{
          color: 'var(--text-secondary)', fontSize: '13px',
          textAlign: 'center', marginBottom: '28px', lineHeight: '1.5',
        }}>Free for everyone. Pro for creators who want more.</p>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>

          {/* ── Free card ── */}
          <div style={{
            flex: 1,
            background: 'var(--bg-card)',
            border: '0.5px solid var(--border)',
            borderRadius: '16px', padding: '20px 16px',
          }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Free</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', marginBottom: '16px' }}>
              <span style={{ color: 'var(--text-primary)', fontSize: '30px', fontWeight: '600', letterSpacing: '-0.04em', lineHeight: 1 }}>$0</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '3px' }}>/ forever</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {[
                'Browse all designs',
                'Unlimited saves',
                'Named collections',
                'Search & filter',
                'Share designs',
                '5 uploads / week',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                  <span style={{ color: 'var(--accent)', fontSize: '12px', marginTop: '1px', flexShrink: 0 }}>✓</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.4' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

          {/* ── Pro Creator card ── */}
          <div style={{
            flex: 1,
            background: 'linear-gradient(145deg, rgba(212,160,192,0.10) 0%, rgba(212,160,192,0.03) 100%)',
            border: '1px solid rgba(212,160,192,0.35)',
            borderRadius: '16px', padding: '20px 16px',
            position: 'relative',
          }}>
            {/* Coming soon badge */}
            <div style={{
              position: 'absolute', top: '-11px', left: '50%', transform: 'translateX(-50%)',
              background: 'var(--accent)', color: '#2C0A1E',
              fontSize: '9px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase',
              padding: '3px 10px', borderRadius: '20px', whiteSpace: 'nowrap',
            }}>Coming soon</div>

            <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Pro Creator</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '3px', marginBottom: '16px' }}>
              <span style={{ color: 'var(--text-primary)', fontSize: '30px', fontWeight: '600', letterSpacing: '-0.04em', lineHeight: 1 }}>$15</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '3px' }}>/ month</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {[
                'Everything in Free',
                'Unlimited uploads',
                'Featured in discovery',
                'Analytics per design',
                '"Show My Nail Tech" card',
                'Early feature access',
              ].map(f => (
                <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                  <span style={{ color: 'var(--accent)', fontSize: '12px', marginTop: '1px', flexShrink: 0 }}>✓</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.4' }}>{f}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </section>

      {/* ════ NAIL LAB TEASER ════ */}
      <section style={{
        padding: '52px 24px 56px',
        background: 'var(--bg-primary)',
        position: 'relative', zIndex: 3,
        borderTop: '0.5px solid var(--border)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
          <span style={{ fontSize:'20px', lineHeight:1 }}>✨</span>
          <p style={{ color:'var(--accent)', fontSize:'11px', fontWeight:'500', letterSpacing:'0.09em', textTransform:'uppercase' }}>Nail Lab</p>
        </div>
        <h2 style={{ fontSize:'clamp(22px, 6vw, 28px)', fontWeight:'600', color:'var(--text-primary)', letterSpacing:'-0.03em', lineHeight:'1.2', marginBottom:'12px' }}>
          Create your own nail design with Nail Lab
        </h2>
        <p style={{ color:'var(--text-secondary)', fontSize:'14px', lineHeight:'1.7', marginBottom:'20px', maxWidth:'320px' }}>
          Use credits to generate custom nail designs by colour, mood, occasion, shape, length, and style. Save, share, or book your generated look.
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'24px' }}>
          {[
            'Describe your vision — AI generates it instantly',
            'Try the result in Nail Mirror before booking',
            'Send the spec directly to your nail tech',
          ].map(t => (
            <div key={t} style={{ display:'flex', alignItems:'flex-start', gap:'10px' }}>
              <span style={{ color:'var(--accent)', fontSize:'12px', marginTop:'2px', flexShrink:0 }}>✓</span>
              <span style={{ color:'var(--text-primary)', fontSize:'13px', lineHeight:'1.5' }}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--bg-chip)', border:'0.5px solid var(--border)', borderRadius:'20px', padding:'8px 16px' }}>
          <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />
          <span style={{ color:'var(--text-secondary)', fontSize:'12px', fontWeight:'500' }}>Coming soon — join the waitlist at signup</span>
        </div>
      </section>

      {/* ════ NAIL MIRROR TEASER ════ */}
      <section style={{
        padding: '52px 24px 56px',
        background: 'var(--bg-card)',
        position: 'relative', zIndex: 3,
        borderTop: '0.5px solid var(--border)',
      }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
          <span style={{ fontSize:'20px', lineHeight:1 }}>🪞</span>
          <p style={{ color:'var(--accent)', fontSize:'11px', fontWeight:'500', letterSpacing:'0.09em', textTransform:'uppercase' }}>Nail Mirror</p>
        </div>
        <h2 style={{ fontSize:'clamp(22px, 6vw, 28px)', fontWeight:'600', color:'var(--text-primary)', letterSpacing:'-0.03em', lineHeight:'1.2', marginBottom:'12px' }}>
          Try designs on your hand with Nail Mirror
        </h2>
        <p style={{ color:'var(--text-secondary)', fontSize:'14px', lineHeight:'1.7', marginBottom:'20px', maxWidth:'320px' }}>
          Preview how any design looks on your actual hand before you save it or book your appointment. No guessing.
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'24px' }}>
          {[
            'Point your camera at your hand — see the design in real time',
            'Try multiple looks before committing to one',
            'Works with any design in the Laque library',
          ].map(t => (
            <div key={t} style={{ display:'flex', alignItems:'flex-start', gap:'10px' }}>
              <span style={{ color:'var(--accent)', fontSize:'12px', marginTop:'2px', flexShrink:0 }}>✓</span>
              <span style={{ color:'var(--text-primary)', fontSize:'13px', lineHeight:'1.5' }}>{t}</span>
            </div>
          ))}
        </div>
        <div style={{ display:'inline-flex', alignItems:'center', gap:'8px', background:'var(--bg-chip)', border:'0.5px solid var(--border)', borderRadius:'20px', padding:'8px 16px' }}>
          <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />
          <span style={{ color:'var(--text-secondary)', fontSize:'12px', fontWeight:'500' }}>Coming soon — AR try-on for every design</span>
        </div>
      </section>

      {/* ════ SALON SECTION ════ */}
      <section style={{
        padding: '52px 24px 56px',
        background: 'var(--bg-primary)',
        position: 'relative', zIndex: 3,
        borderTop: '0.5px solid var(--border)',
      }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:'7px', background:'rgba(212,160,192,0.1)', border:'0.5px solid rgba(212,160,192,0.3)', borderRadius:'20px', padding:'5px 12px 5px 8px', marginBottom:'16px' }}>
          <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'var(--accent)', display:'inline-block', flexShrink:0 }} />
          <span style={{ color:'var(--accent)', fontSize:'11px', fontWeight:'500', letterSpacing:'0.07em', textTransform:'uppercase' }}>For salon owners</span>
        </div>
        <h2 style={{ fontSize:'clamp(22px, 6vw, 28px)', fontWeight:'600', color:'var(--text-primary)', letterSpacing:'-0.03em', lineHeight:'1.2', marginBottom:'12px' }}>
          Manage your salon and nail techs in one place
        </h2>
        <p style={{ color:'var(--text-secondary)', fontSize:'14px', lineHeight:'1.7', marginBottom:'20px', maxWidth:'320px' }}>
          Create nail tech profiles, manage team availability, receive appointments, and showcase your salon portfolio — all from one dashboard.
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:'10px', marginBottom:'24px' }}>
          {[
            'One salon page — multiple nail tech profiles under it',
            'Team calendar: set availability per tech, block dates, manage slots',
            'Clients discover and book your team directly through Laque',
          ].map(t => (
            <div key={t} style={{ display:'flex', alignItems:'flex-start', gap:'10px' }}>
              <span style={{ color:'var(--accent)', fontSize:'12px', marginTop:'2px', flexShrink:0 }}>✓</span>
              <span style={{ color:'var(--text-primary)', fontSize:'13px', lineHeight:'1.5' }}>{t}</span>
            </div>
          ))}
        </div>
        <Link href="/profile" className="lq-cta-creator">
          Create salon page
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </section>

      {/* ════ FINAL CTA ════ */}
      <section style={{
        padding: '40px 24px 56px', textAlign: 'center',
        borderTop: '0.5px solid var(--border)',
        background: 'var(--bg-card)',
        position: 'relative', zIndex: 3,
      }}>
        <p style={{ color:'var(--text-primary)', fontSize:'22px', fontWeight:'500', letterSpacing:'-0.02em', lineHeight:'1.3', marginBottom:'10px' }}>
          Find your next nail look today
        </p>
        <p style={{ color:'var(--text-secondary)', fontSize:'14px', marginBottom:'28px', lineHeight:'1.6' }}>
          Browse free. Save what you love. Show your nail tech.
        </p>
        <Link href="/feed" className="lq-cta-primary" style={{ display:'inline-flex' }}>
          Explore Designs
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </section>
    </>
  )
}
