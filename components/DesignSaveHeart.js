'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

// The frame's save affordance: a ♥-count badge on the carousel image.
// Save wiring byte-identical to SaveButton (saved_designs + saves RPCs +
// reward hook); adds the live count with optimistic update.
export default function DesignSaveHeart({ designId, savesCount = 0 }) {
  const [saved, setSaved] = useState(false)
  const [count, setCount] = useState(savesCount || 0)
  const [saving, setSaving] = useState(false)
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const u = session?.user || null
      setUser(u)
      if (u) {
        supabase.from('saved_designs').select('design_id')
          .eq('user_id', u.id).eq('design_id', designId).maybeSingle()
          .then(({ data }) => setSaved(!!data))
      }
    })
  }, [designId])

  const toggle = async () => {
    if (!user) { window.location.href = '/profile'; return }
    if (saving) return
    setSaving(true)
    const next = !saved
    try {
      if (next) {
        const { error } = await supabase.from('saved_designs').insert({ user_id: user.id, design_id: designId })
        if (error) { alert('Failed to save. Please try again.'); return }
        setSaved(true); setCount(c => c + 1)
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
        setSaved(false); setCount(c => Math.max(0, c - 1))
        await supabase.rpc('decrement_saves', { design_id: designId })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      onClick={toggle}
      disabled={saving}
      aria-label={saved ? 'Remove from saved' : 'Save design'}
      aria-pressed={saved}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        minHeight: '40px', padding: '8px 14px', borderRadius: '1000px',
        background: 'rgba(32,5,11,0.55)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.18)', cursor: saving ? 'default' : 'pointer',
        fontFamily: 'var(--lq-font-ui)', fontWeight: 500, fontSize: '13px',
        color: 'var(--lq-white)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24"
        fill={saved ? '#FF517F' : 'none'} stroke={saved ? '#FF517F' : 'var(--lq-white)'}
        strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
      </svg>
      {count > 0 && <span>{count}</span>}
    </button>
  )
}
