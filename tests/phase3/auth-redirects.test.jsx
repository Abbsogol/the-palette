// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
const mock = vi.hoisted(() => ({ auth: {}, router: { push: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({ supabase: { auth: mock.auth } }))
vi.mock('next/navigation', () => ({ useRouter: () => mock.router }))
import Profile from '@/app/profile/page'

beforeEach(() => {
  Object.assign(mock.auth, {
    getSession: vi.fn(async () => ({ data: { session: null } })),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    signInWithOAuth: vi.fn(async () => ({ error: null })),
    resetPasswordForEmail: vi.fn(async () => ({ error: null })),
  })
})
afterEach(cleanup)

it('P3-14: Google login returns to the environment that started login', async () => {
  await act(async () => render(<Profile />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Continue with Google/ })))
  expect(mock.auth.signInWithOAuth).toHaveBeenCalledWith(expect.objectContaining({
    options: expect.objectContaining({ redirectTo: `${window.location.origin}/profile` }),
  }))
})

it('P3-14: password recovery returns to the environment that requested it', async () => {
  await act(async () => render(<Profile />))
  fireEvent.click(screen.getByRole('button', { name: /Forgot password/ }))
  fireEvent.change(screen.getByPlaceholderText('Email'), { target: { value: 'recovery@example.test' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /Send reset link/ })))
  expect(mock.auth.resetPasswordForEmail).toHaveBeenCalledWith('recovery@example.test', {
    redirectTo: `${window.location.origin}/profile`,
  })
})
