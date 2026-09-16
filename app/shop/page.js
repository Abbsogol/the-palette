'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'

const ACCENT = '#FF517F'
const WINE = '#260D14'
const WHITE60 = 'rgba(255,255,255,0.6)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

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
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 4px' }}>
          <BackButton fallback="/feed" />
          <div>
            <h1 style={{ ...display(24), margin: 0 }}>Shop</h1>
          </div>
        </div>
        <p style={{ ...ui(300, 14, WHITE60), padding: '0 20px 16px', margin: 0 }}>Products we love</p>

        {/* Affiliate disclosure */}
        <div style={{ margin: '0 20px 16px', padding: '10px 14px', background: PANEL, borderRadius: '12px', border: PANEL_BORDER }}>
          <p style={{ ...ui(300, 11, WHITE60), lineHeight: 1.5 }}>
            As an Amazon Associate, Laque earns from qualifying purchases. Links may earn us a small commission at no extra cost to you.
          </p>
        </div>

        {/* Category tabs */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '0 20px 16px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                flexShrink: 0,
                background: activeCategory === cat ? ACCENT : 'rgba(255,255,255,0.06)',
                ...ui(activeCategory === cat ? 600 : 400, 13, activeCategory === cat ? WINE : WHITE60),
                border: activeCategory === cat ? 'none' : PANEL_BORDER,
                borderRadius: '1000px', padding: '7px 16px', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Grid */}
        <div style={{ padding: '0 20px' }}>
          {loading ? (
            <p style={{ ...ui(300, 14, WHITE60), textAlign: 'center', padding: '48px 0' }}>Loading…</p>
          ) : filtered.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {filtered.map(product => (
                <a
                  key={product.id}
                  href={product.affiliate_url}
                  target="_blank"
                  rel="noopener noreferrer sponsored"
                  style={{ background: PANEL, borderRadius: '14px', border: PANEL_BORDER, overflow: 'hidden', textDecoration: 'none', display: 'block' }}
                >
                  {product.image_url ? (
                    <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                      <img
                        src={product.image_url}
                        alt={product.name}
                        loading="lazy"
                        decoding="async"
                        style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                      />
                    </div>
                  ) : (
                    <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke={WHITE60} strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
                        <line x1="3" y1="6" x2="21" y2="6"/>
                        <path d="M16 10a4 4 0 01-8 0"/>
                      </svg>
                    </div>
                  )}
                  <div style={{ padding: '10px 12px 12px' }}>
                    {product.is_featured && (
                      <p style={{ ...ui(600, 10, ACCENT), letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: '3px' }}>
                        ★ Featured
                      </p>
                    )}
                    <p style={{ ...ui(500, 13), marginBottom: '3px', lineHeight: 1.3 }}>
                      {product.name}
                    </p>
                    {product.brand && (
                      <p style={{ ...ui(300, 11, WHITE60), marginBottom: '6px' }}>
                        {product.brand}
                      </p>
                    )}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                      {product.price_label ? (
                        <p style={ui(600, 13, ACCENT)}>{product.price_label}</p>
                      ) : <span />}
                      <span style={{ background: 'rgba(255,255,255,0.06)', ...ui(500, 10, WHITE60), padding: '4px 8px', borderRadius: '8px', whiteSpace: 'nowrap' }}>
                        Shop ↗
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '48px 0' }}>
              <p style={ui(400, 14, WHITE60)}>No products here yet</p>
              <p style={{ ...ui(300, 13, WHITE60), marginTop: '6px' }}>More coming soon</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
