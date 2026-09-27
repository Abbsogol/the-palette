// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ auth: { getSession: vi.fn(), onAuthStateChange: vi.fn() }, generate: vi.fn(), change: null }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: mock.auth } }))
vi.mock('@/lib/generation-request', () => ({ requestGeneration: mock.generate, hasPendingGeneration: () => false }))
vi.mock('@/components/SaveToBoard', () => ({ default: () => null }))
import NailLab from '@/app/nail-lab/page'
const session = id => ({ user: { id }, access_token: `token-${id}` })
const result = id => ({ generationId: id, imageUrl: `https://example.invalid/private-${id}.png`, creditsRemaining: 4 })
beforeEach(() => {
  vi.clearAllMocks(); mock.change = null
  mock.auth.getSession.mockResolvedValue({ data: { session: session('A') } })
  mock.auth.onAuthStateChange.mockImplementation(callback => { mock.change = callback; return { data: { subscription: { unsubscribe: vi.fn() } } } })
  mock.generate.mockResolvedValue(result('A'))
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ creditsRemaining: 5 })))
  window.scrollTo = vi.fn()
})
afterEach(cleanup)
async function generate() {
  await act(async () => render(<NailLab />))
  for (const name of ['Minimal', 'Stiletto', 'Short']) fireEvent.click(screen.getByRole('button', { name, exact: true }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate ✦' })))
}
it('private generated image disappears immediately after logout', async () => {
  await generate()
  expect(screen.getByAltText('Generated nail design')).toHaveAttribute('src', result('A').imageUrl)
  await act(async () => mock.change?.('SIGNED_OUT', null))
  expect(screen.queryByAltText('Generated nail design')).not.toBeInTheDocument()
  expect(screen.getByText('Sign in to generate custom nail designs with AI.')).toBeVisible()
})
it('a delayed generation result cannot appear after switching accounts', async () => {
  let finish
  mock.generate.mockReturnValue(new Promise(resolve => { finish = resolve }))
  await generate()
  mock.auth.getSession.mockResolvedValue({ data: { session: session('B') } })
  await act(async () => mock.change?.('SIGNED_IN', session('B')))
  await act(async () => finish(result('A')))
  expect(screen.queryByAltText('Generated nail design')).not.toBeInTheDocument()
})
it('a session changed before submit cannot spend the new account credits on the old form', async () => {
  await act(async () => render(<NailLab />))
  for (const name of ['Minimal', 'Stiletto', 'Short']) fireEvent.click(screen.getByRole('button', { name, exact: true }))
  mock.auth.getSession.mockResolvedValue({ data: { session: session('B') } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Generate ✦' })))
  expect(mock.generate).not.toHaveBeenCalled()
})
it('a new paid regeneration exposes its own free regeneration and correct parent', async () => {
  await generate()
  mock.generate.mockResolvedValueOnce(result('free-A'))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Regenerate\s*FREE/ })))
  mock.generate.mockResolvedValueOnce(result('paid-B'))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Regenerate · 1 credit' })))
  mock.generate.mockResolvedValueOnce(result('free-B'))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Regenerate\s*FREE/ })))
  expect(mock.generate.mock.lastCall[1]).toMatchObject({ freeRegen: true, parentGenerationId: 'paid-B' })
})

it('refreshing the same account token preserves its generated design', async () => {
  await generate()
  await act(async () => mock.change('TOKEN_REFRESHED', { ...session('A'), access_token: 'refreshed-A' }))
  expect(screen.getByAltText('Generated nail design')).toHaveAttribute('src', result('A').imageUrl)
})

it('a late initial session lookup cannot restore the logged-out account', async () => {
  let resolveSession
  mock.auth.getSession.mockReturnValueOnce(new Promise(resolve => { resolveSession = resolve }))
  await act(async () => render(<NailLab />))
  mock.auth.getSession.mockResolvedValue({ data: { session: null } })
  await act(async () => mock.change('SIGNED_OUT', null))
  await act(async () => resolveSession({ data: { session: session('A') } }))
  expect(screen.getByText('Sign in to generate custom nail designs with AI.')).toBeVisible()
})

it('publishing cannot send the previous account design with a newly switched account token', async () => {
  await generate()
  mock.auth.getSession.mockResolvedValue({ data: { session: session('B') } })
  vi.stubGlobal('alert', vi.fn())
  fireEvent.click(screen.getByRole('button', { name: 'Save', exact: true }))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Publish to Laque/i })))
  expect(fetch.mock.calls.some(([url]) => url === '/api/publish-nail-lab-generation')).toBe(false)
  expect(alert).toHaveBeenCalledWith(expect.stringMatching(/account changed/i))
})
