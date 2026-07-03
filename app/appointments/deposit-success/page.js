'use client'

import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Suspense } from 'react'

function DepositSuccessContent() {
  const params = useSearchParams()
  const bookingId = params.get('booking')

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg-primary)',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 24px',
      textAlign: 'center',
    }}>

      {/* Icon */}
      <div style={{
        width: '72px', height: '72px', borderRadius: '50%',
        background: 'rgba(100,200,130,0.12)',
        border: '1px solid rgba(100,200,130,0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: '24px',
      }}>
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <path d="M5 13L9 17L19 7" stroke="#6CC882" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '600', margin: '0 0 10px', letterSpacing: '-0.02em' }}>
        Deposit paid ✦
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', margin: '0 0 36px', maxWidth: '280px' }}>
        Your deposit has been received. Your appointment is confirmed — see you soon!
      </p>

      <Link
        href="/appointments"
        style={{
          background: 'var(--accent)', color: '#2C0A1E',
          borderRadius: '14px', padding: '13px 32px',
          fontSize: '15px', fontWeight: '600',
          textDecoration: 'none', display: 'inline-block',
        }}
      >
        View my appointments
      </Link>
    </div>
  )
}

export default function DepositSuccessPage() {
  return (
    <Suspense>
      <DepositSuccessContent />
    </Suspense>
  )
}
