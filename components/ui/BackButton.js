'use client'
import { useRouter } from 'next/navigation'
import { canGoBack } from '@/lib/navHistory'

// THE back control (navigation round, 2026-09-08): real in-app history when
// it exists, the page's declared fallback when it doesn't (deep link, fresh
// tab, external referrer). Never a hardcoded route while history exists.
export default function BackButton({ fallback, label = 'Back', children, style }) {
  const router = useRouter()
  const go = () => {
    if (canGoBack()) router.back()
    else router.replace(fallback)
  }
  return (
    <button
      onClick={go}
      aria-label={label}
      style={{
        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
        borderRadius: '1000px', padding: '8px', minWidth: '36px', minHeight: '36px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--lq-white)', cursor: 'pointer',
        ...style,
      }}
    >
      {children || (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 12H5M12 5l-7 7 7 7"/>
        </svg>
      )}
    </button>
  )
}
