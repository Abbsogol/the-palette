'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account!')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setSubmitting(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  if (loading) {
    return <div style={{ padding: '24px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
  }

  // Logged in view
  if (user) {
    return (
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Profile
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
          Your account
        </p>

        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '0.5px solid var(--border)', marginBottom: '16px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>
            Signed in as
          </p>
          <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>
            {user.email}
          </p>
        </div>

        <button
          onClick={handleLogout}
          style={{
            width: '100%',
            background: 'none',
            border: '0.5px solid var(--border)',
            borderRadius: '12px',
            padding: '14px',
            color: 'var(--text-secondary)',
            fontSize: '14px',
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Log out
        </button>
      </div>
    )
  }

  // Logged out view
  return (
    <div style={{ padding: '24px 20px' }}>
      <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
        {mode === 'login' ? 'Welcome back' : 'Create account'}
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
        {mode === 'login' ? 'Sign in to save your favourite designs' : 'Join to start saving designs'}
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          required
          style={{
            background: 'var(--bg-card)',
            border: '0.5px solid var(--border)',
            borderRadius: '12px',
            padding: '14px 16px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none',
          }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{
            background: 'var(--bg-card)',
            border: '0.5px solid var(--border)',
            borderRadius: '12px',
            padding: '14px 16px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontFamily: "'DM Sans', sans-serif",
            outline: 'none',
          }}
        />

        {error && (
          <p style={{ color: '#E07070', fontSize: '13px' }}>{error}</p>
        )}
        {message && (
          <p style={{ color: 'var(--accent)', fontSize: '13px' }}>{message}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          style={{
            background: 'var(--accent)',
            color: '#2C0A1E',
            border: 'none',
            borderRadius: '12px',
            padding: '14px',
            fontSize: '14px',
            fontFamily: "'DM Sans', sans-serif",
            fontWeight: '500',
            cursor: submitting ? 'default' : 'pointer',
            opacity: submitting ? 0.7 : 1,
            marginTop: '4px',
          }}
        >
          {submitting ? 'Loading...' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>

      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', marginTop: '24px' }}>
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', padding: 0 }}
        >
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </div>
  )
}
