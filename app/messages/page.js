'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

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

function MessagesInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [currentUser, setCurrentUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)

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
          .single()

        const conversationId = existing?.id || (await supabase
          .from('conversations')
          .insert({ client_id: clientId, creator_id: creatorId })
          .select('id')
          .single()).data?.id

        if (conversationId) { router.replace(`/messages/${conversationId}`); return }
      }

      await loadConversations(user.id)
      setLoading(false)
    }
    init()
  }, [])

  const loadConversations = async (userId) => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .or(`client_id.eq.${userId},creator_id.eq.${userId}`)
      .order('last_message_at', { ascending: false })

    if (!data || data.length === 0) { setConversations([]); return }

    // Fetch the other participant's profile for each conversation
    const otherIds = data.map(c => c.client_id === userId ? c.creator_id : c.client_id)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, display_name, username, avatar_url, account_type')
      .in('id', otherIds)

    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

    // Fetch last message + unread count for each conversation
    const enriched = await Promise.all(data.map(async (c) => {
      const otherId = c.client_id === userId ? c.creator_id : c.client_id
      const [{ data: lastMsg }, { count: unread }] = await Promise.all([
        supabase.from('messages').select('content, created_at, sender_id').eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(1).single(),
        supabase.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', c.id).eq('is_read', false).neq('sender_id', userId),
      ])
      return { ...c, other: profileMap[otherId], lastMsg, unread: unread || 0 }
    }))

    setConversations(enriched)
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '100px' }}>

      {/* Header */}
      <div style={{ padding: '16px 20px 12px' }}>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '600', margin: '0 0 4px', letterSpacing: '-0.02em' }}>Messages</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: 0 }}>Your conversations with artists and clients</p>
      </div>

      {conversations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 32px' }}>
          <div style={{ fontSize: '36px', marginBottom: '16px' }}>✦</div>
          <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '500', margin: '0 0 8px' }}>No messages yet</p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '13px', margin: '0 0 24px' }}>Find a nail artist or salon and start a conversation.</p>
          <Link href="/search" style={{ background: 'var(--accent)', color: '#2C0A1E', borderRadius: '12px', padding: '11px 24px', fontSize: '14px', fontWeight: '600', textDecoration: 'none' }}>
            Find an artist
          </Link>
        </div>
      ) : (
        <div>
          {conversations.map(c => (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', borderBottom: '0.5px solid var(--border)', textDecoration: 'none', background: c.unread > 0 ? 'rgba(212,160,192,0.04)' : 'transparent' }}
            >
              {/* Avatar */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-chip)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {c.other?.avatar_url
                    ? <img src={c.other.avatar_url} alt={c.other.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: 'var(--accent)', fontSize: '18px', fontWeight: '600' }}>{(c.other?.display_name || '?')[0].toUpperCase()}</span>
                  }
                </div>
                {c.unread > 0 && (
                  <div style={{ position: 'absolute', top: 0, right: 0, width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ color: '#2C0A1E', fontSize: '9px', fontWeight: '700' }}>{c.unread}</span>
                  </div>
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
                  <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: c.unread > 0 ? '700' : '500', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {c.other?.display_name || 'User'}
                  </p>
                  {c.lastMsg && (
                    <span style={{ color: 'var(--text-secondary)', fontSize: '11px', flexShrink: 0, marginLeft: '8px' }}>
                      {timeAgo(c.lastMsg.created_at)}
                    </span>
                  )}
                </div>
                <p style={{ color: c.unread > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontSize: '13px', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: c.unread > 0 ? '500' : '400' }}>
                  {c.lastMsg
                    ? (() => {
                        const isDesign = c.lastMsg.content?.startsWith('{"__type":"design"')
                        const preview = isDesign ? '✦ Design' : c.lastMsg.content
                        return c.lastMsg.sender_id === currentUser?.id ? `You: ${preview}` : preview
                      })()
                    : 'No messages yet'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MessagesPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
      </div>
    }>
      <MessagesInner />
    </Suspense>
  )
}
