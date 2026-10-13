import { it, expect, beforeEach, vi } from 'vitest';
const mocks=vi.hoisted(()=>({user:vi.fn(),pilot:vi.fn(),client:vi.fn(),checkout:vi.fn(),sync:vi.fn(),cancel:vi.fn(),db:{from:vi.fn()}}));
vi.mock('@/lib/auth',()=>({getSessionUser:mocks.user,serviceClient:mocks.db}));
vi.mock('@/lib/lab-stripe',()=>({labStripePilot:mocks.pilot,checkedLabStripe:mocks.client,createLabStripeCheckout:mocks.checkout,reconcileLabStripe:mocks.sync,cancelLabStripe:mocks.cancel,packageFor:key=>['monthly','tokens30','tokens100'].includes(key)}));
import { POST } from '../../app/api/mobile/billing/stripe/route';
const id='00000000-0000-4000-8000-000000000001';
const request=body=>new Request('https://laque-beta.vercel.app/api/mobile/billing/stripe',{method:'POST',body:JSON.stringify(body)});
beforeEach(()=>{vi.clearAllMocks();mocks.user.mockResolvedValue({id:'owner'});mocks.pilot.mockReturnValue(true);mocks.client.mockResolvedValue({});mocks.checkout.mockResolvedValue({url:'https://checkout.stripe.com/test'});mocks.sync.mockResolvedValue({pending:false});mocks.cancel.mockResolvedValue({pending:false});});
it('denies signed-out and non-pilot checkout before contacting Stripe',async()=>{
 mocks.user.mockResolvedValue(null);expect((await POST(request({action:'checkout',id,package:'monthly'}))).status).toBe(401);
 mocks.user.mockResolvedValue({id:'member'});mocks.pilot.mockReturnValue(false);mocks.db.from.mockReturnValue({select:()=>({eq:()=>({maybeSingle:async()=>({data:null})})})});
 expect((await POST(request({action:'checkout',id,package:'monthly'}))).status).toBe(403);expect(mocks.client).not.toHaveBeenCalled();
});
it('never accepts browser-supplied user identity or arbitrary prices',async()=>{
 expect((await POST(request({action:'checkout',id,package:'price_override'}))).status).toBe(400);
 expect((await POST(request({action:'checkout',id,package:'monthly',userId:'victim',priceId:'price_override'}))).status).toBe(200);
 expect(mocks.checkout).toHaveBeenCalledWith(mocks.db,{},'owner',id,'monthly');
});
it('checks purchases independently of checkout return and allows cancellation only for the session user',async()=>{
 expect((await POST(request({action:'check',sessionId:'untrusted'}))).status).toBe(200);expect(mocks.sync).toHaveBeenCalledWith(mocks.db,{},'owner');
 await POST(request({action:'cancelSubscription',userId:'victim'}));expect(mocks.cancel).toHaveBeenCalledWith(mocks.db,{},'owner');
});
it('does not disclose provider errors or credentials',async()=>{
 mocks.checkout.mockRejectedValue(new Error('rk_test_secret provider payload'));
 const response=await POST(request({action:'checkout',id,package:'monthly'}));expect(response.status).toBe(503);expect(JSON.stringify(await response.json())).not.toContain('rk_test');
});
