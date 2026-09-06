'use client'

// /saved — the full home of hearted designs + collections (extrapolated, no
// frame; Sogol 2026-09-06). Sections, not tabs: collections rail on top,
// saved grid below, matching Home's rail+grid IA. Board creation lives here
// now that /moodboards redirects. Rail includes boards shared with you
// (moodboard_members) so invited boards stay reachable.

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Sheet from '@/components/ui/Sheet'
import DesignCard from '@/components/ui/DesignCard'
import SaveToBoard from '@/components/SaveToBoard'
import { LaqueWordmark } from '@/components/ui/icons'

const FolderIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
  </svg>
)

const PANEL = 'rgba(255, 255, 255, 0.06)'
const PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.1)'
const WHITE80 = 'rgba(255, 255, 255, 0.8)'
const WHITE60 = 'rgba(255, 255, 255, 0.6)'
const ACCENT = '#FF517F'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.3,
})
const display = (size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color,
})
const sectionLabel = { ...ui(500, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }

function Shell({ children }) {
  return (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

export default function SavedPage() {
  const [user, setUser] = useState(null)
  const [designs, setDesigns] = useState([])
  const [boards, setBoards] = useState([])       // { ...board, __shared, __ownerName }
  const [boardCounts, setBoardCounts] = useState({})
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Restore scroll position
  useEffect(() => {
    if (!loading) {
      const saved = sessionStorage.getItem('saved-scroll')
      if (saved) {
        setTimeout(() => {
          window.scrollTo(0, parseInt(saved))
          sessionStorage.removeItem('saved-scroll')
        }, 50)
      }
    }
  }, [loading])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) loadAll(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session?.user) loadAll(session.user.id)
      else { setDesigns([]); setBoards([]); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadAll = async (userId) => {
    setLoading(true)
    const [{ data: saved, error: savedError }, { data: ownBoards, error: boardsError }, { data: memberRows }] = await Promise.all([
      supabase.from('saved_designs').select('design_id, designs(*)').eq('user_id', userId).order('saved_at', { ascending: false }).limit(200),
      supabase.from('moodboards').select('id, name, cover_image_url, user_id').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
      supabase.from('moodboard_members').select('moodboard_id, moodboards(id, name, cover_image_url, user_id)').eq('user_id', userId),
    ])
    if (savedError) console.error('saved designs fetch failed:', savedError)
    if (boardsError) console.error('moodboards fetch failed:', boardsError)
    setDesigns(saved?.map(d => d.designs).filter(Boolean) || [])

    const shared = (memberRows || []).map(r => r.moodboards).filter(Boolean).filter(b => b.user_id !== userId)
    let ownerNames = {}
    if (shared.length) {
      const { data: owners } = await supabase.from('profiles').select('id, display_name, username').in('id', [...new Set(shared.map(b => b.user_id))])
      owners?.forEach(o => { ownerNames[o.id] = o.display_name || o.username })
    }
    const all = [
      ...(ownBoards || []).map(b => ({ ...b, __shared: false })),
      ...shared.map(b => ({ ...b, __shared: true, __ownerName: ownerNames[b.user_id] || 'someone' })),
    ]
    setBoards(all)

    if (all.length) {
      const { data: countData } = await supabase
        .from('moodboard_designs')
        .select('moodboard_id')
        .in('moodboard_id', all.map(b => b.id))
      const c = {}
      countData?.forEach(r => { c[r.moodboard_id] = (c[r.moodboard_id] || 0) + 1 })
      setBoardCounts(c)
    }
    setLoading(false)
  }

  // Same insert the old /moodboards index ran — creation moved here with the redirect.
  const createBoard = async () => {
    if (!newName.trim() || !user || creating) return
    setCreating(true)
    setCreateError('')
    const { data, error } = await supabase
      .from('moodboards')
      .insert({ user_id: user.id, name: newName.trim(), is_public: false })
      .select('id, name, cover_image_url, user_id')
      .single()
    if (error || !data) {
      setCreateError('Failed to create board. Please try again.')
    } else {
      setBoards(prev => [{ ...data, __shared: false }, ...prev])
      setNewName('')
      setCreateOpen(false)
    }
    setCreating(false)
  }

  const removeDesign = (id) => setDesigns(prev => prev.filter(d => d.id !== id))

  const header = (
    <div style={{ padding: 'calc(env(safe-area-inset-top) + 20px) 24px 0', textAlign: 'center' }}>
      <span style={{ color: 'var(--lq-white)', display: 'inline-flex' }}><LaqueWordmark height={24} /></span>
    </div>
  )

  if (loading) return (
    <Shell>
      {header}
      <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={ui(300, 14, WHITE60)}>Loading…</p>
      </div>
    </Shell>
  )

  if (!user) return (
    <Shell>
      {header}
      <div style={{ padding: '32px 24px' }}>
        <h1 style={{ ...display(28), margin: '0 0 24px' }}>Saved</h1>
        <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '32px 20px', textAlign: 'center' }}>
          <p style={{ ...ui(400, 15), marginBottom: '8px' }}>Save your favourites</p>
          <p style={{ ...ui(300, 13, WHITE60), lineHeight: 1.6, marginBottom: '20px' }}>Sign in to save designs and collect them into boards.</p>
          <Link href="/profile" style={{ display: 'inline-block', background: BTN_GRADIENT, borderRadius: '1000px', padding: '13px 28px', ...ui(500, 14), textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    </Shell>
  )

  const cols = [[], []]
  designs.forEach((d, i) => cols[i % 2].push(d))

  return (
    <Shell>
      {header}
      <div style={{ padding: '24px 24px calc(env(safe-area-inset-bottom) + 120px)' }}>
        <h1 style={{ ...display(28), margin: '0 0 4px' }}>Saved</h1>
        <p style={{ ...ui(300, 13, WHITE60), margin: '0 0 28px' }}>
          {designs.length} design{designs.length !== 1 ? 's' : ''} · {boards.length} board{boards.length !== 1 ? 's' : ''}
        </p>

        {/* ── Collections rail ── */}
        <div style={{ marginBottom: '32px' }}>
          <p style={{ ...sectionLabel, marginBottom: '12px' }}>Collections</p>
          <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -24px', padding: '0 24px' }}>
            <button
              onClick={() => { setCreateOpen(true); setCreateError('') }}
              style={{
                flexShrink: 0, width: '132px', minHeight: '132px',
                background: 'rgba(255,255,255,0.03)', borderRadius: '16px',
                border: '1px dashed rgba(255,255,255,0.25)', cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              <span style={ui(400, 12, WHITE80)}>New board</span>
            </button>

            {boards.map(board => (
              <Link key={board.id} href={`/moodboards/${board.id}`} style={{
                flexShrink: 0, width: '132px', background: PANEL, borderRadius: '16px',
                border: PANEL_BORDER, overflow: 'hidden', textDecoration: 'none', display: 'block',
              }}>
                <div style={{ width: '132px', height: '99px', background: 'rgba(255,255,255,0.04)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {board.cover_image_url
                    ? <img src={board.cover_image_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: WHITE60, display: 'flex' }}><FolderIcon size={22} /></span>
                  }
                </div>
                <div style={{ padding: '8px 10px 10px' }}>
                  <p style={{ ...ui(500, 12), margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {board.name}
                  </p>
                  <p style={{ ...ui(300, 11, WHITE60), margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {board.__shared
                      ? `by ${board.__ownerName}`
                      : `${boardCounts[board.id] || 0} design${(boardCounts[board.id] || 0) !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── Saved grid ── */}
        <p style={{ ...sectionLabel, marginBottom: '12px' }}>All saved</p>
        {designs.length === 0 ? (
          <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '36px 20px', textAlign: 'center' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '10px' }}>
              <path d="M12 3l1.9 5.6 5.6 1.4-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>
            </svg>
            <p style={{ ...ui(400, 15), marginBottom: '8px' }}>No saved designs yet</p>
            <p style={{ ...ui(300, 13, WHITE60), lineHeight: 1.6, marginBottom: '20px' }}>Tap the heart on any design and it&apos;ll be kept here.</p>
            <Link href="/feed" style={{ display: 'inline-block', background: BTN_GRADIENT, borderRadius: '1000px', padding: '13px 28px', ...ui(500, 14), textDecoration: 'none' }}>
              Explore designs
            </Link>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
            {cols.map((col, ci) => (
              <div key={ci} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {col.map(design => (
                  <div key={design.id} style={{ position: 'relative' }}>
                    <DesignCard
                      design={design} meta="tags" width="100%"
                      currentUser={user} initiallySaved
                      onSaveToggle={(saved) => { if (!saved) removeDesign(design.id) }}
                      onNavigate={() => sessionStorage.setItem('saved-scroll', window.scrollY.toString())}
                    />
                    {/* Add-to-board shortcut (existing SaveToBoard flow) */}
                    <div style={{ position: 'absolute', top: '8px', left: '8px' }}>
                      <SaveToBoard
                        designId={design.id}
                        designImageUrl={design.image_url}
                        renderTrigger={() => (
                          <div aria-label="Add to board" style={{
                            background: 'rgba(32,5,11,0.55)', backdropFilter: 'blur(6px)',
                            border: PANEL_BORDER, borderRadius: '1000px',
                            width: '32px', height: '32px',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            cursor: 'pointer', color: 'var(--lq-white)',
                          }}>
                            <FolderIcon size={14} />
                          </div>
                        )}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create board — Sheet primitive, outside any stacking wrapper */}
      {createOpen && (
        <Sheet onClose={() => setCreateOpen(false)} title="New board">
          <div style={{ padding: '8px 20px calc(env(safe-area-inset-bottom) + 24px)' }}>
            <h2 style={{ ...display(22), margin: '0 0 16px' }}>New board</h2>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createBoard()}
              placeholder="Board name"
              aria-label="Board name"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: PANEL, border: PANEL_BORDER, borderRadius: '14px',
                padding: '14px 16px', ...ui(400, 15), outline: 'none', marginBottom: '12px',
              }}
            />
            {createError && <p style={{ ...ui(300, 13, '#FF8DA8'), margin: '0 0 12px' }}>{createError}</p>}
            <button
              onClick={createBoard}
              disabled={!newName.trim() || creating}
              style={{
                width: '100%', height: '52px', background: newName.trim() ? BTN_GRADIENT : 'rgba(255,255,255,0.08)',
                border: 'none', borderRadius: '1000px',
                ...ui(500, 15, newName.trim() ? 'var(--lq-white)' : WHITE60),
                cursor: newName.trim() && !creating ? 'pointer' : 'default',
                opacity: creating ? 0.7 : 1,
              }}
            >
              {creating ? 'Creating…' : 'Create board'}
            </button>
          </div>
        </Sheet>
      )}
    </Shell>
  )
}
