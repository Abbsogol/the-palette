'use client'

import { useState, useEffect } from 'react'
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
  const [show, setShow] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState(null)

  const isActive = boostedUntil && new Date(boostedUntil) > new Date()

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.id === creatorId) setShow(true)
    })
  }, [creatorId])

  if (!show) return null

  const handleBoost = async () => {
    if (!selected || loading) return
    setLoading(true)
    try {
      const res = await fetch('/api/create-boost-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ designId, creatorId, days: selected.days, price: selected.price }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else { alert(data.error || 'Something went wrong'); setLoading(false) }
    } catch { alert('Something went wrong'); setLoading(false) }
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
