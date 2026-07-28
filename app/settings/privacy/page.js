'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function Toggle({ value, onChange }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: '44px', height: '26px', borderRadius: '13px', border: 'none', cursor: 'pointer',
        background: value ? 'var(--accent)' : 'var(--bg-chip)',
        position: 'relative', transition: 'background 0.2s', flexShrink: 0, padding: 0,
      }}
    >
      <div style={{
        position: 'absolute', top: '3px',
        left: value ? '21px' : '3px',
        width: '20px', height: '20px', borderRadius: '50%',
        background: value ? '#2C0A1E' : '#888',
        transition: 'left 0.2s',
      }} />
    </button>
  )
}

function Row({ label, desc, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 16px', borderBottom: '0.5px solid var(--border)' }}>
      <div style={{ flex: 1, paddingRight: '16px' }}>
        <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: '0 0 2px' }}>{label}</p>
        {desc && <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, lineHeight: '1.5' }}>{desc}</p>}
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

  const save = async (field, value) => {
    setSaving(field)
    await supabase.from('profiles').update({ [field]: value }).eq('id', user.id)
    setSaving(null)
  }

  const handleTogglePrivate = async (val) => {
    setIsPrivate(val)
    await save('is_private', val)
  }

  const handleMessagePermission = async (val) => {
    setMessagePermission(val)
    await save('message_permission', val)
  }

  const handleShowSaves = async (val) => {
    setShowSaves(val)
    await save('show_saves', val)
  }

  const handleUnblock = async (blockedId) => {
    setUnblocking(blockedId)
    await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', blockedId)
    setBlockedUsers(prev => prev.filter(u => u.id !== blockedId))
    setUnblocking(null)
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  const msgOptions = [
    { value: 'everyone',  label: 'Everyone',       desc: 'Anyone on Laque can message you' },
    { value: 'followers', label: 'Followers only',  desc: 'Only people you follow back' },
    { value: 'none',      label: 'No one',          desc: 'Turn off messages entirely' },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '60px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '16px 20px' }}>
        <Link href="/profile" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Link>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0 }}>Privacy</h1>
      </div>

      {/* Profile visibility */}
      <div style={{ margin: '0 20px 20px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px', paddingLeft: '4px' }}>Account</p>
        <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
          <Row
            label="Private account"
            desc="When on, only your followers can see your designs, saves, and full profile."
          >
            {saving === 'is_private'
              ? <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Saving…</span>
              : <Toggle value={isPrivate} onChange={handleTogglePrivate} />
            }
          </Row>
          <Row
            label="Show saves on profile"
            desc="Let others see which designs you've saved."
          >
            {saving === 'show_saves'
              ? <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Saving…</span>
              : <Toggle value={showSaves} onChange={handleShowSaves} />
            }
          </Row>
        </div>
      </div>

      {/* Messages */}
      <div style={{ margin: '0 20px 20px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px', paddingLeft: '4px' }}>Messages</p>
        <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
          {msgOptions.map((opt, i) => (
            <button
              key={opt.value}
              onClick={() => handleMessagePermission(opt.value)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '15px 16px', background: 'none', border: 'none', cursor: 'pointer',
                borderBottom: i < msgOptions.length - 1 ? '0.5px solid var(--border)' : 'none',
                textAlign: 'left',
              }}
            >
              <div>
                <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: '0 0 2px', fontFamily: "'DM Sans', sans-serif" }}>{opt.label}</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0, fontFamily: "'DM Sans', sans-serif" }}>{opt.desc}</p>
              </div>
              <div style={{
                width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, marginLeft: '12px',
                border: `2px solid ${messagePermission === opt.value ? 'var(--accent)' : 'var(--border)'}`,
                background: messagePermission === opt.value ? 'var(--accent)' : 'transparent',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {messagePermission === opt.value && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2C0A1E' }} />
                )}
              </div>
            </button>
          ))}
        </div>
        {saving === 'message_permission' && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '6px 4px 0' }}>Saving…</p>
        )}
      </div>

      {/* Blocked users */}
      <div style={{ margin: '0 20px 20px' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px', paddingLeft: '4px' }}>
          Blocked users {blockedUsers.length > 0 && `(${blockedUsers.length})`}
        </p>
        <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
          {blockedUsers.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>No blocked users</p>
            </div>
          ) : (
            blockedUsers.map((u, i) => (
              <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', borderBottom: i < blockedUsers.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: '600' }}>{(u.display_name || '?')[0].toUpperCase()}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: 0 }}>{u.display_name}</p>
                  {u.username && <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>@{u.username}</p>}
                </div>
                <button
                  onClick={() => handleUnblock(u.id)}
                  disabled={unblocking === u.id}
                  style={{
                    background: 'var(--bg-chip)', color: 'var(--text-secondary)',
                    border: '0.5px solid var(--border)', borderRadius: '8px',
                    padding: '6px 12px', fontSize: '12px', fontWeight: '500',
                    fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
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
    </div>
  )
}
