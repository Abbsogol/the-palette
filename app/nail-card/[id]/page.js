'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function NailCardPage() {
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [reviews, setReviews] = useState([])
  const [avgRating, setAvgRating] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const profileUrl = `https://laque.app/creator/${id}`
  // QR code via free API — no npm package needed
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&margin=6&color=D4A0C0&bgcolor=1E1E1E&data=${encodeURIComponent(profileUrl)}`

  useEffect(() => {
    const load = async () => {
      const [{ data: prof }, { data: revs }] = await Promise.all([
        supabase.from('profiles').select('id, display_name, username, avatar_url, bio, specialties, location, is_verified').eq('id', id).single(),
        supabase.from('reviews').select('rating').eq('creator_id', id),
      ])

      if (!prof) { setLoading(false); return }

      const reviewList = revs || []
      const avg = reviewList.length > 0
        ? Math.round((reviewList.reduce((s, r) => s + r.rating, 0) / reviewList.length) * 10) / 10
        : null

      setProfile(prof)
      setReviews(reviewList)
      setAvgRating(avg)
      setLoading(false)
    }
    load()
  }, [id])

  const handleShare = async () => {
    const url = `https://laque.app/creator/${id}`
    if (navigator.share) {
      await navigator.share({ title: profile?.display_name, url })
    } else {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#888', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  if (!profile) return (
    <div style={{ minHeight: '100dvh', background: '#141414', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: '#888', fontFamily: "'DM Sans', sans-serif" }}>Profile not found.</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: '#141414', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 20px 40px' }}>

      {/* Back */}
      <div style={{ width: '100%', maxWidth: '420px', marginBottom: '20px' }}>
        <Link href={`/creator/${id}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#888', textDecoration: 'none', fontSize: '13px' }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to profile
        </Link>
      </div>

      {/* ── THE CARD ──────────────────────────────────────────────────────── */}
      <div style={{
        width: '100%', maxWidth: '420px',
        background: 'linear-gradient(160deg, #1E1E1E 0%, #2C0A1E 100%)',
        borderRadius: '24px',
        border: '0.5px solid rgba(212,160,192,0.25)',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(212,160,192,0.08)',
        position: 'relative',
      }}>

        {/* Decorative glow */}
        <div style={{
          position: 'absolute', top: '-60px', right: '-60px',
          width: '200px', height: '200px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,160,192,0.15) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '-40px', left: '-40px',
          width: '150px', height: '150px', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(212,160,192,0.08) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Card content */}
        <div style={{ padding: '32px 28px', position: 'relative' }}>

          {/* Laque wordmark */}
          <p style={{ color: 'rgba(212,160,192,0.5)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 28px' }}>
            laque
          </p>

          {/* Avatar */}
          <div style={{ marginBottom: '20px' }}>
            <div style={{
              width: '88px', height: '88px', borderRadius: '50%',
              background: 'linear-gradient(135deg, #D4A0C0, #2C0A1E)',
              padding: '2.5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ width: '81px', height: '81px', borderRadius: '50%', background: '#1A1A1A', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt={profile.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <span style={{ color: '#D4A0C0', fontSize: '30px', fontWeight: '600' }}>
                    {(profile.display_name || '?')[0].toUpperCase()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Name + verified */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h1 style={{ color: '#FFFFFF', fontSize: '24px', fontWeight: '700', margin: 0, letterSpacing: '-0.3px' }}>
              {profile.display_name}
            </h1>
            {profile.is_verified && (
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" fill="#D4A0C0"/>
                <path d="M5 8L7 10L11 6" stroke="#2C0A1E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </div>

          {/* Title + username */}
          <p style={{ color: '#D4A0C0', fontSize: '12px', fontWeight: '600', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>
            Nail Artist
          </p>
          {profile.username && (
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '13px', margin: '0 0 16px' }}>@{profile.username}</p>
          )}

          {/* Rating */}
          {avgRating && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', gap: '3px' }}>
                {[1,2,3,4,5].map(i => (
                  <span key={i} style={{ color: i <= Math.round(avgRating) ? '#F5C842' : 'rgba(255,255,255,0.15)', fontSize: '14px' }}>★</span>
                ))}
              </div>
              <span style={{ color: '#FFFFFF', fontSize: '13px', fontWeight: '600' }}>{avgRating}</span>
              <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
            </div>
          )}

          {/* Location */}
          {profile.location && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
              <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                <path d="M6.5 1C4.567 1 3 2.567 3 4.5C3 7 6.5 12 6.5 12C6.5 12 10 7 10 4.5C10 2.567 8.433 1 6.5 1Z" stroke="rgba(212,160,192,0.6)" strokeWidth="1.2"/>
                <circle cx="6.5" cy="4.5" r="1.2" stroke="rgba(212,160,192,0.6)" strokeWidth="1.2"/>
              </svg>
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', margin: 0 }}>{profile.location}</p>
            </div>
          )}

          {/* Specialties */}
          {profile.specialties?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '24px' }}>
              {profile.specialties.slice(0, 4).map(s => (
                <span key={s} style={{
                  background: 'rgba(212,160,192,0.12)', color: '#D4A0C0',
                  fontSize: '11px', fontWeight: '500', padding: '4px 10px',
                  borderRadius: '20px', border: '0.5px solid rgba(212,160,192,0.2)',
                  textTransform: 'capitalize',
                }}>{s}</span>
              ))}
            </div>
          )}

          {/* Divider */}
          <div style={{ height: '0.5px', background: 'rgba(212,160,192,0.15)', marginBottom: '20px' }} />

          {/* Bottom row: QR + CTA text */}
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', margin: '0 0 4px' }}>Book & explore</p>
              <p style={{ color: 'rgba(212,160,192,0.7)', fontSize: '12px', fontWeight: '500', margin: 0 }}>laque.app</p>
            </div>
            <div style={{ background: '#1E1E1E', borderRadius: '10px', padding: '6px', border: '0.5px solid rgba(212,160,192,0.2)' }}>
              <img src={qrSrc} alt="QR code" style={{ width: '72px', height: '72px', display: 'block', borderRadius: '6px' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Hint + share button */}
      <p style={{ color: '#555', fontSize: '12px', textAlign: 'center', margin: '20px 0 16px' }}>
        Screenshot this card to share, or tap below to copy your link
      </p>

      <button
        onClick={handleShare}
        style={{
          background: 'var(--accent, #D4A0C0)', color: '#2C0A1E',
          border: 'none', borderRadius: '14px', padding: '14px 32px',
          fontSize: '15px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
          cursor: 'pointer', width: '100%', maxWidth: '420px',
        }}
      >
        {copied ? '✓ Link copied!' : 'Share profile link'}
      </button>
    </div>
  )
}
