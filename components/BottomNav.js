'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { HomeIcon, SearchIcon, MagicStarIcon, MessageIcon, HeartIcon, UserIcon } from '@/components/ui/icons'

// Redesigned floating pill nav (Figma 280:7207): active tab is a gradient
// pill with icon + label, other tabs are icon-only. Order and the new
// Saved tab come from the redesign frames.
const tabs = [
  { href: '/feed', label: 'Home', Icon: HomeIcon },
  { href: '/search', label: 'Search', Icon: SearchIcon },
  { href: '/nail-lab', label: 'Lab', Icon: MagicStarIcon },
  { href: '/messages', label: 'Messages', Icon: MessageIcon },
  { href: '/saved', label: 'Saved', Icon: HeartIcon },
  { href: '/profile', label: 'Profile', Icon: UserIcon },
]

export default function BottomNav() {
  const pathname = usePathname()
  const [unreadMessages, setUnreadMessages] = useState(0)

  useEffect(() => {
    const fetchUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: convs, error: convsError } = await supabase
        .from('conversations')
        .select('id')
        .or(`client_id.eq.${user.id},creator_id.eq.${user.id}`)

      // A passive background badge, not primary page content — on failure,
      // log and leave the last-known count as-is rather than resetting to 0
      // (a false "no unread messages" is worse than a stale-but-plausible
      // number). Reruns on every route change anyway, so a transient blip
      // self-heals on the next navigation without needing its own retry.
      if (convsError) { console.error('unread count fetch failed:', convsError); return }
      if (!convs || convs.length === 0) { setUnreadMessages(0); return }

      const convIds = convs.map(c => c.id)
      const { count, error: countError } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convIds)
        .eq('is_read', false)
        .neq('sender_id', user.id)

      if (countError) { console.error('unread count fetch failed:', countError); return }
      setUnreadMessages(count || 0)
    }
    fetchUnread()
  }, [pathname])

  // Hide on full-screen flows
  if (pathname === '/story/new' || pathname === '/onboarding' || pathname?.startsWith('/messages/') || pathname?.startsWith('/admin') || pathname === '/planner' || pathname?.startsWith('/settings/') || pathname?.startsWith('/nail-card/') || pathname === '/help') return null

  return (
    <nav aria-label="Main navigation" style={{
      position: 'fixed',
      bottom: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: '100%',
      maxWidth: '480px',
      padding: '40px 24px calc(12px + env(safe-area-inset-bottom))',
      background: 'linear-gradient(to top, var(--lq-nav-scrim), rgba(32, 5, 11, 0))',
      backdropFilter: 'blur(10px)',
      WebkitBackdropFilter: 'blur(10px)',
      zIndex: 100,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '60px',
        padding: '8px 16px 8px 8px',
        borderRadius: 'var(--lq-radius-pill)',
        background: 'linear-gradient(90deg, rgba(92, 34, 48, 0.35), rgba(209, 94, 122, 0.35))',
      }}>
        {tabs.map(({ href, label, Icon }) => {
          const isActive = pathname === href || (href === '/feed' && pathname === '/')
          const isMessages = href === '/messages'
          const badge = isMessages && unreadMessages > 0 && (
            <span style={{
              position: 'absolute', top: '2px', right: isActive ? '10px' : '2px',
              minWidth: '16px', height: '16px', borderRadius: 'var(--lq-radius-pill)',
              background: 'var(--lq-accent-b)', color: 'var(--lq-white)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '9px', fontWeight: 700, fontFamily: 'var(--lq-font-ui)',
              padding: '0 3px',
            }}>
              {unreadMessages > 9 ? '9+' : unreadMessages}
            </span>
          )
          if (isActive) {
            return (
              <Link
                key={href}
                href={href}
                aria-current="page"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  height: '44px', padding: '12px 20px',
                  borderRadius: 'var(--lq-radius-pill)',
                  background: 'var(--lq-accent-grad)',
                  color: 'var(--lq-white)',
                  textDecoration: 'none',
                  fontFamily: 'var(--lq-font-ui)', fontSize: '14px', fontWeight: 400,
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <Icon size={20} />
                <span>{label}</span>
                {badge}
              </Link>
            )
          }
          return (
            <Link
              key={href}
              href={href}
              aria-label={label}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: '44px', height: '44px',
                color: 'var(--lq-white-80)',
                textDecoration: 'none',
                position: 'relative',
                flexShrink: 0,
              }}
            >
              <Icon size={20} />
              {badge}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
