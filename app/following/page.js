'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function FollowingPage() {
  const router = useRouter()
  const [following, setFollowing] = useState([])
  const [loading, setLoading]     = useState(true)
  const [userId, setUserId]       = useState(null)
  const [unfollowingId, setUnfollowingId] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/profile'); return }
      setUserId(session.user.id)
      await loadFollowing(session.user.id)
    })
  }, [])

  const loadFollowing = async (uid) => {
    const { data: followRows } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', uid)
      .order('created_at', { ascending: false })
    const ids = (followRows || []).map(r => r.following_id)
    let result = []
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url, account_type')
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
    await supabase.from('follows').delete().eq('follower_id', userId).eq('following_id', followingId)
    setFollowing(prev => prev.filter(r => r.following_id !== followingId))
    setUnfollowingId(null)
  }

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '0.5px solid var(--border)' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 16L7 10L13 4" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600', margin: 0 }}>Following</h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
        </div>
      ) : following.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>Not following anyone yet</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>Follow nail artists and salons to see their latest designs.</p>
          <Link href="/search" style={{
            background: 'var(--accent)', color: '#2C0A1E',
            borderRadius: '12px', padding: '12px 24px',
            fontSize: '14px', fontWeight: '600',
            fontFamily: "'DM Sans', sans-serif", textDecoration: 'none',
          }}>
            Find creators
          </Link>
        </div>
      ) : (
        <div>
          {following.map(row => {
            const person = row.profiles
            if (!person) return null
            const isCreator = person.account_type === 'creator' || person.account_type === 'salon'
            const label = person.account_type === 'salon' ? 'Salon' : person.account_type === 'creator' ? 'Nail Artist' : 'Design Lover'
            const isUnfollowing = unfollowingId === row.following_id
            return (
              <div
                key={row.following_id}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', borderBottom: '0.5px solid var(--border)' }}
              >
                {/* Avatar + name — link to creator page */}
                <Link
                  href={isCreator ? `/creator/${person.id}` : '#'}
                  style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0, textDecoration: 'none' }}
                >
                  <div style={{
                    width: '46px', height: '46px', borderRadius: '50%',
                    background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '0.5px solid var(--border)',
                  }}>
                    {person.avatar_url
                      ? <img src={person.avatar_url} alt={person.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <span style={{ color: 'var(--accent)', fontSize: '17px', fontWeight: '500' }}>
                          {(person.display_name || '?')[0].toUpperCase()}
                        </span>
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: '0 0 3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {person.display_name || 'User'}
                    </p>
                    <span style={{
                      background: 'var(--bg-chip)', color: isCreator ? 'var(--accent)' : 'var(--text-secondary)',
                      fontSize: '10px', fontWeight: '500', padding: '2px 8px',
                      borderRadius: '20px', letterSpacing: '0.04em',
                    }}>
                      {label}
                    </span>
                  </div>
                </Link>

                {/* Unfollow button */}
                <button
                  onClick={() => handleUnfollow(row.following_id)}
                  disabled={isUnfollowing}
                  style={{
                    background: 'none', border: '0.5px solid var(--border)',
                    borderRadius: '20px', padding: '7px 14px',
                    color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500',
                    fontFamily: "'DM Sans', sans-serif", cursor: isUnfollowing ? 'not-allowed' : 'pointer',
                    opacity: isUnfollowing ? 0.5 : 1, flexShrink: 0,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {isUnfollowing ? '...' : 'Unfollow'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
