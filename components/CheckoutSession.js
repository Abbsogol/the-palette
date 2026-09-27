'use client'

import { Fragment, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

// Financial outcomes belong to the authenticated account as well as the URL.
// Remount the result when identity changes so old state and pending requests
// cannot enter the next account's result page.
export default function CheckoutSession({ children }) {
  const [user, setUser] = useState(undefined)
  useEffect(() => {
    let active = true, changed = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      changed = true
      if (active) setUser(session?.user || null)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && !changed) setUser(session?.user || null)
    }).catch(() => { if (active && !changed) setUser(null) })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  if (user === undefined) return <p>Checking your session…</p>
  if (!user) return (
    <div style={{ padding: '40px 24px', textAlign: 'center' }}>
      <h1>Sign in to view your checkout</h1>
      <p>Your payment details are available only to the account that started checkout.</p>
      <Link href="/profile">Sign in</Link>
    </div>
  )
  return <Fragment key={user.id}>{children(user.id)}</Fragment>
}
