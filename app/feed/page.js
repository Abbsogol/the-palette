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
  const [stories, setStories]         = useState([])   // [{user_id, display_name, avatar_url, latest_story}]
  const [currentUser, setCurrentUser] = useState(null)
  const [viewingStories, setViewingStories] = useState(null) // array of story objects for the viewed user
  const [storyIndex, setStoryIndex]   = useState(0)

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

  const openStories = (userId) => {
    // Get all stories for this user, ordered oldest→newest so we can page through
    supabase.from('stories')
      .select('*, profiles(display_name, avatar_url)')
      .eq('user_id', userId)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (data?.length) { setViewingStories(data); setStoryIndex(0) }
      })
  }

  const closeStories = () => { setViewingStories(null); setStoryIndex(0) }

  const nextStory = () => {
    if (storyIndex < viewingStories.length - 1) setStoryIndex(i => i + 1)
    else closeStories()
  }

  const prevStory = () => {
    if (storyIndex > 0) setStoryIndex(i => i - 1)
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
      {viewingStories && (
        <div
          onClick={nextStory}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#000',
            display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Progress bars */}
          <div style={{ display: 'flex', gap: '4px', padding: '12px 12px 0', position: 'relative', zIndex: 2 }}>
            {viewingStories.map((_, i) => (
              <div key={i} style={{ flex: 1, height: '2px', borderRadius: '2px', background: i <= storyIndex ? '#fff' : 'rgba(255,255,255,0.3)' }} />
            ))}
          </div>

          {/* Top bar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', position: 'relative', zIndex: 2 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#333', overflow: 'hidden', border: '1.5px solid #D4A0C0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {viewingStories[storyIndex].profiles?.avatar_url ? (
                  <img src={viewingStories[storyIndex].profiles.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: '#D4A0C0', fontSize: '14px', fontWeight: '500' }}>
                    {(viewingStories[storyIndex].profiles?.display_name || '?')[0].toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p style={{ color: '#fff', fontSize: '14px', fontWeight: '500', lineHeight: 1 }}>
                  {viewingStories[storyIndex].profiles?.display_name || 'User'}
                </p>
                <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '11px', marginTop: '2px' }}>
                  {timeAgo(viewingStories[storyIndex].created_at)}
                </p>
              </div>
            </div>
            <button onClick={closeStories}
              style={{ background: 'none', border: 'none', color: '#fff', fontSize: '22px', cursor: 'pointer', lineHeight: 1, padding: '4px' }}>
              ✕
            </button>
          </div>

          {/* Image */}
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
            <img
              src={viewingStories[storyIndex].image_url}
              alt="story"
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
            />

            {/* Tap zones: left = prev, right = next */}
            <div style={{ position: 'absolute', left: 0, top: 0, width: '35%', height: '100%', cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); prevStory() }} />
            <div style={{ position: 'absolute', right: 0, top: 0, width: '65%', height: '100%', cursor: 'pointer' }}
              onClick={e => { e.stopPropagation(); nextStory() }} />
          </div>

          {/* Caption */}
          {viewingStories[storyIndex].caption && (
            <div style={{ padding: '12px 20px 24px', position: 'relative', zIndex: 2 }}
              onClick={e => e.stopPropagation()}>
              <p style={{ color: '#fff', fontSize: '14px', lineHeight: '1.5' }}>
                {viewingStories[storyIndex].caption}
              </p>
            </div>
          )}
        </div>
      )}

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
            return (
              <button
                key={story.user_id}
                onClick={() => openStories(story.user_id)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', background: 'none', border: 'none', padding: 0, cursor: 'pointer', flexShrink: 0 }}
              >
                <div style={{
                  width: '60px', height: '60px', borderRadius: '50%',
                  padding: '2px',
                  background: 'linear-gradient(135deg, #D4A0C0 0%, #9B5E8A 100%)',
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
