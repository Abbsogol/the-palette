'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { LaqueWordmark } from '@/components/ui/icons'

// New-message picker (frame 242:2175): recent contacts = peers of existing
// conversations; search = profiles by name/@username/city. Tapping a person
// routes through the existing find-or-create flow (/messages?with=<id>).
const PANEL = 'rgba(255, 255, 255, 0.06)'
const PANEL_BORDER = '1px solid rgba(255, 255, 255, 0.1)'
const WHITE80 = 'rgba(255, 255, 255, 0.8)'
const WHITE60 = 'rgba(255, 255, 255, 0.6)'
const WHITE40 = 'rgba(255, 255, 255, 0.4)'
const BTN_GRADIENT = 'linear-gradient(90deg, #660007 47.832%, #FF517F 100%)'

const ui = (weight, size, color = 'var(--lq-white)') => ({
  fontFamily: 'var(--lq-font-ui)', fontWeight: weight, fontSize: `${size}px`, color, lineHeight: 1.3,
})

export default function NewMessagePage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [recent, setRecent] = useState([])
  const [results, setResults] = useState(null) // null = not searching
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/profile'); return }
      setCurrentUser(user)

      const { data: convs } = await supabase
        .from('conversations')
        .select('client_id, creator_id, last_message_at')
        .or(`client_id.eq.${user.id},creator_id.eq.${user.id}`)
        .order('last_message_at', { ascending: false })
        .limit(20)
      const peerIds = [...new Set((convs || []).map(c => c.client_id === user.id ? c.creator_id : c.client_id))]
      if (peerIds.length) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, display_name, username, avatar_url, account_type, location')
          .in('id', peerIds)
        const map = Object.fromEntries((profiles || []).map(p => [p.id, p]))
        setRecent(peerIds.map(pid => map[pid]).filter(Boolean))
      }
      setLoading(false)
    }
    init()
  }, [])

  // Debounced profile search across name / username / city
  useEffect(() => {
    const q = query.trim()
    if (!q) { setResults(null); return }
    const t = setTimeout(async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, display_name, username, avatar_url, account_type, location')
        .or(`display_name.ilike.%${q}%,username.ilike.%${q}%,location.ilike.%${q}%`)
        .neq('id', currentUser?.id || '00000000-0000-0000-0000-000000000000')
        .limit(20)
      if (error) { console.error('contact search failed:', error); return }
      setResults(data || [])
    }, 350)
    return () => clearTimeout(t)
  }, [query, currentUser])

  const badge = (t) => (t === 'creator' || t === 'salon' || t === 'user') && (
    <span style={{ background: BTN_GRADIENT, border: '1px solid rgba(255,81,127,0.25)', borderRadius: '4px', padding: '2px 6px', ...ui(500, 10), letterSpacing: '0.02em', flexShrink: 0 }}>
      {t === 'salon' ? 'SALON' : t === 'creator' ? 'NAIL ARTIST' : 'CLIENT'}
    </span>
  )

  const personRow = (p) => (
    <Link key={p.id} href={`/messages?with=${p.id}`}
      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderRadius: '16px', textDecoration: 'none' }}>
      <div style={{ width: '44px', height: '44px', borderRadius: '22px', background: p.avatar_url ? 'transparent' : 'rgba(255,255,255,0.08)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {p.avatar_url
          ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={ui(500, 18)}>{(p.display_name || p.username || '?')[0].toUpperCase()}</span>}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <p style={{ ...ui(500, 16), margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {p.display_name || p.username || 'Unnamed'}
          </p>
          {badge(p.account_type)}
        </div>
        {p.location && <p style={{ ...ui(300, 12, WHITE60), margin: '3px 0 0' }}>📍 {p.location}</p>}
      </div>
      <span style={ui(400, 16, WHITE40)}>›</span>
    </Link>
  )

  const list = results ?? recent

  return (
    <div style={{ position: 'relative', minHeight: '100dvh' }}>
      <div aria-hidden className="lq-bg-wine" style={{ position: 'fixed', top: 0, bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', zIndex: 0 }}>
        <div className="lq-grain" />
      </div>
      <div style={{ position: 'relative', zIndex: 1, padding: 'calc(env(safe-area-inset-top) + 12px) 24px calc(env(safe-area-inset-bottom) + 120px)', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <Link href="/messages" aria-label="Back to messages"
            style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px', padding: '8px', display: 'flex', color: 'var(--lq-white)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
          </Link>
          <span style={{ color: 'var(--lq-white)', display: 'flex' }}><LaqueWordmark height={24} /></span>
        </div>

        <h1 style={{ ...ui(500, 28), margin: 0 }}>New message</h1>

        <div style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '100px', display: 'flex', gap: '8px', alignItems: 'center', padding: '12px 16px' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={WHITE80} strokeWidth="1.5" strokeLinecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search by name, @username or city…"
            aria-label="Search people"
            style={{ flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--lq-white)', fontSize: '14px', fontFamily: 'var(--lq-font-ui)' }}
          />
        </div>

        <div>
          <p style={{ ...ui(500, 11, WHITE40), letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 10px' }}>
            {results ? `Results (${results.length})` : 'Recent contacts'}
          </p>
          {loading ? (
            <p style={{ ...ui(300, 14, WHITE60), textAlign: 'center', padding: '32px 0' }}>Loading…</p>
          ) : list.length === 0 ? (
            <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '24px', textAlign: 'center', padding: '32px 24px' }}>
              <p style={{ ...ui(300, 14, WHITE60), margin: 0 }}>
                {results ? 'No one found — try a different name or city.' : 'No conversations yet — search for someone to message.'}
              </p>
            </div>
          ) : (
            <div style={{ background: PANEL, border: PANEL_BORDER, borderRadius: '24px', padding: '8px', display: 'flex', flexDirection: 'column' }}>
              {list.map(personRow)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
