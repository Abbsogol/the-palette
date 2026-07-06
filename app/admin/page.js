'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

const TABS = ['Dashboard', 'Moderation', 'Tags', 'Credits']

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (d >= 1) return `${d}d ago`
  if (h >= 1) return `${h}h ago`
  if (m >= 1) return `${m}m ago`
  return 'just now'
}

function Loader() {
  return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)', fontSize: '13px' }}>Loading…</div>
}

// ── Dashboard ──────────────────────────────────────────────────────────────────
function Dashboard({ call }) {
  const [stats, setStats] = useState(null)
  useEffect(() => { call('stats').then(setStats) }, [])
  if (!stats) return <Loader />

  const cards = [
    { label: 'Total Users',   value: stats.users,         color: '#D4A0C0' },
    { label: 'Live Designs',  value: stats.designs,       color: '#A0C4D4' },
    { label: 'Bookings',      value: stats.bookings,      color: '#C4D4A0' },
    { label: 'Subscriptions', value: stats.subscriptions, color: '#D4C4A0' },
  ]

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '24px' }}>
        {cards.map(c => (
          <div key={c.label} style={{ background: 'var(--bg-card)', borderRadius: '14px', padding: '16px', border: '0.5px solid var(--border)' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', letterSpacing: '0.06em', textTransform: 'uppercase', margin: '0 0 6px' }}>{c.label}</p>
            <p style={{ color: c.color, fontSize: '28px', fontWeight: '700', margin: 0, letterSpacing: '-0.02em' }}>{c.value ?? '—'}</p>
          </div>
        ))}
      </div>
      <p style={sectionLabel}>Recent signups</p>
      {(stats.recentUsers || []).map(u => (
        <div key={u.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: 0 }}>{u.display_name || u.username || 'User'}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '2px 0 0' }}>{u.account_type}</p>
          </div>
          <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>{timeAgo(u.created_at)}</span>
        </div>
      ))}
    </div>
  )
}

// ── Moderation ─────────────────────────────────────────────────────────────────
function Moderation({ call }) {
  const [designs, setDesigns] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(null)
  const PAGE_SIZE = 20

  const load = async (p) => {
    setLoading(true)
    const res = await call('designs', { page: p })
    setDesigns(res.designs || [])
    setTotal(res.total || 0)
    setLoading(false)
  }

  useEffect(() => { load(0) }, [])

  const toggle = async (d) => {
    setActing(d.id)
    await call('unpublish', { designId: d.id, publish: !d.is_published })
    setDesigns(prev => prev.map(x => x.id === d.id ? { ...x, is_published: !x.is_published } : x))
    setActing(null)
  }

  if (loading) return <Loader />

  return (
    <div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '12px' }}>{total} designs total</p>
      {designs.map(d => (
        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
          {d.image_url && (
            <img src={d.image_url} alt={d.title} style={{ width: '44px', height: '44px', borderRadius: '8px', objectFit: 'cover', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '2px 0 0' }}>{d.creator_name} · {d.category}</p>
          </div>
          <button
            onClick={() => toggle(d)}
            disabled={acting === d.id}
            style={{
              background: d.is_published ? 'rgba(200,100,100,0.1)' : 'rgba(100,200,130,0.1)',
              color: d.is_published ? '#E07070' : '#6CC882',
              border: `0.5px solid ${d.is_published ? 'rgba(200,100,100,0.3)' : 'rgba(100,200,130,0.3)'}`,
              borderRadius: '8px', padding: '5px 10px',
              fontSize: '11px', fontWeight: '600',
              fontFamily: "'DM Sans', sans-serif",
              cursor: 'pointer', flexShrink: 0,
              opacity: acting === d.id ? 0.5 : 1,
            }}
          >
            {d.is_published ? 'Unpublish' : 'Publish'}
          </button>
        </div>
      ))}
      {total > PAGE_SIZE && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px', marginTop: '16px' }}>
          <button onClick={() => { const p = page - 1; setPage(p); load(p) }} disabled={page === 0} style={pageBtn}>← Prev</button>
          <span style={{ color: 'var(--text-secondary)', fontSize: '12px', alignSelf: 'center' }}>Page {page + 1}</span>
          <button onClick={() => { const p = page + 1; setPage(p); load(p) }} disabled={(page + 1) * PAGE_SIZE >= total} style={pageBtn}>Next →</button>
        </div>
      )}
    </div>
  )
}

// ── Tags ───────────────────────────────────────────────────────────────────────
function Tags({ call }) {
  const [tags, setTags] = useState([])
  const [newTag, setNewTag] = useState('')
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => { call('tags').then(r => setTags(r.tags || [])) }, [])

  const addTag = async () => {
    if (!newTag.trim() || adding) return
    setAdding(true)
    const res = await call('add-tag', { name: newTag })
    if (res.tag) setTags(prev => [...prev, res.tag].sort((a, b) => a.name.localeCompare(b.name)))
    setNewTag('')
    setAdding(false)
  }

  const deleteTag = async (tag) => {
    if (deleting) return
    setDeleting(tag.id)
    await call('delete-tag', { tagId: tag.id })
    setTags(prev => prev.filter(t => t.id !== tag.id))
    setDeleting(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <input
          value={newTag}
          onChange={e => setNewTag(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTag()}
          placeholder="New tag name…"
          style={{ flex: 1, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
        />
        <button onClick={addTag} disabled={!newTag.trim() || adding} style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '10px', padding: '10px 16px', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', opacity: (!newTag.trim() || adding) ? 0.5 : 1 }}>
          {adding ? '…' : 'Add'}
        </button>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '12px', marginBottom: '10px' }}>{tags.length} tags</p>
      {tags.map(tag => (
        <div key={tag.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '0.5px solid var(--border)' }}>
          <span style={{ color: 'var(--text-primary)', fontSize: '13px' }}>#{tag.name}</span>
          <button onClick={() => deleteTag(tag)} disabled={deleting === tag.id} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '11px', fontFamily: "'DM Sans', sans-serif", opacity: deleting === tag.id ? 0.4 : 1 }}>Delete</button>
        </div>
      ))}
    </div>
  )
}

// ── Credits ────────────────────────────────────────────────────────────────────
function Credits({ call }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selected, setSelected] = useState(null)
  const [amount, setAmount] = useState('')
  const [updating, setUpdating] = useState(false)
  const [message, setMessage] = useState('')

  const search = async () => {
    if (!query.trim()) return
    const res = await call('search-user', { query })
    setResults(res.users || [])
    setSelected(null)
  }

  const updateCredits = async (delta) => {
    if (!selected || !amount || updating) return
    setUpdating(true)
    const res = await call('update-credits', { targetUserId: selected.id, amount: delta * parseInt(amount) })
    if (res.ok) {
      setSelected(prev => ({ ...prev, credits: res.newBalance }))
      setResults(prev => prev.map(u => u.id === selected.id ? { ...u, credits: res.newBalance } : u))
      setMessage(`Done — new balance: ${res.newBalance} credits`)
      setAmount('')
    }
    setUpdating(false)
    setTimeout(() => setMessage(''), 3000)
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && search()}
          placeholder="Search by name or username…"
          style={{ flex: 1, background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }}
        />
        <button onClick={search} style={{ background: 'var(--accent)', color: '#2C0A1E', border: 'none', borderRadius: '10px', padding: '10px 16px', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>Search</button>
      </div>
      {results.map(u => (
        <div key={u.id} onClick={() => setSelected(u)} style={{ padding: '12px 14px', marginBottom: '8px', background: selected?.id === u.id ? 'rgba(212,160,192,0.1)' : 'var(--bg-card)', border: `0.5px solid ${selected?.id === u.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: '12px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ color: 'var(--text-primary)', fontSize: '13px', fontWeight: '500', margin: 0 }}>{u.display_name}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '11px', margin: '2px 0 0' }}>@{u.username} · {u.account_type}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'var(--accent)', fontSize: '16px', fontWeight: '700', margin: 0 }}>{u.credits ?? 0}</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '10px', margin: 0 }}>credits</p>
          </div>
        </div>
      ))}
      {selected && (
        <div style={{ marginTop: '20px', background: 'var(--bg-card)', borderRadius: '14px', padding: '16px', border: '0.5px solid var(--border)' }}>
          <p style={sectionLabel}>Adjust credits — {selected.display_name}</p>
          <p style={{ color: 'var(--accent)', fontSize: '22px', fontWeight: '700', margin: '0 0 12px' }}>{selected.credits ?? 0} credits</p>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Amount" style={{ flex: 1, background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '10px 14px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: "'DM Sans', sans-serif", outline: 'none' }} />
            <button onClick={() => updateCredits(1)} disabled={!amount || updating} style={{ background: 'rgba(100,200,130,0.12)', color: '#6CC882', border: '0.5px solid rgba(100,200,130,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>+ Add</button>
            <button onClick={() => updateCredits(-1)} disabled={!amount || updating} style={{ background: 'rgba(200,100,100,0.1)', color: '#E07070', border: '0.5px solid rgba(200,100,100,0.3)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }}>– Remove</button>
          </div>
          {message && <p style={{ color: '#6CC882', fontSize: '12px', marginTop: '10px' }}>{message}</p>}
        </div>
      )}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function AdminPage() {
  const router = useRouter()
  const [currentUser, setCurrentUser] = useState(null)
  const [tab, setTab] = useState(0)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }
      const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
      if (!profile?.is_admin) { router.push('/'); return }
      setCurrentUser(user)
      setChecking(false)
    }
    init()
  }, [])

  const call = async (action, extra = {}) => {
    const res = await fetch('/api/admin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, userId: currentUser?.id, ...extra }),
    })
    return res.json()
  }

  if (checking) return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif" }}>Checking access…</p>
    </div>
  )

  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg-primary)', fontFamily: "'DM Sans', sans-serif", paddingBottom: '40px' }}>
      <div style={{ padding: '20px 20px 0' }}>
        <p style={{ color: 'var(--accent)', fontSize: '10px', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 4px' }}>Laque</p>
        <h1 style={{ color: 'var(--text-primary)', fontSize: '22px', fontWeight: '600', margin: 0, letterSpacing: '-0.02em' }}>Admin Panel</h1>
      </div>
      <div style={{ display: 'flex', gap: '6px', padding: '16px 20px', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
        {TABS.map((t, i) => (
          <button key={t} onClick={() => setTab(i)} style={{ background: tab === i ? 'var(--accent)' : 'var(--bg-card)', color: tab === i ? '#2C0A1E' : 'var(--text-secondary)', border: `0.5px solid ${tab === i ? 'transparent' : 'var(--border)'}`, borderRadius: '20px', padding: '7px 16px', fontSize: '12px', fontWeight: '600', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer', flexShrink: 0, transition: 'all 0.15s' }}>
            {t}
          </button>
        ))}
      </div>
      <div style={{ padding: '4px 20px' }}>
        {tab === 0 && <Dashboard call={call} />}
        {tab === 1 && <Moderation call={call} />}
        {tab === 2 && <Tags call={call} />}
        {tab === 3 && <Credits call={call} />}
      </div>
    </div>
  )
}

const sectionLabel = { color: 'var(--accent)', fontSize: '10px', fontWeight: '700', letterSpacing: '0.08em', textTransform: 'uppercase', margin: '0 0 12px' }
const pageBtn = { background: 'var(--bg-card)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '7px 14px', fontSize: '12px', color: 'var(--text-secondary)', fontFamily: "'DM Sans', sans-serif", cursor: 'pointer' }
