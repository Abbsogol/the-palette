'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const FILTERS = {
  vibe: ['dark & moody', 'minimal & clean', 'floral', 'coastal & summer', 'y2k & retro', 'pastel & soft', 'bridal & wedding', 'korean style', 'abstract & art', 'celestial', 'autumn & winter', 'boho & earthy', 'french tip', 'gothic soft', 'academia'],
  color: ['black', 'white & nude', 'pink & mauve', 'red & berry', 'purple & lilac', 'blue & teal', 'green & sage', 'brown & caramel', 'gold & chrome', 'glitter & multi'],
  shape: ['stiletto', 'almond', 'square', 'round', 'coffin', 'oval', 'ballerina', 'squoval', 'flare'],
  length: ['short', 'medium', 'long', 'extra long'],
  occasion: ['everyday', 'night out', 'editorial', 'statement', 'wedding', 'bridal', 'party', 'birthday', 'office', 'date night', 'festival', 'holiday', 'vacation', 'new year\'s', 'christmas', 'halloween', 'valentine\'s', 'summer', 'autumn', 'winter', 'spring'],
  technique: ['gel', 'acrylic', 'dip powder', 'polygel', 'hard gel', 'biab', 'nail polish', 'press-on', 'chrome powder', 'cat eye', '3d gel', 'nail art', 'stamping', 'ombre', 'glitter', 'foil', 'airbrush'],
}

// Maps vibe filter values → category keywords to match against
const VIBE_MAP = {
  'dark & moody':      ['dark', 'gothic', 'noir', 'academia', 'vampire'],
  'minimal & clean':   ['minimal', 'clean', 'nude', 'sheer', 'glass'],
  'floral':            ['floral', 'flower', 'blossom', 'garden', 'petal'],
  'coastal & summer':  ['coastal', 'summer', 'sea', 'ocean', 'beach', 'mermaid'],
  'y2k & retro':       ['y2k', 'retro', 'nostalgia', 'polaroid', 'kodak', 'film'],
  'pastel & soft':     ['pastel', 'cute', 'baby', 'soft', 'cotton'],
  'bridal & wedding':  ['bridal', 'wedding', 'bride', 'ivory'],
  'korean style':      ['korean'],
  'abstract & art':    ['abstract', 'art', 'ink', 'aura', 'neon'],
  'celestial':         ['celestial', 'galaxy', 'moon', 'star', 'aurora'],
  'autumn & winter':   ['autumn', 'winter', 'fall', 'warm nostalgia', 'boho', 'earthy'],
  'boho & earthy':     ['boho', 'earthy', 'terracotta', 'desert', 'sage'],
  'french tip':        ['french', 'tip', 'milk glass'],
  'gothic soft':       ['gothic soft', 'ghost', 'soft ruin', 'velvet rot', 'moon ritual'],
  'academia':          ['academia', 'dead poets', 'leather', 'ink bleed'],
}

// Maps color filter → search terms for colour_name in design_colours table
const COLOR_MAP = {
  'black':            ['black', 'noir', 'ebony', 'onyx', 'obsidian'],
  'white & nude':     ['white', 'nude', 'ivory', 'cream', 'milk', 'sheer', 'vanilla', 'champagne', 'pearl'],
  'pink & mauve':     ['pink', 'mauve', 'rose', 'blush', 'petal', 'peach', 'coral', 'dusty'],
  'red & berry':      ['red', 'berry', 'crimson', 'cherry', 'burgundy', 'wine', 'blood', 'cranberry'],
  'purple & lilac':   ['purple', 'lilac', 'lavender', 'violet', 'plum', 'grape', 'amethyst'],
  'blue & teal':      ['blue', 'teal', 'navy', 'cobalt', 'aqua', 'cyan', 'ocean', 'sapphire'],
  'green & sage':     ['green', 'sage', 'mint', 'olive', 'moss', 'forest', 'emerald', 'matcha'],
  'brown & caramel':  ['brown', 'caramel', 'tan', 'chocolate', 'espresso', 'coffee', 'terracotta', 'sienna'],
  'gold & chrome':    ['gold', 'chrome', 'silver', 'metallic', 'mirror', 'foil', 'bronze', 'copper'],
  'glitter & multi':  ['glitter', 'sparkle', 'iridescent', 'holographic', 'rainbow', 'multi', 'neon'],
}

export default function SearchPage() {
  const [mainTab, setMainTab] = useState('designs')

  // Designs tab state
  const [query, setQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState({})
  const [tagFilter, setTagFilter] = useState(null)
  const [designs, setDesigns] = useState([])
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(false)
  const [openSection, setOpenSection] = useState(null)

  // Salons tab state
  const [salons, setSalons] = useState([])
  const [salonsLoaded, setSalonsLoaded] = useState(false)
  const [locationFilter, setLocationFilter] = useState('')

  // Read tag/query from URL on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tag = params.get('tag')
    const q = params.get('q')
    if (tag) setTagFilter(tag)
    if (q) setQuery(q)
  }, [])

  // People search — runs in parallel when query is non-empty
  useEffect(() => {
    if (!query.trim()) { setPeople([]); return }
    const searchPeople = async () => {
      const q = query.trim()
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, account_type, is_verified')
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%`)
        .in('account_type', ['creator', 'salon'])
        .limit(5)
      setPeople(data || [])
    }
    searchPeople()
  }, [query])

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)

      let q = supabase
        .from('designs')
        .select('*')
        .eq('is_published', true)
        .order('created_at', { ascending: false })

      if (query.trim()) {
        q = q.ilike('title', `%${query.trim()}%`)
      }

      // Vibe filter — OR across category keywords
      if (activeFilters.vibe) {
        const keywords = VIBE_MAP[activeFilters.vibe] || []
        const orParts = keywords.map(kw => `category.ilike.%${kw}%`)
        if (orParts.length) q = q.or(orParts.join(','))
      }

      // Color filter — find design IDs that have a matching colour entry
      if (activeFilters.color) {
        const terms = COLOR_MAP[activeFilters.color] || []
        const colorOrParts = terms.map(t => `colour_name.ilike.%${t}%`)
        if (colorOrParts.length) {
          const { data: colorRows } = await supabase
            .from('design_colours')
            .select('design_id')
            .or(colorOrParts.join(','))
          const colorDesignIds = [...new Set(colorRows?.map(r => r.design_id) || [])]
          if (colorDesignIds.length > 0) {
            q = q.in('id', colorDesignIds)
          } else {
            setDesigns([])
            setLoading(false)
            return
          }
        }
      }

      if (activeFilters.shape) q = q.eq('shape', activeFilters.shape)
      if (activeFilters.length) q = q.eq('length', activeFilters.length)
      if (activeFilters.occasion) q = q.ilike('occasion', `%${activeFilters.occasion}%`)
      if (activeFilters.technique) q = q.ilike('technique', `%${activeFilters.technique}%`)

      // Tag filter: look up tag ID then filter designs by it
      if (tagFilter) {
        const { data: tagRow } = await supabase
          .from('tags')
          .select('id')
          .eq('name', tagFilter)
          .single()

        if (tagRow) {
          const { data: designTagRows } = await supabase
            .from('design_tags')
            .select('design_id')
            .eq('tag_id', tagRow.id)

          const ids = designTagRows?.map(r => r.design_id) || []
          if (ids.length > 0) {
            q = q.in('id', ids)
          } else {
            setDesigns([])
            setLoading(false)
            return
          }
        } else {
          setDesigns([])
          setLoading(false)
          return
        }
      }

      const { data } = await q
      setDesigns(data || [])
      setLoading(false)
    }

    fetch()
  }, [query, activeFilters, tagFilter])

  const switchMainTab = async (tab) => {
    setMainTab(tab)
    if (tab === 'salons' && !salonsLoaded) {
      const { data } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, location, bio')
        .eq('account_type', 'salon')
        .order('display_name', { ascending: true })
      setSalons(data || [])
      setSalonsLoaded(true)
    }
  }

  const filteredSalons = locationFilter.trim()
    ? salons.filter(s => s.location?.toLowerCase().includes(locationFilter.trim().toLowerCase()) || s.display_name?.toLowerCase().includes(locationFilter.trim().toLowerCase()))
    : salons

  const toggleFilter = (category, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [category]: prev[category] === value ? undefined : value,
    }))
  }

  const clearAll = () => {
    setActiveFilters({})
    setQuery('')
    setTagFilter(null)
  }

  const hasActiveFilters = Object.values(activeFilters).some(Boolean) || query.trim() || tagFilter

  return (
    <div style={{ padding: '24px 20px 0' }}>

      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Search
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Find designs, nail artists & salons
        </p>
      </div>

      {/* Main tabs */}
      <div style={{ display: 'flex', borderBottom: '0.5px solid var(--border)', marginBottom: '20px' }}>
        {[['designs', 'Designs'], ['salons', 'Salons']].map(([val, label]) => (
          <button
            key={val}
            onClick={() => switchMainTab(val)}
            style={{
              flex: 1, background: 'none', border: 'none',
              borderBottom: mainTab === val ? '2px solid var(--accent)' : '2px solid transparent',
              color: mainTab === val ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '14px', fontWeight: mainTab === val ? '600' : '400',
              fontFamily: "'DM Sans', sans-serif",
              padding: '10px 0', cursor: 'pointer',
              transition: 'color 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── SALONS TAB ─────────────────────────────────────────────────────── */}
      {mainTab === 'salons' && (
        <div>
          {/* Location filter */}
          <div style={{ position: 'relative', marginBottom: '16px' }}>
            <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1.5C5.79 1.5 4 3.29 4 5.5C4 8.5 8 14.5 8 14.5C8 14.5 12 8.5 12 5.5C12 3.29 10.21 1.5 8 1.5Z" stroke="#888888" strokeWidth="1.3"/>
              <circle cx="8" cy="5.5" r="1.5" stroke="#888888" strokeWidth="1.3"/>
            </svg>
            <input
              type="text"
              placeholder="Filter by city or area..."
              value={locationFilter}
              onChange={e => setLocationFilter(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg-card)', border: '0.5px solid var(--border)',
                borderRadius: '12px', padding: '12px 12px 12px 38px',
                color: 'var(--text-primary)', fontSize: '14px',
                fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box',
              }}
            />
          </div>

          {!salonsLoaded ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>Loading...</p>
          ) : filteredSalons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>
                {locationFilter.trim() ? 'No salons found in that area' : 'No salons yet'}
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                {locationFilter.trim() ? 'Try a different city or area.' : 'Salons will appear here once they sign up.'}
              </p>
            </div>
          ) : (
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
                {filteredSalons.length} salon{filteredSalons.length !== 1 ? 's' : ''}
              </p>
              {filteredSalons.map(salon => (
                <Link
                  key={salon.id}
                  href={`/creator/${salon.id}`}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 0', borderBottom: '0.5px solid var(--border)', textDecoration: 'none' }}
                >
                  <div style={{
                    width: '52px', height: '52px', borderRadius: '50%',
                    background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '0.5px solid var(--border)',
                  }}>
                    {salon.avatar_url
                      ? <img src={salon.avatar_url} alt={salon.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ color: 'var(--accent)', fontSize: '19px', fontWeight: '500' }}>
                          {(salon.display_name || '?')[0].toUpperCase()}
                        </span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {salon.display_name || 'Salon'}
                      </p>
                      <span style={{ background: 'var(--bg-chip)', color: 'var(--accent)', fontSize: '9px', fontWeight: '600', padding: '2px 7px', borderRadius: '20px', letterSpacing: '0.04em', flexShrink: 0 }}>
                        SALON
                      </span>
                    </div>
                    {salon.location && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                        📍 {salon.location}
                      </p>
                    )}
                    {salon.bio && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {salon.bio}
                      </p>
                    )}
                  </div>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M6 4L10 8L6 12" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DESIGNS TAB ────────────────────────────────────────────────────── */}
      {mainTab === 'designs' && <>

      {/* Active tag chip */}
      {tagFilter && (
        <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Tag:</span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            background: 'var(--accent)', color: '#2C0A1E',
            fontSize: '12px', fontWeight: '600',
            padding: '5px 12px', borderRadius: '20px',
          }}>
            #{tagFilter}
            <button
              onClick={() => setTagFilter(null)}
              style={{ background: 'none', border: 'none', color: '#2C0A1E', cursor: 'pointer', padding: 0, lineHeight: 1, fontSize: '14px' }}
            >×</button>
          </span>
        </div>
      )}

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="#888888" strokeWidth="1.5"/>
          <path d="M11 11L14 14" stroke="#888888" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          placeholder="Search designs, nail artists, salons..."
          value={query}
          onChange={e => setQuery(e.target.value)}
          style={{
            width: '100%',
            background: 'var(--bg-card)',
            border: '0.5px solid var(--border)',
            borderRadius: '12px',
            padding: '12px 12px 12px 38px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Filter sections */}
      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Object.entries(FILTERS).map(([category, options]) => (
          <div key={category} style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
            <button
              onClick={() => setOpenSection(openSection === category ? null : category)}
              style={{
                width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', textTransform: 'capitalize' }}>
                  {category === 'vibe' ? 'Vibe / Style' : category === 'color' ? 'Color' : category}
                </span>
                {activeFilters[category] && (
                  <span style={{ background: 'var(--accent)', color: '#2C0A1E', fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '20px', textTransform: 'capitalize' }}>
                    {activeFilters[category]}
                  </span>
                )}
              </span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"
                style={{ transform: openSection === category ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                <path d="M3 5L7 9L11 5" stroke="#888888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            {openSection === category && (
              <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {options.map(option => {
                  const isActive = activeFilters[category] === option
                  return (
                    <button
                      key={option}
                      onClick={() => toggleFilter(category, option)}
                      style={{
                        background: isActive ? 'var(--accent)' : 'var(--bg-chip)',
                        color: isActive ? '#2C0A1E' : 'var(--text-secondary)',
                        border: 'none', borderRadius: '20px', padding: '6px 14px',
                        fontSize: '12px', fontWeight: '500',
                        fontFamily: "'DM Sans', sans-serif",
                        cursor: 'pointer', textTransform: 'capitalize',
                      }}
                    >
                      {option}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      {hasActiveFilters && (
        <button
          onClick={clearAll}
          style={{
            background: 'none', border: '0.5px solid var(--border)', borderRadius: '20px',
            padding: '6px 16px', color: 'var(--text-secondary)', fontSize: '12px',
            fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', marginBottom: '20px',
          }}
        >
          Clear all filters
        </button>
      )}

      {loading ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>
          Loading...
        </p>
      ) : designs.length > 0 || people.length > 0 ? (
        <>
          {/* ── People results ── */}
          {people.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
                People
              </p>
              <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
                {people.map(person => (
                  <Link key={person.id} href={`/creator/${person.id}`} style={{
                    flexShrink: 0, textDecoration: 'none',
                    background: 'var(--bg-card)', border: '0.5px solid var(--border)',
                    borderRadius: '14px', padding: '12px 14px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
                    minWidth: '90px',
                  }}>
                    <div style={{
                      width: '48px', height: '48px', borderRadius: '50%',
                      background: 'var(--bg-chip)', overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {person.avatar_url
                        ? <img src={person.avatar_url} alt={person.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: '500' }}>
                            {(person.display_name || '?')[0].toUpperCase()}
                          </span>
                      }
                    </div>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                        <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', margin: 0, maxWidth: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {person.display_name || 'Creator'}
                        </p>
                        {person.is_verified && (
                          <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                            <circle cx="8" cy="8" r="7" fill="#D4A0C0"/>
                            <path d="M5 8L7 10L11 6" stroke="#2C0A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                      </div>
                      {person.username && (
                        <p style={{ color: 'var(--text-secondary)', fontSize: '10px', margin: '2px 0 0', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          @{person.username}
                        </p>
                      )}
                    </div>
                    <span style={{
                      background: 'var(--bg-chip)', color: 'var(--accent)',
                      fontSize: '10px', fontWeight: '500', padding: '3px 8px',
                      borderRadius: '20px', letterSpacing: '0.04em',
                    }}>
                      {person.account_type === 'salon' ? 'Salon' : 'Nail Artist'}
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {designs.length > 0 && <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
            {designs.length} design{designs.length !== 1 ? 's' : ''}
          </p>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {designs.map(design => (
              <Link
                key={design.id}
                href={`/design/${design.id}?from=%2Fsearch`}
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
        </>
      ) : (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No designs found</p>
          {hasActiveFilters && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '8px' }}>Try adjusting your filters</p>
          )}
        </div>
      )}

      </>}

    </div>
  )
}
