'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Sheet from '@/components/ui/Sheet'

const ACCENT = '#FF517F'
const WHITE60 = 'rgba(255,255,255,0.6)'
const PANEL = 'rgba(255,255,255,0.06)'
const PANEL_BORDER = '1px solid rgba(255,255,255,0.1)'
const ROW_BORDER = '1px solid rgba(255,255,255,0.08)'
const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.4,
})
const display = (size) => ({ fontFamily: 'var(--lq-font-display)', fontWeight: 400, fontSize: `${size}px`, color: 'var(--lq-white)', lineHeight: 1.2 })

export default function SendDesignSheet({ design, onClose }) {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [sending, setSending] = useState(null) // conversation id being sent to
  const [sendError, setSendError] = useState('')

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setLoading(false); return }
      setCurrentUser(user)

      // Load conversations with other participant profiles
      const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('*')
        .or(`client_id.eq.${user.id},creator_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false })

      if (convError) { setLoadError(true); setLoading(false); return }
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
    setSendError('')

    const content = JSON.stringify({
      __type: 'design',
      id: design.id,
      title: design.title,
      image_url: design.image_url,
      image_width: design.image_width ?? null,
      image_height: design.image_height ?? null,
    })

    const { error } = await supabase.from('messages').insert({
      conversation_id: conv.id,
      sender_id: currentUser.id,
      content,
    })

    if (error) {
      setSendError(
        error.message?.includes('BLOCKED_CANNOT_MESSAGE')
          ? "You can't message this person."
          : error.message?.includes('MESSAGE_PERMISSION_DENIED')
          ? "This person isn't accepting messages right now."
          : 'Failed to send. Please try again.'
      )
      setSending(null)
      return
    }

    const { error: convError } = await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conv.id)
    if (convError) console.error('conversation update error:', convError)

    // Notify the other person
    const otherId = conv.client_id === currentUser.id ? conv.creator_id : conv.client_id
    const { error: notifError } = await supabase.from('notifications').insert({
      user_id: otherId,
      actor_id: currentUser.id,
      type: 'new_message',
    })
    if (notifError) console.error('notification error:', notifError)

    onClose()
    router.push(`/messages/${conv.id}`)
  }

  return (
    <Sheet title="Send to chat" onClose={onClose}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h2 style={{ ...display(22), margin: '0 0 2px' }}>Send to chat</h2>
        <p style={{ ...ui(300, 13, WHITE60), margin: 0 }}>{design.title}</p>
      </div>

      {/* Error */}
      {sendError && (
        <div style={{ margin: '0 0 12px', background: 'rgba(224,112,112,0.12)', border: '1px solid rgba(224,112,112,0.35)', borderRadius: '12px', padding: '10px 14px' }}>
          <p style={{ ...ui(400, 13, '#FF8DA8'), margin: 0 }}>{sendError}</p>
        </div>
      )}

      {/* Conversation list */}
      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <p style={ui(300, 13, WHITE60)}>Loading…</p>
        </div>
      ) : loadError ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <p style={ui(300, 13, WHITE60)}>Couldn&apos;t load your conversations. Please try again.</p>
        </div>
      ) : conversations.length === 0 ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <p style={ui(400, 13)}>No conversations yet.</p>
          <p style={{ ...ui(300, 12, WHITE60), marginTop: '4px' }}>Message a nail artist first, then you can share designs with them.</p>
        </div>
      ) : (
        <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '16px', overflow: 'hidden' }}>
          {conversations.map((conv, i) => (
            <button
              key={conv.id}
              onClick={() => handleSend(conv)}
              disabled={!!sending}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '14px',
                padding: '13px 14px', background: 'none', border: 'none',
                borderBottom: i < conversations.length - 1 ? ROW_BORDER : 'none', cursor: 'pointer',
                textAlign: 'left', opacity: sending && sending !== conv.id ? 0.5 : 1,
                transition: 'opacity 0.15s',
              }}
            >
              <div style={{ width: '44px', height: '44px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', flexShrink: 0, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', border: PANEL_BORDER }}>
                {conv.other?.avatar_url
                  ? <img src={conv.other.avatar_url} alt={conv.other?.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={ui(600, 16, ACCENT)}>{(conv.other?.display_name || '?')[0].toUpperCase()}</span>
                }
              </div>
              <p style={{ ...ui(500, 14), margin: 0, flex: 1 }}>
                {conv.other?.display_name || 'User'}
              </p>
              {sending === conv.id ? (
                <span style={ui(500, 12, ACCENT)}>Sending…</span>
              ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 2L11 13"/><path d="M22 2L15 22L11 13L2 9L22 2Z"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      )}
    </Sheet>
  )
}
