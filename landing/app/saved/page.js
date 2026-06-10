'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SavedPage() {
  const [user, setUser] = useState(null)
  const [designs, setDesigns] = useState([])
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal state
  const [modalDesign, setModalDesign] = useState(null) // design being added to a collection
  const [newColName, setNewColName] = useState('')
  const [creatingCol, setCreatingCol] = useState(false)
  const [addingTo, setAddingTo] = useState(null) // collection id being added to

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) loadAll(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session?.user) loadAll(session.user.id)
      else { setDesigns([]); setCollections([]); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadAll = async (userId) => {
    setLoading(true)
    const [{ data: saved }, { data: cols }] = await Promise.all([
      supabase.from('saved_designs').select('design_id, designs(*)').eq('user_id', userId).order('saved_at', { ascending: false }),
      supabase.from('collections').select('*, collection_designs(design_id, designs(image_url))').eq('user_id', userId).order('created_at', { ascending: false }),
    ])
    setDesigns(saved?.map(d => d.designs).filter(Boolean) || [])
    setCollections(cols || [])
    setLoading(false)
  }

  const createCollection = async () => {
    if (!newColName.trim() || !user) return
    setCreatingCol(true)
    const { data } = await supabase.from('collections').insert({ user_id: user.id, name: newColName.trim() }).select().single()
    if (data) {
      if (modalDesign) {
        await supabase.from('collection_designs').insert({ collection_id: data.id, design_id: modalDesign.id })
      }
      await loadAll(user.id)
      setNewColName('')
      setModalDesign(null)
    }
    setCreatingCol(false)
  }

  const addToCollection = async (collectionId, designId) => {
    setAddingTo(collectionId)
    await supabase.from('collection_designs').upsert({ collection_id: collectionId, design_id: designId })
    await loadAll(user.id)
    setAddingTo(null)
    setModalDesign(null)
  }

  const deleteCollection = async (colId, e) => {
    e.preventDefault()
    e.stopPropagation()
    if (!confirm('Delete this collection? Designs won\'t be removed from your saves.')) return
    await supabase.from('collections').delete().eq('id', colId)
    setCollections(prev => prev.filter(c => c.id !== colId))
  }

  if (loading) return <div style={{ padding: '24px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>

  if (!user) {
    return (
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>Saved</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Your saved designs</p>
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '32px 20px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Save your favourites</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>Sign in to save designs and access them anytime</p>
          <Link href="/profile" style={{ display: 'inline-block', background: 'var(--accent)', color: '#2C0A1E', borderRadius: '10px', padding: '10px 24px', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  // Cover image for a collection = first design's image
  const getCover = (col) => col.collection_designs?.[0]?.designs?.image_url || null

  return (
    <div style={{ padding: '24px 20px 32px' }}>
      <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>Saved</h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>Your designs & boards</p>

      {/* ── Collections ── */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <p style={sectionLabel}>Boards</p>
          <button
            onClick={() => setModalDesign('new')}
            style={{ background: 'var(--bg-chip)', border: '0.5px solid var(--border)', borderRadius: '20px', padding: '5px 14px', color: 'var(--text-secondary)', fontSize: '12px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}
          >
            + New board
          </button>
        </div>

        {collections.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '24px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No boards yet — create one to organise your saves</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {collections.map(col => (
              <Link key={col.id} href={`/collection/${col.id}`} style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden', textDecoration: 'none', display: 'block', position: 'relative' }}>
                <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-chip)', overflow: 'hidden' }}>
                  {getCover(col) ? (
                    <img src={getCover(col)} alt={col.name} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><path d="M3 6C3 4.9 3.9 4 5 4H9L11 6H19C20.1 6 21 6.9 21 8V18C21 19.1 20.1 20 19 20H5C3.9 20 3 19.1 3 18V6Z" stroke="#444" strokeWidth="1.5"/></svg>
                    </div>
                  )}
                </div>
                <div style={{ padding: '8px 10px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>{col.name}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>{col.collection_designs?.length || 0} designs</p>
                  </div>
                  <button onClick={(e) => deleteCollection(col.id, e)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '16px', cursor: 'pointer', padding: '4px', opacity: 0.5 }}>×</button>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* ── All saved ── */}
      <div>
        <p style={{ ...sectionLabel, marginBottom: '12px' }}>All saved · {designs.length}</p>
        {designs.length === 0 ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '32px 20px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Nothing saved yet</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>Tap the heart on any design to save it here</p>
            <Link href="/" style={{ display: 'inline-block', background: 'var(--accent)', color: '#2C0A1E', borderRadius: '10px', padding: '10px 24px', fontSize: '13px', fontWeight: '500', textDecoration: 'none' }}>Browse designs</Link>
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
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', marginBottom: '2px' }}>{design.title}</p>
                  </div>
                </Link>
                {/* Add to board button */}
                <button
                  onClick={() => { setModalDesign(design); setNewColName('') }}
                  title="Add to board"
                  style={{
                    position: 'absolute', bottom: '38px', right: '8px',
                    background: 'var(--bg-chip)', border: '0.5px solid var(--border)',
                    borderRadius: '20px', width: '28px', height: '28px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: 'var(--text-secondary)',
                  }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add to board modal ── */}
      {modalDesign && (
        <div
          onClick={() => setModalDesign(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 100, display: 'flex', alignItems: 'flex-end' }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', maxHeight: '70vh', overflowY: 'auto' }}
          >
            <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '2px', margin: '0 auto 20px' }} />
            <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '500', marginBottom: '16px' }}>
              {modalDesign === 'new' ? 'New board' : 'Add to board'}
            </p>

            {/* Existing collections */}
            {modalDesign !== 'new' && collections.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                {collections.map(col => (
                  <button
                    key={col.id}
                    onClick={() => addToCollection(col.id, modalDesign.id)}
                    disabled={addingTo === col.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      background: 'var(--bg-chip)', border: '0.5px solid var(--border)',
                      borderRadius: '12px', padding: '12px 16px',
                      color: 'var(--text-primary)', fontSize: '14px',
                      fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', textAlign: 'left',
                    }}
                  >
                    <span>{col.name}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{col.collection_designs?.length || 0} designs</span>
                  </button>
                ))}
              </div>
            )}

            {/* Create new collection */}
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '8px' }}>
              {(modalDesign !== 'new' && collections.length > 0) ? 'Or create new' : 'Board name'}
            </p>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                placeholder="e.g. Wedding inspo, Dark vibes..."
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createCollection()}
                autoFocus
                style={{ flex: 1, background: 'var(--bg-chip)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '12px 14px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
              />
              <button
                onClick={createCollection}
                disabled={!newColName.trim() || creatingCol}
                style={{ background: newColName.trim() ? 'var(--accent)' : 'var(--bg-chip)', color: newColName.trim() ? '#2C0A1E' : 'var(--text-secondary)', border: 'none', borderRadius: '10px', padding: '12px 18px', fontSize: '14px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif", cursor: newColName.trim() ? 'pointer' : 'default' }}
              >
                {creatingCol ? '...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const sectionLabel = {
  color: 'var(--accent)',
  fontSize: '11px',
  fontWeight: '500',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}
