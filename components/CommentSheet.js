'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

export default function CommentSheet({ design, currentUser, onClose, onCommentAdded, onCommentDeleted }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [body, setBody]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingIds, setDeletingIds] = useState({}) // comment id → boolean, in-flight guard
  const inputRef = useRef(null)

  useEffect(() => {
    loadComments()
    setTimeout(() => inputRef.current?.focus(), 300)
  }, [])

  async function loadComments() {
    const { data } = await supabase
      .from('design_comments')
      .select('*, profiles(display_name, avatar_url)')
      .eq('design_id', design.id)
      .order('created_at', { ascending: true })
    setComments(data || [])
    setLoading(false)
  }

  async function submit(e) {
    e?.preventDefault()
    if (!body.trim() || !currentUser || submitting) return
    setSubmitting(true)
    const { data, error } = await supabase
      .from('design_comments')
      .insert({ user_id: currentUser.id, design_id: design.id, body: body.trim() })
      .select('*, profiles(display_name, avatar_url)')
      .single()
    if (error || !data) {
      alert('Failed to post comment. Please try again.')
      setSubmitting(false)
      return
    }
    await supabase.rpc('increment_comments', { design_id: design.id })
    setComments(prev => [...prev, data])
    onCommentAdded?.()
    // Notify design owner (skip if commenting on own design)
    if (design.created_by && design.created_by !== currentUser.id) {
      await supabase.from('notifications').insert({
        user_id: design.created_by,
        actor_id: currentUser.id,
        type: 'comment',
        design_id: design.id,
        comment_preview: body.trim().slice(0, 80),
      })
    }
    setBody('')
    setSubmitting(false)
  }

  async function deleteComment(comment) {
    if (deletingIds[comment.id]) return
    setDeletingIds(prev => ({ ...prev, [comment.id]: true }))
    try {
      const { error } = await supabase.from('design_comments').delete().eq('id', comment.id)
      if (error) { alert('Failed to delete comment. Please try again.'); return }
      await supabase.rpc('decrement_comments', { design_id: design.id })
      setComments(prev => prev.filter(c => c.id !== comment.id))
      onCommentDeleted?.()
    } finally {
      setDeletingIds(prev => { const n = { ...prev }; delete n[comment.id]; return n })
    }
  }

  const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime()
    const d = Math.floor(diff / 86400000)
    const h = Math.floor(diff / 3600000)
    const m = Math.floor(diff / 60000)
    if (d >= 1) return `${d}d`
    if (h >= 1) return `${h}h`
    if (m >= 1) return `${m}m`
    return 'now'
  }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
        zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
    >
      <div style={{
        background: 'var(--bg-card)', borderRadius: '20px 20px 0 0',
        width: '100%', maxWidth: '480px',
        maxHeight: '75vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 8px' }}>
          <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '2px' }} />
        </div>

        {/* Header */}
        <div style={{
          padding: '0 20px 12px', borderBottom: '0.5px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>
            Comments
          </p>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer', lineHeight: 1, padding: '2px' }}
          >✕</button>
        </div>

        {/* Comment list */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 20px' }}>
          {loading ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>Loading...</p>
          ) : comments.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '24px 0' }}>
              No comments yet — be the first.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {comments.map(c => {
                const isOwn = c.user_id === currentUser?.id
                return (
                  <div key={c.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                    {/* Avatar */}
                    <div style={{
                      width: '32px', height: '32px', borderRadius: '50%',
                      background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {c.profiles?.avatar_url
                        ? <img src={c.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '500' }}>
                            {(c.profiles?.display_name || '?')[0].toUpperCase()}
                          </span>
                      }
                    </div>
                    {/* Body */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                        <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>
                          {c.profiles?.display_name || 'User'}
                        </span>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{timeAgo(c.created_at)}</span>
                      </div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.5', margin: 0, wordBreak: 'break-word' }}>
                        {c.body}
                      </p>
                    </div>
                    {/* Delete own */}
                    {isOwn && (
                      <button
                        onClick={() => deleteComment(c)}
                        disabled={!!deletingIds[c.id]}
                        style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '16px', cursor: deletingIds[c.id] ? 'default' : 'pointer', padding: '2px 4px', flexShrink: 0, opacity: deletingIds[c.id] ? 0.5 : 1 }}
                      >✕</button>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ padding: '12px 20px 36px', borderTop: '0.5px solid var(--border)' }}>
          {currentUser ? (
            <form onSubmit={submit} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                ref={inputRef}
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Add a comment..."
                maxLength={500}
                style={{
                  flex: 1, background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
                  borderRadius: '20px', padding: '10px 16px',
                  color: 'var(--text-primary)', fontSize: '14px',
                  fontFamily: "'DM Sans', sans-serif", outline: 'none',
                }}
              />
              <button
                type="submit"
                disabled={!body.trim() || submitting}
                style={{
                  background: body.trim() ? 'var(--accent)' : 'var(--bg-chip)',
                  color: body.trim() ? '#141414' : 'var(--text-secondary)',
                  border: 'none', borderRadius: '20px',
                  padding: '10px 18px', fontSize: '13px', fontWeight: '600',
                  fontFamily: "'DM Sans', sans-serif", cursor: body.trim() ? 'pointer' : 'default',
                  whiteSpace: 'nowrap', transition: 'background 0.15s',
                }}
              >
                {submitting ? '...' : 'Post'}
              </button>
            </form>
          ) : (
            <a href="/profile" style={{
              display: 'block', textAlign: 'center', padding: '12px',
              background: 'var(--accent)', color: '#141414',
              borderRadius: '12px', textDecoration: 'none',
              fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
            }}>
              Sign in to comment
            </a>
          )}
        </div>
      </div>
    </div>
  )
}
