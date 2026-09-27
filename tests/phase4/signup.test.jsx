// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { database, ok } from '../helpers/supabase'
const mock = vi.hoisted(() => ({ auth: {}, router: { push: vi.fn() }, from: vi.fn() }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: mock.auth, from: mock.from } }))
vi.mock('next/navigation', () => ({ useRouter: () => mock.router }))
import Profile from '@/app/profile/page'

beforeEach(() => {
  vi.clearAllMocks()
  Object.assign(mock.auth, {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signUp: vi.fn(async () => ({ data: { user: { id: 'new-user' }, session: null }, error: null })),
  })
})
afterEach(cleanup)
async function chooseAccount() {
  await act(async () => render(<Profile />))
  fireEvent.click(screen.getByRole('button', { name: 'Sign up' }))
  for (const [placeholder, value] of [['Display name', 'New Artist'], ['Email', 'new@example.test'], ['Password', 'test-password']]) {
    fireEvent.change(screen.getByPlaceholderText(placeholder), { target: { value } })
  }
  fireEvent.click(screen.getByRole('checkbox', { name: /I agree/ }))
  fireEvent.click(screen.getByRole('button', { name: 'Continue →' }))
  fireEvent.click(screen.getByRole('button', { name: /Nail Artist/ }))
}
it('P4-01: signup awaiting confirmation shows the next step without an unauthenticated profile write', async () => {
  const fetch = vi.fn(async () => Response.json({ error: 'Unauthorized' }, { status: 401 }))
  vi.stubGlobal('fetch', fetch)
  await chooseAccount()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create account' })))
  expect(fetch).not.toHaveBeenCalled()
  expect(screen.getByText(/check your email/i)).toBeVisible()
  expect(mock.auth.signUp).toHaveBeenCalledWith(expect.objectContaining({
    options: expect.objectContaining({ data: { account_type: 'creator', display_name: 'New Artist' }, emailRedirectTo: `${window.location.origin}/profile` }),
  }))
  expect(mock.router.push).not.toHaveBeenCalled()
})
it('P4-01: immediate-session signup proceeds to onboarding without a competing account-type write', async () => {
  mock.auth.signUp.mockResolvedValue({ data: { session: { user: { id: 'new-user' } } }, error: null })
  mock.from.mockImplementation(database(() => ok({ account_type: 'creator', onboarding_complete: false })).from)
  const fetch = vi.fn()
  vi.stubGlobal('fetch', fetch)
  await chooseAccount()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create account' })))
  expect(mock.router.push).toHaveBeenCalledWith('/onboarding')
  expect(fetch).not.toHaveBeenCalled()
})
it.each(['returned', 'thrown'])('P4-01: a %s signup failure leaves a visible error and allows retry', async kind => {
  if (kind === 'returned') mock.auth.signUp.mockResolvedValue({ error: new Error('Signup unavailable') })
  else mock.auth.signUp.mockRejectedValue(new Error('Signup unavailable'))
  await chooseAccount()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Create account' })))
  expect(screen.getByText('Signup unavailable')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
})
