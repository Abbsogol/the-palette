'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import NailTechCard from './NailTechCard'
import BoostButton from './BoostButton'

// The design page's primary action area. One primary action, always:
//  - visitor + creator has services → "Book this look" (booking wins, per
//    Sogol's call — the frame drew Show My Nail Tech as the main CTA but
//    never had Book on the page; logged divergence);
//  - owner viewing their own design → "Boost this design";
//  - otherwise → "Show my nail tech" takes the primary treatment (no hole).
// Show my nail tech is the secondary whenever it isn't the primary.
// Booking/boost logic itself is untouched — this only chooses which trigger
// gets the primary chrome, gated by viewer identity (which the server page
// can't know). While the session resolves it assumes visitor (the common
// case); an owner briefly sees Book before it swaps to Boost on their own
// design only.

const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const primaryStyle = {
  width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  background: BTN_GRADIENT, color: 'var(--lq-white)', border: 'none',
  borderRadius: '1000px', padding: '15px 20px', minHeight: '52px',
  fontFamily: 'var(--lq-font-ui)', fontWeight: 500, fontSize: '15px',
  textDecoration: 'none', cursor: 'pointer',
}
const secondaryStyle = {
  width: '100%', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
  background: 'rgba(255,255,255,0.08)', color: 'var(--lq-white)',
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '1000px', padding: '14px 20px', minHeight: '50px',
  fontFamily: 'var(--lq-font-ui)', fontWeight: 500, fontSize: '15px',
  textDecoration: 'none', cursor: 'pointer',
}

const CalendarIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const TechIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/>
  </svg>
)

export default function DesignPrimaryActions({ design, creatorId, creatorHasServices, boostedUntil, colours }) {
  const [isOwner, setIsOwner] = useState(false)
  useEffect(() => {
    if (!creatorId) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsOwner(session?.user?.id === creatorId)
    })
  }, [creatorId])

  const showBook = creatorHasServices && !isOwner
  const showBoost = isOwner
  const techIsPrimary = !showBook && !showBoost

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
      {showBook && (
        <Link href={`/book/${creatorId}?designId=${design.id}`} style={primaryStyle}>
          <CalendarIcon /> Book this look
        </Link>
      )}
      {showBoost && (
        <BoostButton
          designId={design.id} creatorId={creatorId} boostedUntil={boostedUntil}
          renderTrigger={({ open, isActive }) => (
            <button onClick={open} style={primaryStyle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>
              </svg>
              {isActive ? 'Extend boost' : 'Boost this design'}
            </button>
          )}
        />
      )}
      <NailTechCard
        design={design} colours={colours}
        renderTrigger={({ open }) => (
          <button onClick={open} style={techIsPrimary ? primaryStyle : secondaryStyle}>
            <TechIcon /> Show my nail tech
          </button>
        )}
      />
    </div>
  )
}
