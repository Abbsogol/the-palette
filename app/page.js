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
  const [designs, setDesigns] = useState([])
  const [saveCountMap, setSaveCountMap] = useState({})
  const [activeTab, setActiveTab] = useState('All')
  const [sort, setSort] = useState('newest')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: allDesigns }, { data: saves }] = await Promise.all([
        supabase.from('designs').select('*').eq('is_published', true),
        supabase.from('saved_designs').select('design_id'),
      ])

      const counts = {}
      saves?.forEach(s => { counts[s.design_id] = (counts[s.design_id] || 0) + 1 })

      setDesigns(allDesigns || [])
      setSaveCountMap(counts)
      setLoading(false)
    }
    load()
  }, [])

  // Filter + sort
  const filtered = designs
    .filter(TAB_FILTER[activeTab])
    .sort((a, b) => {
      if (sort === 'most_saved') {
        return (saveCountMap[b.id] || 0) - (saveCountMap[a.id] || 0)
      }
      return new Date(b.created_at) - new Date(a.created_at)
    })

  return (
    <div style={{ paddingBottom: '24px' }}>

      {/* Header */}
      <div style={{ padding: '24px 20px 0', marginBottom: '16px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Laque
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Nail & beauty design library
        </p>
      </div>

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
                href={`/design/${design.id}`}
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
