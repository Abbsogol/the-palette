import { beforeEach, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ getSessionUser: vi.fn(), isAdmin: vi.fn(), client: { from: vi.fn(), rpc: vi.fn() } }))
vi.mock('@/lib/auth', () => ({ ...auth, serviceClient: auth.client }))
const routes = import.meta.glob('../../app/api/**/route.js')
const publicEndpoints = new Set(['stripe-webhook','send-reminders'])
const privateRoutes = Object.entries(routes).filter(([path])=>!publicEndpoints.has(path.split('/').at(-2)))
beforeEach(()=> { vi.clearAllMocks(); auth.getSessionUser.mockResolvedValue(null) })
it.each(privateRoutes)('rejects anonymous access to %s before privileged operations', async (_path, load) => {
  const handlers=await load()
  for(const method of ['GET','POST']) {
    if(!handlers[method]) continue
    const response=await handlers[method](new Request('http://localhost/api/test',{method,...(method==='POST'?{body:'{}',headers:{'content-type':'application/json'}}:{})}))
    expect(response.status).toBe(401)
  }
  expect(auth.client.from).not.toHaveBeenCalled()
  expect(auth.client.rpc).not.toHaveBeenCalled()
})
