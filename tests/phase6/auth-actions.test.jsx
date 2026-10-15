// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { database, ok } from '../helpers/supabase'
const mock = vi.hoisted(() => ({ client: {}, session: null, callbacks: new Set(), router: { push: vi.fn(), back: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({ supabase: mock.client }))
vi.mock('next/navigation', () => ({ useRouter: () => mock.router }))
import Credits from '@/app/buy-credits/page'
import Upgrade from '@/app/upgrade/page'
import DeleteAccount from '@/components/DeleteAccountButton'
const session = id => ({ user: { id, email: `${id}@example.test` }, access_token: `token-${id}` })
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done }); return { resolve, promise } }
const actions = [
  ['credits', Credits, /Buy 5 credits/, '/api/create-checkout-session'],
  ['subscription', Upgrade, 'Get Premium', '/api/create-subscription'],
  ['billing', Upgrade, 'Manage subscription', '/api/create-billing-portal-session'],
]
beforeEach(() => {
  vi.clearAllMocks(); mock.callbacks.clear(); mock.session = session('a'); window.history.replaceState({}, '', '/')
  Object.assign(mock.client, database(q => {
    if (q.table !== 'profiles') throw new Error(`Unexpected table ${q.table}`)
    return ok({ id: q.filters[0][2], display_name: 'Account', account_type: 'creator', credit_balance: 73, subscription_tier: null, stripe_customer_id: 'cus_a' })
  }))
  mock.client.auth = {
    getSession: vi.fn(async () => ({ data: { session: mock.session } })),
    getUser: vi.fn(async () => ({ data: { user: mock.session?.user || null } })),
    onAuthStateChange: callback => { mock.callbacks.add(callback); return { data: { subscription: { unsubscribe: () => mock.callbacks.delete(callback) } } } },
    signOut: vi.fn(async () => ({ error: null })),
    refreshSession: vi.fn(async () => ({ data: { session: null }, error: { code: 'refresh_token_not_found' } })),
  }
  vi.stubGlobal('confirm', vi.fn(() => true)); vi.stubGlobal('alert', vi.fn())
  vi.stubGlobal('fetch', vi.fn(async url => Response.json(url === '/api/delete-account' ? { ok: true } : { url: '#checkout-a' })))
})
afterEach(cleanup)
const changeSession = async next => {
  mock.session = next
  await act(async () => { for (const callback of mock.callbacks) callback(next ? 'SIGNED_IN' : 'SIGNED_OUT', next) })
}

it.each(actions)('%s action never uses the new account token with the previous account form', async (_name, Page, button) => {
  await act(async () => render(<Page />))
  mock.session = session('b')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: button })))
  expect(fetch).not.toHaveBeenCalled()
  expect(window.location.hash).toBe('')
})

it.each(actions)('%s response cannot redirect a newly signed-in account', async (_name, Page, button) => {
  const pending = deferred(); fetch.mockReturnValueOnce(pending.promise)
  await act(async () => render(<Page />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: button })))
  await changeSession(session('b'))
  await act(async () => pending.resolve(Response.json({ url: '#checkout-a' })))
  expect(window.location.hash).toBe('')
})

it('the credits page immediately removes its private balance on logout', async () => {
  await act(async () => render(<Credits />))
  expect(screen.getByText('73 credits')).toBeVisible()
  await changeSession(null)
  expect(screen.queryByText('73 credits')).not.toBeInTheDocument()
})

it('subscription choices cannot create concurrent checkout and billing operations', async () => {
  const pending = deferred(); fetch.mockReturnValue(pending.promise)
  await act(async () => render(<Upgrade />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Get Premium' })))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Get Pro Creator' })))
  expect(fetch).toHaveBeenCalledTimes(1)
  await act(async () => pending.resolve(Response.json({ error: 'Please retry' }, { status: 503 })))
})

it('deletion confirmation for account A cannot delete account B after a session switch', async () => {
  await act(async () => render(<DeleteAccount userId="a" />))
  mock.session = session('b')
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete account' })))
  expect(fetch).not.toHaveBeenCalled()
  expect(mock.client.auth.signOut).not.toHaveBeenCalled()
})

it('a delayed deletion response never signs out a newly signed-in account', async () => {
  const pending = deferred(); fetch.mockReturnValueOnce(pending.promise)
  await act(async () => render(<DeleteAccount userId="a" />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete account' })))
  await changeSession(session('b'))
  await act(async () => pending.resolve(Response.json({ ok: true })))
  expect(mock.client.auth.signOut).not.toHaveBeenCalled()
  expect(mock.client.auth.refreshSession).not.toHaveBeenCalled()
})

it.each(actions)('%s ignores a late session read after A switches to B and back to A', async (_name, Page, button) => {
  await act(async () => render(<Page />))
  const pending = deferred(); mock.client.auth.getSession.mockReturnValueOnce(pending.promise)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: button })))
  await changeSession(session('b'))
  await changeSession(session('a'))
  await act(async () => pending.resolve({ data: { session: session('a') } }))
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.getByRole('button', { name: button })).toBeEnabled()
})

it.each(actions)('%s errors release the pending action and allow a successful retry', async (_name, Page, button, endpoint) => {
  fetch.mockResolvedValueOnce(Response.json({ error: 'Temporarily unavailable' }, { status: 503 }))
  await act(async () => render(<Page />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: button })))
  expect(alert).toHaveBeenCalledWith('Temporarily unavailable')
  expect(screen.getByRole('button', { name: button })).toBeEnabled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: button })))
  expect(fetch.mock.calls.map(([url]) => url)).toEqual([endpoint, endpoint])
  expect(window.location.hash).toBe('#checkout-a')
})

it('deletion cannot proceed after its session lookup is delayed across an account change', async () => {
  await act(async () => render(<DeleteAccount userId="a" />))
  const pending = deferred(); mock.client.auth.getSession.mockReturnValueOnce(pending.promise)
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Delete account' })))
  await changeSession(session('b'))
  await act(async () => pending.resolve({ data: { session: session('b') } }))
  expect(fetch).not.toHaveBeenCalled()
  expect(mock.client.auth.refreshSession).not.toHaveBeenCalled()
})

it('a same-account token refresh does not cancel an authorized purchase', async () => {
  const pending = deferred(); fetch.mockReturnValueOnce(pending.promise)
  await act(async () => render(<Credits />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Buy 5 credits/ })))
  mock.session = { ...session('a'), access_token: 'refreshed-a' }
  await act(async () => { for (const callback of mock.callbacks) callback('TOKEN_REFRESHED', mock.session) })
  await act(async () => pending.resolve(Response.json({ url: '#authorized-checkout' })))
  expect(window.location.hash).toBe('#authorized-checkout')
})
