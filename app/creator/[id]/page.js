'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import ShareButton from '@/components/ShareButton'

export default function CreatorPage() {
  const { id } = useParams()
  const router = useRouter()
  const [profile, setProfile]         = useState(null)
  const [designs, setDesigns]         = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading]         = useState(true)
  const [followLoading, setFollowLoading] = useState(false)
  const [totalSaves, setTotalSaves] = useState(0)
  const [services, setServices] = useState([])
  const [messagingLoading, setMessagingLoading] = useState(false)
  const [availability, setAvailability] = useState([])

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const fmt12 = (t) => {
    if (!t) return ''
    const [h, m] = t.slice(0, 5).split(':').map(Number)
    const ampm = h < 12 ? 'am' : 'pm'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}${m > 0 ? `:${String(m).padStart(2,'0')}` : ''}${ampm}`
  }

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const me = session?.user || null
      setCurrentUser(me)

      const [{ data: prof }, { data: d }, { count: followers }, { count: following }, { data: svcs }, { data: avail }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', id).single(),
        supabase.from('designs').select('*').eq('created_by', id).eq('is_published', true).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
        supabase.from('services').select('*').eq('creator_id', id).eq('is_active', true).order('created_at', { ascending: true }),
        supabase.from('availability').select('*').eq('creator_id', id).eq('is_active', true).order('day_of_week', { ascending: true }),
      ])

      const totalSaves = (d || []).reduce((sum, design) => sum + (design.saves_count || 0), 0)

      setProfile(prof)
      setDesigns(d || [])
      setServices(svcs || [])
      setAvailability(avail || [])
      setFollowerCount(followers || 0)
      setFollowingCount(following || 0)
      setTotalSaves(totalSaves)

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
      // Notify — skip if following yourself
      if (currentUser.id !== id) {
        await supabase.from('notifications').insert({ user_id: id, actor_id: currentUser.id, type: 'follow' })
      }
    }
    setFollowLoading(false)
  }

  const handleMessage = async () => {
    if (!currentUser) { router.push('/login'); return }
    setMessagingLoading(true)
    // Find existing conversation or create one
    // current user is always the client, creator is `id`
    const clientId  = currentUser.id
    const creatorId = id
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('client_id', clientId)
      .eq('creator_id', creatorId)
      .single()

    if (existing) {
      router.push(`/messages/${existing.id}`)
    } else {
      const { data: created } = await supabase
        .from('conversations')
        .insert({ client_id: clientId, creator_id: creatorId })
        .select('id')
        .single()
      router.push(`/messages/${created.id}`)
    }
    setMessagingLoading(false)
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
  const isSalon = profile.account_type === 'salon'

  return (
    <div style={{ paddingBottom: '32px' }}>

      {/* Back + Share */}
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: '500' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </Link>
        <ShareButton title={profile?.display_name ? `${profile.display_name} on Laque` : 'Creator on Laque'} />
      </div>

      {/* ── SALON HEADER ─────────────────────────────────────────────────── */}
      {isSalon ? (
        <div style={{ padding: '16px 20px 0' }}>
          {/* Banner */}
          <div style={{
            width: '100%', height: '140px', borderRadius: '16px',
            background: profile.avatar_url ? 'var(--bg-chip)' : 'linear-gradient(135deg, rgba(212,160,192,0.2) 0%, rgba(212,160,192,0.05) 100%)',
            border: '0.5px solid var(--border)', overflow: 'hidden',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            marginBottom: '16px', position: 'relative',
          }}>
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ color: 'var(--accent)', fontSize: '40px', fontWeight: '300', opacity: 0.6 }}>✦</span>
            )}
          </div>

          {/* Salon name + badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '700', margin: 0 }}>
              {profile.display_name || 'Salon'}
            </h1>
            {profile.is_verified && (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" fill="#D4A0C0"/>
                <path d="M5 8L7 10L11 6" stroke="#2C0A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>
          <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>Salon</p>
          {profile.username && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 12px' }}>@{profile.username}</p>
          )}
          {profile.bio && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 16px' }}>{profile.bio}</p>
          )}
          {profile.specialties?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '16px' }}>
              {profile.specialties.map(s => (
                <span key={s} style={{ background: 'var(--bg-chip)', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: '500', padding: '5px 10px', borderRadius: '20px', textTransform: 'capitalize' }}>{s}</span>
              ))}
            </div>
          )}

          {/* Location card with Get Directions */}
          {profile.location && (
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', padding: '14px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M8 1.5C5.79 1.5 4 3.29 4 5.5C4 8.5 8 14.5 8 14.5C8 14.5 12 8.5 12 5.5C12 3.29 10.21 1.5 8 1.5Z" fill="rgba(212,160,192,0.2)" stroke="var(--accent)" strokeWidth="1.2"/>
                  <circle cx="8" cy="5.5" r="1.5" fill="var(--accent)"/>
                </svg>
                <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: 0 }}>{profile.location}</p>
              </div>
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(profile.location)}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '600', textDecoration: 'none', whiteSpace: 'nowrap', marginLeft: '12px' }}
              >
                Get Directions →
              </a>
            </div>
          )}
        </div>

      ) : (
      // ── NAIL ARTIST HEADER ──────────────────────────────────────────────
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
              Nail Artist
            </p>
            {profile.username && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '2px' }}>@{profile.username}</p>
            )}
          </div>
        </div>

        {profile.bio && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginBottom: '12px' }}>{profile.bio}</p>
        )}

        {/* Specialties chips */}
        {profile.specialties?.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {profile.specialties.map(s => (
              <span key={s} style={{
                background: 'var(--bg-chip)', color: 'var(--text-secondary)',
                fontSize: '12px', fontWeight: '500', padding: '5px 10px',
                borderRadius: '20px', textTransform: 'capitalize',
              }}>{s}</span>
            ))}
          </div>
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
      </div>
      )}

      {/* ── SHARED CONTENT (both salon + nail artist) ──────────────────── */}
      <div style={{ padding: '0 20px' }}>

        {/* Follow button */}
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
            {isFollowing ? '✓ Following' : 'Follow'}
          </button>
        )}

        {/* Guest follow prompt */}
        {!isOwnProfile && !currentUser && (
          <Link href="/profile" style={{
            display: 'block', width: '100%', marginBottom: '16px',
            background: 'var(--accent)', color: '#2C0A1E',
            borderRadius: '12px', padding: '13px',
            fontSize: '14px', fontWeight: '600',
            fontFamily: "'DM Sans', sans-serif",
            textAlign: 'center', textDecoration: 'none',
          }}>
            Sign in to follow
          </Link>
        )}

        {/* CTA buttons — Book + Message */}
        {!isOwnProfile && currentUser && (
          <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            {services.length > 0 && (
              <Link href={`/book/${id}`} style={{
                flex: 1, display: 'block', background: 'var(--accent)', color: '#2C0A1E',
                border: 'none', borderRadius: '12px', padding: '13px',
                fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer', textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box',
              }}>
                Book ✦
              </Link>
            )}
            <button
              onClick={handleMessage}
              disabled={messagingLoading}
              style={{
                flex: services.length > 0 ? '0 0 auto' : 1,
                background: 'var(--bg-card)', color: 'var(--text-primary)',
                border: '0.5px solid var(--border)', borderRadius: '12px', padding: '13px 20px',
                fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
                cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {messagingLoading ? '…' : 'Message'}
            </button>
          </div>
        )}
        {/* Book only — logged out */}
        {services.length > 0 && !isOwnProfile && !currentUser && (
          <div style={{ marginBottom: '20px' }}>
            <Link href={`/book/${id}`} style={{
              display: 'block', width: '100%', background: 'var(--accent)', color: '#2C0A1E',
              border: 'none', borderRadius: '12px', padding: '13px',
              fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
              textDecoration: 'none', textAlign: 'center', boxSizing: 'border-box',
            }}>
              Book an appointment ✦
            </Link>
          </div>
        )}

        {/* Stats */}
        <div style={{ display: 'flex', gap: '20px', marginBottom: '24px', padding: '16px', background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)' }}>
          {[
            { value: designs.length, label: 'Designs' },
            { value: followerCount, label: 'Followers' },
            { value: followingCount, label: 'Following' },
            { value: totalSaves, label: 'Saves' },
          ].map(({ value, label }) => (
            <div key={label} style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: '0 0 2px' }}>{value}</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Services */}
        {services.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Services</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {services.map(service => (
                <div key={service.id} style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', margin: '0 0 2px' }}>{service.name}</p>
                    {service.description && (
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 6px', lineHeight: '1.4' }}>{service.description}</p>
                    )}
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                      {service.duration_minutes < 60 ? `${service.duration_minutes} min` : service.duration_minutes % 60 === 0 ? `${service.duration_minutes / 60} hr` : `${Math.floor(service.duration_minutes / 60)} hr ${service.duration_minutes % 60} min`}
                    </span>
                  </div>
                  <span style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: '600', marginLeft: '12px', whiteSpace: 'nowrap' }}>
                    {service.price > 0 ? `AED ${service.price}` : 'Free'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Availability / Opening Hours */}
        {availability.length > 0 && (
          <div style={{ marginBottom: '24px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
              {isSalon ? 'Opening Hours' : 'Availability'}
            </p>
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {availability.map(a => (
                <div key={a.day_of_week} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', width: '40px' }}>
                    {DAY_NAMES[a.day_of_week]}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {fmt12(a.start_time)} – {fmt12(a.end_time)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team — salon only */}
        {isSalon && (
          <div style={{ marginBottom: '24px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Our Nail Artists</p>
            <div style={{ background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', padding: '24px 16px', textAlign: 'center' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'rgba(212,160,192,0.1)', border: '0.5px solid rgba(212,160,192,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Nail artist profiles coming soon</p>
            </div>
          </div>
        )}

        {/* Designs grid */}
        {designs.length > 0 ? (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Portfolio</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {designs.map(design => (
                <Link key={design.id} href={`/design/${design.id}`}
                  style={{ background: 'var(--bg-card)', borderRadius: '12px', border: `0.5px solid ${design.is_pinned ? 'rgba(212,160,192,0.35)' : 'var(--border)'}`, overflow: 'hidden', textDecoration: 'none', display: 'block', position: 'relative' }}>
                  {design.image_url ? (
                    <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden' }}>
                      <img src={design.image_url} alt={design.title} style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                    </div>
                  ) : <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'var(--bg-chip)' }} />}
                  {design.is_pinned && (
                    <div style={{ position: 'absolute', top: '6px', right: '6px', background: 'var(--accent)', borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="#2C0A1E">
                        <path d="M12 2L9 9H2l5.5 4-2 7L12 16l6.5 4-2-7L22 9h-7z"/>
                      </svg>
                    </div>
                  )}
                  <div style={{ padding: '10px 12px 12px' }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', marginBottom: '4px' }}>{design.title}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <p style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.05em', textTransform: 'uppercase', margin: 0 }}>{[design.shape, design.occasion].filter(Boolean).join(' · ')}</p>
                      {design.saves_count > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--text-secondary)' }}>
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/>
                          </svg>
                          <span style={{ fontSize: '10px' }}>{design.saves_count}</span>
                        </div>
                      )}
                    </div>
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
      </div>{/* end shared content */}
    </div>
  )
}
