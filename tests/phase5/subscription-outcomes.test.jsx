// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ sessionId: 'cs_first' }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams(`session_id=${mock.sessionId}&plan=premium`) }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session: { user: { id: 'checkout-owner' }, access_token: 'token' } } }) } } }))
import Success from '@/app/upgrade/success/page'
beforeEach(() => {
  vi.useFakeTimers()
  mock.sessionId = 'cs_first'
  vi.stubGlobal('fetch', vi.fn())
})
afterEach(cleanup)
it.each([
  ['expired', 'Checkout expired'], ['failed', 'Subscription payment failed'],
  ['canceled', 'Subscription canceled'], ['payment_required', 'Subscription needs attention'],
])('shows the final %s outcome and stops polling without claiming activation', async (status, heading) => {
  fetch.mockResolvedValue({ ok: true, json: async () => ({ status }) })
  await act(async () => render(<Success />))
  expect(screen.getByRole('heading', { name: heading })).toBeInTheDocument()
  expect(screen.queryByText(/subscription is now active/i)).not.toBeInTheDocument()
  expect(screen.queryByText(/Still finalizing/)).not.toBeInTheDocument()
  await act(async () => vi.advanceTimersByTimeAsync(15000))
  expect(fetch).toHaveBeenCalledTimes(1)
  if (status !== 'payment_required') expect(screen.getByRole('link', { name: 'Choose a plan' })).toHaveAttribute('href', '/upgrade')
})
it('navigating from a confirmed checkout to another session clears the former success', async () => {
  fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ status: 'fulfilled', planId: 'premium' }) })
  let view
  await act(async () => { view = render(<Success />) })
  expect(screen.getByText(/Subscription confirmed/)).toBeInTheDocument()
  mock.sessionId = 'cs_second'
  fetch.mockResolvedValue({ ok: true, json: async () => ({ status: 'pending' }) })
  await act(async () => view.rerender(<Success />))
  expect(screen.queryByText(/Subscription confirmed/)).not.toBeInTheDocument()
  expect(screen.queryByText(/subscription is now active/i)).not.toBeInTheDocument()
  expect(screen.getByText(/Confirming your subscription/)).toBeInTheDocument()
})
