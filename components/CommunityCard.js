'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import CommentSheet from './CommentSheet'
import { CardHeartIcon, CommentDotsIcon } from './ui/icons'

// Community-post card, restyled to the redesign tokens. Community posts keep
// like + comment (the redesign's heart-save applies to library designs, not
// posts); the board bookmark moved out of the card row — collections are now
// reached from the design page and /saved.
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

  const actionButton = { display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', minHeight: '44px', minWidth: '44px', padding: '6px 8px', fontFamily: 'var(--lq-font-ui)', fontSize: '13px' }

  return (
    <article style={{
      background: 'var(--lq-glass)',
      border: '1px solid var(--lq-glass-border)',
      borderRadius: 'var(--lq-radius-card-lg)',
      padding: '12px 12px 14px',
    }}>

      {/* ── Creator header ── */}
      <Link
        href={`/creator/${design.created_by}`}
        style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', padding: '2px 4px 12px' }}
      >
        <div style={{
          width: '36px', height: '36px', borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)', overflow: 'hidden', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '1px solid var(--lq-glass-border)',
        }}>
          {creator?.avatar_url
            ? <img src={creator.avatar_url} alt={creatorName} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <span style={{ color: 'var(--lq-white)', fontSize: '15px', fontWeight: '400', fontFamily: 'var(--lq-font-ui)' }}>{creatorName[0].toUpperCase()}</span>
          }
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <p style={{ color: 'var(--lq-white)', fontSize: '14px', fontWeight: '400', fontFamily: 'var(--lq-font-ui)', margin: 0, lineHeight: 1.2 }}>
              {creatorName}
            </p>
            {creator?.is_verified && (
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }} aria-label="Verified">
                <circle cx="8" cy="8" r="7" fill="var(--lq-accent-b)"/>
                <path d="M5 8L7 10L11 6" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <p style={{ color: 'var(--lq-accent-b)', fontSize: '10px', fontWeight: '500', fontFamily: 'var(--lq-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '2px 0 0' }}>
            {accountType === 'salon' ? 'Salon' : 'Nail Artist'}
          </p>
        </div>
      </Link>

      {/* ── Image with counts overlay ── */}
      <Link href={`/design/${design.id}?from=%2Ffeed`} style={{ display: 'block', textDecoration: 'none', position: 'relative' }}>
        <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', borderRadius: 'var(--lq-radius-card)', background: 'rgba(255,255,255,0.06)' }}>
          {design.image_url
            ? <img
                src={design.image_url}
                alt={design.title}
                loading="lazy"
                decoding="async"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            : <div style={{ width: '100%', height: '100%' }} />
          }
        </div>
        {(likesCount > 0 || commentsCount > 0) && (
          <div style={{
            position: 'absolute', left: '12px', bottom: '12px', display: 'flex', gap: '8px', alignItems: 'center',
            background: 'rgba(32, 5, 11, 0.4)', backdropFilter: 'blur(6px)', borderRadius: 'var(--lq-radius-pill)', padding: '6px 12px',
            color: 'var(--lq-white)',
          }}>
            {likesCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--lq-font-ui)', fontSize: '12px' }}>
                <CardHeartIcon size={13} filled />{likesCount}
              </span>
            )}
            {commentsCount > 0 && (
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px', fontFamily: 'var(--lq-font-ui)', fontSize: '12px' }}>
                <CommentDotsIcon size={13} />{commentsCount}
              </span>
            )}
          </div>
        )}
      </Link>

      {/* ── Action row ── */}
      <div style={{ padding: '4px 0 0', display: 'flex', alignItems: 'center' }}>
        <button
          onClick={toggleLike}
          disabled={likeLoading}
          aria-label={liked ? 'Unlike' : 'Like'}
          aria-pressed={liked}
          style={{ ...actionButton, color: liked ? 'var(--lq-accent-b)' : 'var(--lq-white-80)' }}
        >
          <CardHeartIcon size={20} filled={liked} />
          {likesCount > 0 && <span>{likesCount}</span>}
        </button>
        <button
          onClick={() => setCommentOpen(true)}
          aria-label={`Comments${commentsCount > 0 ? `, ${commentsCount}` : ''}`}
          style={{ ...actionButton, color: 'var(--lq-white-80)' }}
        >
          <CommentDotsIcon size={19} />
          {commentsCount > 0 && <span>{commentsCount}</span>}
        </button>
      </div>

      {/* ── Caption ── */}
      <div style={{ padding: '2px 4px 0' }}>
        <Link href={`/design/${design.id}?from=%2Ffeed`} style={{ textDecoration: 'none' }}>
          <span style={{ color: 'var(--lq-white)', fontSize: '13px', fontWeight: '400', fontFamily: 'var(--lq-font-ui)', overflowWrap: 'break-word' }}>{creatorName} </span>
          <span style={{ color: 'var(--lq-white-80)', fontSize: '13px', fontWeight: '300', fontFamily: 'var(--lq-font-ui)', overflowWrap: 'break-word' }}>{design.title}</span>
        </Link>
        {(design.shape || design.category) && (
          <p style={{ color: 'var(--lq-white-80)', fontSize: '10px', fontWeight: '500', fontFamily: 'var(--lq-font-ui)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: '4px', marginBottom: 0 }}>
            {[design.shape, design.category].filter(Boolean).join(' · ')}
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
    </article>
  )
}
