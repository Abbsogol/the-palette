'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const F = "'DM Sans', sans-serif"
const COLORS = ['#FFFFFF', '#000000', '#D4A0C0', '#FFD166', '#06D6A0']

function IconBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{
      width: 40, height: 40, borderRadius: '50%',
      background: 'rgba(0,0,0,0.45)',
      backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
      border: '0.5px solid rgba(255,255,255,0.2)',
      color: '#fff', cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexShrink: 0,
    }}>
      {children}
    </button>
  )
}

function NextPill({ onClick, label = 'Next' }) {
  return (
    <button onClick={onClick} style={{
      background: '#fff', color: '#000',
      border: 'none', borderRadius: 22,
      padding: '10px 22px',
      fontSize: 14, fontWeight: 700, fontFamily: F,
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', gap: 5,
    }}>
      {label}
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
        <path d="M5 2L10 7L5 12" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

export default function NewStoryPage() {
  const router = useRouter()
  const [user, setUser]             = useState(null)
  // flow: pick → crop → edit → caption
  const [step, setStep]             = useState('pick')
  const [previewSrc, setPreviewSrc] = useState(null)
  const [origFile, setOrigFile]     = useState(null)
  const [imgNat, setImgNat]         = useState({ w: 1, h: 1 })

  // Crop state
  const [cropPan, setCropPan]   = useState({ x: 0, y: 0 })
  const [cropZoom, setCropZoom] = useState(1)
  const cropDragging   = useRef(false)
  const cropLastPos    = useRef({ x: 0, y: 0 })
  const cropPinchDist  = useRef(null)

  // Text editor
  const [items, setItems]         = useState([])
  const [showInput, setShowInput] = useState(false)
  const [draft, setDraft]         = useState('')
  const [draftColor, setDraftColor] = useState('#FFFFFF')
  const [dragId, setDragId]       = useState(null)
  const editorRef = useRef(null)
  const dragOff   = useRef({ x: 0, y: 0 })

  // Post
  const [caption, setCaption]     = useState('')
  const [posting, setPosting]     = useState(false)
  const [err, setErr]             = useState('')
  const bakedFile = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) router.replace('/profile')
      else setUser(session.user)
    })
  }, [])

  // ── Pick ──────────────────────────────────────────────────────────────────
  const onPick = (e) => {
    const f = e.target.files[0]
    if (!f) return
    setOrigFile(f)
    if (previewSrc) URL.revokeObjectURL(previewSrc)
    const url = URL.createObjectURL(f)
    setPreviewSrc(url)
    // Load natural dimensions
    const img = new window.Image()
    img.onload = () => setImgNat({ w: img.naturalWidth, h: img.naturalHeight })
    img.src = url
    // Reset crop
    setCropPan({ x: 0, y: 0 })
    setCropZoom(1)
    setItems([])
    bakedFile.current = null
    setStep('crop')
    e.target.value = ''
  }

  // ── Crop touch handlers ───────────────────────────────────────────────────
  const onCropTouchStart = (e) => {
    e.preventDefault()
    if (e.touches.length === 1) {
      cropDragging.current = true
      cropLastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      cropPinchDist.current = null
    } else if (e.touches.length === 2) {
      cropDragging.current = false
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      cropPinchDist.current = Math.sqrt(dx * dx + dy * dy)
    }
  }

  const onCropTouchMove = (e) => {
    e.preventDefault()
    if (e.touches.length === 1 && cropDragging.current) {
      const dx = e.touches[0].clientX - cropLastPos.current.x
      const dy = e.touches[0].clientY - cropLastPos.current.y
      setCropPan(p => ({ x: p.x + dx, y: p.y + dy }))
      cropLastPos.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    } else if (e.touches.length === 2 && cropPinchDist.current != null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX
      const dy = e.touches[0].clientY - e.touches[1].clientY
      const dist = Math.sqrt(dx * dx + dy * dy)
      setCropZoom(z => Math.max(0.5, Math.min(5, z * (dist / cropPinchDist.current))))
      cropPinchDist.current = dist
    }
  }

  const onCropTouchEnd = () => {
    cropDragging.current = false
    cropPinchDist.current = null
  }

  // Mouse fallback for desktop
  const onCropMouseDown = (e) => { cropDragging.current = true; cropLastPos.current = { x: e.clientX, y: e.clientY } }
  const onCropMouseMove = (e) => {
    if (!cropDragging.current) return
    setCropPan(p => ({ x: p.x + e.clientX - cropLastPos.current.x, y: p.y + e.clientY - cropLastPos.current.y }))
    cropLastPos.current = { x: e.clientX, y: e.clientY }
  }
  const onCropMouseUp = () => { cropDragging.current = false }

  // ── Text items ────────────────────────────────────────────────────────────
  const addItem = () => {
    if (!draft.trim()) return
    setItems(p => [...p, { id: Date.now(), text: draft.trim(), x: 50, y: 50, color: draftColor }])
    setDraft(''); setShowInput(false)
  }
  const removeItem = (id) => setItems(p => p.filter(t => t.id !== id))

  const startDrag = (e, id) => {
    e.preventDefault(); e.stopPropagation()
    setDragId(id)
    const t = e.touches?.[0] || e
    const r = editorRef.current.getBoundingClientRect()
    const item = items.find(i => i.id === id)
    dragOff.current = {
      x: t.clientX - r.left - (item.x / 100) * r.width,
      y: t.clientY - r.top  - (item.y / 100) * r.height,
    }
  }

  const onDragMove = useCallback((e) => {
    if (dragId == null || !editorRef.current) return
    e.preventDefault()
    const t = e.touches?.[0] || e
    const r = editorRef.current.getBoundingClientRect()
    const nx = ((t.clientX - r.left - dragOff.current.x) / r.width)  * 100
    const ny = ((t.clientY - r.top  - dragOff.current.y) / r.height) * 100
    setItems(p => p.map(i => i.id === dragId
      ? { ...i, x: Math.max(4, Math.min(90, nx)), y: Math.max(4, Math.min(94, ny)) }
      : i
    ))
  }, [dragId])

  useEffect(() => {
    if (dragId == null) return
    const el = editorRef.current; if (!el) return
    const stop = () => setDragId(null)
    el.addEventListener('mousemove', onDragMove)
    el.addEventListener('touchmove', onDragMove, { passive: false })
    el.addEventListener('mouseup', stop)
    el.addEventListener('touchend', stop)
    return () => {
      el.removeEventListener('mousemove', onDragMove)
      el.removeEventListener('touchmove', onDragMove)
      el.removeEventListener('mouseup', stop)
      el.removeEventListener('touchend', stop)
    }
  }, [dragId, onDragMove])

  // ── Bake (applies cropPan + cropZoom) ─────────────────────────────────────
  const bake = () => {
    const el = editorRef.current
    const { width: W, height: H } = el.getBoundingClientRect()
    const D = 2
    const cv = document.createElement('canvas')
    cv.width = W * D; cv.height = H * D
    const ctx = cv.getContext('2d')
    const img = new window.Image()
    img.onload = () => {
      // Cover scale + user crop pan/zoom
      const s0 = Math.max((W * D) / img.naturalWidth, (H * D) / img.naturalHeight)
      const s  = s0 * cropZoom
      const ox = (W * D - img.naturalWidth  * s) / 2 + cropPan.x * D
      const oy = (H * D - img.naturalHeight * s) / 2 + cropPan.y * D
      ctx.drawImage(img, ox, oy, img.naturalWidth * s, img.naturalHeight * s)

      if (items.length) {
        const fs = Math.round(W * D * 0.065)
        ctx.font = `700 ${fs}px DM Sans, sans-serif`
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        items.forEach(({ x, y, color, text }) => {
          ctx.shadowColor = 'rgba(0,0,0,0.75)'; ctx.shadowBlur = 14
          ctx.fillStyle = color
          ctx.fillText(text, (x / 100) * W * D, (y / 100) * H * D)
        })
        ctx.shadowBlur = 0
      }

      cv.toBlob(blob => {
        bakedFile.current = new File([blob], 'story.jpg', { type: 'image/jpeg' })
        setStep('caption')
      }, 'image/jpeg', 0.92)
    }
    img.src = previewSrc
  }

  // ── Post ──────────────────────────────────────────────────────────────────
  const post = async () => {
    if (!user) return
    setPosting(true); setErr('')
    const file = bakedFile.current || origFile
    const path = `stories/${user.id}/${Date.now()}.jpg`
    const { error: upErr } = await supabase.storage.from('designs').upload(path, file, { upsert: false })
    if (upErr) { setErr('Upload failed: ' + upErr.message); setPosting(false); return }
    const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(path)
    const { error: insErr } = await supabase.from('stories').insert({
      user_id: user.id, image_url: publicUrl, caption: caption.trim() || null,
    })
    if (insErr) { setErr('Could not save: ' + insErr.message); setPosting(false); return }
    router.push('/feed')
  }

  if (!user) return null

  // ════════════════════════════════════════════════════════════════════════
  // PICK
  // ════════════════════════════════════════════════════════════════════════
  if (step === 'pick') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', display: 'flex', flexDirection: 'column' }}>
      <div style={{ position: 'absolute', top: 52, left: 16, zIndex: 10 }}>
        <IconBtn onClick={() => router.push('/feed')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4L12 12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </IconBtn>
      </div>
      <label style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 14 }}>
        <input type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
        <div style={{ width: 68, height: 68, borderRadius: '50%', border: '1.5px solid rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
            <path d="M13 6V20M6 13H20" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 15, fontFamily: F, margin: 0 }}>Tap to choose a photo</p>
      </label>
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════
  // CROP  — drag to pan, pinch/slider to zoom
  // ════════════════════════════════════════════════════════════════════════
  if (step === 'crop') {
    const CW = typeof window !== 'undefined' ? window.innerWidth  : 390
    const CH = typeof window !== 'undefined' ? window.innerHeight : 844
    const s0 = Math.max(CW / imgNat.w, CH / imgNat.h)
    const s  = s0 * cropZoom
    const iw = imgNat.w * s
    const ih = imgNat.h * s
    const ix = CW / 2 + cropPan.x - iw / 2
    const iy = CH / 2 + cropPan.y - ih / 2

    return (
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', overflow: 'hidden', touchAction: 'none', cursor: 'grab', userSelect: 'none' }}
        onTouchStart={onCropTouchStart}
        onTouchMove={onCropTouchMove}
        onTouchEnd={onCropTouchEnd}
        onMouseDown={onCropMouseDown}
        onMouseMove={onCropMouseMove}
        onMouseUp={onCropMouseUp}
        onMouseLeave={onCropMouseUp}
      >
        {/* Image — freely panned/zoomed */}
        {previewSrc && (
          <img
            src={previewSrc}
            draggable={false}
            style={{
              position: 'absolute',
              width: iw, height: ih,
              left: ix, top: iy,
              pointerEvents: 'none', userSelect: 'none',
            }}
          />
        )}

        {/* Top gradient */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110, background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)', pointerEvents: 'none', zIndex: 5 }} />
        {/* Bottom gradient */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 130, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', pointerEvents: 'none', zIndex: 5 }} />

        {/* Top bar */}
        <div style={{ position: 'absolute', top: 52, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <IconBtn onClick={() => setStep('pick')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </IconBtn>
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: F, margin: 0, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Move and scale
          </p>
          <NextPill onClick={() => setStep('edit')} label="Done" />
        </div>

        {/* Bottom: zoom slider */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 28px 52px', zIndex: 10, display: 'flex', alignItems: 'center', gap: 12, pointerEvents: 'none' }}>
          {/* small icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="6" cy="6" r="5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
            <path d="M10 10L13 13" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <input
            type="range" min="0.5" max="4" step="0.01" value={cropZoom}
            onChange={e => setCropZoom(parseFloat(e.target.value))}
            style={{ flex: 1, accentColor: '#D4A0C0', pointerEvents: 'auto' }}
          />
          {/* large icon */}
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
            <circle cx="9" cy="9" r="7" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
            <path d="M14 14L18 18" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </div>
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // EDIT  — add text, drag items
  // ════════════════════════════════════════════════════════════════════════
  if (step === 'edit') {
    // Compute image position with stored crop values (for live preview)
    const CW = typeof window !== 'undefined' ? window.innerWidth  : 390
    const CH = typeof window !== 'undefined' ? window.innerHeight : 844
    const s0 = Math.max(CW / imgNat.w, CH / imgNat.h)
    const s  = s0 * cropZoom
    const iw = imgNat.w * s
    const ih = imgNat.h * s
    const ix = CW / 2 + cropPan.x - iw / 2
    const iy = CH / 2 + cropPan.y - ih / 2

    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', overflow: 'hidden' }}>

        {/* Top gradient */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110, background: 'linear-gradient(to bottom, rgba(0,0,0,0.52), transparent)', pointerEvents: 'none', zIndex: 5 }} />

        {/* Image + text layer */}
        <div ref={editorRef} style={{ position: 'absolute', inset: 0 }}>
          <img
            src={previewSrc} alt=""
            style={{
              position: 'absolute',
              width: iw, height: ih,
              left: ix, top: iy,
              pointerEvents: 'none',
            }}
          />
          {items.map(item => (
            <div
              key={item.id}
              style={{
                position: 'absolute',
                left: `${item.x}%`, top: `${item.y}%`,
                transform: 'translate(-50%,-50%)',
                color: item.color,
                fontSize: 24, fontWeight: 700, fontFamily: F,
                textShadow: '0 2px 12px rgba(0,0,0,0.85)',
                cursor: 'grab', userSelect: 'none', touchAction: 'none',
                whiteSpace: 'pre-wrap', textAlign: 'center',
                maxWidth: '84vw', wordBreak: 'break-word', zIndex: 4,
              }}
              onMouseDown={e => startDrag(e, item.id)}
              onTouchStart={e => startDrag(e, item.id)}
            >
              {item.text}
              <span
                onMouseDown={e => { e.stopPropagation(); removeItem(item.id) }}
                onTouchStart={e => { e.stopPropagation(); e.preventDefault(); removeItem(item.id) }}
                style={{ position: 'absolute', top: -10, right: -18, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.65)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, cursor: 'pointer' }}
              >×</span>
            </div>
          ))}
        </div>

        {/* Top bar */}
        <div style={{ position: 'absolute', top: 52, left: 16, right: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <IconBtn onClick={() => setStep('crop')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M12 4L4 12M4 4L12 12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </IconBtn>
          <NextPill onClick={bake} />
        </div>

        {/* Right tools */}
        <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Text */}
          <IconBtn onClick={() => setShowInput(true)}>
            <span style={{ fontSize: 13, fontWeight: 800, fontFamily: F }}>Aa</span>
          </IconBtn>
          {/* Back to crop */}
          <IconBtn onClick={() => setStep('crop')}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="2" width="5" height="5" rx="1" stroke="white" strokeWidth="1.5"/>
              <rect x="9" y="9" width="5" height="5" rx="1" stroke="white" strokeWidth="1.5"/>
              <path d="M7 4H10C11.1 4 12 4.9 12 6V9" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </IconBtn>
        </div>

        {/* Text input panel */}
        {showInput && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.82)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', gap: 20 }}>
            <input
              autoFocus
              type="text"
              placeholder="Add text..."
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              style={{
                width: '100%', maxWidth: 340,
                background: 'transparent',
                border: 'none', borderBottom: `2px solid ${draftColor}`,
                color: draftColor, fontSize: 26, fontWeight: 700, fontFamily: F,
                outline: 'none', textAlign: 'center', padding: '8px 0', caretColor: draftColor,
              }}
            />
            <div style={{ display: 'flex', gap: 14 }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setDraftColor(c)} style={{
                  width: draftColor === c ? 34 : 28, height: draftColor === c ? 34 : 28,
                  borderRadius: '50%', background: c,
                  border: draftColor === c ? '2.5px solid rgba(255,255,255,0.9)' : '1.5px solid rgba(255,255,255,0.25)',
                  cursor: 'pointer', flexShrink: 0, transition: 'all 0.12s',
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 340 }}>
              <button onClick={() => { setShowInput(false); setDraft('') }} style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 12, padding: '13px 0', color: 'rgba(255,255,255,0.75)', fontSize: 14, fontFamily: F, cursor: 'pointer' }}>Cancel</button>
              <button onClick={addItem} disabled={!draft.trim()} style={{ flex: 2, background: draft.trim() ? '#D4A0C0' : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: 12, padding: '13px 0', color: draft.trim() ? '#2C0A1E' : 'rgba(255,255,255,0.25)', fontSize: 14, fontWeight: 700, fontFamily: F, cursor: draft.trim() ? 'pointer' : 'default' }}>Add</button>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ════════════════════════════════════════════════════════════════════════
  // CAPTION
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#0a0a0a', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '52px 16px 16px', gap: 12, flexShrink: 0 }}>
        <IconBtn onClick={() => setStep('edit')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </IconBtn>
        <p style={{ color: '#fff', fontSize: 17, fontWeight: 600, fontFamily: F, margin: 0 }}>New story</p>
      </div>

      <div style={{ flex: 1, overflow: 'hidden auto', display: 'flex', flexDirection: 'column', padding: '0 20px 40px', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img src={previewSrc} alt="preview" style={{ height: '52vh', width: 'auto', maxWidth: '100%', borderRadius: 16, objectFit: 'cover', display: 'block' }} />
        </div>
        <textarea
          placeholder="Add a caption..."
          value={caption}
          onChange={e => setCaption(e.target.value)}
          maxLength={200} rows={3}
          style={{ background: 'rgba(255,255,255,0.06)', border: '0.5px solid rgba(255,255,255,0.1)', borderRadius: 14, padding: '14px 16px', color: '#F5EDE0', fontSize: 15, fontFamily: F, outline: 'none', resize: 'none', lineHeight: 1.55, flexShrink: 0 }}
        />
        {err && <p style={{ color: '#E07070', fontSize: 13, fontFamily: F, margin: 0 }}>{err}</p>}
        <div style={{ flex: 1 }} />
        <button onClick={post} disabled={posting} style={{ background: posting ? 'rgba(212,160,192,0.45)' : '#D4A0C0', color: '#2C0A1E', border: 'none', borderRadius: 16, padding: '16px 0', fontSize: 16, fontWeight: 700, fontFamily: F, cursor: posting ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
          {posting ? 'Posting...' : 'Post to story'}
        </button>
      </div>
    </div>
  )
}
