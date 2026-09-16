'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'
import { LaqueWordmark } from '@/components/ui/icons'

const ACCENT = '#FF517F'
const WINE = '#260D14'
const WHITE60 = 'rgba(255,255,255,0.6)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

export default function NailCardPage() {
  const { id } = useParams()
  const [profile, setProfile] = useState(null)
  const [reviews, setReviews] = useState([])
  const [avgRating, setAvgRating] = useState(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const profileUrl = `https://laque.app/creator/${id}`
  // QR code via free API — no npm package needed. Blush code on wine for contrast.
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=130x130&margin=6&color=FFEBEB&bgcolor=260D14&data=${encodeURIComponent(profileUrl)}`

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

  const Shell = ({ children }) => (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', minHeight: '100dvh' }}>{children}</div>
    </div>
  )

  if (loading) return (
    <Shell><div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={ui(300, 14, WHITE60)}>Loading…</p></div></Shell>
  )

  if (!profile) return (
    <Shell><div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p style={ui(300, 14, WHITE60)}>Profile not found.</p></div></Shell>
  )

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 40px' }}>

        {/* Back */}
        <div style={{ width: '100%', maxWidth: '420px', marginBottom: '20px' }}>
          <BackButton fallback={`/creator/${id}`} />
        </div>

        {/* ── THE CARD ──────────────────────────────────────────────────────── */}
        <div style={{
          width: '100%', maxWidth: '420px',
          background: 'linear-gradient(160deg, #2A0E18 0%, #48111F 100%)',
          borderRadius: '24px',
          border: '1px solid rgba(255,81,127,0.25)',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,81,127,0.08)',
          position: 'relative',
        }}>

          {/* Decorative glow */}
          <div style={{ position: 'absolute', top: '-60px', right: '-60px', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,81,127,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '-40px', left: '-40px', width: '150px', height: '150px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(255,81,127,0.08) 0%, transparent 70%)', pointerEvents: 'none' }} />

          {/* Card content */}
          <div style={{ padding: '32px 28px', position: 'relative' }}>

            {/* Laque wordmark */}
            <div style={{ marginBottom: '28px' }}>
              <LaqueWordmark height={18} color="rgba(255,235,235,0.6)" />
            </div>

            {/* Avatar */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ width: '88px', height: '88px', borderRadius: '50%', background: 'linear-gradient(135deg, #FF517F, #2C0A1E)', padding: '2.5px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '81px', height: '81px', borderRadius: '50%', background: '#1A0910', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {profile.avatar_url ? (
                    <img src={profile.avatar_url} alt={profile.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <span style={ui(600, 30, ACCENT)}>{(profile.display_name || '?')[0].toUpperCase()}</span>
                  )}
                </div>
              </div>
            </div>

            {/* Name + verified */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <h1 style={{ ...display(26), margin: 0 }}>{profile.display_name}</h1>
              {profile.is_verified && (
                <svg width="20" height="20" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="7" fill={ACCENT}/>
                  <path d="M5 8L7 10L11 6" stroke="#260D14" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>

            {/* Title + username */}
            <p style={{ ...ui(600, 12, ACCENT), letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>Nail Artist</p>
            {profile.username && (
              <p style={{ ...ui(400, 13, 'rgba(255,255,255,0.4)'), margin: '0 0 16px' }}>@{profile.username}</p>
            )}

            {/* Rating */}
            {avgRating && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {[1,2,3,4,5].map(i => (
                    <span key={i} style={{ color: i <= Math.round(avgRating) ? '#F5C842' : 'rgba(255,255,255,0.15)', fontSize: '14px' }}>★</span>
                  ))}
                </div>
                <span style={ui(600, 13)}>{avgRating}</span>
                <span style={ui(400, 12, 'rgba(255,255,255,0.4)')}>({reviews.length} {reviews.length === 1 ? 'review' : 'reviews'})</span>
              </div>
            )}

            {/* Location */}
            {profile.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '16px' }}>
                <svg width="12" height="12" viewBox="0 0 13 13" fill="none">
                  <path d="M6.5 1C4.567 1 3 2.567 3 4.5C3 7 6.5 12 6.5 12C6.5 12 10 7 10 4.5C10 2.567 8.433 1 6.5 1Z" stroke="rgba(255,81,127,0.6)" strokeWidth="1.2"/>
                  <circle cx="6.5" cy="4.5" r="1.2" stroke="rgba(255,81,127,0.6)" strokeWidth="1.2"/>
                </svg>
                <p style={{ ...ui(400, 12, 'rgba(255,255,255,0.5)'), margin: 0 }}>{profile.location}</p>
              </div>
            )}

            {/* Specialties */}
            {profile.specialties?.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '24px' }}>
                {profile.specialties.slice(0, 4).map(s => (
                  <span key={s} style={{ background: 'rgba(255,81,127,0.12)', ...ui(500, 11, ACCENT), padding: '4px 10px', borderRadius: '1000px', border: '1px solid rgba(255,81,127,0.2)', textTransform: 'capitalize' }}>{s}</span>
                ))}
              </div>
            )}

            {/* Divider */}
            <div style={{ height: '1px', background: 'rgba(255,81,127,0.15)', marginBottom: '20px' }} />

            {/* Bottom row: QR + CTA text */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
              <div>
                <p style={{ ...ui(400, 11, 'rgba(255,255,255,0.35)'), margin: '0 0 4px' }}>Book &amp; explore</p>
                <p style={{ ...ui(500, 12, 'rgba(255,81,127,0.7)'), margin: 0 }}>laque.app</p>
              </div>
              <div style={{ background: WINE, borderRadius: '10px', padding: '6px', border: '1px solid rgba(255,81,127,0.2)' }}>
                <img src={qrSrc} alt="QR code" style={{ width: '72px', height: '72px', display: 'block', borderRadius: '6px' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Hint + share button */}
        <p style={{ ...ui(300, 12, 'rgba(255,255,255,0.4)'), textAlign: 'center', margin: '20px 0 16px' }}>
          Screenshot this card to share, or tap below to copy your link
        </p>

        <button
          onClick={handleShare}
          style={{ background: BTN_GRADIENT, color: 'var(--lq-white)', border: 'none', borderRadius: '1000px', padding: '14px 32px', ...ui(600, 15), cursor: 'pointer', width: '100%', maxWidth: '420px' }}
        >
          {copied ? '✓ Link copied!' : 'Share profile link'}
        </button>
      </div>
    </Shell>
  )
}
