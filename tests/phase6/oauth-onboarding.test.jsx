// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ auth: {}, router: { push: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: mock.auth } }))
vi.mock('next/navigation', () => ({ useRouter: () => mock.router }))
import Profile from '@/app/profile/page'
beforeEach(() => {
  window.history.replaceState({}, '', '/profile?ref=INVITE22')
  Object.assign(mock.auth, {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    signInWithOAuth: vi.fn(async () => ({ error: null })),
  })
})
afterEach(() => { cleanup(); window.history.replaceState({}, '', '/') })

it('Google signup preserves the invitation code on the same-environment return URL', async () => {
  await act(async () => render(<Profile />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Continue with Google/ })))
  expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({ options: expect.objectContaining({ redirectTo: `${window.location.origin}/profile?ref=INVITE22` }) }))
})

it('an OAuth provider rejection is visible and permits another attempt', async () => {
  mock.auth.signInWithOAuth.mockResolvedValueOnce({ error: { message: 'Provider temporarily unavailable' } })
  await act(async () => render(<Profile />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Continue with Google/ })))
  expect(screen.getByText('Provider temporarily unavailable')).toBeVisible()
  expect(screen.getByRole('button', { name: /Continue with Google/ })).toBeEnabled()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Continue with Google/ })))
  expect(mock.auth.signInWithOAuth).toHaveBeenCalledTimes(2)
})
