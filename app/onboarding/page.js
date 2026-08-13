'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'

// ── Option lists ────────────────────────────────────────────────────────────
const SHAPES      = ['Almond','Square','Coffin','Round','Oval','Stiletto','Squoval','Ballerina']
const LENGTHS     = ['Short','Medium','Long','Extra Long']
const COLORS      = ['Pink','Red','Nude','White','Black','Purple','Blue','Green','Yellow','Orange','Glitter','Chrome','Multicolor']
const FINISHES    = ['Glossy','Matte','Chrome','Glitter','Jelly','Pearl','Cat-eye','Velvet','Satin','Mirror']
const TECHNIQUES  = ['French','Ombré','BIAB','Gel-X','Airbrush','3D','Aura','Chrome','Cat-eye','Marble','Nail art']
const OCCASIONS   = ['Everyday','Bridal','Party','Work','Vacation','Eid','Birthday','Holiday','Christmas','Summer','Winter']
const BUDGETS     = ['Under $50','$50–$100','$100–$150','$150+']
const SENSITIVITIES = ['Acrylic','Gel','Acetone','Glue','BIAB','Primer','UV light']
const SPECIALTIES = ['BIAB','Gel-X','French','Chrome','3D','Bridal','Airbrush','Minimal','Cat-eye','Marble','Aura','Ombré','Nail art','Gel polish','Acrylic']

// ── Step sequences per account type ────────────────────────────────────────
const USER_STEPS    = ['welcome','basics','style','health','credits','action','done']
const CREATOR_STEPS = ['welcome','basics','specialties','credits','action','done']
const SALON_STEPS   = ['welcome','basics','credits','done']

// ── Shared styles ───────────────────────────────────────────────────────────
const inp = {
  background: 'var(--bg-card)',
  border: '0.5px solid var(--border)',
  borderRadius: '12px',
  padding: '14px 16px',
  color: 'var(--text-primary)',
  fontSize: '14px',
  fontFamily: "'DM Sans', sans-serif",
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}
const chip = (active) => ({
  background: active ? 'var(--accent)' : 'var(--bg-chip)',
  color: active ? '#2C0A1E' : 'var(--text-secondary)',
  border: active ? 'none' : '0.5px solid var(--border)',
  borderRadius: '20px',
  padding: '7px 14px',
  fontSize: '13px',
  fontFamily: "'DM Sans', sans-serif",
  fontWeight: active ? '500' : '400',
  cursor: 'pointer',
})
const label = {
  color: 'var(--text-secondary)',
  fontSize: '11px',
  fontWeight: '500',
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  marginBottom: '10px',
  display: 'block',
}

function OnboardingInner() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [stepIdx, setStepIdx] = useState(0)
  const [saving, setSaving]   = useState(false)

  const [referralCode, setReferralCode] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const [d, setD] = useState({
    display_name: '',
    phone_number: '',
    location: '',
    bio: '',
    nail_shape: null,
    nail_length: null,
    nail_colors: [],
    nail_finishes: [],
    nail_techniques: [],
    occasions: [],
    budget_range: null,
    allergies: '',
    product_sensitivities: [],
    removal_needed: false,
    specialties: [],
  })

  useEffect(() => {
    // Pre-fill referral code from ?ref= param
    const ref = searchParams.get('ref')
    if (ref) setReferralCode(ref.toUpperCase().trim())

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) {
        router.push(ref ? `/profile?ref=${encodeURIComponent(ref)}` : '/profile')
        return
      }
      init(session.user)
    })
  }, [])

  const init = async (u) => {
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    if (!prof) { router.push('/profile'); return }
    // Already completed onboarding → go to feed
    if (prof.onboarding_complete === true) { router.push('/feed'); return }
    setProfile(prof)
    setD(prev => ({
      ...prev,
      display_name:         prof.display_name          || '',
      phone_number:         prof.phone_number           || '',
      location:             prof.location               || '',
      bio:                  prof.bio                    || '',
      nail_shape:           prof.nail_shape             || null,
      nail_length:          prof.nail_length            || null,
      nail_colors:          prof.nail_colors            || [],
      nail_finishes:        prof.nail_finishes          || [],
      nail_techniques:      prof.nail_techniques        || [],
      occasions:            prof.occasions              || [],
      budget_range:         prof.budget_range           || null,
      allergies:            prof.allergies              || '',
      product_sensitivities: prof.product_sensitivities || [],
      removal_needed:       prof.removal_needed         || false,
      specialties:          prof.specialties            || [],
    }))
    setLoading(false)
  }

  const accountType = profile?.account_type || 'user'
  const steps   = accountType === 'creator' ? CREATOR_STEPS : accountType === 'salon' ? SALON_STEPS : USER_STEPS
  const current = steps[stepIdx]

  // Don't count welcome/done in the progress denominator
  const innerSteps = steps.filter(s => s !== 'welcome' && s !== 'done')
  const innerIdx   = innerSteps.indexOf(current)
  const progress   = innerIdx >= 0 ? ((innerIdx + 1) / innerSteps.length) * 100 : innerIdx === -1 && current === 'done' ? 100 : 0

  const next = () => setStepIdx(i => Math.min(i + 1, steps.length - 1))
  const back = () => setStepIdx(i => Math.max(i - 1, 0))

  const set1  = (field, val) => setD(p => ({ ...p, [field]: p[field] === val ? null : val }))
  const setN  = (field, val) => setD(p => ({ ...p, [field]: (p[field]||[]).includes(val) ? p[field].filter(v=>v!==val) : [...(p[field]||[]),val] }))

  const complete = async (redirectTo = '/feed') => {
    setSaving(true)
    setErrorMsg('')

    const { data: { session } } = await supabase.auth.getSession()
    let res
    try {
      res = await fetch('/api/complete-onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify(d),
      })
    } catch {
      setSaving(false)
      setErrorMsg('Something went wrong. Please check your connection and try again.')
      return
    }

    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) {
      setSaving(false)
      setErrorMsg(json.error || 'Something went wrong. Please try again.')
      return
    }

    // Apply referral code if provided
    if (referralCode.trim()) {
      fetch('/api/apply-referral', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ code: referralCode.trim() }),
      }).catch(() => {})
    }

    setSaving(false)
    router.push(redirectTo)
  }

  if (loading) return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading...</p>
    </div>
  )

  // ── Step renderer ─────────────────────────────────────────────────────────
  const renderStep = () => {
    switch (current) {

      // ── WELCOME ──────────────────────────────────────────────────────────
      case 'welcome':
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 32px' }}>
            <div style={{ fontSize: '52px', marginBottom: '28px', lineHeight: 1 }}>💅</div>
            <h1 style={{ color: 'var(--text-primary)', fontSize: '28px', fontWeight: '600', letterSpacing: '-0.03em', marginBottom: '14px', lineHeight: '1.2' }}>
              Welcome to Laque{d.display_name ? `, ${d.display_name.split(' ')[0]}` : ''}
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.8', marginBottom: '20px' }}>
              {accountType === 'creator'
                ? "You're joining as a Nail Artist. Let's set up your profile so clients can discover your work."
                : accountType === 'salon'
                ? "You're joining as a Salon. Let's build your page so clients can find and book your team."
                : "Let's personalise your experience so you discover the nail art you actually love."}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', opacity: 0.5 }}>Takes about 2 minutes · You can skip anything</p>
          </div>
        )

      // ── BASICS ───────────────────────────────────────────────────────────
      case 'basics':
        return (
          <div style={{ flex: 1, padding: '0 20px', overflowY: 'auto' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em', marginBottom: '6px' }}>
              {accountType === 'salon' ? 'Your salon details' : 'About you'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
              {accountType === 'salon' ? 'Used on your public salon page and for bookings.' : 'Used for your profile and bookings.'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <p style={label}>{accountType === 'salon' ? 'Salon name' : 'Display name'}</p>
                <input value={d.display_name} onChange={e => setD(p=>({...p,display_name:e.target.value}))}
                  placeholder={accountType === 'salon' ? 'e.g. The Nail Studio' : 'Your name'} style={inp} />
              </div>
              <div>
                <p style={label}>Phone number</p>
                <input value={d.phone_number} onChange={e => setD(p=>({...p,phone_number:e.target.value}))}
                  placeholder="e.g. +971 50 123 4567" style={inp} type="tel" />
              </div>
              <div>
                <p style={label}>{accountType === 'salon' ? 'Salon address / area' : 'City or area'}</p>
                <input value={d.location} onChange={e => setD(p=>({...p,location:e.target.value}))}
                  placeholder={accountType === 'salon' ? 'e.g. Dubai Marina, JBR' : 'e.g. Dubai, Abu Dhabi'} style={inp} />
              </div>
              {(accountType === 'creator' || accountType === 'salon') && (
                <div>
                  <p style={label}>Bio</p>
                  <textarea value={d.bio} onChange={e => setD(p=>({...p,bio:e.target.value}))}
                    placeholder={accountType === 'salon' ? 'Describe your salon, services, and vibe...' : 'Tell clients about your style and experience...'}
                    rows={3} style={{ ...inp, resize: 'none' }} />
                </div>
              )}
              <div>
                <p style={label}>Referral code <span style={{ fontWeight: '400', opacity: 0.6 }}>(optional)</span></p>
                <input
                  value={referralCode}
                  onChange={e => setReferralCode(e.target.value.toUpperCase().trim())}
                  placeholder="e.g. AB12CD34"
                  style={{ ...inp, letterSpacing: '0.08em' }}
                  maxLength={8}
                />
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '6px' }}>
                  Got a code from a friend? Enter it here and you'll both earn Beauty Rewards points.
                </p>
              </div>
            </div>
          </div>
        )

      // ── STYLE DNA ────────────────────────────────────────────────────────
      case 'style':
        return (
          <div style={{ flex: 1, padding: '0 20px', overflowY: 'auto' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em', marginBottom: '6px' }}>Your Style DNA</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
              Personalises your feed, search, and Nail Lab results. All optional — tap to select.
            </p>
            {[
              { label: 'Nail shape',          field: 'nail_shape',      opts: SHAPES,     single: true  },
              { label: 'Nail length',          field: 'nail_length',     opts: LENGTHS,    single: true  },
              { label: 'Favourite colours',    field: 'nail_colors',     opts: COLORS,     single: false },
              { label: 'Favourite finishes',   field: 'nail_finishes',   opts: FINISHES,   single: false },
              { label: 'Favourite techniques', field: 'nail_techniques', opts: TECHNIQUES, single: false },
            ].map(({ label: lbl, field, opts, single }) => (
              <div key={field} style={{ marginBottom: '24px' }}>
                <p style={label}>{lbl}</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {opts.map(opt => {
                    const active = single ? d[field] === opt : (d[field]||[]).includes(opt)
                    return <button key={opt} onClick={() => single ? set1(field,opt) : setN(field,opt)} style={chip(active)}>{opt}</button>
                  })}
                </div>
              </div>
            ))}
          </div>
        )

      // ── HEALTH + OCCASIONS ───────────────────────────────────────────────
      case 'health':
        return (
          <div style={{ flex: 1, padding: '0 20px', overflowY: 'auto' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em', marginBottom: '6px' }}>Occasions + Nail Health</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>Health notes are shared with nail techs when you book — they keep you safe.</p>

            <div style={{ marginBottom: '24px' }}>
              <p style={label}>Occasions</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {OCCASIONS.map(o => <button key={o} onClick={() => setN('occasions',o)} style={chip((d.occasions||[]).includes(o))}>{o}</button>)}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={label}>Budget range</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {BUDGETS.map(b => <button key={b} onClick={() => set1('budget_range',b)} style={chip(d.budget_range===b)}>{b}</button>)}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={label}>Product sensitivities</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '10px', lineHeight: '1.5' }}>Shared with nail techs when you book.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {SENSITIVITIES.map(s => {
                  const active = (d.product_sensitivities||[]).includes(s)
                  return (
                    <button key={s} onClick={() => setN('product_sensitivities',s)}
                      style={{ ...chip(false), background: active ? 'rgba(224,112,112,0.15)' : 'var(--bg-chip)', color: active ? '#E07070' : 'var(--text-secondary)', border: active ? '0.5px solid rgba(224,112,112,0.4)' : '0.5px solid var(--border)' }}>
                      {s}
                    </button>
                  )
                })}
              </div>
            </div>

            <div style={{ marginBottom: '24px' }}>
              <p style={label}>Allergies</p>
              <input value={d.allergies} onChange={e => setD(p=>({...p,allergies:e.target.value}))}
                placeholder='e.g. "Latex allergy"' style={inp} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', borderRadius: '12px', padding: '14px 16px', border: '0.5px solid var(--border)' }}>
              <div>
                <p style={{ color: 'var(--text-primary)', fontSize: '14px', marginBottom: '2px' }}>Removal needed</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>I need removal before a new set</p>
              </div>
              <button onClick={() => setD(p=>({...p,removal_needed:!p.removal_needed}))}
                style={{ width: '44px', height: '26px', borderRadius: '13px', background: d.removal_needed ? 'var(--accent)' : 'var(--bg-chip)', border: '0.5px solid var(--border)', cursor: 'pointer', position: 'relative', flexShrink: 0 }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: d.removal_needed ? '20px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
              </button>
            </div>
          </div>
        )

      // ── SPECIALTIES (creator) ────────────────────────────────────────────
      case 'specialties':
        return (
          <div style={{ flex: 1, padding: '0 20px', overflowY: 'auto' }}>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '600', letterSpacing: '-0.02em', marginBottom: '6px' }}>Your specialties</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '24px', lineHeight: '1.6' }}>
              Clients search by technique. Select everything you offer.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {SPECIALTIES.map(s => {
                const active = (d.specialties||[]).includes(s)
                return <button key={s} onClick={() => setN('specialties',s)} style={chip(active)}>{s}</button>
              })}
            </div>
          </div>
        )

      // ── CREDITS ──────────────────────────────────────────────────────────
      case 'credits': {
        const count = (accountType === 'creator' || accountType === 'salon') ? 5 : 3
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 32px' }}>
            <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(212,160,192,0.12)', border: '1px solid rgba(212,160,192,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '28px' }}>
              <span style={{ fontSize: '34px', lineHeight: 1 }}>✨</span>
            </div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '26px', fontWeight: '600', letterSpacing: '-0.03em', marginBottom: '14px' }}>
              You got {count} free credits
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.8', marginBottom: '28px' }}>
              Use them in <span style={{ color: 'var(--accent)', fontWeight: '500' }}>Nail Lab</span> to generate custom AI nail designs. Each generation uses 1 credit. Buy more any time.
            </p>
            <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '16px 28px', display: 'inline-flex', alignItems: 'center', gap: '14px' }}>
              <span style={{ color: 'var(--accent)', fontSize: '36px', fontWeight: '600', letterSpacing: '-0.03em' }}>{count}</span>
              <div style={{ textAlign: 'left' }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500' }}>Design Credits</p>
                <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>Added to your wallet</p>
              </div>
            </div>
          </div>
        )
      }

      // ── FIRST ACTION ─────────────────────────────────────────────────────
      case 'action':
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 32px' }}>
            <div style={{ fontSize: '52px', marginBottom: '28px', lineHeight: 1 }}>
              {accountType === 'creator' ? '🎨' : '🤍'}
            </div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '600', letterSpacing: '-0.02em', marginBottom: '14px', lineHeight: '1.2' }}>
              {accountType === 'creator' ? 'Post your first design' : 'Save your first look'}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.8', marginBottom: '8px' }}>
              {accountType === 'creator'
                ? "Upload a design from your portfolio. It'll show on your public profile and in the feed."
                : 'Browse the feed and tap the heart on any design to save it to your collection.'}
            </p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', opacity: 0.5, marginTop: '4px' }}>You can always do this later</p>
          </div>
        )

      // ── DONE ─────────────────────────────────────────────────────────────
      case 'done':
        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '0 32px' }}>
            <div style={{ fontSize: '52px', marginBottom: '28px', lineHeight: 1 }}>💅</div>
            <h2 style={{ color: 'var(--text-primary)', fontSize: '26px', fontWeight: '600', letterSpacing: '-0.03em', marginBottom: '14px', lineHeight: '1.2' }}>
              {d.display_name ? `You're all set, ${d.display_name.split(' ')[0]}` : "You're all set"}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '15px', lineHeight: '1.8' }}>
              {accountType === 'creator'
                ? 'Your creator profile is ready. Start posting designs and getting discovered by clients.'
                : accountType === 'salon'
                ? 'Your salon page is set up. Publish designs and let clients find your team.'
                : 'Your feed is personalised. Start exploring, saving looks, and planning your next set.'}
            </p>
          </div>
        )

      default: return null
    }
  }

  // ── Bottom bar buttons ────────────────────────────────────────────────────
  const renderActions = () => {
    if (current === 'done') {
      return (
        <button onClick={() => complete('/feed')} disabled={saving}
          style={{ width: '100%', background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '12px', padding: '16px', fontSize: '15px', fontFamily: "'DM Sans', sans-serif", fontWeight: '600', cursor: 'pointer' }}>
          {saving ? 'Setting up...' : accountType === 'creator' ? 'Go to the feed →' : 'Explore Laque →'}
        </button>
      )
    }

    if (current === 'action') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <button onClick={() => complete(accountType === 'creator' ? '/upload' : '/feed')} disabled={saving}
            style={{ width: '100%', background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '12px', padding: '16px', fontSize: '15px', fontFamily: "'DM Sans', sans-serif", fontWeight: '600', cursor: 'pointer' }}>
            {saving ? 'Setting up...' : accountType === 'creator' ? 'Post a design now →' : 'Browse the feed →'}
          </button>
          <button onClick={() => next()} disabled={saving}
            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', padding: '6px' }}>
            Do this later
          </button>
        </div>
      )
    }

    return (
      <div style={{ display: 'flex', gap: '10px' }}>
        {stepIdx > 0 && (
          <button onClick={back}
            style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px 20px', fontSize: '16px', fontFamily: "'DM Sans', sans-serif", color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0 }}>
            ←
          </button>
        )}
        <button onClick={next}
          style={{ flex: 1, background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontFamily: "'DM Sans', sans-serif", fontWeight: '600', cursor: 'pointer' }}>
          {current === 'welcome' ? "Let's go →" : 'Continue →'}
        </button>
      </div>
    )
  }

  const showProgress = current !== 'welcome' && current !== 'done'
  const showBorder   = current !== 'welcome' && current !== 'done' && current !== 'action' && current !== 'credits'

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-primary)', display: 'flex', flexDirection: 'column', zIndex: 200, maxWidth: '480px', margin: '0 auto' }}>

      {/* Progress bar */}
      {showProgress && (
        <div style={{ height: '3px', background: 'var(--bg-chip)', flexShrink: 0 }}>
          <div style={{ height: '100%', width: `${progress}%`, background: 'var(--accent)', transition: 'width 0.35s ease', borderRadius: '0 2px 2px 0' }} />
        </div>
      )}

      {/* Step counter */}
      {showProgress && (
        <div style={{ padding: '14px 20px 0', flexShrink: 0 }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
            Step {innerIdx + 1} of {innerSteps.length}
          </p>
        </div>
      )}

      {/* Content area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', paddingTop: showProgress ? '20px' : 0 }}>
        {renderStep()}
      </div>

      {/* Bottom action bar */}
      <div style={{
        padding: '16px 20px 44px',
        flexShrink: 0,
        borderTop: showBorder ? '0.5px solid var(--border)' : 'none',
      }}>
        {errorMsg && (
          <p style={{ color: '#E07070', fontSize: '13px', marginBottom: '12px', textAlign: 'center' }}>{errorMsg}</p>
        )}
        {renderActions()}
      </div>

    </div>
  )
}

export default function OnboardingPage() {
  return (
    <Suspense fallback={
      <div style={{ position: 'fixed', inset: 0, background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }}>Loading...</p>
      </div>
    }>
      <OnboardingInner />
    </Suspense>
  )
}
