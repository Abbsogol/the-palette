'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const TEXT_COLORS = ['#FFFFFF', '#000000', '#D4A0C0', '#FFE566', '#7EC8E3']

export default function NewStoryPage() {
  const router = useRouter()
  const [user, setUser]       = useState(null)
  const [step, setStep]       = useState('pick')    // 'pick' | 'edit' | 'caption'
  const [image, setImage]     = useState(null)      // original File
  const [previewSrc, setPreviewSrc] = useState(null)
  const [caption, setCaption] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]     = useState('')

  // Editor state
  const [textItems, setTextItems] = useState([])    // [{id, text, x, y, color}]
  const [showInput, setShowInput] = useState(false)
  const [inputText, setInputText] = useState('')
  const [inputColor, setInputColor] = useState('#FFFFFF')
  const [activeId, setActiveId] = useState(null)
  const editorRef  = useRef(null)
  const dragOffset = useRef({ x: 0, y: 0 })
  const flatFile   = useRef(null)                   // canvas-baked File

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) router.replace('/profile')
      else setUser(session.user)
    })
  }, [])

  const handleImagePick = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImage(file)
    setPreviewSrc(URL.createObjectURL(file))
    setTextItems([])
    flatFile.current = null
    setStep('edit')
    e.target.value = ''
  }

  // ── Text add ────────────────────────────────────────────────────────────
  const addText = () => {
    if (!inputText.trim()) return
    setTextItems(prev => [...prev, {
      id: Date.now(),
      text: inputText.trim(),
      x: 50,
      y: 45,
      color: inputColor,
    }])
    setInputText('')
    setShowInput(false)
  }

  const removeText = (id) => setTextItems(prev => prev.filter(t => t.id !== id))

  // ── Drag ─────────────────────────────────────────────────────────────────
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
      ? { ...t, x: Math.max(2, Math.min(92, nx)), y: Math.max(2, Math.min(96, ny)) }
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

  // ── Bake text onto image ─────────────────────────────────────────────────
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
      // Cover-fit
      const scaleX = (W * DPR) / img.naturalWidth
      const scaleY = (H * DPR) / img.naturalHeight
      const s  = Math.max(scaleX, scaleY)
      const iw = img.naturalWidth  * s
      const ih = img.naturalHeight * s
      ctx.drawImage(img, (W * DPR - iw) / 2, (H * DPR - ih) / 2, iw, ih)

      // Text
      if (textItems.length > 0) {
        const fontSize = Math.round(W * DPR * 0.065)
        ctx.font = `600 ${fontSize}px "DM Sans", sans-serif`
        ctx.textAlign    = 'center'
        ctx.textBaseline = 'middle'
        textItems.forEach(item => {
          const tx = (item.x / 100) * W * DPR
          const ty = (item.y / 100) * H * DPR
          ctx.shadowColor = 'rgba(0,0,0,0.65)'
          ctx.shadowBlur  = 14
          ctx.fillStyle   = item.color
          ctx.fillText(item.text, tx, ty)
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

  // ── Post story ────────────────────────────────────────────────────────────
  const handlePost = async () => {
    if (!user) return
    const fileToUpload = flatFile.current || image
    setSubmitting(true)
    setError('')

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

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: pick
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'pick') return (
    <div style={{ padding: '24px 20px', paddingBottom: '40px' }}>
      <Link href="/feed" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: '500', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Back
      </Link>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', letterSpacing: '-0.02em', marginBottom: '4px' }}>Add to story</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>Disappears after 24 hours</p>
      <label style={{ cursor: 'pointer' }}>
        <input type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />
        <div style={{
          border: '1.5px dashed var(--border)', borderRadius: '16px',
          aspectRatio: '9/16', maxHeight: '65vh',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
          background: 'var(--bg-card)',
        }}>
          <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
            <rect x="4" y="4" width="24" height="24" rx="6" stroke="#D4A0C0" strokeWidth="1.5"/>
            <circle cx="12" cy="13" r="2.5" stroke="#D4A0C0" strokeWidth="1.5"/>
            <path d="M4 22L10 16L14 20L20 13L28 22" stroke="#D4A0C0" strokeWidth="1.5" strokeLinejoin="round"/>
          </svg>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Tap to choose photo</p>
        </div>
      </label>
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: edit (text overlay)
  // ─────────────────────────────────────────────────────────────────────────
  if (step === 'edit') return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#000', display: 'flex', flexDirection: 'column' }}>

      {/* Toolbar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '52px 16px 12px', zIndex: 10, pointerEvents: 'none' }}>
        <button
          onClick={() => setStep('pick')}
          style={{ background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '20px', padding: '8px 14px', color: '#fff', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", backdropFilter: 'blur(8px)', pointerEvents: 'auto' }}
        >← Back</button>
        <button
          onClick={() => setShowInput(true)}
          style={{ background: 'rgba(0,0,0,0.45)', border: 'none', borderRadius: '20px', padding: '8px 18px', color: '#fff', fontSize: '15px', fontWeight: '700', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", backdropFilter: 'blur(8px)', pointerEvents: 'auto', letterSpacing: '0.01em' }}
        >Aa</button>
        <button
          onClick={bakeAndContinue}
          style={{ background: '#D4A0C0', border: 'none', borderRadius: '20px', padding: '8px 18px', color: '#2C0A1E', fontSize: '13px', fontWeight: '700', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", pointerEvents: 'auto' }}
        >Next →</button>
      </div>

      {/* Image + draggable text */}
      <div ref={editorRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
        <img
          src={previewSrc}
          alt="story"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
        />
        {textItems.map(item => (
          <div
            key={item.id}
            style={{
              position: 'absolute',
              left: `${item.x}%`,
              top:  `${item.y}%`,
              transform: 'translate(-50%, -50%)',
              color: item.color,
              fontSize: '22px',
              fontWeight: '600',
              fontFamily: "'DM Sans', sans-serif",
              textShadow: '0 1px 8px rgba(0,0,0,0.7)',
              cursor: 'grab',
              userSelect: 'none',
              touchAction: 'none',
              whiteSpace: 'pre-wrap',
              textAlign: 'center',
              maxWidth: '88vw',
              wordBreak: 'break-word',
              zIndex: 2,
            }}
            onMouseDown={e => startDrag(e, item.id)}
            onTouchStart={e => startDrag(e, item.id)}
          >
            {item.text}
            <span
              onMouseDown={e => { e.stopPropagation(); removeText(item.id) }}
              onTouchStart={e => { e.stopPropagation(); e.preventDefault(); removeText(item.id) }}
              style={{
                position: 'absolute', top: '-10px', right: '-16px',
                fontSize: '13px', cursor: 'pointer',
                background: 'rgba(0,0,0,0.5)', color: 'rgba(255,255,255,0.9)',
                borderRadius: '50%', width: '20px', height: '20px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                lineHeight: 1,
              }}
            >×</span>
          </div>
        ))}
      </div>

      {/* Text input overlay */}
      {showInput && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 20, background: 'rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '18px', padding: '20px' }}>
          <input
            autoFocus
            type="text"
            placeholder="Type something..."
            value={inputText}
            onChange={e => setInputText(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addText()}
            style={{
              width: '100%', maxWidth: '340px',
              background: 'rgba(255,255,255,0.1)',
              border: '1px solid rgba(255,255,255,0.2)',
              borderRadius: '12px', padding: '14px 16px',
              color: inputColor, fontSize: '20px', fontWeight: '600',
              fontFamily: "'DM Sans', sans-serif", outline: 'none',
              textAlign: 'center', backdropFilter: 'blur(8px)',
            }}
          />
          {/* Color swatches */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {TEXT_COLORS.map(c => (
              <button
                key={c}
                onClick={() => setInputColor(c)}
                style={{
                  width: '28px', height: '28px', borderRadius: '50%',
                  background: c,
                  border: inputColor === c ? '3px solid #D4A0C0' : '2px solid rgba(255,255,255,0.25)',
                  cursor: 'pointer', flexShrink: 0,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                  transition: 'border 0.1s',
                }}
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '340px' }}>
            <button
              onClick={() => { setShowInput(false); setInputText('') }}
              style={{ flex: 1, background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '10px', padding: '13px', color: '#fff', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >Cancel</button>
            <button
              onClick={addText}
              disabled={!inputText.trim()}
              style={{ flex: 2, background: inputText.trim() ? '#D4A0C0' : 'rgba(255,255,255,0.12)', border: 'none', borderRadius: '10px', padding: '13px', color: inputText.trim() ? '#2C0A1E' : 'rgba(255,255,255,0.35)', fontSize: '14px', fontWeight: '600', cursor: inputText.trim() ? 'pointer' : 'not-allowed', fontFamily: "'DM Sans', sans-serif" }}
            >Add text</button>
          </div>
        </div>
      )}
    </div>
  )

  // ─────────────────────────────────────────────────────────────────────────
  // STEP: caption
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 20px', paddingBottom: '40px' }}>
      <button
        onClick={() => setStep('edit')}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '500', marginBottom: '24px', padding: 0, fontFamily: "'DM Sans', sans-serif" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        Edit
      </button>

      <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', letterSpacing: '-0.02em', marginBottom: '4px' }}>Almost done</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>Add a caption (optional)</p>

      {/* Preview thumbnail */}
      <div style={{ borderRadius: '12px', overflow: 'hidden', aspectRatio: '9/16', maxHeight: '42vh', marginBottom: '20px', background: '#000' }}>
        <img src={previewSrc} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <textarea
          placeholder="Add a caption..."
          value={caption}
          onChange={e => setCaption(e.target.value)}
          maxLength={200}
          rows={3}
          style={{
            background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: '12px', padding: '14px 16px',
            color: 'var(--text-primary)', fontSize: '14px',
            fontFamily: "'DM Sans', sans-serif", outline: 'none',
            resize: 'none', lineHeight: '1.5',
          }}
        />
        {error && <p style={{ color: '#E07070', fontSize: '13px' }}>{error}</p>}
        <button
          onClick={handlePost}
          disabled={submitting}
          style={{
            background: 'var(--accent)', color: '#2C0A1E',
            border: 'none', borderRadius: '14px', padding: '15px',
            fontSize: '15px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
            cursor: submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Posting...' : 'Post story'}
        </button>
      </div>
    </div>
  )
}
