'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, getNailLabSignedUrls } from '@/lib/supabase'
import SaveToBoard from '@/components/SaveToBoard'
import { LaqueWordmark } from '@/components/ui/icons'

// ── Page palette from the Lab frames (237:1752 / 239:1800) ─────────────────
const LAB_ACCENT = '#D98CAB'
const PANEL = 'rgba(255, 255, 255, 0.06)'
const PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.1)'
const MUTED50 = 'rgba(255, 255, 255, 0.5)'
const MUTED60 = 'rgba(255, 255, 255, 0.6)'
const WHITE80 = 'rgba(255, 255, 255, 0.8)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.3,
})

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// Same fixed rosy-blur backdrop as the Lab builder (frame 239:1800).
function LabShell({ children }) {
  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden style={{
        position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px', zIndex: 0, overflow: 'hidden',
        // Dark wine base (Sogol 2026-08-24) with the Lab's rosy vertical
        // glow kept as gradient character — replaces the light bitmap.
        background: [
          'radial-gradient(70% 42% at 62% 30%, rgba(217,140,171,0.18) 0%, rgba(217,140,171,0) 65%)',
          'radial-gradient(90% 55% at 25% 85%, rgba(102,0,7,0.5) 0%, rgba(102,0,7,0) 70%)',
          'linear-gradient(180deg, #2E1119 0%, #260D14 55%, #1C0910 100%)',
        ].join(', '),
      }}>
        <div className="lq-grain" />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}

export default function NailLabHistoryPage() {
  const [currentUser, setCurrentUser] = useState(null)
  const [loadingUser, setLoadingUser] = useState(true)
  const [generations, setGenerations] = useState([])
  const [loadingGens, setLoadingGens] = useState(true)

  // Expanded item sheet
  const [selected, setSelected] = useState(null) // generation object
  const [publishedIds, setPublishedIds] = useState({}) // generationId → designId
  const [publishStatuses, setPublishStatuses] = useState({}) // generationId → 'draft'|'published'
  const [showPublishSheet, setShowPublishSheet] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [showNailTechSheet, setShowNailTechSheet] = useState(false)
  const [showSaveBoard, setShowSaveBoard] = useState(false)
  const [savingToBoard, setSavingToBoard] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.user) { setLoadingUser(false); return }
      setCurrentUser(session.user)
      setLoadingUser(false)

      const { data, error } = await supabase
        .from('nail_lab_generations')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) console.error('nail-lab history fetch failed:', error)
      const gens = data || []
      // nail-lab is a private bucket; resolve fresh signed URLs for the
      // stored references in one batched storage call instead of one per row.
      const signedUrlMap = await getNailLabSignedUrls(gens.map(g => g.image_url))
      const withSignedUrls = gens.map(g => ({ ...g, image_url: signedUrlMap[g.image_url] ?? null }))
      setGenerations(withSignedUrls)
      setLoadingGens(false)
    }
    load()
  }, [])

  // Publishing needs to copy the file into the public designs bucket and
  // create/update the designs row, all via a service-role backend route —
  // the local image_url is a signed URL resolved for display and isn't a
  // stable reference, and the designs table's write policies aren't
  // reliably reachable from the anon client for this cross-bucket flow.
  const publishGeneration = async (generationId, designId, asDraft) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/publish-nail-lab-generation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ generationId, designId, asDraft }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Failed to save design')
    return data
  }

  const ensureDesignId = async (gen) => {
    if (publishedIds[gen.id]) return publishedIds[gen.id]
    try {
      const data = await publishGeneration(gen.id, null, true)
      setPublishedIds(prev => ({ ...prev, [gen.id]: data.designId }))
      setPublishStatuses(prev => ({ ...prev, [gen.id]: 'draft' }))
      return data.designId
    } catch (e) {
      alert(e.message || 'Failed to save design')
      return null
    }
  }

  const publishDesign = async (asDraft) => {
    if (!selected) return
    setPublishing(true)
    try {
      const existingId = publishedIds[selected.id]
      const data = await publishGeneration(selected.id, existingId || null, asDraft)
      setPublishedIds(prev => ({ ...prev, [selected.id]: data.designId }))
      setPublishStatuses(prev => ({ ...prev, [selected.id]: data.isPublished ? 'published' : 'draft' }))
    } catch (e) {
      alert(e.message || 'Failed to save design')
    } finally {
      setPublishing(false)
      setShowPublishSheet(false)
    }
  }

  if (loadingUser) {
    return (
      <LabShell>
        <div style={{ padding: '48px 24px', textAlign: 'center' }}><p style={ui(300, 14, MUTED60)}>Loading...</p></div>
      </LabShell>
    )
  }

  if (!currentUser) {
    return (
      <LabShell>
        <div style={{ padding: 'calc(env(safe-area-inset-top) + 64px) 32px 140px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ ...ui(600, 20), margin: 0 }}>Sign in to view your history</h2>
          <Link href="/profile" style={{ display: 'inline-block', background: BTN_GRADIENT, borderRadius: '24px', padding: '13px 32px', ...ui(600, 14), textDecoration: 'none', marginTop: '8px' }}>Sign in</Link>
        </div>
      </LabShell>
    )
  }

  const selectedVibes = selected ? (Array.isArray(selected.vibe) ? selected.vibe : [selected.vibe]) : []
  const selectedOccasions = selected ? (Array.isArray(selected.occasion) ? selected.occasion : selected.occasion ? [selected.occasion] : []) : []
  const selectedColors = selected?.colors || []
  const publishStatus = selected ? publishStatuses[selected.id] : null
  const publishedDesignId = selected ? publishedIds[selected.id] : null

  // Two flex columns per frame 239:1800 (masonry-style split, not grid rows)
  const colA = generations.filter((_, i) => i % 2 === 0)
  const colB = generations.filter((_, i) => i % 2 === 1)

  const genCard = (gen) => {
    const vibes = Array.isArray(gen.vibe) ? gen.vibe : [gen.vibe]
    const status = publishStatuses[gen.id]
    return (
      <button
        key={gen.id}
        onClick={() => setSelected(gen)}
        style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '24px', padding: '12px', cursor: 'pointer', textAlign: 'left', position: 'relative', display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', boxSizing: 'border-box' }}
      >
        <div style={{ aspectRatio: '4/3', background: 'rgba(255,255,255,0.08)', overflow: 'hidden', borderRadius: '12px', width: '100%', position: 'relative' }}>
          {gen.image_url && (
            <img src={gen.image_url} alt="Generated design" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          )}
          {status && (
            <span style={{ position: 'absolute', top: '8px', right: '8px', background: status === 'published' ? LAB_ACCENT : 'rgba(20,3,8,0.75)', color: status === 'published' ? '#260D14' : WHITE80, fontSize: '9px', fontWeight: '600', borderRadius: '8px', padding: '3px 7px', fontFamily: 'var(--lq-font-ui)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              {status === 'published' ? '✦ Live' : 'Draft'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', width: '100%' }}>
          <p style={{ ...ui(500, 14), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
            {vibes.join(' + ')}
          </p>
          <p style={{ ...ui(300, 13, WHITE80), margin: 0 }}>
            {gen.shape} · {gen.length} · {timeAgo(gen.created_at)}
          </p>
        </div>
      </button>
    )
  }

  return (
    <>
      {/* ── NAIL TECH SHEET ── */}
      {showNailTechSheet && selected && (
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
                { label: 'Vibe', value: selectedVibes.join(', ') },
                { label: 'Shape', value: selected.shape },
                { label: 'Length', value: selected.length },
                selectedOccasions.length > 0 ? { label: 'Occasion', value: selectedOccasions.join(', ') } : null,
                selected.custom_text ? { label: 'Notes', value: selected.custom_text } : null,
              ].filter(Boolean).map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '13px 0', borderBottom: PANEL_BORDER }}>
                  <span style={{ ...ui(300, 13, MUTED60), flexShrink: 0 }}>{label}</span>
                  <span style={{ ...ui(500, 13), textAlign: 'right', maxWidth: '220px' }}>{value}</span>
                </div>
              ))}
              {selectedColors.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: PANEL_BORDER }}>
                  <span style={ui(300, 13, MUTED60)}>Colours</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {selectedColors.map(hex => (
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
                  const specs = [`Vibe: ${selectedVibes.join(', ')}`, `Shape: ${selected.shape}`, `Length: ${selected.length}`, selectedColors.length > 0 && `Colours: ${selectedColors.join(', ')}`, selectedOccasions.length > 0 && `Occasion: ${selectedOccasions.join(', ')}`, selected.custom_text && `Notes: ${selected.custom_text}`].filter(Boolean).join('\n')
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
      {showPublishSheet && selected && (
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

      {/* SaveToBoard */}
      {publishedDesignId && selected && (
        <SaveToBoard
          designId={publishedDesignId}
          designImageUrl={selected.image_url}
          externalOpen={showSaveBoard}
          onClose={() => setShowSaveBoard(false)}
          renderTrigger={null}
        />
      )}

      {/* ── EXPANDED DETAIL SHEET ── */}
      {selected && !showPublishSheet && !showNailTechSheet && !showSaveBoard && (
        <div onClick={() => setSelected(null)}
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(20,3,8,0.75)' }}
        >
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'linear-gradient(180deg, #29000A 0%, #260D14 100%)', borderRadius: '24px 24px 0 0', maxHeight: '92vh', overflowY: 'auto', paddingBottom: '40px' }}
          >
            {/* Handle + close */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>
              <div style={{ width: '36px', height: '4px', background: 'rgba(255,255,255,0.2)', borderRadius: '2px' }} />
            </div>

            {/* Image */}
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ borderRadius: '16px', overflow: 'hidden', border: PANEL_BORDER, background: PANEL }}>
                <img src={selected.image_url} alt="Generated design" style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
            </div>

            {/* Tags */}
            <div style={{ padding: '0 16px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
              {[...selectedVibes, selected.shape, selected.length, ...selectedOccasions].filter(Boolean).map(tag => (
                <span key={tag} style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '12px', padding: '4px 10px', ...ui(300, 11, MUTED60) }}>{tag}</span>
              ))}
              {publishStatus && (
                <span style={{ background: publishStatus === 'published' ? 'rgba(217,140,171,0.2)' : PANEL, color: publishStatus === 'published' ? LAB_ACCENT : MUTED60, borderRadius: '12px', padding: '4px 10px', fontSize: '11px', border: publishStatus === 'published' ? `1px solid ${LAB_ACCENT}` : PANEL_BORDER, fontFamily: 'var(--lq-font-ui)' }}>
                  {publishStatus === 'published' ? '✦ Published' : 'Draft'}
                </span>
              )}
              <span style={{ ...ui(300, 11, MUTED50), padding: '4px 2px' }}>{timeAgo(selected.created_at)}</span>
            </div>

            {/* 4 action buttons */}
            <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              {/* Save to Board */}
              <button
                onClick={async () => { setSavingToBoard(true); const id = await ensureDesignId(selected); setSavingToBoard(false); if (id) setShowSaveBoard(true) }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '14px 8px', cursor: 'pointer', color: 'var(--lq-white)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                </svg>
                <span style={ui(300, 10, MUTED60)}>{savingToBoard ? '...' : 'Board'}</span>
              </button>

              {/* Share */}
              <button
                onClick={() => { if (navigator.share) { navigator.share({ title: `${selectedVibes.join(' + ')} nails · laQue`, url: selected.image_url }) } else { navigator.clipboard?.writeText(selected.image_url) } }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '14px 8px', cursor: 'pointer', color: 'var(--lq-white)' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                <span style={ui(300, 10, MUTED60)}>Share</span>
              </button>

              {/* Nail Tech */}
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

            {/* Close */}
            <div style={{ padding: '0 16px' }}>
              <button onClick={() => setSelected(null)}
                style={{ width: '100%', background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '13px', ...ui(400, 14, MUTED60), cursor: 'pointer' }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN PAGE ── */}
      <LabShell>
        <div style={{ padding: 'calc(env(safe-area-inset-top) + 12px) 24px calc(env(safe-area-inset-bottom) + 120px)', display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Header row: back / wordmark / spacer (frame 239:1800) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Link href="/nail-lab" aria-label="Back to Nail Lab"
                style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px', padding: '8px', display: 'flex', color: 'var(--lq-white)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="15 18 9 12 15 6"/>
                </svg>
              </Link>
              <span style={{ color: 'var(--lq-white)', display: 'flex' }}><LaqueWordmark height={24} /></span>
              <span style={{ width: '32px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h1 style={{ ...ui(500, 28), margin: 0 }}>My Generations</h1>
              {!loadingGens && <p style={{ ...ui(300, 16, WHITE80), margin: 0 }}>{generations.length} design{generations.length !== 1 ? 's' : ''}</p>}
            </div>
          </div>

          {/* Grid */}
          {loadingGens ? (
            <p style={{ ...ui(300, 14, MUTED60), textAlign: 'center', padding: '48px 0' }}>Loading your designs...</p>
          ) : generations.length === 0 ? (
            <div style={{ padding: '48px 8px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: LAB_ACCENT, fontSize: '36px' }}>✦</span>
              <p style={{ ...ui(500, 16), margin: 0 }}>No designs yet</p>
              <p style={{ ...ui(300, 14, MUTED60), margin: 0 }}>Generate your first design in the Nail Lab</p>
              <Link href="/nail-lab" style={{ display: 'inline-block', marginTop: '8px', background: BTN_GRADIENT, borderRadius: '24px', padding: '12px 28px', ...ui(600, 14), textDecoration: 'none' }}>
                Go to Nail Lab
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {colA.map(genCard)}
              </div>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {colB.map(genCard)}
              </div>
            </div>
          )}
        </div>
      </LabShell>
    </>
  )
}
