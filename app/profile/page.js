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
  const [resetMode, setResetMode] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [resetDone, setResetDone] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [needsAccountType, setNeedsAccountType] = useState(false)

  // Profile edit state
  const [savedCount, setSavedCount] = useState(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
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
      if (_event === 'PASSWORD_RECOVERY') { setResetMode(true); return }
      if (session?.user) loadUserData(session.user)
      else { setUser(null); setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadUserData = async (u) => {
    setUser(u)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    setProfile(prof)
    if (!prof?.account_type) { setNeedsAccountType(true) } else { setNeedsAccountType(false) }
    const { count } = await supabase.from('saved_designs').select('*', { count: 'exact', head: true }).eq('user_id', u.id)
    setSavedCount(count || 0)
    const [{ count: followers }, { count: following }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', u.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', u.id),
    ])
    setFollowerCount(followers || 0)
    setFollowingCount(following || 0)
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
      await loadUserData(data.user)
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
      redirectTo: 'https://laque.app/profile',
    })
    if (error) { setError(error.message) }
    else { setForgotSent(true) }
    setSubmitting(false)
  }

  const handleBecomeCreator = async () => {
    if (!confirm('Switch your account to a Creator account? You\'ll be able to publish designs and get a public profile.')) return
    const { error } = await supabase.from('profiles').update({ account_type: 'creator' }).eq('id', user.id)
    if (!error) setProfile(prev => ({ ...prev, account_type: 'creator' }))
  }

  const handleLogout = async () => { await supabase.auth.signOut() }

  const handleDeleteAccount = async () => {
    if (!confirm('Delete your account permanently? This cannot be undone.')) return
    await supabase.rpc('delete_own_account')
    await supabase.auth.signOut()
  }

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://laque.app/profile' }
    })
  }

  const handleSetGoogleAccountType = async () => {
    if (!chosenType) return
    setSubmitting(true)
    const name = displayName.trim() || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User'
    await supabase.from('profiles').upsert({
      id: user.id,
      account_type: chosenType,
      display_name: name,
    })
    await loadUserData(user)
    setSubmitting(false)
  }

  const saveField = async (field, value, setter) => {
    await supabase.from('profiles').update({ [field]: value }).eq('id', user.id)
    setProfile(prev => ({ ...prev, [field]: value }))
    setter(false)
  }

  const handleSetNewPassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return }
    setSubmitting(true)
    setError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) { setError(error.message) }
    else { setResetDone(true); setResetMode(false) }
    setSubmitting(false)
  }


  // ─── PASSWORD RECOVERY (from email reset link) ───
  if (resetMode) {
    return (
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>
          Set new password
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>
          Choose a new password for your account
        </p>
        <form onSubmit={handleSetNewPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input type="password" placeholder="New password (min 6 characters)" value={newPassword} onChange={e => setNewPassword(e.target.value)} required
            style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }} />
          {error && <p style={{ color: '#E07070', fontSize: '13px' }}>{error}</p>}
          <button type="submit" disabled={submitting}
            style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: 'pointer', marginTop: '4px' }}>
            {submitting ? 'Saving...' : 'Save new password'}
          </button>
        </form>
      </div>
    )
  }


  const removeAvatar = async () => {
    if (!confirm('Remove profile photo?')) return
    const { error } = await supabase.from('profiles').update({ avatar_url: null }).eq('id', user.id)
    if (!error) setProfile(prev => ({ ...prev, avatar_url: null }))
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0]
    if (!file || !user) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop().toLowerCase()
    const path = `avatars/${user.id}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('designs')
      .upload(path, file, { upsert: false })
    if (uploadError) {
      alert('Upload failed: ' + uploadError.message)
      setUploadingAvatar(false)
      return
    }
    const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(path)
    // Cache-bust so the browser shows the new image immediately
    const bustedUrl = `${publicUrl}?t=${Date.now()}`
    const { error: dbErr } = await supabase.from('profiles').update({ avatar_url: bustedUrl }).eq('id', user.id)
    if (dbErr) {
      alert('Could not save avatar: ' + dbErr.message)
    } else {
      setProfile(prev => ({ ...prev, avatar_url: bustedUrl }))
    }
    setUploadingAvatar(false)
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
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>Choose how you'll use Laque</p>

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

  // ─── GOOGLE USER: pick account type on first sign-in ───
  if (user && needsAccountType) {
    const suggestedName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || ''
    return (
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>One more thing</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>How will you use Laque?</p>

        <input
          type="text"
          placeholder="Display name"
          value={displayName || suggestedName}
          onChange={e => setDisplayName(e.target.value)}
          style={{ width: '100%', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none', marginBottom: '16px', boxSizing: 'border-box' }}
        />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {[
            { type: 'user', label: 'Design lover', desc: 'Browse, save, and discover nail designs' },
            { type: 'creator', label: 'Nail artist', desc: 'Publish your work and build your portfolio' },
            { type: 'salon', label: 'Salon', desc: "Showcase your salon's designs and services" },
          ].map(({ type, label, desc }) => (
            <button key={type} onClick={() => setChosenType(type)}
              style={{ background: chosenType === type ? 'var(--accent)' : 'var(--bg-card)', border: chosenType === type ? 'none' : '0.5px solid var(--border)', borderRadius: '12px', padding: '16px', textAlign: 'left', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              <p style={{ color: chosenType === type ? '#2C0A1E' : 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>{label}</p>
              <p style={{ color: chosenType === type ? '#2C0A1E' : 'var(--text-secondary)', fontSize: '13px' }}>{desc}</p>
            </button>
          ))}
        </div>

        <button onClick={handleSetGoogleAccountType} disabled={!chosenType || submitting}
          style={{ width: '100%', background: chosenType ? 'var(--accent)' : 'var(--bg-chip)', color: chosenType ? '#2C0A1E' : 'var(--text-secondary)', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: chosenType ? 'pointer' : 'default' }}>
          {submitting ? 'Saving...' : 'Get started'}
        </button>
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

        {/* ── Google sign-in ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>or</span>
          <div style={{ flex: 1, height: '0.5px', background: 'var(--border)' }} />
        </div>
        <button onClick={handleGoogleSignIn}
          style={{ width: '100%', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', color: 'var(--text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
            <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.576c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.576 9 3.576z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', marginTop: '8px' }}>
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
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Saved</p>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '28px', fontWeight: '500' }}>{followerCount}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Followers</p>
          </div>
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '28px', fontWeight: '500' }}>{followingCount}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Following</p>
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
          {/* My Designs header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase' }}>My Designs</p>
            {(() => {
              const used    = profile?.weekly_uploads || 0
              const isPro   = profile?.is_pro || false
              const left    = isPro ? null : Math.max(0, 5 - used)
              const atLimit = !isPro && used >= 5
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {!isPro && (
                    <p style={{ color: atLimit ? '#e57373' : 'var(--text-secondary)', fontSize: '11px' }}>
                      {atLimit ? 'Limit reached' : `${left} upload${left === 1 ? '' : 's'} left`}
                    </p>
                  )}
                  {!atLimit && (
                    <Link href="/upload" style={{ background: 'var(--accent)', color: '#2C0A1E', borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>
                      + Add
                    </Link>
                  )}
                </div>
              )
            })()}
          </div>

          {myDesigns.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '28px 20px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>No designs yet</p>
              <Link href="/upload" style={{ color: 'var(--accent)', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}>
                Publish your first design →
              </Link>
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

        <button onClick={handleDeleteAccount}
          style={{ width: '100%', background: 'none', border: 'none', padding: '8px', color: '#8B3A3A', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
          Delete account
        </button>
      </div>
    )
  }

  // ─── LOGGED IN: Regular user profile ───
  const initials = (profile?.display_name || user.email || '?').slice(0, 2).toUpperCase()
  const accountLabel = profile?.account_type === 'creator' ? 'Nail Artist' : profile?.account_type === 'salon' ? 'Salon' : 'Design Lover'

  return (
    <div style={{ padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>

      {resetDone && (
        <div style={{ background: 'var(--accent)', borderRadius: '12px', padding: '14px 16px' }}>
          <p style={{ color: '#2C0A1E', fontSize: '14px', fontWeight: '500' }}>✓ Password updated successfully</p>
        </div>
      )}

      {/* ── Profile header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '4px 0' }}>
        {/* Avatar */}
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
          <label style={{ cursor: 'pointer' }}>
            <input type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: 'none' }} />
            <div style={{
              width: '72px', height: '72px', borderRadius: '50%',
              background: profile?.avatar_url ? 'transparent' : 'var(--bg-chip)',
              border: '0.5px solid var(--border)',
              overflow: 'hidden', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <span style={{ color: 'var(--text-secondary)', fontSize: '22px', fontWeight: '500' }}>{initials}</span>
              )}
              {uploadingAvatar && (
                <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                  <span style={{ color: '#fff', fontSize: '11px' }}>...</span>
                </div>
              )}
              {!uploadingAvatar && (
                <div style={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: '20px', height: '20px', borderRadius: '50%',
                  background: 'var(--accent)', border: '1.5px solid var(--bg-primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                    <path d="M2 5.5C2 4.67 2.67 4 3.5 4H4.5L5.5 2.5H10.5L11.5 4H12.5C13.33 4 14 4.67 14 5.5V12C14 12.83 13.33 13.5 12.5 13.5H3.5C2.67 13.5 2 12.83 2 12V5.5Z" stroke="#2C0A1E" strokeWidth="1.3" strokeLinejoin="round"/>
                    <circle cx="8" cy="8.5" r="2" stroke="#2C0A1E" strokeWidth="1.3"/>
                  </svg>
                </div>
              )}
            </div>
          </label>
          {profile?.avatar_url && !uploadingAvatar && (
            <button onClick={removeAvatar} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '10px', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: "'DM Sans', sans-serif" }}>
              Remove
            </button>
          )}
        </div>
        {/* Name + badge */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '20px', letterSpacing: '-0.02em', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {profile?.display_name || 'Set a name'}
          </h1>
          <span style={{
            background: 'var(--bg-chip)', color: 'var(--text-secondary)',
            fontSize: '11px', fontWeight: '500', padding: '3px 10px',
            borderRadius: '20px', letterSpacing: '0.04em',
          }}>
            {accountLabel}
          </span>
        </div>
      </div>

      {/* ── Editable fields ── */}
      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        {/* Display name */}
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
        {/* Bio */}
        <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Bio</p>
          {editingBio ? (
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={bioInput} onChange={e => setBioInput(e.target.value)} autoFocus placeholder="Tell us about yourself"
                style={{ flex: 1, background: 'var(--bg-chip)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }} />
              <button onClick={() => saveField('bio', bioInput, setEditingBio)}
                style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>Save</button>
              <button onClick={() => setEditingBio(false)} style={{ background: 'none', color: 'var(--text-secondary)', border: 'none', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>✕</button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={{ color: profile?.bio ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '14px' }}>{profile?.bio || 'Not set'}</p>
              <button onClick={() => { setBioInput(profile?.bio || ''); setEditingBio(true) }}
                style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>Edit</button>
            </div>
          )}
        </div>
        {/* Email */}
        <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Email</p>
          <p style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{user.email}</p>
        </div>
        {/* Saved count */}
        <Link href="/saved" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: '0.5px solid var(--border)', textDecoration: 'none' }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Saved designs</p>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>{savedCount}</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="#888888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </Link>
        {/* Followers / Following */}
        <div style={{ display: 'flex', borderTop: '0.5px solid var(--border)' }}>
          <div style={{ flex: 1, padding: '14px 16px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Followers</p>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>{followerCount}</p>
          </div>
          <div style={{ flex: 1, padding: '14px 16px', borderLeft: '0.5px solid var(--border)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Following</p>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>{followingCount}</p>
          </div>
        </div>
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

      {/* ── Become a Creator ── */}
      {profile?.account_type === 'user' && (
        <div style={{ background: 'linear-gradient(145deg, rgba(212,160,192,0.10), rgba(212,160,192,0.03))', border: '1px solid rgba(212,160,192,0.3)', borderRadius: '14px', padding: '18px 16px' }}>
          <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>For Nail Artists & Salons</p>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>Become a Creator</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '14px' }}>Publish your designs, get a public profile, and reach clients discovering nail art on Laque.</p>
          <button onClick={handleBecomeCreator} style={{
            width: '100%', background: 'var(--accent)', color: '#2C0A1E',
            border: 'none', borderRadius: '10px', padding: '12px',
            fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
            cursor: 'pointer',
          }}>
            Switch to Creator Account
          </button>
        </div>
      )}

      <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px', border: '0.5px solid var(--border)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>About</p>
        <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', marginBottom: '4px' }}>Laque</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6' }}>A curated library of nail & beauty designs — each with full specs, colour codes, and technique details.</p>
        <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '10px' }}>Version 0.1 · Beta</p>
      </div>

      <button onClick={handleLogout}
        style={{ width: '100%', background: 'none', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-secondary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: 'pointer' }}>
        Log out
      </button>

      <button onClick={handleDeleteAccount}
        style={{ width: '100%', background: 'none', border: 'none', padding: '8px', color: '#8B3A3A', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
        Delete account
      </button>
    </div>
  )
}
