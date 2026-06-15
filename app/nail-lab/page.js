'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const VIBES = ['Minimal', 'Moody', 'Dark', 'Coastal', 'Glam', 'Y2K', 'Bridal', 'Abstract', 'Floral', 'Pastel', 'Edgy', 'Clean Girl']
const SHAPES = ['Almond', 'Stiletto', 'Coffin', 'Square', 'Oval', 'Squoval']
const LENGTHS = ['Short', 'Medium', 'Long', 'Extra Long']
const OCCASIONS = ['Everyday', 'Date Night', 'Wedding', 'Work', 'Festival', 'Birthday', 'Holiday', 'Party']

const PRESET_COLORS = [
  { hex: '#141414', label: 'Black' },
  { hex: '#FFFFFF', label: 'White' },
  { hex: '#D4A0C0', label: 'Blush' },
  { hex: '#9B5E8A', label: 'Mauve' },
  { hex: '#E8D5D5', label: 'Nude' },
  { hex: '#C4A882', label: 'Caramel' },
  { hex: '#8B7355', label: 'Brown' },
  { hex: '#E8C4B8', label: 'Peach' },
  { hex: '#A8B5C4', label: 'Blue' },
  { hex: '#B5C4A8', label: 'Sage' },
  { hex: '#C4A8C0', label: 'Lilac' },
  { hex: '#F5E6C8', label: 'Cream' },
]

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

  const toggleVibe = (v) => setVibes(prev => prev.includes(v) ? prev.filter(x => x !== v) : [...prev, v])
  const toggleOccasion = (o) => setOccasions(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o])

  const canGenerate = vibes.length > 0 && shape && length && currentUser && credits >= 1 && !generating

  const generate = async () => {
    if (!canGenerate) return
    setGenerating(true)
    setGenError(null)
    setResult(null)
    try {
      const res = await fetch('/api/generate-nail-design', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          vibe: vibes,
          shape,
          length,
          colors,
          occasion: occasions,
          customText: customText || null,
          referenceImageUrls: refDesigns.map(d => d.image_url).filter(Boolean),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Generation failed')
      setResult(data)
      setCredits(data.creditsRemaining)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setGenError(e.message)
    } finally {
      setGenerating(false)
    }
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
      <div style={{ paddingBottom: '100px' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={() => setResult(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="15 18 9 12 15 6" /></svg>
            Back
          </button>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{result.creditsRemaining} credit{result.creditsRemaining !== 1 ? 's' : ''} left</span>
        </div>

        {/* Result image */}
        <div style={{ padding: '0 20px', marginBottom: '20px' }}>
          <div style={{ borderRadius: '16px', overflow: 'hidden', border: '0.5px solid var(--border)', background: 'var(--bg-card)' }}>
            <img
              src={result.imageUrl}
              alt="Generated nail design"
              style={{ width: '100%', height: 'auto', display: 'block', objectFit: 'contain' }}
            />
          </div>
          <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[...vibes, shape, length, ...occasions].filter(Boolean).map(tag => (
              <span key={tag} style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)', borderRadius: '12px', padding: '4px 10px', fontSize: '11px', fontFamily: "'DM Sans', sans-serif" }}>{tag}</span>
            ))}
          </div>
        </div>

        {/* Action buttons — Session 3 will expand these */}
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button
            onClick={() => { setResult(null); window.scrollTo({ top: 0 }) }}
            style={{ width: '100%', background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '14px', padding: '15px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Generate again
          </button>
          <button
            onClick={() => setResult(null)}
            style={{ width: '100%', background: 'var(--bg-card)', color: 'var(--text-primary)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '15px', fontSize: '15px', fontWeight: '500', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
          >
            Start over
          </button>
        </div>
        <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', marginTop: '16px', padding: '0 20px' }}>
          Save, share & regen options coming soon ✦
        </p>
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
          <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '8px 14px', textAlign: 'center', flexShrink: 0 }}>
            <p style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: '600', margin: 0, fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>{credits ?? '—'}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '10px', margin: '2px 0 0', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Credits</p>
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
            {PRESET_COLORS.map(({ hex, label }) => {
              const active = colors.includes(hex)
              return (
                <button key={hex} onClick={() => toggleColor(hex)}
                  style={{
                    width: '36px', height: '36px', borderRadius: '50%',
                    background: hex,
                    border: active ? '3px solid var(--accent)' : '1.5px solid var(--border)',
                    cursor: 'pointer', padding: 0, position: 'relative',
                    boxShadow: hex === '#FFFFFF' ? 'inset 0 0 0 1px var(--border)' : 'none',
                    transition: 'border 0.15s',
                  }}
                  title={label}
                >
                  {active && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <polyline points="2 7 5.5 10.5 12 3.5" stroke={['#FFFFFF', '#F5E6C8', '#E8D5D5', '#E8C4B8'].includes(hex) ? '#141414' : '#fff'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Custom hex input */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', fontSize: '13px' }}>#</span>
              <input
                value={customHex.replace('#', '')}
                onChange={e => setCustomHex(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addCustomHex()}
                placeholder="Custom hex (e.g. FF6B8A)"
                maxLength={6}
                style={{
                  width: '100%', padding: '10px 12px 10px 24px',
                  background: 'var(--bg-card)', border: '0.5px solid var(--border)',
                  borderRadius: '10px', color: 'var(--text-primary)',
                  fontSize: '13px', fontFamily: "'DM Sans', sans-serif",
                  outline: 'none', boxSizing: 'border-box',
                }}
              />
            </div>
            <button onClick={addCustomHex}
              style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap' }}
            >
              Add
            </button>
          </div>

          {/* Selected colors row */}
          {colors.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px', marginRight: '2px' }}>Selected:</span>
              {colors.map(hex => (
                <button key={hex} onClick={() => toggleColor(hex)}
                  style={{ width: '28px', height: '28px', borderRadius: '50%', background: hex, border: '1.5px solid var(--border)', cursor: 'pointer', padding: 0, position: 'relative', flexShrink: 0, boxShadow: hex === '#FFFFFF' ? 'inset 0 0 0 1px var(--border)' : 'none' }}
                  title="Remove"
                >
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.25)', borderRadius: '50%', opacity: 0 }}
                    onMouseEnter={e => e.currentTarget.style.opacity = '1'}
                    onMouseLeave={e => e.currentTarget.style.opacity = '0'}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><line x1="2" y1="2" x2="8" y2="8" stroke="#fff" strokeWidth="1.5"/><line x1="8" y1="2" x2="2" y2="8" stroke="#fff" strokeWidth="1.5"/></svg>
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
