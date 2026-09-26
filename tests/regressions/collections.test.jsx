// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { database, ok, user } from '../helpers/supabase'

const mocks = vi.hoisted(() => ({ client: {}, router: { push: vi.fn(), back: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({ supabase: mocks.client }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('session_id=cs-pending'), useRouter: () => mocks.router }))
import SaveToBoard from '@/components/SaveToBoard'
import BuyCreditsSuccessPage from '@/app/buy-credits/success/page'
import UpgradePage from '@/app/upgrade/page'

beforeEach(() => {
  Object.assign(mocks.client, database(q => {
    if (q.table === 'moodboards') return ok([{ id: 'board-a', name: 'Bridal looks', cover_image_url: null }])
    if (q.table === 'moodboard_designs') return ok([])
    if (q.table === 'profiles') return ok({ credit_balance: 0 })
    throw new Error(`Unexpected query: ${q.table}`)
  }))
  mocks.client.auth = { getUser: vi.fn(async () => ({ data: { user } })), getSession: vi.fn(async () => ({ data: { session: { user, access_token: 'test-token' } } })) }
})
afterEach(cleanup)

it('the component-owned board trigger loads existing boards', async () => {
  await act(async () => { render(<SaveToBoard designId="design-a" />) })
  fireEvent.click(screen.getByTitle('Save to board'))
  expect(await screen.findByText('Bridal looks')).toBeInTheDocument()
})

it('REG-07: a parent-controlled board sheet loads existing boards after authentication', async () => {
  await act(async () => {
    render(<SaveToBoard externalOpen designId="design-a" onClose={() => {}} />)
  })
  expect(await screen.findByText('Bridal looks')).toBeInTheDocument()
})

it('REG-09: an unchanged balance cannot complete a still-pending checkout', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'pending' }) })))
  await act(async () => { render(<BuyCreditsSuccessPage />) })
  await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
  expect(screen.getByText(/Confirming your balance/)).toBeInTheDocument()
  expect(screen.queryByText('Credits added ✦')).not.toBeInTheDocument()
  expect(fetch).toHaveBeenCalledTimes(2)
})

it('shows checkout success only when the server confirms fulfillment', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ status: 'fulfilled', creditBalance: 15 }) })))
  await act(async () => { render(<BuyCreditsSuccessPage />) })
  expect(screen.getByText('Credits added ✦')).toBeInTheDocument()
  expect(screen.getByText('15')).toBeInTheDocument()
  expect(screen.queryByText(/Confirming your balance/)).not.toBeInTheDocument()
})

it('a checkout status outage times out without claiming a purchase succeeded', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('Status unavailable') }))
  await act(async () => { render(<BuyCreditsSuccessPage />) })
  await act(async () => { await vi.advanceTimersByTimeAsync(12_000) })
  expect(screen.getByText(/Still finalizing/)).toBeInTheDocument()
  expect(screen.queryByText('Credits added ✦')).not.toBeInTheDocument()
})

it('loads a controlled board sheet after delayed authentication', async () => {
  let resolveUser
  mocks.client.auth.getUser.mockReturnValue(new Promise(resolve => { resolveUser = resolve }))
  render(<SaveToBoard externalOpen designId="design-a" onClose={() => {}} />)
  await act(async () => { resolveUser({ data: { user } }) })
  expect(await screen.findByText('Bridal looks')).toBeInTheDocument()
})

it('existing subscribers can open billing management without starting a second checkout', async () => {
  Object.assign(mocks.client, database(() => ok({ id: user.id, account_type: 'creator', subscription_tier: 'premium' })))
  vi.spyOn(window, 'alert').mockImplementation(() => {})
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'Billing temporarily unavailable' }) })))
  await act(async () => { render(<UpgradePage />) })
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Manage subscription' })) })
  expect(fetch).toHaveBeenCalledTimes(1)
  expect(fetch).toHaveBeenCalledWith('/api/create-billing-portal-session', expect.objectContaining({ method: 'POST' }))
  expect(window.alert).toHaveBeenCalledWith('Billing temporarily unavailable')
})
