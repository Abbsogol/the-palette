'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LandingPage() {
  const canvasRef              = useRef(null)
  const [designs, setDesigns]  = useState([])
  const [heroOp, setHeroOp]    = useState(1)
  const [featOp, setFeatOp]    = useState(0)
  const [creatOp, setCreatOp]  = useState(0)

  /* ── load real designs ── */
  useEffect(() => {
    supabase.from('designs').select('id, image_url')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(16)
      .then(({ data }) => setDesigns(data || []))
  }, [])

  /* ── scroll-driven section opacity ── */
  useEffect(() => {
    const cl  = (v, a, b) => Math.max(a, Math.min(b, v))
    const rng = (p, a, b) => cl((p - a) / (b - a), 0, 1)
    function tick() {
      const max = document.documentElement.scrollHeight - window.innerHeight
      if (max <= 0) return
      const p = cl(window.scrollY / max, 0, 1)
      setHeroOp(1 - rng(p, 0.13, 0.18))
      setFeatOp(rng(p, 0.33, 0.36) * (1 - rng(p, 0.47, 0.51)))
      setCreatOp(rng(p, 0.66, 0.70))
    }
    window.addEventListener('scroll', tick, { passive: true })
    tick()
    return () => window.removeEventListener('scroll', tick)
  }, [])

  /* ── canvas animation ── */
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const cl  = (v, a, b) => Math.max(a, Math.min(b, v))
    const map = (v, a, b, c, d) => c + (d - c) * cl((v - a) / (b - a), 0, 1)
    const eas = t => t < 0.5 ? 2*t*t : -1+(4-2*t)*t
    let pts = [], raf

    function init() {
      canvas.width  = window.innerWidth
      canvas.height = window.innerHeight
      pts = Array.from({ length: 135 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.35,
        a: Math.random() * 0.55 + 0.12,
        t: Math.random() * Math.PI * 2,
        spd: Math.random() * 0.004 + 0.001,
        pink: Math.random() > 0.80,
      }))
    }

    /* — draw one gel droplet — */
    function drawDrop(cx, cy, br, sy, al) {
      if (al <= 0) return
      ctx.save(); ctx.globalAlpha = al
      const rx = br / Math.sqrt(sy), ry = br * sy

      // outer glow
      const og = ctx.createRadialGradient(cx,cy,0, cx,cy, Math.max(rx,ry)*2.8)
      og.addColorStop(0,'rgba(212,160,192,0.20)'); og.addColorStop(1,'rgba(212,160,192,0)')
      ctx.fillStyle = og
      ctx.beginPath(); ctx.ellipse(cx,cy,rx*2.8,ry*2.8,0,0,Math.PI*2); ctx.fill()

      // body
      const bg = ctx.createRadialGradient(cx-rx*.32,cy-ry*.28,0, cx,cy, Math.max(rx,ry)*1.05)
      bg.addColorStop(0,    'rgba(252,224,242,0.99)')
      bg.addColorStop(0.14, 'rgba(234,190,220,0.97)')
      bg.addColorStop(0.44, 'rgba(212,160,192,0.94)')
      bg.addColorStop(0.74, 'rgba(166,95,148,0.89)')
      bg.addColorStop(1,    'rgba(92,30,72,0.85)')
      ctx.beginPath(); ctx.ellipse(cx,cy,rx,ry,0,0,Math.PI*2)
      ctx.fillStyle = bg; ctx.fill()

      // main specular
      const sg = ctx.createRadialGradient(cx-rx*.38,cy-ry*.38,0, cx-rx*.28,cy-ry*.26, rx*.48)
      sg.addColorStop(0,'rgba(255,255,255,0.94)'); sg.addColorStop(0.55,'rgba(255,255,255,0.26)'); sg.addColorStop(1,'rgba(255,255,255,0)')
      ctx.fillStyle = sg
      ctx.beginPath(); ctx.ellipse(cx-rx*.28,cy-ry*.30,rx*.33,ry*.20,-Math.PI/5,0,Math.PI*2); ctx.fill()

      // secondary specular
      ctx.fillStyle = 'rgba(255,255,255,0.26)'
      ctx.beginPath(); ctx.ellipse(cx+rx*.22,cy+ry*.34,rx*.10,ry*.055,Math.PI/4,0,Math.PI*2); ctx.fill()
      ctx.restore()
    }

    /* — splash — */
    function drawSplash(cx, cy, sp, w, h) {
      if (sp <= 0) return
      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2 + (i % 3 === 0 ? 0.18 : -0.12)
        const spd = (0.52 + (i % 4) * 0.13) * sp
        const dx  = Math.cos(ang) * w * 0.20 * spd
        const dy  = Math.sin(ang) * h * 0.13 * spd - h * 0.07 * sp
        const dr  = (3.2 + (i % 5) * 1.9) * (1 - sp * 0.76)
        const da  = Math.max(0, 1 - sp * 1.38)
        if (da > 0 && dr > 0) drawDrop(cx+dx, cy+dy, dr, 1+sp*0.62, da)
      }
      const ra = Math.max(0, 0.78 - sp * 1.02)
      if (ra > 0) {
        ctx.save(); ctx.globalAlpha = ra
        ctx.strokeStyle = 'rgba(212,160,192,0.92)'; ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.arc(cx, cy, w*0.14*sp, 0, Math.PI*2); ctx.stroke()
        ctx.restore()
      }
    }

    /* — lacquer ribbons — */
    function drawRibbons(cx, cy, rp, w, h) {
      if (rp <= 0) return
      const defs = [
        {c1:[.22,.09],  c2:[.52,.27],  e:[.86,.21],  wt:5.0, col:'212,160,192'},
        {c1:[-.27,.10], c2:[-.55,.33], e:[-.88,.25], wt:4.5, col:'190,128,166'},
        {c1:[.14,.20],  c2:[.28,.53],  e:[.52,.80],  wt:3.5, col:'234,184,214'},
        {c1:[-.17,.17], c2:[-.32,.49], e:[-.47,.74], wt:3.0, col:'170,98,150' },
        {c1:[.48,.07],  c2:[.78,.17],  e:[1.10,.11], wt:2.5, col:'200,146,176'},
        {c1:[-.46,.08], c2:[-.72,.23], e:[-1.06,.15],wt:2.5, col:'222,170,200'},
      ]
      defs.forEach((r, idx) => {
        const lp = cl((rp - idx*0.07) / 0.72, 0, 1)
        if (lp <= 0) return
        const ep = eas(lp)
        ctx.save()
        ctx.globalAlpha = 0.52 + lp * 0.32
        ctx.strokeStyle = `rgba(${r.col},0.90)`
        ctx.lineWidth   = r.wt * (0.38 + ep * 0.62)
        ctx.lineCap     = 'round'
        ctx.shadowBlur  = 11
        ctx.shadowColor = `rgba(${r.col},0.46)`
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.bezierCurveTo(
          cx+r.c1[0]*w*.50, cy+r.c1[1]*h*.42,
          cx+r.c2[0]*w*.50, cy+r.c2[1]*h*.42,
          cx+r.e[0] *w*.50*ep, cy+r.e[1]*h*.42*ep
        )
        ctx.stroke(); ctx.restore()
      })
    }

    /* — main draw loop — */
    function draw() {
      const w = canvas.width, h = canvas.height, cx = w * 0.5
      const maxS = document.documentElement.scrollHeight - window.innerHeight
      const p    = maxS > 0 ? cl(window.scrollY / maxS, 0, 1) : 0

      ctx.fillStyle = '#0b0909'; ctx.fillRect(0, 0, w, h)
      const bgg = ctx.createLinearGradient(0,0,0,h)
      bgg.addColorStop(0,  `rgba(38,8,28,${0.36+p*0.20})`)
      bgg.addColorStop(0.5,'rgba(14,7,18,0.24)')
      bgg.addColorStop(1,  'rgba(8,4,14,0.46)')
      ctx.fillStyle = bgg; ctx.fillRect(0,0,w,h)

      // ambient orbs
      ;[[cx*.54,h*.17,w*.33,'88,32,68',0.070],
        [cx*1.44,h*.74,w*.27,'68,22,96',0.055],
        [cx*.80, h*.60,w*.20,'120,50,100',0.040]
      ].forEach(([ox,oy,or_,col,oa]) => {
        const g=ctx.createRadialGradient(ox,oy,0,ox,oy,or_)
        g.addColorStop(0,`rgba(${col},${oa})`); g.addColorStop(1,`rgba(${col},0)`)
        ctx.fillStyle=g; ctx.beginPath(); ctx.arc(ox,oy,or_,0,Math.PI*2); ctx.fill()
      })

      // particles
      pts.forEach(pt => {
        pt.t += pt.spd
        const a = pt.a*(0.52+0.48*Math.sin(pt.t))
        ctx.fillStyle = pt.pink ? `rgba(212,160,192,${a})` : `rgba(255,255,255,${a})`
        ctx.beginPath(); ctx.arc(pt.x,pt.y,pt.r,0,Math.PI*2); ctx.fill()
      })

      // animation phases
      const FORM_S=0.04, FORM_E=0.14
      const FALL_S=0.04, FALL_E=0.52
      const STR_S =0.34, STR_E =0.52
      const IMP   =0.52, SPLA_E=0.70, RIB_S=0.60

      const dropY  = h * map(p, FALL_S, FALL_E, 0.10, 0.56)
      const baseR  = w * map(p, 0, FORM_E, 0.018, 0.050)
      const stretch= map(p, STR_S, STR_E, 1.0, 2.30)
      const dropA  = p < IMP
        ? map(p, FORM_S, FORM_E, 0, 1)
        : map(p, IMP, IMP+0.056, 1, 0)

      // impact flash
      if (p > IMP && p < IMP+0.040) {
        const fa = map(p, IMP, IMP+0.040, 0.68, 0)
        ctx.fillStyle = `rgba(255,212,238,${fa})`; ctx.fillRect(0,0,w,h)
      }

      const splashP = p > IMP   ? map(p, IMP,   SPLA_E, 0, 1) : 0
      const ribP    = p > RIB_S ? map(p, RIB_S, 1.0,   0, 1) : 0

      drawSplash  (cx, dropY,  splashP, w, h)
      drawRibbons (cx, h*0.56, ribP,    w, h)
      if (p < IMP+0.056) drawDrop(cx, dropY, baseR, stretch, dropA)

      raf = requestAnimationFrame(draw)
    }

    init()
    window.addEventListener('resize', init)
    raf = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', init) }
  }, [])

  /* ── card layout (same as cosmos) ── */
  const cardConfigs = [
    { top:'-4%',    left:'calc(50% - 232px)', anim:'fc7', dur:'5.2s', delay:'-0.6s', size:88 },
    { top:'12%',    left:'calc(50% - 252px)', anim:'fc3', dur:'6.1s', delay:'-2.4s', size:84 },
    { top:'34%',    left:'calc(50% - 258px)', anim:'fc1', dur:'5s',   delay:'0s',    size:92 },
    { top:'56%',    left:'calc(50% - 244px)', anim:'fc5', dur:'4.8s', delay:'-3.5s', size:86 },
    { bottom:'-2%', left:'calc(50% - 228px)', anim:'fc3', dur:'5.6s', delay:'-1.2s', size:82 },
    { top:'20%',    left:'calc(50% - 172px)', anim:'fc8', dur:'7s',   delay:'-4s',   size:68 },
    { top:'62%',    left:'calc(50% - 168px)', anim:'fc2', dur:'6.4s', delay:'-2s',   size:66 },
    { top:'-3%',    left:'calc(50% + 128px)', anim:'fc4', dur:'5.4s', delay:'-1.5s', size:86 },
    { top:'11%',    left:'calc(50% + 148px)', anim:'fc2', dur:'4.6s', delay:'-0.8s', size:80 },
    { top:'33%',    left:'calc(50% + 154px)', anim:'fc6', dur:'5.8s', delay:'-3.2s', size:90 },
    { top:'55%',    left:'calc(50% + 140px)', anim:'fc1', dur:'6.2s', delay:'-4.8s', size:84 },
    { bottom:'-1%', left:'calc(50% + 118px)', anim:'fc5', dur:'5s',   delay:'-2.6s', size:78 },
    { top:'16%',    left:'calc(50% + 82px)',  anim:'fc7', dur:'7.2s', delay:'-1s',   size:64 },
    { top:'60%',    left:'calc(50% + 90px)',  anim:'fc3', dur:'6.8s', delay:'-3.8s', size:68 },
    { top:'2%',     left:'calc(50% - 46px)',  anim:'fc8', dur:'5.6s', delay:'-1.7s', size:82 },
    { bottom:'2%',  left:'calc(50% - 50px)',  anim:'fc4', dur:'6.3s', delay:'-3.1s', size:84 },
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
          position:absolute; border-radius:12px; overflow:hidden;
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

      {/* ── FIXED CANVAS ── */}
      <canvas ref={canvasRef} style={{
        position:'fixed', top:0, left:0,
        width:'100vw', height:'100vh',
        zIndex:0, pointerEvents:'none', display:'block',
      }} />

      {/* ── SCROLLYTELLING CONTAINER: 600vh ── */}
      <div style={{ position:'relative', height:'600vh' }}>

        {/* HERO — sticky inside 200vh */}
        <div style={{ height:'200vh' }}>
          <section style={{
            height:'100svh', minHeight:'600px',
            position:'sticky', top:0, zIndex:2,
            display:'flex', flexDirection:'column',
            alignItems:'center', justifyContent:'center',
            overflow:'hidden',
            opacity: heroOp,
            transition:'opacity 0.08s linear',
            pointerEvents: heroOp < 0.05 ? 'none' : 'auto',
          }}>
            {/* Soft glow blob */}
            <div style={{
              position:'absolute', width:'280px', height:'280px',
              borderRadius:'50%',
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
                  ...ps,
                  width: cfg.size,
                  height: cfg.size * 1.18,
                  animation:`${cfg.anim} ${cfg.dur} ease-in-out ${cfg.delay} infinite`,
                  zIndex:0,
                }}>
                  {d.image_url && (
                    <img
                      src={d.image_url} alt=""
                      style={{width:'100%',height:'100%',objectFit:'cover',display:'block'}}
                      onLoad={e => e.currentTarget.classList.add('img-loaded')}
                    />
                  )}
                </div>
              )
            })}

            {/* Centre content */}
            <div style={{
              position:'relative', zIndex:2,
              display:'flex', flexDirection:'column',
              alignItems:'center', textAlign:'center',
              padding:'0 32px',
            }}>
              {/* Beta badge */}
              <div style={{
                display:'inline-flex', alignItems:'center', gap:'7px',
                background:'rgba(212,160,192,0.1)', border:'0.5px solid rgba(212,160,192,0.25)',
                borderRadius:'20px', padding:'4px 12px 4px 8px',
                marginBottom:'20px', animation:'fadeUp 0.5s ease 0.1s both',
              }}>
                <span style={{width:'6px',height:'6px',borderRadius:'50%',background:'var(--accent)',display:'inline-block'}} />
                <span style={{color:'var(--accent)',fontSize:'11px',fontWeight:'500',letterSpacing:'0.07em',textTransform:'uppercase'}}>Beta</span>
              </div>

              {/* Wordmark */}
              <h1 style={{
                fontSize:'clamp(72px, 22vw, 96px)', fontWeight:'500',
                color:'var(--text-primary)', letterSpacing:'-0.045em',
                lineHeight:'0.9', marginBottom:'18px',
                animation:'fadeUp 0.6s ease 0.2s both',
              }}>Laque</h1>

              {/* Tagline */}
              <p style={{
                fontSize:'16px', color:'var(--text-secondary)',
                lineHeight:'1.55', marginBottom:'30px', maxWidth:'260px',
                animation:'fadeUp 0.6s ease 0.35s both',
              }}>
                Your next nail set,{' '}
                <span style={{color:'var(--text-primary)',fontWeight:'500'}}>fully specced.</span>
              </p>

              {/* CTAs */}
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
              <span style={{color:'var(--text-secondary)',fontSize:'10px',letterSpacing:'0.1em',textTransform:'uppercase'}}>Scroll</span>
              <div style={{width:'1px',height:'24px',background:'linear-gradient(to bottom, var(--text-secondary), transparent)'}} />
            </div>
          </section>
        </div>

        {/* FEATURES — sticky inside 200vh */}
        <div style={{ height:'200vh' }}>
          <section style={{
            height:'100svh', minHeight:'580px',
            position:'sticky', top:0, zIndex:2,
            display:'flex', flexDirection:'column',
            justifyContent:'center',
            padding:'0 24px',
            opacity: featOp,
            transition:'opacity 0.08s linear',
            pointerEvents: featOp < 0.05 ? 'none' : 'auto',
          }}>
            <p style={{color:'var(--accent)',fontSize:'11px',fontWeight:'500',letterSpacing:'0.09em',textTransform:'uppercase',marginBottom:'20px'}}>
              Why Laque
            </p>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              {[
                {symbol:'✦', title:'Full colour specs', desc:'Every design comes with hex codes, gel brand & shade names, and finish type. No more vibes-only inspo.'},
                {symbol:'◈', title:'Search & filter',   desc:'Filter by nail shape, length, technique, or occasion. From everyday to editorial.'},
                {symbol:'◇', title:'Save & share',      desc:'Bookmark your favourites and share a direct link with your nail tech — no screenshotting required.'},
              ].map(f => (
                <div key={f.title} className="lq-feature">
                  <span style={{fontSize:'18px',color:'var(--accent)',lineHeight:'1',marginTop:'3px',flexShrink:0}}>{f.symbol}</span>
                  <div>
                    <p style={{color:'var(--text-primary)',fontWeight:'500',fontSize:'15px',marginBottom:'5px'}}>{f.title}</p>
                    <p style={{color:'var(--text-secondary)',fontSize:'13px',lineHeight:'1.65'}}>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* CREATOR — sticky inside 200vh */}
        <div style={{ height:'200vh' }}>
          <section style={{
            height:'100svh', minHeight:'580px',
            position:'sticky', top:0, zIndex:2,
            display:'flex', flexDirection:'column',
            justifyContent:'center',
            padding:'48px 24px 52px',
            overflow:'hidden',
            opacity: creatOp,
            transition:'opacity 0.08s linear',
            pointerEvents: creatOp < 0.05 ? 'none' : 'auto',
          }}>
            {/* Tint overlay */}
            <div style={{
              position:'absolute', inset:0,
              background:'linear-gradient(160deg, rgba(212,160,192,0.06) 0%, rgba(212,160,192,0.02) 60%, transparent 100%)',
              borderTop:'0.5px solid rgba(212,160,192,0.20)',
              pointerEvents:'none', zIndex:0,
            }} />
            {/* Floating orb */}
            <div style={{
              position:'absolute', top:'-60px', right:'-80px',
              width:'240px', height:'240px', borderRadius:'50%',
              background:'radial-gradient(circle, rgba(212,160,192,0.14) 0%, transparent 70%)',
              animation:'floatBlob 6s ease-in-out 0.5s infinite',
              pointerEvents:'none', zIndex:0,
            }} />

            <div style={{position:'relative',zIndex:1}}>
              <div style={{
                display:'inline-flex', alignItems:'center', gap:'7px',
                background:'rgba(212,160,192,0.1)', border:'0.5px solid rgba(212,160,192,0.3)',
                borderRadius:'20px', padding:'5px 12px 5px 8px',
                width:'fit-content', marginBottom:'22px',
              }}>
                <span style={{width:'5px',height:'5px',borderRadius:'50%',background:'var(--accent)',display:'inline-block',flexShrink:0}} />
                <span style={{color:'var(--accent)',fontSize:'11px',fontWeight:'500',letterSpacing:'0.07em',textTransform:'uppercase'}}>For nail artists &amp; salons</span>
              </div>

              <h2 style={{fontSize:'clamp(28px, 8vw, 38px)',fontWeight:'600',color:'var(--text-primary)',letterSpacing:'-0.03em',lineHeight:'1.15',marginBottom:'14px'}}>
                Publish your work.{' '}
                <span style={{color:'var(--accent)'}}>Get discovered.</span>
              </h2>

              <p style={{fontSize:'15px',color:'var(--text-secondary)',lineHeight:'1.65',marginBottom:'28px',maxWidth:'310px'}}>
                Get a free creator profile, post your sets with full specs, and reach clients who are already browsing for their next look.
              </p>

              <div style={{display:'flex',flexDirection:'column',gap:'8px',marginBottom:'32px'}}>
                {[
                  {icon:'◈', text:'Free public portfolio — your work, your page'},
                  {icon:'✦', text:'Get found by clients browsing for inspo'},
                  {icon:'◇', text:'Post designs with colour codes & technique notes'},
                ].map(item => (
                  <div key={item.text} className="lq-creator-row">
                    <span style={{color:'var(--accent)',fontSize:'14px',flexShrink:0}}>{item.icon}</span>
                    <span style={{color:'var(--text-primary)',fontSize:'13px',lineHeight:'1.45'}}>{item.text}</span>
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

      </div>{/* end 600vh */}

      {/* FINAL CTA — opaque, after scrollytelling ends */}
      <section style={{
        padding:'40px 24px 56px', textAlign:'center',
        borderTop:'0.5px solid var(--border)',
        background:'var(--bg-primary)',
        position:'relative', zIndex:2,
      }}>
        <p style={{color:'var(--text-primary)',fontSize:'22px',fontWeight:'500',letterSpacing:'-0.02em',lineHeight:'1.3',marginBottom:'10px'}}>
          Ready to find your next set?
        </p>
        <p style={{color:'var(--text-secondary)',fontSize:'14px',marginBottom:'28px',lineHeight:'1.6'}}>
          Browse free. Save what you love.<br />Show your nail tech.
        </p>
        <Link href="/feed" className="lq-cta-primary" style={{display:'inline-flex'}}>
          Start exploring
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </section>
    </>
  )
}
