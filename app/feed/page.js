'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import CommunityCard from '@/components/CommunityCard'

const VIBE_TABS = ['All', 'Dark', 'Minimal', 'Glam', 'Y2K', 'Colourful', 'Bridal']

const VIBE_FILTER = {
  All:       () => true,
  Dark:      (d) => /dark/i.test(d.category),
  Minimal:   (d) => /minimal/i.test(d.category),
  Glam:      (d) => /glam/i.test(d.category),
  Y2K:       (d) => /y2k/i.test(d.category),
  Colourful: (d) => /colou?r/i.test(d.category),
  Bridal:    (d) => /bridal|wedding/i.test(d.category) || /bridal|wedding/i.test(d.occasion),
}

export default function FeedPage() {
  // Main tab: 'explore' | 'community'
  const [mainTab, setMainTab] = useState('explore')

  // Explore state
  const [designs, setDesigns]       = useState([])
  const [activeTab, setActiveTab]   = useState('All')
  const [sort, setSort]             = useState('newest')
  const [sortInitialized, setSortInitialized] = useState(false)
  const [loadingExplore, setLoadingExplore] = useState(true)

  // Community state
  const [community, setCommunity]   = useState([])
  const [loadingCommunity, setLoadingCommunity] = useState(false)
  const [communityLoaded, setCommunityLoaded]   = useState(false)

  // Following state
  const [followingFeed, setFollowingFeed]         = useState([])
  const [loadingFollowing, setLoadingFollowing]   = useState(false)
  const [followingLoaded, setFollowingLoaded]     = useState(false)

  // Updates state
  const [updates, setUpdates]               = useState([])
  const [loadingUpdates, setLoadingUpdates] = useState(false)
  const [updatesLoaded, setUpdatesLoaded]   = useState(false)

  // Shared
  const [currentUser, setCurrentUser] = useState(null)
  const [userProfile, setUserProfile] = useState(null)
  const [unreadCount, setUnreadCount] = useState(0)
  const [dropDesigns, setDropDesigns] = useState([])
  const [boostedDesigns, setBoostedDesigns] = useState([])
  const [activeChallenge, setActiveChallenge] = useState(null)

  // Stories state
  const [stories, setStories]         = useState([])
  const [viewingStories, setViewingStories] = useState(null)
  const [storyIndex, setStoryIndex]   = useState(0)
  const [viewedUsers, setViewedUsers] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('viewed-stories') || '[]')) } catch { return new Set() }
  })
  const [storyLikes, setStoryLikes]   = useState(new Set())
  const [likeCounts, setLikeCounts]   = useState({})

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const u = session?.user || null
      setCurrentUser(u)

      if (u) {
        const [{ count }, { data: prof }] = await Promise.all([
          supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', u.id).eq('read', false),
          supabase.from('profiles').select('nail_shape, nail_length, nail_colors, nail_finishes, nail_techniques, occasions, account_type').eq('id', u.id).single(),
        ])
        setUnreadCount(count || 0)
        setUserProfile(prof || null)
      }

      const [{ data: curatedDesigns }, { data: drops }, { data: rawStories }, { data: challengeData }, { data: boosted }] = await Promise.all([
        supabase.from('designs').select('*').eq('is_published', true).eq('is_curated', true),
        supabase.from('designs').select('id, title, image_url').eq('is_published', true).eq('is_drop', true).order('created_at', { ascending: false }),
        supabase.from('stories')
          .select('*, profiles(id, display_name, avatar_url)')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false }),
        supabase.from('challenges').select('id, title, ends_at').gt('ends_at', new Date().toISOString()).order('ends_at', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('designs').select('id, title, image_url').eq('is_published', true).gt('boosted_until', new Date().toISOString()).order('boosted_until', { ascending: false }),
      ])

      // Deduplicate stories by user
      const seen = new Set()
      const deduped = []
      ;(rawStories || []).forEach(s => {
        if (!seen.has(s.user_id)) { seen.add(s.user_id); deduped.push(s) }
      })

      setDesigns(curatedDesigns || [])
      setDropDesigns(drops || [])
      setBoostedDesigns(boosted || [])
      setActiveChallenge(challengeData || null)
      setStories(deduped)
      setLoadingExplore(false)
    }
    load()
  }, [])

  // Auto-select "for you" sort when profile has preferences
  useEffect(() => {
    if (!sortInitialized && userProfile && hasPrefs) {
      setSort('for_you')
      setSortInitialized(true)
    }
  }, [userProfile])

  // Restore scroll on back navigation
  useEffect(() => {
    if (!loadingExplore) {
      const saved = sessionStorage.getItem('feed-scroll')
      if (saved) {
        setTimeout(() => { window.scrollTo(0, parseInt(saved)); sessionStorage.removeItem('feed-scroll') }, 50)
      }
    }
  }, [loadingExplore])

  // ── Load community / following tabs on first switch ─────────────────────
  const switchTab = async (tab) => {
    setMainTab(tab)
    if (tab === 'community' && !communityLoaded) {
      setLoadingCommunity(true)
      const { data } = await supabase
        .from('designs')
        .select('*, profiles(id, display_name, avatar_url, account_type)')
        .eq('is_published', true)
        .eq('is_curated', false)
        .order('created_at', { ascending: false })
      setCommunity(data || [])
      setLoadingCommunity(false)
      setCommunityLoaded(true)
    }
    if (tab === 'following' && !followingLoaded && currentUser) {
      setLoadingFollowing(true)
      const { data: followRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUser.id)
      const ids = (followRows || []).map(r => r.following_id)
      if (ids.length > 0) {
        const { data } = await supabase
          .from('designs')
          .select('*, profiles(id, display_name, avatar_url, account_type)')
          .in('created_by', ids)
          .eq('is_published', true)
          .order('created_at', { ascending: false })
        setFollowingFeed(data || [])
      }
      setLoadingFollowing(false)
      setFollowingLoaded(true)
    }
    if (tab === 'updates' && !updatesLoaded && currentUser) {
      setLoadingUpdates(true)
      const { data: followRows } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', currentUser.id)
      const followedIds = (followRows || []).map(r => r.following_id)
      const ids = [...new Set([currentUser.id, ...followedIds])]
      const { data: postsData } = await supabase
        .from('salon_posts')
        .select('*')
        .in('creator_id', ids)
        .order('created_at', { ascending: false })
      if (postsData?.length) {
        const profileIds = [...new Set(postsData.map(p => p.creator_id))]
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, account_type')
          .in('id', profileIds)
        const profileMap = {}
        profilesData?.forEach(p => { profileMap[p.id] = p })
        setUpdates(postsData.map(post => ({ ...post, profiles: profileMap[post.creator_id] || null })))
      } else {
        setUpdates([])
      }
      setLoadingUpdates(false)
      setUpdatesLoaded(true)
    }
  }

  // ── Story logic ───────────────────────────────────────────────────────────
  const openStories = async (userId) => {
    const { data } = await supabase.from('stories')
      .select('*, profiles(display_name, avatar_url)')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
    if (!data?.length) return

    const next = new Set(viewedUsers)
    next.add(userId)
    setViewedUsers(next)
    localStorage.setItem('viewed-stories', JSON.stringify([...next]))

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
  const nextStory = () => { if (storyIndex < viewingStories.length - 1) setStoryIndex(i => i + 1); else closeStories() }
  const prevStory = () => { if (storyIndex > 0) setStoryIndex(i => i - 1) }

  const toggleStoryLike = async (e) => {
    e.stopPropagation()
    if (!currentUser || !viewingStories) return
    const storyId = viewingStories[storyIndex].id
    const liked = storyLikes.has(storyId)
    if (liked) {
      const { error } = await supabase.from('story_likes').delete().eq('story_id', storyId).eq('user_id', currentUser.id)
      if (error) return
      setStoryLikes(prev => { const s = new Set(prev); s.delete(storyId); return s })
      setLikeCounts(prev => ({ ...prev, [storyId]: Math.max(0, (prev[storyId] || 1) - 1) }))
    } else {
      const { error } = await supabase.from('story_likes').insert({ story_id: storyId, user_id: currentUser.id })
      if (error) return
      setStoryLikes(prev => new Set([...prev, storyId]))
      setLikeCounts(prev => ({ ...prev, [storyId]: (prev[storyId] || 0) + 1 }))
    }
  }

  const deleteStory = async (e) => {
    e.stopPropagation()
    if (!viewingStories) return
    const story = viewingStories[storyIndex]
    if (!confirm('Delete this story?')) return
    const { error } = await supabase.from('stories').delete().eq('id', story.id)
    if (error) { alert('Failed to delete story. Please try again.'); return }
    const remaining = viewingStories.filter((_, i) => i !== storyIndex)
    if (remaining.length === 0) { closeStories(); setStories(prev => prev.filter(s => s.user_id !== story.user_id)) }
    else { setViewingStories(remaining); setStoryIndex(Math.min(storyIndex, remaining.length - 1)) }
  }

  const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor(diff / 60000)
    if (h >= 1) return `${h}h ago`
    if (m >= 1) return `${m}m ago`
    return 'Just now'
  }

  // ── Personalization score ─────────────────────────────────────────────────
  const hasPrefs = userProfile && (
    userProfile.nail_shape ||
    userProfile.nail_techniques?.length ||
    userProfile.occasions?.length ||
    userProfile.nail_finishes?.length
  )

  function scoreDesign(d) {
    if (!hasPrefs) return 0
    let score = 0
    const p = userProfile
    // Shape (+3)
    if (p.nail_shape && d.shape?.toLowerCase() === p.nail_shape.toLowerCase()) score += 3
    // Occasions (+2 each)
    const dOcc = (d.occasion || '').split(',').map(o => o.trim().toLowerCase())
    ;(p.occasions || []).forEach(po => {
      if (dOcc.some(o => o.includes(po.toLowerCase()) || po.toLowerCase().includes(o))) score += 2
    })
    // Techniques (+1.5 each)
    const dTech = (d.technique || '').split(',').map(t => t.trim().toLowerCase())
    ;(p.nail_techniques || []).forEach(pt => {
      if (dTech.some(t => t.includes(pt.toLowerCase()) || pt.toLowerCase().includes(t))) score += 1.5
    })
    // Saves popularity boost (capped at +2)
    score += Math.min((d.saves_count || 0) * 0.1, 2)
    return score
  }

  // ── Explore filtered/sorted ───────────────────────────────────────────────
  const filtered = designs
    .filter(VIBE_FILTER[activeTab])
    .sort((a, b) => {
      if (sort === 'for_you') return scoreDesign(b) - scoreDesign(a)
      if (sort === 'most_saved') return (b.saves_count || 0) - (a.saves_count || 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })

  return (
    <div style={{ paddingBottom: '24px' }}>

      {/* ── Full-screen story viewer ──────────────────────────────────────── */}
      {viewingStories && (() => {
        const story = viewingStories[storyIndex]
        const isOwn = story.user_id === currentUser?.id
        const liked = storyLikes.has(story.id)
        const likeCount = likeCounts[story.id] || 0
        return (
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#000', overflow: 'hidden' }}>
            <img src={story.image_url} alt="story"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '140px', background: 'linear-gradient(to bottom, rgba(0,0,0,0.55), transparent)', zIndex: 1, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '180px', background: 'linear-gradient(to top, rgba(0,0,0,0.72), transparent)', zIndex: 1, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: 14, left: 12, right: 12, display: 'flex', gap: '4px', zIndex: 3 }}>
              {viewingStories.map((_, i) => (
                <div key={i} style={{ flex: 1, height: '2px', borderRadius: '2px', background: i <= storyIndex ? '#fff' : 'rgba(255,255,255,0.35)' }} />
              ))}
            </div>
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
            <div style={{ position: 'absolute', left: 0, top: 0, width: '35%', height: '75%', zIndex: 2, cursor: 'pointer' }} onClick={prevStory} />
            <div style={{ position: 'absolute', right: 0, top: 0, width: '65%', height: '75%', zIndex: 2, cursor: 'pointer' }} onClick={nextStory} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 20px 32px', zIndex: 3 }}>
              {story.caption && (
                <p style={{ color: '#fff', fontSize: '14px', lineHeight: '1.5', marginBottom: '16px', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>{story.caption}</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={toggleStoryLike} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.45)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: '24px', padding: '10px 18px', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: currentUser ? 'pointer' : 'default', backdropFilter: 'blur(8px)', fontFamily: "'DM Sans', sans-serif" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill={liked ? '#D4A0C0' : 'none'}>
                    <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.5 3 2 5 2C6.2 2 7.2 2.6 8 3.5C8.8 2.6 9.8 2 11 2C13 2 14.5 3.5 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z" stroke={liked ? '#D4A0C0' : '#fff'} strokeWidth="1.3" strokeLinejoin="round"/>
                  </svg>
                  {likeCount > 0 ? likeCount : 'Like'}
                </button>
                {isOwn && (
                  <button onClick={deleteStory} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.45)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: '24px', padding: '10px 18px', color: '#fff', fontSize: '13px', cursor: 'pointer', backdropFilter: 'blur(8px)', fontFamily: "'DM Sans', sans-serif" }}>
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

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div style={{ padding: '24px 20px 0', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Laque
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Nail & beauty design library
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginTop: '4px' }}>
          <Link href="/pick-my-set" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', background: 'var(--bg-card)', border: '0.5px solid var(--border)', textDecoration: 'none', flexShrink: 0 }} title="Pick My Set">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
            </svg>
          </Link>
        {currentUser && (
          <Link href="/notifications" style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '38px', height: '38px', borderRadius: '50%', background: 'var(--bg-card)', border: '0.5px solid var(--border)', textDecoration: 'none', flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
              <div style={{
                position: 'absolute', top: '0px', right: '0px',
                width: '16px', height: '16px', borderRadius: '50%',
                background: 'var(--accent)', border: '2px solid var(--bg-primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#2C0A1E', fontSize: '9px', fontWeight: '700', fontFamily: "'DM Sans', sans-serif", lineHeight: 1 }}>
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              </div>
            )}
          </Link>
        )}
        </div>
      </div>

      {/* ── Main tabs: Explore / Community ────────────────────────────────── */}
      <div style={{
        display: 'flex', borderBottom: '0.5px solid var(--border)',
        padding: '0 20px', marginBottom: '0',
      }}>
        {[['explore', 'Explore'], ['community', 'Community'], ['following', 'Following'], ['updates', 'Updates']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => switchTab(val)}
            style={{
              flex: 1, background: 'none', border: 'none',
              borderBottom: mainTab === val ? '2px solid var(--accent)' : '2px solid transparent',
              color: mainTab === val ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '14px', fontWeight: mainTab === val ? '600' : '400',
              fontFamily: "'DM Sans', sans-serif",
              padding: '12px 0', cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* EXPLORE TAB                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'explore' && (
        <>
          {/* Active challenge banner */}
          {activeChallenge && (
            <Link href={`/challenges/${activeChallenge.id}`} style={{ textDecoration: 'none', display: 'block', margin: '8px 20px 4px' }}>
              <div style={{ background: 'linear-gradient(135deg, rgba(212,160,192,0.15) 0%, rgba(155,94,138,0.1) 100%)', border: '0.5px solid rgba(212,160,192,0.35)', borderRadius: '14px', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 2px' }}>✦ Active Challenge</p>
                  <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', margin: 0 }}>{activeChallenge.title}</p>
                </div>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
            </Link>
          )}

          {/* Story circles */}
          {(stories.length > 0 || currentUser) && (
            <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', padding: '16px 20px', scrollbarWidth: 'none' }}>
              {currentUser && (
                <Link href="/story/new" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', textDecoration: 'none', flexShrink: 0 }}>
                  <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'var(--bg-card)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: 'var(--accent)', fontSize: '26px', lineHeight: 1, marginTop: '-2px' }}>+</span>
                  </div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '10px', maxWidth: '60px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Your story</p>
                </Link>
              )}
              {stories.map(story => {
                const name   = story.profiles?.display_name || 'User'
                const avatar = story.profiles?.avatar_url
                const isMe   = story.user_id === currentUser?.id
                const viewed = viewedUsers.has(story.user_id)
                return (
                  <button key={story.user_id} onClick={() => openStories(story.user_id)}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
                  >
                    <div style={{ width: '60px', height: '60px', borderRadius: '50%', padding: '2px', background: viewed ? 'var(--border)' : 'linear-gradient(135deg, #D4A0C0 0%, #9B5E8A 100%)' }}>
                      <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--bg-primary)', padding: '2px', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'var(--bg-chip)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {avatar ? <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ color: 'var(--accent)', fontSize: '20px', fontWeight: '500' }}>{name[0].toUpperCase()}</span>}
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
          <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 20px 12px', scrollbarWidth: 'none' }}>
            {VIBE_TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flexShrink: 0,
                background: activeTab === tab ? 'var(--accent)' : 'var(--bg-card)',
                color: activeTab === tab ? '#2C0A1E' : 'var(--text-secondary)',
                border: activeTab === tab ? 'none' : '0.5px solid var(--border)',
                borderRadius: '20px', padding: '7px 16px',
                fontSize: '13px', fontWeight: activeTab === tab ? '600' : '400',
                fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', whiteSpace: 'nowrap',
              }}>{tab}</button>
            ))}
          </div>

          {/* Sort row */}
          <div style={{ padding: '0 20px 16px', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px', marginRight: '2px' }}>Sort:</span>
            {[
              ...(hasPrefs ? [['for_you', '✦ For you']] : []),
              ['newest', 'Newest'],
              ['most_saved', 'Most saved'],
            ].map(([val, label]) => (
              <button key={val} onClick={() => setSort(val)} style={{
                background: sort === val ? (val === 'for_you' ? 'var(--accent)' : 'var(--bg-chip)') : 'none',
                color: sort === val ? (val === 'for_you' ? '#2C0A1E' : 'var(--text-primary)') : 'var(--text-secondary)',
                border: '0.5px solid ' + (sort === val ? (val === 'for_you' ? 'transparent' : 'var(--border)') : 'transparent'),
                borderRadius: '20px', padding: '5px 12px',
                fontSize: '12px', fontWeight: sort === val ? '500' : '400',
                fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
              }}>{label}</button>
            ))}
          </div>

          {/* Trending row */}
          {(() => {
            const trending = [...designs].filter(d => (d.saves_count || 0) > 0).sort((a, b) => (b.saves_count || 0) - (a.saves_count || 0)).slice(0, 10)
            if (trending.length === 0) return null
            return (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ padding: '0 20px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Trending</span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>· Most saved right now</span>
                </div>
                <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 20px', scrollbarWidth: 'none' }}>
                  {trending.map((d, i) => (
                    <Link key={d.id} href={`/design/${d.id}?from=%2Ffeed`}
                      onClick={() => sessionStorage.setItem('feed-scroll', window.scrollY.toString())}
                      style={{ flexShrink: 0, width: '130px', textDecoration: 'none' }}
                    >
                      <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '0.5px solid var(--border)', background: 'var(--bg-card)' }}>
                        {d.image_url
                          ? <div style={{ width: '130px', height: '130px', overflow: 'hidden' }}><img src={d.image_url} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /></div>
                          : <div style={{ width: '130px', height: '130px', background: 'var(--bg-chip)' }} />
                        }
                        <div style={{ position: 'absolute', top: '6px', left: '6px', background: i === 0 ? 'var(--accent)' : 'rgba(0,0,0,0.55)', color: i === 0 ? '#141414' : '#fff', fontSize: '10px', fontWeight: '700', width: '20px', height: '20px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {i + 1}
                        </div>
                      </div>
                      <div style={{ padding: '6px 2px 0' }}>
                        <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', lineHeight: '1.3', margin: '0 0 2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</p>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>{d.saves_count} {d.saves_count === 1 ? 'save' : 'saves'}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* ✦ Trend Drops carousel */}
          {dropDesigns.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ padding: '0 20px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>✦ This Week's Drops</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>· Curated just for you</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 20px', scrollbarWidth: 'none' }}>
                {dropDesigns.map(d => (
                  <Link key={d.id} href={`/design/${d.id}?from=%2Ffeed`}
                    onClick={() => sessionStorage.setItem('feed-scroll', window.scrollY.toString())}
                    style={{ flexShrink: 0, width: '130px', textDecoration: 'none' }}
                  >
                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '0.5px solid var(--accent)', background: 'var(--bg-card)' }}>
                      {d.image_url
                        ? <div style={{ width: '130px', height: '130px', overflow: 'hidden' }}><img src={d.image_url} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /></div>
                        : <div style={{ width: '130px', height: '130px', background: 'var(--bg-chip)' }} />
                      }
                      <div style={{ position: 'absolute', top: '6px', right: '6px', background: 'var(--accent)', color: '#2C0A1E', fontSize: '9px', fontWeight: '700', padding: '3px 7px', borderRadius: '8px' }}>
                        DROP
                      </div>
                    </div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', lineHeight: '1.3', margin: '6px 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ✦ Promoted carousel */}
          {boostedDesigns.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <div style={{ padding: '0 20px 10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase' }}>✦ Promoted</span>
              </div>
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', padding: '0 20px', scrollbarWidth: 'none' }}>
                {boostedDesigns.map(d => (
                  <Link key={d.id} href={`/design/${d.id}?from=%2Ffeed`}
                    onClick={() => sessionStorage.setItem('feed-scroll', window.scrollY.toString())}
                    style={{ flexShrink: 0, width: '130px', textDecoration: 'none' }}
                  >
                    <div style={{ position: 'relative', borderRadius: '12px', overflow: 'hidden', border: '0.5px solid var(--border)', background: 'var(--bg-card)' }}>
                      {d.image_url
                        ? <div style={{ width: '130px', height: '130px', overflow: 'hidden' }}><img src={d.image_url} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} /></div>
                        : <div style={{ width: '130px', height: '130px', background: 'var(--bg-chip)' }} />
                      }
                      <div style={{ position: 'absolute', top: '6px', left: '6px', background: 'rgba(44,10,30,0.75)', color: 'var(--text-secondary)', fontSize: '9px', fontWeight: '600', padding: '3px 7px', borderRadius: '8px', letterSpacing: '0.04em' }}>
                        Promoted
                      </div>
                    </div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', lineHeight: '1.3', margin: '6px 2px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.title}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Design grid */}
          <div style={{ padding: '0 20px' }}>
            {loadingExplore ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>Loading...</p>
            ) : filtered.length > 0 ? (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {filtered.map(design => (
                  <Link key={design.id} href={`/design/${design.id}?from=%2Ffeed`}
                    onClick={() => sessionStorage.setItem('feed-scroll', window.scrollY.toString())}
                    style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden', textDecoration: 'none', display: 'block' }}
                  >
                    {design.image_url ? (
                      <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                        <img src={design.image_url} alt={design.title} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                      </div>
                    ) : (
                      <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-chip)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>No image</span>
                      </div>
                    )}
                    <div style={{ padding: '10px 12px 12px' }}>
                      <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', marginBottom: '4px', lineHeight: '1.3' }}>{design.title}</p>
                      <p style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.05em', textTransform: 'uppercase', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {[design.shape, design.occasion?.split(',')[0]?.trim()].filter(Boolean).join(' · ')}
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
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* COMMUNITY TAB                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'community' && (
        <div>
          {loadingCommunity ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>Loading...</p>
          ) : community.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>
                No community posts yet
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
                Be the first to share your nail work with the Laque community.
              </p>
              {currentUser && (userProfile?.account_type === 'creator' || userProfile?.account_type === 'salon') ? (
                <Link href="/upload" style={{ display: 'inline-block', background: 'var(--accent)', color: '#2C0A1E', borderRadius: '12px', padding: '12px 28px', fontSize: '14px', fontWeight: '600', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
                  Post a design
                </Link>
              ) : !currentUser ? (
                <Link href="/profile" style={{ display: 'inline-block', background: 'var(--accent)', color: '#2C0A1E', borderRadius: '12px', padding: '12px 28px', fontSize: '14px', fontWeight: '600', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
                  Sign in to post
                </Link>
              ) : null}
            </div>
          ) : (
            <div>
              {community.map(design => (
                <CommunityCard key={design.id} design={design} currentUser={currentUser} />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* UPDATES TAB                                                         */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'updates' && (
        <div style={{ padding: '16px 20px' }}>
          {!currentUser ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Sign in to see updates</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
                Follow salons and nail artists to get their latest news here.
              </p>
              <Link href="/profile" style={{ display: 'inline-block', background: 'var(--accent)', color: '#2C0A1E', borderRadius: '12px', padding: '12px 28px', fontSize: '14px', fontWeight: '600', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
                Sign in
              </Link>
            </div>
          ) : loadingUpdates ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>Loading...</p>
          ) : updates.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>No updates yet</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
                Updates from salons and artists you follow will appear here.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {updates.map(post => {
                const name   = post.profiles?.display_name || 'Creator'
                const avatar = post.profiles?.avatar_url
                const diff   = Date.now() - new Date(post.created_at).getTime()
                const h = Math.floor(diff / 3600000)
                const d = Math.floor(diff / 86400000)
                const ago = d >= 1 ? `${d}d ago` : h >= 1 ? `${h}h ago` : 'Just now'
                return (
                  <div key={post.id} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '16px', padding: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                      <Link href={`/creator/${post.creator_id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                        <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {avatar
                            ? <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ color: 'var(--accent)', fontSize: '15px', fontWeight: '600' }}>{name[0].toUpperCase()}</span>
                          }
                        </div>
                        <div>
                          <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '600', margin: 0 }}>{name}</p>
                          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '2px 0 0' }}>{ago}</p>
                        </div>
                      </Link>
                    </div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>{post.body}</p>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* FOLLOWING TAB                                                       */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {mainTab === 'following' && (
        <div>
          {!currentUser ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Sign in to see your feed</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
                Follow nail artists and salons to get their latest designs here.
              </p>
              <Link href="/profile" style={{ display: 'inline-block', background: 'var(--accent)', color: '#2C0A1E', borderRadius: '12px', padding: '12px 28px', fontSize: '14px', fontWeight: '600', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
                Sign in
              </Link>
            </div>
          ) : loadingFollowing ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>Loading...</p>
          ) : followingFeed.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>
                Your feed is empty
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
                Follow nail artists and salons to see their latest designs here.
              </p>
              <Link href="/search" style={{ display: 'inline-block', background: 'var(--accent)', color: '#2C0A1E', borderRadius: '12px', padding: '12px 28px', fontSize: '14px', fontWeight: '600', textDecoration: 'none', fontFamily: "'DM Sans', sans-serif" }}>
                Find creators
              </Link>
            </div>
          ) : (
            <div>
              {followingFeed.map(design => (
                <CommunityCard key={design.id} design={design} currentUser={currentUser} />
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
