import { it, expect, vi, afterEach } from 'vitest';
import { verifySession, verifyCharge, verifyInvoice, labStripePilot, labStripeConfigured, createLabStripeCheckout } from '../../lib/lab-stripe';
import { LAB_STRIPE_SANDBOX } from '../../lib/lab-stripe-sandbox.mjs';
const customer='cus_owned',checkout={id:'00000000-0000-4000-8000-aaaaaaaa0001',package:'tokens30',session_id:null,created_at:new Date().toISOString()};
const session={id:'cs_test_owned',customer,client_reference_id:checkout.id,livemode:false,mode:'payment',currency:'usd',amount_total:1000,status:'complete',payment_status:'paid',expires_at:Math.floor(Date.now()/1000)+1800,payment_intent:'pi_owned'};
const lines=[{quantity:1,price:{id:LAB_STRIPE_SANDBOX.products[1].priceId},amount_total:1000}];
it('validates first-class checkout ownership and an exact fixed-price package',()=>{
 expect(verifySession(session,checkout,customer,lines)).toMatchObject({status:'paid',paymentIntent:'pi_owned'});
 for(const patch of [{customer:'cus_stolen'},{client_reference_id:'another'},{livemode:true},{currency:'aed'},{amount_total:1},{mode:'subscription'},{payment_status:'no_payment_required'}])expect(()=>verifySession({...session,...patch},checkout,customer,lines)).toThrow();
 expect(()=>verifySession(session,{...checkout,session_id:'cs_other'},customer,lines)).toThrow();
 expect(()=>verifySession(session,checkout,customer,[{...lines[0],quantity:2}])).toThrow();
 expect(()=>verifySession(session,checkout,customer,[{...lines[0],price:{id:'price_untrusted'}}])).toThrow();
 expect(verifySession({...session,payment_status:'unpaid'},checkout,customer,lines).status).toBe('open');
});
const charge={id:'ch_owned',livemode:false,customer,payment_intent:'pi_owned',paid:true,currency:'usd',amount:1000,amount_refunded:250};
const intent={id:'pi_owned',livemode:false,customer,status:'succeeded',currency:'usd',amount_received:1000,latest_charge:charge};
it('verified refunds require the successful payment and charge to belong to the same customer',()=>{
 expect(verifyCharge(intent,customer,1000)).toEqual({refunded:250,disputed:false});
 for(const patch of [{customer:'cus_other'},{payment_intent:'pi_other'},{livemode:true},{amount_refunded:1001},{paid:false}])expect(()=>verifyCharge({...intent,latest_charge:{...charge,...patch}},customer,1000)).toThrow();
 expect(()=>verifyCharge({...intent,status:'processing'},customer,1000)).toThrow();
});
const invoice={id:'in_owned',livemode:false,customer,parent:{subscription_details:{subscription:'sub_owned'}},status:'paid',currency:'usd',amount_paid:500,total:500,billing_reason:'subscription_cycle',lines:{has_more:false,data:[{quantity:1,amount:500,pricing:{price_details:{price:LAB_STRIPE_SANDBOX.products[0].priceId}},parent:{subscription_item_details:{subscription:'sub_owned'}},period:{start:1791540000,end:1794218400}}]}};
it('monthly allowances come from an exact paid invoice billing period, without trials or discounts',()=>{
 expect(verifyInvoice(invoice,'sub_owned',customer)).toMatchObject({id:'in_owned',refunded:false});
 for(const patch of [{customer:'cus_other'},{amount_paid:0},{total:100},{billing_reason:'manual'},{status:'open'},{livemode:true}])expect(()=>verifyInvoice({...invoice,...patch},'sub_owned',customer)).toThrow();
 expect(()=>verifyInvoice(invoice,'sub_other',customer)).toThrow();
 expect(()=>verifyInvoice({...invoice,lines:{...invoice.lines,has_more:true}},'sub_owned',customer)).toThrow();
});
afterEach(()=>vi.unstubAllEnvs());
it('requires isolated beta, an explicit pilot flag and a verified allowlisted account',()=>{
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://atjwbdrvgljddedtwoqo.supabase.co'); vi.stubEnv('NEXT_PUBLIC_APP_URL','https://laque-beta.vercel.app');
 vi.stubEnv('LAB_STRIPE_CHECKOUT_KEY','rk_test_fixture');vi.stubEnv('LAB_STRIPE_WEBHOOK_SECRET','whsec_fixture');vi.stubEnv('LAB_STRIPE_SANDBOX_USERS','owner');vi.stubEnv('LAB_STRIPE_SANDBOX_CHECKOUT_ENABLED','1');
 expect(labStripePilot({id:'owner',email_confirmed_at:'confirmed'})).toBe(true);
 expect(labStripePilot({id:'someone',email_confirmed_at:'confirmed'})).toBe(false);
 expect(labStripePilot({id:'owner'})).toBe(false);
 vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL','https://faunikvhoommbebsmevg.supabase.co');expect(labStripeConfigured()).toBe(false);
});
it('creates checkout with a durable key, server-selected price and dynamic wallet methods',async()=>{
 const update={eq:vi.fn(()=>update),then:ok=>Promise.resolve({data:null,error:null}).then(ok)};
 const db={rpc:vi.fn(async()=>({data:checkout,error:null})),from:vi.fn(()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{customer_id:customer},error:null})})}),update:()=>update}))};
 const iter=items=>({async *[Symbol.asyncIterator](){yield*items}});
 const stripe={checkout:{sessions:{list:vi.fn(()=>iter([])),create:vi.fn(async()=>({...session,status:'open',payment_status:'unpaid',url:'https://checkout.stripe.com/c/pay/test'})),listLineItems:vi.fn(()=>iter(lines))}}};
 expect(await createLabStripeCheckout(db,stripe,'owner',checkout.id.toUpperCase(),'tokens30')).toMatchObject({url:'https://checkout.stripe.com/c/pay/test'});
 expect(db.rpc).toHaveBeenCalledWith('begin_lab_stripe_checkout',{p_user_id:'owner',p_id:checkout.id,p_package:'tokens30'});
 const [params,options]=stripe.checkout.sessions.create.mock.calls[0];
 expect(params).toMatchObject({customer,client_reference_id:checkout.id,line_items:[{price:LAB_STRIPE_SANDBOX.products[1].priceId,quantity:1}]});
 expect(params).not.toHaveProperty('payment_method_types');expect(params).not.toHaveProperty('automatic_tax');
 expect(options.idempotencyKey).toContain(checkout.id);
 expect(stripe.checkout.sessions.listLineItems).toHaveBeenCalledWith(session.id,{limit:100});
});
