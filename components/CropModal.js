'use client'

import { useState, useRef, useEffect } from 'react'

const CROP_SIZE = 280

export default function CropModal({ file, onCrop, onCancel }) {
  const [src, setSrc]       = useState(null)
  const [natural, setNatural] = useState({ w: 1, h: 1 })
  const [pos, setPos]       = useState({ x: 0, y: 0 })
  const [zoom, setZoom]     = useState(1)
  const dragging  = useRef(false)
  const lastPos   = useRef({ x: 0, y: 0 })
  const lastDist  = useRef(null)
  const objUrl    = useRef(null)

  useEffect(() => {
    if (!file) return
    const url = URL.createObjectURL(file)
    objUrl.current = url
    setSrc(url)
    const img = new window.Image()
    img.onload = () => setNatural({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  // At zoom=1 → shorter edge = CROP_SIZE
  const r     = natural.w / natural.h
  const baseW = r >= 1 ? CROP_SIZE * r : CROP_SIZE
  const baseH = r >= 1 ? CROP_SIZE     : CROP_SIZE / r
  const dw    = baseW * zoom
  const dh    = baseH * zoom
  const imgLeft = CROP_SIZE / 2 + pos.x - dw / 2
  const imgTop  = CROP_SIZE / 2 + pos.y - dh / 2

  // ── Touch handlers ────────────────────────────────────────────────────────
  const onTouchStart = (e) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      lastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      dragging.current = true
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
      setZoom(z => Math.max(0.5, Math.min(5, z * (dist / lastDist.current))))
      lastDist.current = dist
    }
  }

  const onTouchEnd = () => { dragging.current = false; lastDist.current = null }

  // ── Mouse handlers ────────────────────────────────────────────────────────
  const onMouseDown = (e) => { dragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY } }
  const onMouseMove = (e) => {
    if (!dragging.current) return
    setPos(p => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }
  const onMouseUp = () => { dragging.current = false }

  // ── Crop & export ─────────────────────────────────────────────────────────
  const handleCrop = () => {
    const OUTPUT = 400
    const canvas = document.createElement('canvas')
    canvas.width = OUTPUT
    canvas.height = OUTPUT
    const ctx = canvas.getContext('2d')

    // Circular clip
    ctx.beginPath()
    ctx.arc(OUTPUT / 2, OUTPUT / 2, OUTPUT / 2, 0, Math.PI * 2)
    ctx.clip()

    const img = new window.Image()
    img.onload = () => {
      // Source region in natural image pixels
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 300,
      background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'space-between',
      padding: '52px 20px 56px',
    }}>
      <p style={{ color: '#fff', fontSize: '15px', fontWeight: '500', letterSpacing: '-0.01em', fontFamily: "'DM Sans', sans-serif" }}>
        Drag & pinch to position
      </p>

      {/* Crop circle */}
      <div
        style={{
          position: 'relative', width: CROP_SIZE, height: CROP_SIZE,
          borderRadius: '50%', overflow: 'hidden',
          border: '2.5px solid rgba(212,160,192,0.8)',
          cursor: 'grab', flexShrink: 0,
          background: '#1a1a1a',
        }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
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

      {/* Zoom */}
      <div style={{ width: '100%', maxWidth: CROP_SIZE, display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: "'DM Sans', sans-serif" }}>Zoom</p>
        <input
          type="range" min="0.5" max="4" step="0.01" value={zoom}
          onChange={e => setZoom(parseFloat(e.target.value))}
          style={{ width: '100%', accentColor: '#D4A0C0' }}
        />
      </div>

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '12px', width: '100%', maxWidth: CROP_SIZE }}>
        <button onClick={onCancel} style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '12px', padding: '14px', color: '#fff', fontSize: '15px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          Cancel
        </button>
        <button onClick={handleCrop} style={{ flex: 2, background: '#D4A0C0', border: 'none', borderRadius: '12px', padding: '14px', color: '#2C0A1E', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
          Use Photo
        </button>
      </div>
    </div>
  )
}
