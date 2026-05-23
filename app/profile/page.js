'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
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
  const [savedCount, setSavedCount] = useState(0)
  const [displayName, setDisplayName] = useState('')
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user || null)
      if (session?.user) {
        setDisplayName(session.user.user_metadata?.display_name || '')
        fetchSavedCount(session.user.id)
      }
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
      if (session?.user) {
        setDisplayName(session.user.user_metadata?.display_name || '')
        fetchSavedCount(session.user.id)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const fetchSavedCount = async (userId) => {
    const { count } = await supabase
      .from('saved_designs')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
    setSavedCount(count || 0)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setSubmitting(true)
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) setError(error.message)
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setSubmitting(false)
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  const saveName = async () => {
    const { data, error } = await supabase.auth.updateUser({ data: { display_name: nameInput } })
    if (!error) {
      setDisplayName(nameInput)
      setEditingName(false)
    }
  }

  if (loading) {
    return <div style={{ padding: '24px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>
  }

  // Logged in view
  if (user) {
    return (
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Profile
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Your account</p>
        </div>

        {/* Display name */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', border: '0.5px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>
            Display name
          </p>
          {editingName ? (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                value={nameInput}
                onChange={e => setNameInput(e.target.value)}
                placeholder="Your name"
                autoFocus
                style={{
                  flex: 1,
                  background: 'var(--bg-chip)',
                  border: '0.5px solid var(--border)',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  color: 'var(--text-primary)',
                  fontSize: '14px',
                  fontFamily: "'DM Sans', sans-serif",
                  outline: 'none',
                }}
              />
              <button onClick={saveName} style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
                Save
              </button>
              <button onClick={() => setEditingName(false)} style={{ background: 'none', color: 'var(--text-secondary)', border: 'none', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
                Cancel
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ color: displayName ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>
                {displayName || 'Not set'}
              </p>
              <button
                onClick={() => { setNameInput(displayName); setEditingName(true) }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}
              >
                Edit
              </button>
            </div>
          )}
        </div>

        {/* Account info + saved count */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
          <div style={{ padding: '16px', borderBottom: '0.5px solid var(--border)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
              Email
            </p>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{user.email}</p>
          </div>
          <Link href="/saved" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', textDecoration: 'none' }}>
            <div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
                Saved designs
              </p>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>{savedCount}</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4L10 8L6 12" stroke="#888888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>

        {/* Settings — coming soon */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '16px 16px 8px' }}>
            Settings
          </p>
          {['Dark / light mode', 'Change password', 'Notification preferences'].map((item, i, arr) => (
            <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: i === 0 ? 'none' : '0.5px solid var(--border)' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{item}</p>
              <span style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: '500', padding: '3px 8px', borderRadius: '20px', letterSpacing: '0.04em' }}>
                Soon
              </span>
            </div>
          ))}
        </div>

        {/* About */}
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', border: '0.5px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
            About
          </p>
          <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>The Palette</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>
            A curated library of nail and beauty designs — each with full specs, colour codes, and technique details.
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '10px' }}>Version 0.1 · Beta</p>
        </div>

        {/* Log out */}
        <button
          onClick={handleLogout}
          style={{ width: '100%', background: 'none', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-secondary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: 'pointer' }}
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
          style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          required
          style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
        />
        {error && <p style={{ color: '#E07070', fontSize: '13px' }}>{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: submitting ? 'default' : 'pointer', opacity: submitting ? 0.7 : 1, marginTop: '4px' }}
        >
          {submitting ? 'Loading...' : mode === 'login' ? 'Log in' : 'Sign up'}
        </button>
      </form>

      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', marginTop: '24px' }}>
        {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
        <button
          onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
          style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', padding: 0 }}
        >
          {mode === 'login' ? 'Sign up' : 'Log in'}
        </button>
      </p>
    </div>
  )
}
