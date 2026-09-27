'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import Sheet from '@/components/ui/Sheet'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

const BOOST_OPTIONS = [
  { days: 1,  price: 15,  label: '1 day',   sub: 'Quick visibility boost'   },
  { days: 3,  price: 35,  label: '3 days',  sub: 'Best for new designs'      },
  { days: 7,  price: 70,  label: '7 days',  sub: 'Maximum reach & exposure'  },
]

function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export default function BoostButton({ designId, creatorId, boostedUntil, renderTrigger }) {
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

  if (!renderTrigger && !show) return null

  const handleBoost = async () => {
    if (!selected || loading) return
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-boost-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ designId, days: selected.days, price: selected.price }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else { alert(data.error || 'Something went wrong'); setLoading(false) }
    } catch { alert('Something went wrong'); setLoading(false) }
  }

  return (
    <>
      {renderTrigger ? renderTrigger({ open: () => setModalOpen(true), isActive }) : (
      /* Boost button */
      <button
        onClick={() => setModalOpen(true)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          background: isActive ? 'rgba(255,81,127,0.15)' : PANEL,
          border: isActive ? '1px solid rgba(255,81,127,0.4)' : PANEL_BORDER,
          borderRadius: '1000px', padding: '7px 14px',
          ...ui(500, 13, isActive ? ACCENT : WHITE60), cursor: 'pointer',
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
          <polyline points="16 7 22 7 22 13"/>
        </svg>
        {isActive ? `Boosted · ${fmtDate(boostedUntil)}` : '✦ Boost'}
      </button>
      )}

      {/* Sheet */}
      {modalOpen && (
        <Sheet
          title="Boost this design"
          onClose={() => setModalOpen(false)}
          footer={
            <button
              onClick={handleBoost}
              disabled={!selected || loading}
              style={{
                width: '100%', padding: '14px',
                background: selected ? BTN_GRADIENT : 'rgba(255,255,255,0.08)',
                ...ui(600, 15, selected ? 'var(--lq-white)' : WHITE60),
                border: 'none', borderRadius: '1000px',
                cursor: selected && !loading ? 'pointer' : 'not-allowed', opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? 'Redirecting to payment…' : selected ? `Boost for AED ${selected.price} →` : 'Select a duration'}
            </button>
          }
        >
          <h2 style={{ ...display(22), margin: '0 0 6px' }}>Boost this design</h2>
          <p style={{ ...ui(300, 13, WHITE60), lineHeight: 1.6, margin: '0 0 20px' }}>
            Your design will appear at the top of the feed in a ✦ Promoted section, visible to all users.
          </p>

          {isActive && (
            <div style={{ background: 'rgba(255,81,127,0.1)', border: '1px solid rgba(255,81,127,0.3)', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ ...ui(500, 13, ACCENT), margin: 0 }}>
                ✦ Currently boosted until {fmtDate(boostedUntil)}. Purchasing again will extend your boost from now.
              </p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {BOOST_OPTIONS.map(opt => (
              <button
                key={opt.days}
                onClick={() => setSelected(opt)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px',
                  background: selected?.days === opt.days ? 'rgba(255,81,127,0.12)' : 'rgba(255,255,255,0.04)',
                  border: selected?.days === opt.days ? `1.5px solid ${ACCENT}` : PANEL_BORDER,
                  borderRadius: '14px', cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div>
                  <p style={{ ...ui(600, 15), margin: '0 0 2px' }}>{opt.label}</p>
                  <p style={{ ...ui(300, 12, WHITE60), margin: 0 }}>{opt.sub}</p>
                </div>
                <span style={ui(600, 16, selected?.days === opt.days ? ACCENT : 'var(--lq-white)')}>
                  AED {opt.price}
                </span>
              </button>
            ))}
          </div>
        </Sheet>
      )}
    </>
  )
}
