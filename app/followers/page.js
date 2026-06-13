'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function FollowersPage() {
  const router = useRouter()
  const [followers, setFollowers] = useState([])
  const [loading, setLoading]     = useState(true)
  const [userId, setUserId]       = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/profile'); return }
      setUserId(session.user.id)
      // Get follower IDs, then fetch their profiles
      const { data: followRows } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', session.user.id)
        .order('created_at', { ascending: false })
      const ids = (followRows || []).map(r => r.follower_id)
      let data = []
      if (ids.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url, account_type, is_verified')
          .in('id', ids)
        data = profiles?.map(p => ({ follower_id: p.id, profiles: p })) || []
        // preserve follow order
        data.sort((a, b) => ids.indexOf(a.follower_id) - ids.indexOf(b.follower_id))
      }
      setFollowers(data || [])
      setLoading(false)
    })
  }, [])

  return (
    <div style={{ paddingBottom: '100px' }}>
      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '0.5px solid var(--border)' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 16L7 10L13 4" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600', margin: 0 }}>Followers</h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
        </div>
      ) : followers.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '8px' }}>No followers yet</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>When someone follows you, they'll appear here.</p>
        </div>
      ) : (
        <div>
          {followers.map(row => {
            const person = row.profiles
            if (!person) return null
            const isCreator = person.account_type === 'creator' || person.account_type === 'salon'
            const label = person.account_type === 'salon' ? 'Salon' : person.account_type === 'creator' ? 'Nail Artist' : 'Design Lover'
            return (
              <Link
                key={row.follower_id}
                href={isCreator ? `/creator/${person.id}` : '#'}
                style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', borderBottom: '0.5px solid var(--border)', textDecoration: 'none' }}
              >
                {/* Avatar */}
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
                {/* Name + badge */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '3px', minWidth: 0 }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {person.display_name || 'User'}
                    </p>
                    {person.is_verified && (
                      <svg width="14" height="14" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="8" cy="8" r="7" fill="#D4A0C0"/>
                        <path d="M5 8L7 10L11 6" stroke="#2C0A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <span style={{
                    background: 'var(--bg-chip)', color: isCreator ? 'var(--accent)' : 'var(--text-secondary)',
                    fontSize: '10px', fontWeight: '500', padding: '2px 8px',
                    borderRadius: '20px', letterSpacing: '0.04em',
                  }}>
                    {label}
                  </span>
                </div>
                {/* Chevron for creators */}
                {isCreator && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M6 4L10 8L6 12" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
