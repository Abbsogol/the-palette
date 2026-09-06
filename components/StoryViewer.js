'use client'

// Full-screen story viewer (extrapolated — no frame; Instagram-standard
// pattern per Sogol 2026-09-06), extracted from feed/page.js. Like + delete
// wiring byte-identical to the old inline viewer. Renders position:fixed at
// z-9999 — the host page must mount it OUTSIDE any stacking-context wrapper
// so it clears the z-100 bottom nav.
//
// Gestures: tap right 65% next / left 35% back, hold ≥250ms pauses the
// timer, swipe down ≥80px closes, 6s auto-advance per story (timer starts
// once the image has loaded), end of the last story closes. Keyboard:
// ArrowLeft / ArrowRight / Escape.

import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { CardHeartIcon } from './ui/icons'

const DURATION = 6000
const TICK = 50

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.3,
})

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(diff / 3600000)
  if (h >= 1) return `${h}h ago`
  if (m >= 1) return `${m}m ago`
  return 'Just now'
}

export default function StoryViewer({ stories: initialStories, currentUser, onClose, onAllDeleted }) {
  const [stories, setStories] = useState(initialStories)
  const [index, setIndex] = useState(0)
  const [storyLikes, setStoryLikes] = useState(new Set())
  const [likeCounts, setLikeCounts] = useState({})
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [imgReady, setImgReady] = useState(false)

  const indexRef = useRef(0)
  indexRef.current = index
  const heldRef = useRef(false)
  const holdTimer = useRef(null)
  const touchStart = useRef(null)

  // Like status + counts for the whole set — same queries the feed ran
  // before opening the old inline viewer.
  useEffect(() => {
    const ids = initialStories.map(s => s.id)
    ;(async () => {
      const [{ data: myLikes }, { data: counts }] = await Promise.all([
        currentUser
          ? supabase.from('story_likes').select('story_id').eq('user_id', currentUser.id).in('story_id', ids)
          : Promise.resolve({ data: [] }),
        supabase.from('story_likes').select('story_id').in('story_id', ids),
      ])
      setStoryLikes(new Set(myLikes?.map(l => l.story_id) || []))
      const countMap = {}
      counts?.forEach(l => { countMap[l.story_id] = (countMap[l.story_id] || 0) + 1 })
      setLikeCounts(countMap)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const goTo = useCallback((i) => {
    setIndex(i)
    setProgress(0)
    setImgReady(false)
  }, [])

  const nextStory = useCallback(() => {
    if (indexRef.current < stories.length - 1) goTo(indexRef.current + 1)
    else onClose()
  }, [stories.length, goTo, onClose])

  const prevStory = useCallback(() => {
    if (indexRef.current > 0) goTo(indexRef.current - 1)
  }, [goTo])

  // Auto-advance: runs only while the image is loaded and not held.
  useEffect(() => {
    if (!imgReady || paused) return
    const iv = setInterval(() => {
      setProgress(p => {
        const n = p + TICK / DURATION
        if (n >= 1) { clearInterval(iv); nextStory(); return 1 }
        return n
      })
    }, TICK)
    return () => clearInterval(iv)
  }, [imgReady, paused, index, nextStory])

  // Keyboard
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') nextStory()
      else if (e.key === 'ArrowLeft') prevStory()
      else if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nextStory, prevStory, onClose])

  // Hold to pause
  const onPointerDown = () => {
    clearTimeout(holdTimer.current)
    holdTimer.current = setTimeout(() => { heldRef.current = true; setPaused(true) }, 250)
  }
  const onPointerUp = () => {
    clearTimeout(holdTimer.current)
    if (heldRef.current) setPaused(false)
  }
  const tap = (fn) => () => {
    if (heldRef.current) { heldRef.current = false; return }
    fn()
  }

  // Swipe down to close
  const onTouchStart = (e) => { touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  const onTouchEnd = (e) => {
    const st = touchStart.current
    touchStart.current = null
    if (!st) return
    const dy = e.changedTouches[0].clientY - st.y
    const dx = e.changedTouches[0].clientX - st.x
    if (dy > 80 && Math.abs(dy) > Math.abs(dx)) onClose()
  }

  const toggleStoryLike = async (e) => {
    e.stopPropagation()
    if (!currentUser || !stories.length) return
    const storyId = stories[index].id
    if (storyLikes.has(storyId)) {
      const { error } = await supabase.from('story_likes').delete().eq('user_id', currentUser.id).eq('story_id', storyId)
      if (error) return
      setStoryLikes(prev => { const n = new Set(prev); n.delete(storyId); return n })
      setLikeCounts(prev => ({ ...prev, [storyId]: Math.max(0, (prev[storyId] || 1) - 1) }))
    } else {
      const { error } = await supabase.from('story_likes').insert({ user_id: currentUser.id, story_id: storyId })
      if (error) return
      setStoryLikes(prev => new Set(prev).add(storyId))
      setLikeCounts(prev => ({ ...prev, [storyId]: (prev[storyId] || 0) + 1 }))
    }
  }

  const deleteStory = async (e) => {
    e.stopPropagation()
    if (!stories.length) return
    const story = stories[index]
    if (!confirm('Delete this story?')) return
    const { error } = await supabase.from('stories').delete().eq('id', story.id)
    if (error) { alert('Failed to delete story. Please try again.'); return }
    const remaining = stories.filter((_, i) => i !== index)
    if (remaining.length === 0) {
      onAllDeleted?.(story.user_id)
      onClose()
    } else {
      setStories(remaining)
      goTo(Math.min(index, remaining.length - 1))
    }
  }

  if (!stories.length) return null
  const story = stories[index]
  const isOwn = story.user_id === currentUser?.id
  const liked = storyLikes.has(story.id)
  const likeCount = likeCounts[story.id] || 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Story by ${story.profiles?.display_name || 'user'}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', overflow: 'hidden' }}
    >
      <img
        key={story.id}
        src={story.image_url}
        alt="story"
        onLoad={() => setImgReady(true)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '140px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)', zIndex: 1, pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '180px', background: 'linear-gradient(to top, rgba(0,0,0,0.72), transparent)', zIndex: 1, pointerEvents: 'none' }} />

      {/* Progress segments — animated fill on the active one */}
      <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 14px)', left: 12, right: 12, display: 'flex', gap: '4px', zIndex: 3 }}>
        {stories.map((_, i) => (
          <div key={i} style={{ flex: 1, height: '2.5px', borderRadius: '2px', background: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
            <div style={{
              width: i < index ? '100%' : i === index ? `${Math.round(progress * 100)}%` : '0%',
              height: '100%', background: '#fff', borderRadius: '2px',
            }} />
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{ position: 'absolute', top: 'calc(env(safe-area-inset-top) + 30px)', left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', zIndex: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#333', overflow: 'hidden', border: '1.5px solid var(--lq-accent-b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            {story.profiles?.avatar_url
              ? <img src={story.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={ui(500, 14, 'var(--lq-accent-b)')}>{(story.profiles?.display_name || '?')[0].toUpperCase()}</span>
            }
          </div>
          <div>
            <p style={{ ...ui(500, 14), margin: 0, lineHeight: 1 }}>{story.profiles?.display_name || 'User'}</p>
            <p style={{ ...ui(300, 11, 'rgba(255,255,255,0.6)'), margin: '3px 0 0' }}>{timeAgo(story.created_at)}</p>
          </div>
        </div>
        <button onClick={onClose} aria-label="Close stories" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '11px', margin: '-7px' }}>✕</button>
      </div>

      {/* Tap zones (hold anywhere on them pauses) */}
      <div
        style={{ position: 'absolute', left: 0, top: 0, width: '35%', height: '75%', zIndex: 2, cursor: 'pointer' }}
        onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onClick={tap(prevStory)}
      />
      <div
        style={{ position: 'absolute', right: 0, top: 0, width: '65%', height: '75%', zIndex: 2, cursor: 'pointer' }}
        onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onClick={tap(nextStory)}
      />

      {/* Caption + actions */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 20px calc(32px + env(safe-area-inset-bottom))', zIndex: 3 }}>
        {story.caption && (
          <p style={{ ...ui(400, 14), lineHeight: 1.5, marginBottom: '16px', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>{story.caption}</p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button onClick={toggleStoryLike} aria-label={liked ? 'Unlike story' : 'Like story'} aria-pressed={liked} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '1000px', padding: '12px 18px', minHeight: '44px', ...ui(500, 13), cursor: currentUser ? 'pointer' : 'default', backdropFilter: 'blur(8px)' }}>
            <span style={{ color: liked ? 'var(--lq-accent-b)' : '#fff', display: 'flex' }}>
              <CardHeartIcon size={16} filled={liked} />
            </span>
            {likeCount > 0 ? likeCount : 'Like'}
          </button>
          {isOwn && (
            <button onClick={deleteStory} aria-label="Delete story" style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.45)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '1000px', padding: '12px 18px', minHeight: '44px', ...ui(400, 13), cursor: 'pointer', backdropFilter: 'blur(8px)' }}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M3 4h10M6 4V3h4v1M5 4v8a1 1 0 001 1h4a1 1 0 001-1V4" stroke="#fff" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
