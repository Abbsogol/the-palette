import { beforeEach, expect, it, vi } from 'vitest'
const auth = vi.hoisted(() => ({ getSessionUser: vi.fn(), isAdmin: vi.fn(), client: { from: vi.fn(), rpc: vi.fn() } }))
vi.mock('@/lib/auth', () => ({ ...auth, serviceClient: auth.client }))
const routes = import.meta.glob('../../app/api/**/route.js')
const publicEndpoints = new Set(['stripe-webhook','send-reminders'])
// The mobile config handshake is intentionally public, returns only environment
// identity, and performs no privileged read or mutation. It has its own tests.
const configRoute='../../app/api/mobile/config/route.js'
// OAuth callback is authenticated by a one-use state issued to an authenticated
// account. Binding still requires that account's bearer token at /mobile/calendar.
const calendarCallback='../../app/api/calendar/google/callback/route.js'
const privateRoutes = Object.entries(routes).filter(([path])=>path!==calendarCallback&&path!==configRoute&&path!=='../../app/api/mobile/home-content/route.js'&&path!=='../../app/api/pinterest/oauth/callback/route.js'&&!publicEndpoints.has(path.split('/').at(-2)))
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

it('calendar callback rejects missing or unknown OAuth state and never creates a connection', async()=>{
  const {GET}=await routes[calendarCallback]()
  expect((await GET(new Request('https://beta.invalid/api/calendar/google/callback?code=untrusted'))).status).toBe(400)
  expect(auth.client.rpc).not.toHaveBeenCalled()
  auth.client.rpc.mockResolvedValue({data:null,error:null})
  const response=await GET(new Request('https://beta.invalid/api/calendar/google/callback?state=untrusted&code=untrusted'))
  expect(response.status).toBe(400)
  expect(response.headers.get('Location')).toBeNull()
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(auth.client.rpc).toHaveBeenCalledTimes(1)
  expect(auth.client.rpc.mock.calls[0][0]).toBe('claim_google_calendar_oauth')
  expect(auth.client.from).not.toHaveBeenCalled()
})
