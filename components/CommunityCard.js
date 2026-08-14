'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import SaveToBoard from './SaveToBoard'
import CommentSheet from './CommentSheet'

export default function CommunityCard({ design, currentUser, initiallyLiked }) {
  const [liked, setLiked]               = useState(!!initiallyLiked)
  const [likesCount, setLikesCount]     = useState(design.likes_count || 0)
  const [commentsCount, setCommentsCount] = useState(design.comments_count || 0)
  const [commentOpen, setCommentOpen]   = useState(false)
  const [likeLoading, setLikeLoading]   = useState(false)

  useEffect(() => {
    // If the parent already fetched like status for the whole visible set
    // in one batched query (initiallyLiked passed as a real boolean), skip
    // this card's own per-card query entirely.
    if (!currentUser || initiallyLiked !== undefined) return
    supabase
      .from('design_likes')
      .select('design_id')
      .eq('user_id', currentUser.id)
      .eq('design_id', design.id)
      .maybeSingle()
      .then(({ data }) => setLiked(!!data))
  }, [design.id, currentUser])

  async function toggleLike(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!currentUser) { window.location.href = '/profile'; return }
    if (likeLoading) return
    setLikeLoading(true)
    if (liked) {
      const { error } = await supabase.from('design_likes').delete().eq('user_id', currentUser.id).eq('design_id', design.id)
      if (error) { alert('Failed to unlike. Please try again.'); setLikeLoading(false); return }
      await supabase.rpc('decrement_likes', { design_id: design.id })
      setLiked(false)
      setLikesCount(c => Math.max(0, c - 1))
    } else {
      const { error } = await supabase.from('design_likes').insert({ user_id: currentUser.id, design_id: design.id })
      if (error) { alert('Failed to like. Please try again.'); setLikeLoading(false); return }
      await supabase.rpc('increment_likes', { design_id: design.id })
      setLiked(true)
      setLikesCount(c => c + 1)
      if (design.created_by && design.created_by !== currentUser.id) {
        await supabase.from('notifications').insert({ user_id: design.created_by, actor_id: currentUser.id, type: 'like', design_id: design.id })
      }
    }
    setLikeLoading(false)
  }

  const creator     = design.profiles
  const creatorName = creator?.display_name || 'Creator'
  const accountType = creator?.account_type

  return (
    <div style={{ background: 'var(--bg-primary)', borderBottom: '6px solid var(--bg-card)' }}>

      {/* ── Creator header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px' }}>
        <Link
          href={`/creator/${design.created_by}`}
          style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flex: 1 }}
        >
          <div style={{
            width: '36px', height: '36px', borderRadius: '50%',
            background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '0.5px solid var(--border)',
          }}>
            {creator?.avatar_url
              ? <img src={creator.avatar_url} alt={creatorName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: 'var(--accent)', fontSize: '15px', fontWeight: '500' }}>{creatorName[0].toUpperCase()}</span>
            }
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: 0, lineHeight: 1.2 }}>
                {creatorName}
              </p>
              {creator?.is_verified && (
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                  <circle cx="8" cy="8" r="7" fill="#D4A0C0"/>
                  <path d="M5 8L7 10L11 6" stroke="#2C0A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <p style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '2px 0 0' }}>
              {accountType === 'salon' ? 'Salon' : 'Nail Artist'}
            </p>
          </div>
        </Link>
      </div>

      {/* ── Image ── */}
      <Link href={`/design/${design.id}?from=%2Ffeed`} style={{ display: 'block', textDecoration: 'none' }}>
        <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', background: 'var(--bg-chip)' }}>
          {design.image_url
            ? <img
                src={design.image_url}
                alt={design.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            : <div style={{ width: '100%', height: '100%' }} />
          }
        </div>
      </Link>

      {/* ── Action bar ── */}
      <div style={{ padding: '10px 12px 4px', display: 'flex', alignItems: 'center', gap: '2px' }}>

        {/* Like */}
        <button
          onClick={toggleLike}
          disabled={likeLoading}
          title={liked ? 'Unlike' : 'Like'}
          style={{
            display: 'flex', alignItems: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 10px 6px 4px',
            color: liked ? 'var(--accent)' : 'var(--text-secondary)',
            transition: 'color 0.15s',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24"
            fill={liked ? 'currentColor' : 'none'}
            stroke="currentColor" strokeWidth="1.7"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
          </svg>
        </button>

        {/* Comment */}
        <button
          onClick={() => setCommentOpen(true)}
          title="Comments"
          style={{
            display: 'flex', alignItems: 'center',
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '6px 10px',
            color: 'var(--text-secondary)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" strokeWidth="1.7"
            strokeLinecap="round" strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
          </svg>
        </button>

        {/* Save to board — pushed to right */}
        <div style={{ marginLeft: 'auto' }}>
          <SaveToBoard designId={design.id} designImageUrl={design.image_url} />
        </div>
      </div>

      {/* ── Counts ── */}
      {(likesCount > 0 || commentsCount > 0) && (
        <div style={{ padding: '0 16px 6px', display: 'flex', gap: '12px', alignItems: 'center' }}>
          {likesCount > 0 && (
            <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: 0 }}>
              {likesCount} {likesCount === 1 ? 'like' : 'likes'}
            </p>
          )}
          {commentsCount > 0 && (
            <button
              onClick={() => setCommentOpen(true)}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer', padding: 0 }}
            >
              View {commentsCount} {commentsCount === 1 ? 'comment' : 'comments'}
            </button>
          )}
        </div>
      )}

      {/* ── Caption ── */}
      <div style={{ padding: '0 16px 18px' }}>
        <Link href={`/design/${design.id}?from=%2Ffeed`} style={{ textDecoration: 'none' }}>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>{creatorName} </span>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{design.title}</span>
        </Link>
        {(design.shape || design.occasion) && (
          <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.05em', textTransform: 'uppercase', marginTop: '4px', marginBottom: 0 }}>
            {[design.shape, design.occasion?.split(',')[0]?.trim()].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      {/* ── Comment sheet ── */}
      {commentOpen && (
        <CommentSheet
          design={design}
          currentUser={currentUser}
          onClose={() => setCommentOpen(false)}
          onCommentAdded={() => setCommentsCount(c => c + 1)}
          onCommentDeleted={() => setCommentsCount(c => Math.max(0, c - 1))}
        />
      )}
    </div>
  )
}
