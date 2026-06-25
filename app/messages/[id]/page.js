'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function ChatPage() {
  const { id } = useParams()
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [other, setOther] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [keyboardOffset, setKeyboardOffset] = useState(0)
  const bottomRef = useRef(null)
  const inputRef = useRef(null)

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
      if (!user) { router.push('/login'); return }
      setCurrentUser(user)

      // Load conversation + other participant
      const { data: conv } = await supabase
        .from('conversations')
        .select('*')
        .eq('id', id)
        .single()

      if (!conv) { router.push('/messages'); return }

      const otherId = conv.client_id === user.id ? conv.creator_id : conv.client_id
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, account_type')
        .eq('id', otherId)
        .single()

      setOther(profile)

      // Load messages
      const { data: msgs } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', id)
        .order('created_at', { ascending: true })

      setMessages(msgs || [])

      // Mark unread as read
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('conversation_id', id)
        .neq('sender_id', user.id)
        .eq('is_read', false)

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
        }
      })
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [id, currentUser])

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    const text = input.trim()
    if (!text || sending) return
    setSending(true)
    setInput('')

    await supabase.from('messages').insert({
      conversation_id: id,
      sender_id: currentUser.id,
      content: text,
    })

    // Update last_message_at on conversation
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', id)

    // Notify the other person
    await supabase.from('notifications').insert({
      user_id: other?.id,
      actor_id: currentUser.id,
      type: 'new_message',
    })

    setSending(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (loading) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Loading…</p>
    </div>
  )

  return (
    <div style={{ height: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 20px', borderBottom: '0.5px solid var(--border)', flexShrink: 0, background: 'var(--bg-primary)' }}>
        <Link href="/messages" style={{ color: 'var(--text-primary)', textDecoration: 'none', display: 'flex' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
        </Link>
        <Link href={`/creator/${other?.id}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none', flex: 1 }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--bg-chip)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {other?.avatar_url
              ? <img src={other.avatar_url} alt={other.display_name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: '600' }}>{(other?.display_name || '?')[0].toUpperCase()}</span>
            }
          </div>
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: '14px', fontWeight: '600', margin: 0 }}>{other?.display_name}</p>
            {other?.username && <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: 0 }}>@{other.username}</p>}
          </div>
        </Link>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {messages.length === 0 && (
          <div style={{ textAlign: 'center', margin: 'auto', padding: '40px 0' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>Say hi to {other?.display_name} ✦</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMe = msg.sender_id === currentUser?.id
          const prevMsg = messages[i - 1]
          const showTime = !prevMsg || (new Date(msg.created_at) - new Date(prevMsg.created_at)) > 5 * 60 * 1000

          return (
            <div key={msg.id}>
              {showTime && (
                <p style={{ color: 'var(--text-secondary)', fontSize: '10px', textAlign: 'center', margin: '8px 0 4px' }}>
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              )}
              <div style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%',
                  background: isMe ? 'var(--accent)' : 'var(--bg-card)',
                  color: isMe ? '#2C0A1E' : 'var(--text-primary)',
                  borderRadius: isMe ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                  padding: '10px 14px',
                  fontSize: '14px',
                  lineHeight: '1.45',
                  border: isMe ? 'none' : '0.5px solid var(--border)',
                  wordBreak: 'break-word',
                }}>
                  {msg.content}
                </div>
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{
        position: 'fixed', bottom: keyboardOffset, left: 0, right: 0,
        background: 'var(--bg-primary)', borderTop: '0.5px solid var(--border)',
        padding: '10px 16px',
        paddingBottom: `max(10px, env(safe-area-inset-bottom))`,
        display: 'flex', gap: '10px', alignItems: 'flex-end',
        transition: 'bottom 0.2s ease', zIndex: 50,
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message…"
          rows={1}
          style={{
            flex: 1, background: 'var(--bg-card)', border: '0.5px solid var(--border)',
            borderRadius: '20px', padding: '10px 16px',
            color: 'var(--text-primary)', fontSize: '14px',
            fontFamily: "'DM Sans', sans-serif", outline: 'none',
            resize: 'none', maxHeight: '100px', overflowY: 'auto',
            lineHeight: '1.4',
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
            background: input.trim() ? 'var(--accent)' : 'var(--bg-chip)',
            border: 'none', cursor: input.trim() ? 'pointer' : 'not-allowed',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'background 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M22 2L11 13" stroke={input.trim() ? '#2C0A1E' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M22 2L15 22L11 13L2 9L22 2Z" stroke={input.trim() ? '#2C0A1E' : 'var(--text-secondary)'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  )
}
