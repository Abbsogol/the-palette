'use client'

import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import Link from 'next/link'

function SuccessContent() {
  const params = useSearchParams()
  const plan = params.get('plan')

  const isPro = plan === 'pro_creator'

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 24px', textAlign: 'center' }}>
      {/* Success icon */}
      <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'rgba(212,160,192,0.15)', border: '1.5px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
        <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
          <path d="M8 16l5 5 11-10" stroke="var(--accent)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h1 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '700', margin: '0 0 10px' }}>
        Welcome to {isPro ? 'Pro Creator' : 'Laque Premium'} ✦
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.6', margin: '0 0 36px', maxWidth: '300px' }}>
        {isPro
          ? 'Your Pro Creator subscription is now active. Start accepting bookings and publishing your designs.'
          : 'Your Premium subscription is now active. Enjoy exclusive designs and credits every month.'}
      </p>

      <Link
        href="/profile"
        style={{ background: 'var(--accent)', color: '#2C0A1E', textDecoration: 'none', borderRadius: '14px', padding: '14px 32px', fontSize: '15px', fontWeight: '700', display: 'inline-block' }}
      >
        Go to my profile
      </Link>
    </div>
  )
}

export default function UpgradeSuccessPage() {
  return (
    <Suspense>
      <SuccessContent />
    </Suspense>
  )
}
