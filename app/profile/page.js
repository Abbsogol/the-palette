'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function ProfilePage() {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Auth form state
  const [mode, setMode] = useState('login') // login | signup | choose-type | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [chosenType, setChosenType] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)

  // Profile edit state
  const [savedCount, setSavedCount] = useState(0)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [editingBio, setEditingBio] = useState(false)
  const [bioInput, setBioInput] = useState('')
  const [editingLocation, setEditingLocation] = useState(false)
  const [locationInput, setLocationInput] = useState('')
  const [myDesigns, setMyDesigns] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadUserData(session.user)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) loadUserData(session.user)
      else { setUser(null); setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadUserData = async (u) => {
    setUser(u)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    setProfile(prof)
    const { count } = await supabase.from('saved_designs').select('*', { count: 'exact', head: true }).eq('user_id', u.id)
    setSavedCount(count || 0)
    if (prof?.account_type === 'creator' || prof?.account_type === 'salon') {
      const { data: designs } = await supabase.from('designs').select('*').eq('created_by', u.id).order('created_at', { ascending: false })
      setMyDesigns(designs || [])
    }
    setLoading(false)
  }

  // Step 1: validate email + password + display name, then move to account type selection
  const handleSignUpStep1 = async (e) => {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (!displayName.trim()) { setError('Please enter a display name'); return }
    setError('')
    setMode('choose-type')
  }

  // Step 2: create account with chosen type + save display name
  const handleCreateAccount = async () => {
    if (!chosenType) return
    setSubmitting(true)
    setError('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setSubmitting(false); return }
    if (data.user) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        account_type: chosenType,
        display_name: displayName.trim(),
      })
    }
    setSubmitting(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setSubmitting(false)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://the-palette-one.vercel.app/profile',
    })
    if (error) { setError(error.message) }
    else { setForgotSent(true) }
    setSubmitting(false)
  }

  const handleLogout = async () => { await supabase.auth.signOut() }

  const saveField = async (field, value, setter) => {
    await supabase.from('profiles').update({ [field]: value }).eq('id', user.id)
    setProfile(prev => ({ ...prev, [field]: value }))
    setter(false)
  }

  if (loading) return <div style={{ padding: '24px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>

  // ─── FORGOT PASSWORD ───
  if (!user && mode === 'forgot') {
    return (
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Reset password
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
          We'll send a reset link to your email
        </p>
        {forgotSent ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Check your email</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>We sent a password reset link to {email}</p>
            <button onClick={() => { setMode('login'); setForgotSent(false) }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
              Back to login
            </button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }} />
            {error && <p style={{ color: '#E07070', fontSize: '13px' }}>{error}</p>}
            <button type="submit" disabled={submitting}
              style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: 'pointer', marginTop: '4px' }}>
              {submitting ? 'Sending...' : 'Send reset link'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setError('') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
              ← Back to login
            </button>
          </form>
        )}
      </div>
    )
  }

  // ─── CHOOSE ACCOUNT TYPE ───
  if (!user && mode === 'choose-type') {
    return (
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>I am a...</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>Choose how you'll use The Palette</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {[
            { type: 'user', label: 'Design lover', desc: 'Browse, save, and discover nail designs' },
            { type: 'creator', label: 'Nail artist', desc: 'Publish your work and build your portfolio' },
            { type: 'salon', label: 'Salon', desc: "Showcase your salon's designs and services" },
          ].map(({ type, label, desc }) => (
            <button
              key={type}
              onClick={() => setChosenType(type)}
              style={{
                background: chosenType === type ? 'var(--accent)' : 'var(--bg-card)',
                border: chosenType === type ? 'none' : '0.5px solid var(--border)',
                borderRadius: '12px', padding: '16px', textAlign: 'left',
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              }}
            >
              <p style={{ color: chosenType === type ? '#2C0A1E' : 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>{label}</p>
              <p style={{ color: chosenType === type ? '#2C0A1E' : 'var(--text-secondary)', fontSize: '13px' }}>{desc}</p>
            </button>
          ))}
        </div>

        {error && <p style={{ color: '#E07070', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

        <button
          onClick={handleCreateAccount}
          disabled={!chosenType || submitting}
          style={{ width: '100%', background: chosenType ? 'var(--accent)' : 'var(--bg-chip)', color: chosenType ? '#2C0A1E' : 'var(--text-secondary)', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: chosenType ? 'pointer' : 'default' }}
        >
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
        <button onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', display: 'block', margin: '12px auto 0' }}>← Back</button>
      </div>
    )
  }

  // ─── LOGIN / SIGNUP FORM ───
  if (!user) {
    return (
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          {mode === 'login' ? 'Welcome back' : 'Create account'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
          {mode === 'login' ? 'Sign in to save your favourite designs' : 'Join to start saving designs'}
        </p>
        <form onSubmit={mode === 'login' ? handleLogin : handleSignUpStep1} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {mode === 'signup' && (
            <input type="text" placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} required
              style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }} />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required
            style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required
            style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }} />
          {error && <p style={{ color: '#E07070', fontSize: '13px' }}>{error}</p>}
          <button type="submit" disabled={submitting}
            style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: 'pointer', marginTop: '4px' }}>
            {submitting ? 'Loading...' : mode === 'login' ? 'Log in' : 'Continue →'}
          </button>
        </form>

        {mode === 'login' && (
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <button onClick={() => { setMode('forgot'); setError('') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', padding: 0 }}>
              Forgot password?
            </button>
          </div>
        )}

        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', marginTop: '16px' }}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', padding: 0 }}>
            {mode === 'login' ? 'Sign up' : 'Log in'}
          </button>
        </p>
      </div>
    )
  }

  const isCreator = profile?.account_type === 'creator' || profile?.account_type === 'salon'

  // ─── LOGGED IN: Creator / Salon Dashboard ───
  if (isCreator) {
    return (
      <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div>
          <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>
            {profile.account_type === 'salon' ? 'Salon' : 'Nail Artist'} · Creator
          </p>
          <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em' }}>
            {profile.display_name || 'Your Dashboard'}
          </h1>
        </div>

        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
          {[
            { label: 'Display name', field: 'display_name', value: profile.display_name, editing: editingName, setEditing: setEditingName, input: nameInput, setInput: setNameInput },
            { label: 'Bio', field: 'bio', value: profile.bio, editing: editingBio, setEditing: setEditingBio, input: bioInput, setInput: setBioInput },
            { label: 'Location', field: 'location', value: profile.location, editing: editingLocation, setEditing: setEditingLocation, input: locationInput, setInput: setLocationInput },
          ].map(({ label, field, value, editing, setEditing, input, setInput }, i) => (
            <div key={field} style={{ padding: '14px 16px', borderTop: i === 0 ? 'none' : '0.5px solid var(--border)' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</p>
              {editing ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input value={input} onChange={e => setInput(e.target.value)} autoFocus
                    style={{ flex: 1, background: 'var(--bg-chip)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }} />
                  <button onClick={() => saveField(field, input, setEditing)}
                    style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditing(false)} style={{ background: 'none', color: 'var(--text-secondary)', border: 'none', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p style={{ color: value ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '14px' }}>{value || 'Not set'}</p>
                  <button onClick={() => { setInput(value || ''); setEditing(true) }}
                    style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>Edit</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '28px', fontWeight: '500' }}>{myDesigns.length}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Published</p>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '28px', fontWeight: '500' }}>{savedCount}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Saved designs</p>
          </div>
        </div>

        <Link href={`/creator/${user.id}`}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', border: '0.5px solid var(--border)', textDecoration: 'none' }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', marginBottom: '2px' }}>View public profile</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>See how others see your page</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4L10 8L6 12" stroke="#888888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>

        <div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>My Designs</p>
          {myDesigns.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '24px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '4px' }}>No designs published yet</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Design upload coming in the next update</p>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {myDesigns.map(design => (
                <Link key={design.id} href={`/design/${design.id}`}
                  style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden', textDecoration: 'none', display: 'block' }}>
                  {design.image_url ? (
                    <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                      <img src={design.image_url} alt={design.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ) : <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-chip)' }} />}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500' }}>{design.title}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <button onClick={handleLogout}
          style={{ width: '100%', background: 'none', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-secondary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: 'pointer' }}>
          Log out
        </button>
      </div>
    )
  }

  // ─── LOGGED IN: Regular user profile ───
  return (
    <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>Profile</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Your account</p>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Display name</p>
          {editingName ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={nameInput} onChange={e => setNameInput(e.target.value)} autoFocus
                style={{ flex: 1, background: 'var(--bg-chip)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }} />
              <button onClick={() => saveField('display_name', nameInput, setEditingName)}
                style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditingName(false)} style={{ background: 'none', color: 'var(--text-secondary)', border: 'none', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <p style={{ color: profile?.display_name ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '14px', fontWeight: '500' }}>{profile?.display_name || 'Not set'}</p>
              <button onClick={() => { setNameInput(profile?.display_name || ''); setEditingName(true) }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>Edit</button>
            </div>
          )}
        </div>
        <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Email</p>
          <p style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{user.email}</p>
        </div>
        <Link href="/saved" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', textDecoration: 'none' }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Saved designs</p>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>{savedCount}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="#888888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '14px 16px 8px' }}>Settings</p>
        {['Dark / light mode', 'Change password', 'Notification preferences'].map((item) => (
          <div key={item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: '0.5px solid var(--border)' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{item}</p>
            <span style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: '500', padding: '3px 8px', borderRadius: '20px' }}>Soon</span>
          </div>
        ))}
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', border: '0.5px solid var(--border)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>About</p>
        <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>The Palette</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>A curated library of nail and beauty designs — each with full specs, colour codes, and technique details.</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '10px' }}>Version 0.1 · Beta</p>
      </div>

      <button onClick={handleLogout}
        style={{ width: '100%', background: 'none', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-secondary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: 'pointer' }}>
        Log out
      </button>
    </div>
  )
}
