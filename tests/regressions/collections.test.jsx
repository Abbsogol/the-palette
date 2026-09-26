// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { database, ok, user } from '../helpers/supabase'

const mocks = vi.hoisted(() => ({ client: {} }))
vi.mock('@/lib/supabase', () => ({ supabase: mocks.client }))
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('session_id=cs-pending') }))
import SaveToBoard from '@/components/SaveToBoard'
import BuyCreditsSuccessPage from '@/app/buy-credits/success/page'

beforeEach(() => {
  Object.assign(mocks.client, database(q => {
    if (q.table === 'moodboards') return ok([{ id: 'board-a', name: 'Bridal looks', cover_image_url: null }])
    if (q.table === 'moodboard_designs') return ok([])
    if (q.table === 'profiles') return ok({ credit_balance: 0 })
    throw new Error(`Unexpected query: ${q.table}`)
  }))
  mocks.client.auth = { getUser: vi.fn(async () => ({ data: { user } })) }
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
  await act(async () => { render(<BuyCreditsSuccessPage />) })
  await act(async () => { await vi.advanceTimersByTimeAsync(1600) })
  expect(screen.getByText(/Confirming your balance/)).toBeInTheDocument()
})
