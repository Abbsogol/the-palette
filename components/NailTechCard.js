'use client'
import { useState, useRef, useEffect } from 'react'
import Sheet from '@/components/ui/Sheet'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const WHITE85 = 'rgba(255,255,255,0.85)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })
const labelStyle = { ...ui(600, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }
const chipStyle = { background: 'rgba(255,255,255,0.06)', ...ui(500, 12, WHITE60), padding: '6px 12px', borderRadius: '1000px', textTransform: 'capitalize', border: PANEL_BORDER }

export default function NailTechCard({ design, colours, tags, renderTrigger }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef(null)

  useEffect(() => () => clearTimeout(copiedTimer.current), [])

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

  const tagLine = (tags && tags.length) ? `\nTags: ${tags.join(', ')}` : undefined

  const shareText = [
    `💅 My nail inspo — ${design.title}`,
    '',
    specLines,
    colourLines ? `\nColours:\n${colourLines}` : '',
    tagLine,
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
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <>
      {/* Trigger — caller-controlled chrome, or the default gradient CTA */}
      {renderTrigger ? renderTrigger({ open: () => setOpen(true) }) : (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: '100%', padding: '14px', background: BTN_GRADIENT, color: 'var(--lq-white)',
          border: 'none', borderRadius: '1000px', ...ui(600, 14),
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/>
          <polyline points="16 6 12 2 8 6"/>
          <line x1="12" y1="2" x2="12" y2="15"/>
        </svg>
        Show My Nail Tech
      </button>
      )}

      {/* Sheet */}
      {open && (
        <Sheet
          title="Show My Nail Tech"
          onClose={() => setOpen(false)}
          footer={
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                onClick={handleShare}
                style={{ width: '100%', padding: '14px', background: BTN_GRADIENT, color: 'var(--lq-white)', border: 'none', borderRadius: '1000px', ...ui(600, 14), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
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
                style={{ width: '100%', padding: '13px', background: 'transparent', ...ui(500, 14, copied ? ACCENT : WHITE60), border: PANEL_BORDER, borderRadius: '1000px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', transition: 'color 0.2s' }}
              >
                {copied ? (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
                    Copy specs as text
                  </>
                )}
              </button>
            </div>
          }
        >
          {/* Header */}
          <p style={{ ...ui(600, 11, ACCENT), letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Show My Nail Tech</p>
          <h2 style={{ ...display(22), margin: '0 0 16px' }}>{design.title}</h2>

          {/* Design image — natural, no crop */}
          {design.image_url && (
            <div style={{ borderRadius: '12px', overflow: 'hidden', border: PANEL_BORDER, background: PANEL, marginBottom: '20px' }}>
              <img
                src={design.image_url}
                alt={design.title}
                style={{ width: '100%', maxHeight: '340px', objectFit: 'contain', display: 'block' }}
              />
            </div>
          )}

          {/* Specs */}
          {specLines && (
            <div style={{ marginBottom: '20px' }}>
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
            <div style={{ marginBottom: '4px' }}>
              <p style={labelStyle}>Colours</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {colours.map((c, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '10px 12px', border: PANEL_BORDER }}>
                    {/* Swatch */}
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: c.hex_code || '#888', flexShrink: 0, border: '1px solid rgba(255,255,255,0.15)' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ ...ui(500, 13), margin: '0 0 2px' }}>{c.colour_name || 'Colour'}</p>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                        {c.hex_code && (
                          <span style={{ ...ui(400, 12, WHITE85), fontFamily: 'monospace' }}>{c.hex_code}</span>
                        )}
                        {c.brand_name && (
                          <span style={ui(400, 12, WHITE60)}>
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

          {/* Note to nail tech */}
          <div style={{ marginTop: '20px', background: 'rgba(255,255,255,0.04)', borderRadius: '12px', padding: '12px 14px', border: PANEL_BORDER }}>
            <p style={{ ...ui(300, 12, WHITE60), lineHeight: 1.6, margin: 0 }}>
              📎 Share this card with your nail tech or salon so they have everything they need.
            </p>
          </div>
        </Sheet>
      )}
    </>
  )
}
