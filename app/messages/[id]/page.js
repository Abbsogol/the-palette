'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Sheet from '@/components/ui/Sheet'

// ── Chat palette from frames 242:2385 / 249:2208 / 249:2052 ────────────────
const PANEL = 'rgba(255, 255, 255, 0.06)'
const PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.1)'
const WHITE80 = 'rgba(255, 255, 255, 0.8)'
const WHITE60 = 'rgba(255, 255, 255, 0.6)'
const WHITE40 = 'rgba(255, 255, 255, 0.4)'
const WHITE30 = 'rgba(255, 255, 255, 0.3)'
const ACCENT = '#FF517F'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.35,
})

// Rich-card payloads ride in messages.content as JSON. `design` is the
// pre-existing live convention (SendDesignSheet); `photo` is new (chat-photo
// uploads). Salon/location cards: no send flow exists — skipped, gap-logged.
function parsePayload(content) {
  if (content?.startsWith('{"__type":')) {
    try { return JSON.parse(content) } catch { return null }
  }
  return null
}

function dayLabel(iso) {
  const d = new Date(iso)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const that = new Date(d); that.setHours(0, 0, 0, 0)
  const diff = Math.round((today - that) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const fmtTime = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function ChatPage() {
  const { id } = useParams()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [conv, setConv] = useState(null)
  const [other, setOther] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [loading, setLoading] = useState(true)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

  // New (approved) features
  const [peerOnline, setPeerOnline] = useState(false)
  const [upcomingBooking, setUpcomingBooking] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [mediaOpen, setMediaOpen] = useState(false)
  const [searchMode, setSearchMode] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [isFavourite, setIsFavourite] = useState(false)
  const [iBlocked, setIBlocked] = useState(false)
  const [muteAvailable, setMuteAvailable] = useState(false)
  const [muted, setMuted] = useState(false)
  const [uploadingPhoto, setUploadingPhoto] = useState(false)

  // Keyboard handling
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setKeyboardOffset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop))
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => { vv.removeEventListener('resize', update); vv.removeEventListener('scroll', update) }
  }, [])

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/profile'); return }
      setCurrentUser(user)

      // Load conversation + other participant
      const { data: convRow, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .single()
      if (convError) console.error('conversation fetch failed:', convError)

      if (!convRow) { router.push('/messages'); return }
      setConv(convRow)
      // muted_by ships before its column may exist — feature-detect from the
      // row shape so the Mute row never renders as a control that errors.
      const hasMute = Object.hasOwn(convRow, 'muted_by')
      setMuteAvailable(hasMute)
      if (hasMute) setMuted((convRow.muted_by || []).includes(user.id))

      const otherId = convRow.client_id === user.id ? convRow.creator_id : convRow.client_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, account_type, location')
        .eq('id', otherId)
        .single()

      setOther(profile)

      // Load the most recent messages — ordered newest-first so .limit()
      // keeps the latest N, then reversed back to chronological for display.
      const { data: msgs, error: msgsError } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: false })
        .limit(200)
      if (msgsError) console.error('messages fetch failed:', msgsError)

      setMessages((msgs || []).slice().reverse())

      // Mark unread as read
      const { error: markReadError } = await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', id)
        .neq('sender_id', user.id)
        .eq('is_read', false)
      if (markReadError) console.error('mark-read error:', markReadError)

      // Real upcoming booking between the pair → pinned banner + sheet CTA
      const today = new Date().toISOString().split('T')[0]
      const { data: bookings } = await supabase
        .from('bookings')
        .select('id, booking_date, start_time, status, service:services(name)')
        .eq('client_id', convRow.client_id)
        .eq('creator_id', convRow.creator_id)
        .in('status', ['pending', 'confirmed'])
        .gte('booking_date', today)
        .order('booking_date', { ascending: true })
        .order('start_time', { ascending: true })
        .limit(1)
      setUpcomingBooking(bookings?.[0] || null)

      // Favourite + block state for the sheet rows
      const [{ data: fav }, { data: blockRow }] = await Promise.all([
        supabase.from('favourite_creators').select('creator_id').eq('user_id', user.id).eq('creator_id', otherId).maybeSingle(),
        supabase.from('blocks').select('id').eq('blocker_id', user.id).eq('blocked_id', otherId).maybeSingle(),
      ])
      setIsFavourite(!!fav)
      setIBlocked(!!blockRow)

      setLoading(false)
    }
    init()
  }, [id])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${id}`,
      }, (payload) => {
        setMessages(prev => {
          if (prev.find(m => m.id === payload.new.id)) return prev
          return [...prev, payload.new]
        })
        // Mark as read if it's from the other person
        if (payload.new.sender_id !== currentUser?.id) {
          supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id)
            .then(({ error }) => { if (error) console.error('mark-read error:', error) })
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [id, currentUser])

  // Honest presence: the shared online-users channel (tracked app-wide from
  // BottomNav). "Active now" renders only while the peer is actually
  // present; otherwise the line simply doesn't exist. No last_seen writes.
  useEffect(() => {
    if (!currentUser || !other?.id) return
    const channel = supabase.channel('online-users', { config: { presence: { key: currentUser.id } } })
    const sync = () => setPeerOnline(!!channel.presenceState()[other.id])
    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') await channel.track({ at: Date.now() })
      })
    return () => supabase.removeChannel(channel)
  }, [currentUser, other])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Shared post-send bookkeeping — identical statements to the original
  // handleSend path (last_message_at bump + notification, now mute-aware).
  const afterSend = async () => {
    const { error: convError } = await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', id)
    if (convError) console.error('conversation update error:', convError)

    // Notify the other person — unless they muted this conversation
    const otherMuted = muteAvailable && (conv?.muted_by || []).includes(other?.id)
    if (!otherMuted) {
      const { error: notifError } = await supabase.from('notifications').insert({
        user_id: other?.id,
        actor_id: currentUser.id,
        type: 'new_message',
      })
      if (notifError) console.error('notification error:', notifError)
    }
  }

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setSendError('')
    setInput('')

    const { error } = await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: currentUser.id,
      content: text,
    })

    if (error) {
      setInput(text)
      setSendError(
        error.message?.includes('BLOCKED_CANNOT_MESSAGE')
          ? "You can't message this person."
          : error.message?.includes('MESSAGE_PERMISSION_DENIED')
          ? "This person isn't accepting messages right now."
          : 'Message failed to send. Please try again.'
      )
      setSending(false)
      return
    }

    await afterSend()
    setSending(false)
  }

  const handleSendPhoto = async (e) => {
    const file = e.target.files[0]
    e.target.value = ''
    if (!file || uploadingPhoto) return
    setUploadingPhoto(true)
    setSendError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('purpose', 'chat-photo')
      const res = await fetch('/api/upload-image', {
        method: 'POST',
        headers: session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {},
        body: fd,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || json.error) throw new Error(json.error || 'Upload failed')

      const { error } = await supabase.from('messages').insert({
        conversation_id: id,
        sender_id: currentUser.id,
        content: JSON.stringify({ __type: 'photo', url: json.publicUrl }),
      })
      if (error) throw new Error(
        error.message?.includes('BLOCKED_CANNOT_MESSAGE') ? "You can't message this person."
        : error.message?.includes('MESSAGE_PERMISSION_DENIED') ? "This person isn't accepting messages right now."
        : 'Photo failed to send. Please try again.'
      )
      await afterSend()
    } catch (err) {
      setSendError(err.message)
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const toggleFavourite = async () => {
    if (!other) return
    if (isFavourite) {
      const { error } = await supabase.from('favourite_creators').delete().eq('user_id', currentUser.id).eq('creator_id', other.id)
      if (error) { alert('Failed to update favourites.'); return }
      setIsFavourite(false)
    } else {
      const { error } = await supabase.from('favourite_creators').insert({ user_id: currentUser.id, creator_id: other.id })
      if (error) { alert('Failed to update favourites.'); return }
      setIsFavourite(true)
    }
  }

  const toggleBlock = async () => {
    if (!other) return
    if (iBlocked) {
      const { error } = await supabase.from('blocks').delete().eq('blocker_id', currentUser.id).eq('blocked_id', other.id)
      if (error) { alert('Failed to unblock. Please try again.'); return }
      setIBlocked(false)
    } else {
      if (!confirm(`Block ${other.display_name || 'this person'}? They won't be able to message you.`)) return
      const { error } = await supabase.from('blocks').insert({ blocker_id: currentUser.id, blocked_id: other.id })
      if (error) { alert('Failed to block. Please try again.'); return }
      setIBlocked(true)
    }
  }

  const toggleMute = async () => {
    if (!muteAvailable || !conv) return
    const current = conv.muted_by || []
    const next = muted ? current.filter(uid => uid !== currentUser.id) : [...current, currentUser.id]
    const { error } = await supabase.from('conversations').update({ muted_by: next }).eq('id', id)
    if (error) { alert('Failed to update mute.'); return }
    setConv(prev => ({ ...prev, muted_by: next }))
    setMuted(!muted)
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: '#260D14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={ui(300, 14, WHITE60)}>Loading…</p>
    </div>
  )

  const otherIsCreator = other?.account_type === 'creator' || other?.account_type === 'salon'
  const iAmClient = conv?.client_id === currentUser?.id
  const daysUntil = upcomingBooking ? Math.round((new Date(upcomingBooking.booking_date + 'T00:00:00') - new Date(new Date().toDateString())) / 86400000) : null
  const mediaMessages = messages.filter(m => { const p = parsePayload(m.content); return p && (p.__type === 'design' || p.__type === 'photo') })
  const visibleMessages = searchMode && searchText.trim()
    ? messages.filter(m => !parsePayload(m.content) && m.content?.toLowerCase().includes(searchText.trim().toLowerCase()))
    : messages
  const fmt12 = (t) => {
    if (!t) return ''
    const [h, m] = t.slice(0, 5).split(':').map(Number)
    const ampm = h < 12 ? 'am' : 'pm'
    const h12 = h % 12 === 0 ? 12 : h % 12
    return `${h12}${m > 0 ? `:${String(m).padStart(2, '0')}` : ''}${ampm}`
  }

  const sheetRow = (label, icon, onClick, { href = null, danger = false, trailing = null } = {}) => {
    const style = { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 4px', width: '100%', background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)', cursor: 'pointer', textDecoration: 'none', textAlign: 'left', fontFamily: 'inherit' }
    const body = (
      <>
        <span style={{ color: danger ? '#E07070' : WHITE60, display: 'flex', width: '20px', justifyContent: 'center' }}>{icon}</span>
        <span style={{ ...ui(400, 15, danger ? '#E07070' : 'var(--lq-white)'), flex: 1 }}>{label}</span>
        {trailing ?? <span style={ui(400, 16, WHITE40)}>›</span>}
      </>
    )
    return href
      ? <Link key={label} href={href} style={style} onClick={() => setSheetOpen(false)}>{body}</Link>
      : <button key={label} onClick={onClick} style={style}>{body}</button>
  }

  return (
    <>
      {/* ── More options / Manage sheet (249:2052 / 249:2334) ── */}
      {sheetOpen && (
        <Sheet title="Conversation options" onClose={() => setSheetOpen(false)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '4px 0 16px' }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '28px', background: other?.avatar_url ? 'transparent' : BTN_GRADIENT, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {other?.avatar_url
                  ? <img src={other.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={ui(500, 20)}>{(other?.display_name || '?')[0].toUpperCase()}</span>}
              </div>
              <div>
                <p style={{ ...ui(600, 18), margin: 0 }}>{other?.display_name || other?.username || 'User'}</p>
                <p style={{ ...ui(300, 13, WHITE60), margin: '2px 0 0' }}>{other?.account_type === 'salon' ? 'Salon' : otherIsCreator ? 'Nail Artist' : 'Client'}</p>
              </div>
            </div>

            {/* State-driven CTA: Manage when a real booking exists; Book when
                I'm the client of a creator; otherwise no CTA. */}
            {upcomingBooking ? (
              <Link href={`/appointments/${upcomingBooking.id}`} onClick={() => setSheetOpen(false)}
                style={{ background: BTN_GRADIENT, borderRadius: '24px', padding: '14px', ...ui(600, 15), textAlign: 'center', textDecoration: 'none', marginBottom: '12px' }}>
                Manage appointment
              </Link>
            ) : (iAmClient && otherIsCreator) ? (
              <Link href={`/book/${other.id}`} onClick={() => setSheetOpen(false)}
                style={{ background: BTN_GRADIENT, borderRadius: '24px', padding: '14px', ...ui(600, 15), textAlign: 'center', textDecoration: 'none', marginBottom: '12px' }}>
                Book appointment
              </Link>
            ) : null}

            <p style={{ ...ui(500, 11, WHITE40), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '8px 0 2px' }}>Profile</p>
            {sheetRow('View profile', (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.5-6 8-6s8 2 8 6"/></svg>
            ), null, { href: `/creator/${other?.id}` })}
            {otherIsCreator && sheetRow('View services & portfolio', (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg>
            ), null, { href: `/creator/${other?.id}` })}
            {otherIsCreator && sheetRow(isFavourite ? 'Remove from favorites' : 'Add to favorites', (
              <svg width="16" height="16" viewBox="0 0 24 24" fill={isFavourite ? ACCENT : 'none'} stroke={isFavourite ? ACCENT : 'currentColor'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            ), toggleFavourite)}

            <p style={{ ...ui(500, 11, WHITE40), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '14px 0 2px' }}>Conversation</p>
            {sheetRow('Shared designs & photos', (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
            ), () => { setSheetOpen(false); setMediaOpen(true) })}
            {sheetRow('Search in conversation', (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            ), () => { setSheetOpen(false); setSearchMode(true) })}
            {muteAvailable && sheetRow(muted ? 'Unmute notifications' : 'Mute notifications', (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/>{muted && <line x1="3" y1="3" x2="21" y2="21"/>}</svg>
            ), toggleMute)}

            {/* Safety rows: not drawn in the frame, additive by rule — a
                redesign never removes a safety control. Report is the /help
                interim until a real report system exists (gap-logged). */}
            {sheetRow(iBlocked ? 'Unblock' : 'Block', (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><line x1="5.5" y1="5.5" x2="18.5" y2="18.5"/></svg>
            ), toggleBlock, { danger: true })}
            {sheetRow('Report', (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>
            ), null, { href: `/help?about=conversation`, danger: true })}
          </div>
        </Sheet>
      )}

      {/* ── Shared media gallery ── */}
      {mediaOpen && (
        <Sheet title="Shared designs and photos" onClose={() => setMediaOpen(false)}>
          <h2 style={{ ...ui(600, 18), margin: '0 0 14px' }}>Shared designs & photos</h2>
          {mediaMessages.length === 0 ? (
            <p style={{ ...ui(300, 14, WHITE60), padding: '24px 0', textAlign: 'center' }}>Nothing shared yet</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', paddingBottom: '16px' }}>
              {mediaMessages.map(m => {
                const p = parsePayload(m.content)
                const img = p.__type === 'design' ? p.image_url : p.url
                const href = p.__type === 'design' ? `/design/${p.id}` : p.url
                return (
                  <a key={m.id} href={href} target={p.__type === 'photo' ? '_blank' : undefined} rel="noreferrer"
                    style={{ display: 'block', borderRadius: '12px', overflow: 'hidden', background: PANEL, border: PANEL_BORDER, aspectRatio: '1/1' }}>
                    {img && <img src={img} alt={p.title || 'Shared photo'} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  </a>
                )
              })}
            </div>
          )}
        </Sheet>
      )}

      <div style={{ height: '100dvh', background: '#260D14', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {/* Backdrop */}
        <div aria-hidden className="lq-bg-wine" style={{ position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', zIndex: 0 }}>
          <div className="lq-grain" />
        </div>

        {/* ── Header: gradient blur bar (242:2402) ── */}
        <div style={{ position: 'relative', zIndex: 2, flexShrink: 0, paddingTop: 'env(safe-area-inset-top)', background: 'linear-gradient(0deg, rgba(32,5,11,0) 0%, rgba(32,5,11,0.8) 100%)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: '60px', padding: '8px 16px 8px 12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <Link href="/messages" aria-label="Back to messages" style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--lq-white)', flexShrink: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </Link>
              <Link href={`/creator/${other?.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', minWidth: 0 }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '18px', background: other?.avatar_url ? 'transparent' : BTN_GRADIENT, overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {other?.avatar_url
                    ? <img src={other.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={ui(500, 15)}>{(other?.display_name || '?')[0].toUpperCase()}</span>}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ ...ui(500, 16), lineHeight: '18px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{other?.display_name || other?.username}</p>
                  {peerOnline && <p style={{ ...ui(300, 12, WHITE40), lineHeight: '14px', margin: 0 }}>Active now</p>}
                </div>
              </Link>
            </div>
            <button onClick={() => setSheetOpen(true)} aria-label="Conversation options"
              style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: WHITE40, flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>
            </button>
          </div>

          {/* Search-in-conversation bar */}
          {searchMode && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '0 16px 10px' }}>
              <input
                autoFocus
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                placeholder="Search this conversation…"
                aria-label="Search in conversation"
                style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px', padding: '9px 16px', color: 'var(--lq-white)', fontSize: '14px', fontFamily: 'var(--lq-font-ui)', outline: 'none' }}
              />
              <button onClick={() => { setSearchMode(false); setSearchText('') }} aria-label="Close search"
                style={{ background: 'none', border: 'none', color: WHITE60, cursor: 'pointer', ...ui(400, 13), padding: '8px' }}>
                Cancel
              </button>
            </div>
          )}

          {/* ── Pinned upcoming appointment (249:2208) — real bookings only ── */}
          {upcomingBooking && !searchMode && (
            <Link href={`/appointments/${upcomingBooking.id}`} style={{ display: 'block', margin: '0 0 0', padding: '12px 16px', background: 'rgba(102,0,7,0.35)', borderLeft: `3px solid ${ACCENT}`, textDecoration: 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                <span style={{ ...ui(600, 10, WHITE60), letterSpacing: '0.08em' }}>UPCOMING APPOINTMENT</span>
                <span style={{ ...ui(500, 11, upcomingBooking.status === 'confirmed' ? '#10B981' : '#FFB84C') }}>
                  {upcomingBooking.status === 'confirmed' ? '✓ Confirmed' : 'Pending'}
                </span>
              </div>
              <p style={{ ...ui(500, 14), margin: '0 0 3px' }}>{upcomingBooking.service?.name || 'Appointment'}</p>
              <p style={{ ...ui(400, 12, '#E9C46A'), margin: '0 0 2px' }}>
                🗓 {new Date(upcomingBooking.booking_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}{upcomingBooking.start_time ? ` · ${fmt12(upcomingBooking.start_time)}` : ''}
              </p>
              {other?.location && <p style={{ ...ui(300, 12, '#E9C46A'), margin: 0 }}>📍 {other.display_name}, {other.location}</p>}
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={ui(400, 12, ACCENT)}>{daysUntil === 0 ? 'Today' : daysUntil === 1 ? 'Tomorrow' : `In ${daysUntil} days`}</span>
                <span style={ui(500, 12, ACCENT)}>View appointment ›</span>
              </div>
            </Link>
          )}
        </div>

        {/* ── Messages ── */}
        <div style={{ position: 'relative', zIndex: 1, flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: `16px 16px calc(120px + env(safe-area-inset-bottom) + ${keyboardOffset}px)`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {visibleMessages.length === 0 && (
            <div style={{ textAlign: 'center', margin: 'auto', padding: '40px 0' }}>
              <p style={ui(300, 13, WHITE60)}>
                {searchMode && searchText.trim() ? 'No matches' : <>Say hi to {other?.display_name} ✦</>}
              </p>
            </div>
          )}
          {visibleMessages.map((msg, i) => {
            const isMe = msg.sender_id === currentUser?.id
            const prevMsg = visibleMessages[i - 1]
            const nextMsg = visibleMessages[i + 1]
            const newDay = !prevMsg || dayLabel(prevMsg.created_at) !== dayLabel(msg.created_at)
            // Meta renders at group ends: last message of a sender-run, or a
            // >5min gap — same rhythm the frame draws.
            const groupEnd = !nextMsg || nextMsg.sender_id !== msg.sender_id || (new Date(nextMsg.created_at) - new Date(msg.created_at)) > 5 * 60 * 1000
            const payload = parsePayload(msg.content)

            return (
              <div key={msg.id}>
                {newDay && (
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0' }}>
                    <span style={{ background: PANEL, padding: '4px 12px', borderRadius: '100px', ...ui(300, 11, WHITE40) }}>{dayLabel(msg.created_at)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMe ? 'flex-end' : 'flex-start', gap: '4px' }}>
                  {payload?.__type === 'design' ? (
                    /* Design card (242:2448) — the pre-existing live payload */
                    <a href={`/design/${payload.id}`}
                      style={{ width: '240px', background: PANEL, border: PANEL_BORDER, borderRadius: '12px', overflow: 'hidden', textDecoration: 'none', display: 'block' }}>
                      {payload.image_url && (
                        <img src={payload.image_url} alt={payload.title} style={{ width: '100%', height: '180px', objectFit: 'cover', display: 'block' }} />
                      )}
                      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <p style={{ ...ui(500, 14), margin: 0 }}>{payload.title}</p>
                        {(payload.shape || payload.length_ || payload.meta) && (
                          <p style={{ ...ui(300, 11, WHITE40), margin: 0, textTransform: 'uppercase' }}>{payload.meta || [payload.shape, payload.length_].filter(Boolean).join(' · ')}</p>
                        )}
                        <p style={{ ...ui(500, 10, ACCENT), margin: '2px 0 0' }}>✦ Laque Design</p>
                      </div>
                    </a>
                  ) : payload?.__type === 'photo' ? (
                    /* Photo message (242:2467) */
                    <a href={payload.url} target="_blank" rel="noreferrer" style={{ display: 'block', borderRadius: '12px', overflow: 'hidden', maxWidth: '200px' }}>
                      <img src={payload.url} alt="Shared photo" style={{ width: '200px', height: 'auto', display: 'block', borderRadius: '12px' }} />
                    </a>
                  ) : (
                    /* Text bubble */
                    <div style={{
                      maxWidth: '260px',
                      background: isMe ? BTN_GRADIENT : 'rgba(255,255,255,0.08)',
                      border: isMe ? 'none' : PANEL_BORDER,
                      borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                      padding: '10px 14px',
                      ...ui(400, 15, isMe ? 'var(--lq-white)' : WHITE80),
                      lineHeight: '20px',
                      wordBreak: 'break-word',
                    }}>
                      {msg.content}
                    </div>
                  )}
                  {groupEnd && (
                    <p style={{ ...ui(300, 11, WHITE30), lineHeight: '14px', margin: 0 }}>
                      {fmtTime(msg.created_at)}{isMe ? ` · ${msg.is_read ? 'Read' : 'Delivered'}` : ''}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        {/* ── Composer — fixed footer, replaces the nav (242:2476) ── */}
        <div style={{
          position: 'fixed', bottom: keyboardOffset, left: '50%', transform: 'translateX(-50%)',
          width: '100%', maxWidth: '480px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          background: 'rgba(32,5,11,0.85)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
          padding: '12px 24px',
          paddingBottom: keyboardOffset > 0 ? '12px' : 'max(12px, env(safe-area-inset-bottom))',
          transition: 'bottom 0.2s ease', zIndex: 110,
        }}>
          {sendError && (
            <p style={{ ...ui(400, 12, '#E07070'), margin: '0 0 8px', textAlign: 'center' }}>{sendError}</p>
          )}
          <div style={{ background: 'linear-gradient(90deg, rgba(92,34,48,0.2) 0%, rgba(209,94,122,0.2) 100%)', borderRadius: '1000px', display: 'flex', gap: '12px', alignItems: 'center', padding: '8px 16px 8px 8px', minHeight: '68px', boxSizing: 'border-box' }}>
            {/* "+" attach — real: sends a photo through the upload pipeline */}
            <label aria-label="Send a photo" style={{ width: '44px', height: '44px', borderRadius: '100px', border: '1px solid rgba(255,255,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: uploadingPhoto ? 'wait' : 'pointer', color: WHITE40, flexShrink: 0 }}>
              <input type="file" accept="image/*" onChange={handleSendPhoto} disabled={uploadingPhoto} style={{ display: 'none' }} />
              {uploadingPhoto
                ? <span style={ui(300, 11, WHITE60)}>…</span>
                : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
            </label>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Write a message…"
              aria-label="Message"
              rows={1}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '100px', padding: '10px 16px',
                color: 'var(--lq-white)', fontSize: '14px',
                fontFamily: 'var(--lq-font-ui)', outline: 'none',
                resize: 'none', maxHeight: '100px', overflowY: 'auto',
                lineHeight: '1.4', boxSizing: 'border-box',
              }}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || sending}
              aria-label="Send message"
              style={{
                width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0,
                background: input.trim() ? BTN_GRADIENT : 'none',
                border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s', color: input.trim() ? 'var(--lq-white)' : WHITE40,
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
