// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ params: new URLSearchParams() }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session: { user: { id: 'checkout-owner' }, access_token: 'test-only' } } }) } } }))
vi.mock('next/navigation', () => ({ useSearchParams: () => mock.params }))
import Credits from '@/app/buy-credits/success/page'
import Deposit from '@/app/appointments/deposit-success/page'
beforeEach(() => { vi.useFakeTimers(); mock.params = new URLSearchParams('session_id=cs_first&booking=booking-one') })
afterEach(cleanup)
it.each([['refund_pending','Refund in progress'],['payment_review','Payment needs review']])('credits displays %s without promising a completed refund or purchase', async (status,heading) => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ status, creditBalance: 10 })))
  await act(async () => render(<Credits />))
  expect(screen.getByRole('heading', {name:heading})).toBeVisible()
  expect(screen.queryByText('Credits added ✦')).not.toBeInTheDocument()
  expect(screen.queryByText('Refund recorded')).not.toBeInTheDocument()
})
it('deposit page removes the old success while a different booking is still pending', async () => {
  vi.stubGlobal('fetch', vi.fn(async url => Response.json({status: url.includes('cs_first') ? 'fulfilled':'pending'})))
  let rendered
  await act(async () => { rendered = render(<Deposit />) })
  expect(screen.getByRole('heading',{name:'Deposit paid ✦'})).toBeVisible()
  mock.params=new URLSearchParams('session_id=cs_second&booking=booking-two')
  await act(async () => rendered.rerender(<Deposit />))
  expect(screen.queryByRole('heading',{name:'Deposit paid ✦'})).not.toBeInTheDocument()
})
it('pending refund copy does not falsely say an ordinary confirmed booking was cancelled', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({status:'refund_pending'})))
  await act(async () => render(<Deposit />))
  expect(screen.getByRole('heading',{name:'Refund in progress'})).toBeVisible()
  expect(screen.queryByText(/This booking was cancelled or declined/)).not.toBeInTheDocument()
})
