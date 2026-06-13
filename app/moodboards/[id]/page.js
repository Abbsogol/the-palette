'use client'
import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ShareButton from '@/components/ShareButton'

export default function MoodboardDetailPage() {
  const { id } = useParams()
  const [board, setBoard] = useState(null)
  const [designs, setDesigns] = useState([])
  const [creatorName, setCreatorName] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!id) return

    // Wait for auth session to be ready before querying (RLS requires it)
    supabase.auth.getSession().then(({ data: { session } }) => {
      loadBoard()
    })
  }, [id])

  async function loadBoard() {
    setLoading(true)

    const { data: boardData, error } = await supabase
      .from('moodboards')
      .select('id, name, description, is_public, user_id')
      .eq('id', id)
      .single()

    if (!boardData) {
      setNotFound(true)
      setLoading(false)
      return
    }

    setBoard(boardData)

    const { data: boardDesigns } = await supabase
      .from('moodboard_designs')
      .select('design_id, added_at, designs(id, title, image_url, shape, category)')
      .eq('moodboard_id', id)
      .order('added_at', { ascending: false })

    setDesigns(boardDesigns?.map(r => r.designs).filter(Boolean) || [])

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, username')
      .eq('id', boardData.user_id)
      .single()

    setCreatorName(profile?.display_name || profile?.username || null)
    setLoading(false)
  }

  if (loading) {
    return <div style={{ padding: '40px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
  }

  if (notFound || !board) {
    return (
      <div style={{ padding: '24px 20px', textAlign: 'center', paddingTop: '60px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '16px' }}>Board not found.</p>
        <Link href="/moodboards" style={{ color: 'var(--accent)', fontSize: '14px', textDecoration: 'none' }}>← Back to My Boards</Link>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: '32px' }}>
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/moodboards" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          color: 'var(--text-secondary)', textDecoration: 'none',
          fontSize: '13px', fontWeight: '500',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Boards
        </Link>
        {board.is_public && <ShareButton title={board.name} />}
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        <h1 style={{
          color: 'var(--text-primary)', fontSize: '24px',
          fontWeight: '500', letterSpacing: '-0.02em', margin: '0 0 6px',
        }}>
          {board.name}
        </h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {designs.length} {designs.length === 1 ? 'design' : 'designs'}
          </span>
          {creatorName && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>· by {creatorName}</span>
          )}
          {board.is_public && (
            <span style={{
              background: 'rgba(212,160,192,0.15)', color: 'var(--accent)',
              fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em',
              padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase',
            }}>Public</span>
          )}
        </div>
        {board.description && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginTop: '10px' }}>
            {board.description}
          </p>
        )}
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        {designs.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>No designs yet.</p>
            <Link href="/feed" style={{ color: 'var(--accent)', fontSize: '14px', textDecoration: 'none', fontWeight: '500' }}>
              Browse designs →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {designs.map(d => (
              <Link key={d.id} href={`/design/${d.id}?from=${encodeURIComponent(`/moodboards/${id}`)}`} style={{
                background: 'var(--bg-card)', borderRadius: '12px',
                border: '0.5px solid var(--border)', overflow: 'hidden',
                textDecoration: 'none', display: 'block',
              }}>
                <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', background: 'var(--bg-chip)' }}>
                  {d.image_url && (
                    <img src={d.image_url} alt={d.title}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  )}
                </div>
                <div style={{ padding: '8px 10px 10px' }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', lineHeight: '1.3', margin: '0 0 3px' }}>
                    {d.title}
                  </p>
                  {(d.shape || d.category) && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>
                      {[d.shape, d.category].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
