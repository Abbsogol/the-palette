'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import { CardHeartIcon } from './icons'

// Heart = favourite an artist/salon (favourite_creators table). Distinct
// from HeartSaveButton (designs -> saved_designs): no counters, no rewards,
// just membership. `initiallyFavourited` comes from the page's batched query.
export default function FavouriteButton({ creatorId, currentUser = null, initiallyFavourited = false, size = 28 }) {
  const [favourited, setFavourited] = useState(initiallyFavourited)
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
    try {
      if (!favourited) {
        const { error } = await supabase.from('favourite_creators').insert({ user_id: currentUser.id, creator_id: creatorId })
        if (error) { alert('Failed to favourite. Please try again.'); return }
        setFavourited(true)
      } else {
        const { error } = await supabase.from('favourite_creators').delete().eq('user_id', currentUser.id).eq('creator_id', creatorId)
        if (error) { alert('Failed to unfavourite. Please try again.'); return }
        setFavourited(false)
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
      aria-label={favourited ? 'Remove from favourites' : 'Add to favourites'}
      aria-pressed={favourited}
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
        background: favourited ? 'var(--lq-accent-grad)' : 'var(--lq-glass)',
        border: favourited ? '1px solid transparent' : '1px solid var(--lq-glass-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--lq-white)',
        backdropFilter: 'blur(4px)',
      }}>
        <CardHeartIcon size={14} filled={favourited} />
      </span>
    </button>
  )
}
