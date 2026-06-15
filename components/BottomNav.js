'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

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
    href: '/saved',
    label: 'Saved',
    icon: (active) => (
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
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

  // Hide on full-screen flows
  if (pathname === '/story/new' || pathname === '/onboarding') return null

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
            }}
          >
            {tab.icon(isActive)}
            <span>{tab.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
