import {beforeEach,it,expect,vi} from 'vitest'
const mock=vi.hoisted(()=>({adminIdentity:vi.fn()}))
vi.mock('@/lib/admin/auth',()=>({...mock,adminResponse:(body,status)=>Response.json(body,{status}),adminFailure:e=>Response.json({error:e.message},{status:e.status})}))
import {GET,PATCH} from '@/app/api/mobile/admin-reports/route'
beforeEach(()=>vi.resetAllMocks())
it('retired report endpoints expose no data to non-staff',async()=>{mock.adminIdentity.mockRejectedValue({status:403,message:'Forbidden'});for(const handler of [GET,PATCH])expect((await handler(new Request('https://example.invalid/api/mobile/admin-reports'))).status).toBe(403)})
it('retired report writes cannot bypass role, MFA and auditing',async()=>{mock.adminIdentity.mockResolvedValue({role:'owner'});expect((await PATCH(new Request('https://example.invalid/api/mobile/admin-reports'))).status).toBe(410)})
