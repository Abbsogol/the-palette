'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function SendDesignSheet({ design, onClose }) {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(null) // conversation id being sent to

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setCurrentUser(user)

      // Load conversations with other participant profiles
      const { data: convs } = await supabase
        .from('conversations')
        .select('*')
        .or(`client_id.eq.${user.id},creator_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false })

      if (!convs || convs.length === 0) { setConversations([]); setLoading(false); return }

      const otherIds = convs.map(c => c.client_id === user.id ? c.creator_id : c.client_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, avatar_url')
        .in('id', otherIds)

      const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))

      setConversations(convs.map(c => {
        const otherId = c.client_id === user.id ? c.creator_id : c.client_id
        return { ...c, other: profileMap[otherId] }
      }))
      setLoading(false)
    }
    init()
  }, [])

  const handleSend = async (conv) => {
    if (sending) return
    setSending(conv.id)

    const content = JSON.stringify({
      __type: 'design',
      id: design.id,
      title: design.title,
      image_url: design.image_url,
    })

    await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: currentUser.id,
      content,
    })

    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conv.id)

    // Notify the other person
    const otherId = conv.client_id === currentUser.id ? conv.creator_id : conv.client_id
    await supabase.from('notifications').insert({
      user_id: otherId,
      actor_id: currentUser.id,
      type: 'new_message',
    })

    onClose()
    router.push(`/messages/${conv.id}`)
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)',
          zIndex: 200, backdropFilter: 'blur(2px)',
        }}
      />

      {/* Sheet */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        background: 'var(--bg-card)',
        borderRadius: '20px 20px 0 0',
        zIndex: 201,
        maxHeight: '75dvh',
        display: 'flex', flexDirection: 'column',
        fontFamily: "'DM Sans', sans-serif",
      }}>

        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: '36px', height: '4px', borderRadius: '2px', background: 'var(--border)' }} />
        </div>

        {/* Header */}
        <div style={{ padding: '8px 20px 14px', borderBottom: '0.5px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: '16px', fontWeight: '600', margin: '0 0 2px' }}>Send to chat</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '12px', margin: 0 }}>{design.title}</p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'var(--bg-chip)', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        {/* Conversation list */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Loading…</p>
            </div>
          ) : conversations.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>No conversations yet.</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginTop: '4px' }}>Message a nail artist first, then you can share designs with them.</p>
            </div>
          ) : (
            conversations.map(conv => (
              <button
                key={conv.id}
                onClick={() => handleSend(conv)}
                disabled={!!sending}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                  padding: '14px 20px', background: 'none', border: 'none',
                  borderBottom: '0.5px solid var(--border)', cursor: 'pointer',
                  textAlign: 'left', opacity: sending && sending !== conv.id ? 0.5 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'var(--bg-chip)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {conv.other?.avatar_url
                    ? <img src={conv.other.avatar_url} alt={conv.other?.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: '600' }}>{(conv.other?.display_name || '?')[0].toUpperCase()}</span>
                  }
                </div>
                <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '500', margin: 0, flex: 1 }}>
                  {conv.other?.display_name || 'User'}
                </p>
                {sending === conv.id ? (
                  <span style={{ color: 'var(--accent)', fontSize: '12px', fontWeight: '500' }}>Sending…</span>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/>
                  </svg>
                )}
              </button>
            ))
          )}
        </div>

        {/* Safe area bottom pad */}
        <div style={{ height: 'env(safe-area-inset-bottom, 16px)' }} />
      </div>
    </>
  )
}
