'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

const timeAgo = (iso) => {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (d >= 1) return `${d}d`
  if (h >= 1) return `${h}h`
  if (m >= 1) return `${m}m`
  return 'now'
}

const notifText = (n) => {
  const name = n.actor?.display_name || 'Someone'
  if (n.type === 'follow')              return `${name} followed you`
  if (n.type === 'like')                return `${name} liked your design`
  if (n.type === 'comment')             return n.comment_preview
    ? `${name} commented: "${n.comment_preview}"`
    : `${name} commented on your design`
  if (n.type === 'booking_request')     return `${name} sent you a booking request`
  if (n.type === 'booking_confirmed')   return `${name} confirmed your appointment`
  if (n.type === 'booking_declined')    return `${name} declined your booking request`
  return ''
}

const notifHref = (n) => {
  if (n.type === 'follow')                                    return `/creator/${n.actor_id}`
  if (n.type === 'booking_request')                           return `/bookings`
  if (n.type === 'booking_confirmed' || n.type === 'booking_declined') return `/appointments`
  if (n.design_id)                                            return `/design/${n.design_id}`
  return '#'
}

export default function NotificationsPage() {
  const router = useRouter()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/profile'); return }

      const { data } = await supabase
        .from('notifications')
        .select('*, actor:profiles!notifications_actor_id_fkey(id, display_name, avatar_url)')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50)

      setNotifications(data || [])
      setLoading(false)

      // Mark all as read
      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', session.user.id)
        .eq('read', false)
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
        <h1 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600', margin: 0 }}>Notifications</h1>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
        </div>
      ) : notifications.length === 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-card)', border: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/>
            </svg>
          </div>
          <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '6px' }}>No notifications yet</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>When someone follows, likes, or comments, you'll see it here.</p>
        </div>
      ) : (
        <div>
          {notifications.map(n => {
            const actor = n.actor
            const unread = !n.read
            return (
              <Link
                key={n.id}
                href={notifHref(n)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 20px', borderBottom: '0.5px solid var(--border)',
                  textDecoration: 'none',
                  background: unread ? 'rgba(212,160,192,0.06)' : 'transparent',
                }}
              >
                {/* Actor avatar */}
                <div style={{
                  width: '44px', height: '44px', borderRadius: '50%',
                  background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '0.5px solid var(--border)', position: 'relative',
                }}>
                  {actor?.avatar_url
                    ? <img src={actor.avatar_url} alt={actor.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: '500' }}>
                        {(actor?.display_name || '?')[0].toUpperCase()}
                      </span>
                  }
                  {/* Type icon badge */}
                  <div style={{
                    position: 'absolute', bottom: -2, right: -2,
                    width: '18px', height: '18px', borderRadius: '50%',
                    background: 'var(--accent)', border: '2px solid var(--bg-primary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {n.type === 'follow' && (
                      <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                        <path d="M8 2v12M2 8h12" stroke="#2C0A1E" strokeWidth="2.5" strokeLinecap="round"/>
                      </svg>
                    )}
                    {n.type === 'like' && (
                      <svg width="9" height="9" viewBox="0 0 16 16" fill="#2C0A1E">
                        <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.5 3 2 5 2C6.2 2 7.2 2.6 8 3.5C8.8 2.6 9.8 2 11 2C13 2 14.5 3.5 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z"/>
                      </svg>
                    )}
                    {n.type === 'comment' && (
                      <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
                        <path d="M14 10a1 1 0 01-1 1H5l-3 3V3a1 1 0 011-1h10a1 1 0 011 1v7z" fill="#2C0A1E"/>
                      </svg>
                    )}
                  </div>
                </div>

                {/* Text */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    color: 'var(--text-primary)', fontSize: '13px',
                    lineHeight: '1.5', margin: 0,
                    overflow: 'hidden', display: '-webkit-box',
                    WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
                  }}>
                    {notifText(n)}
                  </p>
                </div>

                {/* Time + unread dot */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{timeAgo(n.created_at)}</span>
                  {unread && (
                    <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: 'var(--accent)' }} />
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
