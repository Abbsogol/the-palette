'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'

const ACCENT = '#FF517F'
const WINE = '#260D14'
const WHITE60 = 'rgba(255,255,255,0.6)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

const SHAPES = ['Round', 'Square', 'Oval', 'Coffin', 'Almond', 'Stiletto', 'Ballerina', 'Squoval']
const LENGTHS = ['Short', 'Medium', 'Long', 'Extra Long']
const OCCASIONS = [
  'Everyday', 'Night Out', 'Wedding', 'Bridal', 'Party', 'Birthday',
  'Office', 'Date Night', 'Editorial', 'Statement', 'Festival',
  'Holiday', 'Vacation', "New Year's", 'Christmas', 'Halloween',
  "Valentine's", 'Summer', 'Autumn', 'Winter', 'Spring',
]
const TECHNIQUES = [
  'Gel', 'Acrylic', 'Dip Powder', 'Polygel', 'Hard Gel', 'BIAB',
  'Nail Polish', 'Press-on', 'Chrome Powder', 'Cat Eye', '3D Gel',
  'Nail Art', 'Stamping', 'Water Marble', 'Ombre', 'Glitter',
  'Foil', 'Encapsulated', 'Builder Gel', 'Airbrush',
]

const FREE_LIMIT = 5

const Shell = ({ children }) => (
  <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
    <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
    <div style={{ position: 'relative' }}>{children}</div>
  </div>
)

export default function UploadPage() {
  const router = useRouter()
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)
  const [atLimit, setAtLimit] = useState(false)
  const [uploadsLeft, setUploadsLeft] = useState(FREE_LIMIT)
  const [resetAt, setResetAt] = useState(null)
  const [success, setSuccess] = useState(false)

  // Form
  const [imageFile, setImageFile]     = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [shape, setShape]             = useState('')
  const [length, setLength]           = useState('')
  const [occasions, setOccasions]     = useState([])
  const [techniques, setTechniques]   = useState([])
  const [colours, setColours]         = useState([{ colour_name: '', hex_code: '', brand_name: '', brand_code: '' }])
  const [tagsInput, setTagsInput]     = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { router.push('/profile'); return }
      const u = session.user
      setUser(u)

      let { data: prof } = await supabase.from('profiles').select('*').eq('id', u.id).single()

      // Must be a creator or salon
      if (prof?.account_type !== 'creator' && prof?.account_type !== 'salon') {
        router.push('/profile')
        return
      }

      // Reset weekly count if 7+ days have passed. This write is
      // display-only — the server-side enforce_weekly_upload_limit trigger
      // independently recomputes the same 7-day reset at insert time, so a
      // failure here can't let anyone bypass the real limit. But the local
      // "uploads left" count should only reflect the reset if it actually
      // persisted, so the UI never claims more availability than the
      // server will honor.
      const lastReset = prof.week_reset_at ? new Date(prof.week_reset_at) : new Date(0)
      const daysSince = (Date.now() - lastReset.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince >= 7) {
        const reset = { weekly_uploads: 0, week_reset_at: new Date().toISOString() }
        const { error: resetError } = await supabase.from('profiles').update(reset).eq('id', u.id)
        if (resetError) console.error('weekly reset failed:', resetError)
        else prof = { ...prof, ...reset }
      }

      const used  = prof.weekly_uploads || 0
      const isPro = prof.subscription_tier === 'pro_creator'
      setUploadsLeft(isPro ? Infinity : Math.max(0, FREE_LIMIT - used))
      setAtLimit(!isPro && used >= FREE_LIMIT)
      // Limit resets 7 days after the current window start (week_reset_at) —
      // the same value enforce_weekly_upload_limit uses, so this is the real date.
      setResetAt(prof.week_reset_at ? new Date(new Date(prof.week_reset_at).getTime() + 7 * 86400000) : null)
      setLoading(false)
    })
  }, [])

  const toggle = (list, setList, item) =>
    setList(prev => prev.includes(item) ? prev.filter(x => x !== item) : [...prev, item])

  const updateColour = (i, field, val) =>
    setColours(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: val } : c))

  const handleSubmit = async () => {
    setError('')
    if (!imageFile)    { setError('Please select a photo'); return }
    if (!title.trim()) { setError('Please enter a title'); return }
    setSubmitting(true)
    try {
      // Upload image via server route — storage RLS blocks direct client uploads to this bucket
      const { data: { session } } = await supabase.auth.getSession()
      const formData = new FormData()
      formData.append('file', imageFile)
      formData.append('title', title.trim())
      const uploadRes = await fetch('/api/upload-design-photo', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: formData,
      })
      const uploadJson = await uploadRes.json().catch(() => ({}))
      if (!uploadRes.ok || uploadJson.error) throw new Error('Photo upload failed: ' + (uploadJson.error || 'Unknown error'))
      const publicUrl = uploadJson.publicUrl
      const uploadedDims = { image_width: uploadJson.width ?? null, image_height: uploadJson.height ?? null }

      // Insert design row
      const { data: design, error: designErr } = await supabase.from('designs').insert({
        title:       title.trim(),
        description: description.trim() || null,
        image_url:   publicUrl,
        ...uploadedDims,
        shape:       shape   || null,
        length:      length  || null,
        occasion:    occasions.join(', ')  || null,
        technique:   techniques.join(', ') || null,
        is_published: true,
        created_by:   user.id,
      }).select().single()
      if (designErr) throw new Error(designErr.message)

      // Colour specs
      const validColours = colours.filter(c => c.hex_code.trim() || c.colour_name.trim())
      if (validColours.length > 0) {
        const { error: coloursErr } = await supabase.from('design_colours').insert(
          validColours.map((c, i) => ({
            design_id:    design.id,
            colour_name:  c.colour_name  || null,
            hex_code:     c.hex_code     || null,
            brand_name:   c.brand_name   || null,
            brand_code:   c.brand_code   || null,
            colour_order: i + 1,
          }))
        )
        if (coloursErr) throw new Error('Failed to save colours: ' + coloursErr.message)
      }

      // Tags + weekly upload count — via server route (tags table and profiles
      // updates are blocked by RLS for direct client writes)
      const tagNames = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      const finalizeRes = await fetch('/api/finalize-design-upload', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ designId: design.id, tagNames }),
      })
      if (!finalizeRes.ok) {
        throw new Error('Design was uploaded, but tags/weekly count failed to save. Please contact support if this repeats.')
      }

      // Reward for posting a design
      fetch('/api/add-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify({ reason: 'post_design', ref_id: design.id }),
      })

      setSuccess(true)
      setTimeout(() => router.push(`/design/${design.id}`), 1500)
    } catch (err) {
      setError(err.message?.includes('WEEKLY_UPLOAD_LIMIT')
        ? "You've reached your 5 free uploads this week. Upgrade to Pro for unlimited uploads."
        : err.message)
      setSubmitting(false)
    }
  }

  // ── Styles ─────────────────────────────────────────────────────────────────
  const input = {
    width: '100%', background: 'rgba(255,255,255,0.04)',
    border: PANEL_BORDER, borderRadius: '12px',
    padding: '12px 14px', ...ui(400, 14),
    outline: 'none', boxSizing: 'border-box',
  }
  const label = { ...ui(500, 11, WHITE60), letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px', display: 'block' }
  const chip = (active) => ({
    padding: '7px 13px', borderRadius: '1000px', cursor: 'pointer', border: active ? 'none' : PANEL_BORDER,
    background: active ? ACCENT : 'rgba(255,255,255,0.06)', ...ui(active ? 600 : 400, 12, active ? WINE : WHITE60),
  })

  const resetText = () => {
    if (!resetAt) return 'Your limit resets in a few days.'
    const days = Math.ceil((resetAt.getTime() - Date.now()) / 86400000)
    if (days <= 0) return 'Your limit resets today.'
    if (days === 1) return 'Your limit resets tomorrow.'
    return `Your limit resets in ${days} days.`
  }

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <Shell>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'70vh' }}>
        <p style={ui(300, 14, WHITE60)}>Loading…</p>
      </div>
    </Shell>
  )

  // ── Success ─────────────────────────────────────────────────────────────────
  if (success) return (
    <Shell>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'70vh', gap:'14px', padding:'24px', textAlign:'center' }}>
        <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'rgba(255,81,127,0.15)', border:`1px solid ${ACCENT}`, display:'flex', alignItems:'center', justifyContent:'center', ...ui(400, 24, ACCENT) }}>✓</div>
        <p style={display(20)}>Design published!</p>
        <p style={ui(300, 14, WHITE60)}>Taking you there now…</p>
      </div>
    </Shell>
  )

  // ── Weekly limit hit ────────────────────────────────────────────────────────
  if (atLimit) return (
    <Shell>
      <div style={{ padding:'calc(env(safe-area-inset-top) + 16px) 20px 20px', display:'flex', flexDirection:'column', gap:'16px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <BackButton fallback="/profile" />
          <h1 style={{ ...display(24), margin:0 }}>Add Design</h1>
        </div>
        <div style={{ background:PANEL, border:'1px solid rgba(255,81,127,0.3)', borderRadius:'16px', padding:'32px 20px', textAlign:'center' }}>
          <p style={{ fontSize:'36px', marginBottom:'14px' }}>⚡</p>
          <p style={{ ...ui(600, 18), marginBottom:'8px' }}>Weekly limit reached</p>
          <p style={{ ...ui(300, 14, WHITE60), lineHeight:1.6, marginBottom:'24px' }}>
            You&apos;ve used all {FREE_LIMIT} free uploads this week.<br />
            Upgrade to Pro for unlimited uploads.
          </p>
          <Link href="/upgrade" style={{ display:'block', textDecoration:'none', background:'linear-gradient(145deg, rgba(255,81,127,0.10), rgba(255,81,127,0.03))', border:'1px solid rgba(255,81,127,0.35)', borderRadius:'12px', padding:'18px', marginBottom:'16px' }}>
            <p style={{ ...ui(600, 15, ACCENT), marginBottom:'6px' }}>Pro Creator · AED 49/mo</p>
            <p style={{ ...ui(300, 13, WHITE60), lineHeight:1.5, marginBottom:'12px' }}>Unlimited uploads · Analytics · Featured in discovery</p>
            <span style={ui(600, 13, ACCENT)}>Upgrade to Pro →</span>
          </Link>
          <p style={{ ...ui(300, 12, WHITE60), opacity:0.7 }}>{resetText()}</p>
        </div>
      </div>
    </Shell>
  )

  // ── Upload form ─────────────────────────────────────────────────────────────
  return (
    <Shell>
      <div style={{ padding:'calc(env(safe-area-inset-top) + 16px) 20px calc(env(safe-area-inset-bottom) + 120px)', display:'flex', flexDirection:'column', gap:'22px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <BackButton fallback="/profile" />
          <h1 style={{ ...display(24), margin:0, flex:1 }}>Add Design</h1>
          <p style={ui(400, 12, uploadsLeft <= 1 ? ACCENT : WHITE60)}>
            {uploadsLeft === Infinity ? '' : `${uploadsLeft} left this week`}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{ background:'rgba(224,112,112,0.12)', border:'1px solid rgba(224,112,112,0.35)', borderRadius:'12px', padding:'12px 14px' }}>
            <p style={ui(400, 13, '#FF8DA8')}>{error}</p>
          </div>
        )}

        {/* ── Photo ── */}
        <div>
          <span style={label}>Design Photo *</span>
          <label style={{ display:'block', cursor:'pointer' }}>
            {imagePreview
              ? <img src={imagePreview} alt="Preview" style={{ width:'100%', borderRadius:'14px', display:'block', maxHeight:'380px', objectFit:'contain', background:PANEL }} />
              : <div style={{ width:'100%', aspectRatio:'4/5', background:PANEL, border:'1px dashed rgba(255,255,255,0.25)', borderRadius:'14px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'10px' }}>
                  <span style={ui(300, 32, 'rgba(255,255,255,0.4)')}>+</span>
                  <p style={ui(300, 13, WHITE60)}>Tap to add photo</p>
                </div>
            }
            <input type="file" accept="image/*"
              onChange={e => { const f = e.target.files[0]; if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)) } }}
              style={{ display:'none' }} />
          </label>
          {imagePreview && (
            <button onClick={() => { setImageFile(null); setImagePreview(null) }}
              style={{ marginTop:'8px', background:'none', border:PANEL_BORDER, borderRadius:'1000px', padding:'6px 14px', ...ui(400, 12, WHITE60), cursor:'pointer' }}>
              Remove
            </button>
          )}
        </div>

        {/* ── Title ── */}
        <div>
          <span style={label}>Title *</span>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Midnight Lace" style={input} />
        </div>

        {/* ── Description ── */}
        <div>
          <span style={label}>Description</span>
          <textarea value={description} onChange={e => setDescription(e.target.value)}
            placeholder="Describe the vibe, technique, or inspiration" rows={3}
            style={{ ...input, resize:'vertical', lineHeight:1.6 }} />
        </div>

        {/* ── Shape & Length ── */}
        <div>
          <span style={label}>Shape &amp; Length</span>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
            <select value={shape} onChange={e => setShape(e.target.value)} style={{ ...input, appearance:'none' }}>
              <option value="">Shape</option>
              {SHAPES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
            <select value={length} onChange={e => setLength(e.target.value)} style={{ ...input, appearance:'none' }}>
              <option value="">Length</option>
              {LENGTHS.map(l => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
        </div>

        {/* ── Occasions ── */}
        <div>
          <span style={label}>Occasion</span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
            {OCCASIONS.map(o => (
              <button key={o} onClick={() => toggle(occasions, setOccasions, o)} style={chip(occasions.includes(o))}>{o}</button>
            ))}
          </div>
        </div>

        {/* ── Techniques ── */}
        <div>
          <span style={label}>Technique</span>
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px' }}>
            {TECHNIQUES.map(tk => (
              <button key={tk} onClick={() => toggle(techniques, setTechniques, tk)} style={chip(techniques.includes(tk))}>{tk}</button>
            ))}
          </div>
        </div>

        {/* ── Colour specs ── */}
        <div>
          <span style={label}>Colour Specs</span>
          {colours.map((c, i) => (
            <div key={i} style={{ background:PANEL, border:PANEL_BORDER, borderRadius:'12px', padding:'14px', marginBottom:'10px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                <div style={{ width:'32px', height:'32px', borderRadius:'8px', background: c.hex_code || 'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }} />
                <input value={c.hex_code} onChange={e => updateColour(i, 'hex_code', e.target.value)} placeholder="#hex code" style={{ ...input, flex:1 }} />
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
                <input value={c.colour_name} onChange={e => updateColour(i, 'colour_name', e.target.value)} placeholder="Colour name" style={input} />
                <input value={c.brand_name}  onChange={e => updateColour(i, 'brand_name',  e.target.value)} placeholder="Brand"        style={input} />
                <input value={c.brand_code}  onChange={e => updateColour(i, 'brand_code',  e.target.value)} placeholder="Brand code"   style={{ ...input, gridColumn:'1 / -1' }} />
              </div>
              {colours.length > 1 && (
                <button onClick={() => setColours(prev => prev.filter((_, idx) => idx !== i))}
                  style={{ marginTop:'8px', background:'none', border:'none', ...ui(400, 12, '#E07070'), cursor:'pointer' }}>
                  Remove colour
                </button>
              )}
            </div>
          ))}
          <button onClick={() => setColours(prev => [...prev, { colour_name:'', hex_code:'', brand_name:'', brand_code:'' }])}
            style={{ background:'none', border:PANEL_BORDER, borderRadius:'1000px', padding:'8px 16px', ...ui(400, 13, WHITE60), cursor:'pointer' }}>
            + Add colour
          </button>
        </div>

        {/* ── Tags ── */}
        <div>
          <span style={label}>Tags</span>
          <input value={tagsInput} onChange={e => setTagsInput(e.target.value)}
            placeholder="e.g. dark, gothic, gel, autumn (comma separated)" style={input} />
        </div>

        {/* ── Submit ── */}
        <button onClick={handleSubmit} disabled={submitting} style={{
          width:'100%', background:BTN_GRADIENT, color:'var(--lq-white)',
          border:'none', borderRadius:'1000px', padding:'16px', ...ui(600, 15),
          cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1,
        }}>
          {submitting ? 'Publishing…' : 'Publish Design'}
        </button>
      </div>
    </Shell>
  )
}
