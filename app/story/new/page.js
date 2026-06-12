'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const F = "'DM Sans', sans-serif"
const COLORS = ['#FFFFFF', '#000000', '#D4A0C0', '#FFD166', '#06D6A0']

// ── Small reusable icon button (circular, frosted glass) ─────────────────────
function IconBtn({ onClick, children, style = {} }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 40, height: 40, borderRadius: '50%',
        background: 'rgba(0,0,0,0.42)',
        backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)',
        border: '0.5px solid rgba(255,255,255,0.18)',
        color: '#fff', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export default function NewStoryPage() {
  const router = useRouter()
  const [user, setUser]           = useState(null)
  const [step, setStep]           = useState('pick')
  const [previewSrc, setPreviewSrc] = useState(null)
  const [origFile, setOrigFile]   = useState(null)
  const [caption, setCaption]     = useState('')
  const [posting, setPosting]     = useState(false)
  const [err, setErr]             = useState('')

  // Editor
  const [items, setItems]         = useState([])   // [{id,text,x,y,color}]
  const [showInput, setShowInput] = useState(false)
  const [draft, setDraft]         = useState('')
  const [draftColor, setDraftColor] = useState('#FFFFFF')
  const [dragId, setDragId]       = useState(null)
  const editorRef  = useRef(null)
  const dragOff    = useRef({ x: 0, y: 0 })
  const bakedFile  = useRef(null)
  const fileRef    = useRef(null)

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
    setPreviewSrc(URL.createObjectURL(f))
    setItems([])
    bakedFile.current = null
    setStep('edit')
    e.target.value = ''
  }

  // ── Text items ────────────────────────────────────────────────────────────
  const addItem = () => {
    if (!draft.trim()) return
    setItems(p => [...p, { id: Date.now(), text: draft.trim(), x: 50, y: 50, color: draftColor }])
    setDraft('')
    setShowInput(false)
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

  // ── Bake canvas ───────────────────────────────────────────────────────────
  const bake = () => {
    const el = editorRef.current
    const { width: W, height: H } = el.getBoundingClientRect()
    const D = 2
    const cv = document.createElement('canvas')
    cv.width = W * D; cv.height = H * D
    const ctx = cv.getContext('2d')
    const img = new window.Image()
    img.onload = () => {
      const s = Math.max((W * D) / img.naturalWidth, (H * D) / img.naturalHeight)
      ctx.drawImage(img,
        (W * D - img.naturalWidth * s) / 2,
        (H * D - img.naturalHeight * s) / 2,
        img.naturalWidth * s, img.naturalHeight * s
      )
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
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#000',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* X to go back */}
      <div style={{ position: 'absolute', top: 52, left: 16, zIndex: 10 }}>
        <IconBtn onClick={() => router.push('/feed')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4L12 12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </IconBtn>
      </div>

      {/* Full-screen tap area */}
      <label style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 16 }}>
        <input ref={fileRef} type="file" accept="image/*" onChange={onPick} style={{ display: 'none' }} />
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          border: '1.5px solid rgba(255,255,255,0.2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <path d="M14 7V21M7 14H21" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </div>
        <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '15px', fontFamily: F, margin: 0 }}>
          Tap to choose a photo
        </p>
      </label>
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════
  // EDIT  — full-screen, TikTok-style
  // ════════════════════════════════════════════════════════════════════════
  if (step === 'edit') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', overflow: 'hidden' }}>

      {/* ── Image + text layer ─────────────────────────────────────── */}
      <div ref={editorRef} style={{ position: 'absolute', inset: 0 }}>
        <img
          src={previewSrc} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
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
              maxWidth: '84vw', wordBreak: 'break-word',
              zIndex: 4,
            }}
            onMouseDown={e => startDrag(e, item.id)}
            onTouchStart={e => startDrag(e, item.id)}
          >
            {item.text}
            <span
              onMouseDown={e => { e.stopPropagation(); removeItem(item.id) }}
              onTouchStart={e => { e.stopPropagation(); e.preventDefault(); removeItem(item.id) }}
              style={{
                position: 'absolute', top: -10, right: -18,
                width: 20, height: 20, borderRadius: '50%',
                background: 'rgba(0,0,0,0.65)', color: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 12, cursor: 'pointer',
              }}
            >×</span>
          </div>
        ))}
      </div>

      {/* ── Top gradient (always readable) ─────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 110,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.52) 0%, transparent 100%)',
        pointerEvents: 'none', zIndex: 5,
      }} />

      {/* ── Top bar: ← Back  |  Next → ─────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 52, left: 16, right: 16,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        zIndex: 10,
      }}>
        {/* Back — X icon */}
        <IconBtn onClick={() => setStep('pick')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M12 4L4 12M4 4L12 12" stroke="white" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </IconBtn>

        {/* Next — white pill, TikTok-style */}
        <button
          onClick={bake}
          style={{
            background: '#fff', color: '#000',
            border: 'none', borderRadius: '22px',
            padding: '10px 22px',
            fontSize: 14, fontWeight: 700, fontFamily: F,
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}
        >
          Next
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 2L10 7L5 12" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* ── Right-side tools (TikTok vertical strip) ────────────────── */}
      <div style={{
        position: 'absolute', right: 14, top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {/* Text tool */}
        <IconBtn onClick={() => setShowInput(true)}>
          <span style={{ fontSize: 14, fontWeight: 800, fontFamily: F, letterSpacing: '-0.02em' }}>Aa</span>
        </IconBtn>
      </div>

      {/* ── Text input panel ────────────────────────────────────────── */}
      {showInput && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'rgba(0,0,0,0.82)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          padding: '0 20px',
          gap: 20,
        }}>
          {/* Text input — styled to match the text color */}
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
              border: 'none',
              borderBottom: `2px solid ${draftColor}`,
              color: draftColor,
              fontSize: 26, fontWeight: 700, fontFamily: F,
              outline: 'none', textAlign: 'center',
              padding: '8px 0',
              caretColor: draftColor,
            }}
          />

          {/* Colour dots */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setDraftColor(c)}
                style={{
                  width: draftColor === c ? 34 : 28,
                  height: draftColor === c ? 34 : 28,
                  borderRadius: '50%',
                  background: c,
                  border: draftColor === c ? '2.5px solid rgba(255,255,255,0.9)' : '1.5px solid rgba(255,255,255,0.25)',
                  cursor: 'pointer', flexShrink: 0,
                  transition: 'all 0.12s',
                }}
              />
            ))}
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 340 }}>
            <button
              onClick={() => { setShowInput(false); setDraft('') }}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.1)',
                border: 'none', borderRadius: 12, padding: '13px 0',
                color: 'rgba(255,255,255,0.75)', fontSize: 14, fontFamily: F, cursor: 'pointer',
              }}
            >Cancel</button>
            <button
              onClick={addItem}
              disabled={!draft.trim()}
              style={{
                flex: 2,
                background: draft.trim() ? '#D4A0C0' : 'rgba(255,255,255,0.08)',
                border: 'none', borderRadius: 12, padding: '13px 0',
                color: draft.trim() ? '#2C0A1E' : 'rgba(255,255,255,0.25)',
                fontSize: 14, fontWeight: 700, fontFamily: F,
                cursor: draft.trim() ? 'pointer' : 'default',
              }}
            >Add</button>
          </div>
        </div>
      )}
    </div>
  )

  // ════════════════════════════════════════════════════════════════════════
  // CAPTION  — clean confirm screen
  // ════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#0a0a0a',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '52px 16px 16px',
        gap: 12, flexShrink: 0,
      }}>
        <IconBtn onClick={() => setStep('edit')}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </IconBtn>
        <p style={{ color: '#fff', fontSize: 17, fontWeight: 600, fontFamily: F, margin: 0 }}>
          New story
        </p>
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'hidden auto', display: 'flex', flexDirection: 'column', padding: '0 20px 40px', gap: 16 }}>

        {/* Story preview — centered, proportional */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <img
            src={previewSrc}
            alt="preview"
            style={{
              height: '52vh',
              width: 'auto',
              maxWidth: '100%',
              borderRadius: 16,
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>

        {/* Caption */}
        <textarea
          placeholder="Add a caption..."
          value={caption}
          onChange={e => setCaption(e.target.value)}
          maxLength={200}
          rows={3}
          style={{
            background: 'rgba(255,255,255,0.06)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: 14, padding: '14px 16px',
            color: '#F5EDE0', fontSize: 15, fontFamily: F,
            outline: 'none', resize: 'none', lineHeight: 1.55,
            flexShrink: 0,
          }}
        />

        {err && <p style={{ color: '#E07070', fontSize: 13, fontFamily: F, margin: 0 }}>{err}</p>}

        {/* Post button */}
        <button
          onClick={post}
          disabled={posting}
          style={{
            background: posting ? 'rgba(212,160,192,0.45)' : '#D4A0C0',
            color: '#2C0A1E',
            border: 'none', borderRadius: 16, padding: '16px 0',
            fontSize: 16, fontWeight: 700, fontFamily: F,
            cursor: posting ? 'not-allowed' : 'pointer',
            flexShrink: 0, marginTop: 4,
          }}
        >
          {posting ? 'Posting...' : 'Post to story'}
        </button>
      </div>
    </div>
  )
}
