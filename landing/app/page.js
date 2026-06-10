'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'

export default function LandingPage() {
  const [scrollY, setScrollY]               = useState(0)
  const [dropVisible, setDropVisible]       = useState(false)
  const [featuresVisible, setFeaturesVisible] = useState(false)
  const [creatorVisible, setCreatorVisible]   = useState(false)
  const transitionRef = useRef(null)
  const featuresRef   = useRef(null)
  const creatorRef    = useRef(null)

  useEffect(() => {
    const onScroll = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    const observe = (ref, setter) => {
      if (!ref.current) return
      const obs = new IntersectionObserver(
        ([e]) => { if (e.isIntersecting) setter(true) },
        { threshold: 0.15 }
      )
      obs.observe(ref.current)
      return () => obs.disconnect()
    }
    const c0 = observe(transitionRef, setDropVisible)
    const c1 = observe(featuresRef,   setFeaturesVisible)
    const c2 = observe(creatorRef,    setCreatorVisible)
    return () => { c0?.(); c1?.(); c2?.() }
  }, [])


  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(24px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes heroPan {
          0%   { transform: scale(1.06) translate(0%, 0%); }
          33%  { transform: scale(1.1)  translate(-1%, -0.5%); }
          66%  { transform: scale(1.08) translate(0.8%, -1%); }
          100% { transform: scale(1.06) translate(0%, 0%); }
        }
        @keyframes ribbonsDrift {
          0%   { transform: scale(1.04) translate(0%, 0%); }
          50%  { transform: scale(1.08) translate(-1%, 1%); }
          100% { transform: scale(1.04) translate(0%, 0%); }
        }
        @keyframes pulseGlow {
          0%,100% { box-shadow:0 0 0 0 rgba(212,160,192,0.4); }
          50%      { box-shadow:0 0 0 12px rgba(212,160,192,0); }
        }
        @keyframes floatBlob {
          0%,100% { transform:translateY(0) scale(1); }
          50%     { transform:translateY(-14px) scale(1.03); }
        }
        .lq-cta-primary {
          background: var(--accent);
          color: #2C0A1E;
          padding: 14px 28px;
          border-radius: 14px;
          font-weight: 600;
          font-size: 15px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: 'DM Sans', sans-serif;
          animation: pulseGlow 2.8s ease-in-out 1.2s infinite;
          transition: transform .18s ease, opacity .18s ease;
        }
        .lq-cta-primary:hover { transform:scale(1.03); opacity:.92; }
        .lq-cta-secondary {
          background: transparent;
          color: var(--text-secondary);
          padding: 14px 22px;
          border-radius: 14px;
          font-weight: 500;
          font-size: 15px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          border: 0.5px solid var(--border);
          font-family: 'DM Sans', sans-serif;
          transition: border-color .18s, color .18s;
        }
        .lq-cta-secondary:hover { border-color:var(--text-secondary); color:var(--text-primary); }
        .lq-cta-creator {
          background: transparent;
          color: var(--accent);
          padding: 14px 24px;
          border-radius: 14px;
          font-weight: 600;
          font-size: 15px;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-family: 'DM Sans', sans-serif;
          border: 1px solid rgba(212,160,192,.5);
          transition: background .18s, border-color .18s, transform .18s;
        }
        .lq-cta-creator:hover { background:rgba(212,160,192,.08); border-color:var(--accent); transform:translateY(-1px); }
        .lq-feature {
          background: rgba(30,30,30,0.75);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 0.5px solid rgba(255,255,255,0.08);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
          transition: border-color .2s, transform .2s;
        }
        .lq-feature:hover { border-color:var(--accent); transform:translateY(-2px); }
        .lq-creator-row {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(212,160,192,.05);
          border: 0.5px solid rgba(212,160,192,.18);
          border-radius: 12px;
          padding: 13px 14px;
          transition: background .18s, border-color .18s;
        }
        .lq-creator-row:hover { background:rgba(212,160,192,.09); border-color:rgba(212,160,192,.35); }
      `}</style>

      {/* ── HERO ── */}
      <section style={{
        height: '100svh', minHeight: '600px',
        position: 'relative', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        {/* cosmic background — slow cinematic pan */}
        <div style={{
          position: 'absolute', inset: '-8%',
          backgroundImage: 'url(/hero-cosmic.png)',
          backgroundSize: 'cover', backgroundPosition: 'center',
          animation: 'heroPan 18s ease-in-out infinite',
          willChange: 'transform',
        }} />
        {/* dark overlay */}
        <div style={{ position:'absolute', inset:0, background:'rgba(0,0,0,0.52)' }} />

        {/* content */}
        <div style={{
          position:'relative', zIndex:2,
          display:'flex', flexDirection:'column',
          alignItems:'center', textAlign:'center',
          padding:'0 28px',
        }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:'7px',
            background:'rgba(212,160,192,0.12)', border:'0.5px solid rgba(212,160,192,0.3)',
            borderRadius:'20px', padding:'4px 12px 4px 8px',
            marginBottom:'20px', animation:'fadeUp .5s ease .1s both',
          }}>
            <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--accent)', display:'inline-block' }} />
            <span style={{ color:'var(--accent)', fontSize:'11px', fontWeight:'500', letterSpacing:'.07em', textTransform:'uppercase' }}>Beta</span>
          </div>

          <h1 style={{
            fontSize:'clamp(72px, 22vw, 100px)', fontWeight:'500',
            color:'#F5EDE0', letterSpacing:'-0.045em', lineHeight:'.9',
            marginBottom:'18px', animation:'fadeUp .6s ease .2s both',
            textShadow:'0 2px 40px rgba(0,0,0,0.6)',
          }}>
            Laque
          </h1>

          <p style={{
            fontSize:'16px', color:'rgba(245,237,224,0.7)',
            lineHeight:'1.55', marginBottom:'30px', maxWidth:'260px',
            animation:'fadeUp .6s ease .35s both',
          }}>
            Your next nail set,{' '}
            <span style={{ color:'#F5EDE0', fontWeight:'500' }}>fully specced.</span>
          </p>

          <div style={{
            display:'flex', gap:'10px', flexWrap:'wrap', justifyContent:'center',
            animation:'fadeUp .6s ease .48s both',
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

        {/* scroll hint */}
        <div style={{
          position:'absolute', bottom:'24px', zIndex:2,
          display:'flex', flexDirection:'column', alignItems:'center', gap:'6px',
          animation:'fadeUp .6s ease .9s both',
          opacity: Math.max(0, 1 - scrollY / 80),
        }}>
          <span style={{ color:'rgba(245,237,224,0.45)', fontSize:'10px', letterSpacing:'.1em', textTransform:'uppercase' }}>Scroll</span>
          <div style={{ width:'1px', height:'24px', background:'linear-gradient(to bottom, rgba(245,237,224,0.4), transparent)' }} />
        </div>
      </section>

      {/* ── DROP TRANSITION ── */}
      <section
        ref={transitionRef}
        style={{
          height:'80vh', minHeight:'400px',
          display:'flex', alignItems:'center', justifyContent:'center',
          background:'var(--bg-primary)',
          overflow:'hidden', position:'relative',
        }}
      >
        {/* subtle pink glow behind drop */}
        <div style={{
          position:'absolute', width:'340px', height:'340px', borderRadius:'50%',
          background:'radial-gradient(circle, rgba(212,160,192,0.14) 0%, transparent 70%)',
          opacity: dropVisible ? 1 : 0,
          transition:'opacity 1.2s ease 0.4s',
          pointerEvents:'none',
        }} />
        <img
          src="/drop.png"
          alt=""
          style={{
            width:'min(72vw, 340px)', height:'auto',
            display:'block',
            mixBlendMode:'screen',
            filter:'brightness(1.3) drop-shadow(0 0 52px rgba(212,160,192,0.6))',
            transform: dropVisible ? 'translateY(0) scale(1)' : 'translateY(-220px) scale(0.7)',
            opacity: dropVisible ? 1 : 0,
            transition:'transform 1.3s cubic-bezier(0.22,1,0.36,1), opacity 0.9s ease',
            willChange:'transform,opacity',
          }}
        />
      </section>

      {/* ── FEATURES (ribbons as background-image on the section itself) ── */}
      <section
        ref={featuresRef}
        style={{
          padding:'52px 24px 48px',
          position:'relative', overflow:'hidden',
          backgroundImage:'url(/ribbons.png)',
          backgroundSize:'cover',
          backgroundPosition:'center',
          animation:'ribbonsDrift 22s ease-in-out infinite',
        }}
      >
        {/* dark overlay — sits on top of bg, below content */}
        <div style={{ position:'absolute', inset:0, background:'rgba(18,18,18,0.74)', zIndex:0 }} />

        <div style={{ position:'relative', zIndex:1 }}>
          <p style={{
            color:'var(--accent)', fontSize:'11px', fontWeight:'500',
            letterSpacing:'.09em', textTransform:'uppercase', marginBottom:'20px',
            opacity: featuresVisible ? 1 : 0,
            transform: featuresVisible ? 'none' : 'translateY(16px)',
            transition:'opacity .6s ease, transform .6s ease',
          }}>
            Why Laque
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            {[
              { symbol:'✦', title:'Full colour specs', desc:'Every design comes with hex codes, gel brand & shade names, and finish type. No more vibes-only inspo.' },
              { symbol:'◈', title:'Search & filter',   desc:'Filter by nail shape, length, technique, or occasion. From everyday to editorial.' },
              { symbol:'◇', title:'Save & share',      desc:'Bookmark your favourites and share a direct link with your nail tech — no screenshotting required.' },
            ].map((f, i) => (
              <div
                key={f.title}
                className="lq-feature"
                style={{
                  opacity: featuresVisible ? 1 : 0,
                  transform: featuresVisible ? 'none' : 'translateY(24px)',
                  transition: `opacity .6s ease ${0.1 + i * 0.12}s, transform .6s ease ${0.1 + i * 0.12}s`,
                }}
              >
                <span style={{ fontSize:'18px', color:'var(--accent)', lineHeight:'1', marginTop:'3px', flexShrink:0 }}>{f.symbol}</span>
                <div>
                  <p style={{ color:'var(--text-primary)', fontWeight:'500', fontSize:'15px', marginBottom:'5px' }}>{f.title}</p>
                  <p style={{ color:'var(--text-secondary)', fontSize:'13px', lineHeight:'1.65' }}>{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CREATOR / NAIL TECH ── */}
      <section
        ref={creatorRef}
        style={{
          padding:'48px 24px 52px',
          position:'relative', overflow:'hidden',
          borderTop:'0.5px solid rgba(212,160,192,0.22)',
          borderBottom:'0.5px solid rgba(212,160,192,0.22)',
        }}
      >
        {/* vortex background */}
        <div style={{
          position:'absolute', inset:0,
          backgroundImage:'url(/vortex.png)',
          backgroundSize:'cover', backgroundPosition:'center',
          opacity: creatorVisible ? 0.35 : 0,
          transition:'opacity 1.2s ease',
        }} />
        <div style={{ position:'absolute', inset:0, background:'rgba(20,20,20,0.78)' }} />
        {/* pink gradient overlay */}
        <div style={{
          position:'absolute', inset:0,
          background:'linear-gradient(160deg, rgba(212,160,192,0.08) 0%, rgba(212,160,192,0.02) 60%, transparent 100%)',
        }} />

        <div style={{ position:'relative', zIndex:1 }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:'7px',
            background:'rgba(212,160,192,0.1)', border:'0.5px solid rgba(212,160,192,0.3)',
            borderRadius:'20px', padding:'5px 12px 5px 8px',
            width:'fit-content', marginBottom:'22px',
            opacity: creatorVisible ? 1 : 0,
            transform: creatorVisible ? 'none' : 'translateY(16px)',
            transition:'opacity .6s ease, transform .6s ease',
          }}>
            <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:'var(--accent)', display:'inline-block', flexShrink:0 }} />
            <span style={{ color:'var(--accent)', fontSize:'11px', fontWeight:'500', letterSpacing:'.07em', textTransform:'uppercase' }}>For nail artists & salons</span>
          </div>

          <h2 style={{
            fontSize:'clamp(28px, 8vw, 38px)', fontWeight:'600',
            color:'var(--text-primary)', letterSpacing:'-0.03em', lineHeight:'1.15', marginBottom:'14px',
            opacity: creatorVisible ? 1 : 0,
            transform: creatorVisible ? 'none' : 'translateY(20px)',
            transition:'opacity .6s ease .1s, transform .6s ease .1s',
          }}>
            Publish your work.{' '}
            <span style={{ color:'var(--accent)' }}>Get discovered.</span>
          </h2>

          <p style={{
            fontSize:'15px', color:'var(--text-secondary)', lineHeight:'1.65', marginBottom:'28px', maxWidth:'310px',
            opacity: creatorVisible ? 1 : 0,
            transform: creatorVisible ? 'none' : 'translateY(16px)',
            transition:'opacity .6s ease .2s, transform .6s ease .2s',
          }}>
            Get a free creator profile, post your sets with full specs, and reach clients who are already browsing for their next look.
          </p>

          <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'32px' }}>
            {[
              { icon:'◈', text:'Free public portfolio — your work, your page' },
              { icon:'✦', text:'Get found by clients browsing for inspo' },
              { icon:'◇', text:'Post designs with colour codes & technique notes' },
            ].map((item, i) => (
              <div
                key={item.text}
                className="lq-creator-row"
                style={{
                  opacity: creatorVisible ? 1 : 0,
                  transform: creatorVisible ? 'none' : 'translateX(-16px)',
                  transition: `opacity .5s ease ${0.3 + i * 0.1}s, transform .5s ease ${0.3 + i * 0.1}s`,
                }}
              >
                <span style={{ color:'var(--accent)', fontSize:'14px', flexShrink:0 }}>{item.icon}</span>
                <span style={{ color:'var(--text-primary)', fontSize:'13px', lineHeight:'1.45' }}>{item.text}</span>
              </div>
            ))}
          </div>

          <div style={{
            opacity: creatorVisible ? 1 : 0,
            transform: creatorVisible ? 'none' : 'translateY(16px)',
            transition:'opacity .6s ease .6s, transform .6s ease .6s',
          }}>
            <Link href="/profile" className="lq-cta-creator">
              Create a creator account
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding:'40px 24px 56px', textAlign:'center', borderTop:'0.5px solid var(--border)' }}>
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
