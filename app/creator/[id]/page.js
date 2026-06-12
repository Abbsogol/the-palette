'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function CreatorPage() {
  const { id } = useParams()
  const [profile, setProfile]         = useState(null)
  const [designs, setDesigns]         = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading]         = useState(true)
  const [followLoading, setFollowLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const me = session?.user || null
      setCurrentUser(me)

      const [{ data: prof }, { data: d }, { count: followers }, { count: following }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('designs').select('*').eq('created_by', id).eq('is_published', true).order('created_at', { ascending: false }),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
      ])

      setProfile(prof)
      setDesigns(d || [])
      setFollowerCount(followers || 0)
      setFollowingCount(following || 0)

      if (me) {
        const { data: followRow } = await supabase.from('follows')
          .select('*').eq('follower_id', me.id).eq('following_id', id).single()
        setIsFollowing(!!followRow)
      }

      setLoading(false)
    }
    load()
  }, [id])

  const handleFollow = async () => {
    if (!currentUser) return
    setFollowLoading(true)
    if (isFollowing) {
      await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', id)
      setIsFollowing(false)
      setFollowerCount(c => c - 1)
    } else {
      await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: id })
      setIsFollowing(true)
      setFollowerCount(c => c + 1)
    }
    setFollowLoading(false)
  }

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
    </div>
  )

  if (!profile) return (
    <div style={{ padding: '24px 20px', color: 'var(--text-secondary)' }}>Creator not found.</div>
  )

  const isOwnProfile = currentUser?.id === id

  return (
    <div style={{ paddingBottom: '32px' }}>

      {/* Back */}
      <div style={{ padding: '16px 20px 0' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </Link>
      </div>

      {/* Header */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
          <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'var(--bg-chip)', border: '0.5px solid var(--border)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: 'var(--accent)', fontSize: '24px', fontWeight: '500' }}>
                {(profile.display_name || '?')[0].toUpperCase()}
              </span>
            )}
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <h1 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '500' }}>
                {profile.display_name || 'Creator'}
              </h1>
              {profile.is_verified && (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" fill="#D4A0C0"/>
                  <path d="M5 8L7 10L11 6" stroke="#2C0A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>
            <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
              {profile.account_type === 'salon' ? 'Salon' : 'Nail Artist'}
            </p>
          </div>
        </div>

        {profile.bio && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '12px' }}>{profile.bio}</p>
        )}
        {profile.location && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1C4.567 1 3 2.567 3 4.5C3 7 6.5 12 6.5 12C6.5 12 10 7 10 4.5C10 2.567 8.433 1 6.5 1Z" stroke="#888888" strokeWidth="1.2"/>
              <circle cx="6.5" cy="4.5" r="1.2" stroke="#888888" strokeWidth="1.2"/>
            </svg>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{profile.location}</p>
          </div>
        )}

        {/* Follow button — only for other users */}
        {!isOwnProfile && currentUser && (
          <button onClick={handleFollow} disabled={followLoading} style={{
            width: '100%', marginBottom: '16px',
            background: isFollowing ? 'transparent' : 'var(--accent)',
            color: isFollowing ? 'var(--text-secondary)' : '#2C0A1E',
            border: isFollowing ? '0.5px solid var(--border)' : 'none',
            borderRadius: '12px', padding: '13px',
            fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
            cursor: followLoading ? 'not-allowed' : 'pointer',
            opacity: followLoading ? 0.7 : 1,
            transition: 'all 0.15s ease',
          }}>
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        )}

        {/* Book CTA */}
        <div style={{ marginBottom: '20px' }}>
          <button style={{
            width: '100%', background: isOwnProfile || !currentUser ? 'var(--accent)' : 'var(--bg-card)',
            color: isOwnProfile || !currentUser ? '#2C0A1E' : 'var(--text-secondary)',
            border: isOwnProfile || !currentUser ? 'none' : '0.5px solid var(--border)',
            borderRadius: '12px', padding: '13px',
            fontSize: '14px', fontWeight: '500', fontFamily: "'DM Sans', sans-serif",
            cursor: 'default', letterSpacing: '0.01em',
          }}>
            Book an appointment
          </button>
          <p style={{ color: 'var(--text-secondary)', fontSize: '11px', textAlign: 'center', marginTop: '6px' }}>
            Booking coming soon — contact via Instagram or DM
          </p>
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '24px', marginBottom: '24px' }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '500' }}>{designs.length}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Designs</p>
          </div>
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '500' }}>{followerCount}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Followers</p>
          </div>
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '500' }}>{followingCount}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Following</p>
          </div>
        </div>

        {/* Designs grid */}
        {designs.length > 0 ? (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Portfolio</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {designs.map(design => (
                <Link key={design.id} href={`/design/${design.id}`}
                  style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', overflow: 'hidden', textDecoration: 'none', display: 'block' }}>
                  {design.image_url ? (
                    <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                      <img src={design.image_url} alt={design.title} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                    </div>
                  ) : <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-chip)' }} />}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>{design.title}</p>
                    <p style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.05em', textTransform: 'uppercase' }}>{design.shape} · {design.occasion}</p>
                  </div>
                </Link>
              ))}
            </div>
          </>
        ) : (
          <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '24px', border: '0.5px solid var(--border)', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No designs published yet</p>
          </div>
        )}
      </div>
    </div>
  )
}
