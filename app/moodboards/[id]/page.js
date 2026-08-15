'use client'
import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ShareButton from '@/components/ShareButton'

export default function MoodboardDetailPage() {
  const { id } = useParams()
  const [board, setBoard] = useState(null)
  const [designs, setDesigns] = useState([])
  const [creatorName, setCreatorName] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [isPrivate, setIsPrivate] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [isOwner, setIsOwner] = useState(false)
  const [isMember, setIsMember] = useState(false)

  // Members state
  const [members, setMembers] = useState([])
  const [showShareModal, setShowShareModal] = useState(false)
  const [searchUsername, setSearchUsername] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const searchTimeout = useRef(null)

  useEffect(() => {
    if (!id) return
    supabase.auth.getSession().then(({ data: { session } }) => {
      setCurrentUser(session?.user || null)
      loadBoard(session?.user?.id || null)
    })
  }, [id])

  async function loadBoard(currentUserId) {
    setLoading(true)

    const { data: boardData } = await supabase
      .from('moodboards')
      .select('id, name, description, is_public, user_id')
      .eq('id', id)
      .single()

    if (!boardData) { setNotFound(true); setLoading(false); return }

    const owner = currentUserId === boardData.user_id
    setIsOwner(owner)

    // Check if current user is a member
    let member = false
    if (currentUserId && !owner) {
      const { data: memberRow } = await supabase
        .from('moodboard_members')
        .select('id')
        .eq('moodboard_id', id)
        .eq('user_id', currentUserId)
        .maybeSingle()
      member = !!memberRow
      setIsMember(member)
    }

    // Block non-owners/non-members from viewing private boards
    if (!boardData.is_public && !owner && !member) {
      setIsPrivate(true)
      setLoading(false)
      return
    }

    setBoard(boardData)

    // Load designs, creator profile, and members in parallel
    const [{ data: boardDesigns }, { data: profile }, { data: memberRows }] = await Promise.all([
      supabase
        .from('moodboard_designs')
        .select('design_id, added_at, designs(id, title, image_url, shape, category)')
        .eq('moodboard_id', id)
        .order('added_at', { ascending: false })
        .limit(300),
      supabase
        .from('profiles')
        .select('display_name, username')
        .eq('id', boardData.user_id)
        .single(),
      supabase
        .from('moodboard_members')
        .select('id, user_id, invited_by, created_at')
        .eq('moodboard_id', id),
    ])

    setDesigns(boardDesigns?.map(r => r.designs).filter(Boolean) || [])
    setCreatorName(profile?.display_name || profile?.username || null)

    // Fetch member profiles separately (FK → auth.users pattern)
    if (memberRows?.length) {
      const memberIds = memberRows.map(m => m.user_id)
      const { data: memberProfiles } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url')
        .in('id', memberIds)
      const profileMap = {}
      memberProfiles?.forEach(p => { profileMap[p.id] = p })
      setMembers(memberRows.map(m => ({ ...m, profile: profileMap[m.user_id] || null })))
    } else {
      setMembers([])
    }

    setLoading(false)
  }

  // Search for user by username as they type
  const handleUsernameChange = (val) => {
    setSearchUsername(val)
    setSearchResult(null)
    setSearchError('')
    clearTimeout(searchTimeout.current)
    if (!val.trim()) return
    searchTimeout.current = setTimeout(() => searchUser(val.trim()), 500)
  }

  const searchUser = async (username) => {
    setSearchLoading(true)
    setSearchError('')
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url')
      .eq('username', username.replace('@', '').toLowerCase())
      .maybeSingle()
    setSearchLoading(false)
    if (!data) { setSearchError('No user found with that username'); return }
    if (data.id === currentUser?.id) { setSearchError("You can't invite yourself"); return }
    if (members.some(m => m.user_id === data.id)) { setSearchError('Already a collaborator'); return }
    if (data.id === board?.user_id) { setSearchError("That's the board owner"); return }
    setSearchResult(data)
  }

  const addMember = async () => {
    if (!searchResult || !currentUser || !isOwner) return
    setAddingMember(true)
    const { error } = await supabase.from('moodboard_members').insert({
      moodboard_id: id,
      user_id: searchResult.id,
      invited_by: currentUser.id,
    })
    if (error) {
      setSearchError('Failed to add member. Please try again.')
      setAddingMember(false)
      return
    }
    // Send notification
    await supabase.from('notifications').insert({
      user_id: searchResult.id,
      actor_id: currentUser.id,
      type: 'moodboard_invite',
      design_id: null,
    })
    setMembers(prev => [...prev, { user_id: searchResult.id, profile: searchResult, invited_by: currentUser.id }])
    setSearchResult(null)
    setSearchUsername('')
    setSearchError('')
    setAddingMember(false)
    setShowShareModal(false)
  }

  const removeMember = async (memberId, memberUserId) => {
    const { error } = await supabase.from('moodboard_members')
      .delete()
      .eq('moodboard_id', id)
      .eq('user_id', memberUserId)
    if (error) { alert('Failed to remove member. Please try again.'); return }
    setMembers(prev => prev.filter(m => m.user_id !== memberUserId))
    // If current user just removed themselves, redirect
    if (memberUserId === currentUser?.id) {
      window.location.href = '/moodboards'
    }
  }

  if (loading) return (
    <div style={{ padding: '40px 20px', color: 'var(--text-secondary)', fontSize: '14px', fontFamily: "'DM Sans', sans-serif" }}>
      Loading...
    </div>
  )

  if (isPrivate) return (
    <div style={{ padding: '24px 20px', textAlign: 'center', paddingTop: '80px', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ fontSize: '28px', marginBottom: '12px' }}>🔒</p>
      <p style={{ color: 'var(--text-primary)', fontSize: '15px', fontWeight: '500', marginBottom: '6px' }}>This board is private</p>
      <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginBottom: '20px' }}>Only the owner can view this board.</p>
      <Link href="/feed" style={{ color: 'var(--accent)', fontSize: '14px', textDecoration: 'none' }}>← Browse designs</Link>
    </div>
  )

  if (notFound || !board) return (
    <div style={{ padding: '24px 20px', textAlign: 'center', paddingTop: '60px', fontFamily: "'DM Sans', sans-serif" }}>
      <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginBottom: '16px' }}>Board not found.</p>
      <Link href="/moodboards" style={{ color: 'var(--accent)', fontSize: '14px', textDecoration: 'none' }}>← Back to My Boards</Link>
    </div>
  )

  return (
    <div style={{ paddingBottom: '32px', fontFamily: "'DM Sans', sans-serif" }}>

      {/* Share modal */}
      {showShareModal && (
        <div
          onClick={e => e.target === e.currentTarget && setShowShareModal(false)}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px',
          }}
        >
          <div style={{
            background: 'var(--bg-card)', borderRadius: '20px', padding: '24px 20px',
            width: '100%', maxWidth: '400px', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '17px', fontWeight: '600', margin: 0 }}>Invite collaborator</h2>
              <button onClick={() => setShowShareModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: '20px', cursor: 'pointer', padding: '2px 6px', lineHeight: 1 }}>
                ×
              </button>
            </div>

            <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 14px', lineHeight: '1.5' }}>
              Enter someone's username to give them access to this board.
            </p>

            <input
              autoFocus
              value={searchUsername}
              onChange={e => handleUsernameChange(e.target.value)}
              placeholder="@username"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
                borderRadius: '12px', padding: '12px 14px',
                color: 'var(--text-primary)', fontSize: '15px',
                fontFamily: "'DM Sans', sans-serif", outline: 'none',
                marginBottom: '12px',
              }}
            />

            {searchLoading && (
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 12px' }}>Searching…</p>
            )}

            {searchError && (
              <p style={{ color: '#E07070', fontSize: '13px', margin: '0 0 12px' }}>{searchError}</p>
            )}

            {searchResult && (
              <div style={{
                background: 'var(--bg-primary)', border: '0.5px solid var(--border)',
                borderRadius: '12px', padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
              }}>
                <div style={{
                  width: '38px', height: '38px', borderRadius: '50%',
                  background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {searchResult.avatar_url
                    ? <img src={searchResult.avatar_url} alt={searchResult.display_name} loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: '600' }}>{(searchResult.display_name || '?')[0].toUpperCase()}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: '0 0 2px' }}>{searchResult.display_name}</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>@{searchResult.username}</p>
                </div>
              </div>
            )}

            <button
              onClick={addMember}
              disabled={!searchResult || addingMember}
              style={{
                width: '100%', padding: '13px',
                background: searchResult ? 'var(--accent)' : 'var(--bg-chip)',
                color: searchResult ? '#2C0A1E' : 'var(--text-secondary)',
                border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: '600',
                fontFamily: "'DM Sans', sans-serif",
                cursor: searchResult && !addingMember ? 'pointer' : 'not-allowed',
                opacity: addingMember ? 0.7 : 1,
              }}
            >
              {addingMember ? 'Adding…' : 'Give access'}
            </button>

            {/* Existing collaborators */}
            {members.length > 0 && (
              <div style={{ marginTop: '20px' }}>
                <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Collaborators</p>
                {members.map(m => (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '0.5px solid var(--border)' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {m.profile?.avatar_url
                        ? <img src={m.profile.avatar_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <span style={{ color: 'var(--accent)', fontSize: '13px', fontWeight: '600' }}>{(m.profile?.display_name || '?')[0].toUpperCase()}</span>
                      }
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: 0 }}>{m.profile?.display_name || m.profile?.username}</p>
                    </div>
                    <button
                      onClick={() => removeMember(m.id, m.user_id)}
                      style={{ background: 'none', border: 'none', color: '#E07070', fontSize: '12px', cursor: 'pointer', padding: '4px 8px', fontFamily: "'DM Sans', sans-serif" }}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding: '16px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/moodboards" style={{
          display: 'inline-flex', alignItems: 'center', gap: '6px',
          color: 'var(--text-secondary)', textDecoration: 'none',
          fontSize: '13px', fontWeight: '500',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Boards
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {board.is_public && <ShareButton title={board.name} />}
          {/* Invite button — owner only */}
          {isOwner && (
            <button
              onClick={() => setShowShareModal(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: 'var(--bg-chip)', border: '0.5px solid var(--border)',
                borderRadius: '20px', padding: '6px 12px',
                color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500',
                fontFamily: "'DM Sans', sans-serif", cursor: 'pointer',
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
              </svg>
              Invite
              {members.length > 0 && (
                <span style={{ background: 'var(--accent)', color: '#2C0A1E', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: '700' }}>
                  {members.length}
                </span>
              )}
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '24px', fontWeight: '500', letterSpacing: '-0.02em', margin: '0 0 6px' }}>
          {board.name}
        </h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>
            {designs.length} {designs.length === 1 ? 'design' : 'designs'}
          </span>
          {creatorName && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>· by {creatorName}</span>
          )}
          {board.is_public && (
            <span style={{
              background: 'rgba(212,160,192,0.15)', color: 'var(--accent)',
              fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em',
              padding: '3px 8px', borderRadius: '6px', textTransform: 'uppercase',
            }}>Public</span>
          )}
        </div>

        {/* Collaborator avatars */}
        {members.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '10px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2">
              <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
              <circle cx="9" cy="7" r="4"/>
              <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
            </svg>
            <div style={{ display: 'flex' }}>
              {members.slice(0, 5).map((m, i) => (
                <div key={m.user_id} style={{
                  width: '22px', height: '22px', borderRadius: '50%',
                  background: 'var(--bg-chip)', border: '1.5px solid var(--bg-primary)',
                  overflow: 'hidden', marginLeft: i > 0 ? '-6px' : 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {m.profile?.avatar_url
                    ? <img src={m.profile.avatar_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: 'var(--accent)', fontSize: '9px', fontWeight: '700' }}>{(m.profile?.display_name || '?')[0].toUpperCase()}</span>
                  }
                </div>
              ))}
            </div>
            <span style={{ color: 'var(--text-secondary)', fontSize: '12px' }}>
              {members.length} collaborator{members.length !== 1 ? 's' : ''}
            </span>
            {/* Non-owner member: show "Leave board" */}
            {isMember && !isOwner && (
              <button
                onClick={() => removeMember(null, currentUser?.id)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#E07070', fontSize: '12px', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", padding: 0 }}
              >
                Leave board
              </button>
            )}
          </div>
        )}

        {board.description && (
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.6', marginTop: '10px' }}>
            {board.description}
          </p>
        )}
      </div>

      <div style={{ padding: '20px 20px 0' }}>
        {designs.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginBottom: '8px' }}>No designs yet.</p>
            <Link href="/feed" style={{ color: 'var(--accent)', fontSize: '14px', textDecoration: 'none', fontWeight: '500' }}>
              Browse designs →
            </Link>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            {designs.map(d => (
              <Link key={d.id} href={`/design/${d.id}?from=${encodeURIComponent(`/moodboards/${id}`)}`} style={{
                background: 'var(--bg-card)', borderRadius: '12px',
                border: '0.5px solid var(--border)', overflow: 'hidden',
                textDecoration: 'none', display: 'block',
              }}>
                <div style={{ width: '100%', aspectRatio: '1 / 1', overflow: 'hidden', background: 'var(--bg-chip)' }}>
                  {d.image_url && (
                    <img src={d.image_url} alt={d.title}
                      loading="lazy" decoding="async"
                      style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }} />
                  )}
                </div>
                <div style={{ padding: '8px 10px 10px' }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '12px', fontWeight: '500', lineHeight: '1.3', margin: '0 0 3px' }}>
                    {d.title}
                  </p>
                  {(d.shape || d.category) && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>
                      {[d.shape, d.category].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
