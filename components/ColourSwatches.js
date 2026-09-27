'use client'
import { useState, useRef, useEffect } from 'react'

function clean(value) {
  if (!value) return null
  if (value.toLowerCase() === 'optional') return null
  return value
}

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.3,
})
const WHITE60 = 'rgba(255,255,255,0.6)'

export default function ColourSwatches({ colours }) {
  const [copiedId, setCopiedId] = useState(null)
  const copiedTimer = useRef(null)

  useEffect(() => () => clearTimeout(copiedTimer.current), [])

  const copyHex = (hex, id) => {
    if (!hex) return
    navigator.clipboard.writeText(hex).then(() => {
      setCopiedId(id)
      clearTimeout(copiedTimer.current)
      copiedTimer.current = setTimeout(() => setCopiedId(null), 1500)
    })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {colours.map((colour) => {
        const brandName = clean(colour.brand_name)
        const brandCode = clean(colour.brand_code)
        return (
          <div key={colour.id} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            background: 'rgba(255,255,255,0.06)', borderRadius: '14px',
            padding: '12px', border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {/* Colour swatch — tap to copy hex */}
            <button
              onClick={() => copyHex(colour.hex_code, colour.id)}
              title={colour.hex_code ? (copiedId === colour.id ? 'Copied!' : 'Tap to copy') : ''}
              aria-label={colour.hex_code ? `Copy ${colour.hex_code}` : undefined}
              style={{
                width: '44px', height: '44px', borderRadius: '10px',
                background: colour.hex_code || '#333', flexShrink: 0,
                border: '1px solid rgba(255,255,255,0.15)', padding: 0,
                cursor: colour.hex_code ? 'pointer' : 'default',
                position: 'relative',
              }}
            >
              {copiedId === colour.id && (
                <span style={{
                  position: 'absolute', bottom: '52px', left: '50%',
                  transform: 'translateX(-50%)',
                  background: '#FF517F', color: 'var(--lq-white)',
                  ...ui(600, 10), padding: '3px 8px', borderRadius: '6px',
                  whiteSpace: 'nowrap', pointerEvents: 'none',
                }}>
                  Copied!
                </span>
              )}
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ ...ui(500, 14), margin: '0 0 6px' }}>
                {colour.colour_name || 'Unnamed'}
              </p>
              {colour.hex_code && (
                <p style={{ ...ui(400, 12, WHITE60), margin: '0 0 2px' }}>
                  <span style={{ opacity: 0.65 }}>Colour code: </span>{colour.hex_code}
                </p>
              )}
              {brandName && (
                <p style={{ ...ui(400, 12, WHITE60), margin: '0 0 2px' }}>
                  <span style={{ opacity: 0.65 }}>Brand: </span>{brandName}
                </p>
              )}
              {brandCode && (
                <p style={{ ...ui(400, 12, WHITE60), margin: '0 0 2px' }}>
                  <span style={{ opacity: 0.65 }}>Brand code: </span>{brandCode}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
