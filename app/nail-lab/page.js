'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SaveToBoard from '@/components/SaveToBoard'

const VIBES = ['Minimal', 'Moody', 'Dark', 'Coastal', 'Glam', 'Y2K', 'Bridal', 'Abstract', 'Floral', 'Pastel', 'Edgy', 'Clean Girl']
const SHAPES = ['Almond', 'Stiletto', 'Coffin', 'Square', 'Oval', 'Squoval']
const LENGTHS = ['Short', 'Medium', 'Long', 'Extra Long']
const OCCASIONS = ['Everyday', 'Date Night', 'Wedding', 'Work', 'Festival', 'Birthday', 'Holiday', 'Party']

const PRESET_COLORS = [
  // Nudes & naturals
  { hex: '#F5EDE3', label: 'Bone' },
  { hex: '#F0DCC8', label: 'Almond' },
  { hex: '#E8C4A0', label: 'Peach Nude' },
  { hex: '#C9A882', label: 'Caramel' },
  { hex: '#A67C5B', label: 'Tawny' },
  { hex: '#7B5240', label: 'Mocha' },
  // Pinks
  { hex: '#FFD6E0', label: 'Baby Pink' },
  { hex: '#F5A8C0', label: 'Blush' },
  { hex: '#F07098', label: 'Rose' },
  { hex: '#E83875', label: 'Hot Pink' },
  { hex: '#C8006A', label: 'Fuchsia' },
  // Reds
  { hex: '#E84040', label: 'Red' },
  { hex: '#C02020', label: 'Cherry' },
  { hex: '#7A0020', label: 'Burgundy' },
  // Purples
  { hex: '#D8C8F0', label: 'Lavender' },
  { hex: '#B094D8', label: 'Lilac' },
  { hex: '#7D4FBF', label: 'Violet' },
  { hex: '#4B0082', label: 'Deep Grape' },
  // Blues
  { hex: '#C8D8F0', label: 'Ice Blue' },
  { hex: '#6890D8', label: 'Periwinkle' },
  { hex: '#1450A8', label: 'Cobalt' },
  { hex: '#0A2050', label: 'Navy' },
  // Greens
  { hex: '#B0C8A8', label: 'Sage' },
  { hex: '#70C890', label: 'Mint' },
  { hex: '#2D7040', label: 'Forest' },
  { hex: '#6B7040', label: 'Olive' },
  // Metallics
  { hex: '#D4AF37', label: 'Gold' },
  { hex: '#C0C0C0', label: 'Silver' },
  { hex: '#C48B8B', label: 'Rose Gold' },
  // Darks & neutrals
  { hex: '#2A2828', label: 'Charcoal' },
  { hex: '#141414', label: 'Black' },
  { hex: '#FFFFFF', label: 'White' },
]

// Color section category labels (for display separators)
const COLOR_CATEGORIES = [
  { label: 'Nudes', start: 0, count: 6 },
  { label: 'Pinks', start: 6, count: 5 },
  { label: 'Reds', start: 11, count: 3 },
  { label: 'Purples', start: 14, count: 4 },
  { label: 'Blues', start: 18, count: 4 },
  { label: 'Greens', start: 22, count: 4 },
  { label: 'Metallics', start: 26, count: 3 },
  { label: 'Darks', start: 29, count: 3 },
]

function hsvToHex(h, s, v) {
  s /= 100; v /= 100;
  const k = (n) => (n + h / 60) % 6;
  const f = (n) => v * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
  const r = Math.round(f(5) * 255);
  const g = Math.round(f(3) * 255);
  const b = Math.round(f(1) * 255);
  return '#' + [r, g, b].map(x => x.toString(16).padStart(2, '0')).join('');
}

function ColorPicker({ onAdd, disabled }) {
  const [hue, setHue] = useState(320)
  const [sv, setSV] = useState({ s: 60, v: 85 })
  const canvasRef = useRef(null)
  const dragging = useRef(false)

  const currentHex = hsvToHex(hue, sv.s, sv.v)

  // Draw SV canvas whenever hue changes
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const w = canvas.width
    const h = canvas.height
    // Left→right: white to hue
    const gradH = ctx.createLinearGradient(0, 0, w, 0)
    gradH.addColorStop(0, 'white')
    gradH.addColorStop(1, `hsl(${hue}, 100%, 50%)`)
    ctx.fillStyle = gradH
    ctx.fillRect(0, 0, w, h)
    // Top→bottom: transparent to black
    const gradV = ctx.createLinearGradient(0, 0, 0, h)
    gradV.addColorStop(0, 'rgba(0,0,0,0)')
    gradV.addColorStop(1, 'rgba(0,0,0,1)')
    ctx.fillStyle = gradV
    ctx.fillRect(0, 0, w, h)
  }, [hue])

  const pickFromEvent = useCallback((e) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    const clientY = e.touches ? e.touches[0].clientY : e.clientY
    const x = Math.max(0, Math.min(clientX - rect.left, rect.width))
    const y = Math.max(0, Math.min(clientY - rect.top, rect.height))
    setSV({
      s: Math.round((x / rect.width) * 100),
      v: Math.round((1 - y / rect.height) * 100),
    })
  }, [])

  // Determine checkmark color based on brightness
  const isLight = sv.v > 70 && sv.s < 30
  const checkColor = isLight ? '#141414' : '#ffffff'

  return (
    <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* SV canvas */}
      <div style={{ position: 'relative', borderRadius: '10px', overflow: 'hidden', touchAction: 'none', userSelect: 'none' }}>
        <canvas
          ref={canvasRef}
          width={320}
          height={160}
          style={{ width: '100%', height: '150px', display: 'block', borderRadius: '10px', cursor: 'crosshair' }}
          onMouseDown={(e) => { dragging.current = true; pickFromEvent(e) }}
          onMouseMove={(e) => { if (dragging.current) pickFromEvent(e) }}
          onMouseUp={() => { dragging.current = false }}
          onMouseLeave={() => { dragging.current = false }}
          onTouchStart={(e) => { e.preventDefault(); dragging.current = true; pickFromEvent(e) }}
          onTouchMove={(e) => { e.preventDefault(); pickFromEvent(e) }}
          onTouchEnd={() => { dragging.current = false }}
        />
        {/* Crosshair cursor */}
        <div style={{
          position: 'absolute',
          left: `${sv.s}%`,
          top: `${100 - sv.v}%`,
          transform: 'translate(-50%, -50%)',
          width: '16px', height: '16px',
          borderRadius: '50%',
          border: '2px solid white',
          boxShadow: '0 0 0 1.5px rgba(0,0,0,0.5)',
          pointerEvents: 'none',
          background: currentHex,
        }} />
      </div>

      {/* Hue slider */}
      <div>
        <style>{`
          .hue-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 16px; border-radius: 8px; outline: none; cursor: pointer; background: linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%); border: none; }
          .hue-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 22px; height: 22px; border-radius: 50%; background: white; border: 2px solid rgba(0,0,0,0.3); box-shadow: 0 1px 4px rgba(0,0,0,0.3); cursor: pointer; }
          .hue-slider::-moz-range-thumb { width: 22px; height: 22px; border-radius: 50%; background: white; border: 2px solid rgba(0,0,0,0.3); cursor: pointer; }
        `}</style>
        <input
          type="range" min="0" max="360"
          value={hue}
          onChange={e => setHue(Number(e.target.value))}
          className="hue-slider"
        />
      </div>

      {/* Preview + hex + Add */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: currentHex, border: '1.5px solid var(--border)', flexShrink: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} />
        <div style={{ flex: 1 }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'monospace', margin: '0 0 2px', letterSpacing: '0.04em' }}>{currentHex.toUpperCase()}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>H {hue}° · S {sv.s}% · B {sv.v}%</p>
        </div>
        <button
          onClick={() => onAdd(currentHex)}
          disabled={disabled}
          style={{
            background: disabled ? 'var(--bg-chip)' : 'var(--accent)',
            color: disabled ? 'var(--text-secondary)' : '#2C0A1E',
            border: 'none', borderRadius: '10px',
            padding: '10px 20px', fontSize: '13px', fontWeight: '600',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: "'DM Sans', sans-serif", flexShrink: 0,
          }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

function Section({ title, required, children }) {
  return (
    <div style={{ padding: '0 20px', marginBottom: '28px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
        <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", letterSpacing: '-0.01em' }}>
          {title}
        </p>
        {required && <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '600' }}>Required</span>}
        {!required && <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Optional</span>}
      </div>
      {children}
    </div>
  )
}

function Chip({ label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? 'var(--accent)' : 'var(--bg-card)',
        color: active ? '#2C0A1E' : 'var(--text-secondary)',
        border: active ? 'none' : '0.5px solid var(--border)',
        borderRadius: '20px',
        padding: '8px 16px',
        fontSize: '13px',
        fontWeight: active ? '600' : '400',
        fontFamily: "'DM Sans', sans-serif",
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.15s',
      }}
    >
      {label}
    </button>
  )
}

export default function NailLabPage() {
  const [currentUser, setCurrentUser] = useState(null)
  const [credits, setCredits] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)

  // Builder state
  const [vibes, setVibes] = useState([])
  const [shape, setShape] = useState('')
  const [length, setLength] = useState('')
  const [colors, setColors] = useState([])
  const [customHex, setCustomHex] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [occasions, setOccasions] = useState([])
  const [customText, setCustomText] = useState('')

  // Reference designs
  const [showRefPicker, setShowRefPicker] = useState(false)
  const [allDesigns, setAllDesigns] = useState([])
  const [refDesigns, setRefDesigns] = useState([]) // selected reference design objects

  // Generation
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState(null)
  const [genError, setGenError] = useState(null)

  // Result screen actions
  const [freeRegenUsed, setFreeRegenUsed] = useState(false)
  const [rootGenerationId, setRootGenerationId] = useState(null)
  const [publishedDesignId, setPublishedDesignId] = useState(null)
  const [publishStatus, setPublishStatus] = useState(null) // null | 'draft' | 'published'
  const [showNailTechSheet, setShowNailTechSheet] = useState(false)
  const [showPublishSheet, setShowPublishSheet] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [showSaveBoard, setShowSaveBoard] = useState(false)
  const [savingToBoard, setSavingToBoard] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoadingUser(false); return }
      setCurrentUser(session.user)
      const { data: profile } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', session.user.id)
        .single()
      setCredits(profile?.credit_balance ?? 0)
      setLoadingUser(false)
    }
    load()
  }, [])

  const loadDesigns = async () => {
    if (allDesigns.length > 0) return
    const { data } = await supabase
      .from('designs')
      .select('id, title, image_url, shape, occasion')
      .eq('is_published', true)
      .eq('is_curated', true)
      .order('created_at', { ascending: false })
      .limit(60)
    setAllDesigns(data || [])
  }

  const toggleRefDesign = (design) => {
    setRefDesigns(prev => {
      const exists = prev.find(d => d.id === design.id)
      if (exists) return prev.filter(d => d.id !== design.id)
      if (prev.length >= 4) return prev
      return [...prev, design]
    })
  }

  const toggleColor = (hex) => {
    setColors(prev => {
      if (prev.includes(hex)) return prev.filter(c => c !== hex)
      if (prev.length >= 4) return prev
      return [...prev, hex]
    })
  }

  const addCustomHex = () => {
    const h = customHex.startsWith('#') ? customHex : '#' + customHex
    if (/^#[0-9A-Fa-f]{6}$/.test(h) && !colors.includes(h) && colors.length < 4) {
      setColors(prev => [...prev, h])
      setCustomHex('')
    }
  }

  const addFromPicker = (hex) => {
    if (!colors.includes(hex) && colors.length < 4) {
      setColors(prev => [...prev, hex])
    }
  }

  const toggleVibe = (v) => setVibes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  const toggleOccasion = (o) => setOccasions(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o])

  const canGenerate = vibes.length > 0 && shape && length && currentUser && credits >= 1 && !generating

  const callGenerateAPI = async (freeRegen = false, parentId = null) => {
    setGenerating(true)
    setGenError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/generate-nail-design', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          vibe: vibes, shape, length, colors,
          occasion: occasions,
          customText: customText || null,
          referenceImageUrls: refDesigns.map(d => d.image_url).filter(Boolean),
          freeRegen,
          parentGenerationId: parentId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setResult(data)
      if (!parentId) setRootGenerationId(data.generationId)
      if (!freeRegen) setCredits(data.creditsRemaining)
      setPublishedDesignId(null)
      setPublishStatus(null)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return true
    } catch (e) {
      setGenError(e.message)
      return false
    } finally {
      setGenerating(false)
    }
  }

  const generate = async () => {
    if (!canGenerate) return
    setResult(null)
    setFreeRegenUsed(false)
    setRootGenerationId(null)
    await callGenerateAPI(false, null)
  }

  const regen = async (free = false) => {
    if (generating) return
    if (free && freeRegenUsed) return
    if (!free && credits < 1) return
    const ok = await callGenerateAPI(free, rootGenerationId)
    if (free && ok) setFreeRegenUsed(true)
  }

  // nail-lab is a private bucket; publishing needs to copy the file into the
  // public designs bucket and create/update the designs row, all via a
  // service-role backend route (the designs table's write policies aren't
  // reliably reachable from the anon client for this cross-bucket flow).
  const publishGeneration = async (asDraft) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/publish-nail-lab-generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ generationId: result.generationId, designId: publishedDesignId, asDraft }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save design')
    return data
  }

  const ensureDesignId = async () => {
    if (publishedDesignId) return publishedDesignId
    try {
      const data = await publishGeneration(true)
      setPublishedDesignId(data.designId)
      setPublishStatus('draft')
      return data.designId
    } catch (e) {
      alert(e.message || 'Failed to save design')
      return null
    }
  }

  const publishDesign = async (asDraft) => {
    setPublishing(true)
    try {
      const data = await publishGeneration(asDraft)
      setPublishedDesignId(data.designId)
      setPublishStatus(data.isPublished ? 'published' : 'draft')
    } catch (e) {
      alert(e.message || 'Failed to save design')
    } finally {
      setPublishing(false)
      setShowPublishSheet(false)
    }
  }

  const resetResult = () => {
    setResult(null)
    setPublishedDesignId(null)
    setPublishStatus(null)
    setFreeRegenUsed(false)
    setRootGenerationId(null)
    setShowSaveBoard(false)
    setShowNailTechSheet(false)
    setShowPublishSheet(false)
  }

  // ── LOADING ───────────────────────────────────────────────────────────────
  if (loadingUser) {
    return (
      <div style={{ padding: '48px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
      </div>
    )
  }

  // ── NOT SIGNED IN ─────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <div style={{ padding: '64px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <div style={{ fontSize: '40px', marginBottom: '4px' }}>✦</div>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '600', letterSpacing: '-0.02em', margin: 0 }}>Nail Lab</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', maxWidth: '280px', margin: 0 }}>
          Sign in to generate custom nail designs with AI.
        </p>
        <Link href="/profile" style={{ marginTop: '8px', display: 'inline-block', background: 'var(--accent)', color: '#2C0A1E', borderRadius: '14px', padding: '13px 32px', fontSize: '14px', fontWeight: '600', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
          Sign in
        </Link>
      </div>
    )
  }

  // ── RESULT VIEW ───────────────────────────────────────────────────────────
  if (result) {
    return (
      <div style={{ paddingBottom: '120px' }}>

        {/* ── NAIL TECH SHEET ── */}
        {showNailTechSheet && (
          <div onClick={() => setShowNailTechSheet(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.7)' }}
          >
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg-primary)', borderRadius: '20px 20px 0 0', padding: '0 0 48px', maxHeight: '80vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>
                <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '2px' }} />
              </div>
              <div style={{ padding: '12px 20px 16px', borderBottom: '0.5px solid var(--border)' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>Design Specs</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '3px 0 0' }}>Share this with your nail tech</p>
              </div>
              <div style={{ padding: '8px 20px' }}>
                {[
                  { label: 'Vibe', value: vibes.join(', ') },
                  { label: 'Shape', value: shape },
                  { label: 'Length', value: length },
                  occasions.length > 0 ? { label: 'Occasion', value: occasions.join(', ') } : null,
                  customText ? { label: 'Notes', value: customText } : null,
                ].filter(Boolean).map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '13px 0', borderBottom: '0.5px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>{label}</span>
                    <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif", textAlign: 'right', maxWidth: '220px' }}>{value}</span>
                  </div>
                ))}
                {colors.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '0.5px solid var(--border)' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>Colours</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {colors.map(hex => (
                        <div key={hex} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: hex, border: '1px solid var(--border)' }} />
                          <span style={{ color: 'var(--text-secondary)', fontSize: '9px', fontFamily: 'monospace' }}>{hex.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: '8px 20px 0' }}>
                <button
                  onClick={() => {
                    const specs = [`Vibe: ${vibes.join(', ')}`, `Shape: ${shape}`, `Length: ${length}`, colors.length > 0 && `Colours: ${colors.join(', ')}`, occasions.length > 0 && `Occasion: ${occasions.join(', ')}`, customText && `Notes: ${customText}`].filter(Boolean).join('\n')
                    navigator.clipboard?.writeText(specs)
                    setShowNailTechSheet(false)
                  }}
                  style={{ width: '100%', background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                >
                  Copy specs
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── PUBLISH SHEET ── */}
        {showPublishSheet && (
          <div onClick={() => setShowPublishSheet(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.7)' }}
          >
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'var(--bg-primary)', borderRadius: '20px 20px 0 0', padding: '0 20px 48px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>
                <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '2px' }} />
              </div>
              <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600', margin: '12px 0 4px', fontFamily: "'DM Sans', sans-serif" }}>Save or publish</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 20px' }}>Where do you want this design to live?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => publishDesign(true)} disabled={publishing}
                  style={{ width: '100%', background: publishStatus === 'draft' ? 'rgba(212,160,192,0.08)' : 'var(--bg-card)', border: publishStatus === 'draft' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)', borderRadius: '14px', padding: '16px 18px', textAlign: 'left', cursor: 'pointer' }}
                >
                  <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', margin: '0 0 3px', fontFamily: "'DM Sans', sans-serif" }}>Save as Draft {publishStatus === 'draft' && '✓'}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>Saved to your profile · only you can see it</p>
                </button>
                <button onClick={() => publishDesign(false)} disabled={publishing}
                  style={{ width: '100%', background: publishStatus === 'published' ? 'rgba(212,160,192,0.08)' : 'var(--bg-card)', border: publishStatus === 'published' ? '1.5px solid var(--accent)' : '0.5px solid var(--border)', borderRadius: '14px', padding: '16px 18px', textAlign: 'left', cursor: 'pointer' }}
                >
                  <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', margin: '0 0 3px', fontFamily: "'DM Sans', sans-serif" }}>Publish to Laque {publishStatus === 'published' && '✓'}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>Goes live on the feed — everyone can see it</p>
                </button>
              </div>
              {publishing && <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginTop: '14px' }}>Saving...</p>}
            </div>
          </div>
        )}

        {/* SaveToBoard — controlled externally */}
        {publishedDesignId && (
          <SaveToBoard
            designId={publishedDesignId}
            designImageUrl={result.imageUrl}
            externalOpen={showSaveBoard}
            onClose={() => setShowSaveBoard(false)}
            renderTrigger={null}
          />
        )}

        {/* ── HEADER ── */}
        <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={resetResult}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6"/></svg>
            Back
          </button>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{credits} credit{credits !== 1 ? 's' : ''} left</span>
        </div>

        {/* ── IMAGE ── */}
        <div style={{ padding: '0 20px', marginBottom: '16px' }}>
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '0.5px solid var(--border)', background: 'var(--bg-card)' }}>
            <img src={result.imageUrl} alt="Generated nail design" style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }} />
          </div>
          <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[...vibes, shape, length, ...occasions].filter(Boolean).map(tag => (
              <span key={tag} style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)', borderRadius: '12px', padding: '4px 10px', fontSize: '11px', fontFamily: "'DM Sans', sans-serif" }}>{tag}</span>
            ))}
            {publishStatus && (
              <span style={{ background: publishStatus === 'published' ? 'rgba(212,160,192,0.15)' : 'var(--bg-chip)', color: publishStatus === 'published' ? 'var(--accent)' : 'var(--text-secondary)', borderRadius: '12px', padding: '4px 10px', fontSize: '11px', fontFamily: "'DM Sans', sans-serif", border: publishStatus === 'published' ? '0.5px solid var(--accent)' : 'none' }}>
                {publishStatus === 'published' ? '✦ Published' : 'Draft'}
              </span>
            )}
          </div>
        </div>

        {/* ── 4 ICON ACTION BUTTONS ── */}
        <div style={{ padding: '0 20px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
          {/* Save to Board */}
          <button
            onClick={async () => { setSavingToBoard(true); const id = await ensureDesignId(); setSavingToBoard(false); if (id) setShowSaveBoard(true) }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '14px 8px', cursor: 'pointer' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
            </svg>
            <span style={{ color: 'var(--text-secondary)', fontSize: '10px', fontFamily: "'DM Sans', sans-serif" }}>{savingToBoard ? '...' : 'Board'}</span>
          </button>

          {/* Share */}
          <button
            onClick={() => { if (navigator.share) { navigator.share({ title: `${vibes.join(' + ')} nails · Laque`, url: result.imageUrl }) } else { navigator.clipboard?.writeText(result.imageUrl) } }}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '14px 8px', cursor: 'pointer' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            <span style={{ color: 'var(--text-secondary)', fontSize: '10px', fontFamily: "'DM Sans', sans-serif" }}>Share</span>
          </button>

          {/* Nail Tech specs */}
          <button
            onClick={() => setShowNailTechSheet(true)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '14px 8px', cursor: 'pointer' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            <span style={{ color: 'var(--text-secondary)', fontSize: '10px', fontFamily: "'DM Sans', sans-serif" }}>Nail Tech</span>
          </button>

          {/* Save / Publish */}
          <button
            onClick={() => setShowPublishSheet(true)}
            style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: publishStatus ? 'rgba(212,160,192,0.08)' : 'var(--bg-card)', border: publishStatus ? '0.5px solid var(--accent)' : '0.5px solid var(--border)', borderRadius: '14px', padding: '14px 8px', cursor: 'pointer' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={publishStatus ? 'var(--accent)' : 'var(--text-primary)'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
            </svg>
            <span style={{ color: publishStatus ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '10px', fontFamily: "'DM Sans', sans-serif" }}>
              {publishStatus === 'published' ? 'Published' : publishStatus === 'draft' ? 'Draft' : 'Save'}
            </span>
          </button>
        </div>

        {/* ── REGEN BUTTONS ── */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {!freeRegenUsed ? (
            <button onClick={() => regen(true)} disabled={generating}
              style={{ width: '100%', background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '14px', padding: '15px', fontSize: '15px', fontWeight: '600', cursor: generating ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif", display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
            >
              {generating ? 'Generating...' : <><span>Regenerate</span><span style={{ background: '#2C0A1E', color: 'var(--accent)', fontSize: '10px', fontWeight: '700', borderRadius: '8px', padding: '2px 8px', letterSpacing: '0.06em' }}>FREE</span></>}
            </button>
          ) : (
            <button onClick={() => regen(false)} disabled={generating || credits < 1}
              style={{ width: '100%', background: credits >= 1 ? 'var(--accent)' : 'var(--bg-card)', color: credits >= 1 ? '#2C0A1E' : 'var(--text-secondary)', border: credits >= 1 ? 'none' : '0.5px solid var(--border)', borderRadius: '14px', padding: '15px', fontSize: '15px', fontWeight: '600', cursor: generating || credits < 1 ? 'not-allowed' : 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              {generating ? 'Generating...' : credits < 1 ? 'No credits left' : 'Regenerate · 1 credit'}
            </button>
          )}
          <button onClick={() => { resetResult(); window.scrollTo({ top: 0 }) }}
            style={{ width: '100%', background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: '8px' }}
          >
            Start over
          </button>
        </div>

        {/* Error */}
        {genError && (
          <div style={{ margin: '12px 20px 0', background: 'rgba(255,80,80,0.08)', border: '0.5px solid rgba(255,80,80,0.3)', borderRadius: '10px', padding: '12px 14px' }}>
            <p style={{ color: '#ff6b6b', fontSize: '13px', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{genError}</p>
          </div>
        )}

        {/* Regen loading overlay */}
        {generating && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,20,20,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', animation: 'spin 0.8s linear infinite' }} />
            <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '500', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>Regenerating your design</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
      </div>
    )
  }

  // ── MAIN BUILDER ──────────────────────────────────────────────────────────
  return (
    <>
      {/* Reference design picker overlay */}
      {showRefPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
          <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '0.5px solid var(--border)', flexShrink: 0 }}>
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>Reference designs</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '2px 0 0' }}>Pick up to 4 · {refDesigns.length} selected</p>
            </div>
            <button onClick={() => setShowRefPicker(false)} style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '10px', padding: '8px 18px', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              Done
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '16px 20px' }}>
            {allDesigns.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>Loading designs...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {allDesigns.map(d => {
                  const selected = refDesigns.find(r => r.id === d.id)
                  return (
                    <button key={d.id} onClick={() => toggleRefDesign(d)}
                      style={{ position: 'relative', background: 'var(--bg-card)', border: selected ? '2px solid var(--accent)' : '0.5px solid var(--border)', borderRadius: '10px', overflow: 'hidden', padding: 0, cursor: 'pointer', aspectRatio: '1/1' }}
                    >
                      {d.image_url
                        ? <img src={d.image_url} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', background: 'var(--bg-chip)' }} />
                      }
                      {selected && (
                        <div style={{ position: 'absolute', top: '6px', right: '6px', width: '20px', height: '20px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2 6 5 9 10 3" stroke="#2C0A1E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {generating && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,20,20,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--border)', borderTop: '2px solid var(--accent)', animation: 'spin 0.8s linear infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '500', margin: '0 0 6px', fontFamily: "'DM Sans', sans-serif" }}>Generating your design</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>This takes 10–20 seconds</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <div style={{ paddingBottom: '180px' }}>
        {/* Header */}
        <div style={{ padding: '24px 20px 20px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', letterSpacing: '-0.02em', margin: '0 0 4px' }}>Nail Lab</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Generate a custom design with AI</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <Link href="/nail-lab/history" style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '8px 14px', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
              History
            </Link>
            <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '8px 14px', textAlign: 'center', flexShrink: 0 }}>
              <p style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: '600', margin: 0, fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>{credits ?? '—'}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '10px', margin: '2px 0 0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Credits</p>
            </div>
          </div>
        </div>

        {credits === 0 && (
          <div style={{ margin: '0 20px 20px', background: 'rgba(212,160,192,0.08)', border: '0.5px solid var(--accent)', borderRadius: '12px', padding: '14px 16px' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: '0 0 4px', fontFamily: "'DM Sans', sans-serif" }}>No credits left</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Credit packs coming soon. Hang tight ✦</p>
          </div>
        )}

        {/* ── VIBE ── */}
        <Section title="Vibe" required>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '-4px 0 10px' }}>Pick one or more</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {VIBES.map(v => (
              <Chip key={v} label={v} active={vibes.includes(v)} onClick={() => toggleVibe(v)} />
            ))}
          </div>
        </Section>

        {/* ── SHAPE ── */}
        <Section title="Shape" required>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {SHAPES.map(s => (
              <Chip key={s} label={s} active={shape === s} onClick={() => setShape(shape === s ? '' : s)} />
            ))}
          </div>
        </Section>

        {/* ── LENGTH ── */}
        <Section title="Length" required>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {LENGTHS.map(l => (
              <Chip key={l} label={l} active={length === l} onClick={() => setLength(length === l ? '' : l)} />
            ))}
          </div>
        </Section>

        {/* ── COLORS ── */}
        <Section title="Colours" required={false}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '-4px 0 10px' }}>Pick up to 4 · tap to select, tap again to remove</p>

          {/* Preset swatches by category */}
          {COLOR_CATEGORIES.map(({ label, start, count }) => (
            <div key={label} style={{ marginBottom: '10px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '10px', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px', fontFamily: "'DM Sans', sans-serif" }}>{label}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PRESET_COLORS.slice(start, start + count).map(({ hex, label: colorLabel }) => {
                  const active = colors.includes(hex)
                  const isLightSwatch = ['#F5EDE3','#F0DCC8','#E8C4A0','#FFD6E0','#F5A8C0','#D8C8F0','#C8D8F0','#C0C0C0','#FFFFFF'].includes(hex)
                  return (
                    <button key={hex} onClick={() => toggleColor(hex)}
                      style={{
                        width: '36px', height: '36px', borderRadius: '50%',
                        background: hex,
                        border: active ? '3px solid var(--accent)' : '1.5px solid var(--border)',
                        cursor: 'pointer', padding: 0, position: 'relative',
                        boxShadow: isLightSwatch ? 'inset 0 0 0 1px rgba(0,0,0,0.1)' : 'none',
                        transition: 'border 0.15s, transform 0.1s',
                        transform: active ? 'scale(1.1)' : 'scale(1)',
                      }}
                      title={colorLabel}
                    >
                      {active && (
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                            <polyline points="2 7 5.5 10.5 12 3.5" stroke={isLightSwatch ? '#141414' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          {/* Custom picker toggle */}
          <button
            onClick={() => setShowPicker(p => !p)}
            style={{
              width: '100%', background: showPicker ? 'var(--bg-chip)' : 'var(--bg-card)',
              border: '0.5px solid var(--border)', borderRadius: '10px',
              padding: '10px 14px', marginTop: '4px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '13px',
              fontFamily: "'DM Sans', sans-serif',",
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {/* colour wheel icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <path d="M12 2a10 10 0 0 1 0 20"/>
                <path d="M12 12 L12 2"/>
                <path d="M12 12 L19.07 16.5"/>
                <path d="M12 12 L4.93 16.5"/>
              </svg>
              Custom colour picker
            </span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              {showPicker ? <polyline points="18 15 12 9 6 15"/> : <polyline points="6 9 12 15 18 9"/>}
            </svg>
          </button>

          {showPicker && (
            <div style={{ marginTop: '10px' }}>
              <ColorPicker onAdd={addFromPicker} disabled={colors.length >= 4} />
            </div>
          )}

          {/* Selected colors row */}
          {colors.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px', marginRight: '2px' }}>Selected:</span>
              {colors.map(hex => (
                <button key={hex} onClick={() => toggleColor(hex)}
                  style={{ width: '32px', height: '32px', borderRadius: '50%', background: hex, border: '2px solid var(--accent)', cursor: 'pointer', padding: 0, position: 'relative', flexShrink: 0, boxShadow: hex === '#FFFFFF' ? 'inset 0 0 0 1px var(--border)' : 'none' }}
                  title="Tap to remove"
                >
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', borderRadius: '50%' }}>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="2.5" y1="2.5" x2="7.5" y2="7.5" stroke="#fff" strokeWidth="1.5"/><line x1="7.5" y1="2.5" x2="2.5" y2="7.5" stroke="#fff" strokeWidth="1.5"/></svg>
                  </div>
                </button>
              ))}
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{colors.length}/4</span>
            </div>
          )}
        </Section>

        {/* ── OCCASION ── */}
        <Section title="Occasion" required={false}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {OCCASIONS.map(o => (
              <Chip key={o} label={o} active={occasions.includes(o)} onClick={() => toggleOccasion(o)} />
            ))}
          </div>
        </Section>

        {/* ── REFERENCE DESIGNS ── */}
        <Section title="Reference designs" required={false}>
          <button
            onClick={() => { loadDesigns(); setShowRefPicker(true) }}
            style={{
              width: '100%', background: 'var(--bg-card)', border: '0.5px solid var(--border)',
              borderRadius: '12px', padding: '14px 16px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              cursor: 'pointer', textAlign: 'left',
            }}
          >
            <span style={{ color: refDesigns.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }}>
              {refDesigns.length > 0 ? `${refDesigns.length} design${refDesigns.length > 1 ? 's' : ''} selected` : 'Pick from the Laque library'}
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5"><polyline points="9 18 15 12 9 6"/></svg>
          </button>

          {refDesigns.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {refDesigns.map(d => (
                <div key={d.id} style={{ position: 'relative', width: '60px', height: '60px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', border: '0.5px solid var(--border)', background: 'var(--bg-card)' }}>
                  {d.image_url && <img src={d.image_url} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  <button onClick={() => toggleRefDesign(d)}
                    style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                  >
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><line x1="2" y1="2" x2="8" y2="8" stroke="#fff" strokeWidth="1.5"/><line x1="8" y1="2" x2="2" y2="8" stroke="#fff" strokeWidth="1.5"/></svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* ── CUSTOM TEXT ── */}
        <Section title="Additional details" required={false}>
          <textarea
            value={customText}
            onChange={e => setCustomText(e.target.value)}
            placeholder="e.g. chrome finish, marble texture, with tiny stars…"
            rows={3}
            style={{
              width: '100%', padding: '12px 14px',
              background: 'var(--bg-card)', border: '0.5px solid var(--border)',
              borderRadius: '12px', color: 'var(--text-primary)',
              fontSize: '14px', fontFamily: "'DM Sans', sans-serif",
              resize: 'none', outline: 'none', lineHeight: '1.5',
              boxSizing: 'border-box',
            }}
          />
        </Section>

        {/* Error */}
        {genError && (
          <div style={{ margin: '0 20px 16px', background: 'rgba(255,80,80,0.08)', border: '0.5px solid rgba(255,80,80,0.3)', borderRadius: '10px', padding: '12px 14px' }}>
            <p style={{ color: '#ff6b6b', fontSize: '13px', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{genError}</p>
          </div>
        )}
      </div>

      {/* ── FIXED GENERATE BUTTON — sits above BottomNav (~72px tall) ── */}
      <div style={{ position: 'fixed', bottom: '72px', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', padding: '10px 20px 12px', background: 'var(--bg-primary)', borderTop: '0.5px solid var(--border)', zIndex: 99 }}>
        {vibes.length === 0 || !shape || !length ? (
          <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 8px' }}>
            Select vibe, shape & length to generate
          </p>
        ) : null}
        <button
          onClick={generate}
          disabled={!canGenerate}
          style={{
            width: '100%', padding: '16px',
            background: canGenerate ? 'var(--accent)' : 'var(--bg-card)',
            color: canGenerate ? '#2C0A1E' : 'var(--text-secondary)',
            border: canGenerate ? 'none' : '0.5px solid var(--border)',
            borderRadius: '14px', fontSize: '16px', fontWeight: '600',
            fontFamily: "'DM Sans', sans-serif", cursor: canGenerate ? 'pointer' : 'default',
            transition: 'all 0.15s',
          }}
        >
          {credits === 0 ? 'No credits — packs coming soon' : 'Generate ✦'}
        </button>
      </div>
    </>
  )
}
