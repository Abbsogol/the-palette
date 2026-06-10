'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LandingPage() {
  const [designs, setDesigns] = useState([])

  useEffect(() => {
    supabase
      .from('designs')
      .select('id, image_url')
      .eq('is_published', true)
      .order('created_at', { ascending: false })
      .limit(16)
      .then(({ data }) => setDesigns(data || []))
  }, [])

  const cardConfigs = [
    // left cluster
    { top: '-4%',    left: 'calc(50% - 232px)', rotate: '-20deg', anim: 'fc7', dur: '5.2s', delay: '-0.6s', size: 88 },
    { top: '12%',    left: 'calc(50% - 252px)', rotate: '-10deg', anim: 'fc3', dur: '6.1s', delay: '-2.4s', size: 84 },
    { top: '34%',    left: 'calc(50% - 258px)', rotate: '-16deg', anim: 'fc1', dur: '5s',   delay: '0s',    size: 92 },
    { top: '56%',    left: 'calc(50% - 244px)', rotate: '-6deg',  anim: 'fc5', dur: '4.8s', delay: '-3.5s', size: 86 },
    { bottom: '-2%', left: 'calc(50% - 228px)', rotate: '-14deg', anim: 'fc3', dur: '5.6s', delay: '-1.2s', size: 82 },
    { top: '20%',    left: 'calc(50% - 172px)', rotate: '-4deg',  anim: 'fc8', dur: '7s',   delay: '-4s',   size: 68 },
    { top: '62%',    left: 'calc(50% - 168px)', rotate: '-8deg',  anim: 'fc2', dur: '6.4s', delay: '-2s',   size: 66 },
    // right cluster
    { top: '-3%',    left: 'calc(50% + 128px)', rotate: '18deg',  anim: 'fc4', dur: '5.4s', delay: '-1.5s', size: 86 },
    { top: '11%',    left: 'calc(50% + 148px)', rotate: '12deg',  anim: 'fc2', dur: '4.6s', delay: '-0.8s', size: 80 },
    { top: '33%',    left: 'calc(50% + 154px)', rotate: '20deg',  anim: 'fc6', dur: '5.8s', delay: '-3.2s', size: 90 },
    { top: '55%',    left: 'calc(50% + 140px)', rotate: '9deg',   anim: 'fc1', dur: '6.2s', delay: '-4.8s', size: 84 },
    { bottom: '-1%', left: 'calc(50% + 118px)', rotate: '15deg',  anim: 'fc5', dur: '5s',   delay: '-2.6s', size: 78 },
    { top: '16%',    left: 'calc(50% + 82px)',  rotate: '5deg',   anim: 'fc7', dur: '7.2s', delay: '-1s',   size: 64 },
    { top: '60%',    left: 'calc(50% + 90px)',  rotate: '11deg',  anim: 'fc3', dur: '6.8s', delay: '-3.8s', size: 68 },
    // top centre + bottom centre fill
    { top: '2%',     left: 'calc(50% - 46px)',  rotate: '7deg',   anim: 'fc8', dur: '5.6s', delay: '-1.7s', size: 82 },
    { bottom: '2%',  left: 'calc(50% - 50px)',  rotate: '-6deg',  anim: 'fc4', dur: '6.3s', delay: '-3.1s', size: 84 },
  ]

  return (
    <>
      <style>{`
        @keyframes fc1 { 0%,100%{transform:rotate(-18deg) translateY(0) translateX(0)}    50%{transform:rotate(-18deg) translateY(-42px) translateX(7px)} }
        @keyframes fc2 { 0%,100%{transform:rotate(14deg) translateY(0) translateX(0)}     50%{transform:rotate(14deg) translateY(-46px) translateX(-8px)} }
        @keyframes fc3 { 0%,100%{transform:rotate(-7deg) translateY(0) translateX(0)}     50%{transform:rotate(-7deg) translateY(-36px) translateX(9px)} }
        @keyframes fc4 { 0%,100%{transform:rotate(19deg) translateY(0) translateX(0)}     50%{transform:rotate(19deg) translateY(-44px) translateX(-7px)} }
        @keyframes fc5 { 0%,100%{transform:rotate(-13deg) translateY(0) translateX(0)}    50%{transform:rotate(-13deg) translateY(-38px) translateX(8px)} }
        @keyframes fc6 { 0%,100%{transform:rotate(11deg) translateY(0) translateX(0)}     50%{transform:rotate(11deg) translateY(-40px) translateX(-9px)} }
        @keyframes fc7 { 0%,100%{transform:rotate(-22deg) translateY(0) translateX(0)}    50%{transform:rotate(-22deg) translateY(-34px) translateX(6px)} }
        @keyframes fc8 { 0%,100%{transform:rotate(8deg) translateY(0) translateX(0)}      50%{transform:rotate(8deg) translateY(-48px) translateX(-5px)} }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(22px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatBlob {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-14px) scale(1.04); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,160,192,0.35); }
          50%       { box-shadow: 0 0 0 10px rgba(212,160,192,0); }
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
          transition: transform 0.18s ease, opacity 0.18s ease;
        }
        .lq-cta-primary:hover { transform: scale(1.03); opacity: 0.92; }

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
          transition: border-color 0.18s ease, color 0.18s ease;
        }
        .lq-cta-secondary:hover { border-color: var(--text-secondary); color: var(--text-primary); }

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
          border: 1px solid rgba(212,160,192,0.5);
          transition: background 0.18s ease, border-color 0.18s ease, transform 0.18s ease;
        }
        .lq-cta-creator:hover {
          background: rgba(212,160,192,0.08);
          border-color: var(--accent);
          transform: translateY(-1px);
        }

        .lq-float-card {
          position: absolute;
          border-radius: 12px;
          overflow: hidden;
          background: linear-gradient(135deg, #1e1e1e 0%, #252525 100%);
          border: 1px solid rgba(255,255,255,0.07);
          box-shadow: 0 8px 32px rgba(0,0,0,0.6);
        }
        .lq-float-card img {
          opacity: 0;
          transition: opacity 0.5s ease;
        }
        .lq-float-card img.img-loaded {
          opacity: 1;
        }

        .lq-feature {
          background: var(--bg-card);
          border: 0.5px solid var(--border);
          border-radius: 16px;
          padding: 20px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
          transition: border-color 0.2s ease, transform 0.2s ease;
        }
        .lq-feature:hover { border-color: var(--accent); transform: translateY(-2px); }

        .lq-creator-row {
          display: flex;
          align-items: center;
          gap: 12px;
          background: rgba(212,160,192,0.05);
          border: 0.5px solid rgba(212,160,192,0.18);
          border-radius: 12px;
          padding: 13px 14px;
          transition: background 0.18s ease, border-color 0.18s ease;
        }
        .lq-creator-row:hover {
          background: rgba(212,160,192,0.09);
          border-color: rgba(212,160,192,0.35);
        }
      `}</style>

      {/* ── COSMOS HERO ── */}
      <section style={{
        height: '100svh',
        minHeight: '600px',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        {/* Soft accent glow behind text */}
        <div style={{
          position: 'absolute',
          width: '280px', height: '280px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,160,192,0.09) 0%, transparent 70%)',
          animation: 'floatBlob 8s ease-in-out infinite',
          pointerEvents: 'none',
          zIndex: 1,
        }} />

        {/* Floating nail design cards */}
        {designs.slice(0, cardConfigs.length).map((d, i) => {
          const cfg = cardConfigs[i]
          const posStyle = {}
          if (cfg.top)    posStyle.top    = cfg.top
          if (cfg.bottom) posStyle.bottom = cfg.bottom
          if (cfg.left)   posStyle.left   = cfg.left
          if (cfg.right)  posStyle.right  = cfg.right
          return (
            <div
              key={d.id}
              className="lq-float-card"
              style={{
                ...posStyle,
                width: cfg.size,
                height: cfg.size * 1.18,
                animation: `${cfg.anim} ${cfg.dur} ease-in-out ${cfg.delay} infinite`,
                zIndex: 0,
              }}
            >
              {d.image_url && (
                <img
                  src={d.image_url}
                  alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  onLoad={e => e.currentTarget.classList.add('img-loaded')}
                />
              )}
            </div>
          )
        })}

        {/* Centre content */}
        <div style={{
          position: 'relative', zIndex: 2,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', textAlign: 'center',
          padding: '0 32px',
        }}>
          {/* Beta badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '7px',
            background: 'rgba(212,160,192,0.1)', border: '0.5px solid rgba(212,160,192,0.25)',
            borderRadius: '20px', padding: '4px 12px 4px 8px',
            marginBottom: '20px',
            animation: 'fadeUp 0.5s ease 0.1s both',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block' }} />
            <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.07em', textTransform: 'uppercase' }}>Beta</span>
          </div>

          {/* Wordmark */}
          <h1 style={{
            fontSize: 'clamp(72px, 22vw, 96px)',
            fontWeight: '500',
            color: 'var(--text-primary)',
            letterSpacing: '-0.045em',
            lineHeight: '0.9',
            marginBottom: '18px',
            animation: 'fadeUp 0.6s ease 0.2s both',
          }}>
            Laque
          </h1>

          {/* Tagline */}
          <p style={{
            fontSize: '16px',
            color: 'var(--text-secondary)',
            lineHeight: '1.55',
            marginBottom: '30px',
            maxWidth: '260px',
            animation: 'fadeUp 0.6s ease 0.35s both',
          }}>
            Your next nail set,{' '}
            <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>fully specced.</span>
          </p>

          {/* CTAs */}
          <div style={{
            display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center',
            animation: 'fadeUp 0.6s ease 0.48s both',
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
          position: 'absolute', bottom: '24px',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
          animation: 'fadeUp 0.6s ease 0.9s both',
          zIndex: 2,
        }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '10px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Scroll</span>
          <div style={{ width: '1px', height: '24px', background: 'linear-gradient(to bottom, var(--text-secondary), transparent)' }} />
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: '52px 24px 40px' }}>
        <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '20px' }}>
          Why Laque
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { symbol: '✦', title: 'Full colour specs', desc: 'Every design comes with hex codes, gel brand & shade names, and finish type. No more vibes-only inspo.' },
            { symbol: '◈', title: 'Search & filter', desc: 'Filter by nail shape, length, technique, or occasion. From everyday to editorial.' },
            { symbol: '◇', title: 'Save & share', desc: 'Bookmark your favourites and share a direct link with your nail tech — no screenshotting required.' },
          ].map(f => (
            <div key={f.title} className="lq-feature">
              <span style={{ fontSize: '18px', color: 'var(--accent)', lineHeight: '1', marginTop: '3px', flexShrink: 0 }}>{f.symbol}</span>
              <div>
                <p style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '15px', marginBottom: '5px' }}>{f.title}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.65' }}>{f.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CREATOR / NAIL TECH ── */}
      <section style={{
        padding: '48px 24px 52px',
        position: 'relative', overflow: 'hidden',
        background: 'linear-gradient(160deg, rgba(212,160,192,0.07) 0%, rgba(212,160,192,0.02) 60%, transparent 100%)',
        borderTop: '0.5px solid rgba(212,160,192,0.22)',
        borderBottom: '0.5px solid rgba(212,160,192,0.22)',
      }}>
        <div style={{
          position: 'absolute', top: '-60px', right: '-80px',
          width: '240px', height: '240px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,160,192,0.15) 0%, transparent 70%)',
          animation: 'floatBlob 6s ease-in-out 0.5s infinite', pointerEvents: 'none',
        }} />

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          background: 'rgba(212,160,192,0.1)', border: '0.5px solid rgba(212,160,192,0.3)',
          borderRadius: '20px', padding: '5px 12px 5px 8px',
          width: 'fit-content', marginBottom: '22px',
        }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', flexShrink: 0 }} />
          <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.07em', textTransform: 'uppercase' }}>For nail artists & salons</span>
        </div>

        <h2 style={{ fontSize: 'clamp(28px, 8vw, 38px)', fontWeight: '600', color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: '1.15', marginBottom: '14px' }}>
          Publish your work.{' '}
          <span style={{ color: 'var(--accent)' }}>Get discovered.</span>
        </h2>

        <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: '1.65', marginBottom: '28px', maxWidth: '310px' }}>
          Get a free creator profile, post your sets with full specs, and reach clients who are already browsing for their next look.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '32px' }}>
          {[
            { icon: '◈', text: 'Free public portfolio — your work, your page' },
            { icon: '✦', text: 'Get found by clients browsing for inspo' },
            { icon: '◇', text: 'Post designs with colour codes & technique notes' },
          ].map(item => (
            <div key={item.text} className="lq-creator-row">
              <span style={{ color: 'var(--accent)', fontSize: '14px', flexShrink: 0 }}>{item.icon}</span>
              <span style={{ color: 'var(--text-primary)', fontSize: '13px', lineHeight: '1.45' }}>{item.text}</span>
            </div>
          ))}
        </div>

        <Link href="/profile" className="lq-cta-creator">
          Create a creator account
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: '40px 24px 56px', textAlign: 'center', borderTop: '0.5px solid var(--border)' }}>
        <p style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', letterSpacing: '-0.02em', lineHeight: '1.3', marginBottom: '10px' }}>
          Ready to find your next set?
        </p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px', lineHeight: '1.6' }}>
          Browse free. Save what you love.<br />Show your nail tech.
        </p>
        <Link href="/feed" className="lq-cta-primary" style={{ display: 'inline-flex' }}>
          Start exploring
          <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </section>
    </>
  )
}
