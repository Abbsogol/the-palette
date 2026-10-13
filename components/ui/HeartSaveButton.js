'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CardHeartIcon } from './icons'

// Heart = save (the redesign's single save action on designs).
// Writes saved_designs + the saves_count RPCs + the loyalty reward hook,
// same flow as components/SaveButton.js. `initiallySaved` comes from the
// page's batched saved-ids query so cards don't each hit the DB.
export default function HeartSaveButton({ designId, initiallySaved = false, currentUser = null, size = 28, onToggle }) {
  const [saved, setSaved] = useState(initiallySaved)
  const [saving, setSaving] = useState(false)

  async function toggle(e) {
    e.preventDefault()
    e.stopPropagation()
    if (!currentUser) {
      window.location.href = '/profile'
      return
    }
    if (saving) return
    setSaving(true)
    const next = !saved

    try {
      if (next) {
        const { error } = await supabase.from('saved_designs').insert({ user_id: currentUser.id, design_id: designId })
        if (error) { alert('Failed to save. Please try again.'); return }
        setSaved(true)
        onToggle?.(true)
        await supabase.rpc('increment_saves', { design_id: designId })
        const { data: { session } } = await supabase.auth.getSession()
        fetch('/api/add-reward', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
          body: JSON.stringify({ reason: 'save_design', ref_id: designId }),
        })
      } else {
        const { error } = await supabase.from('saved_designs').delete().eq('user_id', currentUser.id).eq('design_id', designId)
        if (error) { alert('Failed to unsave. Please try again.'); return }
        setSaved(false)
        onToggle?.(false)
        await supabase.rpc('decrement_saves', { design_id: designId })
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={saving}
      aria-label={saved ? 'Remove from saved' : 'Save design'}
      aria-pressed={saved}
      style={{
        width: '44px',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        padding: 0,
        cursor: saving ? 'default' : 'pointer',
      }}
    >
      <span style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: 'var(--lq-radius-pill)',
        background: saved ? 'var(--lq-accent-grad)' : 'var(--lq-glass)',
        border: saved ? '1px solid transparent' : '1px solid var(--lq-glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--lq-white)',
        backdropFilter: 'blur(4px)',
      }}>
        <CardHeartIcon size={14} filled={saved} />
      </span>
    </button>
  )
}
