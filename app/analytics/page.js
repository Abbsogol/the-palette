'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AnalyticsPage() {
  const router = useRouter()
  const [designs, setDesigns]   = useState([])
  const [followers, setFollowers] = useState(0)
  const [loading, setLoading]   = useState(true)
  const [userId, setUserId]     = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/profile'); return }

      const me = session.user

      // Check account type
      const { data: prof } = await supabase
        .from('profiles')
        .select('account_type')
        .eq('id', me.id)
        .single()

      if (!prof || (prof.account_type !== 'creator' && prof.account_type !== 'salon')) {
        router.push('/profile')
        return
      }

      setUserId(me.id)

      const [{ data: d }, { count: fCount }] = await Promise.all([
        supabase
          .from('designs')
          .select('id, title, image_url, likes_count, saves_count, comments_count, created_at')
          .eq('created_by', me.id)
          .eq('is_published', true)
          .order('created_at', { ascending: false }),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', me.id),
      ])

      setDesigns(d || [])
      setFollowers(fCount || 0)
      setLoading(false)
    })
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
    </div>
  )

  const totalLikes    = designs.reduce((s, d) => s + (d.likes_count || 0), 0)
  const totalSaves    = designs.reduce((s, d) => s + (d.saves_count || 0), 0)
  const totalComments = designs.reduce((s, d) => s + (d.comments_count || 0), 0)

  // Sort by engagement for top design + table
  const byEngagement = [...designs].sort((a, b) => {
    const ea = (a.likes_count || 0) + (a.saves_count || 0) + (a.comments_count || 0)
    const eb = (b.likes_count || 0) + (b.saves_count || 0) + (b.comments_count || 0)
    return eb - ea
  })

  const topDesign = byEngagement[0] || null

  const overviewStats = [
    { label: 'Designs',   value: designs.length },
    { label: 'Followers', value: followers },
    { label: 'Likes',     value: totalLikes },
    { label: 'Saves',     value: totalSaves },
    { label: 'Comments',  value: totalComments },
  ]

  return (
    <div style={{ paddingBottom: '100px' }}>

      {/* Header */}
      <div style={{ padding: '20px 20px 16px', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '0.5px solid var(--border)' }}>
        <button onClick={() => router.back()} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M13 16L7 10L13 4" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600', margin: 0 }}>Analytics</h1>
      </div>

      <div style={{ padding: '20px 16px' }}>

        {/* Overview grid */}
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Overview</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
          {overviewStats.map(({ label, value }) => (
            <div key={label} style={{
              background: 'var(--bg-card)', borderRadius: '14px',
              border: '0.5px solid var(--border)', padding: '16px',
              display: 'flex', flexDirection: 'column', gap: '4px',
            }}>
              <span style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '600', lineHeight: 1 }}>{value.toLocaleString()}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{label}</span>
            </div>
          ))}
          {/* 5th card spans full width on odd grid */}
        </div>

        {/* Top design */}
        {topDesign && (() => {
          const eng = (topDesign.likes_count || 0) + (topDesign.saves_count || 0) + (topDesign.comments_count || 0)
          return (
            <>
              <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>Top Design</p>
              <Link href={`/design/${topDesign.id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: '24px' }}>
                <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '14px', padding: '12px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '10px', overflow: 'hidden', background: 'var(--bg-chip)', flexShrink: 0 }}>
                    {topDesign.image_url
                      ? <img src={topDesign.image_url} alt={topDesign.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%' }} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: '0 0 6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{topDesign.title}</p>
                    <div style={{ display: 'flex', gap: '14px' }}>
                      <StatPill icon="heart" value={topDesign.likes_count || 0} />
                      <StatPill icon="bookmark" value={topDesign.saves_count || 0} />
                      <StatPill icon="comment" value={topDesign.comments_count || 0} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: '700' }}>{eng}</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '10px', fontWeight: '500', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Engagements</span>
                  </div>
                </div>
              </Link>
            </>
          )
        })()}

        {/* Per-design table */}
        {designs.length > 0 ? (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>All Designs</p>
            <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', overflow: 'hidden' }}>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px 42px 42px', gap: '8px', padding: '10px 14px', borderBottom: '0.5px solid var(--border)' }}>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500' }}>Design</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', textAlign: 'center' }}>♥</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', textAlign: 'center' }}>⊹</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', textAlign: 'center' }}>✦</span>
              </div>
              {byEngagement.map((d, i) => (
                <Link key={d.id} href={`/design/${d.id}`} style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '1fr 42px 42px 42px', gap: '8px', alignItems: 'center', padding: '12px 14px', borderBottom: i < byEngagement.length - 1 ? '0.5px solid var(--border)' : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', overflow: 'hidden', background: 'var(--bg-chip)', flexShrink: 0 }}>
                      {d.image_url
                        ? <img src={d.image_url} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%' }} />
                      }
                    </div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{d.title}</p>
                  </div>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', textAlign: 'center' }}>{(d.likes_count || 0).toLocaleString()}</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', textAlign: 'center' }}>{(d.saves_count || 0).toLocaleString()}</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', textAlign: 'center' }}>{(d.comments_count || 0).toLocaleString()}</span>
                </Link>
              ))}
            </div>
            {/* Column legend */}
            <div style={{ display: 'flex', gap: '16px', marginTop: '8px', padding: '0 4px' }}>
              <LegendItem symbol="♥" label="Likes" />
              <LegendItem symbol="⊹" label="Saves" />
              <LegendItem symbol="✦" label="Comments" />
            </div>
          </>
        ) : (
          <div style={{ background: 'var(--bg-card)', borderRadius: '14px', border: '0.5px solid var(--border)', padding: '32px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No published designs yet</p>
          </div>
        )}
      </div>
    </div>
  )
}

function StatPill({ icon, value }) {
  const icons = {
    heart:    <path d="M12 21C12 21 3 15 3 9a4 4 0 018-1.5A4 4 0 0121 9c0 6-9 12-9 12z" fill="currentColor"/>,
    bookmark: <path d="M6 2h12v20l-6-4-6 4V2z" fill="currentColor"/>,
    comment:  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill="currentColor"/>,
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <svg width="11" height="11" viewBox="0 0 24 24" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>
        {icons[icon]}
      </svg>
      <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>{value.toLocaleString()}</span>
    </div>
  )
}

function LegendItem({ symbol, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{symbol}</span>
      <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{label}</span>
    </div>
  )
}
