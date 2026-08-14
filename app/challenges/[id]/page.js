'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

function useCountdown(endsAt) {
  const [timeLeft, setTimeLeft] = useState('')
  useEffect(() => {
    const calc = () => {
      const diff = new Date(endsAt) - Date.now()
      if (diff <= 0) { setTimeLeft('Ended'); return }
      const d = Math.floor(diff / 86400000)
      const h = Math.floor((diff % 86400000) / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      if (d > 0) setTimeLeft(`${d}d ${h}h left`)
      else if (h > 0) setTimeLeft(`${h}h ${m}m left`)
      else setTimeLeft(`${m}m left`)
    }
    calc()
    const t = setInterval(calc, 60000)
    return () => clearInterval(t)
  }, [endsAt])
  return timeLeft
}

export default function ChallengeDetailPage() {
  const { id } = useParams()
  const router = useRouter()
  const fileRef = useRef()

  const [challenge, setChallenge] = useState(null)
  const [submissions, setSubmissions] = useState([])
  const [myVotes, setMyVotes] = useState(new Set())
  const [voteCounts, setVoteCounts] = useState({})
  const [currentUser, setCurrentUser] = useState(null)
  const [mySubmission, setMySubmission] = useState(null)
  const [loading, setLoading] = useState(true)

  // Submit modal
  const [submitOpen, setSubmitOpen] = useState(false)
  const [caption, setCaption] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const timeLeft = useCountdown(challenge?.ends_at || new Date().toISOString())
  const ended = challenge ? new Date(challenge.ends_at) < new Date() : false

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      const u = session?.user || null
      setCurrentUser(u)

      const { data: ch } = await supabase.from('challenges').select('*').eq('id', id).single()
      if (!ch) { router.push('/challenges'); return }
      setChallenge(ch)

      const { data: subs } = await supabase
        .from('challenge_submissions')
        .select('*, profiles(id, display_name, avatar_url)')
        .eq('challenge_id', id)
        .order('created_at', { ascending: false })

      // Fetch vote counts
      const subIds = (subs || []).map(s => s.id)
      let counts = {}
      let myVoteSet = new Set()

      if (subIds.length > 0) {
        const [{ data: allVotes }, { data: myVoteRows }] = await Promise.all([
          supabase.from('challenge_votes').select('submission_id').in('submission_id', subIds),
          u ? supabase.from('challenge_votes').select('submission_id').in('submission_id', subIds).eq('user_id', u.id)
            : Promise.resolve({ data: [] }),
        ])
        allVotes?.forEach(v => { counts[v.submission_id] = (counts[v.submission_id] || 0) + 1 })
        myVoteRows?.forEach(v => myVoteSet.add(v.submission_id))
      }

      setSubmissions(subs || [])
      setVoteCounts(counts)
      setMyVotes(myVoteSet)
      if (u) setMySubmission((subs || []).find(s => s.user_id === u.id) || null)
      setLoading(false)
    }
    load()
  }, [id])

  const handleImagePick = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!imageFile || submitting || !currentUser) return
    setSubmitting(true)

    const { data: { session } } = await supabase.auth.getSession()
    const formData = new FormData()
    formData.append('file', imageFile)
    formData.append('challengeId', id)
    const uploadRes = await fetch('/api/upload-challenge-photo', {
      method: 'POST',
      headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
      body: formData,
    })
    const uploadJson = await uploadRes.json().catch(() => ({}))
    if (!uploadRes.ok || uploadJson.error) { setSubmitting(false); alert('Upload failed: ' + (uploadJson.error || 'Unknown error')); return }
    const publicUrl = uploadJson.publicUrl

    const { data: sub, error: subError } = await supabase.from('challenge_submissions').insert({
      challenge_id: id,
      user_id: currentUser.id,
      image_url: publicUrl,
      caption: caption.trim() || null,
    }).select('*, profiles(id, display_name, avatar_url)').single()
    setSubmitting(false)
    if (subError || !sub) {
      alert('Failed to submit entry: ' + (subError?.message || 'Unknown error'))
      return
    }
    setSubmissions(prev => [sub, ...prev])
    setMySubmission(sub)
    setSubmitOpen(false)
    setImageFile(null); setImagePreview(null); setCaption('')
  }

  const toggleVote = async (subId, submissionUserId) => {
    if (!currentUser) { router.push('/profile'); return }
    if (submissionUserId === currentUser.id) return
    const voted = myVotes.has(subId)
    if (voted) {
      const { error } = await supabase.from('challenge_votes').delete().eq('submission_id', subId).eq('user_id', currentUser.id)
      if (error) return
      setMyVotes(prev => { const s = new Set(prev); s.delete(subId); return s })
      setVoteCounts(prev => ({ ...prev, [subId]: Math.max(0, (prev[subId] || 1) - 1) }))
    } else {
      const { error } = await supabase.from('challenge_votes').insert({ submission_id: subId, user_id: currentUser.id })
      if (error) return
      setMyVotes(prev => new Set([...prev, subId]))
      setVoteCounts(prev => ({ ...prev, [subId]: (prev[subId] || 0) + 1 }))
    }
  }

  // Sort by votes for ended challenges
  const sorted = ended
    ? [...submissions].sort((a, b) => (voteCounts[b.id] || 0) - (voteCounts[a.id] || 0))
    : submissions

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ paddingBottom: '100px', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Submit modal */}
      {submitOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9000, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ width: '100%', maxWidth: '440px', background: 'var(--bg-primary)', borderRadius: '20px', padding: '24px 20px 28px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600', margin: 0 }}>Submit your entry</p>
              <button onClick={() => setSubmitOpen(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer', padding: '4px', lineHeight: 1 }}>✕</button>
            </div>

            {imagePreview ? (
              <div style={{ position: 'relative', marginBottom: '12px', borderRadius: '12px', overflow: 'hidden', aspectRatio: '1/1' }}>
                <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => { setImageFile(null); setImagePreview(null) }}
                  style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: '#fff', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()}
                style={{ width: '100%', aspectRatio: '1/1', background: 'var(--bg-chip)', border: '1.5px dashed var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '12px' }}>
                <span style={{ color: 'var(--accent)', fontSize: '28px', marginBottom: '8px' }}>+</span>
                <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Tap to upload your photo</span>
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />

            <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption (optional)" rows={2}
              style={{ width: '100%', background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '10px 12px', color: 'var(--text-primary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif", resize: 'none', boxSizing: 'border-box', outline: 'none', marginBottom: '14px' }} />

            <button onClick={handleSubmit} disabled={!imageFile || submitting}
              style={{ width: '100%', padding: '14px', background: imageFile ? 'var(--accent)' : 'var(--bg-chip)', color: imageFile ? '#2C0A1E' : 'var(--text-secondary)', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: imageFile && !submitting ? 'pointer' : 'not-allowed' }}>
              {submitting ? 'Uploading…' : 'Submit entry'}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <Link href="/challenges" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
        </Link>
        <div style={{ flex: 1 }}>
          <h1 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0 }}>{challenge.title}</h1>
        </div>
        <span style={{ background: ended ? 'var(--bg-chip)' : 'rgba(212,160,192,0.15)', color: ended ? 'var(--text-secondary)' : 'var(--accent)', fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '20px', flexShrink: 0 }}>
          {ended ? 'Ended' : timeLeft}
        </span>
      </div>

      {challenge.description && (
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', margin: '0 20px 16px' }}>{challenge.description}</p>
      )}

      {/* Enter button */}
      {!ended && currentUser && !mySubmission && (
        <div style={{ padding: '0 20px 20px' }}>
          <button onClick={() => setSubmitOpen(true)}
            style={{ width: '100%', padding: '14px', background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '14px', fontSize: '15px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>
            ✦ Enter challenge
          </button>
        </div>
      )}
      {!ended && currentUser && mySubmission && (
        <div style={{ margin: '0 20px 20px', background: 'rgba(212,160,192,0.1)', border: '0.5px solid rgba(212,160,192,0.3)', borderRadius: '12px', padding: '12px 16px' }}>
          <p style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '500', margin: 0 }}>✓ You've entered this challenge</p>
        </div>
      )}
      {!ended && !currentUser && (
        <div style={{ padding: '0 20px 20px' }}>
          <Link href="/profile" style={{ display: 'block', textAlign: 'center', padding: '14px', background: 'var(--accent)', color: '#2C0A1E', borderRadius: '14px', fontSize: '15px', fontWeight: '600', textDecoration: 'none' }}>
            Sign in to enter
          </Link>
        </div>
      )}

      {/* Submissions */}
      {submissions.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>No entries yet — be the first!</p>
        </div>
      ) : (
        <div style={{ padding: '0 20px' }}>
          {ended && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
              Results · {submissions.length} {submissions.length === 1 ? 'entry' : 'entries'}
            </p>
          )}
          {!ended && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
              {submissions.length} {submissions.length === 1 ? 'entry' : 'entries'} · tap ♥ to vote
            </p>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {sorted.map((sub, i) => {
              const voteCount = voteCounts[sub.id] || 0
              const voted = myVotes.has(sub.id)
              const isOwn = sub.user_id === currentUser?.id
              const isWinner = ended && i === 0 && voteCount > 0
              const name = sub.profiles?.display_name || 'User'
              return (
                <div key={sub.id} style={{ position: 'relative', background: 'var(--bg-card)', borderRadius: '12px', border: `0.5px solid ${isWinner ? 'var(--accent)' : 'var(--border)'}`, overflow: 'hidden' }}>
                  {isWinner && (
                    <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 2, background: 'var(--accent)', color: '#2C0A1E', fontSize: '10px', fontWeight: '700', padding: '3px 8px', borderRadius: '8px' }}>
                      🏆 Winner
                    </div>
                  )}
                  <div style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden' }}>
                    <img src={sub.image_url} alt={sub.caption || name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ padding: '8px 10px 10px' }}>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '0 0 6px' }}>{name}</p>
                    {sub.caption && <p style={{ color: 'var(--text-primary)', fontSize: '12px', lineHeight: '1.4', margin: '0 0 8px' }}>{sub.caption}</p>}
                    <button onClick={() => toggleVote(sub.id, sub.user_id)} disabled={isOwn}
                      title={isOwn ? "You can't vote for your own entry" : undefined}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', background: voted ? 'rgba(212,160,192,0.15)' : 'var(--bg-chip)', border: `0.5px solid ${voted ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '20px', padding: '5px 10px', cursor: isOwn ? 'default' : 'pointer', opacity: isOwn ? 0.5 : 1, fontFamily: "'DM Sans', sans-serif" }}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill={voted ? '#D4A0C0' : 'none'}>
                        <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.5 3 2 5 2C6.2 2 7.2 2.6 8 3.5C8.8 2.6 9.8 2 11 2C13 2 14.5 3.5 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z" stroke={voted ? '#D4A0C0' : 'var(--text-secondary)'} strokeWidth="1.3" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ color: voted ? 'var(--accent)' : 'var(--text-secondary)', fontSize: '12px', fontWeight: '500' }}>{voteCount}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
