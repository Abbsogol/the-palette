'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SaveToBoard from '@/components/SaveToBoard'

export default function SavedPage() {
  const [user, setUser] = useState(null)
  const [designs, setDesigns] = useState([])
  const [boards, setBoards] = useState([])
  const [boardCounts, setBoardCounts] = useState({})
  const [loading, setLoading] = useState(true)

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
    const [{ data: saved, error: savedError }, { data: boardData, error: boardsError }] = await Promise.all([
      supabase.from('saved_designs').select('design_id, designs(*)').eq('user_id', userId).order('saved_at', { ascending: false }).limit(200),
      supabase.from('moodboards').select('id, name, cover_image_url').eq('user_id', userId).order('created_at', { ascending: false }).limit(100),
    ])
    if (savedError) console.error('saved designs fetch failed:', savedError)
    if (boardsError) console.error('moodboards fetch failed:', boardsError)
    setDesigns(saved?.map(d => d.designs).filter(Boolean) || [])
    setBoards(boardData || [])

    // Get design counts
    if (boardData?.length) {
      const { data: countData } = await supabase
        .from('moodboard_designs')
        .select('moodboard_id')
        .in('moodboard_id', boardData.map(b => b.id))
      const c = {}
      countData?.forEach(r => { c[r.moodboard_id] = (c[r.moodboard_id] || 0) + 1 })
      setBoardCounts(c)
    }

    setLoading(false)
  }

  if (loading) return <div style={{ padding: '24px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>

  if (!user) {
    return (
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>Saved</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Your saved designs</p>
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '32px 20px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Save your favourites</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>Sign in to save designs and access them anytime</p>
          <Link href="/profile" style={{ display: 'inline-block', background: 'var(--accent)', color: '#2C0A1E', borderRadius: '10px', padding: '10px 24px', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 20px 32px' }}>
      <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>Saved</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>Your designs & boards</p>

      {/* ── Boards ── */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={sectionLabel}>Boards</p>
          <Link href="/moodboards" style={{
            background: 'var(--bg-chip)', border: '0.5px solid var(--border)',
            borderRadius: '20px', padding: '5px 14px',
            color: 'var(--text-secondary)', fontSize: '12px',
            textDecoration: 'none', fontFamily: "'DM Sans', sans-serif",
          }}>
            Manage boards →
          </Link>
        </div>

        {boards.length === 0 ? (
          <Link href="/moodboards" style={{
            display: 'block', background: 'var(--bg-card)', borderRadius: '12px',
            padding: '24px', border: '0.5px solid var(--border)',
            textAlign: 'center', textDecoration: 'none',
          }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '6px' }}>
              No boards yet
            </p>
            <p style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '500' }}>
              Create your first board →
            </p>
          </Link>
        ) : (
          <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
            {/* Create new card */}
            <Link href="/moodboards" style={{
              flexShrink: 0, width: '120px',
              background: 'var(--bg-card)', borderRadius: '12px',
              border: '0.5px dashed var(--border)', overflow: 'hidden',
              textDecoration: 'none', display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              minHeight: '120px', gap: '6px',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>New board</span>
            </Link>

            {boards.map(board => (
              <Link key={board.id} href={`/moodboards/${board.id}`} style={{
                flexShrink: 0, width: '120px',
                background: 'var(--bg-card)', borderRadius: '12px',
                border: '0.5px solid var(--border)', overflow: 'hidden',
                textDecoration: 'none', display: 'block',
              }}>
                <div style={{ width: '120px', height: '90px', background: 'var(--bg-chip)', overflow: 'hidden' }}>
                  {board.cover_image_url ? (
                    <img src={board.cover_image_url} alt={board.name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--border)" strokeWidth="1.5">
                        <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                      </svg>
                    </div>
                  )}
                </div>
                <div style={{ padding: '8px 10px 10px' }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {board.name}
                  </p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>
                    {boardCounts[board.id] || 0} designs
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── All saved ── */}
      <div>
        <p style={{ ...sectionLabel, marginBottom: '12px' }}>All saved · {designs.length}</p>
        {designs.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '32px 20px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Nothing saved yet</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>Tap the heart on any design to save it here</p>
            <Link href="/" style={{ display: 'inline-block', background: 'var(--accent)', color: '#2C0A1E', borderRadius: '10px', padding: '10px 24px', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>Browse designs</Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {designs.map(design => (
              <div key={design.id} style={{ position: 'relative' }}>
                <Link
                  href={`/design/${design.id}?from=%2Fsaved`}
                  onClick={() => sessionStorage.setItem('saved-scroll', window.scrollY.toString())}
                  style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden', textDecoration: 'none', display: 'block' }}
                >
                  {design.image_url ? (
                    <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                      <img src={design.image_url} alt={design.title} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                    </div>
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-chip)' }} />
                  )}
                  <div style={{ padding: '8px 10px 36px' }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>{design.title}</p>
                  </div>
                </Link>
                {/* Save to board shortcut */}
                <div style={{ position: 'absolute', bottom: '8px', right: '8px' }}>
                  <SaveToBoard
                    designId={design.id}
                    designImageUrl={design.image_url}
                    renderTrigger={() => (
                      <div style={{
                        background: 'var(--bg-chip)', border: '0.5px solid var(--border)',
                        borderRadius: '20px', width: '28px', height: '28px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', color: 'var(--text-secondary)',
                      }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                        </svg>
                      </div>
                    )}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

const sectionLabel = {
  color: 'var(--accent)',
  fontSize: '11px',
  fontWeight: '500',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  margin: 0,
}
