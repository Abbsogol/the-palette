'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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

export default function UploadPage() {
  const router = useRouter()
  const [user, setUser]       = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [atLimit, setAtLimit] = useState(false)
  const [uploadsLeft, setUploadsLeft] = useState(FREE_LIMIT)
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

      // Reset weekly count if 7+ days have passed
      const lastReset = prof.week_reset_at ? new Date(prof.week_reset_at) : new Date(0)
      const daysSince = (Date.now() - lastReset.getTime()) / (1000 * 60 * 60 * 24)
      if (daysSince >= 7) {
        const reset = { weekly_uploads: 0, week_reset_at: new Date().toISOString() }
        await supabase.from('profiles').update(reset).eq('id', u.id)
        prof = { ...prof, ...reset }
      }

      setProfile(prof)
      const used  = prof.weekly_uploads || 0
      const isPro = prof.is_pro || false
      setUploadsLeft(isPro ? Infinity : Math.max(0, FREE_LIMIT - used))
      setAtLimit(!isPro && used >= FREE_LIMIT)
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
      // Upload image to Supabase Storage
      const ext      = imageFile.name.split('.').pop()
      const fileName = `${Date.now()}-${title.toLowerCase().replace(/\s+/g, '-')}.${ext}`
      const { error: storageErr } = await supabase.storage
        .from('designs').upload(fileName, imageFile, { cacheControl: '3600', upsert: false })
      if (storageErr) throw new Error('Photo upload failed: ' + storageErr.message)
      const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(fileName)

      // Insert design row
      const { data: design, error: designErr } = await supabase.from('designs').insert({
        title:       title.trim(),
        description: description.trim() || null,
        image_url:   publicUrl,
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
        await supabase.from('design_colours').insert(
          validColours.map((c, i) => ({
            design_id:    design.id,
            colour_name:  c.colour_name  || null,
            hex_code:     c.hex_code     || null,
            brand_name:   c.brand_name   || null,
            brand_code:   c.brand_code   || null,
            colour_order: i + 1,
          }))
        )
      }

      // Tags
      const tagNames = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      for (const tagName of tagNames) {
        const { data: tag } = await supabase.from('tags')
          .upsert({ name: tagName }, { onConflict: 'name' }).select().single()
        if (tag) await supabase.from('design_tags')
          .upsert({ design_id: design.id, tag_id: tag.id }, { onConflict: 'design_id,tag_id' })
      }

      // Increment weekly upload count
      await supabase.from('profiles').update({
        weekly_uploads: (profile.weekly_uploads || 0) + 1,
      }).eq('id', user.id)

      // Reward for posting a design
      const { data: { session } } = await supabase.auth.getSession()
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
    width: '100%', background: 'var(--bg-card)',
    border: '0.5px solid var(--border)', borderRadius: '10px',
    padding: '12px 14px', color: 'var(--text-primary)',
    fontSize: '14px', fontFamily: "'DM Sans', sans-serif",
    outline: 'none', boxSizing: 'border-box',
  }
  const label = {
    color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '500',
    letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px',
    display: 'block',
  }
  const chip = (active) => ({
    padding: '7px 13px', borderRadius: '20px', fontSize: '12px',
    cursor: 'pointer', border: 'none',
    background: active ? 'var(--accent)' : 'var(--bg-chip)',
    color: active ? '#2C0A1E' : 'var(--text-secondary)',
    fontFamily: "'DM Sans', sans-serif",
    fontWeight: active ? '600' : '400',
    transition: 'all 0.15s ease',
  })

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'60vh' }}>
      <p style={{ color:'var(--text-secondary)', fontSize:'14px' }}>Loading...</p>
    </div>
  )

  // ── Success ─────────────────────────────────────────────────────────────────
  if (success) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'60vh', gap:'14px', padding:'24px', textAlign:'center' }}>
      <div style={{ width:'56px', height:'56px', borderRadius:'50%', background:'rgba(212,160,192,0.15)', border:'1px solid rgba(212,160,192,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px' }}>✓</div>
      <p style={{ color:'var(--text-primary)', fontSize:'18px', fontWeight:'600' }}>Design published!</p>
      <p style={{ color:'var(--text-secondary)', fontSize:'14px' }}>Taking you there now...</p>
    </div>
  )

  // ── Weekly limit hit ────────────────────────────────────────────────────────
  if (atLimit) return (
    <div style={{ padding:'24px 20px', display:'flex', flexDirection:'column', gap:'16px' }}>
      <Link href="/profile" style={{ color:'var(--text-secondary)', fontSize:'13px', textDecoration:'none' }}>← Back</Link>
      <div style={{ background:'var(--bg-card)', border:'1px solid rgba(212,160,192,0.3)', borderRadius:'16px', padding:'32px 20px', textAlign:'center' }}>
        <p style={{ fontSize:'36px', marginBottom:'14px' }}>⚡</p>
        <p style={{ color:'var(--text-primary)', fontSize:'18px', fontWeight:'600', marginBottom:'8px' }}>Weekly limit reached</p>
        <p style={{ color:'var(--text-secondary)', fontSize:'14px', lineHeight:'1.6', marginBottom:'24px' }}>
          You've used all {FREE_LIMIT} free uploads this week.<br />
          Upgrade to Pro for unlimited uploads.
        </p>
        <div style={{ background:'linear-gradient(145deg, rgba(212,160,192,0.10), rgba(212,160,192,0.03))', border:'1px solid rgba(212,160,192,0.35)', borderRadius:'12px', padding:'18px', marginBottom:'16px' }}>
          <p style={{ color:'var(--accent)', fontWeight:'600', fontSize:'15px', marginBottom:'6px' }}>Pro Creator · $15/mo</p>
          <p style={{ color:'var(--text-secondary)', fontSize:'13px', lineHeight:'1.5' }}>Unlimited uploads · Analytics · Featured in discovery</p>
        </div>
        <p style={{ color:'var(--text-secondary)', fontSize:'12px', opacity:0.6 }}>Pro subscriptions launching soon. Your limit resets in a few days.</p>
      </div>
    </div>
  )

  // ── Upload form ─────────────────────────────────────────────────────────────
  return (
    <div style={{ padding:'20px 20px 100px', display:'flex', flexDirection:'column', gap:'22px' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <Link href="/profile" style={{ color:'var(--text-secondary)', fontSize:'13px', textDecoration:'none' }}>← Back</Link>
        <p style={{ color:'var(--text-primary)', fontSize:'16px', fontWeight:'600' }}>Add Design</p>
        <p style={{ color: uploadsLeft <= 1 ? 'var(--accent)' : 'var(--text-secondary)', fontSize:'12px' }}>
          {uploadsLeft === Infinity ? '' : `${uploadsLeft} left this week`}
        </p>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background:'rgba(180,60,60,0.12)', border:'0.5px solid rgba(180,60,60,0.35)', borderRadius:'10px', padding:'12px 14px' }}>
          <p style={{ color:'#e57373', fontSize:'13px' }}>{error}</p>
        </div>
      )}

      {/* ── Photo ── */}
      <div>
        <span style={label}>Design Photo *</span>
        <label style={{ display:'block', cursor:'pointer' }}>
          {imagePreview
            ? <img src={imagePreview} alt="Preview" style={{ width:'100%', borderRadius:'14px', display:'block', maxHeight:'380px', objectFit:'contain', background:'var(--bg-card)' }} />
            : <div style={{ width:'100%', aspectRatio:'4/5', background:'var(--bg-card)', border:'0.5px dashed var(--border)', borderRadius:'14px', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'10px' }}>
                <span style={{ color:'var(--text-secondary)', fontSize:'32px', opacity:0.4 }}>+</span>
                <p style={{ color:'var(--text-secondary)', fontSize:'13px' }}>Tap to add photo</p>
              </div>
          }
          <input type="file" accept="image/*"
            onChange={e => { const f = e.target.files[0]; if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)) } }}
            style={{ display:'none' }} />
        </label>
        {imagePreview && (
          <button onClick={() => { setImageFile(null); setImagePreview(null) }}
            style={{ marginTop:'8px', background:'none', border:'0.5px solid var(--border)', borderRadius:'8px', padding:'6px 14px', color:'var(--text-secondary)', fontSize:'12px', fontFamily:"'DM Sans', sans-serif", cursor:'pointer' }}>
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
          style={{ ...input, resize:'vertical', lineHeight:'1.6' }} />
      </div>

      {/* ── Shape & Length ── */}
      <div>
        <span style={label}>Shape & Length</span>
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
          {TECHNIQUES.map(t => (
            <button key={t} onClick={() => toggle(techniques, setTechniques, t)} style={chip(techniques.includes(t))}>{t}</button>
          ))}
        </div>
      </div>

      {/* ── Colour specs ── */}
      <div>
        <span style={label}>Colour Specs</span>
        {colours.map((c, i) => (
          <div key={i} style={{ background:'var(--bg-card)', border:'0.5px solid var(--border)', borderRadius:'12px', padding:'14px', marginBottom:'10px' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
              <div style={{ width:'32px', height:'32px', borderRadius:'8px', background: c.hex_code || 'var(--bg-chip)', border:'0.5px solid rgba(255,255,255,0.1)', flexShrink:0 }} />
              <input value={c.hex_code} onChange={e => updateColour(i, 'hex_code', e.target.value)} placeholder="#hex code" style={{ ...input, flex:1 }} />
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              <input value={c.colour_name} onChange={e => updateColour(i, 'colour_name', e.target.value)} placeholder="Colour name" style={input} />
              <input value={c.brand_name}  onChange={e => updateColour(i, 'brand_name',  e.target.value)} placeholder="Brand"        style={input} />
              <input value={c.brand_code}  onChange={e => updateColour(i, 'brand_code',  e.target.value)} placeholder="Brand code"   style={{ ...input, gridColumn:'1 / -1' }} />
            </div>
            {colours.length > 1 && (
              <button onClick={() => setColours(prev => prev.filter((_, idx) => idx !== i))}
                style={{ marginTop:'8px', background:'none', border:'none', color:'#e57373', fontSize:'12px', fontFamily:"'DM Sans', sans-serif", cursor:'pointer' }}>
                Remove colour
              </button>
            )}
          </div>
        ))}
        <button onClick={() => setColours(prev => [...prev, { colour_name:'', hex_code:'', brand_name:'', brand_code:'' }])}
          style={{ background:'none', border:'0.5px solid var(--border)', borderRadius:'8px', padding:'8px 16px', color:'var(--text-secondary)', fontSize:'13px', fontFamily:"'DM Sans', sans-serif", cursor:'pointer' }}>
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
        width:'100%', background:'var(--accent)', color:'#2C0A1E',
        border:'none', borderRadius:'14px', padding:'16px',
        fontSize:'15px', fontWeight:'600', fontFamily:"'DM Sans', sans-serif",
        cursor: submitting ? 'not-allowed' : 'pointer',
        opacity: submitting ? 0.7 : 1,
        transition:'opacity 0.15s ease',
      }}>
        {submitting ? 'Publishing...' : 'Publish Design'}
      </button>
    </div>
  )
}
