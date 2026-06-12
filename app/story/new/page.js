'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function NewStoryPage() {
  const router = useRouter()
  const [user, setUser]         = useState(null)
  const [image, setImage]       = useState(null)   // File
  const [preview, setPreview]   = useState(null)   // data URL
  const [caption, setCaption]   = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError]       = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user) router.replace('/profile')
      else setUser(session.user)
    })
  }, [])

  const handleImage = (e) => {
    const file = e.target.files[0]
    if (!file) return
    setImage(file)
    const reader = new FileReader()
    reader.onload = () => setPreview(reader.result)
    reader.readAsDataURL(file)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!image || !user) return
    setSubmitting(true)
    setError('')

    const ext  = image.name.split('.').pop()
    const path = `stories/${user.id}/${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('designs')
      .upload(path, image, { upsert: false })

    if (uploadErr) { setError('Upload failed: ' + uploadErr.message); setSubmitting(false); return }

    const { data: { publicUrl } } = supabase.storage.from('designs').getPublicUrl(path)

    const { error: insertErr } = await supabase.from('stories').insert({
      user_id:   user.id,
      image_url: publicUrl,
      caption:   caption.trim() || null,
    })

    if (insertErr) { setError('Could not save story: ' + insertErr.message); setSubmitting(false); return }

    router.push('/feed')
  }

  if (!user) return null

  return (
    <div style={{ padding: '24px 20px', paddingBottom: '40px' }}>

      {/* Back */}
      <Link href="/feed" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', textDecoration: 'none', fontSize: '13px', fontWeight: '500', marginBottom: '24px' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        Back
      </Link>

      <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '500', letterSpacing: '-0.02em', marginBottom: '4px' }}>
        Add to story
      </h1>
      <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '28px' }}>
        Disappears after 24 hours
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Image picker */}
        <label style={{ cursor: 'pointer' }}>
          <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
          {preview ? (
            <div style={{ borderRadius: '16px', overflow: 'hidden', aspectRatio: '9/16', maxHeight: '60vh', background: '#000', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <img src={preview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
            </div>
          ) : (
            <div style={{
              border: '1.5px dashed var(--border)', borderRadius: '16px',
              aspectRatio: '9/16', maxHeight: '60vh',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
              background: 'var(--bg-card)',
            }}>
              <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                <rect x="4" y="4" width="24" height="24" rx="6" stroke="#D4A0C0" strokeWidth="1.5"/>
                <circle cx="12" cy="13" r="2.5" stroke="#D4A0C0" strokeWidth="1.5"/>
                <path d="M4 22L10 16L14 20L20 13L28 22" stroke="#D4A0C0" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Tap to choose photo</p>
            </div>
          )}
        </label>

        {preview && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--accent)', fontSize: '13px', fontWeight: '500', cursor: 'pointer', alignSelf: 'flex-start' }}>
            <input type="file" accept="image/*" onChange={handleImage} style={{ display: 'none' }} />
            Change photo
          </label>
        )}

        {/* Caption */}
        <textarea
          placeholder="Add a caption... (optional)"
          value={caption}
          onChange={e => setCaption(e.target.value)}
          maxLength={200}
          rows={3}
          style={{
            background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: '12px', padding: '14px 16px',
            color: 'var(--text-primary)', fontSize: '14px',
            fontFamily: "'DM Sans', sans-serif", outline: 'none',
            resize: 'none', lineHeight: '1.5',
          }}
        />

        {error && <p style={{ color: '#E07070', fontSize: '13px' }}>{error}</p>}

        <button
          type="submit"
          disabled={!image || submitting}
          style={{
            background: !image ? 'var(--bg-chip)' : 'var(--accent)',
            color: !image ? 'var(--text-secondary)' : '#2C0A1E',
            border: 'none', borderRadius: '14px', padding: '15px',
            fontSize: '15px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif",
            cursor: !image || submitting ? 'not-allowed' : 'pointer',
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? 'Posting...' : 'Post story'}
        </button>

      </form>
    </div>
  )
}
