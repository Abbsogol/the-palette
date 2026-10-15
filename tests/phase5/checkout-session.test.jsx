// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ session: null, callbacks: new Set(), getSession: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: {
  getSession: mock.getSession,
  onAuthStateChange: callback => { mock.callbacks.add(callback); return { data: { subscription: { unsubscribe: () => mock.callbacks.delete(callback) } } } },
} } }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('session_id=cs_purchase&booking=booking-a') }))
import Credits from '@/app/buy-credits/success/page'
import Deposit from '@/app/appointments/deposit-success/page'
import Subscription from '@/app/upgrade/success/page'
const cases = [
  ['credits', Credits, 'Credits added ✦'],
  ['deposit', Deposit, 'Deposit paid ✦'],
  ['subscription', Subscription, 'Welcome to Laque Premium ✦'],
]
const session = id => ({ user: { id }, access_token: `token-${id}` })
const fulfilled = () => Response.json({ status: 'fulfilled', creditBalance: 73, planId: 'premium' })
const change = async next => {
  mock.session = next
  await act(async () => { for (const callback of mock.callbacks) callback(next ? 'SIGNED_IN' : 'SIGNED_OUT', next) })
}
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks(); mock.callbacks.clear(); mock.session = session('a')
  mock.getSession.mockImplementation(async () => ({ data: { session: mock.session } }))
  vi.stubGlobal('fetch', vi.fn(async () => fulfilled()))
})
afterEach(cleanup)

it.each(cases)('%s checkout removes the saved payment result immediately on logout', async (_name, Page, heading) => {
  await act(async () => render(<Page />))
  expect(screen.getByRole('heading', { name: heading })).toBeVisible()
  await change(null)
  expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument()
  expect(screen.queryByText('73')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/profile')
  await act(async () => vi.advanceTimersByTimeAsync(15000))
  expect(fetch).toHaveBeenCalledTimes(1)
})

it.each(cases)('%s checkout rejects the old account result after a new account signs in', async (_name, Page, heading) => {
  let finish
  fetch.mockImplementation((_url, options) => options.headers.Authorization === 'Bearer token-a'
    ? new Promise(resolve => { finish = resolve }) : Promise.resolve(Response.json({ status: 'pending' })))
  await act(async () => render(<Page />))
  await change(session('b'))
  await act(async () => finish(fulfilled()))
  expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument()
  expect(screen.queryByText('73')).not.toBeInTheDocument()
  expect(fetch.mock.calls.some(([, options]) => options.headers.Authorization === 'Bearer token-b')).toBe(true)
})

it.each(cases)('%s checkout does not restore a late initial session after logout', async (_name, Page, heading) => {
  let finish
  mock.getSession.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
  await act(async () => render(<Page />))
  await change(null)
  await act(async () => finish({ data: { session: session('a') } }))
  expect(screen.queryByRole('heading', { name: heading })).not.toBeInTheDocument()
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.getByRole('link', { name: 'Sign in' })).toBeVisible()
})

it('a same-account token refresh preserves its confirmed balance without repeating checkout lookup', async () => {
  await act(async () => render(<Credits />))
  await act(async () => { for (const callback of mock.callbacks) callback('TOKEN_REFRESHED', { ...session('a'), access_token: 'refreshed-a' }) })
  expect(screen.getByText('73')).toBeVisible()
  expect(fetch).toHaveBeenCalledTimes(1)
})
