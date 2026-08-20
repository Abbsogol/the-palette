'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import IconButton from '@/components/ui/IconButton'
import PillButton from '@/components/ui/PillButton'
import FavouriteButton from '@/components/ui/FavouriteButton'
import Sheet from '@/components/ui/Sheet'
import { MagicStarIcon } from '@/components/ui/icons'

// Page-specific palette from the Artist Profile frame (257:2206): rose
// accent + near-black plum ground, distinct from the feed's wine tokens.
const ROSE = '#E58EA2'
const MUTED = '#A38B95'
const PANEL = 'rgba(255, 255, 255, 0.05)'
const PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.07)'
const BTN_GRADIENT = 'linear-gradient(90deg, #E58EA2 0%, #9E3C53 100%)'

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.3,
})

function formatCount(n) {
  if (n == null) return '0'
  if (n >= 1000) {
    const k = n / 1000
    return `${k >= 10 ? Math.round(k) : Math.round(k * 10) / 10}K`
  }
  return String(n)
}

function fmtReply(min) {
  if (min < 60) return `${Math.max(1, Math.round(min))} min`
  if (min < 1440) return `${Math.round(min / 60)}h`
  return `${Math.round(min / 1440)}d`
}

export default function CreatorPage() {
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const fmt12 = (t) => {
    if (!t) return ''
    const [h, m] = t.slice(0, 5).split(':').map(Number)
    const ampm = h < 12 ? 'am' : 'pm'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}${m > 0 ? `:${String(m).padStart(2,'0')}` : ''}${ampm}`
  }

  const { id } = useParams()
  const router = useRouter()
  const [profile, setProfile]         = useState(null)
  const [designs, setDesigns]         = useState([])
  const [currentUser, setCurrentUser] = useState(null)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [loading, setLoading]         = useState(true)
  const [loadError, setLoadError]     = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [totalSaves, setTotalSaves] = useState(0)
  const [services, setServices] = useState([])
  const [messagingLoading, setMessagingLoading] = useState(false)
  const [availability, setAvailability] = useState([])
  const [reviews, setReviews] = useState([])
  const [avgRating, setAvgRating] = useState(null)
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [isBlocked, setIsBlocked] = useState(false)       // viewer has blocked this profile
  const [blockedByThem, setBlockedByThem] = useState(false) // this profile has blocked viewer
  const [blockLoading, setBlockLoading] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const [activeTab, setActiveTab] = useState('designs')
  const [isFavourited, setIsFavourited] = useState(false)
  const [favouriteLoaded, setFavouriteLoaded] = useState(false)
  const [replyTime, setReplyTime] = useState(null)
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const me = session?.user || null
      setCurrentUser(me)

      // Designs/reviews are capped for display, but totalSaves/avgRating are
      // derived sums, so those get their own lightweight unbounded queries
      // (single narrow column, no cap) — capping the display queries alone
      const [
        { data: prof, error: profError },
        { data: d },
        { count: followers },
        { count: following },
        { data: svcs },
        { data: avail },
        { data: revs },
        { data: allSaves },
        { data: allRatings },
      ] = await Promise.all([
        supabase.from('profiles').select('*, is_private, message_permission, show_saves').eq('id', id).single(),
        supabase.from('designs').select('*').eq('created_by', id).eq('is_published', true).order('is_pinned', { ascending: false }).order('created_at', { ascending: false }).limit(100),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', id),
        supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', id),
        supabase.from('services').select('*').eq('creator_id', id).eq('is_active', true).order('created_at', { ascending: true }),
        supabase.from('availability').select('*').eq('creator_id', id).eq('is_active', true).order('day_of_week', { ascending: true }),
        supabase.from('reviews').select('id, rating, text, created_at, reviewer_id').eq('creator_id', id).order('created_at', { ascending: false }).limit(100),
        supabase.from('designs').select('saves_count').eq('created_by', id).eq('is_published', true),
        supabase.from('reviews').select('rating').eq('creator_id', id),
      ])

      // A real fetch failure (network drop, server error) must not be
      // conflated with "this creator genuinely doesn't exist" — PGRST116
      // ("no rows") from .single() is the real not-found case and falls
      // through to the existing !profile branch unaffected.
      if (profError && profError.code !== 'PGRST116') {
        console.error('creator profile fetch failed:', profError)
        setLoadError(true)
        setLoading(false)
        return
      }

      const totalSaves = (allSaves || []).reduce((sum, design) => sum + (design.saves_count || 0), 0)
      const reviewList = revs || []
      const ratings = allRatings || []
      const avg = ratings.length > 0
        ? Math.round((ratings.reduce((s, r) => s + r.rating, 0) / ratings.length) * 10) / 10
        : null

      // Fetch reviewer display names
      let reviewsWithNames = reviewList
      if (reviewList.length > 0) {
        const reviewerIds = [...new Set(reviewList.map(r => r.reviewer_id))]
        const { data: reviewerProfiles } = await supabase
          .from('profiles')
          .select('id, display_name, avatar_url')
          .in('id', reviewerIds)
        const rpMap = Object.fromEntries((reviewerProfiles || []).map(p => [p.id, p]))
        reviewsWithNames = reviewList.map(r => ({ ...r, reviewer: rpMap[r.reviewer_id] || null }))
      }

      setProfile(prof)
      setDesigns(d || [])
      setServices(svcs || [])
      setAvailability(avail || [])
      setFollowerCount(followers || 0)
      setFollowingCount(following || 0)
      setTotalSaves(totalSaves)
      setReviews(reviewsWithNames)
      setAvgRating(avg)

      if (me) {
        const [{ data: followRow }, { data: iBlockedThem }, { data: theyBlockedMe }, { data: favRow }] = await Promise.all([
          supabase.from('follows').select('*').eq('follower_id', me.id).eq('following_id', id).maybeSingle(),
          supabase.from('blocks').select('id').eq('blocker_id', me.id).eq('blocked_id', id).maybeSingle(),
          supabase.from('blocks').select('id').eq('blocker_id', id).eq('blocked_id', me.id).maybeSingle(),
          supabase.from('favourite_creators').select('creator_id').eq('user_id', me.id).eq('creator_id', id).maybeSingle(),
        ])
        setIsFollowing(!!followRow)
        setIsBlocked(!!iBlockedThem)
        setBlockedByThem(!!theyBlockedMe)
        setIsFavourited(!!favRow)
      }
      setFavouriteLoaded(true)

      setLoading(false)

      // Real median first-reply time (aggregate only, computed server-side);
      // rendered only at >= 3 samples — honest fallback otherwise.
      fetch(`/api/creator-reply-time?creator=${id}`)
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data && !data.error) setReplyTime(data) })
        .catch(() => {})
    }
    load()
  }, [id])

  const handleFollow = async () => {
    if (!currentUser) return
    setFollowLoading(true)
    if (isFollowing) {
      const { error } = await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', id)
      if (error) { alert('Failed to unfollow. Please try again.'); setFollowLoading(false); return }
      setIsFollowing(false)
      setFollowerCount(c => c - 1)
    } else {
      const { error } = await supabase.from('follows').insert({ follower_id: currentUser.id, following_id: id })
      if (error) { alert('Failed to follow. Please try again.'); setFollowLoading(false); return }
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
    if (!currentUser) { router.push('/profile'); return }
    setMessagingLoading(true)
    // Find existing conversation or create one. Role assignment must match
    // the ?with= deep-link flow in app/messages/page.js (based on the
    // CURRENT user's own account_type) — not assume the viewer is always
    // the client, since this profile page is reachable for any account.
    const { data: myProfile } = await supabase.from('profiles').select('account_type').eq('id', currentUser.id).single()
    const iAmCreator = myProfile?.account_type === 'creator' || myProfile?.account_type === 'salon'
    const clientId  = iAmCreator ? id : currentUser.id
    const creatorId = iAmCreator ? currentUser.id : id
    const { data: existing } = await supabase
      .from('conversations')
      .select('id')
      .eq('client_id', clientId)
      .eq('creator_id', creatorId)
      .maybeSingle()

    if (existing) {
      router.push(`/messages/${existing.id}`)
      setMessagingLoading(false)
      return
    }

    const { data: created, error } = await supabase
      .from('conversations')
      .insert({ client_id: clientId, creator_id: creatorId })
      .select('id')
      .single()

    if (error || !created) {
      alert('Failed to start conversation. Please try again.')
      setMessagingLoading(false)
      return
    }

    router.push(`/messages/${created.id}`)
    setMessagingLoading(false)
  }

  const handleBlock = async () => {
    if (!currentUser) return
    setBlockLoading(true)
    setMoreOpen(false)
    if (isBlocked) {
      const { error } = await supabase.from('blocks').delete().eq('blocker_id', currentUser.id).eq('blocked_id', id)
      if (error) { alert('Failed to unblock. Please try again.'); setBlockLoading(false); return }
      setIsBlocked(false)
    } else {
      const { error } = await supabase.from('blocks').insert({ blocker_id: currentUser.id, blocked_id: id })
      if (error) { alert('Failed to block. Please try again.'); setBlockLoading(false); return }
      setIsBlocked(true)
      // Also unfollow if following
      if (isFollowing) {
        const { error: unfollowErr } = await supabase.from('follows').delete().eq('follower_id', currentUser.id).eq('following_id', id)
        if (!unfollowErr) {
          setIsFollowing(false)
          setFollowerCount(c => c - 1)
        }
      }
    }
    setBlockLoading(false)
  }

  const handleShare = async () => {
    const url = window.location.href
    const title = profile?.display_name ? `${profile.display_name} on Laque` : 'Creator on Laque'
    if (navigator.share) {
      try { await navigator.share({ title: `${title} — Laque`, url }) } catch {}
    } else {
      await navigator.clipboard.writeText(url)
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    }
  }

  const pageShell = (children) => (
    <div style={{ position: 'relative', minHeight: '80vh' }}>
      <div aria-hidden style={{
        position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px', zIndex: 0,
        background: '#140308 url(/redesign/bg-blur.png) center / cover no-repeat',
      }} />
      <div style={{ position: 'relative', zIndex: 1 }}>{children}</div>
    </div>
  )

  if (loading) return pageShell(
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <p style={ui(300, 14, 'var(--lq-white-80)')}>Loading...</p>
    </div>
  )

  if (loadError) return pageShell(
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', padding: '20px', textAlign: 'center' }}>
      <p style={ui(400, 15)}>Couldn't load this profile</p>
      <p style={ui(300, 13, MUTED)}>Please try again in a moment.</p>
      <PillButton onClick={() => window.location.reload()} style={{ background: BTN_GRADIENT }}>Retry</PillButton>
    </div>
  )

  if (!profile) return pageShell(
    <div style={{ padding: '24px 20px' }}><p style={ui(300, 14, MUTED)}>Creator not found.</p></div>
  )

  // Blocked-by-them guard
  if (blockedByThem) return pageShell(
    <div style={{ minHeight: '80vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '28px', marginBottom: '16px', color: ROSE }}>✦</div>
      <p style={{ ...ui(400, 16), margin: '0 0 8px' }}>This profile is unavailable</p>
      <p style={ui(300, 14, MUTED)}>You can't view this profile.</p>
    </div>
  )

  const isOwnProfile = currentUser?.id === id
  const isSalon = profile.account_type === 'salon'
  const isPrivateAndNotFollowing = profile.is_private && !isFollowing && !isOwnProfile
  const canMessage = !isOwnProfile && currentUser && (
    profile.message_permission === 'everyone' ||
    (profile.message_permission === 'followers' && isFollowing)
  )
  // Frame draws Message on every profile: guests see it too and are routed
  // to sign-in on tap (handleMessage already does that for !currentUser).
  const showMessage = !isOwnProfile && !isBlocked && (currentUser ? canMessage : true)
  const canBook = services.length > 0 && !isOwnProfile && !isBlocked && !isPrivateAndNotFollowing
  const minPrice = services.length > 0 ? Math.min(...services.map(s => s.price || 0)) : null
  // The heart must always sit inline with a primary action (frame 257:2206);
  // when neither Book nor Message renders, Follow moves into the row.
  const followIsRowPrimary = !canBook && !showMessage

  const glassBtnStyle = { background: PANEL, border: PANEL_BORDER }

  const specs = profile.specialties?.length > 0 ? profile.specialties : []

  const tabs = [['designs', 'Designs'], ['services', 'Services'], ['reviews', 'Reviews'], ['about', 'About']]

  const sectionCard = { background: PANEL, border: PANEL_BORDER, borderRadius: 'var(--lq-radius-tile)', padding: '14px 16px' }

  return (
    <div style={{ position: 'relative' }}>

      {/* Blurred backdrop: the creator's own photo washed under a plum scrim */}
      <div aria-hidden style={{
        position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px', zIndex: 0, overflow: 'hidden', background: '#140308',
      }}>
        {/* Avatar-derived backdrop is desaturated and clamped under a wine
            scrim so any avatar colour stays inside the Laque palette; the
            avatar-less fallback keeps its original lighter scrim untouched. */}
        {profile.avatar_url
          ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(48px) saturate(0.5)', transform: 'scale(1.3)' }} />
          : <div style={{ width: '100%', height: '100%', background: 'url(/redesign/bg-blur.png) center / cover no-repeat' }} />}
        <div style={{ position: 'absolute', inset: 0, background: profile.avatar_url ? 'rgba(41, 0, 10, 0.78)' : 'rgba(26, 5, 13, 0.6)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: `calc(env(safe-area-inset-top) + 8px) 16px ${canBook ? '250px' : '160px'}` }}>

        {/* ── Top bar: back / share / more ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '56px' }}>
          <IconButton label="Back" href="/" variant="glass" visualSize={34}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </IconButton>
          <div style={{ display: 'flex', gap: '4px' }}>
            <IconButton label={shareCopied ? 'Link copied' : 'Share profile'} onClick={handleShare} variant="glass" visualSize={34}>
              {shareCopied ? (
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                </svg>
              )}
            </IconButton>
            <IconButton label="More options" onClick={() => setMoreOpen(true)} variant="glass" visualSize={34}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>
              </svg>
            </IconButton>
          </div>
        </div>

        {/* ── Identity header ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', paddingTop: '12px', position: 'relative' }}>
          <div aria-hidden style={{ position: 'absolute', top: '-40px', left: '50%', transform: 'translateX(-50%)', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(229,142,162,0.22) 0%, rgba(229,142,162,0) 65%)', pointerEvents: 'none' }} />
          <div style={{ width: '104px', height: '104px', borderRadius: '50%', border: `2px solid ${ROSE}`, padding: '2px', marginBottom: '12px' }}>
            <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: PANEL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt={profile.display_name || 'Creator'} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={ui(400, 34)}>{(profile.display_name || '?')[0].toUpperCase()}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <h1 style={{ ...ui(700, 28), margin: 0 }}>{profile.display_name || (isSalon ? 'Salon' : 'Creator')}</h1>
            {profile.is_verified && (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-label="Verified">
                <circle cx="8" cy="8" r="7" fill={ROSE}/>
                <path d="M5 8L7 10L11 6" stroke="#140308" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            <span style={{
              background: 'linear-gradient(90deg, rgba(179,97,119,0.25), rgba(229,142,162,0.25))',
              padding: '4px 10px', borderRadius: 'var(--lq-radius-pill)',
              ...ui(700, 9), letterSpacing: '0.06em',
            }}>
              {isSalon ? 'SALON' : 'NAIL ARTIST'}
            </span>
          </div>
          {profile.username && <p style={ui(300, 14, MUTED)}>@{profile.username}</p>}
          {profile.location && (
            <p style={{ ...ui(500, 13, 'var(--lq-white-80)'), display: 'flex', alignItems: 'center', gap: '5px', marginTop: '6px' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M5.631 11.067C5.631 11.067 2 8.009 2 5C2 3.93913 2.42143 2.92172 3.17157 2.17157C3.92172 1.42143 4.93913 1 6 1C7.06087 1 8.07828 1.42143 8.82843 2.17157C9.57857 2.92172 10 3.93913 10 5C10 8.009 6.369 11.067 6.369 11.067C6.167 11.253 5.8345 11.251 5.631 11.067ZM6 6.75C6.9665 6.75 7.75 5.9665 7.75 5C7.75 4.0335 6.9665 3.25 6 3.25C5.0335 3.25 4.25 4.0335 4.25 5C4.25 5.9665 5.0335 6.75 6 6.75Z" fill="currentColor" />
              </svg>
              {profile.location}
            </p>
          )}
          {profile.bio && (
            <p style={{ ...ui(300, 14, MUTED), lineHeight: 1.45, textAlign: 'center', marginTop: '6px', maxWidth: '340px', overflowWrap: 'break-word' }}>{profile.bio}</p>
          )}

          {/* Quick specs: real rating + real median reply time */}
          <div style={{
            display: 'flex', gap: '16px', alignItems: 'center', marginTop: '16px',
            background: 'rgba(28, 20, 23, 0.25)', border: PANEL_BORDER,
            borderRadius: 'var(--lq-radius-pill)', padding: '10px 16px',
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: ROSE }}>
              <MagicStarIcon size={16} />
              {avgRating != null ? (
                <>
                  <span style={ui(600, 13)}>{avgRating}</span>
                  <span style={ui(400, 13, MUTED)}>({reviews.length} review{reviews.length !== 1 ? 's' : ''})</span>
                </>
              ) : (
                <span style={ui(400, 13)}>New</span>
              )}
            </span>
            <span aria-hidden style={{ width: '1px', height: '12px', background: 'rgba(255,255,255,0.2)' }} />
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>
              </svg>
              <span style={ui(400, 12, MUTED)}>
                {replyTime && replyTime.samples >= 3 ? `Usually replies in ~${fmtReply(replyTime.medianMinutes)}` : 'New on Laque'}
              </span>
            </span>
          </div>

          {/* Specialties */}
          {specs.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'center', marginTop: '16px' }}>
              {specs.map(s => (
                <span key={s} style={{
                  background: 'rgba(255,255,255,0.03)', border: PANEL_BORDER,
                  padding: '6px 12px', borderRadius: 'var(--lq-radius-pill)',
                  ...ui(500, 12, MUTED), textTransform: 'capitalize',
                }}>{s}</span>
              ))}
            </div>
          )}
        </div>

        {/* ── Actions ── */}
        {!isOwnProfile && !isBlocked && (
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginTop: '24px' }}>
            {canBook && (
              <Link href={`/book/${id}`} style={{
                flex: 1, height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: BTN_GRADIENT, borderRadius: 'var(--lq-radius-pill)',
                textDecoration: 'none', ...ui(600, 15),
              }}>
                Book Appointment
              </Link>
            )}
            {showMessage && (
              <button onClick={handleMessage} disabled={messagingLoading} style={{
                flex: 1, height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                ...glassBtnStyle, borderRadius: 'var(--lq-radius-pill)',
                cursor: 'pointer', ...ui(600, 15),
              }}>
                {messagingLoading ? '…' : 'Message'}
              </button>
            )}
            {followIsRowPrimary && currentUser && (
              <button onClick={handleFollow} disabled={followLoading} style={{
                flex: 1, height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isFollowing ? PANEL : 'linear-gradient(90deg, rgba(229,142,162,0.25), rgba(158,60,83,0.25))',
                border: isFollowing ? PANEL_BORDER : `1px solid rgba(229,142,162,0.4)`,
                borderRadius: 'var(--lq-radius-pill)', cursor: followLoading ? 'not-allowed' : 'pointer',
                opacity: followLoading ? 0.7 : 1, ...ui(600, 15, isFollowing ? MUTED : 'var(--lq-white)'),
              }}>
                {isFollowing ? '✓ Following' : 'Follow'}
              </button>
            )}
            {followIsRowPrimary && !currentUser && (
              <Link href="/profile" style={{
                flex: 1, height: '52px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'linear-gradient(90deg, rgba(229,142,162,0.25), rgba(158,60,83,0.25))',
                border: `1px solid rgba(229,142,162,0.4)`,
                borderRadius: 'var(--lq-radius-pill)', textDecoration: 'none', ...ui(600, 15),
              }}>
                Sign in to follow
              </Link>
            )}
            {favouriteLoaded && (
              <FavouriteButton key={String(isFavourited)} creatorId={id} currentUser={currentUser} initiallyFavourited={isFavourited} shape="square" />
            )}
          </div>
        )}

        {/* Follow — real feature (powers the Following feed); the frame omits
            it, kept by Sogol's decision as an additive full-width pill.
            Skipped when Follow already serves as the row primary above. */}
        {!isOwnProfile && currentUser && !isBlocked && !followIsRowPrimary && (
          <button onClick={handleFollow} disabled={followLoading} style={{
            width: '100%', marginTop: '12px', height: '48px',
            background: isFollowing ? PANEL : 'linear-gradient(90deg, rgba(229,142,162,0.25), rgba(158,60,83,0.25))',
            border: isFollowing ? PANEL_BORDER : `1px solid rgba(229,142,162,0.4)`,
            borderRadius: 'var(--lq-radius-pill)', cursor: followLoading ? 'not-allowed' : 'pointer',
            opacity: followLoading ? 0.7 : 1, ...ui(600, 14, isFollowing ? MUTED : 'var(--lq-white)'),
          }}>
            {isFollowing ? '✓ Following' : 'Follow'}
          </button>
        )}
        {!isOwnProfile && !currentUser && !followIsRowPrimary && (
          <Link href="/profile" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '100%', marginTop: '12px', height: '48px',
            background: 'linear-gradient(90deg, rgba(229,142,162,0.25), rgba(158,60,83,0.25))',
            border: `1px solid rgba(229,142,162,0.4)`,
            borderRadius: 'var(--lq-radius-pill)', textDecoration: 'none', ...ui(600, 14),
          }}>
            Sign in to follow
          </Link>
        )}

        {/* ── Stats ── */}
        <div style={{
          display: 'flex', alignItems: 'center', marginTop: '20px',
          ...glassBtnStyle, borderRadius: 'var(--lq-radius-pill)', padding: '14px 16px',
        }}>
          {[
            [designs.length, 'Designs'],
            [formatCount(followerCount), 'Followers'],
            [avgRating != null ? avgRating : 'New', 'Rating'],
          ].map(([value, label], i) => (
            <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
              {i > 0 && <span aria-hidden style={{ width: '1px', height: '20px', background: 'rgba(255,255,255,0.15)', marginRight: '16px' }} />}
              <div style={{ flex: 1, textAlign: 'center' }}>
                <p style={{ ...ui(700, 18), margin: '0 0 2px' }}>{value}</p>
                <p style={{ ...ui(400, 12, MUTED), margin: 0 }}>{label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* ── Tabs ── */}
        <div role="tablist" aria-label="Profile sections" style={{ display: 'flex', marginTop: '16px', background: PANEL, borderRadius: 'var(--lq-radius-pill)', border: PANEL_BORDER, padding: '2px' }}>
          {tabs.map(([val, label]) => (
            <button key={val} role="tab" aria-selected={activeTab === val} onClick={() => setActiveTab(val)} style={{
              flex: 1, minHeight: '44px', border: 'none', cursor: 'pointer',
              background: activeTab === val ? 'linear-gradient(90deg, rgba(229,142,162,0.25), rgba(201,100,124,0.25))' : 'none',
              borderBottom: activeTab === val ? `2px solid ${ROSE}` : '2px solid transparent',
              borderRadius: 'var(--lq-radius-pill)',
              ...ui(activeTab === val ? 600 : 500, 14, activeTab === val ? 'var(--lq-white)' : 'rgba(255,255,255,0.5)'),
            }}>
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <div style={{ marginTop: '20px' }}>
          {isPrivateAndNotFollowing ? (
            <div style={{ ...sectionCard, padding: '32px 20px', textAlign: 'center' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 12px' }} aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <p style={{ ...ui(600, 15), margin: '0 0 6px' }}>This account is private</p>
              <p style={{ ...ui(300, 13, MUTED), margin: 0 }}>Follow to see their designs and reviews.</p>
            </div>
          ) : (
            <>
              {/* DESIGNS */}
              {activeTab === 'designs' && (
                designs.length > 0 ? (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'start' }}>
                    {designs.map(design => (
                      <Link key={design.id} href={`/design/${design.id}`} style={{
                        background: 'rgba(24, 18, 21, 0.25)', border: PANEL_BORDER,
                        borderRadius: 'var(--lq-radius-tile)', overflow: 'hidden',
                        textDecoration: 'none', display: 'block', position: 'relative',
                      }}>
                        {design.image_url
                          ? <img src={design.image_url} alt={design.title} loading="lazy" decoding="async" style={{ width: '100%', height: 'auto', display: 'block', background: 'rgba(255,255,255,0.04)' }} />
                          : <div style={{ width: '100%', aspectRatio: '1 / 1', background: 'rgba(255,255,255,0.04)' }} />}
                        {design.is_pinned && (
                          <span aria-label="Pinned" style={{ position: 'absolute', top: '8px', right: '8px', background: ROSE, borderRadius: '50%', width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="#140308" aria-hidden="true">
                              <path d="M12 2L9 9H2l5.5 4-2 7L12 16l6.5 4-2-7L22 9h-7z"/>
                            </svg>
                          </span>
                        )}
                        <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-start' }}>
                          <p style={{ ...ui(600, 14), margin: 0, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{design.title}</p>
                          {design.category && (
                            <span style={{ background: 'rgba(255,255,255,0.04)', border: PANEL_BORDER, borderRadius: '6px', padding: '4px 8px', ...ui(500, 11, ROSE), textTransform: 'capitalize' }}>
                              {design.category}
                            </span>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div style={{ ...sectionCard, padding: '24px', textAlign: 'center' }}>
                    <p style={ui(300, 13, MUTED)}>No designs published yet</p>
                  </div>
                )
              )}

              {/* SERVICES */}
              {activeTab === 'services' && (
                services.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {services.map(service => (
                      <div key={service.id} style={{ ...sectionCard, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
                        <div style={{ minWidth: 0 }}>
                          <p style={{ ...ui(600, 14), margin: '0 0 2px' }}>{service.name}</p>
                          {service.description && (
                            <p style={{ ...ui(300, 12, MUTED), margin: '0 0 6px', lineHeight: 1.4, overflowWrap: 'break-word' }}>{service.description}</p>
                          )}
                          <span style={ui(300, 12, MUTED)}>
                            {service.duration_minutes < 60 ? `${service.duration_minutes} min` : service.duration_minutes % 60 === 0 ? `${service.duration_minutes / 60} hr` : `${Math.floor(service.duration_minutes / 60)} hr ${service.duration_minutes % 60} min`}
                          </span>
                        </div>
                        <span style={{ ...ui(600, 14, ROSE), whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {service.price > 0 ? `AED ${service.price}` : 'Free'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ ...sectionCard, padding: '24px', textAlign: 'center' }}>
                    <p style={ui(300, 13, MUTED)}>No services listed yet</p>
                  </div>
                )
              )}

              {/* REVIEWS */}
              {activeTab === 'reviews' && (
                reviews.length > 0 ? (
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '5px', marginBottom: '12px' }}>
                      {[1,2,3,4,5].map(i => (
                        <svg key={i} width="12" height="12" viewBox="0 0 24 24" fill={i <= Math.round(avgRating) ? ROSE : 'rgba(255,255,255,0.15)'} aria-hidden="true">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                        </svg>
                      ))}
                      <span style={{ ...ui(600, 13), marginLeft: '3px' }}>{avgRating}</span>
                      <span style={ui(300, 12, MUTED)}>/ 5</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {(showAllReviews ? reviews : reviews.slice(0, 5)).map(review => (
                        <div key={review.id} style={sectionCard}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {review.reviewer?.avatar_url
                                  ? <img src={review.reviewer.avatar_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : <span style={ui(600, 11, ROSE)}>{(review.reviewer?.display_name || '?')[0].toUpperCase()}</span>}
                              </div>
                              <span style={ui(500, 13)}>{review.reviewer?.display_name || 'Client'}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                              {[1,2,3,4,5].map(i => (
                                <svg key={i} width="11" height="11" viewBox="0 0 24 24" fill={i <= review.rating ? ROSE : 'rgba(255,255,255,0.15)'} aria-hidden="true">
                                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                </svg>
                              ))}
                            </div>
                          </div>
                          {review.text && (
                            <p style={{ ...ui(300, 13, 'var(--lq-white-80)'), lineHeight: 1.55, margin: 0, overflowWrap: 'break-word' }}>{review.text}</p>
                          )}
                          <p style={{ ...ui(300, 11, MUTED), margin: '8px 0 0', opacity: 0.7 }}>
                            {new Date(review.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </p>
                        </div>
                      ))}
                    </div>
                    {reviews.length > 5 && (
                      <button onClick={() => setShowAllReviews(v => !v)} style={{ width: '100%', marginTop: '10px', background: 'none', border: 'none', cursor: 'pointer', minHeight: '44px', ...ui(500, 13, ROSE) }}>
                        {showAllReviews ? 'Show less' : `See all ${reviews.length} reviews`}
                      </button>
                    )}
                  </div>
                ) : (
                  <div style={{ ...sectionCard, padding: '24px', textAlign: 'center' }}>
                    <p style={ui(300, 13, MUTED)}>No reviews yet</p>
                  </div>
                )
              )}

              {/* ABOUT */}
              {activeTab === 'about' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {profile.bio && (
                    <div style={sectionCard}>
                      <p style={{ ...ui(500, 11, MUTED), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>About</p>
                      <p style={{ ...ui(300, 14, 'var(--lq-white-80)'), lineHeight: 1.6, margin: 0, overflowWrap: 'break-word' }}>{profile.bio}</p>
                    </div>
                  )}
                  {profile.location && (
                    <div style={{ ...sectionCard, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <p style={{ ...ui(500, 13), margin: 0 }}>📍 {profile.location}</p>
                      <a href={`https://maps.google.com/?q=${encodeURIComponent(profile.location)}`} target="_blank" rel="noopener noreferrer"
                        style={{ ...ui(600, 12, ROSE), textDecoration: 'none', whiteSpace: 'nowrap' }}>
                        Get Directions →
                      </a>
                    </div>
                  )}
                  {availability.length > 0 && (
                    <div style={sectionCard}>
                      <p style={{ ...ui(500, 11, MUTED), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>
                        {isSalon ? 'Opening Hours' : 'Availability'}
                      </p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {availability.map(a => (
                          <div key={a.day_of_week} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ ...ui(500, 13), width: '40px' }}>{DAY_NAMES[a.day_of_week]}</span>
                            <span style={ui(300, 13, MUTED)}>{fmt12(a.start_time)} – {fmt12(a.end_time)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div style={sectionCard}>
                    <p style={{ ...ui(500, 11, MUTED), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>More stats</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <p style={{ ...ui(300, 13, MUTED), margin: 0 }}>Following</p>
                      <p style={{ ...ui(500, 13), margin: 0 }}>{formatCount(followingCount)}</p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px' }}>
                      <p style={{ ...ui(300, 13, MUTED), margin: 0 }}>Total design saves</p>
                      <p style={{ ...ui(500, 13), margin: 0 }}>{formatCount(totalSaves)}</p>
                    </div>
                  </div>
                  {isSalon && (
                    <div style={{ ...sectionCard, textAlign: 'center', padding: '24px 16px' }}>
                      <p style={{ ...ui(500, 11, MUTED), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>Our Nail Artists</p>
                      <p style={{ ...ui(300, 13, MUTED), margin: 0 }}>Nail artist profiles coming soon</p>
                    </div>
                  )}
                  {!isSalon && (
                    <Link href={`/nail-card/${id}`} style={{ ...sectionCard, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px', textDecoration: 'none', ...ui(500, 13, MUTED) }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                      Share profile card
                    </Link>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Sticky booking strip above the nav ── */}
      {canBook && minPrice != null && (
        <div style={{
          position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom) + 112px)', left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: '480px', zIndex: 90,
          padding: '10px 24px',
          background: 'linear-gradient(to top, rgba(32, 5, 11, 0.85), rgba(32, 5, 11, 0.4))',
          backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px',
        }}>
          <div>
            <p style={{ ...ui(500, 12, MUTED), margin: 0 }}>Starting Price</p>
            <p style={{ ...ui(700, 16), margin: '2px 0 0' }}>{minPrice > 0 ? `AED ${minPrice}` : 'Free'}</p>
          </div>
          <Link href={`/book/${id}`} style={{
            background: BTN_GRADIENT, borderRadius: 'var(--lq-radius-pill)',
            padding: '12px 20px', textDecoration: 'none', ...ui(600, 13),
          }}>
            Book Appointment
          </Link>
        </div>
      )}

      {/* ── More sheet: share card / directions / block ── */}
      {moreOpen && (
        <Sheet title="More options" onClose={() => setMoreOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingBottom: '8px' }}>
            {!isSalon && (
              <Link href={`/nail-card/${id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 4px', textDecoration: 'none', ...ui(400, 15) }}>
                Share profile card
              </Link>
            )}
            {profile.location && (
              <a href={`https://maps.google.com/?q=${encodeURIComponent(profile.location)}`} target="_blank" rel="noopener noreferrer"
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 4px', textDecoration: 'none', ...ui(400, 15) }}>
                Get directions
              </a>
            )}
            {!isOwnProfile && currentUser && (
              <button onClick={handleBlock} disabled={blockLoading}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 4px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', ...ui(500, 15, isBlocked ? 'var(--lq-white)' : '#E07070') }}>
                {blockLoading ? '…' : isBlocked ? 'Unblock user' : 'Block user'}
              </button>
            )}
          </div>
        </Sheet>
      )}
    </div>
  )
}
