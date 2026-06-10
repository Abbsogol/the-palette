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
      .limit(14)
      .then(({ data }) => setDesigns(data || []))
  }, [])

  const marquee = [...designs, ...designs]

  return (
    <>
      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes floatBlob {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-14px) scale(1.04); }
        }
        @keyframes marqueeScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        @keyframes pulseGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(212,160,192,0.35); }
          50%       { box-shadow: 0 0 0 10px rgba(212,160,192,0); }
        }
        @keyframes spinDot {
          from { transform: rotate(0deg) translateX(7px); }
          to   { transform: rotate(360deg) translateX(7px); }
        }
        .lq-cta-primary {
          background: var(--accent);
          color: #2C0A1E;
          padding: 14px 24px;
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
        .lq-stat {
          background: var(--bg-card);
          border: 0.5px solid var(--border);
          border-radius: 20px;
          padding: 5px 11px;
          font-size: 11px;
          color: var(--text-secondary);
          white-space: nowrap;
          font-family: 'DM Sans', sans-serif;
        }
      `}</style>

      {/* ── HERO ── */}
      <section style={{
        minHeight: 'calc(100vh - 80px)',
        padding: '64px 24px 48px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}>

        {/* Background glow blob */}
        <div style={{
          position: 'absolute',
          top: '10%',
          right: '-80px',
          width: '260px',
          height: '260px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,160,192,0.1) 0%, transparent 70%)',
          animation: 'floatBlob 5s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          bottom: '12%',
          left: '-60px',
          width: '180px',
          height: '180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,160,192,0.06) 0%, transparent 70%)',
          animation: 'floatBlob 7s ease-in-out 1s infinite',
          pointerEvents: 'none',
        }} />

        {/* Beta badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '7px',
          background: 'var(--bg-chip)',
          border: '0.5px solid var(--border)',
          borderRadius: '20px',
          padding: '5px 12px 5px 8px',
          width: 'fit-content',
          marginBottom: '24px',
          animation: 'fadeUp 0.5s ease 0.05s both',
        }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: 'var(--accent)', display: 'inline-block',
            flexShrink: 0,
          }} />
          <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            Beta
          </span>
        </div>

        {/* Main title */}
        <h1 style={{
          fontSize: 'clamp(64px, 18vw, 80px)',
          fontWeight: '500',
          color: 'var(--text-primary)',
          letterSpacing: '-0.04em',
          lineHeight: '0.93',
          marginBottom: '22px',
          animation: 'fadeUp 0.6s ease 0.15s both',
        }}>
          Laque
        </h1>

        {/* Tagline */}
        <p style={{
          fontSize: '19px',
          fontWeight: '400',
          color: 'var(--text-secondary)',
          lineHeight: '1.55',
          marginBottom: '36px',
          maxWidth: '290px',
          animation: 'fadeUp 0.6s ease 0.28s both',
        }}>
          Your next nail set,{' '}
          <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>fully specced.</span>
          <br />
          Show your nail tech exactly what you want.
        </p>

        {/* CTA buttons */}
        <div style={{
          display: 'flex',
          gap: '10px',
          flexWrap: 'wrap',
          animation: 'fadeUp 0.6s ease 0.42s both',
        }}>
          <Link href="/feed" className="lq-cta-primary">
            Explore designs
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
          <Link href="/profile" className="lq-cta-secondary">
            Sign up free
          </Link>
        </div>

        {/* Stat chips */}
        <div style={{
          display: 'flex',
          gap: '8px',
          flexWrap: 'wrap',
          marginTop: '28px',
          animation: 'fadeUp 0.6s ease 0.55s both',
        }}>
          {['100+ designs', 'Free to browse', 'No download needed'].map(s => (
            <span key={s} className="lq-stat">{s}</span>
          ))}
        </div>
      </section>

      {/* ── MARQUEE STRIP ── */}
      {marquee.length > 0 && (
        <div style={{
          overflow: 'hidden',
          borderTop: '0.5px solid var(--border)',
          borderBottom: '0.5px solid var(--border)',
          padding: '14px 0',
          background: 'var(--bg-card)',
        }}>
          <div style={{
            display: 'flex',
            gap: '12px',
            width: 'max-content',
            animation: 'marqueeScroll 28s linear infinite',
          }}>
            {marquee.map((d, i) => (
              <div key={`${d.id}-${i}`} style={{
                width: '110px',
                height: '110px',
                borderRadius: '10px',
                overflow: 'hidden',
                flexShrink: 0,
                border: '0.5px solid var(--border)',
                background: 'var(--bg-primary)',
              }}>
                {d.image_url && (
                  <img
                    src={d.image_url}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── FEATURES ── */}
      <section style={{ padding: '52px 24px 40px' }}>
        <p style={{
          color: 'var(--accent)',
          fontSize: '11px',
          fontWeight: '500',
          letterSpacing: '0.09em',
          textTransform: 'uppercase',
          marginBottom: '20px',
        }}>
          Why Laque
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            {
              symbol: '✦',
              title: 'Full colour specs',
              desc: 'Every design comes with hex codes, gel brand & shade names, and finish type. No more vibes-only inspo.',
            },
            {
              symbol: '◈',
              title: 'Search & filter',
              desc: 'Filter by nail shape, length, technique, or occasion. From everyday to editorial.',
            },
            {
              symbol: '◇',
              title: 'Save & share',
              desc: 'Bookmark your favourites and share a direct link with your nail tech — no screenshotting required.',
            },
          ].map(f => (
            <div key={f.title} className="lq-feature">
              <span style={{
                fontSize: '18px',
                color: 'var(--accent)',
                lineHeight: '1',
                marginTop: '3px',
                flexShrink: 0,
              }}>
                {f.symbol}
              </span>
              <div>
                <p style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '15px', marginBottom: '5px' }}>
                  {f.title}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.65' }}>
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{
        padding: '32px 24px 56px',
        textAlign: 'center',
        borderTop: '0.5px solid var(--border)',
      }}>
        <p style={{
          color: 'var(--text-primary)',
          fontSize: '22px',
          fontWeight: '500',
          letterSpacing: '-0.02em',
          lineHeight: '1.3',
          marginBottom: '10px',
        }}>
          Ready to find your next set?
        </p>
        <p style={{
          color: 'var(--text-secondary)',
          fontSize: '14px',
          marginBottom: '28px',
          lineHeight: '1.6',
        }}>
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
