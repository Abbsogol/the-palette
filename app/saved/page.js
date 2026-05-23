'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function SavedPage() {
  const [user, setUser] = useState(null)
  const [designs, setDesigns] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) fetchSaved(session.user.id)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session?.user) fetchSaved(session.user.id)
      else { setDesigns([]); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchSaved = async (userId) => {
    setLoading(true)
    const { data } = await supabase
      .from('saved_designs')
      .select('design_id, designs(*)')
      .eq('user_id', userId)
      .order('saved_at', { ascending: false })
    setDesigns(data?.map(d => d.designs).filter(Boolean) || [])
    setLoading(false)
  }

  if (loading) {
    return <div style={{ padding: '24px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
  }

  // Not logged in
  if (!user) {
    return (
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Saved
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
          Your saved designs
        </p>
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '32px 20px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>
            Save your favourites
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
            Sign in to save designs and access them anytime
          </p>
          <Link href="/profile" style={{
            display: 'inline-block',
            background: 'var(--accent)',
            color: '#2C0A1E',
            borderRadius: '10px',
            padding: '10px 24px',
            fontSize: '13px',
            fontWeight: '500',
            textDecoration: 'none',
          }}>
            Sign in
          </Link>
        </div>
      </div>
    )
  }

  // Logged in — show saved designs
  return (
    <div style={{ padding: '24px 20px 0' }}>
      <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
        Saved
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px' }}>
        Your saved designs
      </p>

      {designs.length === 0 ? (
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '32px 20px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>
            Nothing saved yet
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '20px' }}>
            Tap the heart on any design to save it here
          </p>
          <Link href="/" style={{
            display: 'inline-block',
            background: 'var(--accent)',
            color: '#2C0A1E',
            borderRadius: '10px',
            padding: '10px 24px',
            fontSize: '13px',
            fontWeight: '500',
            textDecoration: 'none',
          }}>
            Browse designs
          </Link>
        </div>
      ) : (
        <>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>
            {designs.length} saved
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
                  <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-chip)' }} />
                )}
                <div style={{ padding: '10px 12px 12px' }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>{design.title}</p>
                  <p style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                    {design.shape} · {design.occasion}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
