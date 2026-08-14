'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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

    const results2 = await Promise.all(results.map((d, i) =>
      supabase.from('moodboard_designs').insert({ moodboard_id: board.id, design_id: d.id, position: i })
    ))
    if (results2.some(r => r.error)) {
      setError('Board saved, but some designs failed to save to it. Please try again.')
    } else {
      setSaved(true)
    }
    setSaving(false)
  }

  const canPick = prompt.trim() || selectedVibes.length || selectedOccasions.length

  return (
    <div style={{ paddingBottom: '100px', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ padding: '24px 20px 20px' }}>
        <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 4px' }}>AI Stylist</p>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', letterSpacing: '-0.02em', margin: '0 0 6px' }}>Pick My Set</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Describe what you're going for and we'll pick your perfect nail set</p>
      </div>

      <div style={{ padding: '0 20px' }}>

        {/* Text input */}
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          placeholder="e.g. something dark and edgy for a night out, or soft nude nails for my wedding…"
          rows={3}
          style={{
            width: '100%', background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: '14px', padding: '14px 16px', color: 'var(--text-primary)',
            fontSize: '14px', fontFamily: "'DM Sans', sans-serif", resize: 'none',
            boxSizing: 'border-box', outline: 'none', lineHeight: '1.6', marginBottom: '16px',
          }}
        />

        {/* Vibe chips */}
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>Vibe</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px' }}>
          {VIBES.map(v => (
            <button key={v} onClick={() => toggleChip(v, selectedVibes, setSelectedVibes)} style={{
              background: selectedVibes.includes(v) ? 'var(--accent)' : 'var(--bg-card)',
              color: selectedVibes.includes(v) ? '#2C0A1E' : 'var(--text-secondary)',
              border: `0.5px solid ${selectedVibes.includes(v) ? 'transparent' : 'var(--border)'}`,
              borderRadius: '20px', padding: '7px 14px', fontSize: '13px',
              fontWeight: selectedVibes.includes(v) ? '600' : '400',
              fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
            }}>{v}</button>
          ))}
        </div>

        {/* Occasion chips */}
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>Occasion</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
          {OCCASIONS.map(o => (
            <button key={o} onClick={() => toggleChip(o, selectedOccasions, setSelectedOccasions)} style={{
              background: selectedOccasions.includes(o) ? 'var(--accent)' : 'var(--bg-card)',
              color: selectedOccasions.includes(o) ? '#2C0A1E' : 'var(--text-secondary)',
              border: `0.5px solid ${selectedOccasions.includes(o) ? 'transparent' : 'var(--border)'}`,
              borderRadius: '20px', padding: '7px 14px', fontSize: '13px',
              fontWeight: selectedOccasions.includes(o) ? '600' : '400',
              fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
            }}>{o}</button>
          ))}
        </div>

        {/* Pick button */}
        <button
          onClick={handlePick}
          disabled={!canPick || loading}
          style={{
            width: '100%', padding: '15px', background: canPick ? 'var(--accent)' : 'var(--bg-chip)',
            color: canPick ? '#2C0A1E' : 'var(--text-secondary)',
            border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '600',
            fontFamily: "'DM Sans', sans-serif",
            cursor: canPick && !loading ? 'pointer' : 'not-allowed',
            marginBottom: '24px',
          }}
        >
          {loading ? '✦ Finding your set…' : '✦ Pick my set'}
        </button>

        {error && <p style={{ color: '#E07070', fontSize: '13px', marginBottom: '16px', textAlign: 'center' }}>{error}</p>}

        {/* Results */}
        {results && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>
                Your set · {results.length} designs
              </p>
              {results.length > 0 && (
                <button
                  onClick={handleSaveToMoodboard}
                  disabled={saving || saved}
                  style={{
                    background: saved ? 'rgba(100,200,130,0.15)' : 'var(--bg-card)',
                    color: saved ? '#6CC882' : 'var(--accent)',
                    border: `0.5px solid ${saved ? 'rgba(100,200,130,0.3)' : 'var(--border)'}`,
                    borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: '500',
                    fontFamily: "'DM Sans', sans-serif", cursor: saving || saved ? 'default' : 'pointer',
                  }}
                >
                  {saved ? '✓ Saved to moodboard' : saving ? 'Saving…' : '+ Save to moodboard'}
                </button>
              )}
            </div>

            {results.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>
                No matches found — try a different description.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {results.map(design => (
                  <Link key={design.id} href={`/design/${design.id}?from=%2Fpick-my-set`} style={{ textDecoration: 'none', background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden', display: 'block' }}>
                    {design.image_url ? (
                      <div style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden' }}>
                        <img src={design.image_url} alt={design.title} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                      </div>
                    ) : (
                      <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--bg-chip)' }} />
                    )}
                    <div style={{ padding: '10px 12px 12px' }}>
                      <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: '0 0 4px', lineHeight: '1.3' }}>{design.title}</p>
                      <p style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>
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
                style={{ width: '100%', marginTop: '16px', padding: '13px', background: 'none', border: '0.5px solid var(--border)', borderRadius: '12px', color: 'var(--text-secondary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}
              >
                Start over
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
