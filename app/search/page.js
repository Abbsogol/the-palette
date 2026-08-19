'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Chip from '@/components/ui/Chip'
import SearchInput from '@/components/ui/SearchInput'
import IconButton from '@/components/ui/IconButton'
import PillButton from '@/components/ui/PillButton'
import HeartSaveButton from '@/components/ui/HeartSaveButton'
import Sheet from '@/components/ui/Sheet'
import { LaqueWordmark } from '@/components/ui/icons'

// Filter taxonomy from the redesign's filter panel (117:1700). Occasion keeps
// party/birthday/office beyond the drawn 18 — 72/46/53 published designs use
// them (checked 2026-08-19), dropping them would strand those designs. Length
// is kept as a sixth group by Sogol's call (data exists, not drawn).
const FILTERS = {
  vibe: ['dark & moody', 'minimal & clean', 'floral', 'coastal & summer', 'y2k & retro', 'pastel & soft', 'bridal & wedding', 'korean style', 'celestial', 'abstract & art', 'autumn & winter', 'boho & earthy', 'french tip', 'gothic soft', 'academia'],
  color: ['black', 'white', 'pink', 'nude', 'mauve', 'berry', 'red', 'purple', 'lilac', 'blue', 'teal', 'green', 'sage', 'brown', 'caramel', 'gold', 'chrome', 'yellow', 'glitter', 'multi'],
  shape: ['stiletto', 'almond', 'square', 'coffin', 'oval', 'squoval', 'round', 'flare', 'ballerina'],
  length: ['short', 'medium', 'long', 'extra long'],
  occasion: ['everyday', 'night out', 'editorial', 'statement', 'wedding', 'bridal', 'date night', 'festival', 'holiday', 'vacation', "new year's", 'christmas', 'halloween', "valentine's", 'summer', 'autumn', 'winter', 'spring', 'party', 'birthday', 'office'],
  technique: ['gel', 'acrylic', 'dip powder', 'polygel', 'hard gel', 'biab', 'nail polish', 'press-on', 'airbrush', 'cat eye', '3d gel', 'nail art', 'stamping', 'ombre', 'glitter', 'foil', 'chrome powder'],
}

const GROUP_LABELS = { vibe: 'Vibe & Style', color: 'Color', shape: 'Shape', length: 'Length', occasion: 'Occasion', technique: 'Technique' }

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

// The drawn 20 colour swatches, each mapping to colour_name search terms in
// the design_colours table (split out from the old 10 grouped colours).
const COLOR_SWATCHES = {
  black:   { hex: '#1A1A1A', terms: ['black', 'noir', 'ebony', 'onyx', 'obsidian'] },
  white:   { hex: '#F2F0EB', terms: ['white', 'ivory', 'milk', 'pearl', 'porcelain'] },
  pink:    { hex: '#F2A7BC', terms: ['pink', 'blush', 'petal', 'peach', 'coral', 'rose'] },
  nude:    { hex: '#E3C3A8', terms: ['nude', 'cream', 'sheer', 'vanilla', 'champagne', 'beige'] },
  mauve:   { hex: '#C08A96', terms: ['mauve', 'dusty'] },
  berry:   { hex: '#8E2E4F', terms: ['berry', 'cranberry', 'raspberry'] },
  red:     { hex: '#C21F30', terms: ['red', 'crimson', 'cherry', 'blood', 'scarlet', 'burgundy', 'wine'] },
  purple:  { hex: '#7B4FA3', terms: ['purple', 'violet', 'plum', 'grape', 'amethyst'] },
  lilac:   { hex: '#C4A6DE', terms: ['lilac', 'lavender'] },
  blue:    { hex: '#3D6FD1', terms: ['blue', 'navy', 'cobalt', 'sapphire', 'denim'] },
  teal:    { hex: '#2E9C9C', terms: ['teal', 'aqua', 'cyan', 'turquoise', 'ocean'] },
  green:   { hex: '#3E8E5A', terms: ['green', 'mint', 'olive', 'moss', 'forest', 'emerald', 'matcha'] },
  sage:    { hex: '#9CAF88', terms: ['sage', 'eucalyptus'] },
  brown:   { hex: '#6B4A32', terms: ['brown', 'chocolate', 'espresso', 'coffee', 'mocha'] },
  caramel: { hex: '#B07B4F', terms: ['caramel', 'tan', 'toffee', 'honey', 'terracotta', 'sienna'] },
  gold:    { hex: '#D4AF37', terms: ['gold', 'bronze', 'copper', 'brass'] },
  chrome:  { hex: '#C6C9D2', terms: ['chrome', 'silver', 'metallic', 'mirror', 'steel'] },
  yellow:  { hex: '#E9C46A', terms: ['yellow', 'lemon', 'butter', 'mustard'] },
  glitter: { hex: 'linear-gradient(135deg, #E9DFF2, #C9A9E0, #F2E3C9)', terms: ['glitter', 'sparkle', 'shimmer', 'holographic', 'iridescent'] },
  multi:   { hex: 'conic-gradient(#F2A7BC, #E9C46A, #3E8E5A, #3D6FD1, #7B4FA3, #F2A7BC)', terms: ['multi', 'rainbow', 'multicolor'] },
}

const EMPTY_FILTERS = { vibe: [], color: [], shape: [], length: [], occasion: [], technique: [] }

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.25,
})

function formatCount(n) {
  if (n == null) return '0'
  if (n >= 1000) {
    const k = n / 1000
    return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}k`
  }
  return String(n)
}

const countActive = (f) => Object.values(f).reduce((n, arr) => n + arr.length, 0)

// Builds the designs query for the current selections. Multi-select: OR
// within a group, AND across groups. Color needs a pre-query against
// design_colours; returns null when a selection provably matches nothing.
async function buildDesignQuery({ filters, text, tagFilter, sort, forCount = false }) {
  let q = forCount
    ? supabase.from('designs').select('id', { count: 'exact', head: true })
    : supabase.from('designs').select('*')
  q = q.eq('is_published', true)
  if (!forCount) {
    q = sort === 'most_saved'
      ? q.order('saves_count', { ascending: false })
      : q.order('created_at', { ascending: false })
  }

  if (text?.trim()) q = q.ilike('title', `%${text.trim()}%`)

  if (filters.vibe.length) {
    const keywords = [...new Set(filters.vibe.flatMap(v => VIBE_MAP[v] || []))]
    if (keywords.length) q = q.or(keywords.map(kw => `category.ilike.%${kw}%`).join(','))
  }

  if (filters.color.length) {
    const terms = [...new Set(filters.color.flatMap(c => COLOR_SWATCHES[c]?.terms || []))]
    if (terms.length) {
      const { data: colorRows } = await supabase
        .from('design_colours')
        .select('design_id')
        .or(terms.map(t => `colour_name.ilike.%${t}%`).join(','))
      const ids = [...new Set(colorRows?.map(r => r.design_id) || [])]
      if (ids.length === 0) return null
      q = q.in('id', ids)
    }
  }

  if (filters.shape.length) q = q.in('shape', filters.shape)
  if (filters.length.length) q = q.in('length', filters.length)
  if (filters.occasion.length) q = q.or(filters.occasion.map(o => `occasion.ilike.%${o}%`).join(','))
  if (filters.technique.length) q = q.or(filters.technique.map(t => `technique.ilike.%${t}%`).join(','))

  if (tagFilter) {
    const { data: tagRow } = await supabase.from('tags').select('id').eq('name', tagFilter).maybeSingle()
    if (!tagRow) return null
    const { data: designTagRows } = await supabase.from('design_tags').select('design_id').eq('tag_id', tagRow.id)
    const ids = designTagRows?.map(r => r.design_id) || []
    if (ids.length === 0) return null
    q = q.in('id', ids)
  }

  return q
}

export default function SearchPage() {
  const [mainTab, setMainTab] = useState('designs')
  const [currentUser, setCurrentUser] = useState(null)

  // Designs tab state
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [filters, setFilters] = useState(EMPTY_FILTERS)
  const [sort, setSort] = useState('newest')
  const [tagFilter, setTagFilter] = useState(null)
  const [designs, setDesigns] = useState([])
  const [savedDesignIds, setSavedDesignIds] = useState(new Set())
  const [people, setPeople] = useState([])
  const [loading, setLoading] = useState(false)

  // Filter panel state (staged locally, applied on "Show N Results")
  const [panelOpen, setPanelOpen] = useState(false)
  const [panelFilters, setPanelFilters] = useState(EMPTY_FILTERS)
  const [panelCount, setPanelCount] = useState(null)

  // Artists & Salons tab state
  const [salons, setSalons] = useState([])
  const [salonsLoaded, setSalonsLoaded] = useState(false)
  const [locationFilter, setLocationFilter] = useState('')

  // Read tag/query/filters from URL on mount
  const isFirstQuery = useRef(true)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tag = params.get('tag')
    const q = params.get('q')
    if (tag) setTagFilter(tag)
    if (q) setQuery(q)
    if (params.get('filters')) setPanelOpen(true)
    supabase.auth.getSession().then(({ data: { session } }) => setCurrentUser(session?.user || null))
  }, [])

  // Debounce query → debouncedQuery (500ms, same semantics as the existing
  // debounce in app/moodboards/[id]/page.js) so filter taps (which key off
  // `filters` directly, not this) stay instant while typing doesn't fire a
  // request per keystroke. Skips the debounce for the very first value so a
  // deep link (?q=...) still searches immediately.
  useEffect(() => {
    if (isFirstQuery.current) {
      isFirstQuery.current = false
      setDebouncedQuery(query)
      return
    }
    const timer = setTimeout(() => setDebouncedQuery(query), 500)
    return () => clearTimeout(timer)
  }, [query])

  // People search — runs in parallel when query is non-empty
  useEffect(() => {
    if (!debouncedQuery.trim()) { setPeople([]); return }
    const searchPeople = async () => {
      const q = debouncedQuery.trim()
      // Two separate .ilike() queries instead of one raw .or() string — a comma or
      // parenthesis typed into the search box could otherwise alter the filter logic.
      const [{ data: byName }, { data: byUsername }] = await Promise.all([
        supabase.from('profiles')
          .select('id, display_name, username, avatar_url, account_type, is_verified')
          .ilike('display_name', `%${q}%`)
          .in('account_type', ['nail_artist', 'creator', 'salon'])
          .limit(5),
        supabase.from('profiles')
          .select('id, display_name, username, avatar_url, account_type, is_verified')
          .ilike('username', `%${q}%`)
          .in('account_type', ['nail_artist', 'creator', 'salon'])
          .limit(5),
      ])
      const merged = [...(byName || [])]
      const seen = new Set(merged.map(p => p.id))
      ;(byUsername || []).forEach(p => { if (!seen.has(p.id)) merged.push(p) })
      setPeople(merged.slice(0, 5))
    }
    searchPeople()
  }, [debouncedQuery])

  // Results fetch
  useEffect(() => {
    const run = async () => {
      setLoading(true)
      const q = await buildDesignQuery({ filters, text: debouncedQuery, tagFilter, sort })
      if (!q) { setDesigns([]); setLoading(false); return }
      const { data, error } = await q.limit(100)
      if (error) console.error('search fetch failed:', error)
      setDesigns(data || [])
      setLoading(false)
      if (currentUser && data?.length) {
        const { data: savedRows } = await supabase
          .from('saved_designs')
          .select('design_id')
          .eq('user_id', currentUser.id)
          .in('design_id', data.map(d => d.id))
        setSavedDesignIds(new Set((savedRows || []).map(r => r.design_id)))
      }
    }
    run()
  }, [debouncedQuery, filters, tagFilter, sort, currentUser])

  // Live result count while the panel is open (debounced on staged edits)
  useEffect(() => {
    if (!panelOpen) return
    setPanelCount(null)
    const timer = setTimeout(async () => {
      const q = await buildDesignQuery({ filters: panelFilters, text: debouncedQuery, tagFilter, forCount: true })
      if (!q) { setPanelCount(0); return }
      const { count, error } = await q
      if (!error) setPanelCount(count ?? 0)
    }, 350)
    return () => clearTimeout(timer)
  }, [panelOpen, panelFilters, debouncedQuery, tagFilter])

  const openPanel = () => { setPanelFilters(filters); setPanelOpen(true) }
  const applyPanel = () => { setFilters(panelFilters); setPanelOpen(false) }
  const togglePanelValue = (group, value) => {
    setPanelFilters(prev => {
      const has = prev[group].includes(value)
      return { ...prev, [group]: has ? prev[group].filter(v => v !== value) : [...prev[group], value] }
    })
  }

  const switchMainTab = async (tab) => {
    setMainTab(tab)
    if (tab === 'salons' && !salonsLoaded) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, account_type, location, bio')
        .in('account_type', ['nail_artist', 'creator', 'salon'])
        .order('display_name', { ascending: true })
        .limit(200)
      if (error) console.error('salons fetch failed:', error)
      setSalons(data || [])
      setSalonsLoaded(true)
    }
  }

  const filteredSalons = locationFilter.trim()
    ? salons.filter(s =>
        s.location?.toLowerCase().includes(locationFilter.trim().toLowerCase()) ||
        s.display_name?.toLowerCase().includes(locationFilter.trim().toLowerCase()) ||
        s.username?.toLowerCase().includes(locationFilter.trim().toLowerCase())
      )
    : salons

  const activeCount = countActive(filters)
  const hasActive = activeCount > 0 || query.trim() || tagFilter

  const clearAll = () => { setFilters(EMPTY_FILTERS); setQuery(''); setTagFilter(null) }

  const metaLine = (d) => [
    d.shape, d.length,
    ...(d.technique || '').split(',').map(t => t.trim()).filter(Boolean).slice(0, 2),
    d.category,
    (d.occasion || '').split(',')[0]?.trim(),
  ].filter(Boolean)

  const rememberScroll = () => sessionStorage.setItem('search-scroll', window.scrollY.toString())

  // Restore scroll on back navigation (same pattern as the feed)
  const scrollRestored = useRef(false)
  useEffect(() => {
    if (loading || scrollRestored.current || designs.length === 0) return
    const saved = sessionStorage.getItem('search-scroll')
    if (saved) {
      scrollRestored.current = true
      setTimeout(() => { window.scrollTo(0, parseInt(saved)); sessionStorage.removeItem('search-scroll') }, 50)
    }
  }, [loading, designs])

  return (
    <div style={{ position: 'relative', padding: 'calc(env(safe-area-inset-top) + 12px) 24px 24px' }}>

      {/* Fixed blurred-wine page background */}
      <div aria-hidden style={{
        position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px', zIndex: -1,
        background: '#29000A url(/redesign/bg-blur.png) center / cover no-repeat',
      }} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'center', color: 'var(--lq-white)', marginBottom: '16px' }}>
        <LaqueWordmark height={18} />
      </div>
      <h1 style={{ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: '34px', color: 'var(--lq-white)', lineHeight: 1.15 }}>Search</h1>
      <p style={{ ...ui(300, 14, 'var(--lq-white-80)'), marginTop: '4px', marginBottom: '18px' }}>Find designs, nail artists & salons</p>

      {/* Tabs */}
      <div role="tablist" aria-label="Search sections" style={{ display: 'flex', gap: '28px', marginBottom: '18px' }}>
        {[['designs', 'Designs'], ['salons', 'Artists & Salons']].map(([val, label]) => (
          <button key={val} role="tab" aria-selected={mainTab === val} onClick={() => switchMainTab(val)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '8px 0', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', minHeight: '44px' }}>
            <span style={ui(mainTab === val ? 400 : 300, 15, mainTab === val ? 'var(--lq-white)' : 'var(--lq-white-80)')}>{label}</span>
            <span aria-hidden style={{ width: '100%', height: '2px', borderRadius: 'var(--lq-radius-pill)', background: mainTab === val ? 'var(--lq-accent-b)' : 'transparent' }} />
          </button>
        ))}
      </div>

      {/* Search input — serves the active tab */}
      <div style={{ marginBottom: '16px' }}>
        {mainTab === 'designs' ? (
          <SearchInput
            variant="solid"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFilterClick={openPanel}
            filterBadge={activeCount}
            label="Search designs"
          />
        ) : (
          <SearchInput
            variant="solid"
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            placeholder="Search by name, @username or city..."
            label="Search artists and salons by name, username or city"
          />
        )}
      </div>

      {/* ── DESIGNS TAB ──────────────────────────────────────────────────── */}
      {mainTab === 'designs' && <>

        {/* Active tag chip */}
        {tagFilter && (
          <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={ui(300, 12, 'var(--lq-white-80)')}>Tag:</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px',
              background: 'var(--lq-accent-b)', color: 'var(--lq-white)',
              ...ui(500, 12), padding: '5px 12px', borderRadius: 'var(--lq-radius-pill)',
            }}>
              #{tagFilter}
              <button onClick={() => setTagFilter(null)} aria-label={`Remove tag filter ${tagFilter}`}
                style={{ background: 'none', border: 'none', color: 'var(--lq-white)', cursor: 'pointer', padding: '4px', lineHeight: 1, fontSize: '14px' }}>×</button>
            </span>
          </div>
        )}

        {/* Count + sort row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', minHeight: '32px' }}>
          <p style={ui(300, 13, 'var(--lq-white-80)')} aria-live="polite">
            {loading ? 'Searching…' : `${designs.length} ${hasActive ? `result${designs.length !== 1 ? 's' : ''}` : `design${designs.length !== 1 ? 's' : ''}`}`}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            {hasActive && (
              <button onClick={clearAll} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '10px 6px', ...ui(300, 12, 'var(--lq-white-80)'), textDecoration: 'underline' }}>
                Clear all
              </button>
            )}
            <button
              onClick={() => setSort(s => s === 'newest' ? 'most_saved' : 'newest')}
              aria-label={`Sort: ${sort === 'newest' ? 'newest first' : 'most saved first'}. Tap to switch.`}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 0 10px 6px', color: 'var(--lq-white)' }}
            >
              <svg width="18" height="18" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M6 4v12M6 16l-2.5-2.5M6 16l2.5-2.5M14 16V4M14 4l-2.5 2.5M14 4l2.5 2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={ui(300, 12)}>{sort === 'newest' ? 'Newest' : 'Most saved'}</span>
            </button>
          </div>
        </div>

        {/* People results */}
        {people.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <p style={{ ...ui(500, 11, 'var(--lq-accent-b)'), letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>People</p>
            <div style={{ display: 'flex', gap: '10px', overflowX: 'auto', scrollbarWidth: 'none', margin: '0 -24px', padding: '0 24px' }}>
              {people.map(person => (
                <Link key={person.id} href={`/creator/${person.id}`} style={{
                  flexShrink: 0, textDecoration: 'none',
                  background: 'var(--lq-glass)', border: '1px solid var(--lq-glass-border)',
                  borderRadius: 'var(--lq-radius-tile)', padding: '12px 14px',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', minWidth: '96px',
                }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {person.avatar_url
                      ? <img src={person.avatar_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={ui(400, 18)}>{(person.display_name || '?')[0].toUpperCase()}</span>}
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <p style={{ ...ui(400, 12), maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.display_name || 'Creator'}</p>
                    {person.username && <p style={{ ...ui(300, 10, 'var(--lq-white-80)'), margin: '2px 0 0', maxWidth: '80px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{person.username}</p>}
                  </div>
                  <span style={{ background: 'var(--lq-accent-b)', color: 'var(--lq-white)', ...ui(500, 9), padding: '3px 9px', borderRadius: 'var(--lq-radius-pill)', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {person.account_type === 'salon' ? 'Salon' : 'Nail Artist'}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Design results — full-width cards as drawn */}
        {loading ? (
          <p style={{ ...ui(300, 14, 'var(--lq-white-80)'), textAlign: 'center', padding: '32px 0' }}>Loading...</p>
        ) : designs.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {designs.map(design => (
              <article key={design.id}>
                <div style={{ position: 'relative', borderRadius: 'var(--lq-radius-card-lg)', overflow: 'hidden' }}>
                  <Link href={`/design/${design.id}?from=%2Fsearch`} onClick={rememberScroll} aria-label={design.title || 'View design'}>
                    {design.image_url ? (
                      <img src={design.image_url} alt={design.title} loading="lazy" decoding="async"
                        style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', display: 'block', background: 'rgba(255,255,255,0.06)' }} />
                    ) : (
                      <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.06)' }} />
                    )}
                  </Link>
                  <span style={{ position: 'absolute', bottom: '4px', right: '4px' }}>
                    <HeartSaveButton designId={design.id} currentUser={currentUser} initiallySaved={savedDesignIds.has(design.id)} />
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '12px', padding: '10px 2px 0' }}>
                  <Link href={`/design/${design.id}?from=%2Fsearch`} onClick={rememberScroll} style={{ textDecoration: 'none', minWidth: 0 }}>
                    <h2 style={{ ...ui(400, 19), whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{design.title}</h2>
                  </Link>
                  <span style={{ ...ui(300, 12, 'var(--lq-white-80)'), flexShrink: 0 }}>{formatCount(design.saves_count)} saves</span>
                </div>
                {metaLine(design).length > 0 && (
                  <p style={{ ...ui(300, 12, 'var(--lq-white-80)'), padding: '4px 2px 0', textTransform: 'capitalize' }}>
                    {metaLine(design).join(' • ')}
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={ui(400, 14)}>No designs found</p>
            {hasActive && <p style={{ ...ui(300, 13, 'var(--lq-white-80)'), marginTop: '8px' }}>Try adjusting your filters</p>}
          </div>
        )}

      </>}

      {/* ── ARTISTS & SALONS TAB ─────────────────────────────────────────── */}
      {mainTab === 'salons' && (
        <div>
          {!salonsLoaded ? (
            <p style={{ ...ui(300, 14, 'var(--lq-white-80)'), textAlign: 'center', padding: '48px 0' }}>Loading...</p>
          ) : filteredSalons.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={{ ...ui(400, 15), marginBottom: '8px' }}>
                {locationFilter.trim() ? 'No artists or salons found' : 'No salons yet'}
              </p>
              <p style={ui(300, 13, 'var(--lq-white-80)')}>
                {locationFilter.trim() ? 'Try a different name or city.' : 'Salons will appear here once they sign up.'}
              </p>
            </div>
          ) : (
            <>
              <p style={{ ...ui(300, 13, 'var(--lq-white-80)'), marginBottom: '14px' }} aria-live="polite">
                {filteredSalons.length} {filteredSalons.length === 1 ? 'item' : 'items'}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {filteredSalons.map(salon => (
                  <Link key={salon.id} href={`/creator/${salon.id}`} style={{
                    textDecoration: 'none',
                    background: 'var(--lq-glass)', border: '1px solid var(--lq-glass-border)',
                    borderRadius: 'var(--lq-radius-card-lg)', padding: '20px 12px 16px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
                  }}>
                    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.15)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {salon.avatar_url
                        ? <img src={salon.avatar_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={ui(400, 26)}>{(salon.display_name || '?')[0].toUpperCase()}</span>}
                    </div>
                    <span style={{ background: 'var(--lq-accent-b)', color: 'var(--lq-white)', ...ui(500, 9), padding: '3px 10px', borderRadius: 'var(--lq-radius-pill)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                      {salon.account_type === 'salon' ? 'Salon' : 'Nail Artist'}
                    </span>
                    <p style={{ ...ui(400, 15), textAlign: 'center', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {salon.display_name || 'Salon'}
                    </p>
                    {salon.location && (
                      <p style={{ ...ui(300, 12, 'var(--lq-white-80)'), margin: '-4px 0 0', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📍 {salon.location}
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── FILTER PANEL ─────────────────────────────────────────────────── */}
      {panelOpen && (
        <Sheet
          fullScreen
          title="Search filters"
          onClose={() => setPanelOpen(false)}
          footer={
            <PillButton variant="primary" fullWidth onClick={applyPanel}>
              {panelCount == null ? 'Show Results' : `Show ${panelCount} Result${panelCount !== 1 ? 's' : ''}`}
            </PillButton>
          }
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
            <h2 style={{ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: '30px', color: 'var(--lq-white)' }}>Filters</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <button onClick={() => setPanelFilters(EMPTY_FILTERS)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '12px 8px', ...ui(300, 13, 'var(--lq-white-80)'), textDecoration: 'underline' }}>
                Clear All
              </button>
              <IconButton label="Close filters" onClick={() => setPanelOpen(false)} variant="plain" visualSize={32}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <path d="M4 4L14 14M14 4L4 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </IconButton>
            </div>
          </div>

          {Object.entries(FILTERS).map(([group, options]) => (
            <div key={group} style={{ marginBottom: '20px' }}>
              <p style={{ ...ui(400, 16), marginBottom: '10px' }}>
                {GROUP_LABELS[group]}
                <span style={ui(300, 14, 'var(--lq-white-80)')}> ( {panelFilters[group].length} )</span>
              </p>
              {group === 'color' ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '4px 8px' }}>
                  {options.map(name => {
                    const sw = COLOR_SWATCHES[name]
                    const active = panelFilters.color.includes(name)
                    return (
                      <button key={name} onClick={() => togglePanelValue('color', name)} aria-pressed={active}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0', minHeight: '44px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
                        <span aria-hidden style={{
                          width: '32px', height: '32px', borderRadius: '50%',
                          background: sw.hex,
                          border: active ? '2px solid var(--lq-accent-b)' : '1px solid var(--lq-glass-border)',
                          boxShadow: active ? '0 0 0 2px rgba(255, 81, 127, 0.35)' : 'none',
                        }} />
                        <span style={{ ...ui(300, 11, active ? 'var(--lq-white)' : 'var(--lq-white-80)'), textTransform: 'capitalize' }}>{name}</span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 8px' }}>
                  {options.map(option => (
                    <Chip key={option} active={panelFilters[group].includes(option)} onClick={() => togglePanelValue(group, option)}>
                      <span style={{ textTransform: 'capitalize' }}>{option}</span>
                    </Chip>
                  ))}
                </div>
              )}
            </div>
          ))}
        </Sheet>
      )}

    </div>
  )
}
