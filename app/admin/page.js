'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabase'

const ADMIN_PASSWORD = 'palette2024'

const SHAPES = ['Round', 'Square', 'Oval', 'Coffin', 'Almond', 'Stiletto', 'Ballerina', 'Squoval']
const LENGTHS = ['Short', 'Medium', 'Long', 'Extra Long']
const OCCASIONS = ['Everyday', 'Wedding', 'Party', 'Office', 'Festival', 'Holiday', 'Date Night', 'Birthday']
const TECHNIQUES = ['Gel', 'Acrylic', 'Dip Powder', 'Polygel', 'Hard Gel', 'Nail Polish', 'Press-on', 'Chrome', 'Nail Art']

export default function AdminPage() {
  const [authed, setAuthed] = useState(false)
  const [passwordInput, setPasswordInput] = useState('')
  const [passwordError, setPasswordError] = useState('')

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [shape, setShape] = useState('')
  const [length, setLength] = useState('')
  const [occasion, setOccasion] = useState('')
  const [technique, setTechnique] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [colours, setColours] = useState([{ colour_name: '', hex_code: '', brand_name: '', brand_code: '' }])
  const [tagsInput, setTagsInput] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const handleLogin = () => {
    if (passwordInput === ADMIN_PASSWORD) {
      setAuthed(true)
    } else {
      setPasswordError('Incorrect password')
    }
  }

  const handleImageChange = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const updateColour = (index, field, value) => {
    setColours(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c))
  }

  const addColour = () => {
    setColours(prev => [...prev, { colour_name: '', hex_code: '', brand_name: '', brand_code: '' }])
  }

  const removeColour = (index) => {
    setColours(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async () => {
    setErrorMsg('')
    setSuccessMsg('')

    if (!title.trim()) { setErrorMsg('Title is required'); return }
    if (!imageFile) { setErrorMsg('Please select an image'); return }

    setSubmitting(true)

    try {
      // 1. Upload image to Supabase Storage
      const ext = imageFile.name.split('.').pop()
      const fileName = `${Date.now()}-${title.toLowerCase().replace(/\s+/g, '-')}.${ext}`
      const { error: uploadError } = await supabase.storage
        .from('designs')
        .upload(fileName, imageFile, { cacheControl: '3600', upsert: false })

      if (uploadError) throw new Error('Image upload failed: ' + uploadError.message)

      const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(fileName)

      // 2. Insert design
      const { data: design, error: designError } = await supabase
        .from('designs')
        .insert({
          title: title.trim(),
          description: description.trim() || null,
          image_url: publicUrl,
          shape: shape || null,
          length: length || null,
          occasion: occasion || null,
          technique: technique || null,
          is_published: true,
        })
        .select()
        .single()

      if (designError) throw new Error('Design insert failed: ' + designError.message)

      // 3. Insert colours
      const validColours = colours.filter(c => c.hex_code.trim() || c.colour_name.trim())
      if (validColours.length > 0) {
        const colourRows = validColours.map((c, i) => ({
          design_id: design.id,
          colour_name: c.colour_name.trim() || null,
          hex_code: c.hex_code.trim() || null,
          brand_name: c.brand_name.trim() || null,
          brand_code: c.brand_code.trim() || null,
          colour_order: i + 1,
        }))
        const { error: colourError } = await supabase.from('design_colours').insert(colourRows)
        if (colourError) throw new Error('Colour insert failed: ' + colourError.message)
      }

      // 4. Insert tags
      const tagNames = tagsInput.split(',').map(t => t.trim().toLowerCase()).filter(Boolean)
      for (const tagName of tagNames) {
        // Upsert tag
        const { data: tag, error: tagError } = await supabase
          .from('tags')
          .upsert({ name: tagName }, { onConflict: 'name' })
          .select()
          .single()

        if (tagError) throw new Error('Tag upsert failed: ' + tagError.message)

        // Link tag to design
        await supabase.from('design_tags').upsert({ design_id: design.id, tag_id: tag.id }, { onConflict: 'design_id,tag_id' })
      }

      // Reset form
      setTitle('')
      setDescription('')
      setShape('')
      setLength('')
      setOccasion('')
      setTechnique('')
      setImageFile(null)
      setImagePreview(null)
      setColours([{ colour_name: '', hex_code: '', brand_name: '', brand_code: '' }])
      setTagsInput('')
      setSuccessMsg(`✓ "${design.title}" published successfully!`)
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
            style={{ width: '100%', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '12px 14px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', boxSizing: 'border-box', marginBottom: '10px' }}
          />
          {passwordError && <p style={{ color: '#e57373', fontSize: '12px', marginBottom: '10px' }}>{passwordError}</p>}
          <button
            onClick={handleLogin}
            style={{ width: '100%', background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: '500', cursor: 'pointer' }}
          >
            Enter
          </button>
        </div>
      </div>
    )
  }

  // ── Upload form ──────────────────────────────────────────────────
  return (
    <div style={{ padding: '24px 20px 60px', maxWidth: '600px', margin: '0 auto' }}>
      <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>Admin</p>
      <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', marginBottom: '28px' }}>Upload Design</h1>

      {/* Image */}
      <Section label="Photo">
        <label style={{ display: 'block', cursor: 'pointer' }}>
          {imagePreview ? (
            <img src={imagePreview} alt="Preview" style={{ width: '100%', borderRadius: '12px', display: 'block', marginBottom: '10px' }} />
          ) : (
            <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--bg-card)', border: '0.5px dashed var(--border)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Tap to select image</p>
            </div>
          )}
          <input type="file" accept="image/*" onChange={handleImageChange} style={{ display: 'none' }} />
        </label>
        {imagePreview && (
          <button onClick={() => { setImageFile(null); setImagePreview(null) }} style={ghostBtn}>Remove</button>
        )}
      </Section>

      {/* Title */}
      <Section label="Title *">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Dark Siren" style={inputStyle} />
      </Section>

      {/* Description */}
      <Section label="Description">
        <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Optional — describe the vibe, technique, or inspiration" rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: '1.6' }} />
      </Section>

      {/* Specs */}
      <Section label="Specs">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <Select label="Shape" value={shape} onChange={setShape} options={SHAPES} />
          <Select label="Length" value={length} onChange={setLength} options={LENGTHS} />
          <Select label="Occasion" value={occasion} onChange={setOccasion} options={OCCASIONS} />
          <Select label="Technique" value={technique} onChange={setTechnique} options={TECHNIQUES} />
        </div>
      </Section>

      {/* Colours */}
      <Section label="Colour Specs">
        {colours.map((colour, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '14px', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: colour.hex_code || 'var(--bg-chip)', border: '0.5px solid rgba(255,255,255,0.1)', flexShrink: 0 }} />
              <input
                value={colour.hex_code}
                onChange={e => updateColour(i, 'hex_code', e.target.value)}
                placeholder="#hex code"
                style={{ ...inputStyle, flex: 1, marginBottom: 0 }}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <input value={colour.colour_name} onChange={e => updateColour(i, 'colour_name', e.target.value)} placeholder="Colour name" style={inputStyle} />
              <input value={colour.brand_name} onChange={e => updateColour(i, 'brand_name', e.target.value)} placeholder="Brand name" style={inputStyle} />
              <input value={colour.brand_code} onChange={e => updateColour(i, 'brand_code', e.target.value)} placeholder="Brand code" style={{ ...inputStyle, gridColumn: '1 / -1' }} />
            </div>
            {colours.length > 1 && (
              <button onClick={() => removeColour(i)} style={{ ...ghostBtn, marginTop: '8px', color: '#e57373' }}>Remove colour</button>
            )}
          </div>
        ))}
        <button onClick={addColour} style={ghostBtn}>+ Add another colour</button>
      </Section>

      {/* Tags */}
      <Section label="Tags">
        <input
          value={tagsInput}
          onChange={e => setTagsInput(e.target.value)}
          placeholder="e.g. dark, gothic, gel, autumn (comma separated)"
          style={inputStyle}
        />
        <p style={{ color: 'var(--text-secondary)', fontSize: '11px', marginTop: '6px' }}>Separate multiple tags with commas</p>
      </Section>

      {/* Messages */}
      {errorMsg && (
        <div style={{ background: 'rgba(229,115,115,0.1)', border: '0.5px solid #e57373', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
          <p style={{ color: '#e57373', fontSize: '13px' }}>{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div style={{ background: 'rgba(129,199,132,0.1)', border: '0.5px solid #81c784', borderRadius: '10px', padding: '12px 14px', marginBottom: '16px' }}>
          <p style={{ color: '#81c784', fontSize: '13px' }}>{successMsg}</p>
        </div>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={submitting}
        style={{ width: '100%', background: submitting ? 'var(--bg-chip)' : 'var(--accent)', color: submitting ? 'var(--text-secondary)' : '#2C0A1E', border: 'none', borderRadius: '12px', padding: '14px', fontSize: '15px', fontWeight: '500', cursor: submitting ? 'not-allowed' : 'pointer' }}
      >
        {submitting ? 'Publishing...' : 'Publish Design'}
      </button>
    </div>
  )
}

// ── Helper components ────────────────────────────────────────────

function Section({ label, children }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <p style={{ color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>{label}</p>
      {children}
    </div>
  )
}

function Select({ label, value, onChange, options }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputStyle, color: value ? 'var(--text-primary)' : 'var(--text-secondary)', appearance: 'none', backgroundImage: 'none' }}
    >
      <option value="">{label}</option>
      {options.map(o => <option key={o} value={o.toLowerCase()}>{o}</option>)}
    </select>
  )
}

// ── Styles ────────────────────────────────────────────────────────

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
  marginBottom: 0,
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
}
