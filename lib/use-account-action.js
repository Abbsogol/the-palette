'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

// Bind a user action to the account that rendered it, including the interval
// before getSession resolves and callbacks after the account changes back.
export function useAccountAction(userId) {
  const scope = useRef({ active: false, version: 0, pending: false })
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    const state = scope.current
    state.active = true
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user?.id !== userId) state.version++
    })
    return () => { state.active = false; state.version++; subscription.unsubscribe() }
  }, [userId])

  const run = async (operation, { verifyAfter = true } = {}) => {
    const state = scope.current
    if (!userId || !state.active || state.pending) return null
    state.pending = true; setBusy(true)
    const version = state.version
    const current = () => state.active && state.version === version
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!current()) return null
      if (session?.user?.id !== userId) throw new Error('Your account changed. Reload this page before continuing.')
      const result = await operation(session)
      if (!current()) return null
      if (verifyAfter) {
        const { data: { session: latest } } = await supabase.auth.getSession()
        if (!current() || latest?.user?.id !== userId) return null
      }
      return result
    } catch (error) {
      if (current()) throw error
      return null
    } finally {
      // The hook may remain mounted briefly after an auth event. Release the
      // pending flag even when that event invalidated this operation.
      state.pending = false
      if (state.active) setBusy(false)
    }
  }
  return { run, busy }
}
