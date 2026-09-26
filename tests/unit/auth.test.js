import { beforeEach, describe, expect, it, vi } from 'vitest'

const clients = vi.hoisted(() => ({
  getUser: vi.fn(), from: vi.fn(), single: vi.fn(), eq: vi.fn(), select: vi.fn(),
}))
vi.mock('@supabase/supabase-js', () => ({
  createClient: (_url, key) => key === 'offline-service-role-key'
    ? { from: clients.from } : { auth: { getUser: clients.getUser } },
}))
import { getSessionUser, isAdmin } from '@/lib/auth'

beforeEach(() => {
  vi.clearAllMocks()
  clients.from.mockReturnValue({ select: clients.select })
  clients.select.mockReturnValue({ eq: clients.eq })
  clients.eq.mockReturnValue({ single: clients.single })
})

describe('verified API identity', () => {
  it.each([null, 'Basic abc', 'Bearer '])('rejects a missing/unsupported token: %s', async value => {
    const req = new Request('http://localhost', { headers: value ? { authorization: value } : {} })
    expect(await getSessionUser(req)).toBeNull()
    expect(clients.getUser).not.toHaveBeenCalled()
  })
  it('uses the verified Supabase user rather than trusting a token payload', async () => {
    clients.getUser.mockResolvedValue({ data: { user: { id: 'verified-user' } }, error: null })
    const req = new Request('http://localhost', { headers: { authorization: 'Bearer supplied-token' } })
    expect(await getSessionUser(req)).toEqual({ id: 'verified-user' })
    expect(clients.getUser).toHaveBeenCalledWith('supplied-token')
  })
  it('rejects an expired/invalid Supabase token', async () => {
    clients.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'expired' } })
    expect(await getSessionUser(new Request('http://localhost', { headers: { authorization: 'Bearer expired' } }))).toBeNull()
  })
})

describe('administrative access', () => {
  it('fails closed when no user is supplied', async () => {
    expect(await isAdmin(null)).toBe(false)
    expect(clients.from).not.toHaveBeenCalled()
  })
  it('checks the backing profile for the verified user', async () => {
    clients.single.mockResolvedValue({ data: { is_admin: true }, error: null })
    expect(await isAdmin('user-a')).toBe(true)
    expect(clients.from).toHaveBeenCalledWith('profiles_data')
    expect(clients.eq).toHaveBeenCalledWith('id', 'user-a')
  })
  it('fails closed when the database check fails', async () => {
    clients.single.mockResolvedValue({ data: null, error: { message: 'unavailable' } })
    expect(await isAdmin('user-a')).toBe(false)
  })
})
