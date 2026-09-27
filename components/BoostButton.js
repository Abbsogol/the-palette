'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

const BOOST_OPTIONS = [
  { days: 1,  price: 15,  label: '1 day',   sub: 'Quick visibility boost'   },
  { days: 3,  price: 35,  label: '3 days',  sub: 'Best for new designs'      },
  { days: 7,  price: 70,  label: '7 days',  sub: 'Maximum reach & exposure'  },
]

function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function BoostButton({ designId, creatorId, boostedUntil }) {
  const [userId, setUserId] = useState(null)
  useEffect(() => {
    let active = true, changed = false
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      changed = true
      if (active) setUserId(session?.user?.id || null)
    })
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (active && !changed) setUserId(session?.user?.id || null)
    }).catch(() => { if (active && !changed) setUserId(null) })
    return () => { active = false; subscription.unsubscribe() }
  }, [])
  if (!userId || userId !== creatorId) return null
  return <OwnedBoost key={`${userId}:${designId}`} designId={designId} creatorId={creatorId} boostedUntil={boostedUntil} />
}

function OwnedBoost({ designId, creatorId, boostedUntil }) {
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)
  const [refundStatus, setRefundStatus] = useState('none')
  const requestState = useRef({ active: false, pending: false })

  const isActive = boostedUntil && new Date(boostedUntil) > new Date()

  useEffect(() => {
    let cancelled = false
    const state = requestState.current
    state.active = true
    const load = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (cancelled || session?.user?.id !== creatorId) return
        const response = await fetch(`/api/boost-checkout-status?designId=${encodeURIComponent(designId)}`, {
          headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store',
        })
        const result = await response.json()
        if (!cancelled) setRefundStatus(response.ok ? result.status : 'unavailable')
      } catch { if (!cancelled) setRefundStatus('unavailable') }
    }
    load()
    return () => { cancelled = true; state.active = false }
  }, [creatorId, designId])

  const handleBoost = async () => {
    const state = requestState.current
    if (!selected || state.pending || !state.active) return
    state.pending = true
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!state.active) return
      if (session?.user?.id !== creatorId) throw new Error('Your account changed')
      const res = await fetch('/api/create-boost-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ designId, days: selected.days, price: selected.price }),
      })
      const data = await res.json()
      if (!state.active) return
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!state.active || currentSession?.user?.id !== creatorId) return
      if (data.url) window.location.href = data.url
      else alert(data.error || 'Something went wrong')
    } catch { if (state.active) alert('Something went wrong') }
    finally { if (state.active) { state.pending = false; setLoading(false) } }
  }

  return (
    <>
      {/* Boost button */}
      <button
        onClick={() => setModalOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          background: isActive ? 'rgba(212,160,192,0.15)' : 'var(--bg-chip)',
          border: isActive ? '0.5px solid rgba(212,160,192,0.4)' : '0.5px solid var(--border)',
          borderRadius: '20px', padding: '7px 14px',
          color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
          fontSize: '13px', fontWeight: '500',
          fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
          <polyline points="16 7 22 7 22 13"/>
        </svg>
        {isActive ? `Boosted · ${fmtDate(boostedUntil)}` : '✦ Boost'}
      </button>
      {refundStatus !== 'none' && (
        <p role="status" style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
          {{
            payment_review: 'A boost refund needs attention. Please contact support.',
            refund_pending: 'A boost refund is still being processed.',
            refund_recorded: 'A refund is recorded for a boost purchase.',
            unavailable: 'Refund status could not be checked. Refresh to try again.',
          }[refundStatus]}
        </p>
      )}

      {/* Modal */}
      {modalOpen && (
        <div
          onClick={e => e.target === e.currentTarget && setModalOpen(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 300,
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div style={{
            background: 'var(--bg-card)', borderRadius: '20px 20px 0 0',
            padding: '24px 20px 44px', width: '100%', maxWidth: '480px',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.4)',
          }}>
            <div style={{ width: '36px', height: '4px', background: 'var(--border)', borderRadius: '4px', margin: '0 auto 20px' }} />

            <h2 style={{ color: 'var(--text-primary)', fontSize: '18px', fontWeight: '600', margin: '0 0 6px' }}>Boost this design</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: '1.6', margin: '0 0 20px' }}>
              Your design will appear at the top of the feed in a ✦ Promoted section, visible to all users.
            </p>

            {isActive && (
              <div style={{ background: 'rgba(212,160,192,0.1)', border: '0.5px solid rgba(212,160,192,0.3)', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px' }}>
                <p style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '500', margin: 0 }}>
                  ✦ Currently boosted until {fmtDate(boostedUntil)}. Purchasing again will extend your boost from now.
                </p>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {BOOST_OPTIONS.map(opt => (
                <button
                  key={opt.days}
                  onClick={() => setSelected(opt)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '14px 16px',
                    background: selected?.days === opt.days ? 'rgba(212,160,192,0.12)' : 'var(--bg-primary)',
                    border: selected?.days === opt.days ? '1.5px solid var(--accent)' : '0.5px solid var(--border)',
                    borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  <div>
                    <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', margin: '0 0 2px' }}>{opt.label}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>{opt.sub}</p>
                  </div>
                  <span style={{ color: selected?.days === opt.days ? 'var(--accent)' : 'var(--text-primary)', fontSize: '16px', fontWeight: '600' }}>
                    AED {opt.price}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={handleBoost}
              disabled={!selected || loading}
              style={{
                width: '100%', padding: '14px',
                background: selected ? 'var(--accent)' : 'var(--bg-chip)',
                color: selected ? '#2C0A1E' : 'var(--text-secondary)',
                border: 'none', borderRadius: '14px',
                fontSize: '15px', fontWeight: '600',
                fontFamily: "'DM Sans', sans-serif",
                cursor: selected && !loading ? 'pointer' : 'not-allowed',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Redirecting to payment…' : selected ? `Boost for AED ${selected.price} →` : 'Select a duration'}
            </button>
          </div>
        </div>
      )}
    </>
  )
}
