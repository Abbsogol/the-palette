'use client'

import { useState, useRef, useEffect } from 'react'

const CROP_SIZE = 320   // circle diameter in px
const ACCENT = '#FF517F'

// NOTE: this overlay deliberately does NOT use the shared Sheet primitive.
// The whole screen is a pan/pinch-zoom crop surface (touchAction: none), so
// the Sheet's swipe-down-to-close would fight the crop drag. It's a separate
// implementation on purpose — but it carries the same a11y contract by hand:
// aria-modal dialog, Escape closes, focus in on open + returned on close,
// body scroll locked while open. (Logged in OVERLAY-INVENTORY.md.)
export default function CropModal({ file, onCrop, onCancel }) {
  const [src, setSrc]         = useState(null)
  const [natural, setNatural] = useState({ w: 1, h: 1 })
  const [pos, setPos]         = useState({ x: 0, y: 0 })
  const [zoom, setZoom]       = useState(1)
  const [ready, setReady]     = useState(false)
  const [cropping, setCropping] = useState(false)
  const dragging  = useRef(false)
  const lastPos   = useRef({ x: 0, y: 0 })
  const lastDist  = useRef(null)
  const objUrl    = useRef(null)
  const panelRef  = useRef(null)
  const onCancelRef = useRef(onCancel)
  onCancelRef.current = onCancel

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    objUrl.current = url
    setSrc(url)
    const img = new window.Image()
    img.onload = () => {
      setNatural({ w: img.naturalWidth, h: img.naturalHeight })
      setReady(true)
    }
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // A11y contract (mount only): focus in + return, Escape closes, scroll lock.
  useEffect(() => {
    const prevFocus = document.activeElement
    panelRef.current?.focus()
    const onKey = (e) => { if (e.key === 'Escape') onCancelRef.current() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      if (prevFocus?.focus) prevFocus.focus()
    }
  }, [])

  // Image geometry — at zoom=1 the shorter edge fills CROP_SIZE
  const r     = natural.w / natural.h
  const baseW = r >= 1 ? CROP_SIZE * r : CROP_SIZE
  const baseH = r >= 1 ? CROP_SIZE     : CROP_SIZE / r
  const dw    = baseW * zoom
  const dh    = baseH * zoom
  const imgLeft = CROP_SIZE / 2 + pos.x - dw / 2
  const imgTop  = CROP_SIZE / 2 + pos.y - dh / 2

  // ── Touch ─────────────────────────────────────────────────────────────────
  const onTouchStart = (e) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      dragging.current = true
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      lastDist.current = Math.sqrt(dx * dx + dy * dy)
    }
  }

  const onTouchMove = (e) => {
    e.preventDefault()
    if (e.touches.length === 1 && dragging.current) {
      const dx = e.touches[0].clientX - lastPos.current.x
      const dy = e.touches[0].clientY - lastPos.current.y
      setPos(p => ({ x: p.x + dx, y: p.y + dy }))
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2 && lastDist.current != null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      setZoom(z => Math.max(0.5, Math.min(6, z * (dist / lastDist.current))))
      lastDist.current = dist
    }
  }

  const onTouchEnd = () => { dragging.current = false; lastDist.current = null }

  // ── Mouse ─────────────────────────────────────────────────────────────────
  const onMouseDown = (e) => { dragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY } }
  const onMouseMove = (e) => {
    if (!dragging.current) return
    setPos(p => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseUp = () => { dragging.current = false }

  // ── Export ────────────────────────────────────────────────────────────────
  const handleCrop = () => {
    if (cropping) return
    setCropping(true)
    const OUTPUT = 400
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')

    ctx.beginPath()
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
    ctx.clip()

    const img = new window.Image()
    img.onload = () => {
      const sx = (-imgLeft / dw) * natural.w
      const sy = (-imgTop  / dh) * natural.h
      const sw = (CROP_SIZE / dw) * natural.w
      const sh = (CROP_SIZE / dh) * natural.h
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUTPUT, OUTPUT)
      canvas.toBlob(blob => {
        onCrop(new File([blob], 'avatar.jpg', { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.93)
    }
    img.src = objUrl.current
  }

  return (
    /*
      The ENTIRE screen is the drag area — no more tiny circle hitbox.
      The circle is visual-only (pointerEvents: none).
      Events are captured on the outer full-screen div.
    */
    <div
      ref={panelRef}
      role="dialog"
      aria-modal="true"
      aria-label="Crop photo"
      tabIndex={-1}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: '#0A0508',
        touchAction: 'none',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        cursor: 'grab',
        outline: 'none',
        display: 'flex', flexDirection: 'column',
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* ── Top bar ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: 'calc(env(safe-area-inset-top) + 20px) 20px 0',
        zIndex: 10,
        pointerEvents: 'none',
      }}>
        <button
          onClick={onCancel}
          style={{
            pointerEvents: 'auto',
            background: 'none', border: 'none',
            fontFamily: 'var(--lq-font-ui)', fontWeight: 400, fontSize: '15px', color: 'rgba(255,255,255,0.65)',
            cursor: 'pointer', padding: '8px 0',
          }}
        >Cancel</button>
        <p style={{
          fontFamily: 'var(--lq-font-ui)', fontWeight: 400, fontSize: '12px', color: 'rgba(255,255,255,0.4)',
          letterSpacing: '0.04em', textTransform: 'uppercase',
          margin: 0,
        }}>Drag anywhere · Pinch to zoom</p>
        <div style={{ width: 56 }} />
      </div>

      {/* ── Crop circle — visual only, no pointer events ─────────────── */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -54%)',   // slightly above center to make room for controls
        width: CROP_SIZE, height: CROP_SIZE,
        borderRadius: '50%', overflow: 'hidden',
        border: '2px solid rgba(255,255,255,0.5)',
        background: '#1A0E13',
        pointerEvents: 'none',
        zIndex: 2,
        opacity: ready ? 1 : 0,
        transition: 'opacity 0.2s',
      }}>
        {src && (
          <img
            src={src}
            draggable={false}
            style={{
              position: 'absolute',
              width: dw, height: dh,
              left: imgLeft, top: imgTop,
              userSelect: 'none', pointerEvents: 'none',
            }}
          />
        )}
      </div>

      {/* ── Bottom controls ──────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '0 24px calc(env(safe-area-inset-bottom) + 32px)',
        zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '18px',
        pointerEvents: 'none',
      }}>
        {/* Zoom slider */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          pointerEvents: 'auto',
        }}>
          {/* Small magnifier */}
          <svg width="15" height="15" viewBox="0 0 15 15" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="6.5" cy="6.5" r="5.5" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
            <path d="M11 11L14 14" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="range" min="0.5" max="5" step="0.01" value={zoom}
            onChange={e => setZoom(parseFloat(e.target.value))}
            aria-label="Zoom"
            style={{ flex: 1, accentColor: ACCENT }}
          />
          {/* Large magnifier */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5"/>
            <path d="M14 14L18 18" stroke="rgba(255,255,255,0.3)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Use Photo button */}
        <button
          onClick={handleCrop}
          disabled={cropping}
          style={{
            pointerEvents: 'auto',
            background: 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)',
            border: 'none',
            borderRadius: '1000px', padding: '17px',
            fontFamily: 'var(--lq-font-ui)', fontWeight: 600, fontSize: '16px', color: 'var(--lq-white)',
            cursor: cropping ? 'default' : 'pointer',
            opacity: cropping ? 0.7 : 1,
          }}
        >{cropping ? 'Processing…' : 'Use Photo'}</button>
      </div>
    </div>
  )
}
