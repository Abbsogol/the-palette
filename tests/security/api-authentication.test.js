import { beforeEach, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ getSessionUser: vi.fn(), isAdmin: vi.fn(), client: { from: vi.fn(), rpc: vi.fn() } }))
vi.mock('@/lib/auth', () => ({ ...auth, serviceClient: auth.client }))
const routes = import.meta.glob('../../app/api/**/route.js')
const publicEndpoints = new Set(['stripe-webhook','send-reminders'])
// The mobile config handshake is intentionally public, returns only environment
// identity, and performs no privileged read or mutation. It has its own tests.
const configRoute='../../app/api/mobile/config/route.js'
const privateRoutes = Object.entries(routes).filter(([path])=>path!==configRoute&&!publicEndpoints.has(path.split('/').at(-2)))
beforeEach(()=> { vi.clearAllMocks(); auth.getSessionUser.mockResolvedValue(null) })
it.each(privateRoutes)('rejects anonymous access to %s before privileged operations', async (_path, load) => {
  const handlers=await load()
  for(const method of ['GET','POST','PATCH','DELETE']) {
    if(!handlers[method]) continue
    const response=await handlers[method](new Request('http://localhost/api/test',{method,...(method==='POST'?{body:'{}',headers:{'content-type':'application/json'}}:{})}))
    expect(response.status).toBe(401)
  }
  expect(auth.client.from).not.toHaveBeenCalled()
  expect(auth.client.rpc).not.toHaveBeenCalled()
})
