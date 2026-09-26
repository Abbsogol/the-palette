'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import BackButton from '@/components/ui/BackButton'
import Sheet from '@/components/ui/Sheet'

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

// Module-level: an inline Shell got a new identity every render, remounting the
// subtree and stealing focus from the entry caption while typing.
function Shell({ children }) {
  return (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative', paddingBottom: 'calc(env(safe-area-inset-bottom) + 120px)' }}>{children}</div>
    </div>
  )
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

  // Submit sheet
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

      const { data: ch, error: chError } = await supabase.from('challenges').select('*').eq('id', id).single()
      if (chError) console.error('challenge fetch failed:', chError)
      if (!ch) { router.push('/challenges'); return }
      setChallenge(ch)

      const { data: subs, error: subsError } = await supabase
        .from('challenge_submissions')
        .select('*, profiles(id, display_name, avatar_url)')
        .eq('challenge_id', id)
        .order('created_at', { ascending: false })
        .limit(500)
      if (subsError) console.error('challenge submissions fetch failed:', subsError)

      // Fetch vote counts
      const subIds = (subs || []).map(s => s.id)
      let counts = {}
      let myVoteSet = new Set()

      if (subIds.length > 0) {
        const [{ data: allVotes, error: votesError }, { data: myVoteRows, error: myVotesError }] = await Promise.all([
          supabase.from('challenge_votes').select('submission_id').in('submission_id', subIds),
          u ? supabase.from('challenge_votes').select('submission_id').in('submission_id', subIds).eq('user_id', u.id)
            : Promise.resolve({ data: [] }),
        ])
        if (votesError) console.error('vote counts fetch failed:', votesError)
        if (myVotesError) console.error('my votes fetch failed:', myVotesError)
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
      alert(subError?.message?.includes('CHALLENGE_ENDED')
        ? 'This challenge has ended — submissions are closed.'
        : 'Failed to submit entry: ' + (subError?.message || 'Unknown error'))
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
    <Shell>
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={ui(300, 14, WHITE60)}>Loading…</p>
      </div>
    </Shell>
  )

  return (
    <Shell>
      {/* Submit sheet */}
      {submitOpen && (
        <Sheet
          title="Submit your entry"
          onClose={() => setSubmitOpen(false)}
          footer={
            <button onClick={handleSubmit} disabled={!imageFile || submitting}
              style={{ width: '100%', padding: '14px', background: imageFile ? BTN_GRADIENT : 'rgba(255,255,255,0.08)', ...ui(600, 15, imageFile ? 'var(--lq-white)' : WHITE60), border: 'none', borderRadius: '1000px', cursor: imageFile && !submitting ? 'pointer' : 'not-allowed' }}>
              {submitting ? 'Uploading…' : 'Submit entry'}
            </button>
          }
        >
          <h2 style={{ ...display(22), margin: '0 0 16px' }}>Submit your entry</h2>

          {imagePreview ? (
            <div style={{ position: 'relative', marginBottom: '12px', borderRadius: '14px', overflow: 'hidden', aspectRatio: '1/1' }}>
              <img src={imagePreview} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button onClick={() => { setImageFile(null); setImagePreview(null) }}
                style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: '28px', height: '28px', color: '#fff', fontSize: '14px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()}
              style={{ width: '100%', aspectRatio: '1/1', background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.25)', borderRadius: '14px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: '12px' }}>
              <span style={{ ...ui(400, 28, ACCENT), marginBottom: '8px' }}>+</span>
              <span style={ui(300, 13, WHITE60)}>Tap to upload your photo</span>
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImagePick} style={{ display: 'none' }} />

          <textarea value={caption} onChange={e => setCaption(e.target.value)} placeholder="Add a caption (optional)" rows={2}
            style={{ width: '100%', background: 'rgba(255,255,255,0.04)', border: PANEL_BORDER, borderRadius: '12px', padding: '10px 12px', ...ui(400, 14), resize: 'none', boxSizing: 'border-box', outline: 'none' }} />
        </Sheet>
      )}

      {/* Header */}
      <div style={{ padding: 'calc(env(safe-area-inset-top) + 16px) 20px 0', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <BackButton fallback="/challenges" />
        <h1 style={{ ...display(22), margin: 0, flex: 1 }}>{challenge.title}</h1>
        <span style={{ background: ended ? 'rgba(255,255,255,0.08)' : 'rgba(255,81,127,0.15)', ...ui(600, 11, ended ? WHITE60 : ACCENT), padding: '4px 10px', borderRadius: '1000px', flexShrink: 0 }}>
          {ended ? 'Ended' : timeLeft}
        </span>
      </div>

      {challenge.description && (
        <p style={{ ...ui(300, 14, WHITE60), lineHeight: 1.6, margin: '0 20px 16px' }}>{challenge.description}</p>
      )}

      {/* Enter button */}
      {!ended && currentUser && !mySubmission && (
        <div style={{ padding: '0 20px 20px' }}>
          <button onClick={() => setSubmitOpen(true)}
            style={{ width: '100%', padding: '14px', background: BTN_GRADIENT, color: 'var(--lq-white)', border: 'none', borderRadius: '1000px', ...ui(600, 15), cursor: 'pointer' }}>
            ✦ Enter challenge
          </button>
        </div>
      )}
      {!ended && currentUser && mySubmission && (
        <div style={{ margin: '0 20px 20px', background: 'rgba(255,81,127,0.1)', border: '1px solid rgba(255,81,127,0.3)', borderRadius: '12px', padding: '12px 16px' }}>
          <p style={{ ...ui(500, 13, ACCENT), margin: 0 }}>✓ You&apos;ve entered this challenge</p>
        </div>
      )}
      {!ended && !currentUser && (
        <div style={{ padding: '0 20px 20px' }}>
          <button onClick={() => router.push('/profile')} style={{ display: 'block', width: '100%', textAlign: 'center', padding: '14px', background: BTN_GRADIENT, color: 'var(--lq-white)', border: 'none', borderRadius: '1000px', ...ui(600, 15), cursor: 'pointer' }}>
            Sign in to enter
          </button>
        </div>
      )}

      {/* Submissions */}
      {submissions.length === 0 ? (
        <div style={{ padding: '32px 20px', textAlign: 'center' }}>
          <p style={ui(300, 14, WHITE60)}>No entries yet — be the first!</p>
        </div>
      ) : (
        <div style={{ padding: '0 20px' }}>
          <p style={{ ...ui(600, 11, WHITE60), letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '12px' }}>
            {ended
              ? `Results · ${submissions.length} ${submissions.length === 1 ? 'entry' : 'entries'}`
              : `${submissions.length} ${submissions.length === 1 ? 'entry' : 'entries'} · tap ♥ to vote`}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {sorted.map((sub, i) => {
              const voteCount = voteCounts[sub.id] || 0
              const voted = myVotes.has(sub.id)
              const isOwn = sub.user_id === currentUser?.id
              const isWinner = ended && i === 0 && voteCount > 0
              const name = sub.profiles?.display_name || 'User'
              return (
                <div key={sub.id} style={{ position: 'relative', background: PANEL, borderRadius: '14px', border: `1px solid ${isWinner ? 'rgba(255,81,127,0.5)' : 'rgba(255,255,255,0.1)'}`, overflow: 'hidden' }}>
                  {isWinner && (
                    <div style={{ position: 'absolute', top: '8px', left: '8px', zIndex: 2, background: ACCENT, ...ui(700, 10, WINE), padding: '3px 8px', borderRadius: '8px' }}>
                      🏆 Winner
                    </div>
                  )}
                  <div style={{ width: '100%', aspectRatio: '1/1', overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
                    <img src={sub.image_url} alt={sub.caption || name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </div>
                  <div style={{ padding: '8px 10px 10px' }}>
                    <p style={{ ...ui(300, 11, WHITE60), margin: '0 0 6px' }}>{name}</p>
                    {sub.caption && <p style={{ ...ui(400, 12), lineHeight: 1.4, margin: '0 0 8px' }}>{sub.caption}</p>}
                    <button onClick={() => toggleVote(sub.id, sub.user_id)} disabled={isOwn}
                      title={isOwn ? "You can't vote for your own entry" : undefined}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', background: voted ? 'rgba(255,81,127,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${voted ? 'rgba(255,81,127,0.5)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '1000px', padding: '5px 10px', cursor: isOwn ? 'default' : 'pointer', opacity: isOwn ? 0.5 : 1 }}>
                      <svg width="12" height="12" viewBox="0 0 16 16" fill={voted ? ACCENT : 'none'}>
                        <path d="M8 13.5C8 13.5 1.5 9.5 1.5 5.5C1.5 3.5 3 2 5 2C6.2 2 7.2 2.6 8 3.5C8.8 2.6 9.8 2 11 2C13 2 14.5 3.5 14.5 5.5C14.5 9.5 8 13.5 8 13.5Z" stroke={voted ? ACCENT : WHITE60} strokeWidth="1.3" strokeLinejoin="round"/>
                      </svg>
                      <span style={ui(500, 12, voted ? ACCENT : WHITE60)}>{voteCount}</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </Shell>
  )
}
