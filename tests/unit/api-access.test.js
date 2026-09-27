import { beforeEach, expect, it, vi } from 'vitest'
import { database, jsonRequest, ok, user } from '../helpers/supabase'

const auth = vi.hoisted(() => ({ getSessionUser: vi.fn(), isAdmin: vi.fn(), client: {} }))
vi.mock('@/lib/auth', () => ({ ...auth, serviceClient: auth.client }))
import { POST as privacy } from '@/app/api/update-privacy-settings/route'
import { POST as accountType } from '@/app/api/set-account-type/route'
import { GET as adminGet, POST as adminPost } from '@/app/api/admin-profiles/route'
import { POST as publish } from '@/app/api/publish-nail-lab-generation/route'

beforeEach(() => {
  vi.clearAllMocks()
  auth.getSessionUser.mockResolvedValue(user)
  auth.isAdmin.mockResolvedValue(false)
  Object.assign(auth.client, database(() => ok(null)))
})

it.each([['privacy', privacy], ['account type', accountType], ['publish', publish], ['admin read', adminGet], ['admin write', adminPost]])('%s rejects anonymous access before querying data', async (_name, handler) => {
  auth.getSessionUser.mockResolvedValue(null)
  expect((await handler(jsonRequest({}))).status).toBe(401)
  expect(auth.client.from).not.toHaveBeenCalled()
})

it.each([adminGet, adminPost])('rejects a non-admin before querying administrative data', async handler => {
  expect((await handler(jsonRequest({ userId: 'other-user', credits: 50 }))).status).toBe(401)
  expect(auth.client.from).not.toHaveBeenCalled()
})

it('only writes allowed privacy fields to the verified account', async () => {
  const response = await privacy(jsonRequest({ id: 'other-user', is_private: true, is_admin: true, credit_balance: 999 }))
  expect(response.status).toBe(200)
  expect(auth.client.calls).toEqual([expect.objectContaining({
    table: 'profiles_data', values: { is_private: true }, filters: [['eq', 'id', user.id]],
  })])
})

it('rejects unsupported message permissions without a write', async () => {
  expect((await privacy(jsonRequest({ message_permission: 'arbitrary' }))).status).toBe(400)
  expect(auth.client.from).not.toHaveBeenCalled()
})

it('does not accept admin as a self-selected account type', async () => {
  expect((await accountType(jsonRequest({ accountType: 'admin' }))).status).toBe(400)
  expect(auth.client.from).not.toHaveBeenCalled()
})

it('does not publish a generation owned by another account', async () => {
  Object.assign(auth.client, database(() => ok({ id: 'generation-a', user_id: 'other-user' })))
  expect((await publish(jsonRequest({ generationId: 'generation-a' }))).status).toBe(404)
  expect(auth.client.calls.every(q => q.operation === 'select')).toBe(true)
})
