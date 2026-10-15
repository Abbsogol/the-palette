'use client'

import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAccountAction } from '@/lib/use-account-action'
import { refreshDeletedAccountSession } from '@/lib/refresh-deleted-account-session'

export default function DeleteAccountButton({ userId }) {
  const { run, busy } = useAccountAction(userId)
  const [deleted, setDeleted] = useState(false)
  const [error, setError] = useState('')
  const pending = useRef(false)

  async function removeAccount() {
    if (!userId || deleted || pending.current || !confirm('Delete your account permanently? This cannot be undone.')) return
    pending.current = true
    setError('')
    try {
      const result = await run(async session => {
      const response = await fetch('/api/delete-account', {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const result = await response.json()
      if (!response.ok || result.ok !== true) throw new Error(result.error || 'Your account could not be deleted. Please try again.')
      return result
      }, { verifyAfter: false })
      if (!result?.ok) { pending.current = false; return }
      setDeleted(true)
    } catch (failure) {
      setError(failure.message || 'Your account could not be deleted. Please try again or contact support.')
      pending.current = false
      return
    }
    // Let the SDK remove the invalid deleted-account session under its lock.
    // A different account selected during deletion must remain signed in.
    try {
      await refreshDeletedAccountSession(supabase.auth, userId)
    } catch {
      setError('Your account was deleted. Please refresh to clear this session.')
    }
  }

  return <>
    <button onClick={removeAccount} disabled={busy || deleted || !userId}
      style={{ width: '100%', background: 'none', border: 'none', padding: '8px', color: '#8B3A3A', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
      {deleted ? 'Account deleted' : busy ? 'Deleting account…' : 'Delete account'}
    </button>
    {error && <p role="alert" style={{ color: '#8B3A3A', fontSize: '13px' }}>{error}</p>}
  </>
}
