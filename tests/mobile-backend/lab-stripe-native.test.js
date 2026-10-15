import { it, expect, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createSecurityDatabase } from '../helpers/security-database';
import { nativeLabSnapshot, verifyNativeResource, createNativeLabPayment } from '../../lib/lab-stripe-native';
import { reconcileLabStripe } from '../../lib/lab-stripe';
import { LAB_STRIPE_SANDBOX as config } from '../../lib/lab-stripe-sandbox.mjs';
const customer='cus_native',user='00000000-0000-4000-8000-000000000921',id='00000000-0000-4000-8000-000000000922';
const iter=items=>({async *[Symbol.asyncIterator](){yield*items}});
const subscription={id:'sub_native',livemode:false,customer,status:'incomplete',collection_method:'charge_automatically',cancel_at_period_end:false,items:{has_more:false,data:[{quantity:1,price:{id:config.products[0].priceId}}]}};
const checkout={id,package:'monthly',surface:'native',session_id:'native:'+id,subscription_id:'sub_native',created_at:new Date().toISOString()};
it('rejects mismatched customer, price, quantity, live mode and resource identity',()=>{
 expect(verifyNativeResource(subscription,checkout,customer)).toBe(subscription);
 for(const mutation of [{customer:'cus_other'},{livemode:true},{id:'sub_other'},{trial_end:999},{items:{data:[{quantity:2,price:{id:config.products[0].priceId}}]}}])expect(()=>verifyNativeResource({...subscription,...mutation},checkout,customer)).toThrow();
});
it('never grants designs for an active subscription without a paid invoice',async()=>{
 const stripe={subscriptions:{retrieve:async()=>({...subscription,status:'active'})},invoices:{list:()=>iter([])}};
 const result=await nativeLabSnapshot(stripe,checkout,customer);
 expect(result.checkout.status).toBe('open');expect(result.subscription).toBeNull();
});
it('unpaid native subscriptions expire and successful consumables verify their charge',async()=>{
 expect((await nativeLabSnapshot({subscriptions:{retrieve:async()=>({...subscription,status:'incomplete_expired'})},invoices:{list:()=>iter([])}},checkout,customer)).checkout.status).toBe('expired');
 const pack={...checkout,package:'tokens30',subscription_id:null,payment_intent:'pi_native'};
 const intent={id:'pi_native',customer,livemode:false,amount:1000,currency:'usd',amount_received:1000,status:'succeeded',latest_charge:{id:'ch_native',payment_intent:'pi_native',customer,livemode:false,amount:1000,currency:'usd',paid:true,amount_refunded:250,disputed:false}};
 expect((await nativeLabSnapshot({paymentIntents:{retrieve:async()=>intent}},pack,customer)).checkout).toMatchObject({status:'paid',refundedUnits:8});
});
it('binds the provider ID before returning the native client secret and reuses it on retry',async()=>{
 vi.stubEnv('LAB_STRIPE_NATIVE_ENABLED','1');vi.stubEnv('LAB_STRIPE_PUBLISHABLE_KEY','pk_test_fixture');
 try {
  const db={rpc:vi.fn(async(name)=>({data:name==='begin_lab_stripe_native_checkout'?checkout:null})),from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{customer_id:customer}})})})})};
  const stripe={subscriptions:{retrieve:vi.fn(async()=>({...subscription,latest_invoice:{confirmation_secret:{client_secret:'pi_fixture_secret_fixture'}}})),create:vi.fn()}};
  const result=await createNativeLabPayment(db,stripe,user,id,'monthly');
  expect(result.clientSecret).toBe('pi_fixture_secret_fixture');expect(stripe.subscriptions.create).not.toHaveBeenCalled();
  expect(db.rpc).toHaveBeenCalledWith('bind_lab_stripe_native_resource',{p_user_id:user,p_id:id,p_resource:'sub_native'});
 } finally {vi.unstubAllEnvs()}
});
it('native payments use the real ledger exactly once; store/surface races and unauthenticated calls are blocked',async()=>{
 const sql=await createSecurityDatabase();
 try {
  await sql.exec('alter table auth.users add column email text');
  for(const file of ['202610080027_pinterest_budget.sql','202610080028_pinterest_budget_recovery.sql','202610080029_pinterest_pilot_allowance.sql','202610080030_admin_operations.sql','202610080035_lab_subscription.sql','202610080036_lab_play_base_plan.sql','202610090040_lab_stripe_sandbox.sql','202610120041_lab_native_payments.sql'])await sql.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
  const call=async(name,args)=>Object.values((await sql.as('service_role',null,`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args)).rows[0])[0];
  await sql.query('insert into auth.users(id) values($1)',[user]);await call('bind_lab_stripe_customer',[user,customer]);await call('begin_lab_stripe_native_checkout',[user,id,'monthly']);await call('bind_lab_stripe_native_resource',[user,id,'sub_native']);
  await expect(call('begin_lab_stripe_checkout',[user,id,'monthly'])).rejects.toThrow('CHECKOUT_IDENTITY_MISMATCH');
  await expect(call('bind_lab_stripe_native_resource',[user,id,'sub_wrong'])).rejects.toThrow('PAYMENT_IDENTITY_MISMATCH');
  await expect(sql.as('authenticated',user,'select begin_lab_stripe_native_checkout($1,$2,$3)',[user,id,'monthly'])).rejects.toThrow('permission denied');
  const db={rpc:async(name,p)=>({data:await call(name,name==='claim_lab_stripe_sync'?[p.p_user_id]:name==='release_lab_stripe_sync'?[p.p_user_id,p.p_token]:[p.p_user_id,p.p_token,JSON.stringify(p.p_snapshot)]),error:null}),from:table=>{let filter;const q={select:()=>q,eq:(_field,id)=>{filter=id;return q},limit:()=>q,maybeSingle:async()=>({data:(await sql.query(`select * from ${table} where user_id=$1`,[filter])).rows[0]||null}),then:async resolve=>resolve({data:(await sql.query(`select * from ${table} where user_id=$1`,[filter])).rows})};return q}};
  const now=Math.floor(Date.now()/1000),period={start:now-60,end:now+86400*30};
  const invoice={id:'in_native',livemode:false,customer,parent:{subscription_details:{subscription:'sub_native'}},status:'paid',currency:'usd',amount_paid:500,total:500,billing_reason:'subscription_create',lines:{has_more:false,data:[{quantity:1,amount:500,pricing:{price_details:{price:config.products[0].priceId}},parent:{subscription_item_details:{subscription:'sub_native'}},period}]}};
  const stripe={subscriptions:{retrieve:async()=>({...subscription,status:'active'})},invoices:{list:()=>iter([invoice])},invoicePayments:{list:()=>iter([{status:'paid',livemode:false,currency:'usd',invoice:invoice.id,amount_paid:500,payment:{type:'payment_intent',payment_intent:'pi_native'}}])},paymentIntents:{retrieve:async()=>({id:'pi_native',customer,livemode:false,status:'succeeded',amount_received:500,currency:'usd',latest_charge:{id:'ch_native',customer,livemode:false,payment_intent:'pi_native',paid:true,amount:500,currency:'usd',amount_refunded:0,disputed:false}})}};
  await reconcileLabStripe(db,stripe,user);await reconcileLabStripe(db,stripe,user);
  expect(await call('lab_subscription_status',[user])).toMatchObject({active:true,monthlyRemaining:15,purchasedTokens:0});
  expect((await sql.query('select count(*)::integer as count from lab_monthly_allowances where user_id=$1',[user])).rows[0].count).toBe(1);
 } finally {await sql.close()}
},30000);
