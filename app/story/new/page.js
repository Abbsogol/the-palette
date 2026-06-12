'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const TEXT_COLORS = ['#FFFFFF', '#000000', '#D4A0C0', '#FFE566', '#7EC8E3']
const FONT = "'DM Sans', sans-serif"

export default function NewStoryPage() {
  const router = useRouter()
  const [user, setUser]             = useState(null)
  const [step, setStep]             = useState('pick')   // 'pick' | 'edit' | 'caption'
  const [image, setImage]           = useState(null)
  const [previewSrc, setPreviewSrc] = useState(null)
  const [caption, setCaption]       = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]           = useState('')

  // Text editor state
  const [textItems, setTextItems]   = useState([])
  const [showInput, setShowInput]   = useState(false)
  const [inputText, setInputText]   = useState('')
  const [inputColor, setInputColor] = useState('#FFFFFF')
  const [activeId, setActiveId]     = useState(null)
  const editorRef  = useRef(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const flatFile   = useRef(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) router.replace('/profile')
      else setUser(session.user)
    })
  }, [])

  // ── Image pick ─────────────────────────────────────────────────────────
  const handleImagePick = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImage(file)
    if (previewSrc) URL.revokeObjectURL(previewSrc)
    setPreviewSrc(URL.createObjectURL(file))
    setTextItems([])
    flatFile.current = null
    setStep('edit')
    e.target.value = ''
  }

  // ── Text items ──────────────────────────────────────────────────────────
  const addText = () => {
    if (!inputText.trim()) return
    setTextItems(prev => [...prev, { id: Date.now(), text: inputText.trim(), x: 50, y: 45, color: inputColor }])
    setInputText('')
    setShowInput(false)
  }

  const removeText = (id) => setTextItems(prev => prev.filter(t => t.id !== id))

  // ── Drag text ───────────────────────────────────────────────────────────
  const startDrag = (e, id) => {
    e.preventDefault()
    e.stopPropagation()
    setActiveId(id)
    const touch = e.touches?.[0] || e
    const rect = editorRef.current.getBoundingClientRect()
    const item = textItems.find(t => t.id === id)
    dragOffset.current = {
      x: touch.clientX - rect.left - (item.x / 100) * rect.width,
      y: touch.clientY - rect.top  - (item.y / 100) * rect.height,
    }
  }

  const onDragMove = useCallback((e) => {
    if (activeId == null || !editorRef.current) return
    e.preventDefault()
    const touch = e.touches?.[0] || e
    const rect = editorRef.current.getBoundingClientRect()
    const nx = ((touch.clientX - rect.left - dragOffset.current.x) / rect.width)  * 100
    const ny = ((touch.clientY - rect.top  - dragOffset.current.y) / rect.height) * 100
    setTextItems(prev => prev.map(t => t.id === activeId
      ? { ...t, x: Math.max(4, Math.min(90, nx)), y: Math.max(4, Math.min(94, ny)) }
      : t
    ))
  }, [activeId])

  useEffect(() => {
    if (activeId == null) return
    const el = editorRef.current
    if (!el) return
    el.addEventListener('mousemove', onDragMove)
    el.addEventListener('touchmove', onDragMove, { passive: false })
    const stop = () => setActiveId(null)
    el.addEventListener('mouseup', stop)
    el.addEventListener('touchend', stop)
    return () => {
      el.removeEventListener('mousemove', onDragMove)
      el.removeEventListener('touchmove', onDragMove)
      el.removeEventListener('mouseup', stop)
      el.removeEventListener('touchend', stop)
    }
  }, [activeId, onDragMove])

  // ── Bake canvas ─────────────────────────────────────────────────────────
  const bakeAndContinue = () => {
    const el = editorRef.current
    const rect = el.getBoundingClientRect()
    const W = rect.width
    const H = rect.height
    const DPR = 2
    const canvas = document.createElement('canvas')
    canvas.width  = W * DPR
    canvas.height = H * DPR
    const ctx = canvas.getContext('2d')

    const img = new window.Image()
    img.onload = () => {
      // Cover-fill
      const s  = Math.max((W * DPR) / img.naturalWidth, (H * DPR) / img.naturalHeight)
      const iw = img.naturalWidth  * s
      const ih = img.naturalHeight * s
      ctx.drawImage(img, (W * DPR - iw) / 2, (H * DPR - ih) / 2, iw, ih)

      if (textItems.length > 0) {
        const fontSize = Math.round(W * DPR * 0.065)
        ctx.font = `600 ${fontSize}px DM Sans, sans-serif`
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        textItems.forEach(item => {
          ctx.shadowColor = 'rgba(0,0,0,0.7)'
          ctx.shadowBlur  = 16
          ctx.fillStyle   = item.color
          ctx.fillText(item.text, (item.x / 100) * W * DPR, (item.y / 100) * H * DPR)
        })
        ctx.shadowBlur = 0
      }

      canvas.toBlob(blob => {
        flatFile.current = new File([blob], 'story.jpg', { type: 'image/jpeg' })
        setStep('caption')
      }, 'image/jpeg', 0.92)
    }
    img.src = previewSrc
  }

  // ── Post ────────────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (!user) return
    setSubmitting(true)
    setError('')
    const fileToUpload = flatFile.current || image
    const path = `stories/${user.id}/${Date.now()}.jpg`

    const { error: uploadErr } = await supabase.storage
      .from('designs')
      .upload(path, fileToUpload, { upsert: false })
    if (uploadErr) { setError('Upload failed: ' + uploadErr.message); setSubmitting(false); return }

    const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(path)

    const { error: insertErr } = await supabase.from('stories').insert({
      user_id:   user.id,
      image_url: publicUrl,
      caption:   caption.trim() || null,
    })
    if (insertErr) { setError('Could not save story: ' + insertErr.message); setSubmitting(false); return }

    router.push('/feed')
  }

  if (!user) return null

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: PICK
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'pick') return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', padding: '52px 20px 40px' }}>
      <Link
        href="/feed"
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', marginBottom: '28px', fontFamily: FONT }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back
      </Link>

      <h1 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '600', letterSpacing: '-0.03em', marginBottom: '6px', fontFamily: FONT }}>New story</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px', fontFamily: FONT }}>Disappears in 24 hours</p>

      <label style={{ cursor: 'pointer', display: 'block' }}>
        <input type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />
        <div style={{
          border: '1.5px dashed rgba(212,160,192,0.3)',
          borderRadius: '20px',
          aspectRatio: '9/16', maxHeight: '66vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px',
          background: 'var(--bg-card)',
          transition: 'border-color 0.2s',
        }}>
          <div style={{ width: 60, height: 60, borderRadius: '50%', background: 'rgba(212,160,192,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
              <path d="M13 6V20M6 13H20" stroke="#D4A0C0" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontFamily: FONT }}>Tap to choose a photo</p>
        </div>
      </label>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: EDIT  (text overlay)
  // ══════════════════════════════════════════════════════════════════════════
  if (step === 'edit') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000' }}>

      {/* Permanent top gradient — buttons always readable */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 130,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)',
        zIndex: 5, pointerEvents: 'none',
      }} />

      {/* Permanent bottom gradient */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 100,
        background: 'linear-gradient(to top, rgba(0,0,0,0.55) 0%, transparent 100%)',
        zIndex: 5, pointerEvents: 'none',
      }} />

      {/* Full-bleed image + draggable text layer */}
      <div ref={editorRef} style={{ position: 'absolute', inset: 0 }}>
        <img
          src={previewSrc}
          alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
        />
        {textItems.map(item => (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              left: `${item.x}%`, top: `${item.y}%`,
              transform: 'translate(-50%, -50%)',
              color: item.color,
              fontSize: '23px', fontWeight: '700', fontFamily: FONT,
              textShadow: '0 2px 10px rgba(0,0,0,0.8)',
              cursor: 'grab', userSelect: 'none', touchAction: 'none',
              whiteSpace: 'pre-wrap', textAlign: 'center',
              maxWidth: '86vw', wordBreak: 'break-word',
              zIndex: 6,
            }}
            onMouseDown={e => startDrag(e, item.id)}
            onTouchStart={e => startDrag(e, item.id)}
          >
            {item.text}
            {/* × remove button */}
            <span
              onMouseDown={e => { e.stopPropagation(); removeText(item.id) }}
              onTouchStart={e => { e.stopPropagation(); e.preventDefault(); removeText(item.id) }}
              style={{
                position: 'absolute', top: -10, right: -18,
                width: 22, height: 22, borderRadius: '50%',
                background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.9)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', cursor: 'pointer',
              }}
            >×</span>
          </div>
        ))}
      </div>

      {/* ── Toolbar ───────────────────────────────────────────────────── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '52px 16px 0',
        zIndex: 10,
      }}>
        {/* Back */}
        <button
          onClick={() => setStep('pick')}
          style={{
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '0.5px solid rgba(255,255,255,0.15)',
            borderRadius: '22px', padding: '8px 16px',
            color: '#fff', fontSize: '13px', fontWeight: '500',
            cursor: 'pointer', fontFamily: FONT,
          }}
        >← Back</button>

        {/* Add text */}
        <button
          onClick={() => setShowInput(true)}
          style={{
            background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            border: '0.5px solid rgba(255,255,255,0.15)',
            borderRadius: '22px', padding: '8px 20px',
            color: '#fff', fontSize: '16px', fontWeight: '700',
            cursor: 'pointer', fontFamily: FONT,
            letterSpacing: '0.02em',
          }}
        >Aa</button>

        {/* Next */}
        <button
          onClick={bakeAndContinue}
          style={{
            background: '#D4A0C0',
            border: 'none',
            borderRadius: '22px', padding: '9px 20px',
            color: '#2C0A1E', fontSize: '13px', fontWeight: '700',
            cursor: 'pointer', fontFamily: FONT,
          }}
        >Next →</button>
      </div>

      {/* ── Text input overlay ─────────────────────────────────────── */}
      {showInput && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 20,
          background: 'rgba(0,0,0,0.78)',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 20, padding: '24px',
        }}>
          <input
            autoFocus
            type="text"
            placeholder="Type something..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addText()}
            style={{
              width: '100%', maxWidth: 340,
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.18)',
              borderRadius: '14px', padding: '15px 18px',
              color: inputColor, fontSize: '22px', fontWeight: '700',
              fontFamily: FONT, outline: 'none',
              textAlign: 'center',
              caretColor: inputColor,
            }}
          />

          {/* Colour swatches */}
          <div style={{ display: 'flex', gap: 14 }}>
            {TEXT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setInputColor(c)}
                style={{
                  width: 32, height: 32, borderRadius: '50%', background: c,
                  border: inputColor === c
                    ? '3px solid #D4A0C0'
                    : '2px solid rgba(255,255,255,0.2)',
                  cursor: 'pointer', flexShrink: 0,
                  boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
                  transition: 'border 0.12s',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 10, width: '100%', maxWidth: 340 }}>
            <button
              onClick={() => { setShowInput(false); setInputText('') }}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.08)',
                border: 'none', borderRadius: '12px', padding: '14px',
                color: '#fff', fontSize: '14px', cursor: 'pointer', fontFamily: FONT,
              }}
            >Cancel</button>
            <button
              onClick={addText}
              disabled={!inputText.trim()}
              style={{
                flex: 2,
                background: inputText.trim() ? '#D4A0C0' : 'rgba(255,255,255,0.1)',
                border: 'none', borderRadius: '12px', padding: '14px',
                color: inputText.trim() ? '#2C0A1E' : 'rgba(255,255,255,0.3)',
                fontSize: '14px', fontWeight: '700', cursor: inputText.trim() ? 'pointer' : 'default',
                fontFamily: FONT,
              }}
            >Add text</button>
          </div>
        </div>
      )}
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // STEP: CAPTION  (full-screen split layout)
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0d0d0d', display: 'flex', flexDirection: 'column' }}>

      {/* Top — image preview fills ~52vh */}
      <div style={{ flex: '0 0 52vh', position: 'relative', overflow: 'hidden' }}>
        <img
          src={previewSrc}
          alt="preview"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        {/* Gradient fade into bottom panel */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: 64,
          background: 'linear-gradient(to bottom, transparent, #0d0d0d)',
          pointerEvents: 'none',
        }} />
        {/* Back to edit button */}
        <button
          onClick={() => setStep('edit')}
          style={{
            position: 'absolute', top: 52, left: 16,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            border: '0.5px solid rgba(255,255,255,0.15)',
            borderRadius: '20px', padding: '8px 14px',
            color: '#fff', fontSize: '13px', fontWeight: '500',
            cursor: 'pointer', fontFamily: FONT,
          }}
        >← Edit</button>
      </div>

      {/* Bottom — caption form */}
      <div style={{ flex: 1, padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', gap: 14, overflowY: 'auto' }}>
        <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '500', fontFamily: FONT, margin: 0 }}>
          Add a caption
        </p>
        <textarea
          placeholder="Say something about your nails..."
          value={caption}
          onChange={e => setCaption(e.target.value)}
          maxLength={200}
          rows={3}
          autoFocus={false}
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '0.5px solid rgba(255,255,255,0.1)',
            borderRadius: '14px', padding: '14px 16px',
            color: 'var(--text-primary)', fontSize: '15px',
            fontFamily: FONT, outline: 'none',
            resize: 'none', lineHeight: '1.55',
          }}
        />
        {error && <p style={{ color: '#E07070', fontSize: '13px', fontFamily: FONT, margin: 0 }}>{error}</p>}

        <div style={{ flex: 1 }} />

        <button
          onClick={handlePost}
          disabled={submitting}
          style={{
            background: submitting ? 'rgba(212,160,192,0.5)' : '#D4A0C0',
            color: '#2C0A1E',
            border: 'none', borderRadius: '16px', padding: '16px',
            fontSize: '16px', fontWeight: '700', fontFamily: FONT,
            cursor: submitting ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.01em',
          }}
        >
          {submitting ? 'Posting...' : 'Post story'}
        </button>
      </div>
    </div>
  )
}
