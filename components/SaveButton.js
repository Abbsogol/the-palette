'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function SaveButton({ designId }) {
  const [user, setUser] = useState(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) {
        const { data } = await supabase
          .from('saved_designs')
          .select('id')
          .eq('user_id', session.user.id)
          .eq('design_id', designId)
          .single()
        setSaved(!!data)
      }
      setLoading(false)
    })
  }, [designId])

  const toggle = async () => {
    if (!user) {
      router.push('/profile')
      return
    }
    if (saved) {
      await supabase
        .from('saved_designs')
        .delete()
        .eq('user_id', user.id)
        .eq('design_id', designId)
      setSaved(false)
    } else {
      await supabase
        .from('saved_designs')
        .insert({ user_id: user.id, design_id: designId })
      setSaved(true)
    }
  }

  if (loading) return null

  return (
    <button
      onClick={toggle}
      title={saved ? 'Unsave' : 'Save'}
      style={{
        background: saved ? 'var(--accent)' : 'var(--bg-chip)',
        border: 'none',
        borderRadius: '50%',
        width: '44px',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
      }}
    >
      <svg width="20" height="20" viewBox="0 0 20 20" fill={saved ? '#2C0A1E' : 'none'}>
        <path
          d="M10 17s-7-4.5-7-9a4 4 0 0 1 7-2.65A4 4 0 0 1 17 8c0 4.5-7 9-7 9z"
          stroke={saved ? '#2C0A1E' : 'var(--text-secondary)'}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  )
}
