import {beforeEach,it,expect,vi} from 'vitest'
const mock=vi.hoisted(()=>({identity:vi.fn(),prepare:vi.fn(),record:vi.fn()}));
vi.mock('@/lib/admin/auth',async()=>({...await vi.importActual('@/lib/admin/auth'),adminIdentity:mock.identity}));
vi.mock('@/lib/admin/export',()=>({prepareExport:mock.prepare,recordExport:mock.record}));
import {POST} from '@/app/api/admin/export/route'
import {AdminError} from '@/lib/admin/auth'
const req=body=>new Request('https://beta.invalid/api/admin/export',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{vi.resetAllMocks();mock.identity.mockResolvedValue({user:{id:'owner'},role:'owner'});mock.prepare.mockResolvedValue({content:'csv content',type:'text/csv',filename:'laque-users.csv'});mock.record.mockResolvedValue()})
it('does not assemble an export for signed-out, wrong-role or non-MFA sessions',async()=>{for(const code of['SIGN_IN_REQUIRED','ADMIN_FORBIDDEN','MFA_REQUIRED']){mock.identity.mockRejectedValueOnce(new AdminError('Access denied',403,code));expect((await POST(req({section:'users'}))).status).toBe(403)}expect(mock.prepare).not.toHaveBeenCalled()})
it('rechecks identity and refuses delivery after revocation or role changes',async()=>{mock.identity.mockResolvedValueOnce({role:'owner'}).mockRejectedValueOnce(new AdminError('Revoked',403));expect((await POST(req({section:'users'}))).status).toBe(403);expect(mock.record).not.toHaveBeenCalled();mock.identity.mockResolvedValueOnce({role:'owner'}).mockResolvedValueOnce({role:'support'});expect((await POST(req({section:'users'}))).status).toBe(403)})
it('records the download before sending no-store attachment headers',async()=>{const r=await POST(req({section:'users'}));expect(r.status).toBe(200);expect(mock.identity).toHaveBeenCalledTimes(2);expect(mock.record).toHaveBeenCalledOnce();expect(r.headers.get('cache-control')).toBe('private, no-store');expect(r.headers.get('content-disposition')).toContain('attachment');expect(await r.text()).toBe('csv content')})
it('never sends the file if auditing fails and sanitizes unexpected errors',async()=>{mock.record.mockRejectedValue(new Error('secret database payload'));const r=await POST(req({section:'users'}));expect(r.status).toBe(503);expect(await r.text()).not.toContain('secret');expect((await POST(req({section:'users',reason:'x'.repeat(5000)}))).status).toBe(413)})
