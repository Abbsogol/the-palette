'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'
import { useScrollMemory } from '@/lib/scrollMemory'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

function PersonRow({ person }) {
  const isCreator = person.account_type === 'creator' || person.account_type === 'salon'
  const label = person.account_type === 'salon' ? 'Salon' : person.account_type === 'creator' ? 'Nail Artist' : 'Design Lover'

  const inner = (
    <>
      {/* Avatar */}
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
      {/* Name + badge */}
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
      {/* Chevron for creators */}
      {isCreator && (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
          <path d="M6 4L10 8L6 12" stroke={WHITE60} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </>
  )

  const rowStyle = { display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px', borderBottom: '1px solid rgba(255,255,255,0.08)', textDecoration: 'none' }

  // Creators link to their public profile; clients (no public page) render inert.
  return isCreator
    ? <Link href={`/creator/${person.id}`} style={rowStyle}>{inner}</Link>
    : <div style={rowStyle}>{inner}</div>
}

export default function FollowersPage() {
  const router = useRouter()
  const [followers, setFollowers] = useState([])
  const [loading, setLoading]     = useState(true)
  useScrollMemory(null, !loading)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/profile'); return }
      // Get follower IDs, then fetch their profiles
      const { data: followRows, error: followError } = await supabase
        .from('follows')
        .select('follower_id')
        .eq('following_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(500)
      if (followError) console.error('followers fetch failed:', followError)
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
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 100px)' }}>

        {/* Header */}
        <div style={{ padding: 'calc(env(safe-area-inset-top) + 16px) 20px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <BackButton fallback="/profile" />
          <h1 style={{ ...display(24), margin: 0 }}>Followers</h1>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <p style={ui(300, 14, WHITE60)}>Loading…</p>
          </div>
        ) : followers.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', textAlign: 'center' }}>
            <p style={{ ...ui(500, 15), marginBottom: '8px' }}>No followers yet</p>
            <p style={ui(300, 13, WHITE60)}>When someone follows you, they&apos;ll appear here.</p>
          </div>
        ) : (
          <div style={{ margin: '0 20px', background: PANEL, borderRadius: '16px', border: PANEL_BORDER, overflow: 'hidden' }}>
            {followers.map(row => row.profiles && <PersonRow key={row.follower_id} person={row.profiles} />)}
          </div>
        )}
      </div>
    </div>
  )
}
