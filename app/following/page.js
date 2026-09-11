'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'
import { useScrollMemory } from '@/lib/scrollMemory'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const WHITE80 = 'rgba(255,255,255,0.8)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

export default function FollowingPage() {
  const router = useRouter()
  const [following, setFollowing] = useState([])
  const [loading, setLoading]     = useState(true)
  const [userId, setUserId]       = useState(null)
  const [unfollowingId, setUnfollowingId] = useState(null)
  useScrollMemory(null, !loading)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/profile'); return }
      setUserId(session.user.id)
      await loadFollowing(session.user.id)
    })
  }, [])

  const loadFollowing = async (uid) => {
    const { data: followRows, error: followError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', uid)
      .order('created_at', { ascending: false })
      .limit(500)
    if (followError) console.error('following fetch failed:', followError)
    const ids = (followRows || []).map(r => r.following_id)
    let result = []
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, account_type, is_verified')
        .in('id', ids)
      result = profiles?.map(p => ({ following_id: p.id, profiles: p })) || []
      result.sort((a, b) => ids.indexOf(a.following_id) - ids.indexOf(b.following_id))
    }
    setFollowing(result)
    setLoading(false)
  }

  const handleUnfollow = async (followingId) => {
    if (unfollowingId) return
    setUnfollowingId(followingId)
    const { error } = await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', followingId)
    if (error) { alert('Failed to unfollow. Please try again.'); setUnfollowingId(null); return }
    setFollowing(prev => prev.filter(r => r.following_id !== followingId))
    setUnfollowingId(null)
  }

  return (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>

        {/* Header */}
        <div style={{ padding: 'calc(env(safe-area-inset-top) + 16px) 20px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BackButton fallback="/profile" />
          <h1 style={{ ...display(24), margin: 0 }}>Following</h1>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <p style={ui(300, 14, WHITE60)}>Loading…</p>
          </div>
        ) : following.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ ...ui(500, 15), marginBottom: '8px' }}>Not following anyone yet</p>
            <p style={{ ...ui(300, 13, WHITE60), marginBottom: '20px' }}>Follow nail artists and salons to see their latest designs.</p>
            <Link href="/search?tab=artists" style={{
              background: BTN_GRADIENT, color: 'var(--lq-white)',
              borderRadius: '1000px', padding: '12px 24px',
              ...ui(500, 14), textDecoration: 'none',
            }}>
              Find creators
            </Link>
          </div>
        ) : (
          <div style={{ margin: '0 20px', background: PANEL, borderRadius: '16px', border: PANEL_BORDER, overflow: 'hidden' }}>
            {following.map(row => {
              const person = row.profiles
              if (!person) return null
              const isCreator = person.account_type === 'creator' || person.account_type === 'salon'
              const label = person.account_type === 'salon' ? 'Salon' : person.account_type === 'creator' ? 'Nail Artist' : 'Design Lover'
              const isUnfollowing = unfollowingId === row.following_id
              return (
                <div
                  key={row.following_id}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}
                >
                  {/* Avatar + name — creators link to their public profile */}
                  {(() => {
                    const inner = (
                      <>
                        <div style={{
                          width: '46px', height: '46px', borderRadius: '50%',
                          background: PANEL, overflow: 'hidden', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: PANEL_BORDER,
                        }}>
                          {person.avatar_url
                            ? <img src={person.avatar_url} alt={person.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            : <span style={ui(500, 17, ACCENT)}>{(person.display_name || '?')[0].toUpperCase()}</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', minWidth: 0 }}>
                            <p style={{ ...ui(500, 14), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {person.display_name || 'User'}
                            </p>
                            {person.is_verified && (
                              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                                <circle cx="8" cy="8" r="7" fill={ACCENT} />
                                <path d="M5 8L7 10L11 6" stroke="#260D14" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                              </svg>
                            )}
                          </div>
                          <span style={{
                            background: PANEL, ...ui(500, 10, isCreator ? ACCENT : WHITE60),
                            padding: '2px 8px', borderRadius: '1000px', letterSpacing: '0.04em',
                          }}>
                            {label}
                          </span>
                        </div>
                      </>
                    )
                    const linkStyle = { display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0, textDecoration: 'none' }
                    return isCreator
                      ? <Link href={`/creator/${person.id}`} style={linkStyle}>{inner}</Link>
                      : <div style={linkStyle}>{inner}</div>
                  })()}

                  {/* Unfollow button */}
                  <button
                    onClick={() => handleUnfollow(row.following_id)}
                    disabled={isUnfollowing}
                    style={{
                      background: 'rgba(255,255,255,0.08)', border: PANEL_BORDER,
                      borderRadius: '1000px', padding: '7px 14px',
                      ...ui(500, 12, WHITE80), cursor: isUnfollowing ? 'not-allowed' : 'pointer',
                      opacity: isUnfollowing ? 0.5 : 1, flexShrink: 0, whiteSpace: 'nowrap',
                    }}
                  >
                    {isUnfollowing ? '…' : 'Unfollow'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
