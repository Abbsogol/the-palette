// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { database, ok } from '../helpers/supabase'
const mock = vi.hoisted(() => ({ client: {}, params: { id: 'board-a' }, router: { push: vi.fn() }, change: null, signedIn: true }))
vi.mock('@/lib/supabase', () => ({ supabase: mock.client }))
vi.mock('next/navigation', () => ({ useRouter: () => mock.router, useParams: () => mock.params }))
import Board from '@/app/moodboards/[id]/page'
import Boards from '@/app/moodboards/page'
beforeEach(() => {
  mock.change = null; mock.signedIn = true; mock.params = { id: 'board-a' }
  Object.assign(mock.client, database(q => {
    if (q.table === 'moodboards') return ok(mock.signedIn ? { id: 'board-a', name: 'Private wedding ideas', user_id: 'owner', is_public: false } : null)
    if (q.table === 'profiles') return ok({ display_name: 'Owner' })
    return ok([])
  }))
  mock.client.auth = {
    getSession: vi.fn(async () => ({ data: { session: { user: { id: 'owner' } } } })),
    onAuthStateChange: vi.fn(callback => { mock.change = callback; return { data: { subscription: { unsubscribe: vi.fn() } } } }),
  }
})
afterEach(cleanup)
it('P4-06: signing out removes previously loaded private board contents', async () => {
  await act(async () => render(<Board />))
  expect(screen.getByText('Private wedding ideas')).toBeVisible()
  mock.signedIn = false
  await act(async () => mock.change?.('SIGNED_OUT', null))
  expect(screen.queryByText('Private wedding ideas')).not.toBeInTheDocument()
})
it('P4-06: a late private-board response cannot restore content after logout', async () => {
  let resolveBoard
  const pending = new Promise(resolve => { resolveBoard = resolve })
  mock.client.from = database(q => q.table === 'moodboards' && mock.signedIn ? pending : ok(null)).from
  await act(async () => render(<Board />))
  mock.signedIn = false
  await act(async () => mock.change('SIGNED_OUT', null))
  await act(async () => resolveBoard(ok({ id: 'board-a', name: 'Private wedding ideas', user_id: 'owner', is_public: false })))
  expect(screen.queryByText('Private wedding ideas')).not.toBeInTheDocument()
})
it('P4-06: logout also removes private names and covers from the board list', async () => {
  mock.client.from = database(q => ok(q.table === 'moodboards' ? [{ id: 'board-a', name: 'Private wedding ideas' }] : [])).from
  await act(async () => render(<Boards />))
  expect(screen.getByText('Private wedding ideas')).toBeVisible()
  await act(async () => mock.change('SIGNED_OUT', null))
  expect(screen.queryByText('Private wedding ideas')).not.toBeInTheDocument()
  expect(screen.getByText(/Sign in to create and view your boards/)).toBeVisible()
})
