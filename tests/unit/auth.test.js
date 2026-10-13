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
  clients.single.mockResolvedValue({data:{deletion_started_at:null},error:null})
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
  it('legacy profile flags no longer grant administrative access', async () => {
    clients.single.mockResolvedValue({ data: { is_admin: true }, error: null })
    expect(await isAdmin('user-a')).toBe(false)
    expect(clients.from).not.toHaveBeenCalled()
  })
  it('fails closed when the database check fails', async () => {
    clients.single.mockResolvedValue({ data: null, error: { message: 'unavailable' } })
    expect(await isAdmin('user-a')).toBe(false)
  })
})

it('rejects verified sessions for an account undergoing deletion',async()=>{
  clients.getUser.mockResolvedValue({data:{user:{id:'deleting-user'}},error:null})
  clients.single.mockResolvedValue({data:{deletion_started_at:'2026-09-26'},error:null})
  const request=new Request('http://localhost',{headers:{authorization:'Bearer valid'}})
  expect(await getSessionUser(request)).toBeNull()
  expect(await getSessionUser(request,{allowDeleting:true})).toEqual({id:'deleting-user'})
})
it('authentication network failures fail closed',async()=>{
  clients.getUser.mockRejectedValue(new Error('Network unavailable'))
  expect(await getSessionUser(new Request('http://localhost',{headers:{authorization:'Bearer valid'}}))).toBeNull()
})
