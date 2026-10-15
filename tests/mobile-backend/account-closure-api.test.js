import {beforeEach,expect,it,vi} from 'vitest'
const m=vi.hoisted(()=>({user:vi.fn(),rpc:vi.fn(),ban:vi.fn()}))
vi.mock('@/lib/auth',()=>({getSessionUser:m.user,serviceClient:{rpc:m.rpc,auth:{admin:{updateUserById:m.ban}}}}))
import {POST} from '@/app/api/delete-account/route'
beforeEach(()=>{vi.clearAllMocks();m.user.mockResolvedValue({id:'owner'});m.rpc.mockResolvedValue({data:{closed:true},error:null});m.ban.mockResolvedValue({error:null})})
it('closes only the bearer owner and returns an irreversible accepted result',async()=>{const r=await POST(new Request('https://test.invalid',{method:'POST',body:JSON.stringify({userId:'victim'})}));expect(r.status).toBe(202);expect(m.rpc).toHaveBeenCalledWith('close_account',{p_user_id:'owner'});expect(await r.json()).toMatchObject({closed:true,restorable:false,cleanup:'pending'});expect(m.ban).toHaveBeenCalledWith('owner',{ban_duration:'876000h'})})
it('does not claim closure if the transaction failed',async()=>{m.rpc.mockResolvedValue({error:{message:'Unavailable'}});expect((await POST(new Request('https://test.invalid'))).status).toBe(503);expect(m.ban).not.toHaveBeenCalled()})
it('provider failure after commit does not report that the account remains open',async()=>{m.ban.mockRejectedValue(new Error('Offline'));expect((await POST(new Request('https://test.invalid'))).status).toBe(202)})
it('signed-out callers cannot close an account',async()=>{m.user.mockResolvedValue(null);expect((await POST(new Request('https://test.invalid'))).status).toBe(401);expect(m.rpc).not.toHaveBeenCalled()})
