'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import CropModal from '@/components/CropModal'

// ── Option lists ───────────────────────────────────────────────────────────
const SHAPES     = ['Almond','Square','Coffin','Round','Oval','Stiletto','Squoval','Ballerina']
const LENGTHS    = ['Short','Medium','Long','Extra Long']
const COLORS     = ['Pink','Red','Nude','White','Black','Purple','Blue','Green','Yellow','Orange','Glitter','Chrome','Multicolor']
const FINISHES   = ['Glossy','Matte','Chrome','Glitter','Jelly','Pearl','Cat-eye','Velvet','Satin','Mirror']
const TECHNIQUES = ['French','Ombré','BIAB','Gel-X','Airbrush','3D','Aura','Chrome','Cat-eye','Marble','Nail art']
const OCCASIONS  = ['Everyday','Bridal','Party','Work','Vacation','Eid','Birthday','Holiday','Christmas','Summer','Winter']
const BUDGETS    = ['Under $50','$50–$100','$100–$150','$150+']
const CONTACTS   = ['App notification','SMS','Email','WhatsApp','Phone call']
const SENSITIVITIES = ['Acrylic','Gel','Acetone','Glue','BIAB','Primer','UV light']
const UNDERTONES    = ['Warm','Cool','Neutral','Olive','Deep Warm','Deep Cool']

// ── Profile completion score ───────────────────────────────────────────────
const calcCompletion = (p, u) => {
  if (!p || !u) return 0
  const checks = [
    !!p.display_name,
    !!p.avatar_url,
    !!p.phone_number,
    !!p.location,
    !!p.bio,
    !!p.preferred_contact,
    !!p.nail_shape,
    !!p.nail_length,
    !!(p.nail_colors?.length),
    !!(p.nail_finishes?.length),
    !!(p.nail_techniques?.length),
    !!(p.occasions?.length),
    !!p.budget_range,
    !!(p.allergies || p.product_sensitivities?.length),
    !!p.booking_area,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

// ── Section header with chevron ────────────────────────────────────────────
function SectionHeader({ title, expanded, onToggle, pct }) {
  return (
    <button onClick={onToggle} style={{
      width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
      borderBottom: expanded ? '0.5px solid var(--border)' : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif" }}>{title}</span>
        {pct !== undefined && (
          <span style={{
            background: pct === 100 ? 'rgba(110,201,127,0.15)' : 'var(--bg-chip)',
            color: pct === 100 ? '#6EC97F' : 'var(--text-secondary)',
            fontSize: '11px', padding: '2px 8px', borderRadius: '20px',
          }}>{pct}%</span>
        )}
      </div>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
        style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
        <path d="M4 6L8 10L12 6" stroke="#888888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

// ── Inline editable row ────────────────────────────────────────────────────
function EditRow({ label, field, value, placeholder, multiline, onSave }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput]     = useState('')
  const [saving, setSaving]   = useState(false)

  const start  = () => { setInput(value || ''); setEditing(true) }
  const cancel = () => setEditing(false)
  const save   = async () => {
    setSaving(true)
    const ok = await onSave(field, input)
    setSaving(false)
    if (ok !== false) setEditing(false)
  }

  return (
    <div style={{ padding: '14px 16px' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</p>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: multiline ? 'column' : 'row', gap: '8px' }}>
          {multiline ? (
            <textarea value={input} onChange={e => setInput(e.target.value)} autoFocus placeholder={placeholder}
              style={{ width: '100%', background: 'var(--bg-chip)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none', resize: 'none', minHeight: '72px', boxSizing: 'border-box' }} />
          ) : (
            <input value={input} onChange={e => setInput(e.target.value)} autoFocus placeholder={placeholder}
              style={{ flex: 1, background: 'var(--bg-chip)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 12px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }} />
          )}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={save} disabled={saving}
              style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
              {saving ? '...' : 'Save'}
            </button>
            <button onClick={cancel}
              style={{ background: 'none', color: 'var(--text-secondary)', border: 'none', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>✕</button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <p style={{ color: value ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5', flex: 1 }}>{value || placeholder || 'Not set'}</p>
          <button onClick={start}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', flexShrink: 0, marginLeft: '8px' }}>Edit</button>
        </div>
      )}
    </div>
  )
}

// ── Username editable row (with format validation + unique error) ──────────
function UsernameRow({ value }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [current, setCurrent] = useState(value || '')

  const USERNAME_RE = /^[a-z0-9_.]{3,30}$/

  const start  = () => { setInput(current || ''); setError(''); setEditing(true) }
  const cancel = () => { setEditing(false); setError('') }

  const save = async () => {
    const val = input.trim().toLowerCase()
    if (!val) { setError('Username cannot be empty'); return }
    if (!USERNAME_RE.test(val)) { setError('3–30 chars, lowercase letters, numbers, _ and . only'); return }
    setSaving(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/update-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ username: val }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok || json.error) {
      if (json.code === '23505' || json.error?.includes('unique')) setError('Username already taken')
      else setError(json.error || 'Failed to save')
      return
    }
    setCurrent(val); setEditing(false)
  }

  return (
    <div style={{ padding: '14px 16px' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Username</p>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: 'var(--bg-chip)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 12px' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '14px', marginRight: '2px' }}>@</span>
              <input
                value={input}
                onChange={e => { setInput(e.target.value.toLowerCase()); setError('') }}
                autoFocus
                placeholder="your_username"
                maxLength={30}
                style={{ flex: 1, background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={save} disabled={saving}
                style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
                {saving ? '...' : 'Save'}
              </button>
              <button onClick={cancel}
                style={{ background: 'none', color: 'var(--text-secondary)', border: 'none', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>✕</button>
            </div>
          </div>
          {error && <p style={{ color: '#E05C5C', fontSize: '12px', margin: 0 }}>{error}</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: current ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>
            {current ? `@${current}` : 'Not set'}
          </p>
          <button onClick={start}
            style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', flexShrink: 0, marginLeft: '8px' }}>Edit</button>
        </div>
      )}
    </div>
  )
}

// ── Input styles helper ────────────────────────────────────────────────────
const inp = { background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px 16px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }
const btn = (active) => ({ background: active ? 'var(--accent)' : 'var(--bg-chip)', color: active ? '#2C0A1E' : 'var(--text-secondary)', border: active ? 'none' : '0.5px solid var(--border)', borderRadius: '20px', padding: '6px 14px', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", fontWeight: active ? '500' : '400', cursor: 'pointer' })

// ── Main component ─────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter()
  // Preserve ?ref= from an invite link across the /onboarding -> /profile ->
  // /onboarding signup round-trip (captured once on mount, client-side only).
  const [refCode] = useState(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('ref') || ''
  )
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [managingSubscription, setManagingSubscription] = useState(false)

  // Auth state
  const [mode, setMode]                   = useState('login')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [displayName, setDisplayName]     = useState('')
  const [chosenType, setChosenType]       = useState(null)
  const [error, setError]                 = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [resetMode, setResetMode]         = useState(false)
  const [newPassword, setNewPassword]     = useState('')
  const [resetDone, setResetDone]         = useState(false)
  const [forgotSent, setForgotSent]       = useState(false)
  const [needsAccountType, setNeedsAccountType] = useState(false)

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [cropFile, setCropFile]               = useState(null)

  // Counts
  const [savedCount, setSavedCount]       = useState(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [myDesigns, setMyDesigns]         = useState([])

  // Salon posts (Updates)
  const [myPosts, setMyPosts]           = useState([])
  const [postModalOpen, setPostModalOpen] = useState(false)
  const [postText, setPostText]         = useState('')
  const [editingPostId, setEditingPostId] = useState(null)
  const [postSaving, setPostSaving]     = useState(false)

  // Expandable sections
  const [expanded, setExpanded] = useState({})
  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

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
    // New users (onboarding_complete === false explicitly) → send to onboarding
    if (prof?.onboarding_complete === false) {
      router.push(refCode ? `/onboarding?ref=${encodeURIComponent(refCode)}` : '/onboarding')
      return
    }
    if (!prof?.account_type) setNeedsAccountType(true)
    const { count: sc } = await supabase.from('saved_designs').select('*', { count: 'exact', head: true }).eq('user_id', u.id)
    setSavedCount(sc || 0)
    const [{ count: frs }, { count: fng }] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', u.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', u.id),
    ])
    setFollowerCount(frs || 0)
    setFollowingCount(fng || 0)
    if (prof?.account_type === 'creator' || prof?.account_type === 'salon') {
      const [{ data: designs }, { data: posts }] = await Promise.all([
        supabase.from('designs').select('*').eq('created_by', u.id)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('salon_posts').select('*').eq('creator_id', u.id).order('created_at', { ascending: false }),
      ])
      setMyDesigns(designs || [])
      setMyPosts(posts || [])
    }
    setLoading(false)
  }

  const saveField = async (field, value) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ [field]: value }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to save')
      setProfile(prev => ({ ...prev, [field]: value }))
      return true
    } catch (err) {
      alert(err.message || 'Failed to save. Please try again.')
      return false
    }
  }

  const openNewPost = () => { setEditingPostId(null); setPostText(''); setPostModalOpen(true) }
  const openEditPost = (post) => { setEditingPostId(post.id); setPostText(post.body); setPostModalOpen(true) }
  const closePostModal = () => { setPostModalOpen(false); setPostText(''); setEditingPostId(null) }

  const handleSubmitPost = async () => {
    if (!postText.trim() || postSaving) return
    setPostSaving(true)
    let postError = null
    if (editingPostId) {
      const { error } = await supabase.from('salon_posts').update({ body: postText.trim(), updated_at: new Date().toISOString() }).eq('id', editingPostId)
      postError = error
      if (!error) setMyPosts(prev => prev.map(p => p.id === editingPostId ? { ...p, body: postText.trim() } : p))
    } else {
      const { data, error } = await supabase.from('salon_posts').insert({ creator_id: user.id, body: postText.trim() }).select().single()
      postError = error
      if (data) setMyPosts(prev => [data, ...prev])
    }
    setPostSaving(false)
    if (postError) {
      alert('Failed to save update. Please try again.')
      return
    }
    closePostModal()
  }

  const handleDeletePost = async (postId) => {
    if (!confirm('Delete this update?')) return
    const { error } = await supabase.from('salon_posts').delete().eq('id', postId)
    if (error) { alert('Failed to delete update. Please try again.'); return }
    setMyPosts(prev => prev.filter(p => p.id !== postId))
  }

  const toggleChip = async (field, item, single) => {
    const current = profile?.[field]
    const next = single
      ? (current === item ? null : item)
      : (current || []).includes(item) ? (current).filter(i => i !== item) : [...(current || []), item]
    await saveField(field, next)
  }

  // ── Auth handlers ──────────────────────────────────────────────────────
  const handleSignUpStep1 = (e) => {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (!displayName.trim()) { setError('Please enter a display name'); return }
    if (!termsAccepted) { setError('Please accept the Terms & Privacy Policy to continue'); return }
    setError(''); setMode('choose-type')
  }

  const setAccountType = async (accountType, name) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/set-account-type', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ accountType, displayName: name }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) throw new Error(json.error || 'Failed to set account type')
  }

  const handleCreateAccount = async () => {
    if (!chosenType) return
    setSubmitting(true); setError('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setSubmitting(false); return }
    if (data.user) {
      try {
        await setAccountType(chosenType, displayName.trim())
        await loadUserData(data.user)
      } catch (err) {
        setError(err.message)
      }
    }
    setSubmitting(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setSubmitting(false)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault(); setError(''); setSubmitting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://laque.app/profile' })
    if (error) setError(error.message)
    else setForgotSent(true)
    setSubmitting(false)
  }

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://laque.app/profile', queryParams: { prompt: 'select_account' } } })
  }

  const handleSetGoogleAccountType = async () => {
    if (!chosenType) return
    setSubmitting(true); setError('')
    const name = displayName.trim() || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User'
    try {
      await setAccountType(chosenType, name)
      await loadUserData(user)
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  const handlePin = async (design) => {
    const newVal = !design.is_pinned
    const { error } = await supabase.from('designs').update({ is_pinned: newVal }).eq('id', design.id)
    if (error) { alert('Failed to update. Please try again.'); return }
    setMyDesigns(prev => {
      const updated = prev.map(d => d.id === design.id ? { ...d, is_pinned: newVal } : d)
      return [...updated].sort((a, b) => {
        if (b.is_pinned !== a.is_pinned) return b.is_pinned ? 1 : -1
        return new Date(b.created_at) - new Date(a.created_at)
      })
    })
  }

  const handleBecomeCreator = async () => {
    if (!confirm('Switch your account to a Creator account?')) return
    try {
      await setAccountType('creator')
      setProfile(prev => ({ ...prev, account_type: 'creator' }))
    } catch (err) {
      alert(err.message || 'Something went wrong. Please try again.')
    }
  }

  const handleManageSubscription = async () => {
    if (managingSubscription) return
    setManagingSubscription(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-billing-portal-session', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else { alert(data.error || 'Something went wrong.'); setManagingSubscription(false) }
    } catch {
      alert('Something went wrong.')
      setManagingSubscription(false)
    }
  }

  const handleSetNewPassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return }
    setSubmitting(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setError(error.message)
    else { setResetDone(true); setResetMode(false) }
    setSubmitting(false)
  }

  const handleLogout       = async () => { await supabase.auth.signOut() }
  const handleDeleteAccount = async () => {
    if (!confirm('Delete your account permanently? This cannot be undone.')) return
    await supabase.rpc('delete_own_account')
    await supabase.auth.signOut()
  }

  const handleAvatarPick = (e) => {
    const file = e.target.files[0]
    if (file) setCropFile(file)
    e.target.value = ''
  }

  const handleCroppedUpload = async (croppedFile) => {
    setCropFile(null)
    if (!user) return
    setUploadingAvatar(true)
    const path = `avatars/${user.id}/${Date.now()}.jpg`
    const { error: uploadError } = await supabase.storage.from('designs').upload(path, croppedFile, { upsert: false })
    if (uploadError) { alert('Upload failed: ' + uploadError.message); setUploadingAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(path)
    const bustedUrl = `${publicUrl}?t=${Date.now()}`
    await saveField('avatar_url', bustedUrl)
    setUploadingAvatar(false)
  }

  const removeAvatar = async () => {
    if (!confirm('Remove profile photo?')) return
    await saveField('avatar_url', null)
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding: '24px 20px', color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</div>

  // ── Password recovery ──────────────────────────────────────────────────
  if (resetMode) {
    return (
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>Set new password</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>Choose a new password for your account</p>
        <form onSubmit={handleSetNewPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input type="password" placeholder="New password (min 6 characters)" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={inp} />
          {error && <p style={{ color: '#E07070', fontSize: '13px' }}>{error}</p>}
          <button type="submit" disabled={submitting}
            style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: 'pointer' }}>
            {submitting ? 'Saving...' : 'Save new password'}
          </button>
        </form>
      </div>
    )
  }

  // ── Forgot password ────────────────────────────────────────────────────
  if (!user && mode === 'forgot') {
    return (
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>Reset password</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '32px' }}>We'll send a reset link to your email</p>
        {forgotSent ? (
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '20px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Check your email</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '20px' }}>We sent a reset link to {email}</p>
            <button onClick={() => { setMode('login'); setForgotSent(false) }}
              style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>Back to login</button>
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
            {error && <p style={{ color: '#E07070', fontSize: '13px' }}>{error}</p>}
            <button type="submit" disabled={submitting}
              style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: 'pointer' }}>
              {submitting ? 'Sending...' : 'Send reset link'}
            </button>
            <button type="button" onClick={() => { setMode('login'); setError('') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>← Back to login</button>
          </form>
        )}
      </div>
    )
  }

  // ── Choose account type ────────────────────────────────────────────────
  const accountTypes = [
    { type: 'user',    label: 'Design Lover',           desc: 'Browse, save, and discover nail designs' },
    { type: 'creator', label: 'Nail Artist / Nail Tech', desc: 'Publish your work and build your portfolio' },
    { type: 'salon',   label: 'Salon Owner',             desc: "Showcase your salon's designs and manage your team" },
  ]

  if (!user && mode === 'choose-type') {
    return (
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>I am a...</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>Choose how you'll use Laque</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {accountTypes.map(({ type, label, desc }) => (
            <button key={type} onClick={() => setChosenType(type)}
              style={{ background: chosenType === type ? 'var(--accent)' : 'var(--bg-card)', border: chosenType === type ? 'none' : '0.5px solid var(--border)', borderRadius: '12px', padding: '16px', textAlign: 'left', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}>
              <p style={{ color: chosenType === type ? '#2C0A1E' : 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '4px' }}>{label}</p>
              <p style={{ color: chosenType === type ? '#2C0A1E' : 'var(--text-secondary)', fontSize: '13px' }}>{desc}</p>
            </button>
          ))}
        </div>
        {error && <p style={{ color: '#E07070', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
        <button onClick={handleCreateAccount} disabled={!chosenType || submitting}
          style={{ width: '100%', background: chosenType ? 'var(--accent)' : 'var(--bg-chip)', color: chosenType ? '#2C0A1E' : 'var(--text-secondary)', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: chosenType ? 'pointer' : 'default' }}>
          {submitting ? 'Creating account...' : 'Create account'}
        </button>
        <button onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', display: 'block', margin: '12px auto 0' }}>← Back</button>
      </div>
    )
  }

  // ── Google user: pick account type ────────────────────────────────────
  if (user && needsAccountType) {
    const suggestedName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || ''
    return (
      <div style={{ padding: '24px 20px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontWeight: '500', fontSize: '22px', letterSpacing: '-0.02em', marginBottom: '4px' }}>One more thing</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>How will you use Laque?</p>
        <input type="text" placeholder="Display name" value={displayName || suggestedName} onChange={e => setDisplayName(e.target.value)}
          style={{ ...inp, width: '100%', marginBottom: '16px', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
          {accountTypes.map(({ type, label, desc }) => (
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

  // ── Login / Signup ─────────────────────────────────────────────────────
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
            <input type="text" placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} required style={inp} />
          )}
          <input type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required style={inp} />
          {mode === 'signup' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.5' }}>
                  I agree to the <span style={{ color: 'var(--accent)' }}>Terms of Service</span> and <span style={{ color: 'var(--accent)' }}>Privacy Policy</span>
                </span>
              </label>
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)}
                  style={{ marginTop: '2px', accentColor: 'var(--accent)', flexShrink: 0 }} />
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.5' }}>
                  Send me updates on new designs, features, and nail trends (optional)
                </span>
              </label>
            </div>
          )}
          {error && <p style={{ color: '#E07070', fontSize: '13px' }}>{error}</p>}
          <button type="submit" disabled={submitting}
            style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: 'pointer', marginTop: '4px' }}>
            {submitting ? 'Loading...' : mode === 'login' ? 'Log in' : 'Continue →'}
          </button>
        </form>
        {mode === 'login' && (
          <div style={{ textAlign: 'center', marginTop: '12px' }}>
            <button onClick={() => { setMode('forgot'); setError('') }}
              style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
              Forgot password?
            </button>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
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

  // ── LOGGED IN ──────────────────────────────────────────────────────────
  const isCreator   = profile?.account_type === 'creator' || profile?.account_type === 'salon'
  const accountLabel = profile?.account_type === 'creator' ? 'Nail Artist' : profile?.account_type === 'salon' ? 'Salon' : 'Design Lover'
  const initials    = (profile?.display_name || user.email || '?').slice(0, 2).toUpperCase()
  const completion  = calcCompletion(profile, user)

  // Per-section completion
  const bookingPct = Math.round(([profile?.preferred_contact, profile?.booking_area].filter(Boolean).length / 2) * 100)
  const stylePct   = Math.round(([profile?.nail_shape, profile?.nail_length, profile?.nail_colors?.length, profile?.nail_finishes?.length, profile?.budget_range].filter(Boolean).length / 5) * 100)
  const healthPct  = (profile?.allergies || profile?.product_sensitivities?.length) ? 100 : 0

  return (
    <div style={{ paddingBottom: '100px' }}>

      {cropFile && <CropModal file={cropFile} onCrop={handleCroppedUpload} onCancel={() => setCropFile(null)} />}

      {/* ── Post update modal ──────────────────────────────────────────── */}
      {postModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-primary)', borderRadius: '20px', padding: '24px 20px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600', margin: 0 }}>
                {editingPostId ? 'Edit update' : 'Post an update'}
              </p>
              <button onClick={closePostModal} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>✕</button>
            </div>
            <textarea
              value={postText}
              onChange={e => setPostText(e.target.value)}
              placeholder="Share an update with your followers… e.g. New gel colours in! 🌸"
              rows={5}
              autoFocus
              style={{
                width: '100%', background: 'var(--bg-card)', border: '0.5px solid var(--border)',
                borderRadius: '12px', padding: '12px 14px', color: 'var(--text-primary)',
                fontSize: '14px', fontFamily: "'DM Sans', sans-serif", resize: 'none',
                boxSizing: 'border-box', outline: 'none', lineHeight: '1.6', marginBottom: '14px',
              }}
            />
            <button
              onClick={handleSubmitPost}
              disabled={!postText.trim() || postSaving}
              style={{
                width: '100%', padding: '14px', background: postText.trim() ? 'var(--accent)' : 'var(--bg-chip)',
                color: postText.trim() ? '#2C0A1E' : 'var(--text-secondary)',
                border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600',
                fontFamily: "'DM Sans', sans-serif",
                cursor: postText.trim() && !postSaving ? 'pointer' : 'not-allowed',
              }}
            >
              {postSaving ? 'Saving…' : editingPostId ? 'Save changes' : 'Post'}
            </button>
          </div>
        </div>
      )}

      {resetDone && (
        <div style={{ margin: '16px 20px 0', background: 'var(--accent)', borderRadius: '12px', padding: '14px 16px' }}>
          <p style={{ color: '#2C0A1E', fontSize: '14px', fontWeight: '500' }}>✓ Password updated successfully</p>
        </div>
      )}

      {/* ── HEADER ─────────────────────────────────────────────────────── */}
      <div style={{ padding: '28px 20px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '16px' }}>
          {/* Avatar */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <label style={{ cursor: 'pointer' }}>
              <input type="file" accept="image/*" onChange={handleAvatarPick} style={{ display: 'none' }} />
              <div style={{ width: '76px', height: '76px', borderRadius: '50%', background: profile?.avatar_url ? 'transparent' : 'var(--bg-chip)', border: '0.5px solid var(--border)', overflow: 'hidden', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {profile?.avatar_url
                  ? <img src={profile.avatar_url} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: 'var(--text-secondary)', fontSize: '24px', fontWeight: '500' }}>{initials}</span>
                }
                {uploadingAvatar && (
                  <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                    <span style={{ color: '#fff', fontSize: '11px' }}>...</span>
                  </div>
                )}
                {!uploadingAvatar && (
                  <div style={{ position: 'absolute', bottom: 2, right: 2, width: '22px', height: '22px', borderRadius: '50%', background: 'var(--accent)', border: '1.5px solid var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                      <path d="M2 5.5C2 4.67 2.67 4 3.5 4H4.5L5.5 2.5H10.5L11.5 4H12.5C13.33 4 14 4.67 14 5.5V12C14 12.83 13.33 13.5 12.5 13.5H3.5C2.67 13.5 2 12.83 2 12V5.5Z" stroke="#2C0A1E" strokeWidth="1.3" strokeLinejoin="round"/>
                      <circle cx="8" cy="8.5" r="2" stroke="#2C0A1E" strokeWidth="1.3"/>
                    </svg>
                  </div>
                )}
              </div>
            </label>
            {profile?.avatar_url && !uploadingAvatar && (
              <button onClick={removeAvatar} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '10px', cursor: 'pointer', padding: 0, textDecoration: 'underline', fontFamily: "'DM Sans', sans-serif" }}>Remove</button>
            )}
          </div>
          {/* Name + badge + location */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: '4px' }}>
            <h1 style={{ color: 'var(--text-primary)', fontWeight: '600', fontSize: '20px', letterSpacing: '-0.02em', marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.display_name || 'Set your name'}
            </h1>
            <span style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', padding: '3px 10px', borderRadius: '20px' }}>
              {accountLabel}
            </span>
            {profile?.location && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '6px' }}>📍 {profile.location}</p>
            )}
          </div>
        </div>
        {/* Followers / Following stats */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '16px' }}>
          {[
            { value: savedCount,     label: 'Saved',     href: '/saved'      },
            { value: followerCount,  label: 'Followers', href: '/followers'  },
            { value: followingCount, label: 'Following', href: '/following'  },
          ].map(({ value, label, href }) => (
            <Link key={label} href={href} style={{ textDecoration: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
              <span style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>{value}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontFamily: "'DM Sans', sans-serif" }}>{label}</span>
            </Link>
          ))}
        </div>

        {/* Completion bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Profile completion</p>
          <p style={{ color: completion === 100 ? '#6EC97F' : 'var(--accent)', fontSize: '11px', fontWeight: '500' }}>{completion}%</p>
        </div>
        <div style={{ height: '4px', background: 'var(--bg-chip)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${completion}%`, background: completion === 100 ? '#6EC97F' : 'var(--accent)', borderRadius: '2px', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* ── QUICK ACTIONS ──────────────────────────────────────────────── */}
      <div style={{ padding: '0 20px 24px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
          {[
            { label: 'Saved', href: '/saved', available: true,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg> },
            { label: 'Bookings', href: null, available: false,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg> },
            { label: 'Nail Lab', href: '/nail-lab', available: true,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6M10 3v6l-4 8a1 1 0 00.9 1.5h10.2a1 1 0 00.9-1.5L14 9V3"/><line x1="6.5" y1="14" x2="17.5" y2="14"/></svg> },
            { label: 'Mirror', href: null, available: false,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg> },
            { label: 'Credits', href: '/nail-lab', available: true,
              icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg> },
          ].map(({ label, href, icon, available }) => {
            const card = (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '12px 4px', background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', position: 'relative', opacity: available ? 1 : 0.5 }}>
                <span style={{ color: available ? 'var(--accent)' : 'var(--text-secondary)' }}>{icon}</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '10px', fontFamily: "'DM Sans', sans-serif", textAlign: 'center' }}>{label}</span>
                {!available && <span style={{ position: 'absolute', top: 3, right: 3, fontSize: '7px', color: 'var(--text-secondary)', background: 'var(--bg-chip)', padding: '1px 4px', borderRadius: '4px' }}>Soon</span>}
              </div>
            )
            return available && href
              ? <Link key={label} href={href} style={{ textDecoration: 'none' }}>{card}</Link>
              : <div key={label}>{card}</div>
          })}
        </div>
      </div>

      {/* ── PERSONAL INFO ──────────────────────────────────────────────── */}
      <div style={{ margin: '0 20px 12px', background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '14px 16px 10px' }}>Personal Info</p>
        <div style={{ borderTop: '0.5px solid var(--border)' }}>
          <EditRow label="Display name" field="display_name" value={profile?.display_name} placeholder="Your name" onSave={saveField} />
        </div>
        <div style={{ borderTop: '0.5px solid var(--border)' }}>
          <UsernameRow value={profile?.username} />
        </div>
        <div style={{ borderTop: '0.5px solid var(--border)', padding: '14px 16px' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Email</p>
          <p style={{ color: 'var(--text-primary)', fontSize: '14px' }}>{user.email}</p>
        </div>
        <div style={{ borderTop: '0.5px solid var(--border)' }}>
          <EditRow label="Phone number" field="phone_number" value={profile?.phone_number} placeholder="e.g. +971 50 123 4567" onSave={saveField} />
        </div>
        <div style={{ borderTop: '0.5px solid var(--border)' }}>
          <EditRow label="Location" field="location" value={profile?.location} placeholder="Your city or area" onSave={saveField} />
        </div>
        <div style={{ borderTop: '0.5px solid var(--border)' }}>
          <EditRow label="Bio" field="bio" value={profile?.bio} placeholder="Tell us about yourself" multiline onSave={saveField} />
        </div>
      </div>

      {/* ── BOOKING PASSPORT ───────────────────────────────────────────── */}
      <div style={{ margin: '0 20px 12px', background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        <SectionHeader title="Booking Passport" expanded={expanded.booking} onToggle={() => toggle('booking')} pct={bookingPct} />
        {expanded.booking && (
          <>
            <p style={{ padding: '10px 16px 14px', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.6', borderBottom: '0.5px solid var(--border)' }}>
              Stored once, used for all your bookings. Salons know how to reach you.
            </p>
            <div style={{ padding: '14px 16px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Preferred contact</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {CONTACTS.map(c => {
                  const active = profile?.preferred_contact === c
                  return (
                    <button key={c} onClick={() => saveField('preferred_contact', active ? null : c)} style={btn(active)}>{c}</button>
                  )
                })}
              </div>
            </div>
            <div style={{ borderTop: '0.5px solid var(--border)' }}>
              <EditRow label="Preferred booking area" field="booking_area" value={profile?.booking_area} placeholder="e.g. Dubai Marina, JBR..." onSave={saveField} />
            </div>
            <div style={{ borderTop: '0.5px solid var(--border)' }}>
              <EditRow label="Notes for salons" field="booking_notes" value={profile?.booking_notes} placeholder={`"I need removal first", "prefer quiet appointments"...`} multiline onSave={saveField} />
            </div>
          </>
        )}
      </div>

      {/* ── STYLE DNA ──────────────────────────────────────────────────── */}
      <div style={{ margin: '0 20px 12px', background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        <SectionHeader title="Style DNA" expanded={expanded.styleDNA} onToggle={() => toggle('styleDNA')} pct={stylePct} />
        {expanded.styleDNA && (
          <>
            <p style={{ padding: '10px 16px 14px', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.6', borderBottom: '0.5px solid var(--border)' }}>
              Your nail preferences. Personalises your feed, search, and Nail Lab results.
            </p>
            {[
              { label: 'Nail shape',           field: 'nail_shape',       options: SHAPES,     single: true  },
              { label: 'Nail length',           field: 'nail_length',      options: LENGTHS,    single: true  },
              { label: 'Favourite colours',     field: 'nail_colors',      options: COLORS,     single: false },
              { label: 'Favourite finishes',    field: 'nail_finishes',    options: FINISHES,   single: false },
              { label: 'Favourite techniques',  field: 'nail_techniques',  options: TECHNIQUES, single: false },
              { label: 'Occasions',             field: 'occasions',        options: OCCASIONS,  single: false },
              { label: 'Budget range',          field: 'budget_range',     options: BUDGETS,    single: true  },
            ].map(({ label, field, options, single }) => (
              <div key={field} style={{ borderTop: '0.5px solid var(--border)' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', padding: '14px 16px 10px' }}>{label}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 16px 14px' }}>
                  {options.map(opt => {
                    const active = single ? profile?.[field] === opt : (profile?.[field] || []).includes(opt)
                    return (
                      <button key={opt} onClick={() => toggleChip(field, opt, single)} style={btn(active)}>{opt}</button>
                    )
                  })}
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* ── NAIL HEALTH ────────────────────────────────────────────────── */}
      <div style={{ margin: '0 20px 12px', background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        <SectionHeader title="Nail Health" expanded={expanded.nailHealth} onToggle={() => toggle('nailHealth')} pct={healthPct} />
        {expanded.nailHealth && (
          <>
            <p style={{ padding: '10px 16px 14px', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.6', borderBottom: '0.5px solid var(--border)' }}>
              Shared with your nail tech when you make a booking.
            </p>
            <div>
              <EditRow label="Allergies" field="allergies" value={profile?.allergies} placeholder='e.g. "Latex allergy"' onSave={saveField} />
            </div>
            <div style={{ borderTop: '0.5px solid var(--border)', padding: '14px 16px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Product sensitivities</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {SENSITIVITIES.map(s => {
                  const active = (profile?.product_sensitivities || []).includes(s)
                  return (
                    <button key={s} onClick={() => toggleChip('product_sensitivities', s, false)}
                      style={{ ...btn(false), background: active ? 'rgba(224,112,112,0.15)' : 'var(--bg-chip)', color: active ? '#E07070' : 'var(--text-secondary)', border: active ? '0.5px solid rgba(224,112,112,0.4)' : '0.5px solid var(--border)' }}>
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ borderTop: '0.5px solid var(--border)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ color: 'var(--text-primary)', fontSize: '14px', marginBottom: '2px' }}>Removal needed</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>I need removal before a new set</p>
              </div>
              <button onClick={() => saveField('removal_needed', !profile?.removal_needed)}
                style={{ width: '44px', height: '26px', borderRadius: '13px', background: profile?.removal_needed ? 'var(--accent)' : 'var(--bg-chip)', border: '0.5px solid var(--border)', cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: profile?.removal_needed ? '20px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
            </div>
            <div style={{ borderTop: '0.5px solid var(--border)' }}>
              <EditRow label="Nail condition notes" field="nail_condition" value={profile?.nail_condition} placeholder='e.g. "Weak nails", "Short nail bed"' onSave={saveField} />
            </div>
          </>
        )}
      </div>

      {/* ── AR PROFILE ─────────────────────────────────────────────────── */}
      <div style={{ margin: '0 20px 12px', background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        <SectionHeader title="Nail Canvas" expanded={expanded.arProfile} onToggle={() => toggle('arProfile')} />
        {expanded.arProfile && (
          <>
            <p style={{ padding: '10px 16px 14px', color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.6', borderBottom: '0.5px solid var(--border)' }}>
              Used by Nail Mirror for accurate AR previews and better colour recommendations.
            </p>
            {/* Skin undertone */}
            <div style={{ padding: '14px 16px', borderBottom: '0.5px solid var(--border)' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Skin undertone</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {UNDERTONES.map(u => {
                  const active = profile?.skin_undertone === u
                  return (
                    <button key={u} onClick={() => saveField('skin_undertone', active ? null : u)} style={btn(active)}>{u}</button>
                  )
                })}
              </div>
            </div>
            {/* Hand photo */}
            <div style={{ padding: '14px 16px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Hand photo</p>
              {profile?.hand_photo_url ? (
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <img src={profile.hand_photo_url} alt="Hand" style={{ width: '140px', height: '100px', objectFit: 'cover', borderRadius: '10px', border: '0.5px solid var(--border)', display: 'block' }} />
                  <button onClick={() => saveField('hand_photo_url', null)}
                    style={{ position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                </div>
              ) : (
                <label style={{ cursor: 'pointer', display: 'inline-block' }}>
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                    const file = e.target.files[0]; if (!file) return
                    const path = `hand-photos/${user.id}/${Date.now()}.jpg`
                    const { error } = await supabase.storage.from('designs').upload(path, file, { upsert: false })
                    if (error) { alert('Upload failed: ' + error.message); return }
                    const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(path)
                    await saveField('hand_photo_url', publicUrl)
                    e.target.value = ''
                  }} />
                  <div style={{ width: '140px', height: '100px', background: 'var(--bg-chip)', borderRadius: '10px', border: '0.5px dashed var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Upload photo</span>
                  </div>
                </label>
              )}
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '8px', lineHeight: '1.5' }}>Optional — used for Nail Mirror AR previews</p>
            </div>
          </>
        )}
      </div>

      {/* ── CREDITS WALLET ─────────────────────────────────────────────── */}
      <div style={{ margin: '0 20px 12px', background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        {/* Balance row */}
        <div style={{ padding: '16px 16px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '6px' }}>Nail Lab Credits</p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{ color: (profile?.credit_balance ?? 0) > 0 ? 'var(--accent)' : '#E07070', fontSize: '32px', fontWeight: '600', letterSpacing: '-0.03em', lineHeight: 1 }}>{profile?.credit_balance ?? 0}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>credit{(profile?.credit_balance ?? 0) !== 1 ? 's' : ''} remaining</span>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '5px' }}>1 credit = 1 AI generation in Nail Lab</p>
          </div>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.3" opacity="0.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 3h6M10 3v6l-4 8a1 1 0 00.9 1.5h10.2a1 1 0 00.9-1.5L14 9V3"/><line x1="6.5" y1="14" x2="17.5" y2="14"/>
          </svg>
        </div>

        {/* Action row */}
        <div style={{ borderTop: '0.5px solid var(--border)', padding: '12px 16px', display: 'flex', gap: '8px' }}>
          <Link href="/nail-lab" style={{ flex: 1, background: 'var(--accent)', color: '#2C0A1E', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '600', textDecoration: 'none', textAlign: 'center', fontFamily: "'DM Sans', sans-serif" }}>
            Go to Nail Lab
          </Link>
          <Link href="/nail-lab/history" style={{ flex: 1, background: 'var(--bg-primary)', border: '0.5px solid var(--border)', color: 'var(--text-primary)', borderRadius: '10px', padding: '10px', fontSize: '13px', fontWeight: '500', textDecoration: 'none', textAlign: 'center', fontFamily: "'DM Sans', sans-serif" }}>
            My Generations
          </Link>
        </div>

        {/* Buy credits CTA */}
        <div style={{ borderTop: '0.5px solid var(--border)', padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>Need more credits?</p>
          <Link href="/buy-credits" style={{ background: 'var(--accent)', color: '#2C0A1E', fontSize: '11px', fontWeight: '600', padding: '5px 12px', borderRadius: '20px', fontFamily: "'DM Sans', sans-serif", textDecoration: 'none' }}>Buy Credits ✦</Link>
        </div>
      </div>

      {/* ── ACTIVITY STATS ─────────────────────────────────────────────── */}
      <div style={{ margin: '0 20px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
        <Link href="/saved" style={{ textDecoration: 'none', background: 'var(--bg-card)', borderRadius: '12px', padding: '16px 12px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '600' }}>{savedCount}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>Saved</p>
        </Link>
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px 12px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '600' }}>{followerCount}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>Followers</p>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '16px 12px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '600' }}>{followingCount}</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>Following</p>
        </div>
      </div>

      {/* ── CREATOR SECTION ────────────────────────────────────────────── */}
      {isCreator && (
        <div style={{ margin: '0 20px 12px' }}>

          {/* Analytics link */}
          <Link href="/analytics" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: '12px', padding: '13px 16px', textDecoration: 'none',
            marginBottom: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>Analytics</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>

          {/* Services link */}
          <Link href="/services" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: '12px', padding: '13px 16px', textDecoration: 'none',
            marginBottom: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
              <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>My Services</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>

          {/* Bookings link */}
          <Link href="/bookings" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: '12px', padding: '13px 16px', textDecoration: 'none',
            marginBottom: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>
              </svg>
              <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>Bookings</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>

          {/* Availability link */}
          <Link href="/availability" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: '12px', padding: '13px 16px', textDecoration: 'none',
            marginBottom: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
              </svg>
              <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>My Availability</span>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase' }}>My Designs</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {(() => {
                const used    = profile?.weekly_uploads || 0
                const isPro   = profile?.subscription_tier === 'pro_creator'
                const left    = isPro ? null : Math.max(0, 5 - used)
                const atLimit = !isPro && used >= 5
                return (
                  <>
                    {!isPro && <p style={{ color: atLimit ? '#e57373' : 'var(--text-secondary)', fontSize: '11px' }}>{atLimit ? 'Limit reached' : `${left} left`}</p>}
                    {!atLimit && <Link href="/upload" style={{ background: 'var(--accent)', color: '#2C0A1E', borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: '600', textDecoration: 'none' }}>+ Add</Link>}
                  </>
                )
              })()}
            </div>
          </div>
          <Link href="/rewards"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid var(--border)', textDecoration: 'none', marginBottom: '10px' }}>
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', marginBottom: '2px' }}>✦ Beauty Rewards</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Earn points for saves, bookings & more</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="#888888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>

          <Link href="/invite"
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid var(--border)', textDecoration: 'none', marginBottom: '10px' }}>
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', marginBottom: '2px' }}>💅 Invite & Earn</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Share your code — you both get reward points</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="#888888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>

          <Link href={`/creator/${user.id}`}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid var(--border)', textDecoration: 'none', marginBottom: '10px' }}>
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', marginBottom: '2px' }}>View public profile</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>See how others see your page</p>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4L10 8L6 12" stroke="#888888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </Link>

          {/* Updates section */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: 0 }}>Your Updates</p>
              <button
                onClick={openNewPost}
                style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '20px', padding: '6px 14px', fontSize: '12px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}
              >
                + Post update
              </button>
            </div>
            {myPosts.length === 0 ? (
              <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '20px 16px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>No updates yet — share news with your followers</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myPosts.map(post => {
                  const diff = Date.now() - new Date(post.created_at).getTime()
                  const h = Math.floor(diff / 3600000)
                  const d = Math.floor(diff / 86400000)
                  const ago = d >= 1 ? `${d}d ago` : h >= 1 ? `${h}h ago` : 'Just now'
                  return (
                    <div key={post.id} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{ago}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => openEditPost(post)} style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: '12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: 0 }}>Edit</button>
                          <button onClick={() => handleDeletePost(post.id)} style={{ background: 'none', border: 'none', color: '#E07070', fontSize: '12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: 0 }}>Delete</button>
                        </div>
                      </div>
                      <p style={{ color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.6', margin: 0, whiteSpace: 'pre-wrap' }}>{post.body}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          {myDesigns.length === 0 ? (
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '28px 20px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '8px' }}>No designs yet</p>
              <Link href="/upload" style={{ color: 'var(--accent)', fontSize: '13px', textDecoration: 'none', fontWeight: '500' }}>Publish your first design →</Link>
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                {myDesigns.slice(0, 6).map(design => (
                  <div key={design.id} style={{ position: 'relative', background: 'var(--bg-card)', borderRadius: '12px', border: `0.5px solid ${design.is_pinned ? 'rgba(212,160,192,0.4)' : 'var(--border)'}`, overflow: 'hidden' }}>
                    <Link href={`/design/${design.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                      {design.image_url
                        ? <div style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden' }}><img src={design.image_url} alt={design.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></div>
                        : <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--bg-chip)' }} />
                      }
                      <div style={{ padding: '8px 10px 10px' }}>
                        <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', margin: 0 }}>{design.title}</p>
                      </div>
                    </Link>
                    {/* Pin button */}
                    <button
                      onClick={(e) => { e.preventDefault(); handlePin(design) }}
                      style={{
                        position: 'absolute', top: '6px', right: '6px',
                        background: design.is_pinned ? 'var(--accent)' : 'rgba(0,0,0,0.5)',
                        border: 'none', borderRadius: '50%',
                        width: '26px', height: '26px',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', backdropFilter: 'blur(4px)',
                      }}
                      title={design.is_pinned ? 'Unpin' : 'Pin to top'}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill={design.is_pinned ? '#2C0A1E' : 'white'}>
                        <path d="M12 2L9 9H2l5.5 4-2 7L12 16l6.5 4-2-7L22 9h-7z"/>
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
              {myDesigns.length > 6 && (
                <Link href={`/creator/${user.id}`} style={{ display: 'block', textAlign: 'center', color: 'var(--accent)', fontSize: '13px', textDecoration: 'none', marginTop: '12px' }}>
                  View all {myDesigns.length} designs →
                </Link>
              )}
            </>
          )}
        </div>
      )}

      {/* ── BECOME A CREATOR ───────────────────────────────────────────── */}
      {!isCreator && (
        <div style={{ margin: '0 20px 12px', background: 'linear-gradient(145deg, rgba(212,160,192,0.10), rgba(212,160,192,0.03))', border: '1px solid rgba(212,160,192,0.3)', borderRadius: '14px', padding: '18px 16px' }}>
          <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>For Nail Artists & Salons</p>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', marginBottom: '6px' }}>Become a Creator</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', marginBottom: '14px' }}>Publish your designs, get a public profile, and reach clients discovering nail art on Laque.</p>
          <button onClick={handleBecomeCreator}
            style={{ width: '100%', background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
            Switch to Creator Account
          </button>
        </div>
      )}

      {/* Upgrade banner — only show if not already subscribed */}
      {!profile?.subscription_tier && (
        <div style={{ margin: '0 20px 14px' }}>
          <Link href="/upgrade" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(212,160,192,0.15) 0%, rgba(212,160,192,0.05) 100%)',
            border: '0.5px solid rgba(212,160,192,0.3)',
            borderRadius: '12px', padding: '13px 16px', textDecoration: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>✦</span>
              <div>
                <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', margin: '0 0 2px' }}>Upgrade to Pro</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>Unlock bookings, analytics & more</p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </Link>
        </div>
      )}

      {/* Manage subscription — only show if already subscribed */}
      {profile?.subscription_tier && (
        <div style={{ margin: '0 20px 14px' }}>
          <button onClick={handleManageSubscription} disabled={managingSubscription} style={{
            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: '12px', padding: '13px 16px', cursor: managingSubscription ? 'default' : 'pointer',
            fontFamily: 'inherit',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>✦</span>
              <div style={{ textAlign: 'left' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', margin: '0 0 2px' }}>
                  {managingSubscription ? 'Redirecting…' : 'Manage subscription'}
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>Update payment or cancel anytime</p>
              </div>
            </div>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M6 4l4 4-4 4" stroke="var(--accent)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      )}

      {/* My Appointments — visible to all users */}
      <div style={{ margin: '0 20px 14px' }}>
        <Link href="/appointments" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg-card)', border: '0.5px solid var(--border)',
          borderRadius: '12px', padding: '13px 16px', textDecoration: 'none',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01"/>
            </svg>
            <span style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500' }}>My Appointments</span>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 4l4 4-4 4" stroke="var(--text-secondary)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
      </div>

      {/* ── SETTINGS ───────────────────────────────────────────────────── */}
      <div style={{ margin: '0 20px 12px', background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '14px 16px 10px' }}>Settings</p>
        {/* Privacy settings — live */}
        <Link href="/settings/privacy" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: '0.5px solid var(--border)' }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', marginBottom: '2px', margin: 0 }}>Privacy settings</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '2px 0 0' }}>Profile visibility, messages, blocked users</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M6 4L10 8L6 12" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        {[
          { label: 'Notification preferences', desc: 'Appointments, salon updates, trend drops' },
          { label: 'Payment methods',           desc: 'Cards for credits and bookings' },
          { label: 'Language & region',         desc: 'Language, currency, location' },
          { label: 'Change password',           desc: null },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: '0.5px solid var(--border)' }}>
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', marginBottom: item.desc ? '2px' : 0 }}>{item.label}</p>
              {item.desc && <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{item.desc}</p>}
            </div>
            <span style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: '500', padding: '3px 8px', borderRadius: '20px', flexShrink: 0 }}>Soon</span>
          </div>
        ))}
      </div>

      {/* ── SUPPORT ────────────────────────────────────────────────────── */}
      <div style={{ margin: '0 20px 12px', background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', padding: '14px 16px 10px' }}>Support</p>
        <Link href="/help" style={{ textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: '0.5px solid var(--border)' }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', marginBottom: '2px', margin: 0 }}>Help & Support</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '2px 0 0' }}>Get help with bookings, credits, account</p>
          </div>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
            <path d="M6 4L10 8L6 12" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Link>
        {[
          { label: 'Terms & Privacy', desc: 'Terms of service and privacy policy' },
        ].map((item) => (
          <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 16px', borderTop: '0.5px solid var(--border)' }}>
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', marginBottom: '2px' }}>{item.label}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{item.desc}</p>
            </div>
            <span style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)', fontSize: '10px', fontWeight: '500', padding: '3px 8px', borderRadius: '20px', flexShrink: 0 }}>Soon</span>
          </div>
        ))}
        <div style={{ padding: '14px 16px', borderTop: '0.5px solid var(--border)' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Laque · Version 0.2 · Beta</p>
        </div>
      </div>

      {/* ── ADMIN PANEL LINK (admin only) ──────────────────────────────── */}
      {profile?.is_admin && (
        <div style={{ padding: '0 20px 12px' }}>
          <a href="/admin" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'rgba(212,160,192,0.08)', border: '0.5px solid var(--accent)', borderRadius: '12px', padding: '14px 16px', textDecoration: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              <span style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif" }}>Admin Panel</span>
            </div>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M5 3L9 7L5 11" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        </div>
      )}

      {/* ── LOGOUT + DELETE ─────────────────────────────────────────────── */}
      <div style={{ padding: '0 20px 8px' }}>
        <button onClick={handleLogout}
          style={{ width: '100%', background: 'none', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px', color: 'var(--text-secondary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", fontWeight: '500', cursor: 'pointer' }}>
          Log out
        </button>
      </div>
      <div style={{ padding: '0 20px 32px' }}>
        <button onClick={handleDeleteAccount}
          style={{ width: '100%', background: 'none', border: 'none', padding: '8px', color: '#8B3A3A', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
          Delete account
        </button>
      </div>

    </div>
  )
}
