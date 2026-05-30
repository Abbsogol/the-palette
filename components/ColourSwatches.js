'use client'
import { useState } from 'react'

function clean(value) {
  if (!value) return null
  if (value.toLowerCase() === 'optional') return null
  return value
}

export default function ColourSwatches({ colours }) {
  const [copiedId, setCopiedId] = useState(null)

  const copyHex = (hex, id) => {
    if (!hex) return
    navigator.clipboard.writeText(hex).then(() => {
      setCopiedId(id)
      setTimeout(() => setCopiedId(null), 1500)
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
            background: 'var(--bg-card)', borderRadius: '10px',
            padding: '12px', border: '0.5px solid var(--border)',
          }}>
            {/* Colour swatch — tap to copy hex */}
            <div
              onClick={() => copyHex(colour.hex_code, colour.id)}
              title={colour.hex_code ? (copiedId === colour.id ? 'Copied!' : 'Tap to copy') : ''}
              style={{
                width: '36px', height: '36px', borderRadius: '8px',
                background: colour.hex_code || '#333', flexShrink: 0,
                border: '0.5px solid rgba(255,255,255,0.1)',
                cursor: colour.hex_code ? 'pointer' : 'default',
                position: 'relative',
              }}
            >
              {copiedId === colour.id && (
                <span style={{
                  position: 'absolute', bottom: '44px', left: '50%',
                  transform: 'translateX(-50%)',
                  background: 'var(--accent)', color: '#2C0A1E',
                  fontSize: '10px', fontWeight: '600',
                  padding: '3px 8px', borderRadius: '6px',
                  whiteSpace: 'nowrap', pointerEvents: 'none',
                }}>
                  Copied!
                </span>
              )}
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                {colour.colour_name || 'Unnamed'}
              </p>
              {colour.hex_code && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '2px' }}>
                  <span style={{ opacity: 0.5 }}>Colour code: </span>{colour.hex_code}
                </p>
              )}
              {brandName && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '2px' }}>
                  <span style={{ opacity: 0.5 }}>Brand: </span>{brandName}
                </p>
              )}
              {brandCode && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '2px' }}>
                  <span style={{ opacity: 0.5 }}>Brand code: </span>{brandCode}
                </p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
