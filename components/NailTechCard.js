'use client'
import { useState } from 'react'

export default function NailTechCard({ design, colours }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const colourLines = (colours || [])
    .map(c => {
      let line = `• ${c.colour_name || 'Colour'}`
      if (c.hex_code) line += ` — ${c.hex_code}`
      if (c.brand_name && c.brand_code) line += ` (${c.brand_name}: ${c.brand_code})`
      else if (c.brand_name) line += ` (${c.brand_name})`
      return line
    })
    .join('\n')

  const specLines = [
    design.shape && `Shape: ${design.shape}`,
    design.length && `Length: ${design.length}`,
    design.technique && `Technique: ${design.technique}`,
    design.finish && `Finish: ${design.finish}`,
  ].filter(Boolean).join('\n')

  const shareText = [
    `💅 My nail inspo — ${design.title}`,
    '',
    specLines,
    colourLines ? `\nColours:\n${colourLines}` : '',
    '',
    `laque.app/design/${design.id}`,
  ].filter(s => s !== undefined).join('\n').trim()

  async function handleShare() {
    const url = `https://laque.app/design/${design.id}`
    if (navigator.share) {
      try {
        await navigator.share({ title: design.title, text: shareText, url })
      } catch (e) {
        // user cancelled or not supported — fall through to copy
        copyText()
      }
    } else {
      copyText()
    }
  }

  function copyText() {
    navigator.clipboard.writeText(shareText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        style={{
          width: '100%',
          padding: '14px',
          background: 'var(--accent)',
          color: '#141414',
          border: 'none',
          borderRadius: '12px',
          fontSize: '14px',
          fontWeight: '600',
          fontFamily: "'DM Sans', sans-serif",
          letterSpacing: '0.01em',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        Show My Nail Tech
      </button>

      {/* Modal overlay */}
      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 300,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            padding: '0 0 0 0',
          }}
        >
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '20px 20px 0 0',
            width: '100%',
            maxWidth: '480px',
            padding: '0 0 40px 0',
            maxHeight: '90vh',
            overflowY: 'auto',
          }}>

            {/* Handle bar */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 6px' }}>
              <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '2px' }} />
            </div>

            {/* Header */}
            <div style={{ padding: '8px 20px 20px', borderBottom: '0.5px solid var(--border)' }}>
              <p style={{
                color: 'var(--accent)',
                fontSize: '11px',
                fontWeight: '600',
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                marginBottom: '4px',
              }}>Show My Nail Tech</p>
              <h2 style={{
                color: 'var(--text-primary)',
                fontSize: '18px',
                fontWeight: '500',
                letterSpacing: '-0.02em',
                margin: 0,
              }}>{design.title}</h2>
            </div>

            {/* Design image */}
            {design.image_url && (
              <div style={{
                margin: '20px 20px 0',
                borderRadius: '12px',
                overflow: 'hidden',
                border: '0.5px solid var(--border)',
                background: 'var(--bg-chip)',
                height: '200px',
              }}>
                <img
                  src={design.image_url}
                  alt={design.title}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                />
              </div>
            )}

            {/* Specs */}
            {specLines && (
              <div style={{ padding: '20px 20px 0' }}>
                <p style={labelStyle}>Specs</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {[
                    design.shape && { label: design.shape },
                    design.length && { label: design.length },
                    ...(design.technique ? design.technique.split(',').map(t => ({ label: t.trim() })) : []),
                    design.finish && { label: design.finish },
                  ].filter(Boolean).map((s, i) => (
                    <span key={i} style={chipStyle}>{s.label}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Colours */}
            {colours && colours.length > 0 && (
              <div style={{ padding: '20px 20px 0' }}>
                <p style={labelStyle}>Colours</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {colours.map((c, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      background: 'var(--bg-primary)',
                      borderRadius: '10px',
                      padding: '10px 12px',
                      border: '0.5px solid var(--border)',
                    }}>
                      {/* Swatch */}
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '50%',
                        background: c.hex_code || '#888',
                        flexShrink: 0,
                        border: '1px solid rgba(255,255,255,0.1)',
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: '0 0 2px' }}>
                          {c.colour_name || 'Colour'}
                        </p>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          {c.hex_code && (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '12px', fontFamily: 'monospace' }}>
                              {c.hex_code}
                            </span>
                          )}
                          {c.brand_name && (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                              {c.brand_name}{c.brand_code ? ` ${c.brand_code}` : ''}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Note to nail tech (optional static hint) */}
            <div style={{
              margin: '20px 20px 0',
              background: 'var(--bg-primary)',
              borderRadius: '10px',
              padding: '12px 14px',
              border: '0.5px solid var(--border)',
            }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.6', margin: 0 }}>
                📎 Share this card with your nail tech or salon so they have everything they need.
              </p>
            </div>

            {/* Action buttons */}
            <div style={{ padding: '20px 20px 0', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleShare}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: 'var(--accent)',
                  color: '#141414',
                  border: 'none',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '600',
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
                  <polyline points="16 6 12 2 8 6"/>
                  <line x1="12" y1="2" x2="12" y2="15"/>
                </svg>
                Share with Nail Tech
              </button>

              <button
                onClick={copyText}
                style={{
                  width: '100%',
                  padding: '13px',
                  background: 'transparent',
                  color: copied ? 'var(--accent)' : 'var(--text-secondary)',
                  border: '0.5px solid var(--border)',
                  borderRadius: '12px',
                  fontSize: '14px',
                  fontWeight: '500',
                  fontFamily: "'DM Sans', sans-serif",
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'color 0.2s',
                }}
              >
                {copied ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    Copy specs as text
                  </>
                )}
              </button>
            </div>

          </div>
        </div>
      )}
    </>
  )
}

const labelStyle = {
  color: 'var(--accent)',
  fontSize: '11px',
  fontWeight: '600',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  marginBottom: '10px',
}

const chipStyle = {
  background: 'var(--bg-chip)',
  color: 'var(--text-secondary)',
  fontSize: '12px',
  fontWeight: '500',
  padding: '6px 12px',
  borderRadius: '20px',
  textTransform: 'capitalize',
}
