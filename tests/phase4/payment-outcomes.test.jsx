// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: async () => ({ data: { session: { access_token: 'test-only' } } }) } } }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('session_id=cs_purchase&booking=booking') }))
import Credits from '@/app/buy-credits/success/page'
import Deposit from '@/app/appointments/deposit-success/page'
beforeEach(() => { vi.useFakeTimers() })
afterEach(cleanup)
it.each([
  ['refund_recorded', 'Refund recorded'], ['failed', 'Payment failed'], ['expired', 'Checkout expired'],
])('P4-07/08: credit checkout displays %s without claiming credits were added', async (status, heading) => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status, ...(status === 'refund_recorded' ? { creditBalance: 0 } : {}) })))
  await act(async () => render(<Credits />))
  expect(screen.getByRole('heading', { name: heading })).toBeVisible()
  expect(screen.queryByText('Credits added ✦')).not.toBeInTheDocument()
  await act(async () => vi.advanceTimersByTimeAsync(15000))
  expect(fetch).toHaveBeenCalledTimes(1)
})
it.each([['failed', 'Deposit payment failed'], ['expired', 'Checkout expired']])('P4-07: deposit checkout displays terminal %s and stops polling', async (status, heading) => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status })))
  await act(async () => render(<Deposit />))
  expect(screen.getByRole('heading', { name: heading })).toBeVisible()
  expect(screen.queryByText('Deposit paid ✦')).not.toBeInTheDocument()
  await act(async () => vi.advanceTimersByTimeAsync(15000))
  expect(fetch).toHaveBeenCalledTimes(1)
})
