'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'

export default function MoodboardsPage() {
  const [boards, setBoards] = useState([])
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
    const { data } = await supabase
      .from('moodboards')
      .select('id, name, cover_image_url, is_public, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })

    setBoards(data || [])

    // Get design counts per board
    if (data?.length) {
      const { data: countData } = await supabase
        .from('moodboard_designs')
        .select('moodboard_id')
        .in('moodboard_id', data.map(b => b.id))

      const c = {}
      countData?.forEach(r => { c[r.moodboard_id] = (c[r.moodboard_id] || 0) + 1 })
      setCounts(c)
    }
    setLoading(false)
  }

  async function createBoard() {
    if (!newName.trim() || !user) return
    setCreating(true)
    const { data } = await supabase
      .from('moodboards')
      .insert({ user_id: user.id, name: newName.trim() })
      .select('id, name, cover_image_url, is_public, created_at')
      .single()
    if (data) {
      setBoards(prev => [data, ...prev])
      setNewName('')
      setShowCreate(false)
    }
    setCreating(false)
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

  return (
    <div style={{ padding: '20px 20px 32px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{
          color: 'var(--text-primary)', fontSize: '22px',
          fontWeight: '500', letterSpacing: '-0.02em', margin: 0,
        }}>
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
      ) : boards.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '8px' }}>No boards yet.</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            Save designs to a board from any design page.
          </p>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
        }}>
          {boards.map(board => (
            <Link key={board.id} href={`/moodboards/${board.id}`} style={{
              background: 'var(--bg-card)', borderRadius: '14px',
              border: '0.5px solid var(--border)', overflow: 'hidden',
              textDecoration: 'none', display: 'block',
            }}>
              {/* Cover */}
              <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-chip)', overflow: 'hidden' }}>
                {board.cover_image_url ? (
                  <img src={board.cover_image_url} alt={board.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                    </svg>
                  </div>
                )}
              </div>
              {/* Info */}
              <div style={{ padding: '10px 12px 12px' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: '0 0 3px' }}>
                  {board.name}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>
                  {counts[board.id] || 0} {counts[board.id] === 1 ? 'design' : 'designs'}
                  {board.is_public && <span style={{ color: 'var(--accent)', marginLeft: '6px' }}>· Public</span>}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
