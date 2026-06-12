'use client'

import { useRouter } from 'next/navigation'

export default function BackButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => router.back()}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '6px',
        color: 'var(--text-secondary)', background: 'none', border: 'none',
        fontSize: '13px', fontWeight: '500', cursor: 'pointer',
        fontFamily: "'DM Sans', sans-serif", padding: 0,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
      Back
    </button>
  )
}
