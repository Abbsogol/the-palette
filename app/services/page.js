'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'
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
const fieldLabel = { ...ui(500, 11, WHITE60), letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }
const fieldStyle = { width: '100%', background: 'rgba(255,255,255,0.04)', border: PANEL_BORDER, borderRadius: '10px', padding: '12px', ...ui(400, 14), outline: 'none', boxSizing: 'border-box' }

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hr', value: 60 },
  { label: '1.5 hr', value: 90 },
  { label: '2 hr', value: 120 },
  { label: '2.5 hr', value: 150 },
  { label: '3 hr', value: 180 },
]

// Composes the shared Sheet (which now owns the keyboard-offset lift, swipe-to-
// close, focus/Escape/scroll-lock). Only the form + save button live here.
function ServiceSheet({ service, onSave, onClose }) {
  const [name, setName] = useState(service?.name || '')
  const [description, setDescription] = useState(service?.description || '')
  const [duration, setDuration] = useState(service?.duration_minutes || 60)
  const [price, setPrice] = useState(service?.price ?? '')
  const [deposit, setDeposit] = useState(service?.deposit_amount ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    try {
      await onSave({ name: name.trim(), description: description.trim(), duration_minutes: duration, price: parseFloat(price) || 0, deposit_amount: parseFloat(deposit) || 0 })
    } catch (err) {
      alert(err.message || 'Failed to save service. Please try again.')
    }
    setSaving(false)
  }

  const canSave = !!name.trim() && !saving

  return (
    <Sheet
      title={service ? 'Edit service' : 'Add service'}
      onClose={onClose}
      footer={
        <button
          onClick={handleSave}
          disabled={!canSave}
          style={{ width: '100%', background: name.trim() ? BTN_GRADIENT : 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '1000px', padding: '14px', ...ui(600, 15, name.trim() ? 'var(--lq-white)' : WHITE60), cursor: canSave ? 'pointer' : 'not-allowed' }}
        >
          {saving ? 'Saving…' : service ? 'Save changes' : 'Add service'}
        </button>
      }
    >
      <h2 style={{ ...display(22), margin: '0 0 16px' }}>{service ? 'Edit service' : 'Add service'}</h2>

      {/* Name */}
      <div style={{ marginBottom: '16px' }}>
        <label style={fieldLabel}>Service name</label>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Full Set Acrylics" style={fieldStyle} />
      </div>

      {/* Description */}
      <div style={{ marginBottom: '16px' }}>
        <label style={fieldLabel}>Description <span style={{ opacity: 0.6 }}>(optional)</span></label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="What's included…" rows={2} style={{ ...fieldStyle, resize: 'none' }} />
      </div>

      {/* Duration + Price row */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Duration</label>
          <select value={duration} onChange={e => setDuration(parseInt(e.target.value))} style={fieldStyle}>
            {DURATION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={fieldLabel}>Price (AED)</label>
          <input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="0" min="0" style={fieldStyle} />
        </div>
      </div>

      {/* Deposit */}
      <div style={{ marginBottom: '4px' }}>
        <label style={fieldLabel}>Deposit (AED) <span style={{ opacity: 0.6 }}>(optional)</span></label>
        <input type="number" value={deposit} onChange={e => setDeposit(e.target.value)} placeholder="0 — no deposit required" min="0" style={fieldStyle} />
        <p style={{ ...ui(400, 11, WHITE60), margin: '6px 0 0', lineHeight: 1.5 }}>
          Clients will see this deposit requirement when booking.
        </p>
      </div>
    </Sheet>
  )
}

export default function ServicesPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSheet, setShowSheet] = useState(false)
  const [editingService, setEditingService] = useState(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/profile'); return }
      const { data: profile } = await supabase.from('profiles').select('account_type').eq('id', user.id).single()
      if (!profile || !['nail_artist', 'creator', 'salon'].includes(profile.account_type)) {
        router.push('/profile'); return
      }
      setCurrentUser(user)
      await loadServices(user.id)
      setLoading(false)
    }
    init()
  }, [])

  const loadServices = async (userId) => {
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('creator_id', userId)
      .order('created_at', { ascending: true })
    setServices(data || [])
  }

  const handleSave = async (fields) => {
    const { error } = editingService
      ? await supabase.from('services').update(fields).eq('id', editingService.id)
      : await supabase.from('services').insert({ ...fields, creator_id: currentUser.id })
    if (error) throw new Error('Failed to save service. Please try again.')
    await loadServices(currentUser.id)
    setShowSheet(false)
    setEditingService(null)
  }

  const handleToggle = async (service) => {
    const { error } = await supabase.from('services').update({ is_active: !service.is_active }).eq('id', service.id)
    if (error) { alert('Failed to update service. Please try again.'); return }
    await loadServices(currentUser.id)
  }

  const formatDuration = (mins) => {
    if (mins < 60) return `${mins} min`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`
  }

  const Shell = ({ children }) => (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}>{children}</div>
    </div>
  )

  if (loading) return (
    <Shell>
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={ui(300, 14, WHITE60)}>Loading…</p>
      </div>
    </Shell>
  )

  return (
    <Shell>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: 'calc(env(safe-area-inset-top) + 16px) 20px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <BackButton fallback="/profile" />
          <h1 style={{ ...display(24), margin: 0 }}>My Services</h1>
        </div>
        <button
          onClick={() => { setEditingService(null); setShowSheet(true) }}
          style={{ background: BTN_GRADIENT, color: 'var(--lq-white)', border: 'none', borderRadius: '1000px', padding: '8px 16px', ...ui(500, 13), cursor: 'pointer', flexShrink: 0 }}
        >
          + Add
        </button>
      </div>

      {/* Empty state */}
      {services.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px', color: ACCENT }}>✦</div>
          <p style={{ ...ui(500, 16), margin: '0 0 8px' }}>No services yet</p>
          <p style={{ ...ui(300, 13, WHITE60), margin: '0 0 24px' }}>Add the services you offer so clients can book you.</p>
          <button
            onClick={() => { setEditingService(null); setShowSheet(true) }}
            style={{ background: BTN_GRADIENT, color: 'var(--lq-white)', border: 'none', borderRadius: '1000px', padding: '12px 24px', ...ui(600, 14), cursor: 'pointer' }}
          >
            Add your first service
          </button>
        </div>
      )}

      {/* Services list */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {services.map(service => (
          <div key={service.id} style={{ background: PANEL, borderRadius: '16px', border: `1px solid ${service.is_active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)'}`, padding: '16px', opacity: service.is_active ? 1 : 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ ...ui(600, 15), margin: '0 0 4px' }}>{service.name}</p>
                {service.description && (
                  <p style={{ ...ui(300, 12, WHITE60), margin: '0 0 8px', lineHeight: 1.5 }}>{service.description}</p>
                )}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={ui(600, 13, ACCENT)}>
                    {service.price > 0 ? `AED ${service.price}` : 'Free'}
                  </span>
                  <span style={ui(400, 13, WHITE60)}>{formatDuration(service.duration_minutes)}</span>
                  {service.deposit_amount > 0 && (
                    <span style={ui(400, 13, WHITE60)}>· AED {service.deposit_amount} deposit</span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '12px' }}>
                {/* Toggle active */}
                <button
                  onClick={() => handleToggle(service)}
                  style={{ background: service.is_active ? 'rgba(255,81,127,0.15)' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px', padding: '6px 10px', ...ui(500, 11, service.is_active ? ACCENT : WHITE60), cursor: 'pointer' }}
                >
                  {service.is_active ? 'Active' : 'Hidden'}
                </button>
                {/* Edit */}
                <button
                  onClick={() => { setEditingService(service); setShowSheet(true) }}
                  aria-label={`Edit ${service.name}`}
                  style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit sheet */}
      {showSheet && (
        <ServiceSheet
          service={editingService}
          onSave={handleSave}
          onClose={() => { setShowSheet(false); setEditingService(null) }}
        />
      )}
    </Shell>
  )
}
