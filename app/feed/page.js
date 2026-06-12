'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const TABS = ['All', 'Dark', 'Minimal', 'Glam', 'Y2K', 'Colourful', 'Bridal']

const TAB_FILTER = {
  All:       () => true,
  Dark:      (d) => /dark/i.test(d.category),
  Minimal:   (d) => /minimal/i.test(d.category),
  Glam:      (d) => /glam/i.test(d.category),
  Y2K:       (d) => /y2k/i.test(d.category),
  Colourful: (d) => /colou?r/i.test(d.category),
  Bridal:    (d) => /bridal|wedding/i.test(d.category) || /bridal|wedding/i.test(d.occasion),
}

export default function Home() {
  const [designs, setDesigns]         = useState([])
  const [saveCountMap, setSaveCountMap] = useState({})
  const [activeTab, setActiveTab]     = useState('All')
  const [sort, setSort]               = useState('newest')
  const [loading, setLoading]         = useState(true)

  // Stories state
  const [stories, setStories]         = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [viewingStories, setViewingStories] = useState(null)
  const [storyIndex, setStoryIndex]   = useState(0)
  const [viewedUsers, setViewedUsers] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('viewed-stories') || '[]')) } catch { return new Set() }
  })
  const [storyLikes, setStoryLikes]   = useState(new Set())   // story IDs liked by current user
  const [likeCounts, setLikeCounts]   = useState({})          // story_id → count

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setCurrentUser(session?.user || null)

      const [{ data: allDesigns }, { data: saves }, { data: rawStories }] = await Promise.all([
        supabase.from('designs').select('*').eq('is_published', true),
        supabase.from('saved_designs').select('design_id'),
        supabase.from('stories')
          .select('*, profiles(id, display_name, avatar_url)')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false }),
      ])

      const counts = {}
      saves?.forEach(s => { counts[s.design_id] = (counts[s.design_id] || 0) + 1 })

      // Deduplicate stories by user — keep first (most recent) per user
      const seen = new Set()
      const deduped = []
      ;(rawStories || []).forEach(s => {
        if (!seen.has(s.user_id)) {
          seen.add(s.user_id)
          deduped.push(s)
        }
      })

      setDesigns(allDesigns || [])
      setSaveCountMap(counts)
      setStories(deduped)
      setLoading(false)
    }
    load()
  }, [])

  // Restore scroll after navigating back
  useEffect(() => {
    if (!loading) {
      const saved = sessionStorage.getItem('feed-scroll')
      if (saved) {
        setTimeout(() => {
          window.scrollTo(0, parseInt(saved))
          sessionStorage.removeItem('feed-scroll')
        }, 50)
      }
    }
  }, [loading])

  const openStories = async (userId) => {
    const { data } = await supabase.from('stories')
      .select('*, profiles(display_name, avatar_url)')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
    if (!data?.length) return

    // Mark as viewed
    const next = new Set(viewedUsers)
    next.add(userId)
    setViewedUsers(next)
    localStorage.setItem('viewed-stories', JSON.stringify([...next]))

    // Load likes for these stories
    const ids = data.map(s => s.id)
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

    setViewingStories(data)
    setStoryIndex(0)
  }

  const closeStories = () => { setViewingStories(null); setStoryIndex(0) }

  const nextStory = () => {
    if (storyIndex < viewingStories.length - 1) setStoryIndex(i => i + 1)
    else closeStories()
  }

  const prevStory = () => {
    if (storyIndex > 0) setStoryIndex(i => i - 1)
  }

  const toggleLike = async (e) => {
    e.stopPropagation()
    if (!currentUser || !viewingStories) return
    const storyId = viewingStories[storyIndex].id
    const liked = storyLikes.has(storyId)
    if (liked) {
      await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', currentUser.id)
      setStoryLikes(prev => { const s = new Set(prev); s.delete(storyId); return s })
      setLikeCounts(prev => ({ ...prev, [storyId]: Math.max(0, (prev[storyId] || 1) - 1) }))
    } else {
      await supabase.from('story_likes').insert({ story_id: storyId, user_id: currentUser.id })
      setStoryLikes(prev => new Set([...prev, storyId]))
      setLikeCounts(prev => ({ ...prev, [storyId]: (prev[storyId] || 0) + 1 }))
    }
  }

  const deleteStory = async (e) => {
    e.stopPropagation()
    if (!viewingStories) return
    const story = viewingStories[storyIndex]
    if (!confirm('Delete this story?')) return
    await supabase.from('stories').delete().eq('id', story.id)
    const remaining = viewingStories.filter((_, i) => i !== storyIndex)
    if (remaining.length === 0) { closeStories(); setStories(prev => prev.filter(s => s.user_id !== story.user_id)) }
    else { setViewingStories(remaining); setStoryIndex(Math.min(storyIndex, remaining.length - 1)) }
  }

  const filtered = designs
    .filter(TAB_FILTER[activeTab])
    .sort((a, b) => {
      if (sort === 'most_saved') return (saveCountMap[b.id] || 0) - (saveCountMap[a.id] || 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })

  const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor(diff / 60000)
    if (h >= 1) return `${h}h ago`
    if (m >= 1) return `${m}m ago`
    return 'Just now'
  }

  return (
    <div style={{ paddingBottom: '24px' }}>

      {/* ── Full-screen story viewer overlay ──────────────────────────────────── */}
      {viewingStories && (() => {
        const story = viewingStories[storyIndex]
        const isOwn = story.user_id === currentUser?.id
        const liked = storyLikes.has(story.id)
        const likeCount = likeCounts[story.id] || 0
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', overflow: 'hidden' }}>

            {/* Blurred background */}
            <div style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${story.image_url})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              filter: 'blur(18px) brightness(0.35)',
              transform: 'scale(1.08)',
            }} />
            {/* Actual image — contained so nothing gets cropped */}
            <img
              src={story.image_url}
              alt="story"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
            />

            {/* Top gradient */}
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '140px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)', zIndex: 1, pointerEvents: 'none' }} />
            {/* Bottom gradient */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '180px', background: 'linear-gradient(to top, rgba(0,0,0,0.72), transparent)', zIndex: 1, pointerEvents: 'none' }} />

            {/* Progress bars */}
            <div style={{ position: 'absolute', top: 14, left: 12, right: 12, display: 'flex', gap: '4px', zIndex: 3 }}>
              {viewingStories.map((_, i) => (
                <div key={i} style={{ flex: 1, height: '2px', borderRadius: '2px', background: i <= storyIndex ? '#fff' : 'rgba(255,255,255,0.35)' }} />
              ))}
            </div>

            {/* Top bar */}
            <div style={{ position: 'absolute', top: 30, left: 0, right: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', zIndex: 3 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#333', overflow: 'hidden', border: '1.5px solid #D4A0C0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {story.profiles?.avatar_url
                    ? <img src={story.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: '#D4A0C0', fontSize: '14px', fontWeight: '500' }}>{(story.profiles?.display_name || '?')[0].toUpperCase()}</span>
                  }
                </div>
                <div>
                  <p style={{ color: '#fff', fontSize: '14px', fontWeight: '500', lineHeight: 1 }}>{story.profiles?.display_name || 'User'}</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', marginTop: '3px' }}>{timeAgo(story.created_at)}</p>
                </div>
              </div>
              <button onClick={closeStories} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '4px' }}>✕</button>
            </div>

            {/* Tap zones (upper 75% only so bottom actions are tappable) */}
            <div style={{ position: 'absolute', left: 0, top: 0, width: '35%', height: '75%', zIndex: 2, cursor: 'pointer' }}
              onClick={prevStory} />
            <div style={{ position: 'absolute', right: 0, top: 0, width: '65%', height: '75%', zIndex: 2, cursor: 'pointer' }}
              onClick={nextStory} />

            {/* Bottom: caption + actions */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 20px 32px', zIndex: 3 }}>
              {story.caption && (
                <p style={{ color: '#fff', fontSize: '14px', lineHeight: '1.5', marginBottom: '16px', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>
                  {story.caption}
                </p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {/* Heart */}
                <button
                  onClick={toggleLike}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.45)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: '24px', padding: '10px 18px', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: currentUser ? 'pointer' : 'default', backdropFilter: 'blur(8px)', fontFamily: "'DM Sans', sans-serif" }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill={liked ? '#D4A0C0' : 'none'}>
                    <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.5 3 2 5 2C6.2 2 7.2 2.6 8 3.5C8.8 2.6 9.8 2 11 2C13 2 14.5 3.5 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z" stroke={liked ? '#D4A0C0' : '#fff'} strokeWidth="1.3" strokeLinejoin="round"/>
                  </svg>
                  {likeCount > 0 ? likeCount : 'Like'}
                </button>
                {/* Delete (own stories only) */}
                {isOwn && (
                  <button
                    onClick={deleteStory}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.45)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: '24px', padding: '10px 18px', color: '#fff', fontSize: '13px', cursor: 'pointer', backdropFilter: 'blur(8px)', fontFamily: "'DM Sans', sans-serif" }}
                  >
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
      })()}

      {/* Header */}
      <div style={{ padding: '24px 20px 0', marginBottom: '16px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Laque
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Nail & beauty design library
        </p>
      </div>

      {/* ── Story circles ─────────────────────────────────────────────────────── */}
      {(stories.length > 0 || currentUser) && (
        <div style={{
          display: 'flex', gap: '14px', overflowX: 'auto', padding: '0 20px 16px',
          scrollbarWidth: 'none', msOverflowStyle: 'none',
        }}>

          {/* "Add story" bubble for logged-in user */}
          {currentUser && (
            <Link href="/story/new" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textDecoration: 'none', flexShrink: 0 }}>
              <div style={{
                width: '60px', height: '60px', borderRadius: '50%',
                background: 'var(--bg-card)', border: '0.5px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                position: 'relative',
              }}>
                <span style={{ color: 'var(--accent)', fontSize: '26px', lineHeight: 1, marginTop: '-2px' }}>+</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '10px', maxWidth: '60px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Your story
              </p>
            </Link>
          )}

          {/* Story circles */}
          {stories.map(story => {
            const name = story.profiles?.display_name || 'User'
            const avatar = story.profiles?.avatar_url
            const isMe = story.user_id === currentUser?.id
            const viewed = viewedUsers.has(story.user_id)
            return (
              <button
                key={story.user_id}
                onClick={() => openStories(story.user_id)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
              >
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  padding: '2px',
                  background: viewed
                    ? 'var(--border)'
                    : 'linear-gradient(135deg, #D4A0C0 0%, #9B5E8A 100%)',
                }}>
                  <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--bg-primary)', padding: '2px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--bg-chip)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {avatar ? (
                        <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <span style={{ color: 'var(--accent)', fontSize: '20px', fontWeight: '500' }}>
                          {name[0].toUpperCase()}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '10px', maxWidth: '60px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {isMe ? 'You' : name}
                </p>
              </button>
            )
          })}
        </div>
      )}

      {/* Vibe tabs */}
      <div style={{
        display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 20px 12px',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flexShrink: 0,
              background: activeTab === tab ? 'var(--accent)' : 'var(--bg-card)',
              color: activeTab === tab ? '#2C0A1E' : 'var(--text-secondary)',
              border: activeTab === tab ? 'none' : '0.5px solid var(--border)',
              borderRadius: '20px',
              padding: '7px 16px',
              fontSize: '13px',
              fontWeight: activeTab === tab ? '600' : '400',
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Sort row */}
      <div style={{ padding: '0 20px 16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-secondary)', fontSize: '12px', marginRight: '2px' }}>Sort:</span>
        {[['newest', 'Newest'], ['most_saved', 'Most saved']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setSort(val)}
            style={{
              background: sort === val ? 'var(--bg-chip)' : 'none',
              color: sort === val ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: '0.5px solid ' + (sort === val ? 'var(--border)' : 'transparent'),
              borderRadius: '20px',
              padding: '5px 12px',
              fontSize: '12px',
              fontWeight: sort === val ? '500' : '400',
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ padding: '0 20px' }}>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>Loading...</p>
        ) : filtered.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {filtered.map((design) => (
              <Link
                key={design.id}
                href={`/design/${design.id}?from=%2Ffeed`}
                onClick={() => sessionStorage.setItem('feed-scroll', window.scrollY.toString())}
                style={{
                  background: 'var(--bg-card)', borderRadius: '12px',
                  border: '0.5px solid var(--border)', overflow: 'hidden',
                  textDecoration: 'none', display: 'block',
                }}
              >
                {design.image_url ? (
                  <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                    <img src={design.image_url} alt={design.title}
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-chip)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>No image</span>
                  </div>
                )}
                <div style={{ padding: '10px 12px 12px' }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', marginBottom: '4px', lineHeight: '1.3' }}>
                    {design.title}
                  </p>
                  <p style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {design.shape} · {design.occasion}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No designs in this vibe yet</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>More coming soon</p>
          </div>
        )}
      </div>

    </div>
  )
}
