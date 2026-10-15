import Stripe from 'stripe';
import { it, expect, beforeEach, vi } from 'vitest';
const mocks=vi.hoisted(()=>({client:vi.fn(),checked:vi.fn(),sync:vi.fn(),db:{from:vi.fn()}}));
vi.mock('@/lib/auth',()=>({serviceClient:mocks.db}));
vi.mock('@/lib/lab-stripe',()=>({labStripeClient:mocks.client,checkedLabStripe:mocks.checked,reconcileLabStripe:mocks.sync,stripeId:x=>typeof x==='string'?x:x?.id}));
import { POST } from '../../app/api/stripe-lab-webhook/route';
const secret='whsec_unit_test',stripe=new Stripe('sk_test_unit_test');
const event={id:'evt_test',type:'checkout.session.completed',livemode:false,data:{object:{id:'cs_test',customer:'cus_bound',metadata:{user_id:'victim'}}}};
function request(value=event,signed=true){const payload=JSON.stringify(value);return new Request('https://laque-beta.vercel.app/api/stripe-lab-webhook',{method:'POST',body:payload,headers:{'stripe-signature':signed?stripe.webhooks.generateTestHeaderString({payload,secret}):'invalid'}})}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('LAB_STRIPE_WEBHOOK_SECRET',secret);mocks.client.mockReturnValue(stripe);mocks.checked.mockResolvedValue({});mocks.sync.mockResolvedValue({pending:false});mocks.db.from.mockReturnValue({select:()=>({eq:(field,value)=>({maybeSingle:async()=>({data:value==='cus_bound'?{user_id:'account-owner'}:null,error:null})})})});});
it('rejects forged signatures and live events before database reads',async()=>{expect((await POST(request(event,false))).status).toBe(400);expect((await POST(request({...event,livemode:true}))).status).toBe(400);expect(mocks.db.from).not.toHaveBeenCalled();});
it.each(['missing','tampered','expired'])('rejects %s signature before provider verification or privileged reads',async kind=>{
  const payload=JSON.stringify(event);
  const signature=stripe.webhooks.generateTestHeaderString({payload,secret,...(kind==='expired'?{timestamp:Math.floor(Date.now()/1000)-3600}:{})});
  const r=new Request('https://laque-beta.vercel.app/api/stripe-lab-webhook',{method:'POST',body:kind==='tampered'?payload.replace('cus_bound','cus_other'):payload,headers:kind==='missing'?{}:{'stripe-signature':signature}});
  expect((await POST(r)).status).toBe(400);
  expect(mocks.client).toHaveBeenCalled();
  expect(mocks.checked).not.toHaveBeenCalled();
  expect(mocks.db.from).not.toHaveBeenCalled();
  expect(mocks.sync).not.toHaveBeenCalled();
});
it('reconciles the bound customer, ignoring metadata account claims',async()=>{expect((await POST(request())).status).toBe(200);expect(mocks.sync).toHaveBeenCalledWith(mocks.db,{},'account-owner');});
it('an overlapping verification returns retry so Stripe redelivers',async()=>{mocks.sync.mockResolvedValue({pending:true});expect((await POST(request())).status).toBe(503);});
it('provider failure returns a sanitized retry without leaking its payload',async()=>{mocks.checked.mockRejectedValue(new Error('rk_test_private provider payload'));const response=await POST(request());expect(response.status).toBe(503);expect(await response.text()).toBe('Retry verification');});
it('unrelated customers and event types do not grant anything',async()=>{await POST(request({...event,data:{object:{customer:'cus_unknown'}}}));await POST(request({...event,type:'product.updated'}));expect(mocks.sync).not.toHaveBeenCalled();});
