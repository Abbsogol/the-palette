'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const WHITE80 = 'rgba(255,255,255,0.8)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })
const sectionLabel = { ...ui(500, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px', paddingLeft: '4px' }
const rowBorder = '1px solid rgba(255,255,255,0.08)'

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      role="switch"
      aria-checked={value}
      style={{
        width: '48px', height: '28px', borderRadius: '1000px', border: 'none', cursor: 'pointer',
        background: value ? ACCENT : 'rgba(255,255,255,0.15)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0, padding: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: '3px', left: value ? '23px' : '3px',
        width: '22px', height: '22px', borderRadius: '50%', background: '#fff',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

function Row({ label, desc, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 16px', borderBottom: rowBorder }}>
      <div style={{ flex: 1, paddingRight: '16px' }}>
        <p style={{ ...ui(500, 14), margin: '0 0 2px' }}>{label}</p>
        {desc && <p style={{ ...ui(300, 12, WHITE60), margin: 0 }}>{desc}</p>}
      </div>
      {children}
    </div>
  )
}

export default function PrivacySettingsPage() {
  const router = useRouter()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)
  const [blockedUsers, setBlockedUsers] = useState([])
  const [unblocking, setUnblocking] = useState(null)

  // Settings state
  const [isPrivate, setIsPrivate] = useState(false)
  const [messagePermission, setMessagePermission] = useState('everyone')
  const [showSaves, setShowSaves] = useState(true)
  const [saveError, setSaveError] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/profile'); return }
      setUser(user)

      const [{ data: profile }, { data: blocks }] = await Promise.all([
        supabase.from('profiles').select('is_private, message_permission, show_saves').eq('id', user.id).single(),
        supabase.from('blocks').select('blocked_id').eq('blocker_id', user.id),
      ])

      if (profile) {
        setIsPrivate(profile.is_private ?? false)
        setMessagePermission(profile.message_permission ?? 'everyone')
        setShowSaves(profile.show_saves ?? true)
      }

      // Fetch blocked user profiles
      if (blocks && blocks.length > 0) {
        const ids = blocks.map(b => b.blocked_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url')
          .in('id', ids)
        setBlockedUsers(profiles || [])
      }

      setLoading(false)
    }
    init()
  }, [])

  const save = async (field, value, revert) => {
    setSaving(field)
    setSaveError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/update-privacy-settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ [field]: value }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) {
      revert()
      setSaveError('Failed to save. Please try again.')
    }
    setSaving(null)
  }

  const handleTogglePrivate = async (val) => {
    const prev = isPrivate
    setIsPrivate(val)
    await save('is_private', val, () => setIsPrivate(prev))
  }

  const handleMessagePermission = async (val) => {
    const prev = messagePermission
    setMessagePermission(val)
    await save('message_permission', val, () => setMessagePermission(prev))
  }

  const handleShowSaves = async (val) => {
    const prev = showSaves
    setShowSaves(val)
    await save('show_saves', val, () => setShowSaves(prev))
  }

  const handleUnblock = async (blockedId) => {
    setUnblocking(blockedId)
    setSaveError('')
    const { error } = await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', blockedId)
    if (error) {
      setSaveError('Failed to unblock. Please try again.')
      setUnblocking(null)
      return
    }
    setBlockedUsers(prev => prev.filter(u => u.id !== blockedId))
    setUnblocking(null)
  }

  const Shell = ({ children }) => (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 60px)' }}>{children}</div>
    </div>
  )

  if (loading) return (
    <Shell>
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={ui(300, 14, WHITE60)}>Loading…</p>
      </div>
    </Shell>
  )

  const msgOptions = [
    { value: 'everyone',  label: 'Everyone',       desc: 'Anyone on Laque can message you' },
    { value: 'followers', label: 'Followers only',  desc: 'Only people you follow back' },
    { value: 'none',      label: 'No one',          desc: 'Turn off messages entirely' },
  ]

  return (
    <Shell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 16px' }}>
        <BackButton fallback="/profile" />
        <h1 style={{ ...display(24), margin: 0 }}>Privacy &amp; Safety</h1>
      </div>

      {saveError && (
        <p style={{ ...ui(400, 13, '#FF8DA8'), margin: '0 20px 16px', textAlign: 'center' }}>{saveError}</p>
      )}

      {/* Profile visibility */}
      <div style={{ margin: '0 20px 20px' }}>
        <p style={sectionLabel}>Account</p>
        <div style={{ background: PANEL, borderRadius: '16px', border: PANEL_BORDER, overflow: 'hidden' }}>
          <Row label="Private account" desc="When on, only your followers can see your designs, saves, and full profile.">
            {saving === 'is_private'
              ? <span style={ui(300, 12, WHITE60)}>Saving…</span>
              : <Toggle value={isPrivate} onChange={handleTogglePrivate} />}
          </Row>
          <Row label="Show saves on profile" desc="Let others see which designs you've saved.">
            {saving === 'show_saves'
              ? <span style={ui(300, 12, WHITE60)}>Saving…</span>
              : <Toggle value={showSaves} onChange={handleShowSaves} />}
          </Row>
        </div>
      </div>

      {/* Messages */}
      <div style={{ margin: '0 20px 20px' }}>
        <p style={sectionLabel}>Messages</p>
        <div style={{ background: PANEL, borderRadius: '16px', border: PANEL_BORDER, overflow: 'hidden' }}>
          {msgOptions.map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => handleMessagePermission(opt.value)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '15px 16px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: i < msgOptions.length - 1 ? rowBorder : 'none', textAlign: 'left',
              }}
            >
              <div>
                <p style={{ ...ui(500, 14), margin: '0 0 2px' }}>{opt.label}</p>
                <p style={{ ...ui(300, 12, WHITE60), margin: 0 }}>{opt.desc}</p>
              </div>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginLeft: '12px',
                border: `2px solid ${messagePermission === opt.value ? ACCENT : 'rgba(255,255,255,0.25)'}`,
                background: messagePermission === opt.value ? ACCENT : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {messagePermission === opt.value && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#260D14' }} />}
              </div>
            </button>
          ))}
        </div>
        {saving === 'message_permission' && (
          <p style={{ ...ui(300, 12, WHITE60), margin: '6px 4px 0' }}>Saving…</p>
        )}
      </div>

      {/* Blocked users */}
      <div style={{ margin: '0 20px 20px' }}>
        <p style={sectionLabel}>Blocked users {blockedUsers.length > 0 && `(${blockedUsers.length})`}</p>
        <div style={{ background: PANEL, borderRadius: '16px', border: PANEL_BORDER, overflow: 'hidden' }}>
          {blockedUsers.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <p style={ui(300, 13, WHITE60)}>No blocked users</p>
            </div>
          ) : (
            blockedUsers.map((u, i) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', borderBottom: i < blockedUsers.length - 1 ? rowBorder : 'none' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={ui(600, 14, ACCENT)}>{(u.display_name || '?')[0].toUpperCase()}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ ...ui(500, 14), margin: 0 }}>{u.display_name}</p>
                  {u.username && <p style={{ ...ui(300, 12, WHITE60), margin: 0 }}>@{u.username}</p>}
                </div>
                <button
                  onClick={() => handleUnblock(u.id)}
                  disabled={unblocking === u.id}
                  style={{
                    background: 'rgba(255,255,255,0.08)',
                    border: PANEL_BORDER, borderRadius: '1000px',
                    padding: '7px 14px', ...ui(500, 12, WHITE80), cursor: 'pointer',
                    opacity: unblocking === u.id ? 0.5 : 1,
                  }}
                >
                  {unblocking === u.id ? '…' : 'Unblock'}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </Shell>
  )
}
