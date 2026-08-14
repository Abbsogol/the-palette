'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function BatchUploadPage() {
  const [authed, setAuthed] = useState(false)
  const [checkingAuth, setCheckingAuth] = useState(true)
  const [jsonText, setJsonText] = useState('')
  const [designs, setDesigns] = useState([])
  const [images, setImages] = useState({})
  const [parseError, setParseError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState([])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) { setCheckingAuth(false); return }
      const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', session.user.id).single()
      setAuthed(!!prof?.is_admin)
      setCheckingAuth(false)
    })
  }, [])

  const parseJSON = () => {
    setParseError('')
    try {
      let parsed = JSON.parse(jsonText)
      if (!Array.isArray(parsed)) parsed = [parsed]
      setDesigns(parsed)
      setImages(Object.fromEntries(parsed.map((_, i) => [i, { main: null, extras: [] }])))
      setProgress([])
    } catch (e) {
      setParseError('Invalid JSON — ' + e.message)
    }
  }

  const setMainImage = (i, file) => {
    setImages(prev => ({ ...prev, [i]: { ...prev[i], main: file } }))
  }

  const addExtraImages = (i, files) => {
    setImages(prev => ({ ...prev, [i]: { ...prev[i], extras: [...(prev[i]?.extras || []), ...files] } }))
  }

  const removeExtra = (di, ei) => {
    setImages(prev => ({
      ...prev,
      [di]: { ...prev[di], extras: prev[di].extras.filter((_, i) => i !== ei) }
    }))
  }

  const uploadFile = async (file, slug) => {
    const ext = file.name.split('.').pop()
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}-${slug}.${ext}`
    const { error } = await supabase.storage.from('designs').upload(fileName, file, { cacheControl: '3600', upsert: false })
    if (error) throw new Error('Image upload failed: ' + error.message)
    const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(fileName)
    return publicUrl
  }

  const upsertTag = async (name) => {
    const { data, error } = await supabase.from('tags').upsert({ name }, { onConflict: 'name' }).select('id').single()
    if (error) throw new Error('Tag error: ' + error.message)
    return data.id
  }

  const uploadDesign = async (design, imgs) => {
    const slug = design.title.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')

    let imageUrl = null
    if (imgs?.main) imageUrl = await uploadFile(imgs.main, slug)

    const occasion = Array.isArray(design.occasions)
      ? design.occasions.join(', ')
      : (design.occasion || null)
    const technique = Array.isArray(design.techniques)
      ? design.techniques.join(', ')
      : (design.technique || null)

    const { data: designRow, error: designErr } = await supabase
      .from('designs')
      .insert({ title: design.title, description: design.description || null, image_url: imageUrl, shape: design.shape || null, length: design.length || null, occasion, technique })
      .select('id')
      .single()
    if (designErr) throw new Error(designErr.message)
    const designId = designRow.id
    const { error: slugErr } = await supabase.from('designs').update({ slug }).eq('id', designId)
    if (slugErr) throw new Error('Slug error: ' + slugErr.message)

    if (design.colours?.length) {
      const rows = design.colours.map(c => ({
        design_id: designId,
        colour_name: c.colour_name || c.name || '',
        hex_code: c.hex_code || c.hex || '',
        brand_name: c.brand_name || c.brand || '',
        brand_code: c.brand_code || c.code || '',
      }))
      const { error } = await supabase.from('design_colours').insert(rows)
      if (error) throw new Error(error.message)
    }

    if (imgs?.extras?.length) {
      const urls = await Promise.all(imgs.extras.map(f => uploadFile(f, slug)))
      const rows = urls.map((url, i) => ({ design_id: designId, image_url: url}))
      const { error } = await supabase.from('design_images').insert(rows)
      if (error) throw new Error(error.message)
    }

    const tags = design.tags || []
    if (tags.length) {
      const tagIds = await Promise.all(tags.map(t => upsertTag(t.toLowerCase().trim())))
      const rows = tagIds.map(tag_id => ({ design_id: designId, tag_id }))
      const { error } = await supabase.from('design_tags').insert(rows)
      if (error) throw new Error(error.message)
    }
  }

  const handleUploadAll = async () => {
    setUploading(true)
    setProgress(designs.map(d => ({ title: d.title, status: 'pending', msg: '' })))
    for (let i = 0; i < designs.length; i++) {
      setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'uploading' } : p))
      try {
        await uploadDesign(designs[i], images[i])
        setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'done' } : p))
      } catch (err) {
        setProgress(prev => prev.map((p, idx) => idx === i ? { ...p, status: 'error', msg: err.message } : p))
      }
    }
    setUploading(false)
  }

  const s = {
    bg: { minHeight: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'DM Sans, sans-serif', paddingBottom: '60px' },
    inner: { maxWidth: '600px', margin: '0 auto', padding: '0 20px' },
    input: { width: '100%', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '11px 13px', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' },
    btn: { background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '10px', padding: '13px 20px', fontWeight: '500', fontSize: '14px', cursor: 'pointer', fontFamily: 'inherit', width: '100%' },
    card: { background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '14px', padding: '16px', marginBottom: '12px' },
    label: { color: 'var(--accent)', fontSize: '11px', fontWeight: '500', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px', display: 'block' },
  }

  if (checkingAuth) {
    return (
      <div style={s.bg}>
        <div style={{ ...s.inner, paddingTop: '30vh' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Loading…</p>
        </div>
      </div>
    )
  }
  if (!authed) {
    return (
      <div style={s.bg}>
        <div style={{ ...s.inner, paddingTop: '30vh', textAlign: 'center' }}>
          <p style={{ color: 'var(--accent)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '8px' }}>Admin</p>
          <h1 style={{ fontSize: '28px', fontWeight: '400', marginBottom: '10px' }}>You don't have access</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Sign in with an admin account to view this page.</p>
        </div>
      </div>
    )
  }

  const allDone = progress.length > 0 && progress.every(p => p.status === 'done')

  return (
    <div style={s.bg}>
      <div style={{ ...s.inner, paddingTop: '32px' }}>
        <a href="/admin" style={{ color: 'var(--text-secondary)', fontSize: '12px', textDecoration: 'none' }}>← Back to Admin</a>
        <h1 style={{ fontSize: '24px', fontWeight: '400', margin: '12px 0 4px' }}>Batch Upload</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '28px' }}>Paste your JSON specs from ChatGPT, attach images, and upload everything at once.</p>

        <div style={{ marginBottom: '20px' }}>
          <label style={s.label}>Paste JSON Specs</label>
          <textarea
            style={{ ...s.input, minHeight: '160px', resize: 'vertical', lineHeight: '1.5' }}
            placeholder={`Paste the JSON from ChatGPT here.\nCan be a single design { } or an array [ ... ].`}
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
          />
          {parseError && <p style={{ color: '#ff6b6b', fontSize: '12px', marginTop: '6px' }}>{parseError}</p>}
          <button style={{ ...s.btn, marginTop: '10px' }} onClick={parseJSON}>Parse Designs →</button>
        </div>

        {designs.length > 0 && (
          <>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '14px' }}>
              {designs.length} design{designs.length !== 1 ? 's' : ''} found — add images below, then upload all at once.
            </p>

            {designs.map((d, i) => {
              const prog = progress[i]
              const statusColor = prog?.status === 'done' ? '#7ecf7e' : prog?.status === 'error' ? '#ff8080' : prog?.status === 'uploading' ? '#cfcf7e' : 'var(--text-secondary)'
              const statusBg = prog?.status === 'done' ? '#1a3a1a' : prog?.status === 'error' ? '#3a1a1a' : prog?.status === 'uploading' ? '#2a2a14' : 'var(--bg-chip)'
              const statusLabel = prog?.status === 'done' ? '✓ Done' : prog?.status === 'error' ? '✗ Error' : prog?.status === 'uploading' ? '↑ Uploading…' : '○ Pending'

              return (
                <div key={i} style={s.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                    <div style={{ flex: 1, marginRight: '12px' }}>
                      <p style={{ fontWeight: '500', fontSize: '15px', marginBottom: '3px' }}>{d.title}</p>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
                        {[d.shape, d.length].filter(Boolean).join(' · ')}
                        {(d.techniques || d.technique) && ' · ' + (Array.isArray(d.techniques) ? d.techniques.slice(0, 3).join(', ') : d.technique)}
                      </p>
                    </div>
                    {prog && (
                      <span style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '20px', background: statusBg, color: statusColor, whiteSpace: 'nowrap' }}>
                        {statusLabel}
                      </span>
                    )}
                  </div>

                  {d.colours?.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
                      {d.colours.map((c, ci) => (
                        <div key={ci} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'var(--bg-chip)', borderRadius: '20px', padding: '3px 8px 3px 5px' }}>
                          <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: c.hex_code || c.hex || '#888', border: '1px solid rgba(255,255,255,0.15)', flexShrink: 0 }} />
                          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{c.colour_name || c.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <div style={{ marginBottom: '12px' }}>
                    <label style={{ ...s.label, marginBottom: '6px' }}>Main Photo *</label>
                    {images[i]?.main ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <img src={URL.createObjectURL(images[i].main)} style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} alt="" />
                        <div>
                          <p style={{ fontSize: '12px', color: 'var(--text-primary)', marginBottom: '2px' }}>{images[i].main.name}</p>
                          <button onClick={() => setMainImage(i, null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '11px', cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>Remove</button>
                        </div>
                      </div>
                    ) : (
                      <label style={{ display: 'block', cursor: 'pointer' }}>
                        <div style={{ background: 'var(--bg-primary)', border: '0.5px dashed var(--border)', borderRadius: '8px', padding: '14px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px' }}>
                          Tap to add main photo
                        </div>
                        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && setMainImage(i, e.target.files[0])} />
                      </label>
                    )}
                  </div>

                  <div>
                    <label style={{ ...s.label, marginBottom: '6px' }}>Additional Photos</label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(images[i]?.extras || []).map((f, ei) => (
                        <div key={ei} style={{ position: 'relative' }}>
                          <img src={URL.createObjectURL(f)} style={{ width: '52px', height: '52px', objectFit: 'cover', borderRadius: '6px', display: 'block' }} alt="" />
                          <button onClick={() => removeExtra(i, ei)} style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'rgba(0,0,0,0.85)', border: 'none', borderRadius: '50%', width: '18px', height: '18px', color: '#fff', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1 }}>×</button>
                        </div>
                      ))}
                      <label style={{ cursor: 'pointer' }}>
                        <div style={{ width: '52px', height: '52px', background: 'var(--bg-primary)', border: '0.5px dashed var(--border)', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: '20px' }}>+</div>
                        <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => addExtraImages(i, Array.from(e.target.files))} />
                      </label>
                    </div>
                  </div>

                  {prog?.status === 'error' && (
                    <p style={{ color: '#ff8080', fontSize: '12px', marginTop: '10px' }}>Error: {prog.msg}</p>
                  )}
                </div>
              )
            })}

            {!allDone && (
              <button style={{ ...s.btn, marginTop: '8px', opacity: uploading ? 0.6 : 1 }} onClick={handleUploadAll} disabled={uploading}>
                {uploading ? 'Uploading…' : `Upload All ${designs.length} Design${designs.length !== 1 ? 's' : ''}`}
              </button>
            )}

            {allDone && (
              <div style={{ textAlign: 'center', marginTop: '20px' }}>
                <p style={{ color: '#7ecf7e', fontSize: '16px', marginBottom: '12px' }}>✓ All designs uploaded!</p>
                <a href="/" style={{ color: 'var(--accent)', fontSize: '13px' }}>View on home feed →</a>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
