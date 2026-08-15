'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const CATEGORIES = ['All', 'Polishes & Gels', 'Tools & Kits', 'Beauty']

export default function ShopPage() {
  const [products, setProducts] = useState([])
  const [activeCategory, setActiveCategory] = useState('All')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('is_published', true)
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false })
        .limit(200)
      if (error) console.error('products fetch failed:', error)
      setProducts(data || [])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = activeCategory === 'All'
    ? products
    : products.filter(p => p.category === activeCategory)

  return (
    <div style={{ paddingBottom: '24px' }}>

      {/* Header */}
      <div style={{ padding: '24px 20px 0', marginBottom: '16px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Shop
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Products we love
        </p>
      </div>

      {/* Affiliate disclosure */}
      <div style={{ margin: '0 20px 16px', padding: '10px 14px', background: 'var(--bg-chip)', borderRadius: '10px', border: '0.5px solid var(--border)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', lineHeight: '1.5' }}>
          As an Amazon Associate, Laque earns from qualifying purchases. Links may earn us a small commission at no extra cost to you.
        </p>
      </div>

      {/* Category tabs */}
      <div style={{
        display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 20px 16px',
        scrollbarWidth: 'none', msOverflowStyle: 'none',
      }}>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            style={{
              flexShrink: 0,
              background: activeCategory === cat ? 'var(--accent)' : 'var(--bg-card)',
              color: activeCategory === cat ? '#2C0A1E' : 'var(--text-secondary)',
              border: activeCategory === cat ? 'none' : '0.5px solid var(--border)',
              borderRadius: '20px',
              padding: '7px 16px',
              fontSize: '13px',
              fontWeight: activeCategory === cat ? '600' : '400',
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid */}
      <div style={{ padding: '0 20px' }}>
        {loading ? (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', textAlign: 'center', padding: '48px 0' }}>Loading...</p>
        ) : filtered.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {filtered.map(product => (
              <a
                key={product.id}
                href={product.affiliate_url}
                target="_blank"
                rel="noopener noreferrer sponsored"
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '12px',
                  border: '0.5px solid var(--border)',
                  overflow: 'hidden',
                  textDecoration: 'none',
                  display: 'block',
                }}
              >
                {product.image_url ? (
                  <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', background: 'var(--bg-chip)' }}>
                    <img
                      src={product.image_url}
                      alt={product.name}
                      loading="lazy"
                      decoding="async"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    />
                  </div>
                ) : (
                  <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-chip)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                      <line x1="3" y1="6" x2="21" y2="6"/>
                      <path d="M16 10a4 4 0 01-8 0"/>
                    </svg>
                  </div>
                )}
                <div style={{ padding: '10px 12px 12px' }}>
                  {product.is_featured && (
                    <p style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '600', letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '3px' }}>
                      ★ Featured
                    </p>
                  )}
                  <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', marginBottom: '3px', lineHeight: '1.3' }}>
                    {product.name}
                  </p>
                  {product.brand && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginBottom: '6px' }}>
                      {product.brand}
                    </p>
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                    {product.price_label ? (
                      <p style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '600' }}>
                        {product.price_label}
                      </p>
                    ) : <span />}
                    <span style={{
                      background: 'var(--bg-chip)',
                      color: 'var(--text-secondary)',
                      fontSize: '10px',
                      fontWeight: '500',
                      padding: '4px 8px',
                      borderRadius: '8px',
                      whiteSpace: 'nowrap',
                    }}>
                      Shop ↗
                    </span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 0' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No products here yet</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>More coming soon</p>
          </div>
        )}
      </div>

    </div>
  )
}
