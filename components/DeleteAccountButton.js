'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function DeleteAccountButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)

  async function removeAccount() {
    if (pending.current || !confirm('Delete your account permanently? This cannot be undone.')) return
    pending.current = true
    setBusy(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Please sign in again before deleting your account.')
      const response = await fetch('/api/delete-account', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const result = await response.json()
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'Your account could not be deleted. Please try again.')
    } catch (failure) {
      setError(failure.message || 'Your account could not be deleted. Please try again or contact support.')
      pending.current = false
      setBusy(false)
      return
    }
    // Sign out only after the deletion has succeeded.
    try {
      const { error: signOutError } = await supabase.auth.signOut({ scope: 'local' })
      if (signOutError) throw signOutError
    } catch {
      setError('Your account was deleted. Please refresh to clear this session.')
    }
  }

  return <>
    <button onClick={removeAccount} disabled={busy}
      style={{ width: '100%', background: 'none', border: 'none', padding: '8px', color: '#8B3A3A', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
      {busy ? 'Deleting account…' : 'Delete account'}
    </button>
    {error && <p role="alert" style={{ color: '#8B3A3A', fontSize: '13px' }}>{error}</p>}
  </>
}
