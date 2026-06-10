'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function CollectionPage() {
  const { id } = useParams()
  const [collection, setCollection] = useState(null)
  const [designs, setDesigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const [{ data: col }, { data: items }] = await Promise.all([
        supabase.from('collections').select('*').eq('id', id).single(),
        supabase.from('collection_designs').select('design_id, designs(*)').eq('collection_id', id).order('added_at', { ascending: false }),
      ])
      setCollection(col)
      setDesigns(items?.map(i => i.designs).filter(Boolean) || [])
      setLoading(false)
    }
    load()
  }, [id])

  const removeDesign = async (designId) => {
    await supabase.from('collection_designs').delete().eq('collection_id', id).eq('design_id', designId)
    setDesigns(prev => prev.filter(d => d.id !== designId))
  }

  if (loading) return <div style={{ padding: '24px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
  if (!collection) return <div style={{ padding: '24px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>Board not found.</div>

  return (
    <div style={{ padding: '16px 20px 32px' }}>
      {/* Back */}
      <Link href="/saved" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: '500', marginBottom: '20px' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Saved
      </Link>

      <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>{collection.name}</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>{designs.length} design{designs.length !== 1 ? 's' : ''}</p>

      {designs.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '32px 20px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No designs in this board yet</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px' }}>Tap the + on saved designs to add them here</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {designs.map(design => (
            <div key={design.id} style={{ position: 'relative' }}>
              <Link href={`/design/${design.id}`} style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden', textDecoration: 'none', display: 'block' }}>
                {design.image_url ? (
                  <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                    <img src={design.image_url} alt={design.title} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-chip)' }} />
                )}
                <div style={{ padding: '8px 10px 10px' }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>{design.title}</p>
                </div>
              </Link>
              {/* Remove button */}
              <button
                onClick={() => removeDesign(design.id)}
                title="Remove from board"
                style={{
                  position: 'absolute', top: '6px', right: '6px',
                  background: 'rgba(20,20,20,0.8)', border: 'none',
                  borderRadius: '20px', width: '26px', height: '26px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '14px',
                }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
