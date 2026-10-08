'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import styles from './admin.module.css';
import Overview from './overview';
import UserDetails from './user-details';
const labels = {
  overview: 'Overview',
  users: 'Users & Creators',
  content: 'Content',
  home: 'Home Editor',
  bookings: 'Bookings',
  lab: 'Lab Diagnostics',
  credits: 'Subscriptions & Tokens',
  reports: 'Safety Reports',
  pinterest: 'Pinterest',
  integrations: 'Integrations',
  team: 'Team',
  activity: 'Activity'
};
async function request(path, body) {
  const {
    data: {
      session
    }
  } = await supabase.auth.getSession();
  if (!session) throw Object.assign(new Error('Sign in to continue.'), {
    code: 'SIGN_IN_REQUIRED'
  });
  const r = await fetch('/api/admin/' + path, {
    method: body ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      'Content-Type': 'application/json'
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store'
  });
  const data = await r.json();
  if (!r.ok) throw Object.assign(new Error(data.error), {
    code: data.code
  });
  return data;
}
const date = v => v && Number.isFinite(new Date(v).getTime()) ? new Date(v).toLocaleString() : '—';
const friendly = v => String(v || '—').replaceAll('_', ' ');
function Field({
  label,
  children
}) {
  return <label className={styles.field}><span>{label}</span>{children}</label>;
}
function TextField({
  label,
  name,
  value = '',
  onChange,
  ...rest
}) {
  return <Field label={label}><input name={name} value={value} onChange={e => onChange(e.target.value)} {...rest} /></Field>;
}
function NoteList({
  notes = []
}) {
  return <div className={styles.notes}>{notes.map(n => <article key={n.id}><p>{n.body}</p><small>{date(n.created_at)}</small></article>)}</div>;
}
export default function AdminPage() {
  const [identity, setIdentity] = useState(null),
    [authReady, setAuthReady] = useState(false),
    [section, setSection] = useState('overview'),
    [overviewDays, setOverviewDays] = useState(30),
    [data, setData] = useState(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [busy, setBusy] = useState(false),
    [q, setQ] = useState(''),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState(''),
    [page, setPage] = useState(0),
    [detail, setDetail] = useState(null),
    [detailId, setDetailId] = useState(null),
    [contentType, setContentType] = useState('design'),
    [operation, setOperation] = useState(null),
    [reason, setReason] = useState('');
  const version = useRef(0),
    dialogRef = useRef(null),
    dialogTriggerRef = useRef(null),
    [reload, setReload] = useState(0);
  useEffect(() => {
    if (!operation) return;
    const before = dialogTriggerRef.current;
    const dialog = dialogRef.current;
    const trap = e => {
      if (e.key === 'Escape' && !busy) {
        setOperation(null);
        return;
      }
      if (e.key !== 'Tab') return;
      const controls = [...dialog.querySelectorAll('input,textarea,select,button')].filter(x => !x.disabled);
      const first = controls[0],
        last = controls.at(-1);
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    };
    dialog.addEventListener('keydown', trap);
    return () => {
      dialog.removeEventListener('keydown', trap);
      if (!dialog.isConnected) before?.focus?.();
    };
  }, [operation, busy]);
  const authenticate = useCallback(async () => {
    try {
      const i = await request('identity');
      setIdentity(i);
      setError('');
      const desired = new URL(window.location.href).searchParams.get('section');
      if (i.permissions.includes(desired)) setSection(desired);
    } catch (e) {
      setIdentity(null);
      setData(null);
      setDetail(null);
      setDetailId(null);
      setError(e.message);
    } finally {
      setAuthReady(true);
    }
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => void authenticate(), 0);
    const {
      data: {
        subscription
      }
    } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => void authenticate(), 0);
    });
    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, [authenticate]);
  useEffect(() => {
    if (!identity?.mfa) return;
    let active = true;
    const ticket = ++version.current;
    request(`${section}?q=${encodeURIComponent(search)}&page=${page}&filter=${filter}&type=${contentType}&days=${overviewDays}`).then(d => {
      if (active && ticket === version.current) {
        setData(d);
        setError('');
      }
    }).catch(e => {
      if (active) {
        setData(null);
        setDetail(null);
        setDetailId(null);
        setError(e.message);
      }
    });
    return () => {
      active = false;
    };
  }, [identity, section, search, page, filter, contentType, overviewDays, reload]);
  const select = s => {
    setSection(s);
    setData(null);
    setDetail(null);
    setDetailId(null);
    setQ('');
    setSearch('');
    setFilter('');
    setPage(0);
    setError('');
    setNotice('');
  };
  const open = async id => {
    setBusy(true);
    setDetail(null);
    setDetailId(null);
    setError('');
    try {
      const d = await request(`${section}/${id}?type=${contentType}`);
      setDetail(d);
      setDetailId(id);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const perform = async () => {
    if (!operation || busy) return;
    setBusy(true);
    setError('');
    try {
      if(operation.body.action==='export'){
        const {data:{session}}=await supabase.auth.getSession();
        if(!session)throw new Error('Sign in to continue.');
        const response=await fetch('/api/admin/export',{method:'POST',headers:{Authorization:`Bearer ${session.access_token}`,'Content-Type':'application/json'},body:JSON.stringify({...operation.body,action:undefined,reason}),cache:'no-store'});
        if(!response.ok){const result=await response.json();throw new Error(result.error)}
        const url=URL.createObjectURL(await response.blob());
        const link=document.createElement('a');link.href=url;link.download=response.headers.get('Content-Disposition')?.match(/filename="([^"]+)"/)?.[1]||'laque-export.csv';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
        setOperation(null);setReason('');setNotice('Export downloaded and recorded in Activity.');return;
      }
      const result = await request(operation.path, {
        ...operation.body,
        reason
      });
      setOperation(null);
      setReason('');
      setNotice('Change saved and recorded in activity history.');
      setDetail(null);
      setDetailId(null);
      setData(null);
      setReload(v => v + 1);
      if (result.authorizationUrl) window.location.assign(result.authorizationUrl);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const action = (title, path, body) => {
    dialogTriggerRef.current = document.activeElement;
    setOperation({
      title,
      path,
      body
    });
    setReason('');
    setError('');
  };
  const notes = (type, id) => action('Add internal case note', `${type}/${id}`, {
    action: 'note',
    body: ''
  });
  if (!authReady) return <main className={styles.gate}><h1>LaQue Admin</h1><p role="status">Checking access…</p></main>;
  if (!identity) return <main className={styles.gate}><h1>LaQue Admin</h1><p>Manage the connected app with your staff account.</p>{error && <p role="alert">{error}</p>}<Login onDone={authenticate} /><a href="/profile">Create or verify a LaQue account</a></main>;
  if (!identity.mfa) return <main className={styles.gate}><h1>Secure your dashboard</h1><p>Use an authenticator app to protect administrative access.</p><Mfa onDone={authenticate} /></main>;
  const name = id => {
    const p = (data?.profiles || detail?.profiles || []).find(p => p.id === id);
    return p ? `${p.display_name || p.username || 'LaQue user'}${p.username ? ' · @' + p.username : ''}` : id;
  };
  const rows = data?.items || [];
  return <div className={`${styles.shell} laque-admin-root`}>
  <aside inert={!!operation} className={styles.sidebar}><a href="/admin" className={styles.brand}>LaQue<span>Admin studio</span></a><nav aria-label="Dashboard">{identity.permissions.map(s => <button key={s} aria-current={section === s ? 'page' : undefined} className={section === s ? styles.selected : ''} onClick={() => select(s)}>{labels[s]}</button>)}</nav><div className={styles.staff}><span className={styles.badge}>{identity.role}</span><small>Authenticator verified</small><button onClick={() => void supabase.auth.signOut()}>Sign out</button></div></aside>
  <main inert={!!operation} className={styles.main}><header className={styles.header}><div><span className={styles.eyebrow}>LaQue operations</span><h1>{labels[section]}</h1></div><button onClick={() => {
          setData(null);
          setReload(v => v + 1);
        }}>Refresh</button></header>
   {data&&['overview','users','content','bookings','lab','credits','reports','activity'].includes(section)&&(section!=='users'||identity.role==='owner')&&<button disabled={busy} onClick={()=>action(`Export ${labels[section]}`,'export',{action:'export',section,q:search,filter,type:contentType,days:overviewDays})}>Export {section==='overview'?'analytics JSON':'filtered CSV'}</button>}
   {section==='users'&&<p className={styles.context}>Inspect a profile to see account details, setup, services and activity.{identity.role==='owner'?' User exports are available only to the Owner.':' User exports and private preference fields are restricted to the Owner.'}</p>}
   {error && <p className={styles.error} role="alert">{error}</p>}{notice && <p className={styles.notice} role="status">{notice}</p>}
   {['users', 'content', 'bookings', 'lab', 'credits', 'reports', 'activity'].includes(section) && <form className={styles.toolbar} onSubmit={e => {
        e.preventDefault();
        setSearch(q);
        setPage(0);
        setData(null);
      }}><input aria-label={`Search ${labels[section]}`} placeholder={section === 'lab' ? 'Filter by account UUID' : section==='users'?'Search name, username or email':`Search ${labels[section].toLowerCase()}`} value={q} onChange={e => setQ(e.target.value)} /><button>Search</button>{section === 'content' && <select aria-label="Content type" value={contentType} onChange={e => {
          setContentType(e.target.value);
          setData(null);
          setPage(0);
        }}><option value="design">Designs</option><option value="post">Posts</option><option value="story">Stories</option><option value="tag">Tags</option></select>}{['users', 'bookings', 'lab', 'reports'].includes(section) && <select aria-label="Status filter" value={filter} onChange={e => {
          setFilter(e.target.value);
          setPage(0);
          setData(null);
        }}><option value="">All</option>{(section === 'users' ? ['creator', 'salon', 'user'] : section === 'bookings' ? ['pending', 'confirmed', 'completed', 'cancelled', 'declined'] : section === 'lab' ? ['reserved', 'completed', 'released'] : ['open', 'reviewed', 'resolved']).map(f => <option key={f}>{f}</option>)}</select>}</form>}
   {!data && !error && <p role="status">Loading {labels[section].toLowerCase()}…</p>}
   {data && section === 'overview' && <Overview data={data} days={overviewDays} onRange={days=>{setOverviewDays(days);setData(null)}} />}
   {data && section === 'integrations' && <><p>{data.note}</p><div className={styles.grid}>{rows.map(r => <article key={r.name}><h2>{r.name}</h2><span className={styles.badge}>{r.ready ? 'Configured' : 'Needs configuration'}</span></article>)}</div></>}
   {data && section === 'home' && <HomeEditor key={data.version} data={data} action={action} />}
   {data && section === 'pinterest' && <PinterestPanel data={data} action={action} />}
   {data && section === 'team' && <TeamPanel data={data} action={action} />}
   {data && section === 'content' && contentType === 'design' && <DesignForm title="New LaQue design" action={action} tags={data.tags} create={identity.role === 'owner'} />}
   {data && section === 'content' && contentType === 'tag' && <form className={styles.inline} onSubmit={e => {
        e.preventDefault();
        action('Create tag', 'content', {
          action: 'tag',
          name: new FormData(e.currentTarget).get('name')
        });
      }}><input name="name" aria-label="New tag name" placeholder="New tag" required maxLength={60} /><button>Add tag</button></form>}
   {data && ['users', 'content', 'bookings', 'lab', 'credits', 'reports', 'activity'].includes(section) && <div className={styles.tableWrap}><table><caption className={styles.srOnly}>{labels[section]}</caption><thead><tr><th>{section === 'activity' ? 'Action' : 'Record'}</th><th>Status / details</th><th>Date</th><th><span className={styles.srOnly}>Actions</span></th></tr></thead><tbody>{rows.map(r => <tr key={r.id || r.user_id}><td>{r.avatar_url && <img className={styles.avatar} src={r.avatar_url} alt="" />}<strong>{r.display_name || r.title || r.name || r.target_type || r.action || name(r.user_id) || r.id}</strong>{r.username && <small>@{r.username}</small>}{section==='users'&&<small>{r.email||'No sign-in email'} · {r.email_confirmed_at?'Email verified':'Email unverified'}</small>}{section === 'bookings' && <small>{name(r.client_id)} → {name(r.creator_id)}</small>}{r.body && <small>{r.body.slice(0, 100)}</small>}{r.caption && <small>{r.caption.slice(0, 100)}</small>}</td><td>{section === 'users' ? `${friendly(r.account_type)} · ${r.onboarding_complete ? 'Setup complete' : 'Setup incomplete'}${r.deletion_started_at ? ' · Closed' : r.suspended?' · Suspended':''}` : section === 'credits' ? <>{data.subscriptions?.[r.id]?.active?'Subscribed':'No active subscription'}<small>{data.subscriptions?.[r.id]?.monthlyRemaining??0} monthly designs · {r.credit_balance} purchased tokens</small></> : section === 'content' ? contentType === 'design' ? `${r.is_published ? 'Public' : 'Draft'}${data.ownedIds?.includes(r.id) ? ' · LaQue owned' : ''}${data.hidden?.some(x => x.target_id === r.id && x.hidden) ? ' · Hidden' : ''}` : contentType : section === 'activity' ? <>{r.reason}<small>{r.actor_role} · {r.actor_id}</small></> : <>{friendly(r.status)}{r.time_zone && <small>{date(r.starts_at)} · {r.time_zone}</small>}{r.deposit_paid && <small>Deposit paid</small>}{r.reason && <small>{r.reason.slice(0, 100)}</small>}</>}</td><td>{date(r.created_at)}</td><td>{['users', 'credits', 'bookings', 'reports'].includes(section) && <button disabled={busy} onClick={() => void open(r.id)}>Inspect</button>}{section === 'content' && contentType === 'design' && data.ownedIds?.includes(r.id) && <button onClick={() => {
                  setDetail({
                    design: {
                      ...r,
                      tagIds: (data.designTags || []).filter(t => t.design_id === r.id).map(t => t.tag_id)
                    },
                    tags: data.tags
                  });
                  setDetailId(r.id);
                }}>Edit</button>}{section === 'content' && contentType === 'tag' && <button onClick={() => action('Rename tag', `content/${r.id}`, {
                  action: 'tag',
                  name: r.name
                })}>Rename</button>}</td></tr>)}</tbody></table>{!rows.length && <p className={styles.empty}>No records match this view.</p>}</div>}
   {data && data.page !== undefined && <div className={styles.pagination}><button disabled={!page} onClick={() => {
          setPage(v => v - 1);
          setData(null);
        }}>Previous</button><span>Page {page + 1}</span><button disabled={!data.hasMore} onClick={() => {
          setPage(v => v + 1);
          setData(null);
        }}>Next</button></div>}
   {detail && <section className={styles.detail} aria-label="Record details"><header><h2>{detail.profile?.display_name || detail.design?.title || 'Record details'}</h2><button onClick={() => {
            setDetail(null);
            setDetailId(null);
          }}>Close details</button></header>
    {section === 'users' && <><UserDetails detail={detail} owner={identity.role==='owner'} /><button onClick={() => notes('users', detailId)}>Add case note</button>{identity.role==='owner'&&<button disabled={busy} onClick={()=>action('Export account details','export',{action:'export',section:'users',id:detailId})}>Export account JSON</button>}{identity.role === 'owner' && !detail.profile.deletion_started_at && <button className={styles.danger} onClick={() => action(detail.suspension?.suspended ? 'Restore suspended account' : 'Suspend account', `users/${detailId}`, {
            action: 'suspend',suspended: !detail.suspension?.suspended
          })}>{detail.suspension?.suspended ? 'Restore access' : 'Suspend account'}</button>}</>}
    {section === 'bookings' && <><p>Appointment terms and payment outcomes are provider-controlled.</p>{detail.items?.map(b => <div key={b.id}><h3>{friendly(b.status)}</h3><p>{date(b.starts_at)} · {b.time_zone}</p><p>{name(b.client_id)} → {name(b.creator_id)}</p>{detail.services?.map(s => <p key={s.id}>{s.name} · AED {s.price} · deposit AED {s.deposit_amount} · {s.duration_minutes} minutes</p>)}{detail.payments?.map((p, i) => <p key={i}>Payment {p.fulfilled ? 'received' : 'pending'} · refund {p.refunded ? 'completed' : p.refund_status || 'not requested'}{p.needs_review ? ' · review required' : ''}</p>)}</div>)}<button onClick={() => notes('bookings', detailId)}>Add case note</button></>}
    {section === 'reports' && <><h3>{friendly(detail.report.target_type)} report</h3><p>{detail.report.reason}</p>{detail.item ? <article className={styles.reportItem}><p>{detail.item.content || detail.item.body || detail.item.caption || detail.item.title || detail.item.display_name}</p>{detail.item.image_url && <img src={detail.item.image_url} alt="Reported design" />}{detail.attachment && <img src={detail.attachment} alt="Reported attachment" />}{detail.participants.map(p => <small key={p.id}>{p.display_name} · @{p.username}</small>)}</article> : <p>Reported item has been deleted or is unavailable.</p>}<button onClick={() => notes('reports', detailId)}>Add note</button>{detail.report.target_type !== 'profile' && detail.item && <button onClick={() => action(detail.moderation?.hidden ? 'Restore reported content' : 'Hide reported content', `reports/${detailId}`, {
            action: 'moderate',
            hidden: !detail.moderation?.hidden
          })}>{detail.moderation?.hidden ? 'Restore content' : 'Hide content'}</button>}<button onClick={() => action('Resolve report', `reports/${detailId}`, {
            action: 'report',
            status: 'resolved',
            assignedTo: detail.report.assigned_to
          })}>Resolve</button><button onClick={() => action('Assign or review report', `reports/${detailId}`, {
            action: 'report',
            status: 'reviewed',
            assignedTo: identity.id
          })}>Assign to me / reviewed</button></>}
    {section === 'credits' && <><h3>{detail.subscription?.active?'Active Nail Lab subscription':'No active Nail Lab subscription'}</h3><p>{detail.subscription?.monthlyRemaining??0} monthly designs remaining · {detail.profile.credit_balance} purchased tokens</p><p>Period ends: {date(detail.subscription?.renewsAt)}</p><p>Purchased tokens are usable only with an active subscription. Corrections do not grant a subscription.</p><CreditForm id={detailId} action={action} /><h3>Subscriptions & store purchases</h3>{!detail.purchases.length && <p>No store purchases.</p>}{detail.purchases.map((p, i) => <p key={i}>{['laque_lab_monthly_5','laque_lab_monthly_5:monthly'].includes(p.product_id)?'Nail Lab monthly subscription':`${p.credits} design tokens`} · {p.store} · {p.refunded ? 'Refunded' : p.granted ? 'Credited' : 'Verifying'} · {date(p.purchased_at)}</p>)}<h3>Corrections</h3>{detail.corrections.map(c => <p key={c.id}>{c.delta > 0 ? '+' : ''}{c.delta} → {c.balance_after} · {c.reason} · {date(c.created_at)}</p>)}</>}
    {section === 'content' && detail.design && <DesignForm key={detailId} title="Edit LaQue design" design={detail.design} tags={detail.tags} action={action} />}
    <NoteList notes={detail.notes} />
   </section>}
  </main>
  {operation && <div className={styles.scrim}><section ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="change-title" className={styles.dialog}><h2 id="change-title">{operation.title}</h2>{operation.body.action==='export'&&<p>The download includes {operation.body.id?'this account’s details':operation.body.section==='overview'?'the selected analytics range':'all records matching the current search and filters, across pages (up to 5,000)'}. It is recorded in Activity.</p>}{operation.body.action === 'suspend' && operation.body.suspended && <p>This hides the profile and blocks new activity. Existing appointment cancellation, recovery and account deletion remain available.</p>}{operation.body.action === 'note' && <Field label="Internal note"><textarea value={operation.body.body} onChange={e => setOperation({
            ...operation,
            body: {
              ...operation.body,
              body: e.target.value
            }
          })} maxLength={4000} /></Field>}{operation.body.action === 'tag' && <TextField label="Tag name" value={operation.body.name} onChange={name => setOperation({
          ...operation,
          body: {
            ...operation.body,
            name
          }
        })} />}<Field label="Reason (required)"><textarea autoFocus value={reason} onChange={e => setReason(e.target.value)} minLength={5} maxLength={1000} /></Field>{error && <p role="alert">{error}</p>}<div className={styles.inline}><button disabled={busy || reason.trim().length < 5} onClick={() => void perform()}>{busy ? 'Working…' : operation.body.action==='export'?'Download export':'Confirm change'}</button><button disabled={busy} onClick={() => setOperation(null)}>Cancel</button></div></section></div>}
 </div>;
}
function Login({
  onDone
}) {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return <form onSubmit={async e => {
    e.preventDefault();
    setBusy(true);
    const {
      error
    } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    setBusy(false);
    if (error) setError('Sign-in failed. Check your email and password.');else await onDone();
  }}><TextField label="Email" value={email} onChange={setEmail} type="email" autoComplete="username" required /><TextField label="Password" value={password} onChange={setPassword} type="password" autoComplete="current-password" required />{error && <p role="alert">{error}</p>}<button disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button></form>;
}
function Mfa({
  onDone
}) {
  const [factor, setFactor] = useState(null),
    [code, setCode] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const prepare = async () => {
    setBusy(true);
    setError('');
    try {
      const {
        data,
        error
      } = await supabase.auth.mfa.listFactors();
      if (error) throw error;
      const verified = data.totp.find(f => f.status === 'verified');
      if (verified) setFactor({
        id: verified.id
      });else {
        for (const f of data.totp.filter(f => f.status !== 'verified')) await supabase.auth.mfa.unenroll({
          factorId: f.id
        });
        const {
          data: enrolled,
          error
        } = await supabase.auth.mfa.enroll({
          factorType: 'totp',
          friendlyName: 'LaQue Admin'
        });
        if (error) throw error;
        setFactor(enrolled);
      }
    } catch {
      setError('Authenticator setup failed. Try again.');
    } finally {
      setBusy(false);
    }
  };
  return <div>{!factor ? <button disabled={busy} onClick={() => void prepare()}>Set up / verify authenticator</button> : <form onSubmit={async e => {
      e.preventDefault();
      setBusy(true);
      const {
        error
      } = await supabase.auth.mfa.challengeAndVerify({
        factorId: factor.id,
        code
      });
      setBusy(false);
      if (error) setError('The code could not be verified. Try a fresh code.');else await onDone();
    }}>{factor.totp && <><img src={factor.totp.qr_code} alt="Scan this QR code in your authenticator app" /><p>Manual key: <code>{factor.totp.secret}</code></p></>}<TextField label="Six-digit code" value={code} onChange={setCode} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" required /><button disabled={busy}>Verify</button></form>}{error && <p role="alert">{error}</p>}<button onClick={() => void supabase.auth.signOut()}>Sign out</button></div>;
}
function CreditForm({
  id,
  action
}) {
  const [delta, setDelta] = useState('');
  return <form className={styles.inline} onSubmit={e => {
    e.preventDefault();
    action('Correct purchased design tokens', `credits/${id}`, {
      delta: Number(delta),
      key: crypto.randomUUID()
    });
  }}><TextField label="Purchased token change (+ / −)" value={delta} onChange={setDelta} type="number" min={-10000} max={10000} step={1} required /><button disabled={!Number.isInteger(Number(delta)) || Number(delta) === 0}>Review correction</button><p>Use a delta. Purchases and refunds remain provider-controlled.</p></form>;
}
function TeamPanel({
  data,
  action
}) {
  return <><form className={styles.inline} onSubmit={e => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      action('Assign verified staff account', `team/${f.get('id')}`, {
        role: f.get('role'),
        active: true
      });
    }}><input aria-label="Verified account UUID" name="id" placeholder="Verified account UUID" required /><select name="role" aria-label="Staff role"><option value="support">Support</option><option value="moderator">Moderator</option></select><button>Assign role</button></form><div className={styles.grid}>{data.items.map(r => <article key={r.user_id}><h3>{data.profiles.find(p => p.id === r.user_id)?.display_name || r.user_id}</h3><p>{r.role} · {r.active ? 'Active' : 'Revoked'}</p>{r.role !== 'owner' && <button onClick={() => action(r.active ? 'Revoke staff access' : 'Restore staff access', `team/${r.user_id}`, {
          role: r.role,
          active: !r.active
        })}>{r.active ? 'Revoke' : 'Restore'}</button>}</article>)}</div></>;
}
function DesignForm({
  title,
  design,
  tags = [],
  action,
  create
}) {
  const [draft, setDraft] = useState({
    title: design?.title || '',
    description: design?.description || '',
    category: design?.category || '',
    shape: design?.shape || '',
    length: design?.length || '',
    imageUrl: design?.image_url || '',
    published: !!design?.is_published,
    tags: design?.tagIds || []
  });
  if (!design && !create) return null;
  return <details className={styles.editor} open={!!design}><summary>{title}</summary><form onSubmit={e => {
      e.preventDefault();
      action(title, design ? `content/${design.id}` : 'content', {
        ...draft,
        action: design ? 'edit' : 'create'
      });
    }}><div className={styles.formGrid}>{['title', 'description', 'category', 'shape', 'length', ...(!design ? ['imageUrl'] : [])].map(k => <TextField key={k} label={k === 'imageUrl' ? 'Uploaded LaQue image URL' : friendly(k)} value={draft[k]} onChange={v => setDraft({
          ...draft,
          [k]: v
        })} required={['title', 'imageUrl'].includes(k)} />)}</div>{!!tags.length && <Field label="Tags"><select multiple value={draft.tags} onChange={e => setDraft({
          ...draft,
          tags: [...e.target.selectedOptions].map(x => x.value)
        })}>{tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></Field>}{!design && <ImageUpload onUploaded={url => setDraft({
        ...draft,
        imageUrl: url
      })} />} {design && <Field label="Published"><input type="checkbox" checked={draft.published} onChange={e => setDraft({
          ...draft,
          published: e.target.checked
        })} /></Field>}<button>Review {design ? 'changes' : 'draft'}</button></form></details>;
}
function HomeEditor({
  data,
  action
}) {
  const [draft, setDraft] = useState(data.draft),
    [featured, setFeatured] = useState(data.draft.featuredDesignIds.join('\n')), [previews,setPreviews]=useState(data.heroPreviews||{});
  return <section className={styles.editor}><p>Published revision {data.revision} · {date(data.published_at)}. Drafts are private; publish explicitly after previewing.</p><h2>Hero slides</h2><ImageUpload onUploaded={(url,previewUrl) => {setPreviews(p=>({...p,[url]:previewUrl}));setDraft({
      ...draft,
      heroes: [...draft.heroes, {
        id: crypto.randomUUID(),
        imageUrl: url,
        alt: "",
        title: "Nail & beauty\ndesign library",
        rotate: 0
      }].slice(0, 6)
    })}} />{draft.heroes.map((h, i) => <article key={h.id}><div className={styles.formGrid}>{['imageUrl', 'alt'].map(k => <TextField key={k} label={k === 'imageUrl' ? 'Image URL' : 'Photo description'} value={h[k]} onChange={v => setDraft({...draft,heroes:draft.heroes.map((x,j)=>j===i?{...x,[k]:v}:x)})} />)}<Field label="Hero title"><textarea value={h.title} maxLength={120} onChange={e=>setDraft({...draft,heroes:draft.heroes.map((x,j)=>j===i?{...x,title:e.target.value}:x)})}/></Field></div><Field label="Photo rotation"><select value={h.rotate} onChange={e => setDraft({
          ...draft,
          heroes: draft.heroes.map((x, j) => j === i ? {
            ...x,
            rotate: Number(e.target.value)
          } : x)
        })}><option value={0}>Normal</option><option value={180}>180° (original hero)</option></select></Field><div className={styles.inline}><button disabled={!i} onClick={() => {
          const heroes = [...draft.heroes];
          [heroes[i - 1], heroes[i]] = [heroes[i], heroes[i - 1]];
          setDraft({
            ...draft,
            heroes
          });
        }}>Move up</button><button disabled={draft.heroes.length === 1} onClick={() => setDraft({
          ...draft,
          heroes: draft.heroes.filter((_, j) => j !== i)
        })}>Remove</button></div></article>)}<button disabled={draft.heroes.length >= 6} onClick={() => setDraft({
      ...draft,
      heroes: [...draft.heroes, {
        id: crypto.randomUUID(),
        imageUrl: '',
        alt: '',
        title: 'Nail & beauty\ndesign library',
        rotate: 0
      }]
    })}>Add hero</button><h2>Featured LaQue designs</h2><Field label="Select designs for Explore"><select multiple value={featured.split(/\s+/).filter(Boolean)} onChange={e => setFeatured([...e.target.selectedOptions].map(x => x.value).join('\n'))}>{data.owned.map(d => <option key={d.id} value={d.id}>{d.title}{d.is_published ? '' : ' (draft)'}</option>)}</select></Field><Field label="Featured LaQue design IDs (one per line)"><textarea value={featured} onChange={e => setFeatured(e.target.value)} /></Field><h2>Updates announcements</h2>{draft.announcements.map((a, i) => <article key={a.id}><TextField label="Title" value={a.title} onChange={title => setDraft({
        ...draft,
        announcements: draft.announcements.map((a, j) => j === i ? {
          ...a,
          title
        } : a)
      })} /><Field label="Announcement"><textarea value={a.body} onChange={e => setDraft({
          ...draft,
          announcements: draft.announcements.map((a, j) => j === i ? {
            ...a,
            body: e.target.value
          } : a)
        })} /></Field><button onClick={() => setDraft({
        ...draft,
        announcements: draft.announcements.filter((_, j) => j !== i)
      })}>Remove announcement</button></article>)}<button disabled={draft.announcements.length >= 10} onClick={() => setDraft({
      ...draft,
      announcements: [...draft.announcements, {
        id: crypto.randomUUID(),
        title: '',
        body: ''
      }]
    })}>Add announcement</button><h2>Draft preview</h2><div className={styles.preview}>{draft.heroes.map(h => <article key={h.id}><img src={previews[h.imageUrl] || h.imageUrl || '/admin-assets/home-hero.png'} alt={h.alt} style={{
          transform: `rotate(${h.rotate}deg)`
        }} /><h3>{h.title}</h3></article>)}</div>{draft.announcements.map(a => <article key={a.id}><small>LaQue announcement</small><h3>{a.title}</h3><p>{a.body}</p></article>)}<div className={styles.inline}><button onClick={() => action('Save Home draft', 'home', {
        action: 'draft',
        version: data.version,
        content: {
          ...draft,
          featuredDesignIds: featured.split(/\s+/).filter(Boolean)
        }
      })}>Save draft</button><button onClick={() => action('Publish saved Home draft', 'home', {
        action: 'publish',
        version: data.version
      })}>Publish saved draft</button></div><p>Publish uses the saved draft. Unsaved changes shown above are not published.</p></section>;
}
function PinterestPanel({
  data,
  action
}) {
  return <><div className={styles.grid}><article><h2>{data.connection.account_name || 'Connect LaQue’s account'}</h2><p>{friendly(data.connection.status)} · display {data.connection.paused ? 'paused' : 'enabled'}</p><p>Access expires {date(data.connection.expires_at)}</p><p>{data.ready ? 'OAuth configured' : 'OAuth requires server setup'}</p><div className={styles.inline}><button disabled={!data.ready} onClick={() => action(data.connection.status === 'connected' ? 'Reconnect Pinterest' : 'Connect Pinterest', 'pinterest', {
            action: 'connect'
          })}>Connect / Reconnect</button><button disabled={data.connection.status !== 'connected'} onClick={() => action(data.connection.paused ? 'Enable Pinterest display' : 'Pause Pinterest display', 'pinterest', {
            action: 'pause',
            paused: !data.connection.paused
          })}>{data.connection.paused ? 'Enable display' : 'Pause display'}</button><button className={styles.danger} onClick={() => action('Disconnect Pinterest', 'pinterest', {
            action: 'disconnect'
          })}>Disconnect</button></div></article><article><h2>Request allowance</h2><p>{data.usage.day} / {data.usage.dayLimit} in 24 hours</p><p>{data.usage.minute} / {data.usage.minuteLimit} this minute</p><p>Oldest daily request resets {date(data.usage.dayReset)}</p><p>Provider pause until {date(data.usage.blockedUntil)}</p><small>Dashboard verification uses the same beta allowance. Counters cannot be reset here.</small></article></div><h2>Shared public boards</h2>{data.boards.map(b => <BoardForm key={b.topic + data.connection.version} board={b} action={action} />)}<p>Users browse LaQue’s shared collection without connecting a personal Pinterest account. Shared-board display requires Pinterest approval; this does not enable partner search.</p>{!data.oauthMode && <p className={styles.notice}>OAuth display has not been activated in the beta backend. The existing test-token adapter is still in use.</p>}</>;
}
function BoardForm({
  board,
  action
}) {
  const [id, setId] = useState(board.board_id),
    [label, setLabel] = useState(board.label);
  return <article className={styles.editor}><h3>{friendly(board.topic)}</h3><TextField label="Public board ID" value={id} onChange={setId} /><TextField label="LaQue topic label" value={label} onChange={setLabel} /><p>{board.active ? 'Active' : 'Inactive'} · last verified {date(board.verified_at)}</p><div className={styles.inline}><button onClick={() => action('Verify public visibility and activate board', 'pinterest', {
        action: 'board',
        topic: board.topic,
        boardId: id,
        label,
        active: true
      })}>Verify & activate</button><button onClick={() => action('Deactivate board', 'pinterest', {
        action: 'board',
        topic: board.topic,
        boardId: id,
        label,
        active: false
      })}>Deactivate</button></div></article>;
}
function ImageUpload({
  onUploaded
}) {
  const [file, setFile] = useState(null),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return <div className={styles.editor}><Field label="Upload photo (JPEG, PNG, WebP · 8 MB)"><input type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setFile(e.target.files[0])} /></Field><TextField label="Upload reason" value={reason} onChange={setReason} /><button type="button" disabled={busy || !file || reason.trim().length < 5} onClick={async () => {
      setBusy(true);
      setError('');
      try {
        const {
          data: {
            session
          }
        } = await supabase.auth.getSession();
        const body = new FormData();
        body.set('file', file);
        body.set('reason', reason);
        const r = await fetch('/api/admin/media', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session?.access_token}`
          },
          body
        });
        const result = await r.json();
        if (!r.ok) throw Error(result.error);
        onUploaded(result.url,result.previewUrl);
        setFile(null);
        setReason('');
      } catch (e) {
        setError(e.message);
      } finally {
        setBusy(false);
      }
    }}>{busy ? 'Uploading…' : 'Upload image'}</button>{error && <p role="alert">{error}</p>}</div>;
}
