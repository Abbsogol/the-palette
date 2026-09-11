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
const ROW_BORDER = '1px solid rgba(255,255,255,0.08)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })
const sectionLabel = { ...ui(600, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }

export default function AnalyticsPage() {
  const router = useRouter()
  const [designs, setDesigns]   = useState([])
  const [followers, setFollowers] = useState(0)
  const [loading, setLoading]   = useState(true)
  useScrollMemory(null, !loading)

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

  const Shell = ({ children }) => (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}>{children}</div>
    </div>
  )

  if (loading) return (
    <Shell>
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={ui(300, 14, WHITE60)}>Loading…</p>
      </div>
    </Shell>
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
    <Shell>
      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top) + 16px) 20px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <BackButton fallback="/profile" />
        <h1 style={{ ...display(24), margin: 0 }}>Analytics</h1>
      </div>

      <div style={{ padding: '4px 16px' }}>

        {/* Overview grid */}
        <p style={sectionLabel}>Overview</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
          {overviewStats.map(({ label, value }) => (
            <div key={label} style={{
              background: PANEL, borderRadius: '16px', border: PANEL_BORDER, padding: '16px',
              display: 'flex', flexDirection: 'column', gap: '4px',
            }}>
              <span style={{ ...display(28), lineHeight: 1 }}>{value.toLocaleString()}</span>
              <span style={ui(400, 12, WHITE60)}>{label}</span>
            </div>
          ))}
        </div>

        {/* Top design */}
        {topDesign && (() => {
          const eng = (topDesign.likes_count || 0) + (topDesign.saves_count || 0) + (topDesign.comments_count || 0)
          return (
            <>
              <p style={sectionLabel}>Top Design</p>
              <Link href={`/design/${topDesign.id}`} style={{ textDecoration: 'none', display: 'block', marginBottom: '24px' }}>
                <div style={{ background: PANEL, borderRadius: '16px', border: PANEL_BORDER, overflow: 'hidden', display: 'flex', alignItems: 'center', gap: '14px', padding: '12px' }}>
                  <div style={{ width: '64px', height: '64px', borderRadius: '12px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                    {topDesign.image_url
                      ? <img src={topDesign.image_url} alt={topDesign.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : <div style={{ width: '100%', height: '100%' }} />
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ ...ui(500, 14), margin: '0 0 6px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{topDesign.title}</p>
                    <div style={{ display: 'flex', gap: '14px' }}>
                      <StatPill icon="heart" value={topDesign.likes_count || 0} />
                      <StatPill icon="bookmark" value={topDesign.saves_count || 0} />
                      <StatPill icon="comment" value={topDesign.comments_count || 0} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', flexShrink: 0 }}>
                    <span style={ui(700, 18, ACCENT)}>{eng}</span>
                    <span style={{ ...ui(500, 10, WHITE60), letterSpacing: '0.05em', textTransform: 'uppercase' }}>Engagements</span>
                  </div>
                </div>
              </Link>
            </>
          )
        })()}

        {/* Per-design table */}
        {designs.length > 0 ? (
          <>
            <p style={sectionLabel}>All Designs</p>
            <div style={{ background: PANEL, borderRadius: '16px', border: PANEL_BORDER, overflow: 'hidden' }}>
              {/* Column headers */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 42px 42px 42px', gap: '8px', padding: '10px 14px', borderBottom: ROW_BORDER }}>
                <span style={ui(500, 11, WHITE60)}>Design</span>
                <span style={{ ...ui(500, 11, WHITE60), textAlign: 'center' }}>♥</span>
                <span style={{ ...ui(500, 11, WHITE60), textAlign: 'center' }}>⊹</span>
                <span style={{ ...ui(500, 11, WHITE60), textAlign: 'center' }}>✦</span>
              </div>
              {byEngagement.map((d, i) => (
                <Link key={d.id} href={`/design/${d.id}`} style={{ textDecoration: 'none', display: 'grid', gridTemplateColumns: '1fr 42px 42px 42px', gap: '8px', alignItems: 'center', padding: '12px 14px', borderBottom: i < byEngagement.length - 1 ? ROW_BORDER : 'none' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.06)', flexShrink: 0 }}>
                      {d.image_url
                        ? <img src={d.image_url} alt={d.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%' }} />
                      }
                    </div>
                    <p style={{ ...ui(500, 13), margin: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{d.title}</p>
                  </div>
                  <span style={{ ...ui(500, 13), textAlign: 'center' }}>{(d.likes_count || 0).toLocaleString()}</span>
                  <span style={{ ...ui(500, 13), textAlign: 'center' }}>{(d.saves_count || 0).toLocaleString()}</span>
                  <span style={{ ...ui(500, 13), textAlign: 'center' }}>{(d.comments_count || 0).toLocaleString()}</span>
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
          <div style={{ background: PANEL, borderRadius: '16px', border: PANEL_BORDER, padding: '32px', textAlign: 'center' }}>
            <p style={ui(300, 14, WHITE60)}>No published designs yet</p>
          </div>
        )}
      </div>
    </Shell>
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
      <svg width="11" height="11" viewBox="0 0 24 24" style={{ color: 'rgba(255,255,255,0.6)', flexShrink: 0 }}>
        {icons[icon]}
      </svg>
      <span style={ui(400, 12, WHITE60)}>{value.toLocaleString()}</span>
    </div>
  )
}

function LegendItem({ symbol, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
      <span style={ui(400, 11, WHITE60)}>{symbol}</span>
      <span style={ui(400, 11, WHITE60)}>{label}</span>
    </div>
  )
}
