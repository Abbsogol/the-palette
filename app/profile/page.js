'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import CropModal from '@/components/CropModal'
import IconButton from '@/components/ui/IconButton'
import Sheet from '@/components/ui/Sheet'
import { LaqueWordmark, BellIcon, HeartIcon, MagicStarIcon } from '@/components/ui/icons'

// ── Page palette from the Own Profile frame (257:2444) ─────────────────────
const GROUND = '#260D14'
const PANEL = 'rgba(255, 255, 255, 0.06)'
const PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.10)'
const CHIP_BG = 'rgba(255, 255, 255, 0.08)'
const MUTED = '#A38B95'
const ACCENT = '#FF517F'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 0%, #FF517F 100%)'

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.35,
})

// ── Option lists ───────────────────────────────────────────────────────────
const SHAPES     = ['Almond','Square','Coffin','Round','Oval','Stiletto','Squoval','Ballerina']
const LENGTHS    = ['Short','Medium','Long','Extra Long']
const COLORS     = ['Pink','Red','Nude','White','Black','Purple','Blue','Green','Yellow','Orange','Glitter','Chrome','Multicolor']
const FINISHES   = ['Glossy','Matte','Chrome','Glitter','Jelly','Pearl','Cat-eye','Velvet','Satin','Mirror']
const TECHNIQUES = ['French','Ombré','BIAB','Gel-X','Airbrush','3D','Aura','Chrome','Cat-eye','Marble','Nail art']
const OCCASIONS  = ['Everyday','Bridal','Party','Work','Vacation','Eid','Birthday','Holiday','Christmas','Summer','Winter']
const BUDGETS    = ['Under $50','$50–$100','$100–$150','$150+']
const CONTACTS   = ['App notification','SMS','Email','WhatsApp','Phone call']
const SENSITIVITIES = ['Acrylic','Gel','Acetone','Glue','BIAB','Primer','UV light']
const UNDERTONES    = ['Warm','Cool','Neutral','Olive','Deep Warm','Deep Cool']

// Lenient international format — not UAE-only, since users aren't guaranteed local numbers
const PHONE_RE = /^\+?[\d\s\-()]{7,20}$/
const validatePhone = (val) => {
  const trimmed = val.trim()
  if (!trimmed) return null
  return PHONE_RE.test(trimmed) ? null : 'Enter a valid phone number'
}

// ── Date/time formatting (same rules as /appointments) ─────────────────────
const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
function fmt12(t) {
  if (!t) return ''
  const [h, m] = t.slice(0, 5).split(':').map(Number)
  const ampm = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return `${h12}${m > 0 ? `:${String(m).padStart(2,'0')}` : ''}${ampm}`
}
function fmtDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return `${DAY_NAMES[d.getDay()]} ${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`
}

// ── Profile completion score ───────────────────────────────────────────────
const calcCompletion = (p, u) => {
  if (!p || !u) return 0
  const checks = [
    !!p.display_name,
    !!p.avatar_url,
    !!p.phone_number,
    !!p.location,
    !!p.bio,
    !!p.preferred_contact,
    !!p.nail_shape,
    !!p.nail_length,
    !!(p.nail_colors?.length),
    !!(p.nail_finishes?.length),
    !!(p.nail_techniques?.length),
    !!(p.occasions?.length),
    !!p.budget_range,
    !!(p.allergies || p.product_sensitivities?.length),
    !!p.booking_area,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

// ── Small icons for tiles + menu rows (vuesax-style linear) ────────────────
const GearIcon = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 11-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 110-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33h.01a1.65 1.65 0 001-1.51V3a2 2 0 114 0v.09a1.65 1.65 0 001 1.51h.01a1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v.01a1.65 1.65 0 001.51 1H21a2 2 0 110 4h-.09a1.65 1.65 0 00-1.51 1z"/>
  </svg>
)
const CalendarIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="18" height="18" rx="4"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)
const BookmarkIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
  </svg>
)
const FolderIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/>
  </svg>
)
const LockIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="11" width="16" height="10" rx="3"/><path d="M8 11V7a4 4 0 118 0v4"/>
  </svg>
)
const CardIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="2" y="5" width="20" height="14" rx="3"/><line x1="2" y1="10" x2="22" y2="10"/>
  </svg>
)
const HelpIcon = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
)
const CameraIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 8.5A2.5 2.5 0 015.5 6H7l1.5-2h7L17 6h1.5A2.5 2.5 0 0121 8.5V18a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 18z"/>
    <circle cx="12" cy="13.5" r="3.2"/>
  </svg>
)
const PlusIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)
const ChevronRight = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 6l6 6-6 6"/>
  </svg>
)
const PinIcon = ({ size = 12, fill = 'white' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} aria-hidden="true">
    <path d="M12 2L9 9H2l5.5 4-2 7L12 16l6.5 4-2-7L22 9h-7z"/>
  </svg>
)

// ── Section header with chevron ────────────────────────────────────────────
function SectionHeader({ title, expanded, onToggle, pct }) {
  return (
    <button onClick={onToggle} style={{
      width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 16px', background: 'none', border: 'none', cursor: 'pointer',
      borderBottom: expanded ? PANEL_BORDER : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={ui(500, 14)}>{title}</span>
        {pct !== undefined && (
          <span style={{
            background: pct === 100 ? 'rgba(16,185,129,0.15)' : CHIP_BG,
            color: pct === 100 ? '#10B981' : MUTED,
            fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--lq-radius-pill)',
            fontFamily: 'var(--lq-font-ui)',
          }}>{pct}%</span>
        )}
      </div>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"
        style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
        <path d="M4 6L8 10L12 6" stroke={MUTED} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </button>
  )
}

// ── Inline editable row ────────────────────────────────────────────────────
function EditRow({ label, field, value, placeholder, multiline, onSave, validate }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')

  const start  = () => { setInput(value || ''); setError(''); setEditing(true) }
  const cancel = () => { setEditing(false); setError('') }
  const save   = async () => {
    const validationError = validate?.(input)
    if (validationError) { setError(validationError); return }
    setSaving(true)
    const ok = await onSave(field, input)
    setSaving(false)
    if (ok !== false) setEditing(false)
  }

  return (
    <div style={{ padding: '14px 16px' }}>
      <p style={{ ...ui(500, 11, MUTED), letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>{label}</p>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: multiline ? 'column' : 'row', gap: '8px' }}>
            {multiline ? (
              <textarea value={input} onChange={e => setInput(e.target.value)} autoFocus placeholder={placeholder}
                style={{ width: '100%', background: CHIP_BG, border: PANEL_BORDER, borderRadius: '8px', padding: '8px 12px', color: 'var(--lq-white)', fontSize: '14px', fontFamily: 'var(--lq-font-ui)', outline: 'none', resize: 'none', minHeight: '72px', boxSizing: 'border-box' }} />
            ) : (
              <input value={input} onChange={e => setInput(e.target.value)} autoFocus placeholder={placeholder}
                style={{ flex: 1, minWidth: 0, background: CHIP_BG, border: PANEL_BORDER, borderRadius: '8px', padding: '8px 12px', color: 'var(--lq-white)', fontSize: '14px', fontFamily: 'var(--lq-font-ui)', outline: 'none' }} />
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={save} disabled={saving}
                style={{ background: BTN_GRADIENT, color: 'var(--lq-white)', border: 'none', borderRadius: '8px', padding: '8px 14px', ...ui(500, 13), cursor: 'pointer' }}>
                {saving ? '...' : 'Save'}
              </button>
              <button onClick={cancel} aria-label="Cancel"
                style={{ background: 'none', color: MUTED, border: 'none', fontSize: '13px', fontFamily: 'var(--lq-font-ui)', cursor: 'pointer' }}>✕</button>
            </div>
          </div>
          {error && <p style={{ color: '#E07070', fontSize: '12px', margin: 0 }}>{error}</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <p style={{ ...ui(400, 14, value ? 'var(--lq-white)' : MUTED), lineHeight: 1.5, flex: 1 }}>{value || placeholder || 'Not set'}</p>
          <button onClick={start}
            style={{ background: 'none', border: 'none', color: ACCENT, fontSize: '13px', fontFamily: 'var(--lq-font-ui)', cursor: 'pointer', flexShrink: 0, marginLeft: '8px' }}>Edit</button>
        </div>
      )}
    </div>
  )
}

// ── Username editable row (with format validation + unique error) ──────────
function UsernameRow({ value }) {
  const [editing, setEditing] = useState(false)
  const [input, setInput]     = useState('')
  const [saving, setSaving]   = useState(false)
  const [error, setError]     = useState('')
  const [current, setCurrent] = useState(value || '')

  const USERNAME_RE = /^[a-z0-9_.]{3,30}$/

  const start  = () => { setInput(current || ''); setError(''); setEditing(true) }
  const cancel = () => { setEditing(false); setError('') }

  const save = async () => {
    const val = input.trim().toLowerCase()
    if (!val) { setError('Username cannot be empty'); return }
    if (!USERNAME_RE.test(val)) { setError('3–30 chars, lowercase letters, numbers, _ and . only'); return }
    setSaving(true); setError('')
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/update-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ username: val }),
    })
    const json = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok || json.error) {
      if (json.code === '23505' || json.error?.includes('unique')) setError('Username already taken')
      else setError(json.error || 'Failed to save')
      return
    }
    setCurrent(val); setEditing(false)
  }

  return (
    <div style={{ padding: '14px 16px' }}>
      <p style={{ ...ui(500, 11, MUTED), letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Username</p>
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', background: CHIP_BG, border: PANEL_BORDER, borderRadius: '8px', padding: '8px 12px' }}>
              <span style={{ color: MUTED, fontSize: '14px', marginRight: '2px' }}>@</span>
              <input
                value={input}
                onChange={e => { setInput(e.target.value.toLowerCase()); setError('') }}
                autoFocus
                placeholder="your_username"
                maxLength={30}
                style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', color: 'var(--lq-white)', fontSize: '14px', fontFamily: 'var(--lq-font-ui)', outline: 'none' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={save} disabled={saving}
                style={{ background: BTN_GRADIENT, color: 'var(--lq-white)', border: 'none', borderRadius: '8px', padding: '8px 14px', ...ui(500, 13), cursor: 'pointer' }}>
                {saving ? '...' : 'Save'}
              </button>
              <button onClick={cancel} aria-label="Cancel"
                style={{ background: 'none', color: MUTED, border: 'none', fontSize: '13px', fontFamily: 'var(--lq-font-ui)', cursor: 'pointer' }}>✕</button>
            </div>
          </div>
          {error && <p style={{ color: '#E07070', fontSize: '12px', margin: 0 }}>{error}</p>}
        </div>
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ ...ui(400, 14, current ? 'var(--lq-white)' : MUTED), margin: 0 }}>
            {current ? `@${current}` : 'Not set'}
          </p>
          <button onClick={start}
            style={{ background: 'none', border: 'none', color: ACCENT, fontSize: '13px', fontFamily: 'var(--lq-font-ui)', cursor: 'pointer', flexShrink: 0, marginLeft: '8px' }}>Edit</button>
        </div>
      )}
    </div>
  )
}

// ── Input/chip style helpers ───────────────────────────────────────────────
const inp = { background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '14px 16px', color: 'var(--lq-white)', fontSize: '14px', fontFamily: 'var(--lq-font-ui)', outline: 'none' }
const btn = (active) => ({ background: active ? BTN_GRADIENT : CHIP_BG, color: active ? 'var(--lq-white)' : MUTED, border: active ? 'none' : PANEL_BORDER, borderRadius: 'var(--lq-radius-pill)', padding: '8px 14px', fontSize: '13px', fontFamily: 'var(--lq-font-ui)', fontWeight: active ? '500' : '400', cursor: 'pointer' })
const primaryBtn = { background: BTN_GRADIENT, color: 'var(--lq-white)', border: 'none', borderRadius: 'var(--lq-radius-pill)', padding: '14px', fontSize: '14px', fontFamily: 'var(--lq-font-ui)', fontWeight: '600', cursor: 'pointer' }
const sectionCard = { background: PANEL, border: PANEL_BORDER, borderRadius: '16px', overflow: 'hidden' }
const menuRow = { display: 'flex', alignItems: 'center', gap: '12px', background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '14px 16px', textDecoration: 'none' }

// Shared shell: fixed page ground + optional blurred-avatar underlay, with
// content stacked above it (frame 257:2444: #260D14 + blurred underlay).
function Shell({ avatarUrl, children }) {
  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden style={{
        position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)',
        width: '100%', maxWidth: '480px', zIndex: 0, overflow: 'hidden', background: GROUND,
      }}>
        {avatarUrl && (
          <img src={avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(56px) saturate(0.5)', transform: 'scale(1.3)' }} />
        )}
        <div style={{ position: 'absolute', inset: 0, background: avatarUrl ? 'rgba(38, 13, 20, 0.88)' : 'radial-gradient(120% 60% at 50% 0%, rgba(102,0,7,0.25) 0%, rgba(38,13,20,0) 70%)' }} />
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        {children}
      </div>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ProfilePage() {
  const router = useRouter()
  // Preserve ?ref= from an invite link across the /onboarding -> /profile ->
  // /onboarding signup round-trip (captured once on mount, client-side only).
  const [refCode] = useState(() =>
    typeof window === 'undefined' ? '' : new URLSearchParams(window.location.search).get('ref') || ''
  )
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [managingSubscription, setManagingSubscription] = useState(false)

  // Auth state
  const [mode, setMode]                   = useState('login')
  const [email, setEmail]                 = useState('')
  const [password, setPassword]           = useState('')
  const [displayName, setDisplayName]     = useState('')
  const [chosenType, setChosenType]       = useState(null)
  const [error, setError]                 = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [marketingConsent, setMarketingConsent] = useState(false)
  const [resetMode, setResetMode]         = useState(false)
  const [newPassword, setNewPassword]     = useState('')
  const [resetDone, setResetDone]         = useState(false)
  const [forgotSent, setForgotSent]       = useState(false)
  const [needsAccountType, setNeedsAccountType] = useState(false)

  // Avatar
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [cropFile, setCropFile]               = useState(null)

  // Counts
  const [savedCount, setSavedCount]       = useState(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  const [favouritesCount, setFavouritesCount] = useState(0)
  const [collectionsCount, setCollectionsCount] = useState(0)
  const [upcomingCount, setUpcomingCount] = useState(0)
  const [nextAppointment, setNextAppointment] = useState(null)
  const [myDesigns, setMyDesigns]         = useState([])

  // Tabs: My Designs / Saved / Collections (saved + collections lazy-load)
  const [activeTab, setActiveTab] = useState(null)
  const [savedDesigns, setSavedDesigns] = useState([])
  const [boards, setBoards] = useState([])
  const [boardCounts, setBoardCounts] = useState({})
  const savedLoadedRef = useRef(false)
  const boardsLoadedRef = useRef(false)
  const [savedLoading, setSavedLoading] = useState(false)
  const [boardsLoading, setBoardsLoading] = useState(false)

  // Salon posts (Updates)
  const [myPosts, setMyPosts]           = useState([])
  const [postModalOpen, setPostModalOpen] = useState(false)
  const [postText, setPostText]         = useState('')
  const [editingPostId, setEditingPostId] = useState(null)
  const [postSaving, setPostSaving]     = useState(false)

  // Settings sheet + edit mode
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [editOpen, setEditOpen]         = useState(false)

  // Expandable sections
  const [expanded, setExpanded] = useState({})
  const toggle = (key) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }))

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) loadUserData(session.user)
      else setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (_event === 'PASSWORD_RECOVERY') { setResetMode(true); return }
      if (session?.user) loadUserData(session.user)
      else { setUser(null); setProfile(null); setLoading(false) }
    })
    return () => subscription.unsubscribe()
  }, [])

  const loadUserData = async (u) => {
    setUser(u)
    const { data: prof } = await supabase.from('profiles').select('*').eq('id', u.id).single()
    setProfile(prof)
    // New users (onboarding_complete === false explicitly) → send to onboarding
    if (prof?.onboarding_complete === false) {
      router.push(refCode ? `/onboarding?ref=${encodeURIComponent(refCode)}` : '/onboarding')
      return
    }
    if (!prof?.account_type) setNeedsAccountType(true)
    const today = new Date().toISOString().split('T')[0]
    const [
      { count: sc },
      { count: frs },
      { count: fng },
      { count: fav },
      { count: boardCount },
      { data: upcomingRows, count: upc },
    ] = await Promise.all([
      supabase.from('saved_designs').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', u.id),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', u.id),
      supabase.from('favourite_creators').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
      supabase.from('moodboards').select('*', { count: 'exact', head: true }).eq('user_id', u.id),
      supabase.from('bookings')
        .select('id, booking_date, start_time, status, creator_id, service:services(name)', { count: 'exact' })
        .eq('client_id', u.id)
        .in('status', ['pending', 'confirmed'])
        .gte('booking_date', today)
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(1),
    ])
    setSavedCount(sc || 0)
    setFollowerCount(frs || 0)
    setFollowingCount(fng || 0)
    setFavouritesCount(fav || 0)
    setCollectionsCount(boardCount || 0)
    setUpcomingCount(upc || 0)
    const next = upcomingRows?.[0]
    if (next) {
      const { data: creatorProf } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, account_type, location')
        .eq('id', next.creator_id)
        .single()
      setNextAppointment({ ...next, creator: creatorProf || null })
    } else {
      setNextAppointment(null)
    }
    if (prof?.account_type === 'creator' || prof?.account_type === 'salon') {
      const [{ data: designs }, { data: posts }] = await Promise.all([
        supabase.from('designs').select('*').eq('created_by', u.id)
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('salon_posts').select('*').eq('creator_id', u.id).order('created_at', { ascending: false }),
      ])
      setMyDesigns(designs || [])
      setMyPosts(posts || [])
    }
    setLoading(false)
  }

  // Lazy loads for the Saved / Collections tabs (same queries as /saved)
  const loadSavedTab = async (uid) => {
    if (savedLoadedRef.current) return
    savedLoadedRef.current = true
    setSavedLoading(true)
    const { data, error: savedError } = await supabase
      .from('saved_designs').select('design_id, designs(*)')
      .eq('user_id', uid).order('saved_at', { ascending: false }).limit(200)
    if (savedError) console.error('saved designs fetch failed:', savedError)
    setSavedDesigns(data?.map(r => r.designs).filter(Boolean) || [])
    setSavedLoading(false)
  }

  const loadCollectionsTab = async (uid) => {
    if (boardsLoadedRef.current) return
    boardsLoadedRef.current = true
    setBoardsLoading(true)
    const { data, error: boardsError } = await supabase
      .from('moodboards').select('id, name, cover_image_url')
      .eq('user_id', uid).order('created_at', { ascending: false }).limit(100)
    if (boardsError) console.error('moodboards fetch failed:', boardsError)
    setBoards(data || [])
    if (data?.length) {
      const { data: countData } = await supabase
        .from('moodboard_designs').select('moodboard_id')
        .in('moodboard_id', data.map(b => b.id))
      const c = {}
      countData?.forEach(r => { c[r.moodboard_id] = (c[r.moodboard_id] || 0) + 1 })
      setBoardCounts(c)
    }
    setBoardsLoading(false)
  }

  const isCreatorType = profile?.account_type === 'creator' || profile?.account_type === 'salon'
  const currentTab = activeTab ?? (isCreatorType ? 'designs' : 'saved')

  useEffect(() => {
    if (!user || loading) return
    if (currentTab === 'saved') loadSavedTab(user.id)
    if (currentTab === 'collections') loadCollectionsTab(user.id)
  }, [user, loading, currentTab])

  const saveField = async (field, value) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ [field]: value }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || 'Failed to save')
      setProfile(prev => ({ ...prev, [field]: value }))
      return true
    } catch (err) {
      alert(err.message || 'Failed to save. Please try again.')
      return false
    }
  }

  const openNewPost = () => { setEditingPostId(null); setPostText(''); setPostModalOpen(true) }
  const openEditPost = (post) => { setEditingPostId(post.id); setPostText(post.body); setPostModalOpen(true) }
  const closePostModal = () => { setPostModalOpen(false); setPostText(''); setEditingPostId(null) }

  const handleSubmitPost = async () => {
    if (!postText.trim() || postSaving) return
    setPostSaving(true)
    let postError = null
    if (editingPostId) {
      const { error } = await supabase.from('salon_posts').update({ body: postText.trim(), updated_at: new Date().toISOString() }).eq('id', editingPostId)
      postError = error
      if (!error) setMyPosts(prev => prev.map(p => p.id === editingPostId ? { ...p, body: postText.trim() } : p))
    } else {
      const { data, error } = await supabase.from('salon_posts').insert({ creator_id: user.id, body: postText.trim() }).select().single()
      postError = error
      if (data) setMyPosts(prev => [data, ...prev])
    }
    setPostSaving(false)
    if (postError) {
      alert('Failed to save update. Please try again.')
      return
    }
    closePostModal()
  }

  const handleDeletePost = async (postId) => {
    if (!confirm('Delete this update?')) return
    const { error } = await supabase.from('salon_posts').delete().eq('id', postId)
    if (error) { alert('Failed to delete update. Please try again.'); return }
    setMyPosts(prev => prev.filter(p => p.id !== postId))
  }

  const toggleChip = async (field, item, single) => {
    const current = profile?.[field]
    const next = single
      ? (current === item ? null : item)
      : (current || []).includes(item) ? (current).filter(i => i !== item) : [...(current || []), item]
    await saveField(field, next)
  }

  // ── Auth handlers ──────────────────────────────────────────────────────
  const handleSignUpStep1 = (e) => {
    e.preventDefault()
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (!displayName.trim()) { setError('Please enter a display name'); return }
    if (!termsAccepted) { setError('Please accept the Terms & Privacy Policy to continue'); return }
    setError(''); setMode('choose-type')
  }

  const setAccountType = async (accountType, name) => {
    const { data: { session } } = await supabase.auth.getSession()
    const res = await fetch('/api/set-account-type', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({ accountType, displayName: name }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) throw new Error(json.error || 'Failed to set account type')
  }

  const handleCreateAccount = async () => {
    if (!chosenType) return
    setSubmitting(true); setError('')
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) { setError(error.message); setSubmitting(false); return }
    if (data.user) {
      try {
        await setAccountType(chosenType, displayName.trim())
        await loadUserData(data.user)
      } catch (err) {
        setError(err.message)
      }
    }
    setSubmitting(false)
  }

  const handleLogin = async (e) => {
    e.preventDefault(); setError(''); setSubmitting(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    setSubmitting(false)
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault(); setError(''); setSubmitting(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: 'https://laque.app/profile' })
    if (error) setError(error.message)
    else setForgotSent(true)
    setSubmitting(false)
  }

  const handleGoogleSignIn = async () => {
    await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: 'https://laque.app/profile', queryParams: { prompt: 'select_account' } } })
  }

  const handleSetGoogleAccountType = async () => {
    if (!chosenType) return
    setSubmitting(true); setError('')
    const name = displayName.trim() || user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User'
    try {
      await setAccountType(chosenType, name)
      await loadUserData(user)
    } catch (err) {
      setError(err.message)
    }
    setSubmitting(false)
  }

  const handlePin = async (design) => {
    const newVal = !design.is_pinned
    const { error } = await supabase.from('designs').update({ is_pinned: newVal }).eq('id', design.id)
    if (error) { alert('Failed to update. Please try again.'); return }
    setMyDesigns(prev => {
      const updated = prev.map(d => d.id === design.id ? { ...d, is_pinned: newVal } : d)
      return [...updated].sort((a, b) => {
        if (b.is_pinned !== a.is_pinned) return b.is_pinned ? 1 : -1
        return new Date(b.created_at) - new Date(a.created_at)
      })
    })
  }

  const handleBecomeCreator = async () => {
    if (!confirm('Switch your account to a Creator account?')) return
    try {
      await setAccountType('creator')
      setProfile(prev => ({ ...prev, account_type: 'creator' }))
    } catch (err) {
      alert(err.message || 'Something went wrong. Please try again.')
    }
  }

  const handleManageSubscription = async () => {
    if (managingSubscription) return
    setManagingSubscription(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/create-billing-portal-session', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else { alert(data.error || 'Something went wrong.'); setManagingSubscription(false) }
    } catch {
      alert('Something went wrong.')
      setManagingSubscription(false)
    }
  }

  const handleSetNewPassword = async (e) => {
    e.preventDefault()
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return }
    setSubmitting(true); setError('')
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) setError(error.message)
    else { setResetDone(true); setResetMode(false) }
    setSubmitting(false)
  }

  const handleLogout       = async () => { await supabase.auth.signOut() }
  const handleDeleteAccount = async () => {
    if (!confirm('Delete your account permanently? This cannot be undone.')) return
    await supabase.rpc('delete_own_account')
    await supabase.auth.signOut()
  }

  const handleAvatarPick = (e) => {
    const file = e.target.files[0]
    if (file) setCropFile(file)
    e.target.value = ''
  }

  const handleCroppedUpload = async (croppedFile) => {
    setCropFile(null)
    if (!user) return
    setUploadingAvatar(true)
    // Through /api/upload-image (shared resize+WebP pipeline) — direct
    // client uploads previously stored the raw crop untransformed.
    const { data: { session } } = await supabase.auth.getSession()
    const fd = new FormData()
    fd.append('file', croppedFile)
    fd.append('purpose', 'avatar')
    const res = await fetch('/api/upload-image', {
      method: 'POST',
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      body: fd,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok || json.error) { alert('Upload failed: ' + (json.error || res.status)); setUploadingAvatar(false); return }
    const bustedUrl = `${json.publicUrl}?t=${Date.now()}`
    await saveField('avatar_url', bustedUrl)
    setUploadingAvatar(false)
  }

  const removeAvatar = async () => {
    if (!confirm('Remove profile photo?')) return
    await saveField('avatar_url', null)
  }

  // ── Loading ────────────────────────────────────────────────────────────
  if (loading) return (
    <Shell>
      <div style={{ padding: '24px', ...ui(300, 14, MUTED) }}>Loading...</div>
    </Shell>
  )

  // ── Password recovery ──────────────────────────────────────────────────
  if (resetMode) {
    return (
      <Shell>
        <div style={{ padding: 'calc(env(safe-area-inset-top) + 32px) 24px 140px' }}>
          <div style={{ marginBottom: '28px', color: 'var(--lq-white)' }}><LaqueWordmark height={24} /></div>
          <h1 style={{ ...ui(600, 24), letterSpacing: '-0.02em', marginBottom: '4px' }}>Set new password</h1>
          <p style={{ ...ui(300, 14, MUTED), marginBottom: '32px' }}>Choose a new password for your account</p>
          <form onSubmit={handleSetNewPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input type="password" placeholder="New password (min 6 characters)" aria-label="New password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required style={inp} />
            {error && <p style={{ color: '#E07070', fontSize: '13px' }}>{error}</p>}
            <button type="submit" disabled={submitting} style={primaryBtn}>
              {submitting ? 'Saving...' : 'Save new password'}
            </button>
          </form>
        </div>
      </Shell>
    )
  }

  // ── Forgot password ────────────────────────────────────────────────────
  if (!user && mode === 'forgot') {
    return (
      <Shell>
        <div style={{ padding: 'calc(env(safe-area-inset-top) + 32px) 24px 140px' }}>
          <div style={{ marginBottom: '28px', color: 'var(--lq-white)' }}><LaqueWordmark height={24} /></div>
          <h1 style={{ ...ui(600, 24), letterSpacing: '-0.02em', marginBottom: '4px' }}>Reset password</h1>
          <p style={{ ...ui(300, 14, MUTED), marginBottom: '32px' }}>We'll send a reset link to your email</p>
          {forgotSent ? (
            <div style={{ ...sectionCard, padding: '20px', textAlign: 'center' }}>
              <p style={{ ...ui(500, 15), marginBottom: '8px' }}>Check your email</p>
              <p style={{ ...ui(300, 14, MUTED), marginBottom: '20px' }}>We sent a reset link to {email}</p>
              <button onClick={() => { setMode('login'); setForgotSent(false) }}
                style={{ background: 'none', border: 'none', color: ACCENT, fontSize: '14px', fontFamily: 'var(--lq-font-ui)', cursor: 'pointer' }}>Back to login</button>
            </div>
          ) : (
            <form onSubmit={handleForgotPassword} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input type="email" placeholder="Email" aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
              {error && <p style={{ color: '#E07070', fontSize: '13px' }}>{error}</p>}
              <button type="submit" disabled={submitting} style={primaryBtn}>
                {submitting ? 'Sending...' : 'Send reset link'}
              </button>
              <button type="button" onClick={() => { setMode('login'); setError('') }}
                style={{ background: 'none', border: 'none', color: MUTED, fontSize: '13px', fontFamily: 'var(--lq-font-ui)', cursor: 'pointer', padding: '10px' }}>← Back to login</button>
            </form>
          )}
        </div>
      </Shell>
    )
  }

  // ── Choose account type ────────────────────────────────────────────────
  const accountTypes = [
    { type: 'user',    label: 'Design Lover',           desc: 'Browse, save, and discover nail designs' },
    { type: 'creator', label: 'Nail Artist / Nail Tech', desc: 'Publish your work and build your portfolio' },
    { type: 'salon',   label: 'Salon Owner',             desc: "Showcase your salon's designs and manage your team" },
  ]

  const typeCard = (active) => ({
    background: active ? BTN_GRADIENT : PANEL,
    border: active ? '1px solid transparent' : PANEL_BORDER,
    borderRadius: '16px', padding: '16px', textAlign: 'left', cursor: 'pointer', fontFamily: 'var(--lq-font-ui)',
  })

  if (!user && mode === 'choose-type') {
    return (
      <Shell>
        <div style={{ padding: 'calc(env(safe-area-inset-top) + 32px) 24px 140px' }}>
          <div style={{ marginBottom: '28px', color: 'var(--lq-white)' }}><LaqueWordmark height={24} /></div>
          <h1 style={{ ...ui(600, 24), letterSpacing: '-0.02em', marginBottom: '4px' }}>I am a...</h1>
          <p style={{ ...ui(300, 14, MUTED), marginBottom: '28px' }}>Choose how you'll use Laque</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {accountTypes.map(({ type, label, desc }) => (
              <button key={type} onClick={() => setChosenType(type)} style={typeCard(chosenType === type)}>
                <p style={{ ...ui(500, 15), marginBottom: '4px' }}>{label}</p>
                <p style={ui(300, 13, chosenType === type ? 'var(--lq-white-80)' : MUTED)}>{desc}</p>
              </button>
            ))}
          </div>
          {error && <p style={{ color: '#E07070', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
          <button onClick={handleCreateAccount} disabled={!chosenType || submitting}
            style={{ ...primaryBtn, width: '100%', background: chosenType ? BTN_GRADIENT : CHIP_BG, color: chosenType ? 'var(--lq-white)' : MUTED, cursor: chosenType ? 'pointer' : 'default' }}>
            {submitting ? 'Creating account...' : 'Create account'}
          </button>
          <button onClick={() => setMode('signup')} style={{ background: 'none', border: 'none', color: MUTED, fontSize: '13px', fontFamily: 'var(--lq-font-ui)', cursor: 'pointer', display: 'block', margin: '12px auto 0', padding: '10px' }}>← Back</button>
        </div>
      </Shell>
    )
  }

  // ── Google user: pick account type ────────────────────────────────────
  if (user && needsAccountType) {
    const suggestedName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || ''
    return (
      <Shell>
        <div style={{ padding: 'calc(env(safe-area-inset-top) + 32px) 24px 140px' }}>
          <div style={{ marginBottom: '28px', color: 'var(--lq-white)' }}><LaqueWordmark height={24} /></div>
          <h1 style={{ ...ui(600, 24), letterSpacing: '-0.02em', marginBottom: '4px' }}>One more thing</h1>
          <p style={{ ...ui(300, 14, MUTED), marginBottom: '28px' }}>How will you use Laque?</p>
          <input type="text" placeholder="Display name" aria-label="Display name" value={displayName || suggestedName} onChange={e => setDisplayName(e.target.value)}
            style={{ ...inp, width: '100%', marginBottom: '16px', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
            {accountTypes.map(({ type, label, desc }) => (
              <button key={type} onClick={() => setChosenType(type)} style={typeCard(chosenType === type)}>
                <p style={{ ...ui(500, 15), marginBottom: '4px' }}>{label}</p>
                <p style={ui(300, 13, chosenType === type ? 'var(--lq-white-80)' : MUTED)}>{desc}</p>
              </button>
            ))}
          </div>
          <button onClick={handleSetGoogleAccountType} disabled={!chosenType || submitting}
            style={{ ...primaryBtn, width: '100%', background: chosenType ? BTN_GRADIENT : CHIP_BG, color: chosenType ? 'var(--lq-white)' : MUTED, cursor: chosenType ? 'pointer' : 'default' }}>
            {submitting ? 'Saving...' : 'Get started'}
          </button>
        </div>
      </Shell>
    )
  }

  // ── Login / Signup ─────────────────────────────────────────────────────
  if (!user) {
    return (
      <Shell>
        <div style={{ padding: 'calc(env(safe-area-inset-top) + 32px) 24px 140px' }}>
          <div style={{ marginBottom: '28px', color: 'var(--lq-white)' }}><LaqueWordmark height={24} /></div>
          <h1 style={{ ...ui(600, 24), letterSpacing: '-0.02em', marginBottom: '4px' }}>
            {mode === 'login' ? 'Welcome back' : 'Create account'}
          </h1>
          <p style={{ ...ui(300, 14, MUTED), marginBottom: '32px' }}>
            {mode === 'login' ? 'Sign in to save your favourite designs' : 'Join to start saving designs'}
          </p>
          <form onSubmit={mode === 'login' ? handleLogin : handleSignUpStep1} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {mode === 'signup' && (
              <input type="text" placeholder="Display name" aria-label="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} required style={inp} />
            )}
            <input type="email" placeholder="Email" aria-label="Email" value={email} onChange={e => setEmail(e.target.value)} required style={inp} />
            <input type="password" placeholder="Password" aria-label="Password" value={password} onChange={e => setPassword(e.target.value)} required style={inp} />
            {mode === 'signup' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', paddingTop: '4px' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)}
                    style={{ marginTop: '2px', accentColor: ACCENT, flexShrink: 0 }} />
                  <span style={{ ...ui(300, 12, MUTED), lineHeight: 1.5 }}>
                    I agree to the <span style={{ color: ACCENT }}>Terms of Service</span> and <span style={{ color: ACCENT }}>Privacy Policy</span>
                  </span>
                </label>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input type="checkbox" checked={marketingConsent} onChange={e => setMarketingConsent(e.target.checked)}
                    style={{ marginTop: '2px', accentColor: ACCENT, flexShrink: 0 }} />
                  <span style={{ ...ui(300, 12, MUTED), lineHeight: 1.5 }}>
                    Send me updates on new designs, features, and nail trends (optional)
                  </span>
                </label>
              </div>
            )}
            {error && <p style={{ color: '#E07070', fontSize: '13px' }}>{error}</p>}
            <button type="submit" disabled={submitting} style={{ ...primaryBtn, marginTop: '4px' }}>
              {submitting ? 'Loading...' : mode === 'login' ? 'Log in' : 'Continue →'}
            </button>
          </form>
          {mode === 'login' && (
            <div style={{ textAlign: 'center', marginTop: '12px' }}>
              <button onClick={() => { setMode('forgot'); setError('') }}
                style={{ background: 'none', border: 'none', color: MUTED, fontSize: '13px', fontFamily: 'var(--lq-font-ui)', cursor: 'pointer', padding: '10px' }}>
                Forgot password?
              </button>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '16px 0' }}>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.10)' }} />
            <span style={ui(300, 12, MUTED)}>or</span>
            <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.10)' }} />
          </div>
          <button onClick={handleGoogleSignIn}
            style={{ width: '100%', background: PANEL, border: PANEL_BORDER, borderRadius: 'var(--lq-radius-pill)', padding: '14px', ...ui(500, 14), cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
            <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4"/>
              <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
              <path d="M3.964 10.707A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.707V4.961H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.039l3.007-2.332z" fill="#FBBC05"/>
              <path d="M9 3.576c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.961L3.964 7.293C4.672 5.166 6.656 3.576 9 3.576z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>
          <p style={{ ...ui(300, 13, MUTED), textAlign: 'center', marginTop: '16px' }}>
            {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
            <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
              style={{ background: 'none', border: 'none', color: ACCENT, fontSize: '13px', fontFamily: 'var(--lq-font-ui)', cursor: 'pointer', padding: 0 }}>
              {mode === 'login' ? 'Sign up' : 'Log in'}
            </button>
          </p>
        </div>
      </Shell>
    )
  }

  // ── LOGGED IN ──────────────────────────────────────────────────────────
  const isCreator   = isCreatorType
  const accountLabel = profile?.account_type === 'creator' ? 'NAIL ARTIST' : profile?.account_type === 'salon' ? 'SALON' : 'NAIL LOVER'
  const initials    = (profile?.display_name || user.email || '?').slice(0, 2).toUpperCase()
  const completion  = calcCompletion(profile, user)

  // Per-section completion
  const bookingPct = Math.round(([profile?.preferred_contact, profile?.booking_area].filter(Boolean).length / 2) * 100)
  const stylePct   = Math.round(([profile?.nail_shape, profile?.nail_length, profile?.nail_colors?.length, profile?.nail_finishes?.length, profile?.budget_range].filter(Boolean).length / 5) * 100)
  const healthPct  = (profile?.allergies || profile?.product_sensitivities?.length) ? 100 : 0

  const used    = profile?.weekly_uploads || 0
  const isPro   = profile?.subscription_tier === 'pro_creator'
  const atLimit = !isPro && used >= 5

  const nextCreator = nextAppointment?.creator
  const apptStatus = nextAppointment?.status === 'confirmed'
    ? { label: 'Confirmed', bg: 'rgba(16,185,129,0.15)', color: '#10B981' }
    : { label: 'Pending',   bg: 'rgba(255,184,76,0.15)', color: '#FFB84C' }

  const tiles = [
    { key: 'upcoming',    label: 'Upcoming',    count: upcomingCount,    href: '/appointments', icon: <CalendarIcon /> },
    { key: 'saved',       label: 'Saved',       count: savedCount,       href: '/saved',        icon: <BookmarkIcon /> },
    { key: 'favorites',   label: 'Favorites',   count: favouritesCount,  href: '/search?tab=artists&favourites=1', icon: <HeartIcon size={16} /> },
    { key: 'collections', label: 'Collections', count: collectionsCount, href: '/moodboards',   icon: <FolderIcon /> },
    { key: 'credits',     label: 'Credits',     count: profile?.credit_balance ?? 0, href: '/nail-lab', icon: <MagicStarIcon size={16} /> },
  ]

  const Tile = ({ t }) => (
    <Link href={t.href} style={{ ...sectionCard, borderRadius: '16px', padding: '12px', textDecoration: 'none', display: 'block', minHeight: '44px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
        <span style={{ color: ACCENT, display: 'flex' }}>{t.icon}</span>
        <span style={ui(600, 14)}>{t.count}</span>
      </div>
      <span style={ui(300, 11, MUTED)}>{t.label}</span>
    </Link>
  )

  const designCard = (design, { showState = false, showPin = false } = {}) => (
    <article key={design.id} style={{ position: 'relative' }}>
      <Link href={`/design/${design.id}`} style={{ textDecoration: 'none', display: 'block' }}>
        <div style={{ position: 'relative', width: '100%', height: '160px', borderRadius: '24px', overflow: 'hidden', background: PANEL, border: PANEL_BORDER }}>
          {design.image_url
            ? <img src={design.image_url} alt={design.title || 'Design'} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <div style={{ width: '100%', height: '100%' }} />}
          {design.category && (
            <span style={{
              position: 'absolute', top: '8px', left: '8px',
              background: 'rgba(38,13,20,0.55)', backdropFilter: 'blur(6px)',
              padding: '4px 8px', borderRadius: 'var(--lq-radius-pill)',
              ...ui(500, 9), letterSpacing: '0.04em', textTransform: 'capitalize',
            }}>{design.category}</span>
          )}
          {showState && !design.is_published && (
            <span aria-label="Private" style={{
              position: 'absolute', top: '8px', right: '8px', width: '24px', height: '24px',
              borderRadius: '50%', background: 'rgba(38,13,20,0.6)', backdropFilter: 'blur(6px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lq-white)',
            }}><LockIcon size={12} /></span>
          )}
        </div>
        <p style={{ ...ui(600, 15), margin: '8px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{design.title || 'Untitled'}</p>
        {showState && (
          <p style={{ ...ui(300, 11, MUTED), margin: '2px 0 0' }}>{design.is_published ? 'Public' : 'Private'}</p>
        )}
      </Link>
      {/* Pin control: not in the frame but the feature exists — kept as an
          overlay away from the drawn lock-badge position (bottom right). */}
      {showPin && (
        <button
          onClick={(e) => { e.preventDefault(); handlePin(design) }}
          aria-label={design.is_pinned ? 'Unpin design' : 'Pin design to top'}
          style={{
            position: 'absolute', bottom: '52px', right: '8px',
            background: design.is_pinned ? BTN_GRADIENT : 'rgba(38,13,20,0.55)',
            border: 'none', borderRadius: '50%', width: '26px', height: '26px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', backdropFilter: 'blur(4px)',
          }}
        >
          <PinIcon size={12} fill="white" />
        </button>
      )}
    </article>
  )

  return (
    <Shell avatarUrl={profile?.avatar_url}>

      {cropFile && <CropModal file={cropFile} onCrop={handleCroppedUpload} onCancel={() => setCropFile(null)} />}

      {/* ── Post update modal ──────────────────────────────────────────── */}
      {postModalOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(20,3,8,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '440px', background: '#2B0F17', border: PANEL_BORDER, borderRadius: '24px', padding: '24px 20px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ ...ui(600, 16), margin: 0 }}>
                {editingPostId ? 'Edit update' : 'Post an update'}
              </p>
              <button onClick={closePostModal} aria-label="Close" style={{ background: 'none', border: 'none', color: MUTED, fontSize: '20px', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>✕</button>
            </div>
            <textarea
              value={postText}
              onChange={e => setPostText(e.target.value)}
              placeholder="Share an update with your followers… e.g. New gel colours in! 🌸"
              rows={5}
              autoFocus
              style={{
                width: '100%', background: CHIP_BG, border: PANEL_BORDER,
                borderRadius: '16px', padding: '12px 14px', color: 'var(--lq-white)',
                fontSize: '14px', fontFamily: 'var(--lq-font-ui)', resize: 'none',
                boxSizing: 'border-box', outline: 'none', lineHeight: '1.6', marginBottom: '14px',
              }}
            />
            <button
              onClick={handleSubmitPost}
              disabled={!postText.trim() || postSaving}
              style={{
                ...primaryBtn, width: '100%',
                background: postText.trim() ? BTN_GRADIENT : CHIP_BG,
                color: postText.trim() ? 'var(--lq-white)' : MUTED,
                cursor: postText.trim() && !postSaving ? 'pointer' : 'not-allowed',
              }}
            >
              {postSaving ? 'Saving…' : editingPostId ? 'Save changes' : 'Post'}
            </button>
          </div>
        </div>
      )}

      {/* ── Settings sheet ─────────────────────────────────────────────── */}
      {settingsOpen && (
        <Sheet title="Settings" onClose={() => setSettingsOpen(false)}>
          <h2 style={{ ...ui(600, 20), margin: '0 0 16px' }}>Settings</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {profile?.subscription_tier && (
              <button onClick={handleManageSubscription} disabled={managingSubscription}
                style={{ ...menuRow, width: '100%', cursor: managingSubscription ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ color: ACCENT, display: 'flex' }}><CardIcon /></span>
                <span style={{ ...ui(400, 15), flex: 1 }}>{managingSubscription ? 'Redirecting…' : 'Manage subscription'}</span>
                <span style={{ color: MUTED, display: 'flex' }}><ChevronRight /></span>
              </button>
            )}
            <button onClick={handleLogout} style={{ ...menuRow, width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ color: ACCENT, display: 'flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
              </span>
              <span style={{ ...ui(400, 15), flex: 1 }}>Log out</span>
              <span style={{ color: MUTED, display: 'flex' }}><ChevronRight /></span>
            </button>
            <button onClick={handleDeleteAccount} style={{ ...menuRow, width: '100%', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ color: '#E07070', display: 'flex' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"/>
                </svg>
              </span>
              <span style={{ ...ui(400, 15, '#E07070'), flex: 1 }}>Delete account</span>
            </button>
          </div>
          <p style={{ ...ui(300, 12, MUTED), textAlign: 'center', marginTop: '20px' }}>Laque · Version 0.2 · Beta</p>
        </Sheet>
      )}

      <div style={{ padding: 'calc(env(safe-area-inset-top) + 12px) 24px calc(env(safe-area-inset-bottom) + 140px)', display: 'flex', flexDirection: 'column', gap: '24px' }}>

        {/* ── Header: wordmark + settings gear ─────────────────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minHeight: '44px' }}>
          <span style={{ color: 'var(--lq-white)', display: 'flex' }}><LaqueWordmark height={24} /></span>
          <IconButton label="Settings" onClick={() => setSettingsOpen(true)} variant="glass" visualSize={36}>
            <GearIcon size={18} />
          </IconButton>
        </div>

        {resetDone && (
          <div style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', borderRadius: '16px', padding: '14px 16px' }}>
            <p style={ui(500, 14, '#10B981')}>✓ Password updated successfully</p>
          </div>
        )}

        {/* ── Identity ─────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
          <div style={{ position: 'relative', marginBottom: '10px' }}>
            <label style={{ cursor: 'pointer', display: 'block' }}>
              <input type="file" accept="image/*" onChange={handleAvatarPick} style={{ display: 'none' }} aria-label="Change profile photo" />
              <div style={{ width: '100px', height: '100px', borderRadius: '50%', border: `2px solid ${ACCENT}`, padding: '2px', boxSizing: 'content-box' }}>
                <div style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', background: PANEL, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                  {profile?.avatar_url
                    ? <img src={profile.avatar_url} alt="Your avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={ui(400, 30)}>{initials}</span>}
                  {uploadingAvatar && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(20,3,8,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}>
                      <span style={ui(300, 11)}>...</span>
                    </div>
                  )}
                </div>
              </div>
              {!uploadingAvatar && (
                <div style={{ position: 'absolute', bottom: '0px', right: '0px', width: '32px', height: '32px', borderRadius: '50%', background: BTN_GRADIENT, border: '2px solid #1A050D', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lq-white)' }}>
                  <CameraIcon size={14} />
                </div>
              )}
            </label>
          </div>
          {profile?.avatar_url && !uploadingAvatar && (
            <button onClick={removeAvatar} style={{ background: 'none', border: 'none', color: MUTED, fontSize: '11px', cursor: 'pointer', padding: '0 0 4px', textDecoration: 'underline', fontFamily: 'var(--lq-font-ui)' }}>Remove photo</button>
          )}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
            <h1 style={{ ...ui(700, 26), margin: 0, textAlign: 'center' }}>{profile?.display_name || 'Set your name'}</h1>
            <span style={{
              background: 'linear-gradient(90deg, rgba(102,0,7,0.45), rgba(255,81,127,0.45))',
              padding: '4px 10px', borderRadius: 'var(--lq-radius-pill)', opacity: 0.8,
              ...ui(700, 9), letterSpacing: '0.06em',
            }}>{accountLabel}</span>
          </div>
          {profile?.username && <p style={{ ...ui(300, 14, MUTED), margin: 0 }}>@{profile.username}</p>}
          {profile?.bio && <p style={{ ...ui(400, 14, 'var(--lq-white-80)'), margin: '4px 0 0', textAlign: 'center', maxWidth: '320px' }}>{profile.bio}</p>}
          {profile?.location && (
            <p style={{ ...ui(500, 13, 'var(--lq-white-80)'), display: 'flex', alignItems: 'center', gap: '5px', margin: '6px 0 0' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M5.631 11.067C5.631 11.067 2 8.009 2 5C2 3.93913 2.42143 2.92172 3.17157 2.17157C3.92172 1.42143 4.93913 1 6 1C7.06087 1 8.07828 1.42143 8.82843 2.17157C9.57857 2.92172 10 3.93913 10 5C10 8.009 6.369 11.067 6.369 11.067C6.167 11.253 5.8345 11.251 5.631 11.067ZM6 6.75C6.9665 6.75 7.75 5.9665 7.75 5C7.75 4.0335 6.9665 3.25 6 3.25C5.0335 3.25 4.25 4.0335 4.25 5C4.25 5.9665 5.0335 6.75 6 6.75Z" fill="currentColor" />
              </svg>
              {profile.location}
            </p>
          )}
        </div>

        {/* ── Edit Profile / Public Profile ─────────────────────────────── */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <button onClick={() => setEditOpen(v => !v)} aria-expanded={editOpen}
            style={{ ...primaryBtn, flex: 1, padding: '12px', fontSize: '14px' }}>
            {editOpen ? 'Done Editing' : 'Edit Profile'}
          </button>
          <Link href={`/creator/${user.id}`}
            style={{ flex: 1, background: PANEL, border: PANEL_BORDER, borderRadius: 'var(--lq-radius-pill)', padding: '12px', ...ui(600, 14), textDecoration: 'none', textAlign: 'center' }}>
            Public Profile
          </Link>
        </div>

        {/* ── Inline editors (existing edit flows, revealed by Edit Profile) */}
        {editOpen && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Completion bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <p style={ui(300, 11, MUTED)}>Profile completion</p>
                <p style={ui(500, 11, completion === 100 ? '#10B981' : ACCENT)}>{completion}%</p>
              </div>
              <div style={{ height: '4px', background: CHIP_BG, borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${completion}%`, background: completion === 100 ? '#10B981' : BTN_GRADIENT, borderRadius: '2px', transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {/* Personal info */}
            <div style={sectionCard}>
              <p style={{ ...ui(500, 11, MUTED), letterSpacing: '0.08em', textTransform: 'uppercase', padding: '14px 16px 10px' }}>Personal Info</p>
              <div style={{ borderTop: PANEL_BORDER }}>
                <EditRow label="Display name" field="display_name" value={profile?.display_name} placeholder="Your name" onSave={saveField} />
              </div>
              <div style={{ borderTop: PANEL_BORDER }}>
                <UsernameRow value={profile?.username} />
              </div>
              <div style={{ borderTop: PANEL_BORDER, padding: '14px 16px' }}>
                <p style={{ ...ui(500, 11, MUTED), letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '6px' }}>Email</p>
                <p style={ui(400, 14)}>{user.email}</p>
              </div>
              <div style={{ borderTop: PANEL_BORDER }}>
                <EditRow label="Phone number" field="phone_number" value={profile?.phone_number} placeholder="e.g. +971 50 123 4567" onSave={saveField} validate={validatePhone} />
              </div>
              <div style={{ borderTop: PANEL_BORDER }}>
                <EditRow label="Location" field="location" value={profile?.location} placeholder="Your city or area" onSave={saveField} />
              </div>
              <div style={{ borderTop: PANEL_BORDER }}>
                <EditRow label="Bio" field="bio" value={profile?.bio} placeholder="Tell us about yourself" multiline onSave={saveField} />
              </div>
            </div>

            {/* Booking passport */}
            <div style={sectionCard}>
              <SectionHeader title="Booking Passport" expanded={expanded.booking} onToggle={() => toggle('booking')} pct={bookingPct} />
              {expanded.booking && (
                <>
                  <p style={{ padding: '10px 16px 14px', ...ui(300, 12, MUTED), lineHeight: 1.6, borderBottom: PANEL_BORDER }}>
                    Stored once, used for all your bookings. Salons know how to reach you.
                  </p>
                  <div style={{ padding: '14px 16px' }}>
                    <p style={{ ...ui(500, 11, MUTED), letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Preferred contact</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {CONTACTS.map(c => {
                        const active = profile?.preferred_contact === c
                        return (
                          <button key={c} onClick={() => saveField('preferred_contact', active ? null : c)} style={btn(active)}>{c}</button>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ borderTop: PANEL_BORDER }}>
                    <EditRow label="Preferred booking area" field="booking_area" value={profile?.booking_area} placeholder="e.g. Dubai Marina, JBR..." onSave={saveField} />
                  </div>
                  <div style={{ borderTop: PANEL_BORDER }}>
                    <EditRow label="Notes for salons" field="booking_notes" value={profile?.booking_notes} placeholder={`"I need removal first", "prefer quiet appointments"...`} multiline onSave={saveField} />
                  </div>
                </>
              )}
            </div>

            {/* Style DNA */}
            <div style={sectionCard}>
              <SectionHeader title="Style DNA" expanded={expanded.styleDNA} onToggle={() => toggle('styleDNA')} pct={stylePct} />
              {expanded.styleDNA && (
                <>
                  <p style={{ padding: '10px 16px 14px', ...ui(300, 12, MUTED), lineHeight: 1.6, borderBottom: PANEL_BORDER }}>
                    Your nail preferences. Personalises your feed, search, and Nail Lab results.
                  </p>
                  {[
                    { label: 'Nail shape',           field: 'nail_shape',       options: SHAPES,     single: true  },
                    { label: 'Nail length',           field: 'nail_length',      options: LENGTHS,    single: true  },
                    { label: 'Favourite colours',     field: 'nail_colors',      options: COLORS,     single: false },
                    { label: 'Favourite finishes',    field: 'nail_finishes',    options: FINISHES,   single: false },
                    { label: 'Favourite techniques',  field: 'nail_techniques',  options: TECHNIQUES, single: false },
                    { label: 'Occasions',             field: 'occasions',        options: OCCASIONS,  single: false },
                    { label: 'Budget range',          field: 'budget_range',     options: BUDGETS,    single: true  },
                  ].map(({ label, field, options, single }) => (
                    <div key={field} style={{ borderTop: PANEL_BORDER }}>
                      <p style={{ ...ui(500, 11, MUTED), letterSpacing: '0.06em', textTransform: 'uppercase', padding: '14px 16px 10px' }}>{label}</p>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '0 16px 14px' }}>
                        {options.map(opt => {
                          const active = single ? profile?.[field] === opt : (profile?.[field] || []).includes(opt)
                          return (
                            <button key={opt} onClick={() => toggleChip(field, opt, single)} style={btn(active)}>{opt}</button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Nail health */}
            <div style={sectionCard}>
              <SectionHeader title="Nail Health" expanded={expanded.nailHealth} onToggle={() => toggle('nailHealth')} pct={healthPct} />
              {expanded.nailHealth && (
                <>
                  <p style={{ padding: '10px 16px 14px', ...ui(300, 12, MUTED), lineHeight: 1.6, borderBottom: PANEL_BORDER }}>
                    Shared with your nail tech when you make a booking.
                  </p>
                  <div>
                    <EditRow label="Allergies" field="allergies" value={profile?.allergies} placeholder='e.g. "Latex allergy"' onSave={saveField} />
                  </div>
                  <div style={{ borderTop: PANEL_BORDER, padding: '14px 16px' }}>
                    <p style={{ ...ui(500, 11, MUTED), letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Product sensitivities</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {SENSITIVITIES.map(s => {
                        const active = (profile?.product_sensitivities || []).includes(s)
                        return (
                          <button key={s} onClick={() => toggleChip('product_sensitivities', s, false)}
                            style={{ ...btn(false), background: active ? 'rgba(224,112,112,0.15)' : CHIP_BG, color: active ? '#E07070' : MUTED, border: active ? '1px solid rgba(224,112,112,0.4)' : PANEL_BORDER }}>
                            {s}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div style={{ borderTop: PANEL_BORDER, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <p style={{ ...ui(400, 14), marginBottom: '2px' }}>Removal needed</p>
                      <p style={ui(300, 12, MUTED)}>I need removal before a new set</p>
                    </div>
                    <button onClick={() => saveField('removal_needed', !profile?.removal_needed)}
                      aria-pressed={!!profile?.removal_needed} aria-label="Removal needed"
                      style={{ width: '44px', height: '26px', borderRadius: '13px', background: profile?.removal_needed ? BTN_GRADIENT : CHIP_BG, border: PANEL_BORDER, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                      <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: '#fff', position: 'absolute', top: '2px', left: profile?.removal_needed ? '20px' : '2px', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
                    </button>
                  </div>
                  <div style={{ borderTop: PANEL_BORDER }}>
                    <EditRow label="Nail condition notes" field="nail_condition" value={profile?.nail_condition} placeholder='e.g. "Weak nails", "Short nail bed"' onSave={saveField} />
                  </div>
                </>
              )}
            </div>

            {/* Nail canvas (AR) */}
            <div style={sectionCard}>
              <SectionHeader title="Nail Canvas" expanded={expanded.arProfile} onToggle={() => toggle('arProfile')} />
              {expanded.arProfile && (
                <>
                  <p style={{ padding: '10px 16px 14px', ...ui(300, 12, MUTED), lineHeight: 1.6, borderBottom: PANEL_BORDER }}>
                    Used by Nail Mirror for accurate AR previews and better colour recommendations.
                  </p>
                  {/* Skin undertone */}
                  <div style={{ padding: '14px 16px', borderBottom: PANEL_BORDER }}>
                    <p style={{ ...ui(500, 11, MUTED), letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Skin undertone</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {UNDERTONES.map(u => {
                        const active = profile?.skin_undertone === u
                        return (
                          <button key={u} onClick={() => saveField('skin_undertone', active ? null : u)} style={btn(active)}>{u}</button>
                        )
                      })}
                    </div>
                  </div>
                  {/* Hand photo */}
                  <div style={{ padding: '14px 16px' }}>
                    <p style={{ ...ui(500, 11, MUTED), letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Hand photo</p>
                    {profile?.hand_photo_url ? (
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <img src={profile.hand_photo_url} alt="Hand" style={{ width: '140px', height: '100px', objectFit: 'cover', borderRadius: '10px', border: PANEL_BORDER, display: 'block' }} />
                        <button onClick={() => saveField('hand_photo_url', null)} aria-label="Remove hand photo"
                          style={{ position: 'absolute', top: '6px', right: '6px', width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                      </div>
                    ) : (
                      <label style={{ cursor: 'pointer', display: 'inline-block' }}>
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={async (e) => {
                          const file = e.target.files[0]; if (!file) return
                          const { data: { session } } = await supabase.auth.getSession()
                          const fd = new FormData()
                          fd.append('file', file)
                          fd.append('purpose', 'hand-photo')
                          const res = await fetch('/api/upload-image', {
                            method: 'POST',
                            headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
                            body: fd,
                          })
                          const json = await res.json().catch(() => ({}))
                          if (!res.ok || json.error) { alert('Upload failed: ' + (json.error || res.status)); return }
                          await saveField('hand_photo_url', json.publicUrl)
                          e.target.value = ''
                        }} />
                        <div style={{ width: '140px', height: '100px', background: CHIP_BG, borderRadius: '10px', border: `1px dashed rgba(255,255,255,0.2)`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={MUTED} strokeWidth="1.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                          <span style={ui(300, 12, MUTED)}>Upload photo</span>
                        </div>
                      </label>
                    )}
                    <p style={{ ...ui(300, 11, MUTED), marginTop: '8px', lineHeight: 1.5 }}>Optional — used for Nail Mirror AR previews</p>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── Public stats pill ─────────────────────────────────────────── */}
        <div style={{ ...sectionCard, borderRadius: 'var(--lq-radius-pill)', padding: '16px 8px', display: 'flex', alignItems: 'stretch' }}>
          {[
            { value: myDesigns.length, label: 'Designs',   href: null },
            { value: followerCount,    label: 'Followers', href: '/followers' },
            { value: followingCount,   label: 'Following', href: '/following' },
          ].map(({ value, label, href }, i) => {
            const cell = (
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                <span style={ui(700, 18)}>{value}</span>
                <span style={ui(300, 12, MUTED)}>{label}</span>
              </span>
            )
            return (
              <div key={label} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.10)' : 'none' }}>
                {href
                  ? <Link href={href} style={{ textDecoration: 'none' }}>{cell}</Link>
                  : cell}
              </div>
            )
          })}
        </div>

        {/* ── My Account ────────────────────────────────────────────────── */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
            <span style={{ color: 'var(--lq-white)', display: 'flex' }}><LockIcon size={14} /></span>
            <h2 style={{ ...ui(600, 16), margin: 0 }}>My Account</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            {tiles.slice(0, 3).map(t => <Tile key={t.key} t={t} />)}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginTop: '12px' }}>
            {tiles.slice(3).map(t => <Tile key={t.key} t={t} />)}
          </div>
        </div>

        {/* ── Upcoming appointment (only when one exists — real data) ───── */}
        {nextAppointment && (
          <div style={{ background: PANEL, border: '1px solid #660007', borderRadius: '24px', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <p style={{ ...ui(600, 15), margin: 0 }}>Upcoming Appointment</p>
              <span style={{ background: apptStatus.bg, color: apptStatus.color, ...ui(600, 10), padding: '3px 8px', borderRadius: '6px', letterSpacing: '0.03em' }}>
                {apptStatus.label}
              </span>
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.10)', marginBottom: '12px' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '20px', background: CHIP_BG, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {nextCreator?.avatar_url
                  ? <img src={nextCreator.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={ui(500, 16, ACCENT)}>{(nextCreator?.display_name || nextCreator?.username || '?')[0].toUpperCase()}</span>}
              </div>
              <div style={{ minWidth: 0 }}>
                <p style={{ ...ui(600, 14), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {nextCreator?.display_name || nextCreator?.username || 'Artist'}
                </p>
                <p style={{ ...ui(300, 11, MUTED), margin: '2px 0 0' }}>
                  {nextCreator?.account_type === 'salon' ? 'Salon' : 'Nail Artist'}{nextCreator?.location ? ` • ${nextCreator.location}` : ''}
                </p>
              </div>
            </div>
            {nextAppointment.service?.name && (
              <p style={{ ...ui(300, 13), margin: '0 0 4px' }}>Service: <span style={{ fontWeight: 600 }}>{nextAppointment.service.name}</span></p>
            )}
            <p style={{ ...ui(300, 13, MUTED), margin: '0 0 12px' }}>
              {fmtDate(nextAppointment.booking_date)}{nextAppointment.start_time ? `, ${fmt12(nextAppointment.start_time)}` : ''}
            </p>
            <Link href={`/appointments/${nextAppointment.id}`} style={{ ...ui(600, 13, ACCENT), textDecoration: 'none' }}>
              View Appointment →
            </Link>
          </div>
        )}

        {/* ── Content tabs: My Designs / Saved / Collections ────────────── */}
        <div>
          <div role="tablist" aria-label="Profile content" style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {[['designs', 'My Designs'], ['saved', 'Saved'], ['collections', 'Collections']].map(([key, label]) => (
              <button
                key={key}
                role="tab"
                aria-selected={currentTab === key}
                onClick={() => setActiveTab(key)}
                style={{
                  background: currentTab === key ? BTN_GRADIENT : PANEL,
                  border: currentTab === key ? 'none' : PANEL_BORDER,
                  color: currentTab === key ? 'var(--lq-white)' : MUTED,
                  borderRadius: 'var(--lq-radius-pill)', padding: '10px 16px', minHeight: '40px',
                  ...ui(currentTab === key ? 600 : 400, 13, currentTab === key ? 'var(--lq-white)' : MUTED),
                  cursor: 'pointer',
                }}
              >{label}</button>
            ))}
          </div>

          {/* My Designs */}
          {currentTab === 'designs' && (
            <>
              {isCreator && (
                atLimit ? (
                  <div aria-disabled="true" style={{ ...menuRow, justifyContent: 'center', opacity: 0.5, marginBottom: '16px' }}>
                    <span style={ui(500, 14, MUTED)}>Weekly upload limit reached</span>
                  </div>
                ) : (
                  <Link href="/upload" style={{ ...menuRow, justifyContent: 'center', gap: '8px', padding: '12px 16px', marginBottom: '16px' }}>
                    <span style={{ color: 'var(--lq-white)', display: 'flex' }}><PlusIcon size={14} /></span>
                    <span style={ui(500, 14)}>Add Design</span>
                  </Link>
                )
              )}
              {myDesigns.length === 0 ? (
                <div style={{ ...sectionCard, padding: '28px 20px', textAlign: 'center' }}>
                  <p style={{ ...ui(400, 13, MUTED), marginBottom: isCreator ? '8px' : 0 }}>No designs yet</p>
                  {isCreator && !atLimit && (
                    <Link href="/upload" style={{ ...ui(500, 13, ACCENT), textDecoration: 'none' }}>Publish your first design →</Link>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {myDesigns.map(d => designCard(d, { showState: true, showPin: true }))}
                </div>
              )}
            </>
          )}

          {/* Saved */}
          {currentTab === 'saved' && (
            savedLoading ? (
              <p style={{ ...ui(300, 14, MUTED), textAlign: 'center', padding: '32px 0' }}>Loading...</p>
            ) : savedDesigns.length === 0 ? (
              <div style={{ ...sectionCard, padding: '28px 20px', textAlign: 'center' }}>
                <p style={{ ...ui(400, 13, MUTED), marginBottom: '8px' }}>No saved designs yet</p>
                <Link href="/search" style={{ ...ui(500, 13, ACCENT), textDecoration: 'none' }}>Browse designs →</Link>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {savedDesigns.map(d => designCard(d))}
                </div>
                <Link href="/saved" style={{ display: 'block', textAlign: 'center', ...ui(500, 13, ACCENT), textDecoration: 'none', marginTop: '16px' }}>
                  Open Saved →
                </Link>
              </>
            )
          )}

          {/* Collections */}
          {currentTab === 'collections' && (
            boardsLoading ? (
              <p style={{ ...ui(300, 14, MUTED), textAlign: 'center', padding: '32px 0' }}>Loading...</p>
            ) : boards.length === 0 ? (
              <div style={{ ...sectionCard, padding: '28px 20px', textAlign: 'center' }}>
                <p style={{ ...ui(400, 13, MUTED), marginBottom: '8px' }}>No collections yet</p>
                <Link href="/moodboards" style={{ ...ui(500, 13, ACCENT), textDecoration: 'none' }}>Create a collection →</Link>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {boards.map(b => (
                    <Link key={b.id} href={`/moodboards/${b.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                      <div style={{ width: '100%', height: '160px', borderRadius: '24px', overflow: 'hidden', background: PANEL, border: PANEL_BORDER }}>
                        {b.cover_image_url
                          ? <img src={b.cover_image_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: MUTED }}><FolderIcon size={24} /></div>}
                      </div>
                      <p style={{ ...ui(600, 15), margin: '8px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</p>
                      <p style={{ ...ui(300, 11, MUTED), margin: '2px 0 0' }}>{boardCounts[b.id] || 0} design{(boardCounts[b.id] || 0) !== 1 ? 's' : ''}</p>
                    </Link>
                  ))}
                </div>
                <Link href="/moodboards" style={{ display: 'block', textAlign: 'center', ...ui(500, 13, ACCENT), textDecoration: 'none', marginTop: '16px' }}>
                  Manage collections →
                </Link>
              </>
            )
          )}
        </div>

        {/* ── Your Updates (creators/salons — existing CRUD) ────────────── */}
        {isCreator && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h2 style={{ ...ui(600, 16), margin: 0 }}>Your Updates</h2>
              <button onClick={openNewPost}
                style={{ background: BTN_GRADIENT, color: 'var(--lq-white)', border: 'none', borderRadius: 'var(--lq-radius-pill)', padding: '8px 14px', ...ui(600, 12), cursor: 'pointer' }}>
                + Post update
              </button>
            </div>
            {myPosts.length === 0 ? (
              <div style={{ ...sectionCard, padding: '20px 16px', textAlign: 'center' }}>
                <p style={{ ...ui(300, 13, MUTED), margin: 0 }}>No updates yet — share news with your followers</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {myPosts.map(post => {
                  const diff = Date.now() - new Date(post.created_at).getTime()
                  const h = Math.floor(diff / 3600000)
                  const d = Math.floor(diff / 86400000)
                  const ago = d >= 1 ? `${d}d ago` : h >= 1 ? `${h}h ago` : 'Just now'
                  return (
                    <div key={post.id} style={{ ...sectionCard, padding: '14px 16px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                        <span style={ui(300, 11, MUTED)}>{ago}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => openEditPost(post)} style={{ background: 'none', border: 'none', color: ACCENT, fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--lq-font-ui)', padding: 0 }}>Edit</button>
                          <button onClick={() => handleDeletePost(post.id)} style={{ background: 'none', border: 'none', color: '#E07070', fontSize: '12px', cursor: 'pointer', fontFamily: 'var(--lq-font-ui)', padding: 0 }}>Delete</button>
                        </div>
                      </div>
                      <p style={{ ...ui(400, 14), lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' }}>{post.body}</p>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── Creator tools (existing features, menu-row treatment) ─────── */}
        {isCreator && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {[
              { label: 'Analytics', href: '/analytics', icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
              )},
              { label: 'My Services', href: '/services', icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
              )},
              { label: 'Client Bookings', href: '/bookings', icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>
              )},
              { label: 'My Availability', href: '/availability', icon: <CalendarIcon /> },
              { label: 'Beauty Rewards', href: '/rewards', icon: (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              )},
            ].map(({ label, href, icon }) => (
              <Link key={label} href={href} style={menuRow}>
                <span style={{ color: ACCENT, display: 'flex' }}>{icon}</span>
                <span style={{ ...ui(400, 15), flex: 1 }}>{label}</span>
                <span style={{ color: MUTED, display: 'flex' }}><ChevronRight /></span>
              </Link>
            ))}
          </div>
        )}

        {/* ── Menu (frame 257:2444 rows + additive Invite & Earn) ───────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[
            { label: 'Booking History',  href: '/appointments',      icon: <CalendarIcon /> },
            { label: 'Nail Lab History', href: '/nail-lab/history',  icon: <MagicStarIcon size={16} /> },
            { label: 'Notifications',    href: '/notifications',     icon: <BellIcon size={16} /> },
            { label: 'Privacy & Safety', href: '/settings/privacy',  icon: <LockIcon size={16} /> },
          ].map(({ label, href, icon }) => (
            <Link key={label} href={href} style={menuRow}>
              <span style={{ color: 'var(--lq-white)', display: 'flex' }}>{icon}</span>
              <span style={{ ...ui(400, 15), flex: 1 }}>{label}</span>
              <span style={{ color: MUTED, display: 'flex' }}><ChevronRight /></span>
            </Link>
          ))}
          {/* Payment methods: real Stripe portal for subscribers; honest
              non-interactive state otherwise (no dead-looking live control). */}
          {profile?.subscription_tier ? (
            <button onClick={handleManageSubscription} disabled={managingSubscription}
              style={{ ...menuRow, width: '100%', cursor: managingSubscription ? 'default' : 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
              <span style={{ color: 'var(--lq-white)', display: 'flex' }}><CardIcon /></span>
              <span style={{ ...ui(400, 15), flex: 1 }}>{managingSubscription ? 'Redirecting…' : 'Payment Methods'}</span>
              <span style={{ color: MUTED, display: 'flex' }}><ChevronRight /></span>
            </button>
          ) : (
            <div style={{ ...menuRow, opacity: 0.55 }}>
              <span style={{ color: 'var(--lq-white)', display: 'flex' }}><CardIcon /></span>
              <span style={{ ...ui(400, 15), flex: 1 }}>Payment Methods</span>
              <span style={{ background: CHIP_BG, color: MUTED, fontSize: '10px', fontWeight: 500, padding: '3px 8px', borderRadius: 'var(--lq-radius-pill)', fontFamily: 'var(--lq-font-ui)' }}>Soon</span>
            </div>
          )}
          <Link href="/help" style={menuRow}>
            <span style={{ color: 'var(--lq-white)', display: 'flex' }}><HelpIcon /></span>
            <span style={{ ...ui(400, 15), flex: 1 }}>Help & Support</span>
            <span style={{ color: MUTED, display: 'flex' }}><ChevronRight /></span>
          </Link>
          <Link href="/invite" style={menuRow}>
            <span style={{ color: 'var(--lq-white)', display: 'flex' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M20 12v10H4V12"/><path d="M2 7h20v5H2z"/><path d="M12 22V7"/><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z"/>
              </svg>
            </span>
            <span style={{ ...ui(400, 15), flex: 1 }}>Invite & Earn</span>
            <span style={{ color: MUTED, display: 'flex' }}><ChevronRight /></span>
          </Link>
        </div>

        {/* ── Become a Creator (clients) ─────────────────────────────────── */}
        {!isCreator && (
          <div style={{ background: 'linear-gradient(145deg, rgba(255,81,127,0.12), rgba(102,0,7,0.10))', border: '1px solid rgba(255,81,127,0.3)', borderRadius: '24px', padding: '18px 16px' }}>
            <p style={{ ...ui(600, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '8px' }}>For Nail Artists & Salons</p>
            <p style={{ ...ui(600, 15), marginBottom: '6px' }}>Become a Creator</p>
            <p style={{ ...ui(300, 13, MUTED), lineHeight: 1.6, marginBottom: '14px' }}>Publish your designs, get a public profile, and reach clients discovering nail art on Laque.</p>
            <button onClick={handleBecomeCreator} style={{ ...primaryBtn, width: '100%', padding: '12px' }}>
              Switch to Creator Account
            </button>
          </div>
        )}

        {/* Upgrade banner — only show if not already subscribed */}
        {!profile?.subscription_tier && (
          <Link href="/upgrade" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(135deg, rgba(255,81,127,0.15) 0%, rgba(255,81,127,0.05) 100%)',
            border: '1px solid rgba(255,81,127,0.3)',
            borderRadius: '16px', padding: '13px 16px', textDecoration: 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '18px' }}>✦</span>
              <div>
                <p style={{ ...ui(600, 14), margin: '0 0 2px' }}>Upgrade to Pro</p>
                <p style={{ ...ui(300, 12, MUTED), margin: 0 }}>Unlock bookings, analytics & more</p>
              </div>
            </div>
            <span style={{ color: ACCENT, display: 'flex' }}><ChevronRight size={16} /></span>
          </Link>
        )}

        {/* ── Admin panel (admin only) ───────────────────────────────────── */}
        {profile?.is_admin && (
          <a href="/admin" style={{ ...menuRow, border: `1px solid ${ACCENT}`, background: 'rgba(255,81,127,0.08)' }}>
            <span style={{ color: ACCENT, display: 'flex' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
            </span>
            <span style={{ ...ui(600, 14, ACCENT), flex: 1 }}>Admin Panel</span>
            <span style={{ color: ACCENT, display: 'flex' }}><ChevronRight size={14} /></span>
          </a>
        )}

      </div>
    </Shell>
  )
}
