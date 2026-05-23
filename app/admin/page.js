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

// ─── Shared Design Form ───────────────────────────────────────────
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

  // Images
  const [mainImageFile, setMainImageFile] = useState(null)
  const [mainImagePreview, setMainImagePreview] = useState(initial?.image_url || null)
  const [existingExtraImages, setExistingExtraImages] = useState(initial?.extraImages || [])
  const [newExtraFiles, setNewExtraFiles] = useState([])
  const [removedExtraIds, setRemovedExtraIds] = useState([])

  // Colours
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
      {/* Main photo */}
      <Section label="Main Photo *">
        <label style={{ display: 'block', cursor: 'pointer' }}>
          {mainImagePreview
            ? <img src={mainImagePreview} alt="Preview" style={{ width: '100%', borderRadius: '12px', display: 'block', marginBottom: '8px' }} />
            : <Placeholder text="Tap to select main image" />}
          <input type="file" accept="image/*" onChange={e => { const f = e.target.files[0]; if (f) { setMainImageFile(f); setMainImagePreview(URL.createObjectURL(f)) } }} style={{ display: 'none' }} />
        </label>
        {mainImagePreview && <button onClick={() => { setMainImageFile(null); setMainImagePreview(null) }} style={ghostBtn}>Remove</button>}
      </Section>

      {/* Extra photos */}
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
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>Tap × to remove an existing photo · + to add new ones</p>
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

// ─── Main Admin Page ──────────────────────────────────────────────
export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [activeTab, setActiveTab] = useState('upload')
  const [successMsg, setSuccessMsg] = useState('')

  // Manage tab
  const [allDesigns, setAllDesigns] = useState([])
  const [loadingDesigns, setLoadingDesigns] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [editingDesign, setEditingDesign] = useState(null) // full design with colours/images/tags

  const handleLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) setAuthed(true)
    else setPasswordError('Incorrect password')
  }

  useEffect(() => {
    if (authed && activeTab === 'manage' && !editingDesign) loadDesigns()
  }, [authed, activeTab, editingDesign])

  const loadDesigns = async () => {
    setLoadingDesigns(true)
    const { data } = await supabase.from('designs').select('id, title, image_url, created_at').order('created_at', { ascending: false })
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

  const startEdit = async (design) => {
    // Fetch full design data
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

    // Update design
    const { error } = await supabase.from('designs').update({ title, description, image_url, shape, length, occasion, technique }).eq('id', id)
    if (error) throw new Error(error.message)

    // Remove deleted extra images
    for (const imgId of removedExtraIds) {
      await supabase.from('design_images').delete().eq('id', imgId)
    }

    // Add new extra images
    const existingCount = editingDesign.extraImages.filter(img => !removedExtraIds.includes(img.id)).length
    for (let i = 0; i < newExtraFiles.length; i++) {
      const url = await uploadImage(newExtraFiles[i].file, `${slug}-extra-${existingCount + i + 1}`)
      await supabase.from('design_images').insert({ design_id: id, image_url: url, image_order: existingCount + i + 1 })
    }

    // Replace colours
    await supabase.from('design_colours').delete().eq('design_id', id)
    if (colours.length > 0) {
      await supabase.from('design_colours').insert(colours.map((c, i) => ({ design_id: id, colour_name: c.colour_name || null, hex_code: c.hex_code || null, brand_name: c.brand_name || null, brand_code: c.brand_code || null, colour_order: i + 1 })))
    }

    // Replace tags
    await supabase.from('design_tags').delete().eq('design_id', id)
    for (const tagName of tagNames) {
      const { data: tag } = await supabase.from('tags').upsert({ name: tagName }, { onConflict: 'name' }).select().single()
      if (tag) await supabase.from('design_tags').insert({ design_id: id, tag_id: tag.id })
    }

    setEditingDesign(null)
    setSuccessMsg(`✓ "${title}" updated!`)
    setActiveTab('manage')
  }

  // ── Password screen ──────────────────────────────────────────────
  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
          <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Admin</p>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', marginBottom: '24px' }}>The Palette</h1>
          <input type="password" placeholder="Admin password" value={passwordInput}
            onChange={e => { setPasswordInput(e.target.value); setPasswordError('') }}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            style={{ ...inputStyle, marginBottom: '10px' }} />
          {passwordError && <p style={{ color: '#e57373', fontSize: '12px', marginBottom: '10px' }}>{passwordError}</p>}
          <button onClick={handleLogin} style={{ width: '100%', background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}>Enter</button>
        </div>
      </div>
    )
  }

  // ── Edit view ────────────────────────────────────────────────────
  if (editingDesign) {
    return (
      <div style={{ padding: '24px 20px 60px', maxWidth: '600px', margin: '0 auto' }}>
        <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Admin · Edit</p>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '20px', fontWeight: '500', marginBottom: '24px' }}>{editingDesign.title}</h1>
        <DesignForm
          initial={editingDesign}
          onSave={saveEdit}
          onCancel={() => setEditingDesign(null)}
          saveLabel="Save Changes"
        />
      </div>
    )
  }

  // ── Main tabs ────────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 20px 60px', maxWidth: '600px', margin: '0 auto' }}>
      <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Admin</p>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', marginBottom: '20px' }}>The Palette</h1>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '28px' }}>
        {['upload', 'manage'].map(tab => (
          <button key={tab} onClick={() => { setActiveTab(tab); setSuccessMsg('') }} style={{
            background: activeTab === tab ? 'var(--accent)' : 'var(--bg-chip)',
            color: activeTab === tab ? '#2C0A1E' : 'var(--text-secondary)',
            border: 'none', borderRadius: '20px', padding: '7px 18px',
            fontSize: '13px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit',
          }}>
            {tab === 'upload' ? 'Upload Design' : 'Manage Designs'}
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
        <DesignForm
          initial={null}
          onSave={saveNew}
          onCancel={null}
          saveLabel="Publish Design"
        />
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
                    <button onClick={() => startEdit(design)} style={{ background: 'var(--bg-chip)', border: 'none', borderRadius: '8px', padding: '6px 12px', color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', cursor: 'pointer', fontFamily: 'inherit' }}>
                      Edit
                    </button>
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
