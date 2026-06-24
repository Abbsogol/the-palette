'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const DURATION_OPTIONS = [
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hr', value: 60 },
  { label: '1.5 hr', value: 90 },
  { label: '2 hr', value: 120 },
  { label: '2.5 hr', value: 150 },
  { label: '3 hr', value: 180 },
]

function ServiceSheet({ service, onSave, onClose }) {
  const [name, setName] = useState(service?.name || '')
  const [description, setDescription] = useState(service?.description || '')
  const [duration, setDuration] = useState(service?.duration_minutes || 60)
  const [price, setPrice] = useState(service?.price ?? '')
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!name.trim()) return
    setSaving(true)
    await onSave({ name: name.trim(), description: description.trim(), duration_minutes: duration, price: parseFloat(price) || 0 })
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100 }}>
      <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 101, background: 'var(--bg-card)', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', fontFamily: "'DM Sans', sans-serif", maxHeight: '88dvh', overflowY: 'auto' }}>
        <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)', margin: '0 auto 20px' }} />
        <h2 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: '0 0 20px' }}>
          {service ? 'Edit service' : 'Add service'}
        </h2>

        {/* Name */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Service name</label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Full Set Acrylics"
            style={{ width: '100%', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Description */}
        <div style={{ marginBottom: '16px' }}>
          <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Description <span style={{ opacity: 0.5 }}>(optional)</span></label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What's included..."
            rows={2}
            style={{ width: '100%', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none', resize: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {/* Duration + Price row */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '24px' }}>
          <div style={{ flex: 1 }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Duration</label>
            <select
              value={duration}
              onChange={e => setDuration(parseInt(e.target.value))}
              style={{ width: '100%', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
            >
              {DURATION_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', display: 'block', marginBottom: '6px' }}>Price (AED)</label>
            <input
              type="number"
              value={price}
              onChange={e => setPrice(e.target.value)}
              placeholder="0"
              min="0"
              style={{ width: '100%', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '12px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", outline: 'none', boxSizing: 'border-box' }}
            />
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={!name.trim() || saving}
          style={{ width: '100%', background: name.trim() ? 'var(--accent)' : 'var(--bg-chip)', color: name.trim() ? '#2C0A1E' : 'var(--text-secondary)', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: name.trim() ? 'pointer' : 'not-allowed' }}
        >
          {saving ? 'Saving…' : service ? 'Save changes' : 'Add service'}
        </button>
      </div>
    </div>
  )
}

export default function ServicesPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showSheet, setShowSheet] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
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
    if (editingService) {
      await supabase.from('services').update(fields).eq('id', editingService.id)
    } else {
      await supabase.from('services').insert({ ...fields, creator_id: currentUser.id })
    }
    await loadServices(currentUser.id)
    setShowSheet(false)
    setEditingService(null)
  }

  const handleDelete = async (service) => {
    setDeleting(service.id)
    await supabase.from('services').update({ is_active: false }).eq('id', service.id)
    await loadServices(currentUser.id)
    setDeleting(null)
  }

  const handleToggle = async (service) => {
    await supabase.from('services').update({ is_active: !service.is_active }).eq('id', service.id)
    await loadServices(currentUser.id)
  }

  const formatDuration = (mins) => {
    if (mins < 60) return `${mins} min`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h} hr ${m} min` : `${h} hr`
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '40px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/profile" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </Link>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0 }}>My Services</h1>
        </div>
        <button
          onClick={() => { setEditingService(null); setShowSheet(true) }}
          style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '20px', padding: '7px 14px', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}
        >
          + Add
        </button>
      </div>

      {/* Empty state */}
      {services.length === 0 && (
        <div style={{ padding: '60px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>✦</div>
          <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '500', margin: '0 0 8px' }}>No services yet</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 24px' }}>Add the services you offer so clients can book you.</p>
          <button
            onClick={() => { setEditingService(null); setShowSheet(true) }}
            style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '12px', padding: '12px 24px', fontSize: '14px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}
          >
            Add your first service
          </button>
        </div>
      )}

      {/* Services list */}
      <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {services.map(service => (
          <div key={service.id} style={{ background: 'var(--bg-card)', borderRadius: '14px', border: `0.5px solid ${service.is_active ? 'var(--border)' : 'rgba(255,255,255,0.05)'}`, padding: '16px', opacity: service.is_active ? 1 : 0.5 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px' }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '600', margin: '0 0 4px' }}>{service.name}</p>
                {service.description && (
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 8px', lineHeight: '1.5' }}>{service.description}</p>
                )}
                <div style={{ display: 'flex', gap: '12px' }}>
                  <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '600' }}>
                    {service.price > 0 ? `AED ${service.price}` : 'Free'}
                  </span>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
                    {formatDuration(service.duration_minutes)}
                  </span>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginLeft: '12px' }}>
                {/* Toggle active */}
                <button
                  onClick={() => handleToggle(service)}
                  style={{ background: service.is_active ? 'rgba(212,160,192,0.15)' : 'var(--bg-chip)', border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: '500', color: service.is_active ? 'var(--accent)' : 'var(--text-secondary)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                >
                  {service.is_active ? 'Active' : 'Hidden'}
                </button>
                {/* Edit */}
                <button
                  onClick={() => { setEditingService(service); setShowSheet(true) }}
                  style={{ background: 'var(--bg-chip)', border: 'none', borderRadius: '8px', padding: '6px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
    </div>
  )
}
