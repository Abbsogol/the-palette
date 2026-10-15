import { afterEach, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({construct:vi.fn(),rpc:vi.fn(),accounts:vi.fn()}));
vi.mock('stripe',()=>({default:class {constructor(){this.webhooks={constructEvent:state.construct};this.accounts={retrieve:state.accounts}}}}));
vi.mock('@/lib/auth',()=>({serviceClient:{rpc:state.rpc}}));
import { POST } from '@/app/api/stripe-webhook/route';
afterEach(()=>{vi.unstubAllEnvs();vi.restoreAllMocks();state.construct.mockReset();state.rpc.mockReset();state.accounts.mockReset()});
it('never logs a provider signature error containing credentials or raw body',async()=>{
  const secret='syntheticCredentialDoNotLog';
  state.construct.mockImplementation(()=>{throw Error(secret)});
  const log=vi.spyOn(console,'error').mockImplementation(()=>{});
  const response=await POST(new Request('http://localhost/api/stripe-webhook',{method:'POST',body:secret}));
  expect(response.status).toBe(400);
  expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
  expect(state.rpc).not.toHaveBeenCalled();
});
it('rejects a correctly signed sandbox payload on the production webhook before account reads or financial writes',async()=>{
  vi.stubEnv('MOBILE_ENVIRONMENT','production');
  state.construct.mockReturnValue({livemode:false,type:'checkout.session.completed',data:{object:{}}});
  vi.spyOn(console,'error').mockImplementation(()=>{});
  const response=await POST(new Request('http://localhost/api/stripe-webhook',{method:'POST',body:'{}'}));
  expect(response.status).toBe(400);
  expect(state.accounts).not.toHaveBeenCalled();expect(state.rpc).not.toHaveBeenCalled();
});
