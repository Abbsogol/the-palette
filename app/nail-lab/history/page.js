'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase, getNailLabSignedUrl } from '@/lib/supabase'
import SaveToBoard from '@/components/SaveToBoard'

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
      // nail-lab is a private bucket; resolve a fresh signed URL for each
      // stored reference so the images actually display.
      const withSignedUrls = await Promise.all(
        gens.map(async g => ({ ...g, image_url: await getNailLabSignedUrl(g.image_url) }))
      )
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
    return <div style={{ padding: '48px 20px', textAlign: 'center' }}><p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p></div>
  }

  if (!currentUser) {
    return (
      <div style={{ padding: '64px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
        <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '600', margin: 0 }}>Sign in to view your history</h2>
        <Link href="/profile" style={{ display: 'inline-block', background: 'var(--accent)', color: '#2C0A1E', borderRadius: '14px', padding: '13px 32px', fontSize: '14px', fontWeight: '600', textDecoration: 'none', marginTop: '8px', fontFamily: "'DM Sans', sans-serif" }}>Sign in</Link>
      </div>
    )
  }

  const selectedVibes = selected ? (Array.isArray(selected.vibe) ? selected.vibe : [selected.vibe]) : []
  const selectedOccasions = selected ? (Array.isArray(selected.occasion) ? selected.occasion : selected.occasion ? [selected.occasion] : []) : []
  const selectedColors = selected?.colors || []
  const publishStatus = selected ? publishStatuses[selected.id] : null
  const publishedDesignId = selected ? publishedIds[selected.id] : null

  return (
    <>
      {/* ── NAIL TECH SHEET ── */}
      {showNailTechSheet && selected && (
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
                { label: 'Vibe', value: selectedVibes.join(', ') },
                { label: 'Shape', value: selected.shape },
                { label: 'Length', value: selected.length },
                selectedOccasions.length > 0 ? { label: 'Occasion', value: selectedOccasions.join(', ') } : null,
                selected.custom_text ? { label: 'Notes', value: selected.custom_text } : null,
              ].filter(Boolean).map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '13px 0', borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", flexShrink: 0 }}>{label}</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif", textAlign: 'right', maxWidth: '220px' }}>{value}</span>
                </div>
              ))}
              {selectedColors.length > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '13px 0', borderBottom: '0.5px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif" }}>Colours</span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {selectedColors.map(hex => (
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
                  const specs = [`Vibe: ${selectedVibes.join(', ')}`, `Shape: ${selected.shape}`, `Length: ${selected.length}`, selectedColors.length > 0 && `Colours: ${selectedColors.join(', ')}`, selectedOccasions.length > 0 && `Occasion: ${selectedOccasions.join(', ')}`, selected.custom_text && `Notes: ${selected.custom_text}`].filter(Boolean).join('\n')
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
      {showPublishSheet && selected && (
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
          style={{ position: 'fixed', inset: 0, zIndex: 300, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', background: 'rgba(0,0,0,0.75)' }}
        >
          <div onClick={e => e.stopPropagation()}
            style={{ background: 'var(--bg-primary)', borderRadius: '20px 20px 0 0', maxHeight: '92vh', overflowY: 'auto', paddingBottom: '40px' }}
          >
            {/* Handle + close */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 4px' }}>
              <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '2px' }} />
            </div>

            {/* Image */}
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ borderRadius: '14px', overflow: 'hidden', border: '0.5px solid var(--border)', background: 'var(--bg-card)' }}>
                <img src={selected.image_url} alt="Generated design" style={{ width: '100%', height: 'auto', display: 'block' }} />
              </div>
            </div>

            {/* Tags */}
            <div style={{ padding: '0 16px 16px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {[...selectedVibes, selected.shape, selected.length, ...selectedOccasions].filter(Boolean).map(tag => (
                <span key={tag} style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)', borderRadius: '12px', padding: '4px 10px', fontSize: '11px', fontFamily: "'DM Sans', sans-serif" }}>{tag}</span>
              ))}
              {publishStatus && (
                <span style={{ background: publishStatus === 'published' ? 'rgba(212,160,192,0.15)' : 'var(--bg-chip)', color: publishStatus === 'published' ? 'var(--accent)' : 'var(--text-secondary)', borderRadius: '12px', padding: '4px 10px', fontSize: '11px', border: publishStatus === 'published' ? '0.5px solid var(--accent)' : 'none', fontFamily: "'DM Sans', sans-serif" }}>
                  {publishStatus === 'published' ? '✦ Published' : 'Draft'}
                </span>
              )}
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px', padding: '4px 2px', fontFamily: "'DM Sans', sans-serif" }}>{timeAgo(selected.created_at)}</span>
            </div>

            {/* 4 action buttons */}
            <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '8px', marginBottom: '14px' }}>
              {/* Save to Board */}
              <button
                onClick={async () => { setSavingToBoard(true); const id = await ensureDesignId(selected); setSavingToBoard(false); if (id) setShowSaveBoard(true) }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '14px 8px', cursor: 'pointer' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                </svg>
                <span style={{ color: 'var(--text-secondary)', fontSize: '10px', fontFamily: "'DM Sans', sans-serif" }}>{savingToBoard ? '...' : 'Board'}</span>
              </button>

              {/* Share */}
              <button
                onClick={() => { if (navigator.share) { navigator.share({ title: `${selectedVibes.join(' + ')} nails · Laque`, url: selected.image_url }) } else { navigator.clipboard?.writeText(selected.image_url) } }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '14px 8px', cursor: 'pointer' }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
                <span style={{ color: 'var(--text-secondary)', fontSize: '10px', fontFamily: "'DM Sans', sans-serif" }}>Share</span>
              </button>

              {/* Nail Tech */}
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

            {/* Close */}
            <div style={{ padding: '0 16px' }}>
              <button onClick={() => setSelected(null)}
                style={{ width: '100%', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '13px', color: 'var(--text-secondary)', fontSize: '14px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN PAGE ── */}
      <div style={{ paddingBottom: '100px' }}>
        {/* Header */}
        <div style={{ padding: '24px 20px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/nail-lab" style={{ display: 'flex', alignItems: 'center', color: 'var(--text-secondary)', textDecoration: 'none' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </Link>
          <div>
            <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '500', letterSpacing: '-0.02em', margin: 0 }}>My Generations</h1>
            {!loadingGens && <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '2px 0 0' }}>{generations.length} design{generations.length !== 1 ? 's' : ''}</p>}
          </div>
        </div>

        {/* Grid */}
        {loadingGens ? (
          <div style={{ padding: '48px 20px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading your designs...</p>
          </div>
        ) : generations.length === 0 ? (
          <div style={{ padding: '64px 32px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '40px' }}>✦</div>
            <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '500', margin: 0 }}>No designs yet</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Generate your first design in the Nail Lab</p>
            <Link href="/nail-lab" style={{ display: 'inline-block', marginTop: '8px', background: 'var(--accent)', color: '#2C0A1E', borderRadius: '14px', padding: '12px 28px', fontSize: '14px', fontWeight: '600', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
              Go to Nail Lab
            </Link>
          </div>
        ) : (
          <div style={{ padding: '0 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {generations.map(gen => {
              const vibes = Array.isArray(gen.vibe) ? gen.vibe : [gen.vibe]
              const status = publishStatuses[gen.id]
              return (
                <button
                  key={gen.id}
                  onClick={() => setSelected(gen)}
                  style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', overflow: 'hidden', padding: 0, cursor: 'pointer', textAlign: 'left', position: 'relative' }}
                >
                  {/* Image */}
                  <div style={{ aspectRatio: '3/2', background: 'var(--bg-chip)', overflow: 'hidden' }}>
                    {gen.image_url && (
                      <img src={gen.image_url} alt="Generated design" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    )}
                  </div>

                  {/* Status badge */}
                  {status && (
                    <div style={{ position: 'absolute', top: '8px', right: '8px', background: status === 'published' ? 'var(--accent)' : 'rgba(20,20,20,0.75)', color: status === 'published' ? '#2C0A1E' : 'var(--text-secondary)', fontSize: '9px', fontWeight: '600', borderRadius: '8px', padding: '3px 7px', fontFamily: "'DM Sans', sans-serif", letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                      {status === 'published' ? '✦ Live' : 'Draft'}
                    </div>
                  )}

                  {/* Info */}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', margin: '0 0 3px', fontFamily: "'DM Sans', sans-serif", whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {vibes.join(' + ')}
                    </p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>
                      {gen.shape} · {gen.length} · {timeAgo(gen.created_at)}
                    </p>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
