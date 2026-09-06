'use client'

// Board detail, restyled to tokens (extrapolated — no frame). Collaborative
// wiring (privacy guard, invite-by-username, remove/leave) byte-identical;
// adds owner-only board delete with confirm, and the public/private toggle
// relocated from the old /moodboards index (which now redirects to /saved).

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import ShareButton from '@/components/ShareButton'
import Sheet from '@/components/ui/Sheet'

const PANEL = 'rgba(255, 255, 255, 0.06)'
const PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.1)'
const WHITE60 = 'rgba(255, 255, 255, 0.6)'
const ACCENT = '#FF517F'
const DANGER = '#FF8DA8'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.3,
})
const display = (size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color,
})

function Shell({ children }) {
  return (
    <div className="lq-bg-wine" style={{ minHeight: '100dvh', position: 'relative' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(26,5,13,0.6)' }} />
      <div className="lq-grain" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />
      <div style={{ position: 'relative' }}>{children}</div>
    </div>
  )
}

const Avatar = ({ profile, size = 32, ring = false }) => (
  <div style={{
    width: `${size}px`, height: `${size}px`, borderRadius: '50%',
    background: 'rgba(255,255,255,0.15)', overflow: 'hidden', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    border: ring ? '1.5px solid #260D14' : PANEL_BORDER,
  }}>
    {profile?.avatar_url
      ? <img src={profile.avatar_url} alt="" loading="lazy" decoding="async" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : <span style={ui(400, Math.round(size * 0.4))}>{(profile?.display_name || '?')[0].toUpperCase()}</span>
    }
  </div>
)

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

  // Members / manage state
  const [members, setMembers] = useState([])
  const [manageOpen, setManageOpen] = useState(false)
  const [searchUsername, setSearchUsername] = useState('')
  const [searchResult, setSearchResult] = useState(null)
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState('')
  const [addingMember, setAddingMember] = useState(false)
  const searchTimeout = useRef(null)

  // Delete / privacy state
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const [togglingPrivacy, setTogglingPrivacy] = useState(false)

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
      window.location.href = '/saved'
    }
  }

  // Public/private toggle — relocated from the old /moodboards index (same update)
  const togglePrivacy = async () => {
    if (!isOwner || togglingPrivacy) return
    setTogglingPrivacy(true)
    const newVal = !board.is_public
    const { error } = await supabase.from('moodboards').update({ is_public: newVal }).eq('id', id)
    if (!error) setBoard(prev => ({ ...prev, is_public: newVal }))
    setTogglingPrivacy(false)
  }

  // Owner-only board delete with confirm. Child rows first so a missing FK
  // cascade can't leave orphans, board row last (scoped to the owner).
  const deleteBoard = async () => {
    if (!isOwner || deleting) return
    setDeleting(true)
    setDeleteError('')
    await supabase.from('moodboard_designs').delete().eq('moodboard_id', id)
    await supabase.from('moodboard_members').delete().eq('moodboard_id', id)
    const { error } = await supabase.from('moodboards').delete().eq('id', id).eq('user_id', currentUser.id)
    if (error) {
      setDeleteError('Failed to delete board. Please try again.')
      setDeleting(false)
      return
    }
    window.location.href = '/saved'
  }

  const input = {
    width: '100%', boxSizing: 'border-box',
    background: PANEL, border: PANEL_BORDER, borderRadius: '14px',
    padding: '13px 16px', ...ui(400, 15), outline: 'none',
  }

  if (loading) return (
    <Shell>
      <div style={{ minHeight: '70vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={ui(300, 14, WHITE60)}>Loading…</p>
      </div>
    </Shell>
  )

  if (isPrivate) return (
    <Shell>
      <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={WHITE60} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '14px' }}>
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <p style={{ ...ui(600, 15), margin: '0 0 6px' }}>This board is private</p>
        <p style={{ ...ui(300, 13, WHITE60), margin: '0 0 24px' }}>Only the owner and collaborators can view it.</p>
        <Link href="/feed" style={{ background: BTN_GRADIENT, borderRadius: '1000px', padding: '13px 28px', ...ui(500, 14), textDecoration: 'none' }}>
          Browse designs
        </Link>
      </div>
    </Shell>
  )

  if (notFound || !board) return (
    <Shell>
      <div style={{ minHeight: '70vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px', textAlign: 'center' }}>
        <p style={{ ...ui(400, 15), margin: '0 0 20px' }}>Board not found.</p>
        <Link href="/saved" style={{ ...ui(500, 14, ACCENT), textDecoration: 'none' }}>← Back to Saved</Link>
      </div>
    </Shell>
  )

  return (
    <Shell>
      <div style={{ padding: 'calc(env(safe-area-inset-top) + 16px) 24px calc(env(safe-area-inset-bottom) + 120px)' }}>

        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <Link href="/saved" aria-label="Back to Saved" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            ...ui(400, 13, WHITE60), textDecoration: 'none', padding: '10px 10px 10px 0', minHeight: '44px',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Saved
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {board.is_public && <ShareButton title={board.name} />}
            {isOwner && (
              <button
                onClick={() => { setManageOpen(true); setConfirmDelete(false); setDeleteError(''); setSearchError('') }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  background: PANEL, border: PANEL_BORDER, borderRadius: '1000px',
                  padding: '9px 16px', minHeight: '38px', ...ui(500, 12), cursor: 'pointer',
                }}
              >
                Manage
                {members.length > 0 && (
                  <span style={{ background: ACCENT, borderRadius: '10px', padding: '1px 7px', ...ui(600, 10) }}>
                    {members.length}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Title + meta */}
        <h1 style={{ ...display(26), margin: '0 0 8px' }}>{board.name}</h1>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={ui(300, 13, WHITE60)}>{designs.length} design{designs.length !== 1 ? 's' : ''}</span>
          {creatorName && <span style={ui(300, 13, WHITE60)}>· by {creatorName}</span>}
          {board.is_public && (
            <span style={{
              background: 'rgba(255,81,127,0.15)', color: ACCENT,
              ...ui(500, 10), letterSpacing: '0.06em', textTransform: 'uppercase',
              padding: '3px 9px', borderRadius: '1000px',
            }}>Public</span>
          )}
        </div>

        {/* Collaborator avatars */}
        {members.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
            <div style={{ display: 'flex' }}>
              {members.slice(0, 5).map((m, i) => (
                <div key={m.user_id} style={{ marginLeft: i > 0 ? '-8px' : 0 }}>
                  <Avatar profile={m.profile} size={24} ring />
                </div>
              ))}
            </div>
            <span style={ui(300, 12, WHITE60)}>
              {members.length} collaborator{members.length !== 1 ? 's' : ''}
            </span>
            {isMember && !isOwner && (
              <button
                onClick={() => removeMember(null, currentUser?.id)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', ...ui(400, 12, DANGER), cursor: 'pointer', padding: '10px 0', minHeight: '44px' }}
              >
                Leave board
              </button>
            )}
          </div>
        )}

        {board.description && (
          <p style={{ ...ui(300, 14, 'rgba(255,255,255,0.8)'), lineHeight: 1.6, marginTop: '12px' }}>{board.description}</p>
        )}

        {/* Designs */}
        <div style={{ marginTop: '24px' }}>
          {designs.length === 0 ? (
            <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', padding: '36px 20px', textAlign: 'center' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '10px' }}>
                <path d="M12 3l1.9 5.6 5.6 1.4-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/>
              </svg>
              <p style={{ ...ui(400, 15), marginBottom: '8px' }}>This board is empty</p>
              <p style={{ ...ui(300, 13, WHITE60), lineHeight: 1.6, marginBottom: '20px' }}>Open any design and choose Save to board to start filling it.</p>
              <Link href="/feed" style={{ display: 'inline-block', background: BTN_GRADIENT, borderRadius: '1000px', padding: '13px 28px', ...ui(500, 14), textDecoration: 'none' }}>
                Explore designs
              </Link>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', alignItems: 'start' }}>
              {designs.map(d => (
                <Link key={d.id} href={`/design/${d.id}?from=${encodeURIComponent(`/moodboards/${id}`)}`} style={{ textDecoration: 'none', display: 'block' }}>
                  <div style={{ borderRadius: '16px', overflow: 'hidden', background: PANEL, border: PANEL_BORDER }}>
                    {d.image_url
                      ? <img src={d.image_url} alt={d.title} loading="lazy" decoding="async" style={{ width: '100%', height: 'auto', display: 'block' }} />
                      : <div style={{ width: '100%', aspectRatio: '1 / 1' }} />
                    }
                  </div>
                  <p style={{ ...ui(400, 13), margin: '8px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</p>
                  {(d.shape || d.category) && (
                    <p style={{ ...ui(500, 10, WHITE60), letterSpacing: '0.06em', textTransform: 'uppercase', margin: '3px 0 0' }}>
                      {[d.shape, d.category].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manage sheet — owner only: invite, collaborators, privacy, delete */}
      {manageOpen && isOwner && (
        <Sheet onClose={() => setManageOpen(false)} title="Manage board">
          <div style={{ padding: '8px 20px calc(env(safe-area-inset-bottom) + 24px)' }}>
            <h2 style={{ ...display(22), margin: '0 0 16px' }}>Manage board</h2>

            {/* Invite */}
            <p style={{ ...ui(500, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>Invite collaborator</p>
            <input
              value={searchUsername}
              onChange={e => handleUsernameChange(e.target.value)}
              placeholder="@username"
              aria-label="Username to invite"
              style={{ ...input, marginBottom: '10px' }}
            />
            {searchLoading && <p style={{ ...ui(300, 13, WHITE60), margin: '0 0 10px' }}>Searching…</p>}
            {searchError && <p style={{ ...ui(300, 13, DANGER), margin: '0 0 10px' }}>{searchError}</p>}
            {searchResult && (
              <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '14px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <Avatar profile={searchResult} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ ...ui(500, 14), margin: '0 0 2px' }}>{searchResult.display_name}</p>
                  <p style={{ ...ui(300, 12, WHITE60), margin: 0 }}>@{searchResult.username}</p>
                </div>
                <button
                  onClick={addMember}
                  disabled={addingMember}
                  style={{ background: BTN_GRADIENT, border: 'none', borderRadius: '1000px', padding: '10px 18px', ...ui(500, 13), cursor: 'pointer', opacity: addingMember ? 0.7 : 1 }}
                >
                  {addingMember ? 'Adding…' : 'Give access'}
                </button>
              </div>
            )}

            {/* Collaborators */}
            {members.length > 0 && (
              <div style={{ marginTop: '8px' }}>
                <p style={{ ...ui(500, 11, ACCENT), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 6px' }}>Collaborators</p>
                {members.map(m => (
                  <div key={m.user_id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <Avatar profile={m.profile} size={32} />
                    <p style={{ ...ui(400, 13), margin: 0, flex: 1, minWidth: 0 }}>{m.profile?.display_name || m.profile?.username}</p>
                    <button
                      onClick={() => removeMember(m.id, m.user_id)}
                      style={{ background: 'none', border: 'none', ...ui(400, 12, DANGER), cursor: 'pointer', padding: '10px', minHeight: '44px' }}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Privacy */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 0 6px', marginTop: '8px' }}>
              <div>
                <p style={{ ...ui(400, 14), margin: '0 0 2px' }}>Public board</p>
                <p style={{ ...ui(300, 12, WHITE60), margin: 0 }}>{board.is_public ? 'Anyone with the link can view' : 'Only you and collaborators can view'}</p>
              </div>
              <button
                onClick={togglePrivacy}
                disabled={togglingPrivacy}
                role="switch"
                aria-checked={board.is_public}
                aria-label="Public board"
                style={{
                  width: '48px', height: '28px', borderRadius: '1000px', border: 'none', cursor: 'pointer',
                  background: board.is_public ? ACCENT : 'rgba(255,255,255,0.15)',
                  position: 'relative', transition: 'background 0.15s', flexShrink: 0,
                  opacity: togglingPrivacy ? 0.6 : 1,
                }}
              >
                <span style={{
                  position: 'absolute', top: '3px', left: board.is_public ? '23px' : '3px',
                  width: '22px', height: '22px', borderRadius: '50%', background: '#fff',
                  transition: 'left 0.15s',
                }} />
              </button>
            </div>

            {/* Delete — confirm step */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: '14px', paddingTop: '14px' }}>
              {!confirmDelete ? (
                <button
                  onClick={() => setConfirmDelete(true)}
                  style={{ background: 'none', border: 'none', ...ui(500, 14, DANGER), cursor: 'pointer', padding: '10px 0', minHeight: '44px' }}
                >
                  Delete board
                </button>
              ) : (
                <div>
                  <p style={{ ...ui(400, 14), margin: '0 0 4px' }}>Delete &ldquo;{board.name}&rdquo;?</p>
                  <p style={{ ...ui(300, 12, WHITE60), margin: '0 0 14px' }}>
                    The board and its collaborator access are removed for everyone. Saved designs themselves aren&apos;t deleted. This can&apos;t be undone.
                  </p>
                  {deleteError && <p style={{ ...ui(300, 13, DANGER), margin: '0 0 10px' }}>{deleteError}</p>}
                  <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                      onClick={() => setConfirmDelete(false)}
                      style={{ flex: 1, height: '48px', background: PANEL, border: PANEL_BORDER, borderRadius: '1000px', ...ui(500, 14), cursor: 'pointer' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={deleteBoard}
                      disabled={deleting}
                      style={{ flex: 1, height: '48px', background: 'rgba(255,81,127,0.18)', border: `1px solid ${DANGER}`, borderRadius: '1000px', ...ui(500, 14, DANGER), cursor: 'pointer', opacity: deleting ? 0.7 : 1 }}
                    >
                      {deleting ? 'Deleting…' : 'Delete board'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </Sheet>
      )}
    </Shell>
  )
}
