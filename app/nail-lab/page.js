'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SaveToBoard from '@/components/SaveToBoard'
import { LaqueWordmark, MagicStarIcon } from '@/components/ui/icons'

// ── Page palette from the Lab frames (237:1752 / 239:1800) ─────────────────
// The Lab's accent is the softer #D98CAB rose, not the feed's #FF517F.
const LAB_ACCENT = '#D98CAB'
const PANEL = 'rgba(255, 255, 255, 0.06)'
const PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.1)'
const MUTED60 = 'rgba(255, 255, 255, 0.6)'
const MUTED50 = 'rgba(255, 255, 255, 0.5)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.3,
})

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

  return (
    <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
          aria-label="Hue"
        />
      </div>

      {/* Preview + hex + Add */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: currentHex, border: PANEL_BORDER, flexShrink: 0, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.08)' }} />
        <div style={{ flex: 1 }}>
          <p style={{ ...ui(400, 13), fontFamily: 'monospace', margin: '0 0 2px', letterSpacing: '0.04em' }}>{currentHex.toUpperCase()}</p>
          <p style={{ ...ui(300, 11, MUTED50), margin: 0 }}>H {hue}° · S {sv.s}% · B {sv.v}%</p>
        </div>
        <button
          onClick={() => onAdd(currentHex)}
          disabled={disabled}
          style={{
            background: disabled ? PANEL : BTN_GRADIENT,
            border: disabled ? PANEL_BORDER : 'none', borderRadius: '12px',
            padding: '10px 20px', ...ui(600, 13, disabled ? MUTED50 : 'var(--lq-white)'),
            cursor: disabled ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}
        >
          Add
        </button>
      </div>
    </div>
  )
}

// Chip per frame 237:1752 — visual 32px pill, transparent padding extends
// the hit area to ≥44px (same pattern as components/ui/Chip, Lab palette).
function LabChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{ background: 'none', border: 'none', padding: '6px 0', minHeight: '44px', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center' }}
    >
      <span style={{
        display: 'inline-flex', alignItems: 'center',
        padding: '8px 16px', borderRadius: '20px',
        background: active ? LAB_ACCENT : PANEL,
        border: active ? `1px solid ${LAB_ACCENT}` : PANEL_BORDER,
        ...ui(active ? 500 : 300, 14),
        whiteSpace: 'nowrap', lineHeight: '16px',
      }}>
        {label}
      </span>
    </button>
  )
}

// Card + section header per the Essentials/Personalize/Inspiration cards
const card = { background: PANEL, border: PANEL_BORDER, borderRadius: '24px', padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', boxSizing: 'border-box' }

function CardHeader({ title, required }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <p style={{ ...ui(500, 18), lineHeight: '22px', margin: 0 }}>{title}</p>
      {/* White, not the frame's #D98CAB / white-50: deliberate legibility
          exception (Sogol 2026-08-22) — the drawn colours vanish against
          the rosy backdrop on a real screen. Size/weight as drawn. */}
      <span style={{ ...ui(600, 12), letterSpacing: '0.5px', textTransform: 'uppercase', lineHeight: '14px' }}>
        {required ? 'Required' : 'Optional'}
      </span>
    </div>
  )
}

const groupLabel = { ...ui(500, 14, MUTED60), margin: 0 }

// Fixed page backdrop: the Lab's rosy blur (exported from the frame) over
// the #260D14 ground, content stacked above. Overlays must render OUTSIDE
// the z-1 wrapper (stacking-context lesson from the profile sheet).
function LabShell({ children }) {
  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden style={{
        position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px', zIndex: 0, overflow: 'hidden', background: '#260D14',
      }}>
        <img src="/redesign/lab-bg.webp" alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}

const InfoIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#FF517F" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
  </svg>
)
const PaletteIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 22a10 10 0 110-20 10 9 0 0110 9 5 5 0 01-5 5h-2.2a1.8 1.8 0 00-1.4 2.9c.3.4.5.8.5 1.3A1.8 1.8 0 0112 22z"/>
    <circle cx="7.5" cy="11.5" r="1"/><circle cx="11" cy="7.5" r="1"/><circle cx="16" cy="8.5" r="1"/>
  </svg>
)
const ImageIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>
  </svg>
)

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
  const [showAllColors, setShowAllColors] = useState(false)

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
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('credit_balance')
        .eq('id', session.user.id)
        .single()
      if (error) console.error('credit balance fetch failed:', error)
      // Leave credits unset (renders as "—") rather than defaulting to 0 on
      // a fetch failure, so a real error isn't shown as "no credits left."
      if (profile) setCredits(profile.credit_balance ?? 0)
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
      <LabShell>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <p style={ui(300, 14, MUTED60)}>Loading...</p>
        </div>
      </LabShell>
    )
  }

  // ── NOT SIGNED IN ─────────────────────────────────────────────────────────
  if (!currentUser) {
    return (
      <LabShell>
        <div style={{ padding: 'calc(env(safe-area-inset-top) + 64px) 32px 140px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <span style={{ color: LAB_ACCENT, display: 'flex' }}><MagicStarIcon size={36} /></span>
          <h2 style={{ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: '34px', color: 'var(--lq-white)', margin: 0 }}>Nail Lab</h2>
          <p style={{ ...ui(300, 14, MUTED60), lineHeight: 1.6, maxWidth: '280px', margin: 0 }}>
            Sign in to generate custom nail designs with AI.
          </p>
          <Link href="/profile" style={{ marginTop: '8px', display: 'inline-block', background: BTN_GRADIENT, borderRadius: '24px', padding: '13px 32px', ...ui(600, 14), textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </LabShell>
    )
  }

  // ── RESULT VIEW (no frame — current behaviour restyled with Lab tokens) ──
  if (result) {
    return (
      <>
        {/* ── NAIL TECH SHEET ── */}
        {showNailTechSheet && (
          <div onClick={() => setShowNailTechSheet(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(20,3,8,0.7)' }}
          >
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'linear-gradient(180deg, #29000A 0%, #260D14 100%)', borderRadius: '24px 24px 0 0', padding: '0 0 48px', maxHeight: '80vh', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>
                <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />
              </div>
              <div style={{ padding: '12px 24px 16px', borderBottom: PANEL_BORDER }}>
                <p style={{ ...ui(600, 16), margin: 0 }}>Design Specs</p>
                <p style={{ ...ui(300, 12, MUTED50), margin: '3px 0 0' }}>Share this with your nail tech</p>
              </div>
              <div style={{ padding: '8px 24px' }}>
                {[
                  { label: 'Vibe', value: vibes.join(', ') },
                  { label: 'Shape', value: shape },
                  { label: 'Length', value: length },
                  occasions.length > 0 ? { label: 'Occasion', value: occasions.join(', ') } : null,
                  customText ? { label: 'Notes', value: customText } : null,
                ].filter(Boolean).map(({ label, value }) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '13px 0', borderBottom: PANEL_BORDER }}>
                    <span style={{ ...ui(300, 13, MUTED60), flexShrink: 0 }}>{label}</span>
                    <span style={{ ...ui(500, 13), textAlign: 'right', maxWidth: '220px' }}>{value}</span>
                  </div>
                ))}
                {colors.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: PANEL_BORDER }}>
                    <span style={ui(300, 13, MUTED60)}>Colours</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {colors.map(hex => (
                        <div key={hex} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                          <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: hex, border: PANEL_BORDER }} />
                          <span style={{ ...ui(300, 9, MUTED50), fontFamily: 'monospace' }}>{hex.toUpperCase()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div style={{ padding: '8px 24px 0' }}>
                <button
                  onClick={() => {
                    const specs = [`Vibe: ${vibes.join(', ')}`, `Shape: ${shape}`, `Length: ${length}`, colors.length > 0 && `Colours: ${colors.join(', ')}`, occasions.length > 0 && `Occasion: ${occasions.join(', ')}`, customText && `Notes: ${customText}`].filter(Boolean).join('\n')
                    navigator.clipboard?.writeText(specs)
                    setShowNailTechSheet(false)
                  }}
                  style={{ width: '100%', background: BTN_GRADIENT, border: 'none', borderRadius: '24px', padding: '14px', ...ui(600, 14), cursor: 'pointer' }}
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
            style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(20,3,8,0.7)' }}
          >
            <div onClick={e => e.stopPropagation()}
              style={{ background: 'linear-gradient(180deg, #29000A 0%, #260D14 100%)', borderRadius: '24px 24px 0 0', padding: '0 24px 48px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>
                <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />
              </div>
              <p style={{ ...ui(600, 16), margin: '12px 0 4px' }}>Save or publish</p>
              <p style={{ ...ui(300, 13, MUTED50), margin: '0 0 20px' }}>Where do you want this design to live?</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button onClick={() => publishDesign(true)} disabled={publishing}
                  style={{ width: '100%', background: PANEL, border: publishStatus === 'draft' ? `1.5px solid ${LAB_ACCENT}` : PANEL_BORDER, borderRadius: '16px', padding: '16px 18px', textAlign: 'left', cursor: 'pointer' }}
                >
                  <p style={{ ...ui(600, 14), margin: '0 0 3px' }}>Save as Draft {publishStatus === 'draft' && '✓'}</p>
                  <p style={{ ...ui(300, 12, MUTED50), margin: 0 }}>Saved to your profile · only you can see it</p>
                </button>
                <button onClick={() => publishDesign(false)} disabled={publishing}
                  style={{ width: '100%', background: PANEL, border: publishStatus === 'published' ? `1.5px solid ${LAB_ACCENT}` : PANEL_BORDER, borderRadius: '16px', padding: '16px 18px', textAlign: 'left', cursor: 'pointer' }}
                >
                  <p style={{ ...ui(600, 14), margin: '0 0 3px' }}>Publish to Laque {publishStatus === 'published' && '✓'}</p>
                  <p style={{ ...ui(300, 12, MUTED50), margin: 0 }}>Goes live on the feed — everyone can see it</p>
                </button>
              </div>
              {publishing && <p style={{ ...ui(300, 13, MUTED50), textAlign: 'center', marginTop: '14px' }}>Saving...</p>}
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

        {/* Regen loading overlay */}
        {generating && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,3,8,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)', borderTop: `2px solid ${LAB_ACCENT}`, animation: 'spin 0.8s linear infinite' }} />
            <p style={{ ...ui(500, 16), margin: 0 }}>Regenerating your design</p>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        <LabShell>
          <div style={{ padding: 'calc(env(safe-area-inset-top) + 12px) 24px calc(env(safe-area-inset-bottom) + 140px)' }}>

            {/* ── HEADER ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', minHeight: '44px' }}>
              <button onClick={resetResult}
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px', padding: '8px', cursor: 'pointer', display: 'flex', color: 'var(--lq-white)' }}
                aria-label="Back to the builder"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
              </button>
              <div style={{ background: 'rgba(255,255,255,0.11)', display: 'flex', gap: '4px', alignItems: 'center', padding: '6px 12px', borderRadius: '100px' }}>
                {/* White, not #D98CAB: legibility exception (Sogol 2026-08-22) */}
                <span style={ui(700, 12)}>{credits}</span>
                <span style={{ ...ui(600, 10, MUTED60), letterSpacing: '0.5px' }}>CREDIT{credits !== 1 ? 'S' : ''} LEFT</span>
              </div>
            </div>

            {/* ── IMAGE ── */}
            <div style={{ marginBottom: '16px' }}>
              <div style={{ borderRadius: '24px', overflow: 'hidden', border: PANEL_BORDER, background: PANEL }}>
                <img src={result.imageUrl} alt="Generated nail design" style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }} />
              </div>
              <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {[...vibes, shape, length, ...occasions].filter(Boolean).map(tag => (
                  <span key={tag} style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '12px', padding: '4px 10px', ...ui(300, 11, MUTED60) }}>{tag}</span>
                ))}
                {publishStatus && (
                  <span style={{ background: publishStatus === 'published' ? 'rgba(217,140,171,0.2)' : PANEL, color: publishStatus === 'published' ? LAB_ACCENT : MUTED60, borderRadius: '12px', padding: '4px 10px', fontSize: '11px', fontFamily: 'var(--lq-font-ui)', border: publishStatus === 'published' ? `1px solid ${LAB_ACCENT}` : PANEL_BORDER }}>
                    {publishStatus === 'published' ? '✦ Published' : 'Draft'}
                  </span>
                )}
              </div>
            </div>

            {/* ── 4 ICON ACTION BUTTONS ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '16px' }}>
              {/* Save to Board */}
              <button
                onClick={async () => { setSavingToBoard(true); const id = await ensureDesignId(); setSavingToBoard(false); if (id) setShowSaveBoard(true) }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '14px 8px', cursor: 'pointer', color: 'var(--lq-white)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                </svg>
                <span style={ui(300, 10, MUTED60)}>{savingToBoard ? '...' : 'Board'}</span>
              </button>

              {/* Share */}
              <button
                onClick={() => { if (navigator.share) { navigator.share({ title: `${vibes.join(' + ')} nails · Laque`, url: result.imageUrl }) } else { navigator.clipboard?.writeText(result.imageUrl) } }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '14px 8px', cursor: 'pointer', color: 'var(--lq-white)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                <span style={ui(300, 10, MUTED60)}>Share</span>
              </button>

              {/* Nail Tech specs */}
              <button
                onClick={() => setShowNailTechSheet(true)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '14px 8px', cursor: 'pointer', color: 'var(--lq-white)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                </svg>
                <span style={ui(300, 10, MUTED60)}>Nail Tech</span>
              </button>

              {/* Save / Publish */}
              <button
                onClick={() => setShowPublishSheet(true)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: publishStatus ? 'rgba(217,140,171,0.12)' : PANEL, border: publishStatus ? `1px solid ${LAB_ACCENT}` : PANEL_BORDER, borderRadius: '16px', padding: '14px 8px', cursor: 'pointer', color: publishStatus ? LAB_ACCENT : 'var(--lq-white)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
                </svg>
                <span style={ui(300, 10, publishStatus ? LAB_ACCENT : MUTED60)}>
                  {publishStatus === 'published' ? 'Published' : publishStatus === 'draft' ? 'Draft' : 'Save'}
                </span>
              </button>
            </div>

            {/* ── REGEN BUTTONS ── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {!freeRegenUsed ? (
                <button onClick={() => regen(true)} disabled={generating}
                  style={{ width: '100%', background: BTN_GRADIENT, border: 'none', borderRadius: '24px', padding: '15px', ...ui(600, 15), cursor: generating ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}
                >
                  {generating ? 'Generating...' : <><span>Regenerate</span><span style={{ background: 'rgba(255,255,255,0.25)', color: 'var(--lq-white)', fontSize: '10px', fontWeight: '700', borderRadius: '8px', padding: '2px 8px', letterSpacing: '0.06em' }}>FREE</span></>}
                </button>
              ) : (
                <button onClick={() => regen(false)} disabled={generating || credits < 1}
                  style={{ width: '100%', background: credits >= 1 ? BTN_GRADIENT : PANEL, border: credits >= 1 ? 'none' : PANEL_BORDER, borderRadius: '24px', padding: '15px', ...ui(600, 15, credits >= 1 ? 'var(--lq-white)' : MUTED50), cursor: generating || credits < 1 ? 'not-allowed' : 'pointer' }}
                >
                  {generating ? 'Generating...' : credits < 1 ? 'No credits left' : 'Regenerate · 1 credit'}
                </button>
              )}
              <button onClick={() => { resetResult(); window.scrollTo({ top: 0 }) }}
                style={{ width: '100%', background: 'none', border: 'none', ...ui(400, 14, MUTED60), cursor: 'pointer', padding: '8px' }}
              >
                Start over
              </button>
            </div>

            {/* Error */}
            {genError && (
              <div style={{ marginTop: '12px', background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: '12px', padding: '12px 14px' }}>
                <p style={{ ...ui(400, 13, '#ff8a8a'), margin: 0 }}>{genError}</p>
              </div>
            )}
          </div>
        </LabShell>
      </>
    )
  }

  // ── MAIN BUILDER ──────────────────────────────────────────────────────────
  return (
    <>
      {/* Reference design picker overlay (no frame — restyled, Lab tokens) */}
      {showRefPicker && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', background: '#260D14' }}>
          <div style={{ padding: 'calc(env(safe-area-inset-top) + 20px) 24px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: PANEL_BORDER, flexShrink: 0 }}>
            <div>
              <p style={{ ...ui(600, 16), margin: 0 }}>Reference designs</p>
              <p style={{ ...ui(300, 12, MUTED50), margin: '2px 0 0' }}>Pick up to 4 · {refDesigns.length} selected</p>
            </div>
            <button onClick={() => setShowRefPicker(false)} style={{ background: BTN_GRADIENT, border: 'none', borderRadius: '100px', padding: '8px 18px', ...ui(600, 13), cursor: 'pointer' }}>
              Done
            </button>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '16px 24px' }}>
            {allDesigns.length === 0 ? (
              <p style={{ ...ui(300, 14, MUTED50), textAlign: 'center', padding: '32px 0' }}>Loading designs...</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                {allDesigns.map(d => {
                  const selected = refDesigns.find(r => r.id === d.id)
                  return (
                    <button key={d.id} onClick={() => toggleRefDesign(d)}
                      style={{ position: 'relative', background: PANEL, border: selected ? `2px solid ${LAB_ACCENT}` : PANEL_BORDER, borderRadius: '12px', overflow: 'hidden', padding: 0, cursor: 'pointer', aspectRatio: '1/1' }}
                    >
                      {d.image_url
                        ? <img src={d.image_url} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        : <div style={{ width: '100%', height: '100%', background: 'rgba(255,255,255,0.08)' }} />
                      }
                      {selected && (
                        <div style={{ position: 'absolute', top: '6px', right: '6px', width: '20px', height: '20px', borderRadius: '50%', background: LAB_ACCENT, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><polyline points="2 6 5 9 10 3" stroke="#260D14" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
        <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(20,3,8,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '20px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)', borderTop: `2px solid ${LAB_ACCENT}`, animation: 'spin 0.8s linear infinite' }} />
          <div style={{ textAlign: 'center' }}>
            <p style={{ ...ui(500, 16), margin: '0 0 6px' }}>Generating your design</p>
            <p style={{ ...ui(300, 13, MUTED50), margin: 0 }}>This takes 10–20 seconds</p>
          </div>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}

      <LabShell>
        <div style={{ padding: 'calc(env(safe-area-inset-top) + 12px) 24px calc(env(safe-area-inset-bottom) + 260px)', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* ── Header App Row ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: '44px' }}>
            <span style={{ color: 'var(--lq-white)', display: 'flex' }}><LaqueWordmark height={24} /></span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <Link href="/nail-lab/history" style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '100px', padding: '6px 12px', ...ui(500, 12), textDecoration: 'none' }}>
                History
              </Link>
              <div style={{ background: 'rgba(255,255,255,0.11)', display: 'flex', gap: '4px', alignItems: 'center', padding: '6px 12px', borderRadius: '100px' }}>
                {/* White, not #D98CAB: legibility exception (Sogol 2026-08-22) */}
                <span style={ui(700, 12)}>{credits ?? '—'}</span>
                <span style={{ ...ui(600, 10, MUTED60), letterSpacing: '0.5px' }}>CREDITS</span>
              </div>
            </div>
          </div>

          {/* ── Title ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h1 style={{ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: '42px', lineHeight: '48px', color: 'var(--lq-white)', margin: 0 }}>Nail Lab</h1>
            <p style={{ ...ui(300, 16, MUTED60), lineHeight: '20px', margin: 0 }}>Generate a custom nail design with AI</p>
          </div>

          {/* ── Zero-credit banner: live /buy-credits link (frame drew
                 "packs coming soon" — packs are launched; Sogol 2026-08-22) ── */}
          {credits === 0 && (
            <Link href="/buy-credits" style={{ background: 'rgba(255,81,127,0.1)', border: '1px solid rgba(255,81,127,0.2)', borderRadius: '16px', padding: '14px', display: 'flex', gap: '8px', alignItems: 'center', textDecoration: 'none' }}>
              <InfoIcon size={16} />
              <span style={{ ...ui(400, 13), lineHeight: '16px', flex: 1 }}>No credits left — get more credits</span>
              <span style={ui(400, 18, MUTED50)}>›</span>
            </Link>
          )}

          {/* ── 1. Essentials ── */}
          <div style={card}>
            <CardHeader title="1. Essentials" required />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={groupLabel}>Vibe / Style</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '-6px 0' }}>
                {VIBES.map(v => (
                  <LabChip key={v} label={v} active={vibes.includes(v)} onClick={() => toggleVibe(v)} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={groupLabel}>Shape</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '-6px 0' }}>
                {SHAPES.map(s => (
                  <LabChip key={s} label={s} active={shape === s} onClick={() => setShape(shape === s ? '' : s)} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={groupLabel}>Length</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '-6px 0' }}>
                {LENGTHS.map(l => (
                  <LabChip key={l} label={l} active={length === l} onClick={() => setLength(length === l ? '' : l)} />
                ))}
              </div>
            </div>
          </div>

          {/* ── 2. Personalize ── */}
          <div style={card}>
            <CardHeader title="2. Personalize" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <p style={groupLabel}>Colours</p>
                <span style={ui(400, 12, MUTED50)}>Select up to 4</span>
              </div>

              {/* Frame draws Nudes + Pinks with a "+" — the + reveals the
                  remaining preset groups so every colour stays reachable. */}
              {(showAllColors ? COLOR_CATEGORIES : COLOR_CATEGORIES.slice(0, 2)).map(({ label, start, count }, idx) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <p style={{ ...ui(400, 11, MUTED50), textTransform: 'uppercase', margin: 0 }}>{label}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                    {PRESET_COLORS.slice(start, start + count).map(({ hex, label: colorLabel }) => {
                      const active = colors.includes(hex)
                      const isLightSwatch = ['#F5EDE3','#F0DCC8','#E8C4A0','#FFD6E0','#F5A8C0','#D8C8F0','#C8D8F0','#C0C0C0','#FFFFFF'].includes(hex)
                      return (
                        <button key={hex} onClick={() => toggleColor(hex)}
                          aria-pressed={active}
                          style={{
                            width: '36px', height: '36px', borderRadius: '50%',
                            background: hex,
                            border: active ? `3px solid ${LAB_ACCENT}` : '1.5px solid rgba(255,255,255,0.15)',
                            cursor: 'pointer', padding: 0, position: 'relative',
                            boxShadow: isLightSwatch ? 'inset 0 0 0 1px rgba(0,0,0,0.1)' : 'none',
                            transition: 'border 0.15s, transform 0.1s',
                            transform: active ? 'scale(1.1)' : 'scale(1)',
                          }}
                          title={colorLabel}
                          aria-label={colorLabel}
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
                    {!showAllColors && idx === 0 && (
                      <button onClick={() => setShowAllColors(true)}
                        aria-label="Show more colours"
                        style={{ width: '36px', height: '36px', borderRadius: '18px', background: 'rgba(255,255,255,0.08)', border: PANEL_BORDER, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', ...ui(400, 14) }}>
                        +
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {showAllColors && (
                <button onClick={() => setShowAllColors(false)}
                  style={{ background: 'none', border: 'none', ...ui(400, 12, MUTED50), cursor: 'pointer', padding: '4px 0', textAlign: 'left' }}>
                  Show fewer colours
                </button>
              )}

              {/* Custom colour picker row */}
              <button
                onClick={() => setShowPicker(p => !p)}
                aria-expanded={showPicker}
                style={{
                  width: '100%', background: 'none', border: 'none',
                  borderTop: PANEL_BORDER, borderRadius: 0,
                  padding: '12px 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', color: 'var(--lq-white)', minHeight: '44px',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px', ...ui(400, 14) }}>
                  <PaletteIcon size={16} />
                  Custom colour picker
                </span>
                <span style={ui(400, 18, MUTED50)}>{showPicker ? '⌃' : '›'}</span>
              </button>

              {showPicker && (
                <ColorPicker onAdd={addFromPicker} disabled={colors.length >= 4} />
              )}

              {/* Selected colors row */}
              {colors.length > 0 && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <span style={ui(300, 12, MUTED50)}>Selected:</span>
                  {colors.map(hex => (
                    <button key={hex} onClick={() => toggleColor(hex)}
                      style={{ width: '32px', height: '32px', borderRadius: '50%', background: hex, border: `2px solid ${LAB_ACCENT}`, cursor: 'pointer', padding: 0, position: 'relative', flexShrink: 0 }}
                      title="Tap to remove"
                      aria-label={`Remove colour ${hex}`}
                    >
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.35)', borderRadius: '50%' }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="2.5" y1="2.5" x2="7.5" y2="7.5" stroke="#fff" strokeWidth="1.5"/><line x1="7.5" y1="2.5" x2="2.5" y2="7.5" stroke="#fff" strokeWidth="1.5"/></svg>
                      </div>
                    </button>
                  ))}
                  <span style={ui(300, 11, MUTED50)}>{colors.length}/4</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <p style={groupLabel}>Occasion</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '-6px 0' }}>
                {OCCASIONS.map(o => (
                  <LabChip key={o} label={o} active={occasions.includes(o)} onClick={() => toggleOccasion(o)} />
                ))}
              </div>
            </div>
          </div>

          {/* ── 3. Inspiration ── */}
          <div style={{ ...card, gap: '16px' }}>
            <CardHeader title="3. Inspiration" />
            <button
              onClick={() => { loadDesigns(); setShowRefPicker(true) }}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.03)', border: PANEL_BORDER,
                borderRadius: '12px', padding: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                cursor: 'pointer', textAlign: 'left', color: 'var(--lq-white)', minHeight: '44px',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ImageIcon size={16} />
                <span style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={ui(500, 14)}>Reference designs</span>
                  <span style={ui(400, 12, MUTED50)}>
                    {refDesigns.length > 0 ? `${refDesigns.length} design${refDesigns.length > 1 ? 's' : ''} selected` : 'Pick from the Laque library'}
                  </span>
                </span>
              </span>
              <span style={ui(400, 18, MUTED50)}>›</span>
            </button>

            {refDesigns.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                {refDesigns.map(d => (
                  <div key={d.id} style={{ position: 'relative', width: '60px', height: '60px', flexShrink: 0, borderRadius: '8px', overflow: 'hidden', border: PANEL_BORDER, background: PANEL }}>
                    {d.image_url && <img src={d.image_url} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    <button onClick={() => toggleRefDesign(d)}
                      aria-label={`Remove reference ${d.title || 'design'}`}
                      style={{ position: 'absolute', top: '2px', right: '2px', width: '18px', height: '18px', borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}
                    >
                      <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><line x1="2" y1="2" x2="8" y2="8" stroke="#fff" strokeWidth="1.5"/><line x1="8" y1="2" x2="2" y2="8" stroke="#fff" strokeWidth="1.5"/></svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <p style={groupLabel}>Additional details</p>
              <textarea
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                placeholder="e.g. chrome finish, marble texture, with tiny stars…"
                rows={3}
                aria-label="Additional details"
                style={{
                  width: '100%', padding: '14px',
                  background: 'rgba(255,255,255,0.02)', border: PANEL_BORDER,
                  borderRadius: '12px', color: 'var(--lq-white)',
                  fontSize: '13px', fontFamily: 'var(--lq-font-ui)',
                  resize: 'none', outline: 'none', lineHeight: '18px',
                  boxSizing: 'border-box', minHeight: '80px',
                }}
              />
            </div>
          </div>

          {/* Error */}
          {genError && (
            <div style={{ background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.3)', borderRadius: '12px', padding: '12px 14px' }}>
              <p style={{ ...ui(400, 13, '#ff8a8a'), margin: 0 }}>{genError}</p>
            </div>
          )}
        </div>
      </LabShell>

      {/* ── Sticky action area — opaque, stacked ABOVE the nav (z-110 vs
             nav z-100, price-strip precedent a188e5c): the transparent
             gradient let content read through and the nav clipped the CTA ── */}
      <div style={{ position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom) + 72px)', left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', padding: '16px 24px 20px', background: 'rgba(32,5,11,0.94)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', zIndex: 110, display: 'flex', flexDirection: 'column', gap: '12px', alignItems: 'center', boxSizing: 'border-box' }}>
        {(vibes.length === 0 || !shape || !length) && (
          <p style={{ ...ui(400, 13, MUTED50), lineHeight: '16px', margin: 0, textAlign: 'center' }}>
            Select vibe, shape & length to generate
          </p>
        )}
        {credits === 0 ? (
          // Live purchase path, not the frame's disabled "coming soon" state.
          <Link href="/buy-credits" style={{ width: '100%', height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: BTN_GRADIENT, borderRadius: '24px', ...ui(500, 15), textDecoration: 'none', boxSizing: 'border-box' }}>
            Get more credits ✦
          </Link>
        ) : (
          <button
            onClick={generate}
            disabled={!canGenerate}
            style={{
              width: '100%', height: '48px',
              background: canGenerate ? BTN_GRADIENT : 'none',
              border: canGenerate ? 'none' : '1px solid rgba(255,255,255,0.12)',
              borderRadius: '24px', ...ui(500, 15, canGenerate ? 'var(--lq-white)' : 'rgba(255,255,255,0.4)'),
              cursor: canGenerate ? 'pointer' : 'default', transition: 'all 0.15s',
            }}
          >
            {generating ? 'Generating…' : 'Generate ✦'}
          </button>
        )}
      </div>
    </>
  )
}
