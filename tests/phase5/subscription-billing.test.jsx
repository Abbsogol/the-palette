// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { database, ok, user } from '../helpers/supabase'
const mock = vi.hoisted(() => ({ client: {}, router: { push: vi.fn(), back: vi.fn() } }))
vi.mock('@/lib/supabase', () => ({ supabase: mock.client }))
vi.mock('next/navigation', () => ({ useRouter: () => mock.router }))
import Upgrade from '@/app/upgrade/page'
beforeEach(() => {
  Object.assign(mock.client, database(query => {
    const row = { id: user.id, display_name: 'Subscriber', account_type: 'user', subscription_tier: null, stripe_customer_id: 'cus_existing' }
    const projection = query.columns.split(',').map(column => column.trim())
    for (const column of projection) if (!Object.hasOwn(row, column)) throw new Error(`Unsupported profiles projection: ${column}`)
    return ok(Object.fromEntries(projection.map(column => [column, row[column]])))
  }))
  mock.client.auth = { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session: { user, access_token: 'token' } } }) }
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, json: async () => ({ error: 'Billing temporarily unavailable' }) })))
  vi.spyOn(window, 'alert').mockImplementation(() => {})
})
afterEach(cleanup)
it('an account with no paid tier can still open billing to recover its existing subscription', async () => {
  await act(async () => render(<Upgrade />))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Manage subscription' })))
  expect(fetch).toHaveBeenCalledWith('/api/create-billing-portal-session', expect.objectContaining({ method: 'POST' }))
  expect(fetch).toHaveBeenCalledTimes(1)
})
