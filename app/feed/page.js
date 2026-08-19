'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import CommunityCard from '@/components/CommunityCard'
import IconButton from '@/components/ui/IconButton'
import PillButton from '@/components/ui/PillButton'
import Chip from '@/components/ui/Chip'
import SearchInput from '@/components/ui/SearchInput'
import DesignCard from '@/components/ui/DesignCard'
import { BellIcon, StarIcon, LaqueWordmark, CardHeartIcon, CommentDotsIcon } from '@/components/ui/icons'

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

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.2,
})

function formatCount(n) {
  if (n == null) return '0'
  if (n >= 1000) {
    const k = n / 1000
    return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`
  }
  return String(n)
}

export default function FeedPage() {
  // Main tab: 'explore' | 'community' | 'following' | 'updates'
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
  const [likedDesignIds, setLikedDesignIds] = useState(new Set())
  const [savedDesignIds, setSavedDesignIds] = useState(new Set())
  const [unreadCount, setUnreadCount] = useState(0)
  const [dropDesigns, setDropDesigns] = useState([])
  const [boostedDesigns, setBoostedDesigns] = useState([])
  const [activeChallenge, setActiveChallenge] = useState(null)
  const [communityStats, setCommunityStats] = useState(null)
  const [teaserPosts, setTeaserPosts] = useState([])
  const [compactHeader, setCompactHeader] = useState(false)

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

      const [
        { data: curatedDesigns },
        { data: drops },
        { data: rawStories },
        { data: challengeData },
        { data: boosted },
        { count: artistCount },
        { count: postCount },
        { data: recentPosts },
      ] = await Promise.all([
        supabase.from('designs').select('*').eq('is_published', true).eq('is_curated', true).order('created_at', { ascending: false }).limit(100),
        supabase.from('designs').select('id, title, image_url, created_at, saves_count').eq('is_published', true).eq('is_drop', true).order('created_at', { ascending: false }).limit(100),
        supabase.from('stories')
          .select('*, profiles(id, display_name, avatar_url)')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order('created_at', { ascending: false })
          .limit(200),
        supabase.from('challenges').select('id, title, ends_at').gt('ends_at', new Date().toISOString()).order('ends_at', { ascending: true }).limit(1).maybeSingle(),
        supabase.from('designs').select('id, title, image_url, shape, category, occasion, saves_count').eq('is_published', true).gt('boosted_until', new Date().toISOString()).order('boosted_until', { ascending: false }).limit(50),
        supabase.from('profiles').select('*', { count: 'exact', head: true }).in('account_type', ['creator', 'salon']),
        supabase.from('designs').select('*', { count: 'exact', head: true }).eq('is_published', true).eq('is_curated', false),
        supabase.from('designs').select('id, image_url, likes_count, comments_count, created_by, profiles(display_name, avatar_url)').eq('is_published', true).eq('is_curated', false).order('created_at', { ascending: false }).limit(3),
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
      setCommunityStats({ artists: artistCount || 0, posts: postCount || 0 })
      setTeaserPosts(recentPosts || [])
      setStories(deduped)
      setLoadingExplore(false)

      // One batched "did I save these" query for every visible design, so
      // heart-save buttons mount with the right state without per-card queries.
      if (u) {
        const visibleIds = [...new Set([
          ...(curatedDesigns || []).map(d => d.id),
          ...(drops || []).map(d => d.id),
          ...(boosted || []).map(d => d.id),
        ])]
        if (visibleIds.length > 0) {
          const { data: savedRows } = await supabase
            .from('saved_designs')
            .select('design_id')
            .eq('user_id', u.id)
            .in('design_id', visibleIds)
          setSavedDesignIds(new Set((savedRows || []).map(r => r.design_id)))
        }
      }
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

  // Compact blur header once the hero is mostly scrolled away. Thresholded
  // off the hero's real height so it always appears just before the sticky
  // tab row pins beneath it (pin point ≈ heroHeight - 96 - safe-area).
  const heroRef = useRef(null)
  useEffect(() => {
    const onScroll = () => {
      const heroH = heroRef.current?.offsetHeight || 430
      setCompactHeader(window.scrollY > heroH - 170)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // One batched "did I like these" query for a whole visible set, instead
  // of each CommunityCard querying its own like status individually.
  const loadLikedStatus = async (designIds) => {
    if (!currentUser || designIds.length === 0) return
    const { data, error } = await supabase
      .from('design_likes')
      .select('design_id')
      .eq('user_id', currentUser.id)
      .in('design_id', designIds)
    if (error) { console.error('likes fetch failed:', error); return }
    setLikedDesignIds(prev => new Set([...prev, ...(data || []).map(d => d.design_id)]))
  }

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
        .limit(100)
      // Fetch like status BEFORE setting community, so cards mount with the
      // right initiallyLiked value the first time (a prop change after
      // mount wouldn't update CommunityCard's own useState-seeded liked flag).
      await loadLikedStatus((data || []).map(d => d.id))
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
          .limit(100)
        await loadLikedStatus((data || []).map(d => d.id))
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
        .limit(100)
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

  const rememberScroll = () => sessionStorage.setItem('feed-scroll', window.scrollY.toString())

  // ── Explore derived lists ─────────────────────────────────────────────────
  const filtered = designs
    .filter(VIBE_FILTER[activeTab])
    .sort((a, b) => {
      if (sort === 'for_you') return scoreDesign(b) - scoreDesign(a)
      if (sort === 'most_saved') return (b.saves_count || 0) - (a.saves_count || 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })

  const trending = [...designs].filter(d => (d.saves_count || 0) > 0).sort((a, b) => (b.saves_count || 0) - (a.saves_count || 0)).slice(0, 10)

  // New This Week absorbs Trend Drops: drop cards get a "Drop" badge
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const dropIds = new Set(dropDesigns.map(d => d.id))
  const newThisWeek = [
    ...dropDesigns.map(d => ({ ...d, __drop: true })),
    ...designs.filter(d => new Date(d.created_at).getTime() >= weekAgo && !dropIds.has(d.id)),
  ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 12)

  // "Popular in Your Area" — no location data exists yet, so this is driven
  // by saves on recent designs (deferred-list item) with the drawn title.
  const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000
  const popular = [...designs]
    .filter(d => new Date(d.created_at).getTime() >= monthAgo && (d.saves_count || 0) > 0)
    .sort((a, b) => (b.saves_count || 0) - (a.saves_count || 0))
    .slice(0, 10)

  // Explore Library grid with Promoted (boosted) designs interleaved as
  // labeled slots: first at position 2, then every 8 cards.
  const boostedIds = new Set(boostedDesigns.map(d => d.id))
  const gridItems = []
  const organic = filtered.filter(d => !boostedIds.has(d.id))
  let promoIdx = 0
  organic.forEach((d, i) => {
    if (boostedDesigns.length > 0 && (i === 2 || (i > 2 && (i - 2) % 8 === 0)) && promoIdx < boostedDesigns.length) {
      gridItems.push({ ...boostedDesigns[promoIdx], __promoted: true })
      promoIdx++
    }
    gridItems.push(d)
  })
  const gridCols = [[], []]
  gridItems.forEach((d, i) => gridCols[i % 2].push({ design: d, tall: (i % 4 === 0) || (i % 4 === 3) }))

  const teaserPost = teaserPosts.find(p => p.image_url) || null
  const teaserAvatars = teaserPosts.map(p => p.profiles).filter(Boolean).slice(0, 3)
  const tileImages = teaserPosts.filter(p => p.image_url).slice(0, 2)

  const headerIcons = (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
      {currentUser && (
        <IconButton label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`} href="/notifications" visualSize={34} badge={unreadCount > 0 ? (
          <span style={{
            position: 'absolute', top: '-3px', right: '-3px', minWidth: '16px', height: '16px',
            borderRadius: 'var(--lq-radius-pill)', background: 'var(--lq-accent-b)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px',
            color: 'var(--lq-white)', fontSize: '9px', fontWeight: 700, fontFamily: 'var(--lq-font-ui)',
          }}>{unreadCount > 9 ? '9+' : unreadCount}</span>
        ) : null}>
          <BellIcon size={17} />
        </IconButton>
      )}
      <IconButton label="Pick My Set" href="/pick-my-set" visualSize={34}>
        <StarIcon size={16} />
      </IconButton>
    </div>
  )

  const sectionHeader = (title, sub) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <h2 style={{ ...ui(400, 18), letterSpacing: '0.02em' }}>{title}</h2>
      {sub && <p style={ui(300, 14, 'var(--lq-white-80)')}>{sub}</p>}
    </div>
  )

  const carousel = (children, gap = 16) => (
    <div style={{ display: 'flex', gap: `${gap}px`, overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -24px', padding: '0 24px' }}>
      {children}
    </div>
  )

  return (
    <div style={{ position: 'relative' }}>

      {/* Fixed blurred-wine page background (Figma page underlay) */}
      <div aria-hidden style={{
        position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px', zIndex: -1,
        background: '#29000A url(/redesign/bg-blur.png) center / cover no-repeat',
      }} />

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
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#333', overflow: 'hidden', border: '1.5px solid var(--lq-accent-b)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {story.profiles?.avatar_url
                    ? <img src={story.profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: 'var(--lq-accent-b)', fontSize: '14px', fontWeight: '500' }}>{(story.profiles?.display_name || '?')[0].toUpperCase()}</span>
                  }
                </div>
                <div>
                  <p style={{ color: '#fff', fontSize: '14px', fontWeight: '500', lineHeight: 1 }}>{story.profiles?.display_name || 'User'}</p>
                  <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', marginTop: '3px' }}>{timeAgo(story.created_at)}</p>
                </div>
              </div>
              <button onClick={closeStories} aria-label="Close stories" style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '11px', margin: '-7px' }}>✕</button>
            </div>
            <div style={{ position: 'absolute', left: 0, top: 0, width: '35%', height: '75%', zIndex: 2, cursor: 'pointer' }} onClick={prevStory} />
            <div style={{ position: 'absolute', right: 0, top: 0, width: '65%', height: '75%', zIndex: 2, cursor: 'pointer' }} onClick={nextStory} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 20px calc(32px + env(safe-area-inset-bottom))', zIndex: 3 }}>
              {story.caption && (
                <p style={{ color: '#fff', fontSize: '14px', lineHeight: '1.5', marginBottom: '16px', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>{story.caption}</p>
              )}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button onClick={toggleStoryLike} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.45)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: '24px', padding: '12px 18px', color: '#fff', fontSize: '13px', fontWeight: '500', cursor: currentUser ? 'pointer' : 'default', backdropFilter: 'blur(8px)', fontFamily: 'var(--lq-font-ui)' }}>
                  <span style={{ color: liked ? 'var(--lq-accent-b)' : '#fff', display: 'flex' }}>
                    <CardHeartIcon size={16} filled={liked} />
                  </span>
                  {likeCount > 0 ? likeCount : 'Like'}
                </button>
                {isOwn && (
                  <button onClick={deleteStory} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(0,0,0,0.45)', border: '0.5px solid rgba(255,255,255,0.2)', borderRadius: '24px', padding: '12px 18px', color: '#fff', fontSize: '13px', cursor: 'pointer', backdropFilter: 'blur(8px)', fontFamily: 'var(--lq-font-ui)' }}>
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

      {/* ── Compact blur header (appears when the hero scrolls away) ──────── */}
      {compactHeader && (
        <div style={{
          position: 'fixed', top: 0, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: '480px', zIndex: 90,
          padding: 'calc(env(safe-area-inset-top) + 8px) 24px 8px',
          background: 'linear-gradient(to bottom, var(--lq-scrim), rgba(41, 0, 10, 0.55))',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ color: 'var(--lq-white)', display: 'flex' }}><LaqueWordmark height={17} /></span>
          {headerIcons}
        </div>
      )}

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div ref={heroRef} style={{ position: 'relative', height: 'clamp(360px, 52vh, 500px)' }}>
        <img src="/redesign/hero.jpg" alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: '50% 25%' }} />
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(41,0,10,0.55) 0%, rgba(41,0,10,0.08) 30%, rgba(41,0,10,0.12) 62%, var(--lq-wine) 100%)' }} />
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: 'calc(env(safe-area-inset-top) + 16px) 24px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h1 style={{ color: 'var(--lq-white)', display: 'flex', margin: 0 }}>
              <LaqueWordmark height={22} />
            </h1>
            <p style={ui(300, 12, 'var(--lq-white-80)')}>Nail & beauty design library</p>
          </div>
          {headerIcons}
        </div>
      </div>

      {/* ── Content sheet ─────────────────────────────────────────────────── */}
      <div style={{
        position: 'relative', marginTop: '-36px',
        borderRadius: 'var(--lq-radius-sheet) var(--lq-radius-sheet) 0 0',
        background: 'linear-gradient(180deg, var(--lq-wine) 0%, rgba(60, 0, 14, 0.55) 55%, rgba(60, 0, 14, 0.25) 100%)',
        padding: '20px 24px 24px',
        display: 'flex', flexDirection: 'column', gap: 'var(--lq-space-2xl)',
      }}>

        {/* Tabs — pinned under the compact header for the whole scroll */}
        <div role="tablist" aria-label="Feed sections" style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
          position: 'sticky', top: 'calc(env(safe-area-inset-top) + 60px)', zIndex: 50,
          margin: '0 -24px', padding: '0 24px',
          background: compactHeader ? 'linear-gradient(to bottom, rgba(41, 0, 10, 0.92), rgba(41, 0, 10, 0.78))' : 'transparent',
          backdropFilter: compactHeader ? 'blur(10px)' : 'none',
          WebkitBackdropFilter: compactHeader ? 'blur(10px)' : 'none',
          transition: 'background 0.2s ease',
        }}>
          {[['explore', 'Explore'], ['community', 'Community'], ['following', 'Following'], ['updates', 'Updates']].map(([val, label]) => (
            <button
              key={val}
              role="tab"
              aria-selected={mainTab === val}
              onClick={() => switchTab(val)}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px',
                minHeight: '44px',
              }}
            >
              <span style={ui(mainTab === val ? 400 : 300, 15, mainTab === val ? 'var(--lq-white)' : 'var(--lq-white-80)')}>{label}</span>
              <span aria-hidden style={{ width: '24px', height: '2px', borderRadius: 'var(--lq-radius-pill)', background: mainTab === val ? 'var(--lq-accent-b)' : 'transparent' }} />
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* EXPLORE TAB                                                     */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {mainTab === 'explore' && (
          <>
            {/* Active challenge banner (kept feature — no frame in the redesign, styled to tokens) */}
            {activeChallenge && (
              <Link href={`/challenges/${activeChallenge.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                <div style={{ background: 'var(--lq-glass)', border: '1px solid var(--lq-glass-border)', borderRadius: 'var(--lq-radius-tile)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <p style={{ ...ui(500, 10, 'var(--lq-accent-b)'), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 3px' }}>✦ Active Challenge</p>
                    <p style={{ ...ui(400, 13), margin: 0 }}>{activeChallenge.title}</p>
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M6 4L10 8L6 12" stroke="var(--lq-accent-b)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              </Link>
            )}

            {/* Stories */}
            {(stories.length > 0 || currentUser) && (
              <div style={{ display: 'flex', gap: '14px', overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -24px', padding: '0 24px' }}>
                {currentUser && (
                  <Link href="/story/new" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', textDecoration: 'none', flexShrink: 0 }}>
                    <div style={{ border: '1.5px solid var(--lq-accent-b)', borderRadius: '50%', padding: '3px' }}>
                      <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--lq-glass)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <span aria-hidden style={{ color: 'var(--lq-white)', fontSize: '22px', lineHeight: 1, fontWeight: 300 }}>+</span>
                      </div>
                    </div>
                    <p style={{ ...ui(300, 11, 'var(--lq-white-80)'), maxWidth: '64px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Your story</p>
                  </Link>
                )}
                {stories.map(story => {
                  const name   = story.profiles?.display_name || 'User'
                  const avatar = story.profiles?.avatar_url
                  const isMe   = story.user_id === currentUser?.id
                  const viewed = viewedUsers.has(story.user_id)
                  return (
                    <button key={story.user_id} onClick={() => openStories(story.user_id)}
                      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
                    >
                      <div style={{ border: `1.5px solid ${viewed ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.53)'}`, borderRadius: '50%', padding: '3px' }}>
                        <div style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'var(--lq-glass)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {avatar ? <img src={avatar} alt={name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={{ color: 'var(--lq-white)', fontSize: '18px', fontWeight: '400' }}>{name[0].toUpperCase()}</span>}
                        </div>
                      </div>
                      <p style={{ ...ui(300, 11, 'var(--lq-white-80)'), maxWidth: '64px', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isMe ? 'You' : name}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}

            {/* Search pill → /search (filter icon deep-links to filters) */}
            <SearchInput variant="glass" href="/search" filterHref="/search?filters=1" />

            {/* Vibe chips */}
            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', scrollbarWidth: 'none', margin: '-12px -24px', padding: '0 24px' }}>
              {VIBE_TABS.map(tab => (
                <Chip key={tab} active={activeTab === tab} onClick={() => setActiveTab(tab)}>{tab}</Chip>
              ))}
            </div>

            {/* Sort row */}
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', margin: '-8px 0' }}>
              <span style={ui(300, 13, 'var(--lq-white-80)')}>Sort:</span>
              {[
                ...(hasPrefs ? [['for_you', '✦ For you']] : []),
                ['newest', 'Newest'],
                ['most_saved', 'Most saved'],
              ].map(([val, label]) => (
                <button key={val} onClick={() => setSort(val)} aria-pressed={sort === val} style={{
                  background: 'none', border: 'none', padding: '8px 0', cursor: 'pointer', minHeight: '44px',
                  display: 'flex', alignItems: 'center',
                }}>
                  <span style={{
                    ...ui(sort === val ? 400 : 300, 13, sort === val ? 'var(--lq-white)' : 'var(--lq-white-80)'),
                    padding: sort === val ? '6px 12px' : '6px 0',
                    borderRadius: 'var(--lq-radius-pill)',
                    background: sort === val ? 'var(--lq-glass)' : 'none',
                    border: sort === val ? '1px solid var(--lq-glass-border)' : '1px solid transparent',
                    whiteSpace: 'nowrap',
                  }}>{label}</span>
                </button>
              ))}
            </div>

            {/* TRENDING */}
            {trending.length > 0 && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--lq-space-md)' }}>
                {sectionHeader('TRENDING', '· Most saved right now')}
                {carousel(trending.map((d, i) => (
                  <DesignCard key={d.id} design={d} rank={i + 1} meta="saves" currentUser={currentUser}
                    initiallySaved={savedDesignIds.has(d.id)} onNavigate={rememberScroll} />
                )))}
              </section>
            )}

            {/* New This Week (absorbs Trend Drops via badge) */}
            {newThisWeek.length > 0 && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--lq-space-md)' }}>
                {sectionHeader('New This Week')}
                {carousel(newThisWeek.map(d => (
                  <DesignCard key={d.id} design={d} tag={d.__drop ? 'Drop' : null} meta="saves" currentUser={currentUser}
                    initiallySaved={savedDesignIds.has(d.id)} onNavigate={rememberScroll} />
                )))}
              </section>
            )}

            {/* Community teaser */}
            {communityStats && (
              <section style={{
                background: 'var(--lq-blush)', borderRadius: 'var(--lq-radius-sheet)',
                margin: '0 -16px', padding: '8px 8px 24px',
                display: 'flex', flexDirection: 'column', gap: 'var(--lq-space-2xl)',
              }}>
                {teaserPost && (
                  <div style={{ position: 'relative', borderRadius: 'var(--lq-radius-card-lg)', overflow: 'hidden', height: '280px' }}>
                    <img src={teaserPost.image_url} alt="Recent community post" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                    <div style={{
                      position: 'absolute', left: '16px', bottom: '16px', display: 'flex', gap: '8px', alignItems: 'center',
                      background: 'rgba(32, 5, 11, 0.4)', backdropFilter: 'blur(6px)', borderRadius: 'var(--lq-radius-pill)', padding: '8px 14px',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--lq-white)' }}>
                        <CardHeartIcon size={14} filled />
                        <span style={ui(400, 12)}>{formatCount(teaserPost.likes_count)}</span>
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--lq-white)' }}>
                        <CommentDotsIcon size={14} />
                        <span style={ui(400, 12)}>{formatCount(teaserPost.comments_count)}</span>
                      </span>
                    </div>
                    {teaserAvatars.length > 0 && (
                      <div style={{ position: 'absolute', right: '20px', bottom: '18px', display: 'flex' }}>
                        {teaserAvatars.map((p, i) => (
                          <div key={i} style={{
                            width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--lq-white)',
                            overflow: 'hidden', background: 'rgba(255,255,255,0.2)', marginLeft: i > 0 ? '-10px' : 0,
                            transform: `rotate(${[-12, 8, 16][i % 3]}deg)`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {p.avatar_url
                              ? <img src={p.avatar_url} alt={p.display_name || 'Member'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={ui(400, 13)}>{(p.display_name || '?')[0].toUpperCase()}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', padding: '0 16px' }}>
                  <h2 style={{ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: '26px', lineHeight: 1.2, color: 'var(--lq-plum)' }}>
                    Explore our community
                  </h2>
                  <p style={{ ...ui(300, 15, 'var(--lq-plum)'), lineHeight: 1.35 }}>
                    Discover nail artists, share your designs, follow creators, and get inspired by the latest trends.
                  </p>
                </div>
                {tileImages.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', padding: '0 16px' }}>
                    {[
                      { img: tileImages[0], text: `${formatCount(communityStats.artists)} Artists` },
                      { img: tileImages[1] || tileImages[0], text: `${formatCount(communityStats.posts)} Community Posts` },
                    ].map((tile, i) => (
                      <div key={i} style={{ flex: 1, position: 'relative', height: '124px', borderRadius: 'var(--lq-radius-tile)', overflow: 'hidden' }}>
                        <img src={tile.img.image_url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                        <div aria-hidden style={{ position: 'absolute', inset: 0, background: 'rgba(32, 5, 11, 0.35)' }} />
                        <p style={{
                          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          textAlign: 'center', ...ui(400, 14), padding: '12px', whiteSpace: 'pre-line',
                        }}>{tile.text.replace(' ', '\n')}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ padding: '0 16px' }}>
                  <PillButton variant="wine" fullWidth onClick={() => { switchTab('community'); window.scrollTo({ top: 0 }) }}
                    style={{ fontFamily: 'var(--lq-font-display)', fontSize: '16px' }}>
                    Explore Community
                  </PillButton>
                </div>
              </section>
            )}

            {/* Explore Library (Promoted slots interleaved) */}
            <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--lq-space-lg)' }}>
              {sectionHeader('Explore Library')}
              {loadingExplore ? (
                <p style={{ ...ui(300, 14, 'var(--lq-white-80)'), textAlign: 'center', padding: '48px 0' }}>Loading...</p>
              ) : gridItems.length > 0 ? (
                <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  {gridCols.map((col, ci) => (
                    <div key={ci} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--lq-space-lg)' }}>
                      {col.map(({ design, tall }) => (
                        <DesignCard key={design.id + (design.__promoted ? '-promo' : '')} design={design}
                          tag={design.__promoted ? 'Promoted' : null}
                          meta="tags" width="100%" imageHeight={tall ? 190 : 150}
                          currentUser={currentUser} initiallySaved={savedDesignIds.has(design.id)}
                          onNavigate={rememberScroll} />
                      ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '48px 0' }}>
                  <p style={ui(400, 14)}>No designs in this vibe yet</p>
                  <p style={{ ...ui(300, 13, 'var(--lq-white-80)'), marginTop: '6px' }}>More coming soon</p>
                </div>
              )}
            </section>

            {/* Popular in Your Area — saves-driven until location data exists */}
            {popular.length > 0 && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: 'var(--lq-space-md)' }}>
                {sectionHeader('Popular in Your Area')}
                {carousel(popular.map(d => (
                  <DesignCard key={d.id} design={d} meta="saves" currentUser={currentUser}
                    initiallySaved={savedDesignIds.has(d.id)} onNavigate={rememberScroll} />
                )))}
              </section>
            )}
          </>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* COMMUNITY TAB                                                   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {mainTab === 'community' && (
          <div style={{ margin: '0 -24px' }}>
            {loadingCommunity ? (
              <p style={{ ...ui(300, 14, 'var(--lq-white-80)'), textAlign: 'center', padding: '48px 0' }}>Loading...</p>
            ) : community.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ ...ui(400, 15), marginBottom: '8px' }}>No community posts yet</p>
                <p style={{ ...ui(300, 13, 'var(--lq-white-80)'), lineHeight: 1.6, marginBottom: '20px' }}>
                  Be the first to share your nail work with the Laque community.
                </p>
                {currentUser && (userProfile?.account_type === 'creator' || userProfile?.account_type === 'salon') ? (
                  <PillButton href="/upload" style={{ display: 'inline-flex' }}>Post a design</PillButton>
                ) : !currentUser ? (
                  <PillButton href="/profile" style={{ display: 'inline-flex' }}>Sign in to post</PillButton>
                ) : null}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 16px' }}>
                {community.map(design => (
                  <CommunityCard key={design.id} design={design} currentUser={currentUser} initiallyLiked={likedDesignIds.has(design.id)} />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* UPDATES TAB                                                     */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {mainTab === 'updates' && (
          <div>
            {!currentUser ? (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <p style={{ ...ui(400, 15), marginBottom: '8px' }}>Sign in to see updates</p>
                <p style={{ ...ui(300, 13, 'var(--lq-white-80)'), lineHeight: 1.6, marginBottom: '20px' }}>
                  Follow salons and nail artists to get their latest news here.
                </p>
                <PillButton href="/profile" style={{ display: 'inline-flex' }}>Sign in</PillButton>
              </div>
            ) : loadingUpdates ? (
              <p style={{ ...ui(300, 14, 'var(--lq-white-80)'), textAlign: 'center', padding: '48px 0' }}>Loading...</p>
            ) : updates.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center' }}>
                <p style={{ ...ui(400, 15), marginBottom: '8px' }}>No updates yet</p>
                <p style={{ ...ui(300, 13, 'var(--lq-white-80)'), lineHeight: 1.6 }}>
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
                    <div key={post.id} style={{ background: 'var(--lq-glass)', border: '1px solid var(--lq-glass-border)', borderRadius: 'var(--lq-radius-tile)', padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                        <Link href={`/creator/${post.creator_id}`} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '10px', flex: 1 }}>
                          <div style={{ width: '38px', height: '38px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {avatar
                              ? <img src={avatar} alt={name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : <span style={ui(400, 15)}>{name[0].toUpperCase()}</span>
                            }
                          </div>
                          <div>
                            <p style={{ ...ui(400, 13), margin: 0 }}>{name}</p>
                            <p style={{ ...ui(300, 11, 'var(--lq-white-80)'), margin: '2px 0 0' }}>{ago}</p>
                          </div>
                        </Link>
                      </div>
                      <p style={{ ...ui(300, 14), lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{post.body}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════ */}
        {/* FOLLOWING TAB                                                   */}
        {/* ════════════════════════════════════════════════════════════════ */}
        {mainTab === 'following' && (
          <div style={{ margin: '0 -24px' }}>
            {!currentUser ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ ...ui(400, 15), marginBottom: '8px' }}>Sign in to see your feed</p>
                <p style={{ ...ui(300, 13, 'var(--lq-white-80)'), lineHeight: 1.6, marginBottom: '20px' }}>
                  Follow nail artists and salons to get their latest designs here.
                </p>
                <PillButton href="/profile" style={{ display: 'inline-flex' }}>Sign in</PillButton>
              </div>
            ) : loadingFollowing ? (
              <p style={{ ...ui(300, 14, 'var(--lq-white-80)'), textAlign: 'center', padding: '48px 0' }}>Loading...</p>
            ) : followingFeed.length === 0 ? (
              <div style={{ padding: '48px 24px', textAlign: 'center' }}>
                <p style={{ ...ui(400, 15), marginBottom: '8px' }}>Your feed is empty</p>
                <p style={{ ...ui(300, 13, 'var(--lq-white-80)'), lineHeight: 1.6, marginBottom: '20px' }}>
                  Follow nail artists and salons to see their latest designs here.
                </p>
                <PillButton href="/search" style={{ display: 'inline-flex' }}>Find creators</PillButton>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 16px' }}>
                {followingFeed.map(design => (
                  <CommunityCard key={design.id} design={design} currentUser={currentUser} initiallyLiked={likedDesignIds.has(design.id)} />
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
