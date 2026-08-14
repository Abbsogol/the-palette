'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}
}

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
const PRODUCT_CATEGORIES = ['Polishes & Gels', 'Tools & Kits', 'Beauty']

// ─── Design Form ─────────────────────────────────────────────────
function DesignForm({ initial, onSave, onCancel, saveLabel }) {
  const [title, setTitle] = useState(initial?.title || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [shape, setShape] = useState(initial?.shape || '')
  const [length, setLength] = useState(initial?.length || '')
  const [selectedOccasions, setSelectedOccasions] = useState(
    initial?.occasion ? initial.occasion.split(',').map(s => s.trim()).filter(o => OCCASIONS.includes(o)) : []
  )
  const [customOccasion, setCustomOccasion] = useState(
    initial?.occasion
      ? initial.occasion.split(',').map(s => s.trim()).filter(o => !OCCASIONS.includes(o)).join(', ')
      : ''
  )
  const [selectedTechniques, setSelectedTechniques] = useState(
    initial?.technique ? initial.technique.split(',').map(s => s.trim()).filter(t => TECHNIQUES.includes(t)) : []
  )
  const [customTechnique, setCustomTechnique] = useState(
    initial?.technique
      ? initial.technique.split(',').map(s => s.trim()).filter(t => !TECHNIQUES.includes(t)).join(', ')
      : ''
  )
  const [mainImageFile, setMainImageFile] = useState(null)
  const [mainImagePreview, setMainImagePreview] = useState(initial?.image_url || null)
  const [existingExtraImages, setExistingExtraImages] = useState(initial?.extraImages || [])
  const [newExtraFiles, setNewExtraFiles] = useState([])
  const [removedExtraIds, setRemovedExtraIds] = useState([])
  const [colours, setColours] = useState(
    initial?.colours?.length
      ? initial.colours.map(c => ({ id: c.id, colour_name: c.colour_name || '', hex_code: c.hex_code || '', brand_name: c.brand_name || '', brand_code: c.brand_code || '' }))
      : [{ colour_name: '', hex_code: '', brand_name: '', brand_code: '' }]
  )
  const [tagsInput, setTagsInput] = useState(initial?.tags?.join(', ') || '')
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const toggleOccasion = o => setSelectedOccasions(prev => prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o])
  const toggleTechnique = t => setSelectedTechniques(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  const updateColour = (i, field, value) => setColours(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c))
  const addColour = () => setColours(prev => [...prev, { colour_name: '', hex_code: '', brand_name: '', brand_code: '' }])
  const removeColour = i => setColours(prev => prev.filter((_, idx) => idx !== i))

  const uploadImage = async (file, slug) => {
    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}-${slug}.${ext}`
    const { error } = await supabase.storage.from('designs').upload(fileName, file, { cacheControl: '3600', upsert: false })
    if (error) throw new Error('Image upload failed: ' + error.message)
    const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(fileName)
    return publicUrl
  }

  const removeExistingExtra = (id) => {
    setRemovedExtraIds(prev => [...prev, id])
    setExistingExtraImages(prev => prev.filter(img => img.id !== id))
  }

  const handleExtraFilesChange = (e) => {
    const files = Array.from(e.target.files)
    setNewExtraFiles(prev => [...prev, ...files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))])
  }

  const handleSubmit = async () => {
    setErrorMsg('')
    if (!title.trim()) { setErrorMsg('Title is required'); return }
    setSubmitting(true)
    try {
      const slug = title.toLowerCase().replace(/\s+/g, '-')
      const allOccasions = [...selectedOccasions]
      if (customOccasion.trim()) allOccasions.push(customOccasion.trim())
      const allTechniques = [...selectedTechniques]
      if (customTechnique.trim()) allTechniques.push(customTechnique.trim())
      let mainUrl = mainImagePreview
      if (mainImageFile) mainUrl = await uploadImage(mainImageFile, slug)
      await onSave({
        title: title.trim(),
        description: description.trim() || null,
        image_url: mainUrl,
        shape: shape || null,
        length: length || null,
        occasion: allOccasions.join(', ') || null,
        technique: allTechniques.join(', ') || null,
        colours: colours.filter(c => c.hex_code.trim() || c.colour_name.trim()),
        tagNames: tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean),
        newExtraFiles,
        removedExtraIds,
        slug,
      })
    } catch (err) {
      setErrorMsg(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Section label="Main Photo *">
        <label style={{ display: 'block', cursor: 'pointer' }}>
          {mainImagePreview
            ? <img src={mainImagePreview} alt="Preview" style={{ width: '100%', borderRadius: '12px', display: 'block', marginBottom: '8px' }} />
            : <Placeholder text="Tap to select main image" />}
          <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (f) { setMainImageFile(f); setMainImagePreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
        </label>
        {mainImagePreview && <button onClick={() => { setMainImageFile(null); setMainImagePreview(null) }} style={ghostBtn}>Remove</button>}
      </Section>

      <Section label="Additional Photos">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
          {existingExtraImages.map(img => (
            <div key={img.id} style={{ position: 'relative' }}>
              <img src={img.image_url} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '10px', display: 'block' }} />
              <button onClick={() => removeExistingExtra(img.id)} style={removeBtn}>×</button>
            </div>
          ))}
          {newExtraFiles.map((img, i) => (
            <div key={`new-${i}`} style={{ position: 'relative' }}>
              <img src={img.preview} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '10px', display: 'block' }} />
              <button onClick={() => setNewExtraFiles(prev => prev.filter((_, idx) => idx !== i))} style={removeBtn}>×</button>
            </div>
          ))}
          <label style={{ cursor: 'pointer' }}>
            <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--bg-card)', border: '0.5px dashed var(--border)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '24px', fontWeight: '300' }}>+</span>
            </div>
            <input type="file" accept="image/*" multiple onChange={handleExtraFilesChange} style={{ display: 'none' }} />
          </label>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Tap × to remove · + to add new ones</p>
      </Section>

      <Section label="Title *">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Blood Cathedral" style={inputStyle} />
      </Section>

      <Section label="Description">
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Describe the vibe, technique, or inspiration" rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }} />
      </Section>

      <Section label="Shape & Length">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <SelectDropdown label="Shape" value={shape} onChange={setShape} options={SHAPES} />
          <SelectDropdown label="Length" value={length} onChange={setLength} options={LENGTHS} />
        </div>
      </Section>

      <Section label="Occasion (select all that apply)">
        <ChipGroup items={OCCASIONS} selected={selectedOccasions} onToggle={toggleOccasion} />
        <input value={customOccasion} onChange={e => setCustomOccasion(e.target.value)} placeholder="Or add a custom occasion..." style={{ ...inputStyle, marginTop: '8px' }} />
      </Section>

      <Section label="Technique (select all that apply)">
        <ChipGroup items={TECHNIQUES} selected={selectedTechniques} onToggle={toggleTechnique} />
        <input value={customTechnique} onChange={e => setCustomTechnique(e.target.value)} placeholder="Or add a custom technique..." style={{ ...inputStyle, marginTop: '8px' }} />
      </Section>

      <Section label="Colour Specs">
        {colours.map((colour, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: colour.hex_code || 'var(--bg-chip)', border: '0.5px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
              <input value={colour.hex_code} onChange={e => updateColour(i, 'hex_code', e.target.value)} placeholder="#hex code" style={{ ...inputStyle, flex: 1 }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input value={colour.colour_name} onChange={e => updateColour(i, 'colour_name', e.target.value)} placeholder="Colour name (optional)" style={inputStyle} />
              <input value={colour.brand_name} onChange={e => updateColour(i, 'brand_name', e.target.value)} placeholder="Brand (optional)" style={inputStyle} />
              <input value={colour.brand_code} onChange={e => updateColour(i, 'brand_code', e.target.value)} placeholder="Brand code (optional)" style={{ ...inputStyle, gridColumn: '1 / -1' }} />
            </div>
            {colours.length > 1 && <button onClick={() => removeColour(i)} style={{ ...ghostBtn, marginTop: '8px', color: '#e57373' }}>Remove colour</button>}
          </div>
        ))}
        <button onClick={addColour} style={ghostBtn}>+ Add another colour</button>
      </Section>

      <Section label="Tags">
        <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="e.g. dark, gothic, gel, autumn (comma separated)" style={inputStyle} />
      </Section>

      {errorMsg && (
        <div style={{ background: 'rgba(229,115,115,0.1)', border: '0.5px solid #e57373', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
          <p style={{ color: '#e57373', fontSize: '13px' }}>{errorMsg}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        {onCancel && (
          <button onClick={onCancel} style={{ flex: 1, background: 'var(--bg-chip)', color: 'var(--text-secondary)', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Cancel
          </button>
        )}
        <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, background: submitting ? 'var(--bg-chip)' : 'var(--accent)', color: submitting ? 'var(--text-secondary)' : '#2C0A1E', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: '500', cursor: submitting ? 'not-allowed' : 'pointer' }}>
          {submitting ? 'Saving...' : saveLabel}
        </button>
      </div>
    </div>
  )
}

// ─── Product Form ─────────────────────────────────────────────────
function ProductForm({ initial, onSave, onCancel, saveLabel }) {
  const [name, setName] = useState(initial?.name || '')
  const [brand, setBrand] = useState(initial?.brand || '')
  const [category, setCategory] = useState(initial?.category || '')
  const [description, setDescription] = useState(initial?.description || '')
  const [affiliateUrl, setAffiliateUrl] = useState(initial?.affiliate_url || '')
  const [priceLabel, setPriceLabel] = useState(initial?.price_label || '')
  const [isFeatured, setIsFeatured] = useState(initial?.is_featured || false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(initial?.image_url || null)
  const [submitting, setSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const handleSubmit = async () => {
    setErrorMsg('')
    if (!name.trim()) { setErrorMsg('Product name is required'); return }
    if (!affiliateUrl.trim()) { setErrorMsg('Affiliate URL is required'); return }
    setSubmitting(true)
    try {
      let imageUrl = imagePreview
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const fileName = `product-${Date.now()}.${ext}`
        const { error } = await supabase.storage.from('designs').upload(fileName, imageFile, { cacheControl: '3600', upsert: false })
        if (error) throw new Error('Image upload failed: ' + error.message)
        imageUrl = supabase.storage.from('designs').getPublicUrl(fileName).data.publicUrl
      }
      await onSave({
        name: name.trim(),
        brand: brand.trim() || null,
        category: category || null,
        description: description.trim() || null,
        affiliate_url: affiliateUrl.trim(),
        price_label: priceLabel.trim() || null,
        is_featured: isFeatured,
        image_url: imageUrl,
      })
    } catch (err) {
      setErrorMsg(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div>
      <Section label="Product Photo">
        <label style={{ display: 'block', cursor: 'pointer' }}>
          {imagePreview
            ? <img src={imagePreview} alt="Preview" style={{ width: '100%', maxHeight: '200px', objectFit: 'contain', borderRadius: '12px', display: 'block', marginBottom: '8px', background: 'var(--bg-chip)' }} />
            : <Placeholder text="Tap to select product image" />}
          <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (f) { setImageFile(f); setImagePreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
        </label>
        {imagePreview && <button onClick={() => { setImageFile(null); setImagePreview(null) }} style={ghostBtn}>Remove</button>}
      </Section>

      <Section label="Product Name *">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. OPI Nail Lacquer" style={inputStyle} />
      </Section>

      <Section label="Brand">
        <input value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. OPI, Gelish, ORLY" style={inputStyle} />
      </Section>

      <Section label="Category">
        <select value={category} onChange={e => setCategory(e.target.value)} style={{ ...inputStyle, color: category ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
          <option value="">Select category</option>
          {PRODUCT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </Section>

      <Section label="Description">
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief product description" rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }} />
      </Section>

      <Section label="Affiliate URL *">
        <input value={affiliateUrl} onChange={e => setAffiliateUrl(e.target.value)} placeholder="https://www.amazon.com/dp/...?tag=laque-20" style={inputStyle} />
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '6px' }}>Make sure to include ?tag=laque-20 in the URL</p>
      </Section>

      <Section label="Price">
        <input value={priceLabel} onChange={e => setPriceLabel(e.target.value)} placeholder="e.g. $14.99" style={inputStyle} />
      </Section>

      <Section label="Featured">
        <button
          onClick={() => setIsFeatured(!isFeatured)}
          style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
          }}
        >
          <div style={{
            width: '44px', height: '24px', borderRadius: '12px',
            background: isFeatured ? 'var(--accent)' : 'var(--bg-chip)',
            position: 'relative', transition: 'background 0.2s',
          }}>
            <div style={{
              position: 'absolute', top: '3px',
              left: isFeatured ? '23px' : '3px',
              width: '18px', height: '18px', borderRadius: '50%',
              background: isFeatured ? '#2C0A1E' : 'var(--text-secondary)',
              transition: 'left 0.2s',
            }} />
          </div>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'inherit' }}>
            {isFeatured ? 'Featured (shown first)' : 'Not featured'}
          </span>
        </button>
      </Section>

      {errorMsg && (
        <div style={{ background: 'rgba(229,115,115,0.1)', border: '0.5px solid #e57373', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
          <p style={{ color: '#e57373', fontSize: '13px' }}>{errorMsg}</p>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px' }}>
        {onCancel && (
          <button onClick={onCancel} style={{ flex: 1, background: 'var(--bg-chip)', color: 'var(--text-secondary)', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Cancel
          </button>
        )}
        <button onClick={handleSubmit} disabled={submitting} style={{ flex: 2, background: submitting ? 'var(--bg-chip)' : 'var(--accent)', color: submitting ? 'var(--text-secondary)' : '#2C0A1E', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: '500', cursor: submitting ? 'not-allowed' : 'pointer' }}>
          {submitting ? 'Saving...' : saveLabel}
        </button>
      </div>
    </div>
  )
}


// ─── Dashboard Tab ────────────────────────────────────────────────
function Dashboard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const load = async () => {
      const [
        { count: users },
        { count: designs },
        { count: bookings },
        subscriptionsRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('designs').select('*', { count: 'exact', head: true }).eq('is_published', true),
        supabase.from('bookings').select('*', { count: 'exact', head: true }),
        // subscription_tier is masked in the profiles view for other users'
        // rows, so this count needs the service-role route, not a direct query.
        fetch('/api/admin-subscription-count', { headers: await authHeaders() }).then(r => r.json()),
      ])
      const subscriptions = subscriptionsRes?.count ?? null
      const { data: recentUsers } = await supabase
        .from('profiles')
        .select('id, display_name, username, account_type, created_at')
        .order('created_at', { ascending: false })
        .limit(10)
      setStats({ users, designs, bookings, subscriptions, recentUsers })
    }
    load()
  }, [])

  const timeAgo = (iso) => {
    const diff = Date.now() - new Date(iso).getTime()
    const d = Math.floor(diff / 86400000)
    const h = Math.floor(diff / 3600000)
    const m = Math.floor(diff / 60000)
    if (d >= 1) return d + 'd ago'
    if (h >= 1) return h + 'h ago'
    if (m >= 1) return m + 'm ago'
    return 'just now'
  }

  if (!stats) return <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading…</p>

  const cards = [
    { label: 'Total Users',   value: stats.users,         color: '#D4A0C0' },
    { label: 'Live Designs',  value: stats.designs,       color: '#A0C4D4' },
    { label: 'Bookings',      value: stats.bookings,      color: '#C4D4A0' },
    { label: 'Subscriptions', value: stats.subscriptions, color: '#D4C4A0' },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '16px', border: '0.5px solid var(--border)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px' }}>{c.label}</p>
            <p style={{ color: c.color, fontSize: '28px', fontWeight: '700', margin: 0 }}>{c.value ?? '—'}</p>
          </div>
        ))}
      </div>
      <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>Recent signups</p>
      {(stats.recentUsers || []).map(u => (
        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: 0 }}>{u.display_name || u.username || 'User'}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '2px 0 0' }}>{u.account_type}</p>
          </div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{timeAgo(u.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Tags Tab ─────────────────────────────────────────────────────
function TagsManager() {
  const [tags, setTags] = useState([])
  const [newTag, setNewTag] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    supabase.from('tags').select('id, name').order('name').then(({ data }) => setTags(data || []))
  }, [])

  const addTag = async () => {
    if (!newTag.trim() || adding) return
    setAdding(true)
    const { data } = await supabase.from('tags').insert({ name: newTag.trim().toLowerCase() }).select().single()
    if (data) setTags(prev => [...prev, data].sort((a, b) => a.name.localeCompare(b.name)))
    setNewTag('')
    setAdding(false)
  }

  const deleteTag = async (tag) => {
    if (deleting) return
    setDeleting(tag.id)
    await supabase.from('tags').delete().eq('id', tag.id)
    setTags(prev => prev.filter(t => t.id !== tag.id))
    setDeleting(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="New tag name…" style={inputStyle} />
        <button onClick={addTag} disabled={!newTag.trim() || adding} style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '10px', padding: '11px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', opacity: (!newTag.trim() || adding) ? 0.5 : 1, flexShrink: 0 }}>
          {adding ? '…' : 'Add'}
        </button>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '10px' }}>{tags.length} tags</p>
      {tags.map(tag => (
        <div key={tag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>#{tag.name}</span>
          <button onClick={() => deleteTag(tag)} disabled={!!deleting} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#e57373', fontSize: '12px', fontFamily: 'inherit', opacity: deleting === tag.id ? 0.4 : 1 }}>Delete</button>
        </div>
      ))}
    </div>
  )
}

// ─── Credits Tab ─────────────────────────────────────────────────
function CreditsManager() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [amount, setAmount] = useState('')
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [loading, setLoading] = useState(true)

  const fetchUsers = async (q = '') => {
    setLoading(true)
    const res = await fetch(`/api/admin-profiles?q=${encodeURIComponent(q)}`, {
      headers: await authHeaders(),
    })
    const data = await res.json()
    setResults(data.users || [])
    setSelected(null)
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const search = () => fetchUsers(query)

  const updateCredits = async (delta) => {
    if (!selected || !amount || updating) return
    setUpdating(true)
    setErrorMsg('')
    const newBalance = Math.max(0, (selected.credit_balance ?? 0) + delta * parseInt(amount))
    const res = await fetch('/api/admin-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
      body: JSON.stringify({ userId: selected.id, credits: newBalance }),
    })
    if (res.ok) {
      setSelected(prev => ({ ...prev, credit_balance: newBalance }))
      setResults(prev => prev.map(u => u.id === selected.id ? { ...u, credit_balance: newBalance } : u))
      setMessage('Done — new balance: ' + newBalance + ' credits')
      setAmount('')
    } else {
      const json = await res.json().catch(() => ({}))
      setErrorMsg(json.error || 'Failed to update credits. Please try again.')
    }
    setUpdating(false)
    setTimeout(() => { setMessage(''); setErrorMsg('') }, 4000)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && search()} placeholder="Search by name or username…" style={inputStyle} />
        <button onClick={search} style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '10px', padding: '11px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>Search</button>
      </div>
      {loading && <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading…</p>}
      {!loading && results.map(u => (
        <div key={u.id} onClick={() => setSelected(u)} style={{ padding: '12px 14px', marginBottom: '8px', background: selected?.id === u.id ? 'rgba(212,160,192,0.1)' : 'var(--bg-card)', border: '0.5px solid ' + (selected?.id === u.id ? 'var(--accent)' : 'var(--border)'), borderRadius: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: 0 }}>{u.display_name}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '2px 0 0' }}>@{u.username} · {u.account_type}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: '700', margin: 0 }}>{u.credit_balance ?? 0}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '10px', margin: 0 }}>credits</p>
          </div>
        </div>
      ))}
      {selected && (
        <div style={{ marginTop: '20px', background: 'var(--bg-card)', borderRadius: '14px', padding: '16px', border: '0.5px solid var(--border)' }}>
          <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 8px' }}>Adjust credits — {selected.display_name}</p>
          <p style={{ color: 'var(--accent)', fontSize: '22px', fontWeight: '700', margin: '0 0 12px' }}>{selected.credit_balance ?? 0} credits</p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" style={{ ...inputStyle, flex: 1 }} />
            <button onClick={() => updateCredits(1)} disabled={!amount || updating} style={{ background: 'rgba(100,200,130,0.12)', color: '#6CC882', border: '0.5px solid rgba(100,200,130,0.3)', borderRadius: '10px', padding: '11px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>+ Add</button>
            <button onClick={() => updateCredits(-1)} disabled={!amount || updating} style={{ background: 'rgba(229,115,115,0.1)', color: '#e57373', border: '0.5px solid rgba(229,115,115,0.3)', borderRadius: '10px', padding: '11px 14px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>− Remove</button>
          </div>
          {message && <p style={{ color: '#81c784', fontSize: '12px', marginTop: '10px' }}>{message}</p>}
          {errorMsg && <p style={{ color: '#e57373', fontSize: '12px', marginTop: '10px' }}>{errorMsg}</p>}
        </div>
      )}
    </div>
  )
}

// ─── Main Admin Page ──────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [activeTab, setActiveTab] = useState('upload')
  const [successMsg, setSuccessMsg] = useState('')

  // Design state
  const [allDesigns, setAllDesigns] = useState([])
  const [loadingDesigns, setLoadingDesigns] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [editingDesign, setEditingDesign] = useState(null)

  // Shop state
  const [allProducts, setAllProducts] = useState([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [deletingProductId, setDeletingProductId] = useState(null)
  const [editingProduct, setEditingProduct] = useState(null)
  const [addingProduct, setAddingProduct] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { setCheckingAuth(false); return }
      const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      setAuthed(!!prof?.is_admin)
      setCheckingAuth(false)
    })
  }, [])

  useEffect(() => {
    if (authed && activeTab === 'manage' && !editingDesign) loadDesigns()
    if (authed && activeTab === 'shop') loadProducts()
  }, [authed, activeTab, editingDesign])

  const loadDesigns = async () => {
    setLoadingDesigns(true)
    const { data } = await supabase.from('designs').select('id, title, image_url, created_at, is_drop').order('created_at', { ascending: false })
    setAllDesigns(data || [])
    setLoadingDesigns(false)
  }

  const loadProducts = async () => {
    setLoadingProducts(true)
    const { data } = await supabase.from('products').select('*').order('created_at', { ascending: false })
    setAllProducts(data || [])
    setLoadingProducts(false)
  }

  const deleteDesign = async (id, title) => {
    if (!confirm(`Delete "${title}"? This cannot be undone.`)) return
    setDeletingId(id)
    await supabase.from('design_tags').delete().eq('design_id', id)
    await supabase.from('design_colours').delete().eq('design_id', id)
    await supabase.from('design_images').delete().eq('design_id', id)
    await supabase.from('saved_designs').delete().eq('design_id', id)
    await supabase.from('designs').delete().eq('id', id)
    setAllDesigns(prev => prev.filter(d => d.id !== id))
    setDeletingId(null)
  }

  const toggleDrop = async (id, current) => {
    await supabase.from('designs').update({ is_drop: !current }).eq('id', id)
    setAllDesigns(prev => prev.map(d => d.id === id ? { ...d, is_drop: !current } : d))
  }

  const deleteProduct = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return
    setDeletingProductId(id)
    await supabase.from('products').delete().eq('id', id)
    setAllProducts(prev => prev.filter(p => p.id !== id))
    setDeletingProductId(null)
  }

  const startEdit = async (design) => {
    const [{ data: colours }, { data: extraImages }, { data: designTags }] = await Promise.all([
      supabase.from('design_colours').select('*').eq('design_id', design.id).order('colour_order'),
      supabase.from('design_images').select('*').eq('design_id', design.id).order('image_order'),
      supabase.from('design_tags').select('tags(name)').eq('design_id', design.id),
    ])
    const { data: full } = await supabase.from('designs').select('*').eq('id', design.id).single()
    setEditingDesign({
      ...full,
      colours: colours || [],
      extraImages: extraImages || [],
      tags: designTags?.map(dt => dt.tags?.name).filter(Boolean) || [],
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveNew = async ({ title, description, image_url, shape, length, occasion, technique, colours, tagNames, newExtraFiles, slug }) => {
    if (!image_url) throw new Error('Please select a main photo')

    const uploadImage = async (file, name) => {
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}-${name}.${ext}`
      const { error } = await supabase.storage.from('designs').upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (error) throw new Error('Image upload failed: ' + error.message)
      return supabase.storage.from('designs').getPublicUrl(fileName).data.publicUrl
    }

    const { data: design, error } = await supabase.from('designs').insert({ title, description, image_url, shape, length, occasion, technique, is_published: true }).select().single()
    if (error) throw new Error(error.message)

    for (let i = 0; i < newExtraFiles.length; i++) {
      const url = await uploadImage(newExtraFiles[i].file, `${slug}-extra-${i + 1}`)
      await supabase.from('design_images').insert({ design_id: design.id, image_url: url, image_order: i + 1 })
    }
    if (colours.length > 0) {
      await supabase.from('design_colours').insert(colours.map((c, i) => ({ design_id: design.id, colour_name: c.colour_name || null, hex_code: c.hex_code || null, brand_name: c.brand_name || null, brand_code: c.brand_code || null, colour_order: i + 1 })))
    }
    for (const tagName of tagNames) {
      const { data: tag } = await supabase.from('tags').upsert({ name: tagName }, { onConflict: 'name' }).select().single()
      if (tag) await supabase.from('design_tags').upsert({ design_id: design.id, tag_id: tag.id }, { onConflict: 'design_id,tag_id' })
    }
    setSuccessMsg(`✓ "${design.title}" published!`)
    setActiveTab('upload')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const saveEdit = async ({ title, description, image_url, shape, length, occasion, technique, colours, tagNames, newExtraFiles, removedExtraIds, slug }) => {
    const id = editingDesign.id

    const uploadImage = async (file, name) => {
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}-${name}.${ext}`
      const { error } = await supabase.storage.from('designs').upload(fileName, file, { cacheControl: '3600', upsert: false })
      if (error) throw new Error('Image upload failed: ' + error.message)
      return supabase.storage.from('designs').getPublicUrl(fileName).data.publicUrl
    }

    const { error } = await supabase.from('designs').update({ title, description, image_url, shape, length, occasion, technique }).eq('id', id)
    if (error) throw new Error(error.message)

    for (const imgId of removedExtraIds) {
      await supabase.from('design_images').delete().eq('id', imgId)
    }
    const existingCount = editingDesign.extraImages.filter(img => !removedExtraIds.includes(img.id)).length
    for (let i = 0; i < newExtraFiles.length; i++) {
      const url = await uploadImage(newExtraFiles[i].file, `${slug}-extra-${existingCount + i + 1}`)
      await supabase.from('design_images').insert({ design_id: id, image_url: url, image_order: existingCount + i + 1 })
    }
    await supabase.from('design_colours').delete().eq('design_id', id)
    if (colours.length > 0) {
      await supabase.from('design_colours').insert(colours.map((c, i) => ({ design_id: id, colour_name: c.colour_name || null, hex_code: c.hex_code || null, brand_name: c.brand_name || null, brand_code: c.brand_code || null, colour_order: i + 1 })))
    }
    await supabase.from('design_tags').delete().eq('design_id', id)
    for (const tagName of tagNames) {
      const { data: tag } = await supabase.from('tags').upsert({ name: tagName }, { onConflict: 'name' }).select().single()
      if (tag) await supabase.from('design_tags').insert({ design_id: id, tag_id: tag.id })
    }
    setEditingDesign(null)
    setSuccessMsg(`✓ "${title}" updated!`)
    setActiveTab('manage')
  }

  const saveNewProduct = async (data) => {
    const { data: product, error } = await supabase.from('products').insert({ ...data, is_published: true }).select().single()
    if (error) throw new Error(error.message)
    setSuccessMsg(`✓ "${product.name}" added to shop!`)
    setAddingProduct(false)
    loadProducts()
  }

  const saveEditProduct = async (data) => {
    const { error } = await supabase.from('products').update(data).eq('id', editingProduct.id)
    if (error) throw new Error(error.message)
    setSuccessMsg(`✓ "${data.name}" updated!`)
    setEditingProduct(null)
    loadProducts()
  }

  // ── Auth gate ─────────────────────────────────────────────────────
  if (checkingAuth) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading…</p>
      </div>
    )
  }
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '360px', textAlign: 'center' }}>
          <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Admin</p>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', marginBottom: '10px' }}>You don't have access</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Sign in with an admin account to view this page.</p>
        </div>
      </div>
    )
  }

  // ── Edit design view ─────────────────────────────────────────────
  if (editingDesign) {
    return (
      <div style={{ padding: '24px 20px 60px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Admin · Edit Design</p>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '500', marginBottom: '24px' }}>{editingDesign.title}</h1>
        <DesignForm initial={editingDesign} onSave={saveEdit} onCancel={() => setEditingDesign(null)} saveLabel="Save Changes" />
        <div style={{ marginTop: '32px', borderTop: '0.5px solid var(--border)', paddingTop: '24px' }}>
          <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '4px' }}>Shop This Look</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '16px' }}>Tap a product to link or unlink it from this design.</p>
          <LinkedProducts designId={editingDesign.id} />
        </div>
      </div>
    )
  }

  // ── Edit product view ────────────────────────────────────────────
  if (editingProduct) {
    return (
      <div style={{ padding: '24px 20px 60px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Admin · Edit Product</p>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '500', marginBottom: '24px' }}>{editingProduct.name}</h1>
        <ProductForm initial={editingProduct} onSave={saveEditProduct} onCancel={() => setEditingProduct(null)} saveLabel="Save Changes" />
      </div>
    )
  }

  // ── Main tabs ────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 20px 60px', maxWidth: '600px', margin: '0 auto' }}>
      <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Admin</p>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', marginBottom: '20px' }}>Laque</h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px', flexWrap: 'wrap' }}>
        {[['upload', 'Upload Design'], ['manage', 'Manage Designs'], ['shop', 'Shop Products'], ['dashboard', 'Dashboard'], ['tags', 'Tags'], ['credits', 'Credits'], ['challenges', 'Challenges']].map(([tab, label]) => (
          <button key={tab} onClick={() => { setActiveTab(tab); setSuccessMsg(''); setAddingProduct(false) }} style={{
            background: activeTab === tab ? 'var(--accent)' : 'var(--bg-chip)',
            color: activeTab === tab ? '#2C0A1E' : 'var(--text-secondary)',
            border: 'none', borderRadius: '20px', padding: '7px 18px',
            fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {label}
          </button>
        ))}
      </div>

      {successMsg && (
        <div style={{ background: 'rgba(129,199,132,0.1)', border: '0.5px solid #81c784', borderRadius: '10px', padding: '12px 14px', marginBottom: '20px' }}>
          <p style={{ color: '#81c784', fontSize: '13px' }}>{successMsg}</p>
        </div>
      )}

      {/* ── UPLOAD TAB ── */}
      {activeTab === 'upload' && (
        <DesignForm initial={null} onSave={saveNew} onCancel={null} saveLabel="Publish Design" />
      )}

      {/* ── MANAGE TAB ── */}
      {activeTab === 'manage' && (
        <>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '16px' }}>
            {allDesigns.length} design{allDesigns.length !== 1 ? 's' : ''} published
          </p>
          {loadingDesigns ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {allDesigns.map(design => (
                <div key={design.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', padding: '10px 12px' }}>
                  {design.image_url
                    ? <img src={design.image_url} alt={design.title} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                    : <div style={{ width: '48px', height: '48px', background: 'var(--bg-chip)', borderRadius: '8px', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{design.title}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                      {new Date(design.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => toggleDrop(design.id, design.is_drop)} style={{ background: design.is_drop ? 'rgba(212,160,192,0.15)' : 'var(--bg-chip)', border: design.is_drop ? '0.5px solid rgba(212,160,192,0.4)' : 'none', borderRadius: '8px', padding: '6px 12px', color: design.is_drop ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {design.is_drop ? '✦ Drop' : 'Drop'}
                    </button>
                    <button onClick={() => startEdit(design)} style={{ background: 'var(--bg-chip)', border: 'none', borderRadius: '8px', padding: '6px 12px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                    <button onClick={() => deleteDesign(design.id, design.title)} disabled={deletingId === design.id} style={{ background: 'rgba(229,115,115,0.1)', border: '0.5px solid rgba(229,115,115,0.3)', borderRadius: '8px', padding: '6px 12px', color: '#e57373', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {deletingId === design.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ── SHOP TAB ── */}
      {activeTab === 'shop' && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
              {allProducts.length} product{allProducts.length !== 1 ? 's' : ''} in shop
            </p>
            {!addingProduct && (
              <button onClick={() => setAddingProduct(true)} style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '20px', padding: '7px 16px', fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>
                + Add Product
              </button>
            )}
          </div>

          {addingProduct && (
            <div style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '20px', marginBottom: '20px' }}>
              <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '16px' }}>New Product</p>
              <ProductForm initial={null} onSave={saveNewProduct} onCancel={() => setAddingProduct(false)} saveLabel="Add to Shop" />
            </div>
          )}

          {loadingProducts ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {allProducts.map(product => (
                <div key={product.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', padding: '10px 12px' }}>
                  {product.image_url
                    ? <img src={product.image_url} alt={product.name} style={{ width: '48px', height: '48px', objectFit: 'contain', borderRadius: '8px', flexShrink: 0, background: 'var(--bg-chip)' }} />
                    : <div style={{ width: '48px', height: '48px', background: 'var(--bg-chip)', borderRadius: '8px', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                      {product.category || 'No category'}{product.price_label ? ` · ${product.price_label}` : ''}{product.is_featured ? ' · ★ Featured' : ''}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                    <button onClick={() => setEditingProduct(product)} style={{ background: 'var(--bg-chip)', border: 'none', borderRadius: '8px', padding: '6px 12px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>Edit</button>
                    <button onClick={() => deleteProduct(product.id, product.name)} disabled={deletingProductId === product.id} style={{ background: 'rgba(229,115,115,0.1)', border: '0.5px solid rgba(229,115,115,0.3)', borderRadius: '8px', padding: '6px 12px', color: '#e57373', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>
                      {deletingProductId === product.id ? '...' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
              {allProducts.length === 0 && !loadingProducts && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '13px', textAlign: 'center', padding: '32px 0' }}>No products yet. Add your first one above.</p>
              )}
            </div>
          )}
        </>
      )}

      {/* ── DASHBOARD TAB ── */}
      {activeTab === 'dashboard' && <Dashboard />}

      {/* ── TAGS TAB ── */}
      {activeTab === 'tags' && <TagsManager />}

      {/* ── CREDITS TAB ── */}
      {activeTab === 'credits' && <CreditsManager />}

      {/* ── CHALLENGES TAB ── */}
      {activeTab === 'challenges' && <ChallengesManager />}

    </div>
  )
}

// ─── Linked Products ─────────────────────────────────────────────
function LinkedProducts({ designId }) {
  const [allProducts, setAllProducts] = useState([])
  const [linkedIds, setLinkedIds] = useState(new Set())
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    const load = async () => {
      const [{ data: products }, { data: links }] = await Promise.all([
        supabase.from('products').select('id, name, brand, image_url, price_label').eq('is_published', true).order('created_at', { ascending: false }),
        supabase.from('design_products').select('product_id').eq('design_id', designId),
      ])
      setAllProducts(products || [])
      setLinkedIds(new Set(links?.map(l => l.product_id) || []))
      setLoading(false)
    }
    load()
  }, [designId])

  const toggle = async (productId) => {
    setSaving(productId)
    if (linkedIds.has(productId)) {
      await supabase.from('design_products').delete().eq('design_id', designId).eq('product_id', productId)
      setLinkedIds(prev => { const next = new Set(prev); next.delete(productId); return next })
    } else {
      await supabase.from('design_products').insert({ design_id: designId, product_id: productId })
      setLinkedIds(prev => new Set([...prev, productId]))
    }
    setSaving(null)
  }

  if (loading) return <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading products...</p>
  if (allProducts.length === 0) return <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No products in shop yet. Add some in the Shop tab first.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {allProducts.map(product => {
        const isLinked = linkedIds.has(product.id)
        return (
          <button
            key={product.id}
            onClick={() => toggle(product.id)}
            disabled={saving === product.id}
            style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              background: isLinked ? 'rgba(212,160,192,0.1)' : 'var(--bg-card)',
              border: isLinked ? '0.5px solid var(--accent)' : '0.5px solid var(--border)',
              borderRadius: '12px', padding: '10px 12px',
              cursor: 'pointer', textAlign: 'left', width: '100%', fontFamily: 'inherit',
            }}
          >
            {product.image_url
              ? <img src={product.image_url} alt={product.name} style={{ width: '40px', height: '40px', objectFit: 'contain', borderRadius: '8px', flexShrink: 0, background: 'var(--bg-chip)' }} />
              : <div style={{ width: '40px', height: '40px', background: 'var(--bg-chip)', borderRadius: '8px', flexShrink: 0 }} />
            }
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</p>
              {product.brand && <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>{product.brand}{product.price_label ? ` · ${product.price_label}` : ''}</p>}
            </div>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%', flexShrink: 0,
              background: isLinked ? 'var(--accent)' : 'var(--bg-chip)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: isLinked ? '#2C0A1E' : 'var(--text-secondary)',
              fontSize: '14px', fontWeight: '700',
            }}>
              {saving === product.id ? '…' : isLinked ? '✓' : '+'}
            </div>
          </button>
        )
      })}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────────
function Section({ label, children }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>{label}</p>
      {children}
    </div>
  )
}

function ChipGroup({ items, selected, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
      {items.map(item => {
        const isActive = selected.includes(item)
        return (
          <button key={item} onClick={() => onToggle(item)} style={{
            background: isActive ? 'var(--accent)' : 'var(--bg-chip)',
            color: isActive ? '#2C0A1E' : 'var(--text-secondary)',
            border: 'none', borderRadius: '20px', padding: '6px 14px',
            fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit',
          }}>{item}</button>
        )
      })}
    </div>
  )
}

function SelectDropdown({ label, value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, color: value ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
      <option value="">{label}</option>
      {options.map(o => <option key={o} value={o.toLowerCase()}>{o}</option>)}
    </select>
  )
}

function Placeholder({ text }) {
  return (
    <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-card)', border: '0.5px dashed var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{text}</p>
    </div>
  )
}

const inputStyle = {
  width: '100%', background: 'var(--bg-card)', border: '0.5px solid var(--border)',
  borderRadius: '10px', padding: '11px 13px', color: 'var(--text-primary)',
  fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit',
}

const ghostBtn = {
  background: 'none', border: 'none', color: 'var(--text-secondary)',
  fontSize: '12px', cursor: 'pointer', padding: '4px 0', display: 'block', fontFamily: 'inherit',
}

const removeBtn = {
  position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)',
  border: 'none', borderRadius: '50%', width: '22px', height: '22px',
  color: '#fff', fontSize: '14px', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
}

// ─── Challenges Manager ───────────────────────────────────────────
function ChallengesManager() {
  const [challenges, setChallenges] = useState([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [endsAt, setEndsAt] = useState('')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('challenges').select('*').order('created_at', { ascending: false }).then(({ data }) => {
      setChallenges(data || [])
      setLoading(false)
    })
  }, [])

  const handleCreate = async () => {
    if (!title.trim() || !endsAt) return
    setSaving(true)
    const { data, error } = await supabase.from('challenges').insert({
      title: title.trim(),
      description: description.trim() || null,
      ends_at: new Date(endsAt).toISOString(),
    }).select().single()
    if (!error && data) {
      setChallenges(prev => [data, ...prev])
      setTitle(''); setDescription(''); setEndsAt('')
      setMsg('Challenge created!')
      setTimeout(() => setMsg(''), 3000)
    }
    setSaving(false)
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this challenge and all submissions?')) return
    await supabase.from('challenges').delete().eq('id', id)
    setChallenges(prev => prev.filter(c => c.id !== id))
  }

  const inputStyle = { width: '100%', background: 'var(--bg-chip)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: '10px' }

  return (
    <div>
      <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600', marginBottom: '20px' }}>Create Challenge</h2>
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Challenge title e.g. Spring Florals" style={inputStyle} />
      <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Description (optional)" rows={3} style={{ ...inputStyle, resize: 'none' }} />
      <input type="datetime-local" value={endsAt} onChange={e => setEndsAt(e.target.value)} style={inputStyle} />
      <button onClick={handleCreate} disabled={saving || !title.trim() || !endsAt} style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '10px', padding: '11px 24px', fontSize: '14px', fontWeight: '600', fontFamily: 'inherit', cursor: 'pointer', marginBottom: '24px' }}>
        {saving ? 'Creating…' : 'Create Challenge'}
      </button>
      {msg && <p style={{ color: '#6CC882', fontSize: '13px', marginBottom: '16px' }}>{msg}</p>}

      <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600', marginBottom: '12px' }}>All Challenges</h2>
      {loading ? <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading…</p> : challenges.length === 0 ? (
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No challenges yet.</p>
      ) : challenges.map(c => {
        const ended = new Date(c.ends_at) < new Date()
        return (
          <div key={c.id} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px 16px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', margin: '0 0 4px' }}>{c.title}</p>
              {c.description && <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: '0 0 4px' }}>{c.description}</p>}
              <p style={{ color: ended ? '#E07070' : 'var(--accent)', fontSize: '11px', margin: 0 }}>
                {ended ? 'Ended' : 'Ends'}: {new Date(c.ends_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
            <button onClick={() => handleDelete(c.id)} style={{ background: 'none', border: 'none', color: '#E07070', fontSize: '12px', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0, marginLeft: '12px' }}>Delete</button>
          </div>
        )
      })}
    </div>
  )
}
