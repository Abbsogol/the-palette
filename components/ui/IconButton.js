'use client'
import Link from 'next/link'

// Icon-only button/link. Hit area is always >=44px even when the visible
// circle is smaller (the design draws 32-34px circles).
export default function IconButton({
  label,          // required accessible name
  href,
  onClick,
  children,
  variant = 'glass',   // 'glass' | 'plain'
  visualSize = 34,
  badge = null,
}) {
  const circle = {
    width: `${visualSize}px`,
    height: `${visualSize}px`,
    borderRadius: 'var(--lq-radius-pill)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'var(--lq-white)',
    background: variant === 'glass' ? 'var(--lq-glass)' : 'transparent',
    border: variant === 'glass' ? '1px solid var(--lq-glass-border)' : 'none',
    position: 'relative',
  }
  const hit = {
    minWidth: '44px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    textDecoration: 'none',
  }
  const inner = (
    <span style={circle}>
      {children}
      {badge}
    </span>
  )
  if (href) {
    return <Link href={href} aria-label={label} style={hit}>{inner}</Link>
  }
  return <button type="button" onClick={onClick} aria-label={label} style={hit}>{inner}</button>
}
