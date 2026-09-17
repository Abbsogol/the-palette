'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'

const ACCENT = '#FF517F'
const WINE = '#260D14'
const GREEN = '#6CC882'
const WHITE60 = 'rgba(255,255,255,0.6)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })
const sectionLabel = { ...ui(600, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase' }
const chipStyle = (active) => ({
  background: active ? ACCENT : 'rgba(255,255,255,0.06)',
  ...ui(active ? 600 : 400, 13, active ? WINE : WHITE60),
  border: active ? 'none' : PANEL_BORDER,
  borderRadius: '1000px', padding: '7px 14px', cursor: 'pointer',
})

const VIBES = ['Dark & Moody', 'Soft & Minimal', 'Bold & Colourful', 'Glam', 'Y2K', 'Bridal', 'Coastal', 'Edgy']
const OCCASIONS = ['Everyday', 'Night Out', 'Wedding', 'Party', 'Office', 'Holiday', 'Summer', 'Date Night']

export default function PickMySetPage() {
  const router = useRouter()
  const [prompt, setPrompt] = useState('')
  const [selectedVibes, setSelectedVibes] = useState([])
  const [selectedOccasions, setSelectedOccasions] = useState([])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const toggleChip = (val, list, setList) => {
    setList(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])
  }

  const buildPrompt = () => {
    const parts = []
    if (prompt.trim()) parts.push(prompt.trim())
    if (selectedVibes.length) parts.push(`vibe: ${selectedVibes.join(', ')}`)
    if (selectedOccasions.length) parts.push(`occasion: ${selectedOccasions.join(', ')}`)
    return parts.join(' — ')
  }

  const handlePick = async () => {
    const combined = buildPrompt()
    if (!combined) return
    setLoading(true)
    setError('')
    setResults(null)
    setSaved(false)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setLoading(false)
      router.push('/profile')
      return
    }
    const res = await fetch('/api/pick-my-set', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ prompt: combined }),
    })
    const data = await res.json()
    setLoading(false)
    if (data.error) { setError(data.error); return }
    setResults(data.designs || [])
  }

  const handleSaveToMoodboard = async () => {
    if (!results?.length || saving) return
    setSaving(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user) { router.push('/profile'); return }

    const boardName = `My Set — ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    const { data: board, error: boardError } = await supabase
      .from('moodboards')
      .insert({ user_id: session.user.id, name: boardName, is_public: false })
      .select().single()

    if (boardError || !board) {
      setError('Failed to save board. Please try again.')
      setSaving(false)
      return
    }

    // moodboard_designs is (moodboard_id, design_id) — the old insert also
    // passed a `position` column that doesn't exist, so every attach failed
    // (PGRST204) and left an empty board. Dedupe the picks, attach them in
    // ONE batch, and roll the board back on any failure so a partial failure
    // leaves nothing, not an empty husk.
    const seen = new Set()
    const rows = results
      .filter(d => d?.id && !seen.has(d.id) && seen.add(d.id))
      .map(d => ({ moodboard_id: board.id, design_id: d.id }))
    const { error: attachError } = await supabase.from('moodboard_designs').insert(rows)
    if (attachError) {
      await supabase.from('moodboards').delete().eq('id', board.id)
      setError("Couldn't save your set. Please try again.")
      setSaving(false)
      return
    }
    setSaved(true)
    setSaving(false)
  }

  const canPick = prompt.trim() || selectedVibes.length || selectedOccasions.length

  return (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 8px' }}>
          <BackButton fallback="/feed" />
          <div>
            <p style={{ ...sectionLabel, margin: '0 0 2px' }}>AI Stylist</p>
            <h1 style={{ ...display(24), margin: 0 }}>Pick My Set</h1>
          </div>
        </div>
        <p style={{ ...ui(300, 14, WHITE60), padding: '0 20px 20px', margin: 0 }}>Describe what you&apos;re going for and we&apos;ll pick your perfect nail set</p>

        <div style={{ padding: '0 20px' }}>

          {/* Text input */}
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="e.g. something dark and edgy for a night out, or soft nude nails for my wedding…"
            rows={3}
            style={{
              width: '100%', background: 'rgba(255,255,255,0.04)', border: PANEL_BORDER,
              borderRadius: '14px', padding: '14px 16px', ...ui(400, 14), resize: 'none',
              boxSizing: 'border-box', outline: 'none', lineHeight: 1.6, marginBottom: '16px',
            }}
          />

          {/* Vibe chips */}
          <p style={{ ...sectionLabel, color: WHITE60, display: 'block', margin: '0 0 8px' }}>Vibe</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
            {VIBES.map(v => (
              <button key={v} onClick={() => toggleChip(v, selectedVibes, setSelectedVibes)} style={chipStyle(selectedVibes.includes(v))}>{v}</button>
            ))}
          </div>

          {/* Occasion chips */}
          <p style={{ ...sectionLabel, color: WHITE60, display: 'block', margin: '0 0 8px' }}>Occasion</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
            {OCCASIONS.map(o => (
              <button key={o} onClick={() => toggleChip(o, selectedOccasions, setSelectedOccasions)} style={chipStyle(selectedOccasions.includes(o))}>{o}</button>
            ))}
          </div>

          {/* Pick button */}
          <button
            onClick={handlePick}
            disabled={!canPick || loading}
            style={{
              width: '100%', padding: '15px', background: canPick ? BTN_GRADIENT : 'rgba(255,255,255,0.08)',
              ...ui(600, 15, canPick ? 'var(--lq-white)' : WHITE60),
              border: 'none', borderRadius: '1000px',
              cursor: canPick && !loading ? 'pointer' : 'not-allowed', marginBottom: '24px',
            }}
          >
            {loading ? '✦ Finding your set…' : '✦ Pick my set'}
          </button>

          {error && <p style={{ ...ui(400, 13, '#FF8DA8'), marginBottom: '16px', textAlign: 'center' }}>{error}</p>}

          {/* Results */}
          {results && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <p style={{ ...sectionLabel, color: WHITE60, margin: 0 }}>
                  Your set · {results.length} designs
                </p>
                {results.length > 0 && (
                  <button
                    onClick={handleSaveToMoodboard}
                    disabled={saving || saved}
                    style={{
                      background: saved ? 'rgba(108,200,130,0.15)' : PANEL,
                      ...ui(500, 12, saved ? GREEN : ACCENT),
                      border: saved ? '1px solid rgba(108,200,130,0.3)' : PANEL_BORDER,
                      borderRadius: '1000px', padding: '6px 14px', cursor: saving || saved ? 'default' : 'pointer',
                    }}
                  >
                    {saved ? '✓ Saved to moodboard' : saving ? 'Saving…' : '+ Save to moodboard'}
                  </button>
                )}
              </div>

              {results.length === 0 ? (
                <p style={{ ...ui(300, 14, WHITE60), textAlign: 'center', padding: '32px 0' }}>
                  No matches found — try a different description.
                </p>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {results.map(design => (
                    <Link key={design.id} href={`/design/${design.id}?from=%2Fpick-my-set`} style={{ textDecoration: 'none', background: PANEL, borderRadius: '14px', border: PANEL_BORDER, overflow: 'hidden', display: 'block' }}>
                      {design.image_url ? (
                        <div style={{ width: '100%', aspectRatio: design.image_width && design.image_height ? `${design.image_width} / ${design.image_height}` : '1 / 1', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                          <img src={design.image_url} alt={design.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        </div>
                      ) : (
                        <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.06)' }} />
                      )}
                      <div style={{ padding: '10px 12px 12px' }}>
                        <p style={{ ...ui(500, 13), margin: '0 0 4px', lineHeight: 1.3 }}>{design.title}</p>
                        <p style={{ ...ui(500, 10, ACCENT), letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
                          {design.shape} · {design.occasion?.split(',')[0]?.trim()}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {results.length > 0 && (
                <button
                  onClick={() => { setResults(null); setPrompt(''); setSelectedVibes([]); setSelectedOccasions([]); setSaved(false) }}
                  style={{ width: '100%', marginTop: '16px', padding: '13px', background: 'none', border: PANEL_BORDER, borderRadius: '1000px', ...ui(400, 14, WHITE60), cursor: 'pointer' }}
                >
                  Start over
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
