'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const FILTERS = {
  occasion: ['everyday', 'night out', 'editorial', 'statement', 'wedding', 'bridal', 'party', 'birthday', 'office', 'date night', 'festival', 'holiday', 'vacation', 'new year\'s', 'christmas', 'halloween', 'valentine\'s', 'summer', 'autumn', 'winter', 'spring'],
  technique: ['gel', 'acrylic', 'dip powder', 'polygel', 'hard gel', 'biab', 'nail polish', 'press-on', 'chrome powder', 'cat eye', '3d gel', 'nail art', 'stamping', 'ombre', 'glitter', 'foil', 'airbrush'],
  shape: ['stiletto', 'almond', 'square', 'round', 'coffin', 'oval', 'ballerina', 'squoval'],
  length: ['short', 'medium', 'long', 'extra long'],
}

export default function SearchPage() {
  const [query, setQuery] = useState('')
  const [activeFilters, setActiveFilters] = useState({})
  const [designs, setDesigns] = useState([])
  const [loading, setLoading] = useState(false)
  const [openSection, setOpenSection] = useState(null)

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
      if (activeFilters.occasion) q = q.ilike('occasion', `%${activeFilters.occasion}%`)
      if (activeFilters.technique) q = q.ilike('technique', `%${activeFilters.technique}%`)
      if (activeFilters.shape) q = q.eq('shape', activeFilters.shape)
      if (activeFilters.length) q = q.eq('length', activeFilters.length)

      const { data } = await q
      setDesigns(data || [])
      setLoading(false)
    }

    fetch()
  }, [query, activeFilters])

  const toggleFilter = (category, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [category]: prev[category] === value ? undefined : value,
    }))
  }

  const clearAll = () => {
    setActiveFilters({})
    setQuery('')
  }

  const hasActiveFilters = Object.values(activeFilters).some(Boolean) || query.trim()

  return (
    <div style={{ padding: '24px 20px 0' }}>

      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Search
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Find designs by name or filter
        </p>
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: '16px' }}>
        <svg style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
          width="16" height="16" viewBox="0 0 16 16" fill="none">
          <circle cx="7" cy="7" r="5" stroke="#888888" strokeWidth="1.5"/>
          <path d="M11 11L14 14" stroke="#888888" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <input
          type="text"
          placeholder="Search designs..."
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

            {/* Section header */}
            <button
              onClick={() => setOpenSection(openSection === category ? null : category)}
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '12px 16px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', textTransform: 'capitalize' }}>
                  {category}
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

            {/* Options */}
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
                        border: 'none',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: '500',
                        fontFamily: "'DM Sans', sans-serif",
                        cursor: 'pointer',
                        textTransform: 'capitalize',
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

      {/* Clear filters */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          style={{
            background: 'none',
            border: '0.5px solid var(--border)',
            borderRadius: '20px',
            padding: '6px 16px',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
            marginBottom: '20px',
          }}
        >
          Clear all filters
        </button>
      )}

      {/* Results */}
      {loading ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '32px 0' }}>
          Loading...
        </p>
      ) : designs.length > 0 ? (
        <>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
            {designs.length} design{designs.length !== 1 ? 's' : ''}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {designs.map(design => (
              <Link
                key={design.id}
                href={`/design/${design.id}`}
                style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden', textDecoration: 'none', display: 'block' }}
              >
                {design.image_url ? (
                  <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                    <img src={design.image_url} alt={design.title} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
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

    </div>
  )
}
