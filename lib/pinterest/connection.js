import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { AdminError, adminIdentity } from '@/lib/admin/auth';
const scopes = ['boards:read', 'pins:read', 'user_accounts:read'];
const hash = s => createHash('sha256').update(s).digest('hex');
const COOKIE = 'laque_pinterest_oauth';
export function oauthConfiguration() {
  const {
    PINTEREST_APP_ID: id,
    PINTEREST_APP_SECRET: secret,
    PINTEREST_REDIRECT_URI: redirect,
    PINTEREST_TOKEN_KEY: key
  } = process.env;
  let url;
  try {
    url = new URL(redirect);
  } catch {}
  if (!/^\d+$/.test(id || '') || !secret || Buffer.from(key || '', 'base64').length !== 32 || !url || url.protocol !== 'https:' || url.pathname !== '/api/pinterest/oauth/callback' || url.search || url.hash || url.username || url.password) throw new AdminError('Pinterest OAuth needs server configuration.', 503, 'PINTEREST_SETUP');
  return {
    id,
    secret,
    redirect,
    key: Buffer.from(key, 'base64')
  };
}
export function sealToken(value) {
  const c = oauthConfiguration();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', c.key, iv);
  cipher.setAAD(Buffer.from('laque-pinterest-v1'));
  const data = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
}
export function openToken(value) {
  const b = Buffer.from(value, 'base64');
  const d = createDecipheriv('aes-256-gcm', oauthConfiguration().key, b.subarray(0, 12));
  d.setAAD(Buffer.from('laque-pinterest-v1'));
  d.setAuthTag(b.subarray(12, 28));
  return Buffer.concat([d.update(b.subarray(28)), d.final()]).toString('utf8');
}
async function checked(r) {
  const {
    data,
    error
  } = await r;
  if (error) throw new AdminError('Pinterest connection is unavailable.', 503);
  return data;
}
async function change(db, identity, action, reason, data) {
  return checked(db.rpc('pinterest_admin_change', {
    p_actor: identity.user.id,
    p_action: action,
    p_reason: reason,
    p_data: data
  }));
}
export async function exchange(db, actor, body) {
  const c = oauthConfiguration();
  await reserve(db, actor);
  let r;
  try {
    r = await fetch('https://api.pinterest.com/v5/oauth/token', {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${c.id}:${c.secret}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams(body),
      redirect: 'error',
      cache: 'no-store',
      signal: AbortSignal.timeout(12000)
    });
  } catch {
    throw new AdminError('Pinterest could not be reached. Retry later.', 503, 'PINTEREST_RETRY');
  }
  if (!r.ok) throw new AdminError('Pinterest authorization could not be completed. Reconnect your account.', r.status === 429 ? 429 : 503, [400, 401, 403].includes(r.status) ? 'PINTEREST_RECONNECT' : 'PINTEREST_RETRY');
  const data = await r.json();
  if (typeof data.access_token !== 'string' || !Number.isInteger(data.expires_in) || data.expires_in < 60 || typeof data.refresh_token !== 'string' || !scopes.every(s => data.scope?.split(/[ ,]+/).includes(s))) throw new AdminError('Pinterest did not grant the required read permissions.', 503, 'PINTEREST_RECONNECT');
  return {
    access: sealToken(data.access_token),
    refresh: sealToken(data.refresh_token),
    expires: new Date(Date.now() + data.expires_in * 1000).toISOString(),
    refreshExpires: new Date(data.refresh_token_expires_at ? data.refresh_token_expires_at * 1000 : Date.now() + (data.refresh_token_expires_in || 5184000) * 1000).toISOString(),
    token: data.access_token
  };
}
export async function connectedToken(db) {
  let c = await checked(db.from('pinterest_connection').select('*').single());
  if (c.status !== 'connected') throw new AdminError('Pinterest needs to be connected.', 503, 'PINTEREST_ACCESS');
  if (Date.parse(c.expires_at) > Date.now() + 300000) return {
    token: openToken(c.access_cipher),
    connection: c
  };
  const lease = await checked(db.rpc('claim_pinterest_refresh'));
  if (!lease) throw new AdminError('Pinterest connection is being refreshed. Try again shortly.', 503, 'PINTEREST_RETRY');
  try {
    if (!(Date.parse(c.refresh_expires_at) > Date.now())) throw new AdminError('Reconnect Pinterest.', 503, 'PINTEREST_RECONNECT');
    const updated = await exchange(db, c.connected_by, {
      grant_type: 'refresh_token',
      refresh_token: openToken(c.refresh_cipher),
      scope: scopes.join(',')
    });
    const ok = await checked(db.rpc('finish_pinterest_refresh', {
      p_lease: lease,
      p_data: updated
    }));
    if (!ok) throw new AdminError('Pinterest connection changed. Reload.', 409);
    c = await checked(db.from('pinterest_connection').select('*').single());
    return {
      token: updated.token,
      connection: c
    };
  } catch (e) {
    await db.rpc('finish_pinterest_refresh', {
      p_lease: lease,
      p_data: {
        status: e.code === 'PINTEREST_RECONNECT' ? 'reconnect' : 'retry'
      }
    });
    throw e;
  }
}
async function reserve(db, actor, count = 1) {
  const limit = (name, ceiling, fallback) => {
    const value = Number(process.env[name] || fallback);
    if (!Number.isInteger(value) || value < 1 || value > ceiling) throw new AdminError('Pinterest allowance configuration is unavailable.', 503, 'PINTEREST_SETUP');
    return value;
  };
  const r = await checked(db.rpc('reserve_pinterest_request_batch', {
    p_user_id: actor,
    p_day_limit: limit('PINTEREST_DAILY_LIMIT', 100, 100),
    p_minute_limit: limit('PINTEREST_MINUTE_LIMIT', 5, 5),
    p_user_limit: limit('PINTEREST_USER_DAILY_LIMIT', 30, 10),
    p_request_count: count
  }));
  if (!r?.allowed) {
    const e = new AdminError('Pinterest requests are paused. Retry when the allowance resets.', 429, 'PINTEREST_BUDGET');
    e.retryAt = Number.isFinite(Date.parse(r?.retryAt)) ? new Date(r.retryAt).toISOString() : null;
    throw e;
  }
}
export async function invalidateConnectedToken(db, token) {
  const c = await checked(db.from('pinterest_connection').select('access_cipher,status').single());
  if (c.status !== 'connected' || !c.access_cipher || openToken(c.access_cipher) !== token) return;
  // A late rejected request cannot erase a token installed by a newer refresh.
  await checked(db.from('pinterest_connection').update({
    status: 'reconnect',
    paused: true,
    access_cipher: null,
    refresh_cipher: null,
    lease_token: null,
    lease_until: null
  }).eq('access_cipher', c.access_cipher).eq('status', 'connected'));
}
async function read(db, actor, token, path) {
  await reserve(db, actor);
  const r = await fetch('https://api.pinterest.com/v5/' + path, {
    headers: {
      Authorization: `Bearer ${token}`
    },
    cache: 'no-store',
    redirect: 'error',
    signal: AbortSignal.timeout(10000)
  });
  if (r.status === 429) {
    await db.rpc('pause_pinterest_requests', {
      p_seconds: Math.min(Math.max(Number(r.headers.get('retry-after')) || 60, 1), 604800)
    });
    throw new AdminError('Pinterest requests are temporarily paused.', 429, 'PINTEREST_BUDGET');
  }
  if (r.status === 401) {
    await invalidateConnectedToken(db, token);
    throw new AdminError('Pinterest access was revoked. Reconnect your account.', 503, 'PINTEREST_RECONNECT');
  }
  if (!r.ok) throw new AdminError('Pinterest access or visibility could not be verified.', 503, 'PINTEREST_ACCESS');
  return r.json();
}
export async function pinterestAdminGet(db) {
  const c = await checked(db.from('pinterest_connection').select('status,paused,expires_at,refresh_expires_at,account_name,version').single());
  const since = new Date(Date.now() - 86400000).toISOString();
  const usage = await checked(db.from('pinterest_request_usage').select('requested_at').gt('requested_at', since).order('requested_at'));
  const gate = await checked(db.from('pinterest_request_gate').select('blocked_until').single());
  let ready = true;
  try {
    oauthConfiguration();
  } catch {
    ready = false;
  }
  return {
    connection: c,
    boards: await checked(db.from('pinterest_boards').select('topic,board_id,label,active,verified_at')),
    ready,
    usage: {
      day: usage.length,
      dayLimit: Number(process.env.PINTEREST_DAILY_LIMIT || 100),
      minute: usage.filter(x => Date.parse(x.requested_at) > Date.now() - 60000).length,
      minuteLimit: Number(process.env.PINTEREST_MINUTE_LIMIT || 5),
      blockedUntil: gate.blocked_until,
      dayReset: usage.length ? new Date(Date.parse(usage[0].requested_at) + 86400000).toISOString() : null
    },
    approval: process.env.PINTEREST_SOURCE_APPROVED === '1',
    oauthMode: process.env.PINTEREST_OAUTH_MODE === '1'
  };
}
export async function pinterestAdminPost(db, identity, body, request) {
  if (typeof body.reason !== 'string' || body.reason.trim().length < 5 || body.reason.length > 1000) throw new AdminError('Enter a reason for this change.');
  if (body.action === 'connect') {
    const c = oauthConfiguration();
    const state = randomBytes(32).toString('base64url');
    const browser = randomBytes(32).toString('base64url');
    await change(db, identity, 'start', body.reason, {
      stateHash: hash(state),
      browserHash: hash(browser)
    });
    const u = new URL('https://www.pinterest.com/oauth/');
    u.search = new URLSearchParams({
      client_id: c.id,
      redirect_uri: c.redirect,
      response_type: 'code',
      scope: scopes.join(','),
      state
    }).toString();
    const value = sealToken(JSON.stringify({
      browser,
      token: request.headers.get('authorization').slice(7)
    }));
    return {
      authorizationUrl: u.href,
      cookie: `${COOKIE}=${encodeURIComponent(value)}; Path=/api/pinterest/oauth/callback; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
    };
  }
  if (body.action === 'disconnect' || body.action === 'pause') {
    if (body.action === 'pause' && typeof body.paused !== 'boolean') throw new AdminError('Invalid pause state.');
    return change(db, identity, body.action, body.reason, {
      paused: body.paused
    });
  }
  if (body.action === 'board') {
    if (!['minimal', 'halloween'].includes(body.topic) || !/^\d{1,30}$/.test(body.boardId || '') || typeof body.label !== 'string' || !body.label.trim() || body.label.length > 80 || typeof body.active !== 'boolean') throw new AdminError('Check the board ID, topic and label.');
    const {
      token,
      connection
    } = await connectedToken(db);
    if (body.active) {
      const board = await read(db, identity.user.id, token, `boards/${body.boardId}`);
      if (String(board.id) !== body.boardId || board.privacy !== 'PUBLIC') throw new AdminError('Only verified public boards can be activated.');
    }
    return change(db, identity, 'board', body.reason, {
      topic: body.topic,
      boardId: body.boardId,
      label: body.label.trim(),
      active: body.active,
      version: connection.version
    });
  }
  throw new AdminError('Invalid Pinterest action.');
}
export async function completeOAuth(db, request) {
  const u = new URL(request.url);
  const state = u.searchParams.get('state');
  if (!/^[A-Za-z0-9_-]{43}$/.test(state || '')) throw new AdminError('This connection attempt is invalid or expired.');
  const raw = request.headers.get('cookie')?.split('; ').find(x => x.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1);
  let value;
  try {
    value = JSON.parse(openToken(decodeURIComponent(raw)));
  } catch {
    throw new AdminError('Use the same browser that started the connection.');
  }
  const identity = await adminIdentity(new Request(request.url, {
    headers: {
      authorization: `Bearer ${value.token}`
    }
  }));
  if (identity.role !== 'owner') throw new AdminError('Owner access is required.', 403);
  const attempt = await checked(db.rpc('claim_pinterest_oauth', {
    p_state: hash(state),
    p_browser: hash(value.browser),
    p_owner: identity.user.id
  }));
  if (!attempt) throw new AdminError('This attempt expired or has already been used.');
  if (u.searchParams.has('error')) throw new AdminError('Pinterest connection was declined. You can start again from the dashboard.');
  const code = u.searchParams.get('code');
  if (!code || code.length > 2048) throw new AdminError('Pinterest did not provide an authorization code.');
  const c = oauthConfiguration();
  const tokens = await exchange(db, identity.user.id, {
    grant_type: 'authorization_code',
    code,
    redirect_uri: c.redirect
  });
  const account = await read(db, identity.user.id, tokens.token, 'user_account');
  if (account.account_type !== 'BUSINESS') throw new AdminError('Connect LaQue’s Pinterest business account.');
  await change(db, identity, 'complete', attempt.reason, {
    ...tokens,
    token: undefined,
    account: String(account.username || 'LaQue').slice(0, 100),
    stateHash: hash(state)
  });
}
export async function sharedConfiguration(db, topic) {
  const initial = await checked(db.from('pinterest_connection').select('paused').single());
  if (initial.paused) throw new AdminError('Pinterest display is paused.', 503, 'PINTEREST_ACCESS');
  const {
    token,
    connection
  } = await connectedToken(db);
  if (connection.paused) throw new AdminError('Pinterest display is paused.', 503, 'PINTEREST_ACCESS');
  const board = await checked(db.from('pinterest_boards').select('board_id,active,connection_version').eq('topic', topic === 'halloween' ? 'halloween' : 'minimal').single());
  if (!board.active || board.connection_version !== connection.version) throw new AdminError('Pinterest’s public board needs verification.', 503, 'PINTEREST_ACCESS');
  return {
    PINTEREST_ACCESS_TOKEN: token,
    PINTEREST_TOKEN_EXPIRES_AT: connection.expires_at,
    PINTEREST_SOURCE: 'board',
    PINTEREST_BOARD_ID: board.board_id,
    PINTEREST_HALLOWEEN_BOARD_ID: board.board_id
  };
}
