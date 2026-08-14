'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function MoodboardsPage() {
  const [boards, setBoards] = useState([])
  const [sharedBoards, setSharedBoards] = useState([])
  const [counts, setCounts] = useState({})
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data?.user) {
        setUser(data.user)
        loadBoards(data.user.id)
      } else {
        setLoading(false)
      }
    })
  }, [])

  async function loadBoards(uid) {
    setLoading(true)

    // Own boards + boards shared with me
    const [{ data: ownData }, { data: memberRows }] = await Promise.all([
      supabase
        .from('moodboards')
        .select('id, name, cover_image_url, is_public, created_at')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })
        .limit(200),
      supabase
        .from('moodboard_members')
        .select('moodboard_id, moodboards(id, name, cover_image_url, is_public, created_at, user_id)')
        .eq('user_id', uid)
        .limit(200),
    ])

    const own = ownData || []
    const shared = (memberRows || [])
      .map(r => r.moodboards)
      .filter(Boolean)
      .filter(b => b.user_id !== uid) // exclude boards owned by self

    setBoards(own)
    setSharedBoards(shared)

    // Load design counts for all boards
    const allIds = [...own, ...shared].map(b => b.id)
    if (allIds.length) {
      const { data: countData } = await supabase
        .from('moodboard_designs')
        .select('moodboard_id')
        .in('moodboard_id', allIds)

      const c = {}
      countData?.forEach(r => { c[r.moodboard_id] = (c[r.moodboard_id] || 0) + 1 })
      setCounts(c)
    }
    setLoading(false)
  }

  async function createBoard() {
    if (!newName.trim() || !user) return
    setCreating(true)
    const { data, error } = await supabase
      .from('moodboards')
      .insert({ user_id: user.id, name: newName.trim(), is_public: false })
      .select('id, name, cover_image_url, is_public, created_at')
      .single()
    if (error || !data) {
      alert('Failed to create board. Please try again.')
    } else {
      setBoards(prev => [data, ...prev])
      setNewName('')
      setShowCreate(false)
    }
    setCreating(false)
  }

  async function togglePrivacy(boardId, currentIsPublic) {
    const newVal = !currentIsPublic
    const { error } = await supabase.from('moodboards').update({ is_public: newVal }).eq('id', boardId)
    if (error) { alert('Failed to update board privacy. Please try again.'); return }
    setBoards(prev => prev.map(b => b.id === boardId ? { ...b, is_public: newVal } : b))
  }

  if (!loading && !user) {
    return (
      <div style={{ padding: '60px 20px', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '20px' }}>
          Sign in to create and view your boards.
        </p>
        <Link href="/profile" style={{
          display: 'inline-block', padding: '12px 28px',
          background: 'var(--accent)', color: '#141414',
          borderRadius: '10px', textDecoration: 'none',
          fontSize: '14px', fontWeight: '600',
        }}>Sign In</Link>
      </div>
    )
  }

  const BoardCard = ({ board, isOwner }) => (
    <div style={{ position: 'relative' }}>
      <Link href={`/moodboards/${board.id}`} style={{
        background: 'var(--bg-card)', borderRadius: '14px',
        border: '0.5px solid var(--border)', overflow: 'hidden',
        textDecoration: 'none', display: 'block',
      }}>
        {/* Cover */}
        <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-chip)', overflow: 'hidden', position: 'relative' }}>
          {board.cover_image_url ? (
            <img src={board.cover_image_url} alt={board.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5">
                <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
              </svg>
            </div>
          )}
          {/* Shared badge */}
          {!isOwner && (
            <div style={{
              position: 'absolute', top: '8px', left: '8px',
              background: 'rgba(44,10,30,0.75)', borderRadius: '6px',
              padding: '3px 7px', display: 'flex', alignItems: 'center', gap: '4px',
            }}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2.5">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
              <span style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '600' }}>Shared</span>
            </div>
          )}
        </div>
        {/* Info */}
        <div style={{ padding: '10px 12px 12px' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: '0 0 3px', paddingRight: '28px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {board.name}
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>
            {counts[board.id] || 0} {counts[board.id] === 1 ? 'design' : 'designs'}
          </p>
        </div>
      </Link>

      {/* Privacy toggle — owner only */}
      {isOwner && (
        <button
          onClick={e => { e.preventDefault(); togglePrivacy(board.id, board.is_public) }}
          title={board.is_public ? 'Make private' : 'Make public'}
          style={{
            position: 'absolute', bottom: '10px', right: '10px',
            background: 'var(--bg-chip)', border: '0.5px solid var(--border)',
            borderRadius: '20px', width: '26px', height: '26px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', padding: 0,
            color: board.is_public ? 'var(--accent)' : 'var(--text-secondary)',
          }}
        >
          {board.is_public ? (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
              <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z"/>
            </svg>
          ) : (
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0110 0v4"/>
            </svg>
          )}
        </button>
      )}
    </div>
  )

  return (
    <div style={{ padding: '20px 20px 32px', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', letterSpacing: '-0.02em', margin: 0 }}>
          My Boards
        </h1>
        <button
          onClick={() => setShowCreate(v => !v)}
          style={{
            background: 'var(--accent)', color: '#141414',
            border: 'none', borderRadius: '10px',
            padding: '8px 16px', fontSize: '13px', fontWeight: '600',
            fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
          }}
        >
          + New Board
        </button>
      </div>

      {/* Create board input */}
      {showCreate && (
        <div style={{
          background: 'var(--bg-card)', border: '0.5px solid var(--border)',
          borderRadius: '14px', padding: '16px', marginBottom: '20px',
        }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '10px' }}>Board name</p>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              autoFocus
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createBoard()}
              placeholder="e.g. Wedding nails, Summer vibes..."
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
              }}
            >
              {creating ? '...' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
          Loading...
        </div>
      ) : (
        <>
          {/* Own boards */}
          {boards.length === 0 ? (
            <div style={{ padding: '48px 0', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '8px' }}>No boards yet.</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                Save designs to a board from any design page.
              </p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '28px' }}>
              {boards.map(board => (
                <BoardCard key={board.id} board={board} isOwner={true} />
              ))}
            </div>
          )}

          {/* Shared with me */}
          {sharedBoards.length > 0 && (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 14px' }}>
                Shared with me
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {sharedBoards.map(board => (
                  <BoardCard key={board.id} board={board} isOwner={false} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
