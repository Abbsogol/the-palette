'use client'
import Link from 'next/link'

const variants = {
  primary: { background: 'var(--lq-accent-grad)', color: 'var(--lq-white)', border: 'none' },
  wine:    { background: 'var(--lq-wine)', color: 'var(--lq-white)', border: 'none' },
  ghost:   { background: 'var(--lq-glass)', color: 'var(--lq-white)', border: '1px solid var(--lq-glass-border)' },
}

export default function PillButton({ children, href, onClick, variant = 'primary', fullWidth = false, style: styleOverride }) {
  const style = {
    ...variants[variant],
    borderRadius: 'var(--lq-radius-pill)',
    padding: '16px 32px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: fullWidth ? '100%' : 'auto',
    fontFamily: 'var(--lq-font-ui)',
    fontSize: '15px',
    fontWeight: 400,
    cursor: 'pointer',
    textDecoration: 'none',
    ...styleOverride,
  }
  if (href) return <Link href={href} style={style}>{children}</Link>
  return <button type="button" onClick={onClick} style={style}>{children}</button>
}
