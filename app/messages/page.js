'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { LaqueWordmark } from '@/components/ui/icons'

// ── List palette from frame 242:1994 ───────────────────────────────────────
const PANEL = 'rgba(255, 255, 255, 0.06)'
const PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.1)'
const WHITE80 = 'rgba(255, 255, 255, 0.8)'
const WHITE60 = 'rgba(255, 255, 255, 0.6)'
const WHITE50 = 'rgba(255, 255, 255, 0.5)'
const ACCENT = '#FF517F'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.3,
})

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (d >= 1) return `${d}d`
  if (h >= 1) return `${h}h`
  if (m >= 1) return `${m}m`
  return 'now'
}

function previewOf(content) {
  if (content?.startsWith('{"__type":"design"')) return '✦ Design'
  if (content?.startsWith('{"__type":"photo"')) return '📷 Photo'
  return content
}

function MessagesInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentUser, setCurrentUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [tab, setTab] = useState('all') // 'all' | 'unread'

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/profile'); return }
      setCurrentUser(user)

      // Deep link from a booking/appointment: find or create a conversation with ?with=<id>
      const withId = searchParams.get('with')
      if (withId && withId !== user.id) {
        const { data: prof } = await supabase.from('profiles').select('account_type').eq('id', user.id).single()
        const iAmCreator = prof?.account_type === 'creator' || prof?.account_type === 'salon'
        const clientId  = iAmCreator ? withId : user.id
        const creatorId = iAmCreator ? user.id : withId

        const { data: existing } = await supabase
          .from('conversations')
          .select('id')
          .eq('client_id', clientId)
          .eq('creator_id', creatorId)
          .maybeSingle()

        let conversationId = existing?.id
        if (!conversationId) {
          const { data: created, error: createError } = await supabase
            .from('conversations')
            .insert({ client_id: clientId, creator_id: creatorId })
            .select('id')
            .single()
          if (createError) console.error('conversation create error:', createError)
          conversationId = created?.id
        }

        if (conversationId) { router.replace(`/messages/${conversationId}`); return }
      }

      await loadConversations(user.id)
      setLoading(false)
    }
    init()
  }, [])

  const loadConversations = async (userId) => {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`client_id.eq.${userId},creator_id.eq.${userId}`)
      .order('last_message_at', { ascending: false })
      .limit(100)
    if (error) console.error('conversations fetch failed:', error)

    if (!data || data.length === 0) { setConversations([]); return }

    // Fetch the other participant's profile for each conversation
    const otherIds = data.map(c => c.client_id === userId ? c.creator_id : c.client_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, account_type')
      .in('id', otherIds)

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

    // Last message + unread count for ALL conversations in 2 batched
    // queries instead of 2 per conversation (matches the pattern already
    // used correctly in BottomNav.js for its own unread badge).
    const convIds = data.map(c => c.id)
    const [{ data: recentMsgs, error: recentError }, { data: unreadRows, error: unreadError }] = await Promise.all([
      supabase.from('messages').select('conversation_id, content, created_at, sender_id').in('conversation_id', convIds).order('created_at', { ascending: false }).limit(500),
      supabase.from('messages').select('conversation_id').in('conversation_id', convIds).eq('is_read', false).neq('sender_id', userId),
    ])
    if (recentError) console.error('recent messages fetch failed:', recentError)
    if (unreadError) console.error('unread counts fetch failed:', unreadError)

    const lastMsgMap = {}
    ;(recentMsgs || []).forEach(m => { if (!lastMsgMap[m.conversation_id]) lastMsgMap[m.conversation_id] = m })
    const unreadMap = {}
    ;(unreadRows || []).forEach(m => { unreadMap[m.conversation_id] = (unreadMap[m.conversation_id] || 0) + 1 })

    const enriched = data.map(c => {
      const otherId = c.client_id === userId ? c.creator_id : c.client_id
      return { ...c, other: profileMap[otherId], lastMsg: lastMsgMap[c.id] || null, unread: unreadMap[c.id] || 0 }
    })

    setConversations(enriched)
  }

  const shell = (children) => (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      <div aria-hidden className="lq-bg-wine" style={{ position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', zIndex: 0 }}>
        <div className="lq-grain" />
      </div>
      <div style={{ position: 'relative', zIndex: 1, padding: 'calc(env(safe-area-inset-top) + 12px) 24px calc(env(safe-area-inset-bottom) + 120px)', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {children}
      </div>
    </div>
  )

  if (loading) return shell(
    <p style={{ ...ui(300, 14, WHITE60), textAlign: 'center', padding: '48px 0' }}>Loading…</p>
  )

  const q = query.trim().toLowerCase()
  const filtered = conversations
    .filter(c => tab === 'all' || c.unread > 0)
    .filter(c => !q
      || (c.other?.display_name || '').toLowerCase().includes(q)
      || (c.other?.username || '').toLowerCase().includes(q)
      || (previewOf(c.lastMsg?.content) || '').toLowerCase().includes(q))

  return shell(
    <>
      {/* ── Header row ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/feed" aria-label="Back"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px', padding: '8px', display: 'flex', color: 'var(--lq-white)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <div>
            <span style={{ color: 'var(--lq-white)', display: 'flex' }}><LaqueWordmark height={24} /></span>
            <p style={{ ...ui(300, 12, WHITE80), margin: '4px 0 0' }}>Conversations</p>
          </div>
        </div>
        <Link href="/messages/new" aria-label="New message"
          style={{ width: '44px', height: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center', textDecoration: 'none', ...ui(500, 20) }}>
          +
        </Link>
      </div>

      {/* ── Title ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <h1 style={{ ...ui(500, 28), margin: 0 }}>Messages</h1>
        <p style={{ ...ui(300, 14, WHITE50), margin: 0 }}>Your conversations with artists and clients</p>
      </div>

      {/* ── Search ── */}
      <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px', display: 'flex', gap: '8px', alignItems: 'center', padding: '12px 16px' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={WHITE80} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search conversations"
          aria-label="Search conversations"
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--lq-white)', fontSize: '14px', fontFamily: 'var(--lq-font-ui)' }}
        />
      </div>

      {/* ── All / Unread chips ── */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {[['all', 'All'], ['unread', 'Unread']].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} aria-pressed={tab === key}
            style={{
              background: tab === key ? ACCENT : 'rgba(255,255,255,0.1)',
              border: tab === key ? '1px solid transparent' : '1px solid rgba(255,255,255,0.2)',
              borderRadius: '100px', padding: '8px 16px', minHeight: '36px',
              ...ui(tab === key ? 500 : 300, 13, tab === key ? 'var(--lq-white)' : WHITE80),
              cursor: 'pointer',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Conversations ── */}
      {filtered.length === 0 ? (
        <div style={{ ...{ background: PANEL, border: PANEL_BORDER, borderRadius: '24px' }, textAlign: 'center', padding: '48px 24px' }}>
          <p style={{ ...ui(500, 15), margin: '0 0 8px' }}>
            {conversations.length === 0 ? 'No messages yet' : tab === 'unread' ? 'Nothing unread' : 'No matches'}
          </p>
          {conversations.length === 0 && (
            <>
              <p style={{ ...ui(300, 13, WHITE60), margin: '0 0 20px' }}>Find a nail artist or salon and start a conversation.</p>
              <Link href="/search" style={{ display: 'inline-block', background: BTN_GRADIENT, borderRadius: '24px', padding: '11px 24px', ...ui(600, 14), textDecoration: 'none' }}>
                Find an artist
              </Link>
            </>
          )}
        </div>
      ) : (
        <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '24px', padding: '8px', display: 'flex', flexDirection: 'column' }}>
          {filtered.map((c, i) => (
            <div key={c.id} style={{ display: 'contents' }}>
              {i > 0 && <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)', margin: '0 8px' }} />}
              <Link
                href={`/messages/${c.id}`}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
                  borderRadius: '16px', textDecoration: 'none',
                  background: c.unread > 0 ? 'rgba(255,255,255,0.06)' : 'transparent',
                  border: c.unread > 0 ? PANEL_BORDER : '1px solid transparent',
                }}
              >
                <div style={{ width: '44px', height: '44px', borderRadius: '22px', background: c.other?.avatar_url ? 'transparent' : 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {c.other?.avatar_url
                    ? <img src={c.other.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={ui(500, 18)}>{(c.other?.display_name || '?')[0].toUpperCase()}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <p style={{ ...ui(500, 16), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.other?.display_name || 'User'}
                    </p>
                    {(c.other?.account_type === 'creator' || c.other?.account_type === 'salon') && (
                      <span style={{ background: BTN_GRADIENT, border: '1px solid rgba(255,81,127,0.25)', borderRadius: '4px', padding: '2px 6px', ...ui(500, 10), letterSpacing: '0.02em', flexShrink: 0 }}>
                        {c.other.account_type === 'salon' ? 'SALON' : 'NAIL ARTIST'}
                      </span>
                    )}
                  </div>
                  <p style={{ ...ui(300, 14, WHITE80), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.lastMsg
                      ? (c.lastMsg.sender_id === currentUser?.id ? `You: ${previewOf(c.lastMsg.content)}` : previewOf(c.lastMsg.content))
                      : 'No messages yet'}
                  </p>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', flexShrink: 0 }}>
                  {c.lastMsg && <span style={ui(300, 13, WHITE60)}>{timeAgo(c.lastMsg.created_at)}</span>}
                  {c.unread > 0 && <span aria-label={`${c.unread} unread`} style={{ width: '8px', height: '8px', borderRadius: '4px', background: ACCENT }} />}
                </div>
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: '#260D14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={ui(300, 14, WHITE60)}>Loading…</p>
      </div>
    }>
      <MessagesInner />
    </Suspense>
  )
}
