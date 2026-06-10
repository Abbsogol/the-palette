'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// ─── ASSET CONFIG ─────────────────────────────────────────────────────────────
// When transparent WebP assets are ready:
//   1. Replace paths below with the new WebP filenames
//   2. Set REMOVE_BG = false
//   3. Remove mixBlendMode from ropesEl / dropEl inline styles (marked below)
const DROPLET_SRC = '/drop.png'     // → '/droplet.webp' (transparent bg)
const ROPES_SRC   = '/ribbons.png'  // → '/ropes.webp'   (transparent bg)
const REMOVE_BG   = true            // JS bg-removal; disable when using transparent WebPs
// ─────────────────────────────────────────────────────────────────────────────

const IMPACT_Y = 0.52  // impact point: 52% from viewport top

export default function LandingPage() {
  const wrapperRef = useRef(null)   // 600vh scroll trigger
  const starRef    = useRef(null)   // starfield canvas (fixed, z:0)
  const splashRef  = useRef(null)   // splash canvas  (fixed, full-screen, z:1)
  const dropRef    = useRef(null)   // droplet image  (fixed, z:1)
  const ropesRef   = useRef(null)   // ropes/ribbons  (fixed, z:1, grows from impact)
  const heroRef    = useRef(null)
  const featRef    = useRef(null)
  const creatRef   = useRef(null)
  const [designs, setDesigns] = useState([])

  /* ── load designs ── */
  useEffect(() => {
    supabase.from('designs').select('id, image_url')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(16)
      .then(({ data }) => setDesigns(data || []))
  }, [])

  /* ── animation engine ── */
  useEffect(() => {
    const starCvs   = starRef.current
    const splashCvs = splashRef.current
    const dropEl    = dropRef.current
    const ropesEl   = ropesRef.current
    const heroEl    = heroRef.current
    const featEl    = featRef.current
    const creatEl   = creatRef.current
    if (!starCvs || !splashCvs) return

    const starCtx   = starCvs.getContext('2d')
    const splashCtx = splashCvs.getContext('2d')
    const cl  = (v, a, b) => Math.max(a, Math.min(b, v))
    const map = (v, a, b, c, d) => c + (d - c) * cl((v - a) / (b - a), 0, 1)

    let pts = [], starRaf, blobUrls = []

    // ── Resize: size both canvases + rebuild star particles ───────────────
    function resize() {
      const w = window.innerWidth, h = window.innerHeight
      starCvs.width    = w;  starCvs.height    = h
      splashCvs.width  = w;  splashCvs.height  = h
      pts = Array.from({ length: 130 }, () => ({
        x: Math.random() * w,   y: Math.random() * h,
        r: Math.random() * 1.5 + 0.3,
        a: Math.random() * 0.52 + 0.10,
        t: Math.random() * Math.PI * 2,
        s: Math.random() * 0.003 + 0.001,
        pink: Math.random() > 0.82,
      }))
    }

    // ── Starfield (rAF loop) ───────────────────────────────────────────────
    function drawStars() {
      const w = starCvs.width, h = starCvs.height
      starCtx.fillStyle = '#0b0909'
      starCtx.fillRect(0, 0, w, h)
      const bg = starCtx.createLinearGradient(0, 0, 0, h)
      bg.addColorStop(0, 'rgba(38,8,28,0.55)')
      bg.addColorStop(1, 'rgba(8,4,14,0.50)')
      starCtx.fillStyle = bg
      starCtx.fillRect(0, 0, w, h)
      ;[[w * .55, h * .18, w * .32, '90,32,70', 0.08],
        [w * 1.42, h * .74, w * .26, '65,20,96', 0.06]]
        .forEach(([ox, oy, or_, col, oa]) => {
          const g = starCtx.createRadialGradient(ox, oy, 0, ox, oy, or_)
          g.addColorStop(0, `rgba(${col},${oa})`)
          g.addColorStop(1, `rgba(${col},0)`)
          starCtx.fillStyle = g
          starCtx.beginPath(); starCtx.arc(ox, oy, or_, 0, Math.PI * 2); starCtx.fill()
        })
      pts.forEach(p => {
        p.t += p.s
        const a = p.a * (0.52 + 0.48 * Math.sin(p.t))
        starCtx.fillStyle = p.pink ? `rgba(212,160,192,${a})` : `rgba(255,255,255,${a})`
        starCtx.beginPath(); starCtx.arc(p.x, p.y, p.r, 0, Math.PI * 2); starCtx.fill()
      })
      starRaf = requestAnimationFrame(drawStars)
    }

    // ── JS Background removal (temporary until transparent WebPs) ─────────
    // Samples the top-left corner as background reference, removes similar pixels.
    // threshLow=clear pixels; threshHigh=feathered edge. Safe for dark-bg images.
    async function stripBg(originalSrc) {
      const tmp = new Image()
      await new Promise(res => { tmp.onload = res; tmp.src = originalSrc })
      const c = document.createElement('canvas')
      c.width  = tmp.naturalWidth  || tmp.width  || 500
      c.height = tmp.naturalHeight || tmp.height || 600
      const cx = c.getContext('2d')
      cx.drawImage(tmp, 0, 0)
      const id = cx.getImageData(0, 0, c.width, c.height)
      const d  = id.data
      const [bgR, bgG, bgB] = [d[0], d[1], d[2]]
      for (let i = 0; i < d.length; i += 4) {
        const dist = Math.hypot(d[i] - bgR, d[i + 1] - bgG, d[i + 2] - bgB)
        if (dist < 28) {
          d[i + 3] = 0
        } else if (dist < 62) {
          d[i + 3] = Math.round(d[i + 3] * (dist - 28) / 34)
        }
      }
      cx.putImageData(id, 0, 0)
      const blob = await new Promise(r => c.toBlob(r))
      const url  = URL.createObjectURL(blob)
      blobUrls.push(url)
      return url
    }

    if (REMOVE_BG && dropEl) {
      stripBg(DROPLET_SRC).then(url => { dropEl.src = url })
    }

    // ── Splash: canvas-drawn burst, fully scroll-driven (p = 0→1) ─────────
    // Centered exactly at the impact point (50% x, IMPACT_Y y).
    function drawSplash(p) {
      const w = splashCvs.width, h = splashCvs.height
      splashCtx.clearRect(0, 0, w, h)
      if (p <= 0 || p >= 1) return

      const cx    = w * 0.5
      const cy    = h * IMPACT_Y
      const maxR  = Math.min(w, h) * 0.30
      // Opacity: ramps up 0→0.3 then fades 0.3→1
      const op    = p < 0.3 ? p / 0.3 : Math.max(0, (1 - p) / 0.7)

      // Expanding fill ring from impact center
      const r = maxR * p
      const rg = splashCtx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r)
      rg.addColorStop(0, `rgba(212,160,192,${op * 0.50})`)
      rg.addColorStop(1, `rgba(212,160,192,0)`)
      splashCtx.beginPath(); splashCtx.arc(cx, cy, r, 0, Math.PI * 2)
      splashCtx.fillStyle = rg; splashCtx.fill()

      // Inner bright flash at centre
      const fr = maxR * 0.20 * (1 - p)
      if (fr > 1) {
        const fg = splashCtx.createRadialGradient(cx, cy, 0, cx, cy, fr)
        fg.addColorStop(0,   `rgba(255,240,252,${op * 0.95})`)
        fg.addColorStop(0.5, `rgba(212,160,192,${op * 0.55})`)
        fg.addColorStop(1,   `rgba(212,160,192,0)`)
        splashCtx.beginPath(); splashCtx.arc(cx, cy, fr, 0, Math.PI * 2)
        splashCtx.fillStyle = fg; splashCtx.fill()
      }

      // 8 droplet particles bursting outward from centre
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2 - Math.PI * 0.5
        const dist  = maxR * 0.68 * p
        const pr    = Math.max(0, 5.5 * (1 - p * 1.35))
        if (pr < 0.5) continue
        splashCtx.beginPath()
        splashCtx.arc(cx + Math.cos(angle) * dist, cy + Math.sin(angle) * dist, pr, 0, Math.PI * 2)
        splashCtx.fillStyle = `rgba(255,222,245,${op * 0.82})`
        splashCtx.fill()
      }

      // Secondary trailing ring
      if (p > 0.18) {
        const r2 = maxR * (p - 0.18) * 0.72
        splashCtx.beginPath(); splashCtx.arc(cx, cy, r2, 0, Math.PI * 2)
        splashCtx.strokeStyle = `rgba(212,160,192,${op * 0.24})`
        splashCtx.lineWidth   = 2
        splashCtx.stroke()
      }
    }

    // ── Main scroll-progress update ────────────────────────────────────────
    // Called by GSAP scrub onUpdate (or native fallback).
    // p = 0 at top of page, 1 when wrapper bottom clears viewport.
    function updateAll(p) {
      const h    = window.innerHeight
      const impY = h * IMPACT_Y
      const dropH = dropEl ? (dropEl.offsetHeight || 240) : 240

      // — DROPLET —
      // transformOrigin: '50% 100%' (bottom-centre) → stretches UPWARD,
      // bottom stays pinned at impY regardless of scaleY.
      if (dropEl) {
        // dropY: bottom of element (= dropY + dropH) tracks impY
        const dropY = map(p, 0, 0.50, -h * 0.60, impY - dropH)
        const sY    = map(p, 0.30, 0.50, 1.0, 1.88)
        const sX    = map(p, 0.30, 0.50, 1.0, 0.74)
        // Opacity: fade in 0–12%, fade out at impact 50–58%
        const op    = p < 0.50
          ? map(p, 0, 0.12, 0, 1)
          : map(p, 0.50, 0.58, 1, 0)
        dropEl.style.opacity   = Math.max(0, op)
        dropEl.style.transform = `translateX(-50%) translateY(${dropY}px) scaleX(${sX}) scaleY(${sY})`
      }

      // — SPLASH CANVAS —
      // Active scroll 50%–65%; progress 0→1 within that window
      drawSplash(map(p, 0.50, 0.65, 0, 1))

      // — ROPES —
      // Grows FROM the impact point (transform-origin = centre at 52vh).
      // Starts at scale 0.14 (tiny dot at impact) → 1.06 (fills screen).
      if (ropesEl) {
        const rScale = map(p, 0.60, 0.82, 0.14, 1.06)
        const rOp    = map(p, 0.60, 0.80, 0,    0.90)
        ropesEl.style.opacity   = Math.max(0, rOp)
        ropesEl.style.transform = `translate(-50%, -50%) scale(${Math.max(0.14, rScale)})`
      }

      // — HERO section —
      if (heroEl) {
        const op = Math.max(0, 1 - map(p, 0.13, 0.18, 0, 1))
        heroEl.style.opacity      = op
        heroEl.style.pointerEvents = op > 0.05 ? 'auto' : 'none'
      }
      // — FEATURES section —
      if (featEl) {
        const fIn  = map(p, 0.33, 0.36, 0, 1)
        const fOut = map(p, 0.47, 0.51, 0, 1)
        const op   = Math.max(0, fIn * (1 - fOut))
        featEl.style.opacity      = op
        featEl.style.pointerEvents = op > 0.05 ? 'auto' : 'none'
      }
      // — CREATOR section —
      if (creatEl) {
        const op = Math.max(0, map(p, 0.66, 0.70, 0, 1))
        creatEl.style.opacity      = op
        creatEl.style.pointerEvents = op > 0.05 ? 'auto' : 'none'
      }
    }

    // ── GSAP ScrollTrigger (loaded via CDN, no package.json change needed) ─
    // Falls back to native scroll + lerp if CDN is unavailable.
    let stCleanup = null

    ;(async () => {
      try {
        const [gsapMod, stMod] = await Promise.all([
          import('https://esm.sh/gsap@3.12.5'),
          import('https://esm.sh/gsap@3.12.5/ScrollTrigger'),
        ])
        const gsap          = gsapMod.gsap  || gsapMod.default
        const ScrollTrigger = stMod.ScrollTrigger || stMod.default
        gsap.registerPlugin(ScrollTrigger)

        const wrapper = wrapperRef.current
        if (!wrapper) return

        const st = ScrollTrigger.create({
          trigger: wrapper,
          start:   'top top',
          end:     'bottom bottom',
          scrub:   1.2,           // 1.2s lag = buttery smooth feel
          onUpdate: self => updateAll(self.progress),
        })

        stCleanup = () => {
          st.kill()
          ScrollTrigger.getAll().forEach(t => t.kill())
        }
      } catch {
        // Native fallback: lerp replicates GSAP scrub smoothness
        let target = 0, current = 0, fallbackRaf
        const onScroll = () => {
          const wrapper = wrapperRef.current
          if (!wrapper) return
          const end = wrapper.offsetTop + wrapper.offsetHeight - window.innerHeight
          target = end > 0 ? Math.min(window.scrollY / end, 1) : 0
        }
        const tick = () => {
          current += (target - current) * 0.08
          updateAll(current)
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
    starRaf = requestAnimationFrame(drawStars)
    updateAll(0)

    return () => {
      cancelAnimationFrame(starRaf)
      window.removeEventListener('resize', resize)
      blobUrls.forEach(u => URL.revokeObjectURL(u))
      if (stCleanup) stCleanup()
    }
  }, [])

  /* ── floating card layout (unchanged) ── */
  const cardConfigs = [
    { top:'-4%',    left:'calc(50% - 232px)', anim:'fc7', dur:'5.2s', delay:'-0.6s',  size:88 },
    { top:'12%',    left:'calc(50% - 252px)', anim:'fc3', dur:'6.1s', delay:'-2.4s',  size:84 },
    { top:'34%',    left:'calc(50% - 258px)', anim:'fc1', dur:'5s',   delay:'0s',     size:92 },
    { top:'56%',    left:'calc(50% - 244px)', anim:'fc5', dur:'4.8s', delay:'-3.5s',  size:86 },
    { bottom:'-2%', left:'calc(50% - 228px)', anim:'fc3', dur:'5.6s', delay:'-1.2s',  size:82 },
    { top:'20%',    left:'calc(50% - 172px)', anim:'fc8', dur:'7s',   delay:'-4s',    size:68 },
    { top:'62%',    left:'calc(50% - 168px)', anim:'fc2', dur:'6.4s', delay:'-2s',    size:66 },
    { top:'-3%',    left:'calc(50% + 128px)', anim:'fc4', dur:'5.4s', delay:'-1.5s',  size:86 },
    { top:'11%',    left:'calc(50% + 148px)', anim:'fc2', dur:'4.6s', delay:'-0.8s',  size:80 },
    { top:'33%',    left:'calc(50% + 154px)', anim:'fc6', dur:'5.8s', delay:'-3.2s',  size:90 },
    { top:'55%',    left:'calc(50% + 140px)', anim:'fc1', dur:'6.2s', delay:'-4.8s',  size:84 },
    { bottom:'-1%', left:'calc(50% + 118px)', anim:'fc5', dur:'5s',   delay:'-2.6s',  size:78 },
    { top:'16%',    left:'calc(50% + 82px)',  anim:'fc7', dur:'7.2s', delay:'-1s',    size:64 },
    { top:'60%',    left:'calc(50% + 90px)',  anim:'fc3', dur:'6.8s', delay:'-3.8s',  size:68 },
    { top:'2%',     left:'calc(50% - 46px)',  anim:'fc8', dur:'5.6s', delay:'-1.7s',  size:82 },
    { bottom:'2%',  left:'calc(50% - 50px)',  anim:'fc4', dur:'6.3s', delay:'-3.1s',  size:84 },
  ]

  return (
    <>
      <style>{`
        html, body { background:#0b0909 !important; }

        @keyframes fc1{0%,100%{transform:rotate(-18deg) translateY(0) translateX(0)}   50%{transform:rotate(-18deg) translateY(-42px) translateX(7px)}}
        @keyframes fc2{0%,100%{transform:rotate(14deg) translateY(0) translateX(0)}    50%{transform:rotate(14deg) translateY(-46px) translateX(-8px)}}
        @keyframes fc3{0%,100%{transform:rotate(-7deg) translateY(0) translateX(0)}    50%{transform:rotate(-7deg) translateY(-36px) translateX(9px)}}
        @keyframes fc4{0%,100%{transform:rotate(19deg) translateY(0) translateX(0)}    50%{transform:rotate(19deg) translateY(-44px) translateX(-7px)}}
        @keyframes fc5{0%,100%{transform:rotate(-13deg) translateY(0) translateX(0)}   50%{transform:rotate(-13deg) translateY(-38px) translateX(8px)}}
        @keyframes fc6{0%,100%{transform:rotate(11deg) translateY(0) translateX(0)}    50%{transform:rotate(11deg) translateY(-40px) translateX(-9px)}}
        @keyframes fc7{0%,100%{transform:rotate(-22deg) translateY(0) translateX(0)}   50%{transform:rotate(-22deg) translateY(-34px) translateX(6px)}}
        @keyframes fc8{0%,100%{transform:rotate(8deg) translateY(0) translateX(0)}     50%{transform:rotate(8deg) translateY(-48px) translateX(-5px)}}

        @keyframes fadeUp   {from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes floatBlob{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-14px) scale(1.04)}}
        @keyframes pulseGlow{0%,100%{box-shadow:0 0 0 0 rgba(212,160,192,0.35)}50%{box-shadow:0 0 0 10px rgba(212,160,192,0)}}

        .lq-float-card{
          position:absolute;border-radius:12px;overflow:hidden;
          background:linear-gradient(135deg,#1e1e1e 0%,#252525 100%);
          border:1px solid rgba(255,255,255,0.07);
          box-shadow:0 8px 32px rgba(0,0,0,0.6);
        }
        .lq-float-card img{opacity:0;transition:opacity 0.5s ease;}
        .lq-float-card img.img-loaded{opacity:1;}

        .lq-cta-primary{
          background:var(--accent);color:#2C0A1E;
          padding:14px 28px;border-radius:14px;
          font-weight:600;font-size:15px;text-decoration:none;
          display:inline-flex;align-items:center;gap:8px;
          font-family:'DM Sans',sans-serif;
          animation:pulseGlow 2.8s ease-in-out 1.2s infinite;
          transition:transform 0.18s ease,opacity 0.18s ease;
        }
        .lq-cta-primary:hover{transform:scale(1.03);opacity:0.92;}

        .lq-cta-secondary{
          background:transparent;color:var(--text-secondary);
          padding:14px 22px;border-radius:14px;
          font-weight:500;font-size:15px;text-decoration:none;
          display:inline-flex;align-items:center;
          border:0.5px solid var(--border);
          font-family:'DM Sans',sans-serif;
          transition:border-color 0.18s ease,color 0.18s ease;
        }
        .lq-cta-secondary:hover{border-color:var(--text-secondary);color:var(--text-primary);}

        .lq-cta-creator{
          background:transparent;color:var(--accent);
          padding:14px 24px;border-radius:14px;
          font-weight:600;font-size:15px;text-decoration:none;
          display:inline-flex;align-items:center;gap:8px;
          font-family:'DM Sans',sans-serif;
          border:1px solid rgba(212,160,192,0.5);
          transition:background 0.18s ease,border-color 0.18s ease,transform 0.18s ease;
        }
        .lq-cta-creator:hover{background:rgba(212,160,192,0.08);border-color:var(--accent);transform:translateY(-1px);}

        .lq-feature{
          background:var(--bg-card);
          border:0.5px solid var(--border);
          border-radius:16px;padding:20px;
          display:flex;gap:16px;align-items:flex-start;
          transition:border-color 0.2s ease,transform 0.2s ease;
          backdrop-filter:blur(8px);
        }
        .lq-feature:hover{border-color:var(--accent);transform:translateY(-2px);}

        .lq-creator-row{
          display:flex;align-items:center;gap:12px;
          background:rgba(212,160,192,0.05);
          border:0.5px solid rgba(212,160,192,0.18);
          border-radius:12px;padding:13px 14px;
          transition:background 0.18s ease,border-color 0.18s ease;
        }
        .lq-creator-row:hover{background:rgba(212,160,192,0.09);border-color:rgba(212,160,192,0.35);}
      `}</style>

      {/* ══ LAYER 0: Starfield canvas (cosmic bg) ══════════════════════════ */}
      <canvas
        ref={starRef}
        style={{
          position:'fixed', top:0, left:0,
          width:'100vw', height:'100vh',
          zIndex:0, pointerEvents:'none', display:'block',
        }}
      />

      {/* ══ LAYER 1a: Droplet ══════════════════════════════════════════════
          - top:0 + translateY drives Y position frame-by-frame
          - transformOrigin:'50% 100%' (bottom-centre) → stretches UPWARD,
            bottom stays pinned at impact point
          - REMOVE when using transparent WebP: mixBlendMode + filter        */}
      <img
        ref={dropRef}
        src={DROPLET_SRC}
        alt=""
        style={{
          position:'fixed', top:0, left:'50%',
          width:'min(220px, 55vw)', height:'auto',
          opacity:0,
          // ↓ remove these two lines when transparent WebP is ready
          mixBlendMode:'screen',
          filter:'brightness(1.10) contrast(1.05)',
          // ↑
          transformOrigin:'50% 100%',
          zIndex:1, pointerEvents:'none',
          willChange:'transform, opacity',
          display:'block', maxWidth:'none',
        }}
      />

      {/* ══ LAYER 1b: Splash canvas ════════════════════════════════════════
          Full-screen transparent canvas; drawSplash() paints burst at impactY */}
      <canvas
        ref={splashRef}
        style={{
          position:'fixed', top:0, left:0,
          width:'100vw', height:'100vh',
          zIndex:1, pointerEvents:'none', display:'block',
        }}
      />

      {/* ══ LAYER 1c: Ropes ════════════════════════════════════════════════
          Centred on impact point (top:IMPACT_Y vh, left:50%).
          translate(-50%,-50%) keeps centre at that point.
          scale grows from 0.14 → 1.06 → ropes radiate outward from impact.
          - REMOVE mixBlendMode when transparent WebP is ready              */}
      <img
        ref={ropesRef}
        src={ROPES_SRC}
        alt=""
        style={{
          position:'fixed',
          top:`${IMPACT_Y * 100}vh`,
          left:'50%',
          width:'150vw', height:'auto',
          opacity:0,
          // ↓ remove when transparent WebP is ready
          mixBlendMode:'screen',
          // ↑
          transformOrigin:'center center',
          transform:'translate(-50%, -50%) scale(0.14)',
          zIndex:1, pointerEvents:'none',
          willChange:'transform, opacity',
          display:'block', maxWidth:'none',
        }}
      />

      {/* ══ LAYER 3: Scrollable HTML sections (hero, features, creator) ════ */}
      <div ref={wrapperRef} style={{ position:'relative', height:'600vh', zIndex:3 }}>

        {/* HERO — sticky inside first 200vh */}
        <div style={{ height:'200vh' }}>
          <section ref={heroRef} style={{
            height:'100svh', minHeight:'600px',
            position:'sticky', top:0, zIndex:2,
            display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center',
            overflow:'hidden',
          }}>
            {/* Ambient accent glow */}
            <div style={{
              position:'absolute', width:'280px', height:'280px', borderRadius:'50%',
              background:'radial-gradient(circle, rgba(212,160,192,0.09) 0%, transparent 70%)',
              animation:'floatBlob 8s ease-in-out infinite',
              pointerEvents:'none', zIndex:1,
            }} />

            {/* Floating nail-design cards */}
            {designs.slice(0, cardConfigs.length).map((d, i) => {
              const cfg = cardConfigs[i]
              const ps  = {}
              if (cfg.top)    ps.top    = cfg.top
              if (cfg.bottom) ps.bottom = cfg.bottom
              if (cfg.left)   ps.left   = cfg.left
              return (
                <div key={d.id} className="lq-float-card" style={{
                  ...ps, width:cfg.size, height:cfg.size * 1.18,
                  animation:`${cfg.anim} ${cfg.dur} ease-in-out ${cfg.delay} infinite`,
                  zIndex:0,
                }}>
                  {d.image_url && (
                    <img
                      src={d.image_url} alt=""
                      style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
                      onLoad={e => e.currentTarget.classList.add('img-loaded')}
                    />
                  )}
                </div>
              )
            })}

            {/* Centre wordmark + CTA */}
            <div style={{
              position:'relative', zIndex:2,
              display:'flex', flexDirection:'column',
              alignItems:'center', textAlign:'center',
              padding:'0 32px',
            }}>
              <div style={{
                display:'inline-flex', alignItems:'center', gap:'7px',
                background:'rgba(212,160,192,0.1)', border:'0.5px solid rgba(212,160,192,0.25)',
                borderRadius:'20px', padding:'4px 12px 4px 8px',
                marginBottom:'20px', animation:'fadeUp 0.5s ease 0.1s both',
              }}>
                <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--accent)', display:'inline-block' }} />
                <span style={{ color:'var(--accent)', fontSize:'11px', fontWeight:'500', letterSpacing:'0.07em', textTransform:'uppercase' }}>Beta</span>
              </div>

              <h1 style={{
                fontSize:'clamp(72px, 22vw, 96px)', fontWeight:'500',
                color:'var(--text-primary)', letterSpacing:'-0.045em',
                lineHeight:'0.9', marginBottom:'18px',
                animation:'fadeUp 0.6s ease 0.2s both',
              }}>Laque</h1>

              <p style={{
                fontSize:'16px', color:'var(--text-secondary)',
                lineHeight:'1.55', marginBottom:'30px', maxWidth:'260px',
                animation:'fadeUp 0.6s ease 0.35s both',
              }}>
                Your next nail set,{' '}
                <span style={{ color:'var(--text-primary)', fontWeight:'500' }}>fully specced.</span>
              </p>

              <div style={{
                display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center',
                animation:'fadeUp 0.6s ease 0.48s both',
              }}>
                <Link href="/feed" className="lq-cta-primary">
                  Explore designs
                  <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
                <Link href="/profile" className="lq-cta-secondary">Sign up free</Link>
              </div>
            </div>

            {/* Scroll hint */}
            <div style={{
              position:'absolute', bottom:'24px',
              display:'flex', flexDirection:'column', alignItems:'center', gap:'6px',
              animation:'fadeUp 0.6s ease 0.9s both', zIndex:2,
            }}>
              <span style={{ color:'var(--text-secondary)', fontSize:'10px', letterSpacing:'0.1em', textTransform:'uppercase' }}>Scroll</span>
              <div style={{ width:'1px', height:'24px', background:'linear-gradient(to bottom, var(--text-secondary), transparent)' }} />
            </div>
          </section>
        </div>

        {/* FEATURES — sticky inside second 200vh */}
        <div style={{ height:'200vh' }}>
          <section ref={featRef} style={{
            height:'100svh', minHeight:'580px',
            position:'sticky', top:0, zIndex:2,
            display:'flex', flexDirection:'column',
            justifyContent:'center', padding:'0 24px',
            opacity:0,
          }}>
            <p style={{ color:'var(--accent)', fontSize:'11px', fontWeight:'500', letterSpacing:'0.09em', textTransform:'uppercase', marginBottom:'20px' }}>
              Why Laque
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                { symbol:'✦', title:'Full colour specs',  desc:'Every design comes with hex codes, gel brand & shade names, and finish type. No more vibes-only inspo.' },
                { symbol:'◈', title:'Search & filter',    desc:'Filter by nail shape, length, technique, or occasion. From everyday to editorial.' },
                { symbol:'◇', title:'Save & share',       desc:'Bookmark your favourites and share a direct link with your nail tech — no screenshotting required.' },
              ].map(f => (
                <div key={f.title} className="lq-feature">
                  <span style={{ fontSize:'18px', color:'var(--accent)', lineHeight:'1', marginTop:'3px', flexShrink:0 }}>{f.symbol}</span>
                  <div>
                    <p style={{ color:'var(--text-primary)', fontWeight:'500', fontSize:'15px', marginBottom:'5px' }}>{f.title}</p>
                    <p style={{ color:'var(--text-secondary)', fontSize:'13px', lineHeight:'1.65' }}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* CREATOR — sticky inside third 200vh */}
        <div style={{ height:'200vh' }}>
          <section ref={creatRef} style={{
            height:'100svh', minHeight:'580px',
            position:'sticky', top:0, zIndex:2,
            display:'flex', flexDirection:'column',
            justifyContent:'center',
            padding:'48px 24px 52px',
            overflow:'hidden',
            opacity:0,
          }}>
            <div style={{
              position:'absolute', inset:0,
              background:'linear-gradient(160deg, rgba(212,160,192,0.06) 0%, rgba(212,160,192,0.02) 60%, transparent 100%)',
              borderTop:'0.5px solid rgba(212,160,192,0.20)',
              pointerEvents:'none', zIndex:0,
            }} />
            <div style={{
              position:'absolute', top:'-60px', right:'-80px',
              width:'240px', height:'240px', borderRadius:'50%',
              background:'radial-gradient(circle, rgba(212,160,192,0.14) 0%, transparent 70%)',
              animation:'floatBlob 6s ease-in-out 0.5s infinite',
              pointerEvents:'none', zIndex:0,
            }} />

            <div style={{ position:'relative', zIndex:1 }}>
              <div style={{
                display:'inline-flex', alignItems:'center', gap:'7px',
                background:'rgba(212,160,192,0.1)', border:'0.5px solid rgba(212,160,192,0.3)',
                borderRadius:'20px', padding:'5px 12px 5px 8px',
                width:'fit-content', marginBottom:'22px',
              }}>
                <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'var(--accent)', display:'inline-block', flexShrink:0 }} />
                <span style={{ color:'var(--accent)', fontSize:'11px', fontWeight:'500', letterSpacing:'0.07em', textTransform:'uppercase' }}>For nail artists &amp; salons</span>
              </div>

              <h2 style={{ fontSize:'clamp(28px, 8vw, 38px)', fontWeight:'600', color:'var(--text-primary)', letterSpacing:'-0.03em', lineHeight:'1.15', marginBottom:'14px' }}>
                Publish your work.{' '}
                <span style={{ color:'var(--accent)' }}>Get discovered.</span>
              </h2>

              <p style={{ fontSize:'15px', color:'var(--text-secondary)', lineHeight:'1.65', marginBottom:'28px', maxWidth:'310px' }}>
                Get a free creator profile, post your sets with full specs, and reach clients who are already browsing for their next look.
              </p>

              <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'32px' }}>
                {[
                  { icon:'◈', text:'Free public portfolio — your work, your page' },
                  { icon:'✦', text:'Get found by clients browsing for inspo' },
                  { icon:'◇', text:'Post designs with colour codes & technique notes' },
                ].map(item => (
                  <div key={item.text} className="lq-creator-row">
                    <span style={{ color:'var(--accent)', fontSize:'14px', flexShrink:0 }}>{item.icon}</span>
                    <span style={{ color:'var(--text-primary)', fontSize:'13px', lineHeight:'1.45' }}>{item.text}</span>
                  </div>
                ))}
              </div>

              <Link href="/profile" className="lq-cta-creator">
                Create a creator account
                <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </Link>
            </div>
          </section>
        </div>

      </div>{/* end 600vh wrapper */}

      {/* FINAL CTA */}
      <section style={{
        padding:'40px 24px 56px', textAlign:'center',
        borderTop:'0.5px solid var(--border)',
        background:'var(--bg-primary)',
        position:'relative', zIndex:3,
      }}>
        <p style={{ color:'var(--text-primary)', fontSize:'22px', fontWeight:'500', letterSpacing:'-0.02em', lineHeight:'1.3', marginBottom:'10px' }}>
          Ready to find your next set?
        </p>
        <p style={{ color:'var(--text-secondary)', fontSize:'14px', marginBottom:'28px', lineHeight:'1.6' }}>
          Browse free. Save what you love.<br />Show your nail tech.
        </p>
        <Link href="/feed" className="lq-cta-primary" style={{ display:'inline-flex' }}>
          Start exploring
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </section>
    </>
  )
}
