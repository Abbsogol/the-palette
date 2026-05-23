'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const ADMIN_PASSWORD = 'palette2024'

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

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [activeTab, setActiveTab] = useState('upload') // 'upload' | 'manage'

  // Upload form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [shape, setShape] = useState('')
  const [length, setLength] = useState('')
  const [selectedOccasions, setSelectedOccasions] = useState([])
  const [customOccasion, setCustomOccasion] = useState('')
  const [selectedTechniques, setSelectedTechniques] = useState([])
  const [customTechnique, setCustomTechnique] = useState('')
  const [mainImageFile, setMainImageFile] = useState(null)
  const [mainImagePreview, setMainImagePreview] = useState(null)
  const [extraImageFiles, setExtraImageFiles] = useState([])
  const [colours, setColours] = useState([{ colour_name: '', hex_code: '', brand_name: '', brand_code: '' }])
  const [tagsInput, setTagsInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Manage tab state
  const [allDesigns, setAllDesigns] = useState([])
  const [loadingDesigns, setLoadingDesigns] = useState(false)
  const [deletingId, setDeletingId] = useState(null)

  const handleLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setAuthed(true)
    } else {
      setPasswordError('Incorrect password')
    }
  }

  // Load designs when manage tab is opened
  useEffect(() => {
    if (authed && activeTab === 'manage') {
      loadDesigns()
    }
  }, [authed, activeTab])

  const loadDesigns = async () => {
    setLoadingDesigns(true)
    const { data } = await supabase
      .from('designs')
      .select('id, title, image_url, created_at')
      .order('created_at', { ascending: false })
    setAllDesigns(data || [])
    setLoadingDesigns(false)
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

  const handleMainImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setMainImageFile(file)
    setMainImagePreview(URL.createObjectURL(file))
  }

  const handleExtraImagesChange = (e) => {
    const files = Array.from(e.target.files)
    const newImages = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setExtraImageFiles(prev => [...prev, ...newImages])
  }

  const removeExtraImage = (index) => {
    setExtraImageFiles(prev => prev.filter((_, i) => i !== index))
  }

  const toggleOccasion = (o) => {
    setSelectedOccasions(prev =>
      prev.includes(o) ? prev.filter(x => x !== o) : [...prev, o]
    )
  }

  const toggleTechnique = (t) => {
    setSelectedTechniques(prev =>
      prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]
    )
  }

  const updateColour = (index, field, value) => {
    setColours(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const addColour = () => setColours(prev => [...prev, { colour_name: '', hex_code: '', brand_name: '', brand_code: '' }])
  const removeColour = (index) => setColours(prev => prev.filter((_, i) => i !== index))

  const uploadImage = async (file, slug) => {
    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}-${slug}.${ext}`
    const { error } = await supabase.storage
      .from('designs')
      .upload(fileName, file, { cacheControl: '3600', upsert: false })
    if (error) throw new Error('Image upload failed: ' + error.message)
    const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(fileName)
    return publicUrl
  }

  const handleSubmit = async () => {
    setErrorMsg('')
    setSuccessMsg('')
    if (!title.trim()) { setErrorMsg('Title is required'); return }
    if (!mainImageFile) { setErrorMsg('Please select a main photo'); return }
    setSubmitting(true)

    try {
      const slug = title.toLowerCase().replace(/\s+/g, '-')
      const mainUrl = await uploadImage(mainImageFile, slug)

      const allOccasions = [...selectedOccasions]
      if (customOccasion.trim()) allOccasions.push(customOccasion.trim())
      const finalOccasion = allOccasions.join(', ') || null

      const allTechniques = [...selectedTechniques]
      if (customTechnique.trim()) allTechniques.push(customTechnique.trim())
      const finalTechnique = allTechniques.join(', ') || null

      const { data: design, error: designError } = await supabase
        .from('designs')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          image_url: mainUrl,
          shape: shape || null,
          length: length || null,
          occasion: finalOccasion,
          technique: finalTechnique,
          is_published: true,
        })
        .select()
        .single()

      if (designError) throw new Error('Design insert failed: ' + designError.message)

      // Extra images
      for (let i = 0; i < extraImageFiles.length; i++) {
        const url = await uploadImage(extraImageFiles[i].file, `${slug}-extra-${i + 1}`)
        await supabase.from('design_images').insert({ design_id: design.id, image_url: url, image_order: i + 1 })
      }

      // Colours
      const validColours = colours.filter(c => c.hex_code.trim() || c.colour_name.trim())
      if (validColours.length > 0) {
        await supabase.from('design_colours').insert(
          validColours.map((c, i) => ({
            design_id: design.id,
            colour_name: c.colour_name.trim() || null,
            hex_code: c.hex_code.trim() || null,
            brand_name: c.brand_name.trim() || null,
            brand_code: c.brand_code.trim() || null,
            colour_order: i + 1,
          }))
        )
      }

      // Tags
      const tagNames = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      for (const tagName of tagNames) {
        const { data: tag } = await supabase
          .from('tags')
          .upsert({ name: tagName }, { onConflict: 'name' })
          .select()
          .single()
        if (tag) await supabase.from('design_tags').upsert({ design_id: design.id, tag_id: tag.id }, { onConflict: 'design_id,tag_id' })
      }

      // Reset
      setTitle(''); setDescription(''); setShape(''); setLength('')
      setSelectedOccasions([]); setCustomOccasion('')
      setSelectedTechniques([]); setCustomTechnique('')
      setMainImageFile(null); setMainImagePreview(null)
      setExtraImageFiles([])
      setColours([{ colour_name: '', hex_code: '', brand_name: '', brand_code: '' }])
      setTagsInput('')
      setSuccessMsg(`✓ "${design.title}" published!`)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Password screen ──────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
          <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Admin</p>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', marginBottom: '24px' }}>The Palette</h1>
          <input
            type="password"
            placeholder="Admin password"
            value={passwordInput}
            onChange={e => { setPasswordInput(e.target.value); setPasswordError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ ...inputStyle, marginBottom: '10px' }}
          />
          {passwordError && <p style={{ color: '#e57373', fontSize: '12px', marginBottom: '10px' }}>{passwordError}</p>}
          <button onClick={handleLogin} style={{ width: '100%', background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>
            Enter
          </button>
        </div>
      </div>
    )
  }

  // ── Admin tabs ───────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 20px 60px', maxWidth: '600px', margin: '0 auto' }}>
      <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Admin</p>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', marginBottom: '20px' }}>The Palette</h1>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
        {['upload', 'manage'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? 'var(--accent)' : 'var(--bg-chip)',
              color: activeTab === tab ? '#2C0A1E' : 'var(--text-secondary)',
              border: 'none', borderRadius: '20px', padding: '7px 18px',
              fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              fontFamily: 'inherit', textTransform: 'capitalize',
            }}
          >
            {tab === 'upload' ? 'Upload Design' : 'Manage Designs'}
          </button>
        ))}
      </div>

      {/* ── UPLOAD TAB ── */}
      {activeTab === 'upload' && (
        <>
          {successMsg && (
            <div style={{ background: 'rgba(129,199,132,0.1)', border: '0.5px solid #81c784', borderRadius: '10px', padding: '12px 14px', marginBottom: '20px' }}>
              <p style={{ color: '#81c784', fontSize: '13px' }}>{successMsg}</p>
            </div>
          )}

          {/* Main photo */}
          <Section label="Main Photo *">
            <label style={{ display: 'block', cursor: 'pointer' }}>
              {mainImagePreview ? (
                <img src={mainImagePreview} alt="Preview" style={{ width: '100%', borderRadius: '12px', display: 'block', marginBottom: '10px' }} />
              ) : (
                <div style={{ width: '100%', aspectRatio: '4/3', background: 'var(--bg-card)', border: '0.5px dashed var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Tap to select main image</p>
                </div>
              )}
              <input type="file" accept="image/*" onChange={handleMainImageChange} style={{ display: 'none' }} />
            </label>
            {mainImagePreview && <button onClick={() => { setMainImageFile(null); setMainImagePreview(null) }} style={ghostBtn}>Remove</button>}
          </Section>

          {/* Extra photos */}
          <Section label="Additional Photos">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '8px' }}>
              {extraImageFiles.map((img, i) => (
                <div key={i} style={{ position: 'relative' }}>
                  <img src={img.preview} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '10px', display: 'block' }} />
                  <button onClick={() => removeExtraImage(i)} style={{ position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '22px', height: '22px', color: '#fff', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                </div>
              ))}
              <label style={{ cursor: 'pointer' }}>
                <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--bg-card)', border: '0.5px dashed var(--border)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span style={{ color: 'var(--text-secondary)', fontSize: '24px', fontWeight: '300' }}>+</span>
                </div>
                <input type="file" accept="image/*" multiple onChange={handleExtraImagesChange} style={{ display: 'none' }} />
              </label>
            </div>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Add extra angles or detail shots — these appear in a swipeable gallery</p>
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

          {/* Occasion — multi-select */}
          <Section label="Occasion (select all that apply)">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              {OCCASIONS.map(o => {
                const isActive = selectedOccasions.includes(o)
                return (
                  <button key={o} onClick={() => toggleOccasion(o)} style={{
                    background: isActive ? 'var(--accent)' : 'var(--bg-chip)',
                    color: isActive ? '#2C0A1E' : 'var(--text-secondary)',
                    border: 'none', borderRadius: '20px', padding: '6px 14px',
                    fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit',
                  }}>{o}</button>
                )
              })}
            </div>
            <input value={customOccasion} onChange={e => setCustomOccasion(e.target.value)} placeholder="Or add a custom occasion..." style={inputStyle} />
          </Section>

          {/* Technique — multi-select */}
          <Section label="Technique (select all that apply)">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
              {TECHNIQUES.map(t => {
                const isActive = selectedTechniques.includes(t)
                return (
                  <button key={t} onClick={() => toggleTechnique(t)} style={{
                    background: isActive ? 'var(--accent)' : 'var(--bg-chip)',
                    color: isActive ? '#2C0A1E' : 'var(--text-secondary)',
                    border: 'none', borderRadius: '20px', padding: '6px 14px',
                    fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit',
                  }}>{t}</button>
                )
              })}
            </div>
            <input value={customTechnique} onChange={e => setCustomTechnique(e.target.value)} placeholder="Or add a custom technique..." style={inputStyle} />
          </Section>

          {/* Colours */}
          <Section label="Colour Specs">
            {colours.map((colour, i) => (
              <div key={i} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: colour.hex_code || 'var(--bg-chip)', border: '0.5px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
                  <input value={colour.hex_code} onChange={e => updateColour(i, 'hex_code', e.target.value)} placeholder="#hex code" style={{ ...inputStyle, flex: 1 }} />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <input value={colour.colour_name} onChange={e => updateColour(i, 'colour_name', e.target.value)} placeholder="Colour name" style={inputStyle} />
                  <input value={colour.brand_name} onChange={e => updateColour(i, 'brand_name', e.target.value)} placeholder="Brand name" style={inputStyle} />
                  <input value={colour.brand_code} onChange={e => updateColour(i, 'brand_code', e.target.value)} placeholder="Brand code" style={{ ...inputStyle, gridColumn: '1 / -1' }} />
                </div>
                {colours.length > 1 && <button onClick={() => removeColour(i)} style={{ ...ghostBtn, marginTop: '8px', color: '#e57373' }}>Remove colour</button>}
              </div>
            ))}
            <button onClick={addColour} style={ghostBtn}>+ Add another colour</button>
          </Section>

          <Section label="Tags">
            <input value={tagsInput} onChange={e => setTagsInput(e.target.value)} placeholder="e.g. dark, gothic, gel, autumn (comma separated)" style={inputStyle} />
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '6px' }}>Separate tags with commas</p>
          </Section>

          {errorMsg && (
            <div style={{ background: 'rgba(229,115,115,0.1)', border: '0.5px solid #e57373', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
              <p style={{ color: '#e57373', fontSize: '13px' }}>{errorMsg}</p>
            </div>
          )}

          <button onClick={handleSubmit} disabled={submitting} style={{ width: '100%', background: submitting ? 'var(--bg-chip)' : 'var(--accent)', color: submitting ? 'var(--text-secondary)' : '#2C0A1E', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: '500', cursor: submitting ? 'not-allowed' : 'pointer' }}>
            {submitting ? 'Publishing...' : 'Publish Design'}
          </button>
        </>
      )}

      {/* ── MANAGE TAB ── */}
      {activeTab === 'manage' && (
        <>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>
            {allDesigns.length} design{allDesigns.length !== 1 ? 's' : ''} published
          </p>
          {loadingDesigns ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading...</p>
          ) : allDesigns.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No designs yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {allDesigns.map(design => (
                <div key={design.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--bg-card)', borderRadius: '12px', border: '0.5px solid var(--border)', padding: '10px 12px' }}>
                  {design.image_url ? (
                    <img src={design.image_url} alt={design.title} style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                  ) : (
                    <div style={{ width: '48px', height: '48px', background: 'var(--bg-chip)', borderRadius: '8px', flexShrink: 0 }} />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{design.title}</p>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '2px' }}>
                      {new Date(design.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteDesign(design.id, design.title)}
                    disabled={deletingId === design.id}
                    style={{ background: 'rgba(229,115,115,0.1)', border: '0.5px solid rgba(229,115,115,0.3)', borderRadius: '8px', padding: '6px 12px', color: '#e57373', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}
                  >
                    {deletingId === design.id ? '...' : 'Delete'}
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>{label}</p>
      {children}
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

const inputStyle = {
  width: '100%',
  background: 'var(--bg-card)',
  border: '0.5px solid var(--border)',
  borderRadius: '10px',
  padding: '11px 13px',
  color: 'var(--text-primary)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
}

const ghostBtn = {
  background: 'none',
  border: 'none',
  color: 'var(--text-secondary)',
  fontSize: '12px',
  cursor: 'pointer',
  padding: '4px 0',
  display: 'block',
  fontFamily: 'inherit',
}
