'use client'
import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import Sheet from '@/components/ui/Sheet'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})

export default function CommentSheet({ design, currentUser, onClose, onCommentAdded, onCommentDeleted }) {
  const [comments, setComments] = useState([])
  const [loading, setLoading]   = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [body, setBody]         = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingIds, setDeletingIds] = useState({}) // comment id → boolean, in-flight guard
  const inputRef = useRef(null)

  useEffect(() => {
    loadComments()
    const focusTimer = setTimeout(() => inputRef.current?.focus(), 300)
    return () => clearTimeout(focusTimer)
  }, [])

  async function loadComments() {
    const { data, error } = await supabase
      .from('design_comments')
      .select('*, profiles(display_name, avatar_url)')
      .eq('design_id', design.id)
      .order('created_at', { ascending: true })
    if (error) { setLoadError(true); setLoading(false); return }
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
    <Sheet
      title="Comments"
      onClose={onClose}
      footer={currentUser ? (
        <form onSubmit={submit} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input
            ref={inputRef}
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Add a comment…"
            maxLength={500}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '1000px', padding: '10px 16px', ...ui(400, 14), outline: 'none',
            }}
          />
          <button
            type="submit"
            disabled={!body.trim() || submitting}
            style={{
              background: body.trim() ? BTN_GRADIENT : 'rgba(255,255,255,0.08)',
              ...ui(600, 13, body.trim() ? 'var(--lq-white)' : WHITE60),
              border: 'none', borderRadius: '1000px', padding: '10px 18px',
              cursor: body.trim() ? 'pointer' : 'default', whiteSpace: 'nowrap',
            }}
          >
            {submitting ? '…' : 'Post'}
          </button>
        </form>
      ) : (
        <a href="/profile" style={{ display: 'block', textAlign: 'center', padding: '13px', background: BTN_GRADIENT, color: 'var(--lq-white)', borderRadius: '1000px', textDecoration: 'none', ...ui(600, 14) }}>
          Sign in to comment
        </a>
      )}
    >
      <p style={{ ...ui(600, 11, ACCENT), letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 14px' }}>Comments</p>

      {loading ? (
        <p style={{ ...ui(300, 14, WHITE60), textAlign: 'center', padding: '24px 0' }}>Loading…</p>
      ) : loadError ? (
        <p style={{ ...ui(300, 14, WHITE60), textAlign: 'center', padding: '24px 0' }}>Couldn&apos;t load comments. Please try again.</p>
      ) : comments.length === 0 ? (
        <p style={{ ...ui(300, 14, WHITE60), textAlign: 'center', padding: '24px 0' }}>No comments yet — be the first.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {comments.map(c => {
            const isOwn = c.user_id === currentUser?.id
            return (
              <div key={c.id} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                {/* Avatar */}
                <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.profiles?.avatar_url
                    ? <img src={c.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={ui(500, 13, ACCENT)}>{(c.profiles?.display_name || '?')[0].toUpperCase()}</span>
                  }
                </div>
                {/* Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '2px' }}>
                    <span style={ui(500, 13)}>{c.profiles?.display_name || 'User'}</span>
                    <span style={ui(300, 11, WHITE60)}>{timeAgo(c.created_at)}</span>
                  </div>
                  <p style={{ ...ui(300, 13, 'rgba(255,255,255,0.85)'), lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>
                    {c.body}
                  </p>
                </div>
                {/* Delete own */}
                {isOwn && (
                  <button
                    onClick={() => deleteComment(c)}
                    disabled={!!deletingIds[c.id]}
                    aria-label="Delete comment"
                    style={{ background: 'none', border: 'none', ...ui(400, 16, WHITE60), cursor: deletingIds[c.id] ? 'default' : 'pointer', padding: '2px 4px', flexShrink: 0, opacity: deletingIds[c.id] ? 0.5 : 1 }}
                  >✕</button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Sheet>
  )
}
