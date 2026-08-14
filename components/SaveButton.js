'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SaveButton({ designId }) {
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user || null
      setUser(u)
      if (u) {
        supabase
          .from('saved_designs')
          .select('design_id')
          .eq('user_id', u.id)
          .eq('design_id', designId)
          .maybeSingle()
          .then(({ data }) => {
            setSaved(!!data)
            setLoading(false)
          })
      } else {
        setLoading(false)
      }
    })
  }, [designId])

  async function toggle(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!user) {
      window.location.href = '/profile'
      return
    }
    if (saving) return
    setSaving(true)
    const next = !saved

    try {
      if (next) {
        const { error } = await supabase.from('saved_designs').insert({ user_id: user.id, design_id: designId })
        if (error) { alert('Failed to save. Please try again.'); return }
        setSaved(true)
        await supabase.rpc('increment_saves', { design_id: designId })
        const { data: { session } } = await supabase.auth.getSession()
        fetch('/api/add-reward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: JSON.stringify({ reason: 'save_design', ref_id: designId }),
        })
      } else {
        const { error } = await supabase.from('saved_designs').delete().eq('user_id', user.id).eq('design_id', designId)
        if (error) { alert('Failed to unsave. Please try again.'); return }
        setSaved(false)
        await supabase.rpc('decrement_saves', { design_id: designId })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={loading || saving}
      title={saved ? 'Unsave' : 'Save'}
      style={{
        background: saved ? 'rgba(212,160,192,0.15)' : 'var(--bg-chip)',
        border: 'none',
        borderRadius: '10px',
        width: '38px',
        height: '38px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: (loading || saving) ? 'default' : 'pointer',
        color: saved ? 'var(--accent)' : 'var(--text-secondary)',
        flexShrink: 0,
        transition: 'background 0.2s, color 0.2s',
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24"
        fill={saved ? 'currentColor' : 'none'}
        stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round"
      >
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
      </svg>
    </button>
  )
}
