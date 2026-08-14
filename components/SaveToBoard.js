'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SaveToBoard({ designId, designImageUrl, renderTrigger, externalOpen, onClose }) {
  const [internalOpen, setInternalOpen] = useState(false)
  const open = externalOpen !== undefined ? externalOpen : internalOpen
  const setOpen = (v) => {
    if (externalOpen !== undefined) { if (!v && onClose) onClose() }
    else setInternalOpen(v)
  }
  const [boards, setBoards] = useState([])
  const [saved, setSaved] = useState({}) // boardId → boolean
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [user, setUser] = useState(null)
  const [anyBoardSaved, setAnyBoardSaved] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data?.user || null))
  }, [])

  async function openSheet() {
    if (!user) { setOpen(true); return }
    setOpen(true)
    setLoading(true)

    // Load user's boards
    const { data: boardData } = await supabase
      .from('moodboards')
      .select('id, name, cover_image_url')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Load which boards already contain this design
    const { data: savedData } = await supabase
      .from('moodboard_designs')
      .select('moodboard_id')
      .eq('design_id', designId)

    const savedMap = {}
    savedData?.forEach(r => { savedMap[r.moodboard_id] = true })

    setBoards(boardData || [])
    setSaved(savedMap)
    setAnyBoardSaved(Object.keys(savedMap).length > 0)
    setLoading(false)
  }

  async function toggleBoard(boardId) {
    if (!user) return
    if (saved[boardId]) {
      // Remove from board
      const { error } = await supabase
        .from('moodboard_designs')
        .delete()
        .eq('moodboard_id', boardId)
        .eq('design_id', designId)
      if (error) { alert('Failed to remove from board. Please try again.'); return }
      setSaved(prev => { const n = { ...prev }; delete n[boardId]; return n })
    } else {
      // Add to board
      const { error } = await supabase
        .from('moodboard_designs')
        .insert({ moodboard_id: boardId, design_id: designId })
      if (error) { alert('Failed to save to board. Please try again.'); return }

      // Update cover if board has none
      const board = boards.find(b => b.id === boardId)
      if (board && !board.cover_image_url && designImageUrl) {
        const { error: coverErr } = await supabase
          .from('moodboards')
          .update({ cover_image_url: designImageUrl })
          .eq('id', boardId)
        if (!coverErr) {
          setBoards(prev => prev.map(b => b.id === boardId ? { ...b, cover_image_url: designImageUrl } : b))
        }
      }

      setSaved(prev => ({ ...prev, [boardId]: true }))
    }
    setAnyBoardSaved(s => !s) // re-calc after state updates
  }

  async function createBoard() {
    if (!newName.trim() || !user) return
    setCreating(true)
    const { data, error } = await supabase
      .from('moodboards')
      .insert({ user_id: user.id, name: newName.trim(), cover_image_url: designImageUrl || null })
      .select('id, name, cover_image_url')
      .single()

    if (error || !data) {
      alert('Failed to create board. Please try again.')
      setCreating(false)
      return
    }

    // Auto-save design to new board
    const { error: linkErr } = await supabase
      .from('moodboard_designs')
      .insert({ moodboard_id: data.id, design_id: designId })
    setBoards(prev => [data, ...prev])
    if (!linkErr) {
      setSaved(prev => ({ ...prev, [data.id]: true }))
      setAnyBoardSaved(true)
    } else {
      alert('Board created, but failed to save this design to it. Please try again.')
    }
    setNewName('')
    setCreating(false)
  }

  // Recalculate anyBoardSaved whenever saved changes
  useEffect(() => {
    setAnyBoardSaved(Object.keys(saved).length > 0)
  }, [saved])

  return (
    <>
      {/* Trigger — custom or default bookmark button */}
      {renderTrigger ? (
        <span onClick={openSheet} style={{ display: 'contents', cursor: 'pointer' }}>
          {renderTrigger({ anyBoardSaved })}
        </span>
      ) : (
        <button
          onClick={openSheet}
          title="Save to board"
          style={{
            background: anyBoardSaved ? 'var(--accent)' : 'var(--bg-chip)',
            border: 'none',
            borderRadius: '10px',
            width: '38px',
            height: '38px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: anyBoardSaved ? '#141414' : 'var(--text-secondary)',
            flexShrink: 0,
            transition: 'background 0.2s, color 0.2s',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill={anyBoardSaved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
          </svg>
        </button>
      )}

      {/* Bottom sheet */}
      {open && (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.75)',
            zIndex: 300,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div style={{
            background: 'var(--bg-card)',
            borderRadius: '20px 20px 0 0',
            width: '100%', maxWidth: '480px',
            padding: '0 0 40px 0',
            maxHeight: '85vh', overflowY: 'auto',
          }}>
            {/* Handle */}
            <div style={{ display: 'flex', justifyContent: 'center', padding: '14px 0 6px' }}>
              <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '2px' }} />
            </div>

            <div style={{ padding: '8px 20px 20px', borderBottom: '0.5px solid var(--border)' }}>
              <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '2px' }}>
                Save to Board
              </p>
            </div>

            {!user ? (
              <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
                  Sign in to save designs to your boards.
                </p>
                <a href="/profile" style={{
                  display: 'inline-block', padding: '12px 24px',
                  background: 'var(--accent)', color: '#141414',
                  borderRadius: '10px', textDecoration: 'none',
                  fontSize: '14px', fontWeight: '600',
                }}>Sign In</a>
              </div>
            ) : (
              <>
                {/* Create new board */}
                <div style={{ padding: '16px 20px', borderBottom: '0.5px solid var(--border)' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '10px' }}>Create new board</p>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      value={newName}
                      onChange={e => setNewName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && createBoard()}
                      placeholder="Board name..."
                      style={{
                        flex: 1, background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
                        borderRadius: '10px', padding: '10px 14px',
                        color: 'var(--text-primary)', fontSize: '14px',
                        fontFamily: "'DM Sans', sans-serif", outline: 'none',
                      }}
                    />
                    <button
                      onClick={createBoard}
                      disabled={!newName.trim() || creating}
                      style={{
                        background: newName.trim() ? 'var(--accent)' : 'var(--bg-chip)',
                        color: newName.trim() ? '#141414' : 'var(--text-secondary)',
                        border: 'none', borderRadius: '10px',
                        padding: '10px 16px', fontSize: '13px', fontWeight: '600',
                        fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
                        whiteSpace: 'nowrap', transition: 'background 0.2s',
                      }}
                    >
                      {creating ? '...' : '+ Create'}
                    </button>
                  </div>
                </div>

                {/* Board list */}
                {loading ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                    Loading boards...
                  </div>
                ) : boards.length === 0 ? (
                  <div style={{ padding: '24px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>
                    No boards yet — create one above.
                  </div>
                ) : (
                  <div style={{ padding: '12px 20px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {boards.map(board => {
                      const isSaved = !!saved[board.id]
                      return (
                        <button
                          key={board.id}
                          onClick={() => toggleBoard(board.id)}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '12px',
                            background: isSaved ? 'rgba(212,160,192,0.1)' : 'var(--bg-primary)',
                            border: isSaved ? '0.5px solid var(--accent)' : '0.5px solid var(--border)',
                            borderRadius: '12px', padding: '10px 12px',
                            cursor: 'pointer', textAlign: 'left', width: '100%',
                            transition: 'background 0.15s, border-color 0.15s',
                          }}
                        >
                          {/* Cover */}
                          <div style={{
                            width: '44px', height: '44px', borderRadius: '8px',
                            background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0,
                          }}>
                            {board.cover_image_url && (
                              <img src={board.cover_image_url} alt={board.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            )}
                          </div>
                          <span style={{
                            flex: 1,
                            color: isSaved ? 'var(--accent)' : 'var(--text-primary)',
                            fontSize: '14px', fontWeight: '500',
                            fontFamily: "'DM Sans', sans-serif",
                          }}>
                            {board.name}
                          </span>
                          {/* Check */}
                          {isSaved && (
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12"/>
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </>
            )}

            {/* Done button */}
            <div style={{ padding: '16px 20px 0' }}>
              <button
                onClick={() => setOpen(false)}
                style={{
                  width: '100%', padding: '14px',
                  background: 'var(--bg-chip)', color: 'var(--text-primary)',
                  border: '0.5px solid var(--border)', borderRadius: '12px',
                  fontSize: '14px', fontWeight: '600',
                  fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
                }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
