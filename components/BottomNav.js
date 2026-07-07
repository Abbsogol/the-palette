'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const tabs = [
  {
    href: '/feed',
    label: 'Home',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    href: '/search',
    label: 'Search',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    href: '/nail-lab',
    label: 'Lab',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 3h6M10 3v6l-4 8a1 1 0 00.9 1.5h10.2a1 1 0 00.9-1.5L14 9V3" />
        <line x1="6.5" y1="14" x2="17.5" y2="14" />
      </svg>
    ),
  },
  {
    href: '/messages',
    label: 'Messages',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" fill={active ? 'currentColor' : 'none'} />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profile',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    ),
  },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    const fetchUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: convs } = await supabase
        .from('conversations')
        .select('id')
        .or(`client_id.eq.${user.id},creator_id.eq.${user.id}`)

      if (!convs || convs.length === 0) return

      const convIds = convs.map(c => c.id)
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .eq('is_read', false)
        .neq('sender_id', user.id)

      setUnreadMessages(count || 0)
    }
    fetchUnread()
  }, [pathname])

  // Hide on full-screen flows
  if (pathname === '/story/new' || pathname === '/onboarding' || pathname?.startsWith('/messages/') || pathname?.startsWith('/admin') || pathname === '/planner') return null

  return (
    <nav style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: '480px',
      backgroundColor: 'var(--bg-primary)',
      borderTop: '0.5px solid var(--border)',
      display: 'flex',
      justifyContent: 'space-around',
      alignItems: 'center',
      padding: '10px 0 24px',
      zIndex: 100,
    }}>
      {tabs.map((tab) => {
        const isActive = pathname === tab.href || (tab.href === '/feed' && pathname === '/')
        const isMessages = tab.href === '/messages'
        return (
          <Link
            key={tab.href}
            href={tab.href}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              textDecoration: 'none',
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              fontSize: '10px',
              fontFamily: "'DM Sans', sans-serif",
              fontWeight: '500',
              letterSpacing: '0.02em',
              minWidth: '48px',
              position: 'relative',
            }}
          >
            {tab.icon(isActive)}
            {isMessages && unreadMessages > 0 && (
              <div style={{
                position: 'absolute', top: '-2px', right: '4px',
                width: '16px', height: '16px', borderRadius: '50%',
                background: 'var(--accent)', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <span style={{ color: '#2C0A1E', fontSize: '9px', fontWeight: '700' }}>
                  {unreadMessages > 9 ? '9+' : unreadMessages}
                </span>
              </div>
            )}
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
