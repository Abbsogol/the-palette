import { expect, it, vi } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { refreshDeletedAccountSession } from '@/lib/refresh-deleted-account-session'

const session = id => ({
  access_token: `access-${id}`, refresh_token: `refresh-${id}`, user: { id, aud: 'authenticated' },
  token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600,
})
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { resolve, promise } }
async function fixture() {
  const storageKey = 'phase6-deletion-auth'
  const values = new Map([[storageKey, JSON.stringify(session('a'))]])
  let gate = null
  const fetch = vi.fn(async (url, options) => {
    if (!String(url).includes('/auth/v1/token?grant_type=refresh_token')) throw new Error(`Unexpected Auth request: ${url}`)
    const refresh = JSON.parse(options.body).refresh_token
    if (refresh === 'refresh-a') return Response.json({ code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' }, { status: 400 })
    if (refresh === 'refresh-b') return Response.json(session('b'))
    throw new Error(`Unexpected refresh token: ${refresh}`)
  })
  const client = createClient('http://127.0.0.1:54321', 'offline-anon-key', {
    auth: {
      storageKey, autoRefreshToken: false, persistSession: true, detectSessionInUrl: false,
      storage: { getItem: key => values.get(key) || null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) },
      lock: async (_name, _timeout, work) => {
        if (gate) { const current = gate; gate = null; current.entered.resolve(); await current.release.promise }
        return work()
      },
    },
    global: { fetch },
  })
  await client.auth.getSession()
  return {
    auth: client.auth, fetch,
    switchAccount: id => values.set(storageKey, JSON.stringify(session(id))),
    pauseNextLock() { gate = { entered: deferred(), release: deferred() }; return gate },
  }
}

it('the installed Supabase SDK clears the deleted account session after the provider rejects its refresh token', async () => {
  const { auth, fetch } = await fixture()
  expect((await auth.getSession()).data.session.user.id).toBe('a')
  await refreshDeletedAccountSession(auth, 'a')
  expect((await auth.getSession()).data.session).toBeNull()
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(JSON.parse(fetch.mock.lastCall[1].body)).toEqual({ refresh_token: 'refresh-a' })
})

it('deletion cleanup queued behind the SDK lock refreshes and preserves the newly stored valid account', async () => {
  const { auth, fetch, pauseNextLock, switchAccount } = await fixture()
  const gate = pauseNextLock()
  const cleanup = refreshDeletedAccountSession(auth, 'a')
  await gate.entered.promise
  // Another tab completes sign-in while cleanup is still waiting for the
  // SDK lock. This is the real SDK and its storage read, not a mocked refresh.
  switchAccount('b')
  gate.release.resolve()
  await cleanup
  expect(JSON.parse(fetch.mock.lastCall[1].body)).toEqual({ refresh_token: 'refresh-b' })
  expect((await auth.getSession()).data.session.user.id).toBe('b')
  expect(fetch).toHaveBeenCalledTimes(1)
})
