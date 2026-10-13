import {beforeAll,afterAll,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {createSecurityDatabase} from '../helpers/security-database';
let db;const owner='00000000-0000-4000-8000-000000000701',user='00000000-0000-4000-8000-000000000702';
const call=(sql,args=[])=>db.as('service_role',null,sql,args);const scalar=async(sql,args=[])=>Object.values((await call(sql,args)).rows[0])[0];
beforeAll(async()=>{db=await createSecurityDatabase();await db.exec('alter table auth.users add column email text');for(const n of ['202610080027_pinterest_budget.sql','202610080028_pinterest_budget_recovery.sql','202610080029_pinterest_pilot_allowance.sql','202610080030_admin_operations.sql','202610080035_lab_subscription.sql','202610080036_lab_play_base_plan.sql','202610090040_lab_stripe_sandbox.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+n,import.meta.url),'utf8'));await db.query('insert into auth.users(id) values($1),($2)',[owner,user]);await db.query("insert into admin_staff(user_id,role) values($1,'owner')",[owner]);await db.query('update profiles_data set credit_balance=30 where id=$1',[user])},30000);
afterAll(()=>db?.close());
it('installs sandbox schema and denies browser access',async()=>{for(const role of ['anon','authenticated'])await expect(db.as(role,user,'select * from lab_stripe_customers')).rejects.toThrow(/permission denied/)});
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const snapshot={accountId:'acct_1UOYhj2MrQDGVNuk',customerId:'cus_labtest',checkouts:[],subscriptions:[]};
const start=new Date(Date.now()-3600000).toISOString(),end=new Date(Date.now()+30*86400000).toISOString();
const monthly={id:id(720),package:'monthly',sessionId:'cs_test_monthly',status:'paid',expiresAt:end,subscriptionId:'sub_labtest',paymentIntent:null};
const receipt={id:'in_labtest',periodStart:start,periodEnd:end,paymentIntent:'pi_monthly',refunded:false};
const sub={id:'sub_labtest',status:'active',cancelAtPeriodEnd:false,invoices:[receipt]};
const begin=(n,p)=>scalar('select begin_lab_stripe_checkout($1,$2,$3)',[user,id(n),p]);
const finish=async s=>{const token=await scalar('select claim_lab_stripe_sync($1)',[user]);try{return await scalar('select finish_lab_stripe_sync($1,$2,$3)',[user,token,JSON.stringify(s)])}finally{await scalar('select release_lab_stripe_sync($1,$2)',[user,token])}};
const status=()=>scalar('select lab_subscription_status($1)',[user]);
it('binds customers once, requires a subscription and serializes purchase intents',async()=>{
 await db.query('update profiles_data set credit_balance=0 where id=$1',[user]);
 expect(await scalar('select bind_lab_stripe_customer($1,$2)',[user,'cus_labtest'])).toBe('cus_labtest');
 expect(await scalar('select bind_lab_stripe_customer($1,$2)',[user,'cus_another'])).toBe('cus_labtest');
 await expect(begin(721,'tokens30')).rejects.toThrow(/USE_MONTHLY_ALLOWANCE_FIRST/);
 expect(await begin(720,'monthly')).toMatchObject({status:'creating'});
 expect(await begin(720,'monthly')).toMatchObject({id:id(720)});
 await expect(begin(721,'monthly')).rejects.toThrow(/PURCHASE_PENDING/);
 await expect(scalar('select begin_lab_stripe_checkout($1,$2,$3)',[owner,id(720),'monthly'])).rejects.toThrow(/CHECKOUT_IDENTITY_MISMATCH/);
 expect(await finish({...snapshot,checkouts:[monthly],subscriptions:[sub]})).toBe(true);
 expect(await status()).toMatchObject({active:true,monthlyRemaining:15,store:'STRIPE_LAB'});
 await expect(begin(722,'monthly')).rejects.toThrow(/SUBSCRIPTION_EXISTS/);
 await expect(begin(721,'tokens30')).rejects.toThrow(/USE_MONTHLY_ALLOWANCE_FIRST/);
});
it('monthly generation uses one allowance, retry and duplicate snapshots never refill it',async()=>{
 expect(await scalar('select claim_generation($1,$2,null,$3)',[id(730),user,'a'.repeat(64)])).toBe('claimed');
 expect(await scalar('select claim_generation($1,$2,null,$3)',[id(730),user,'a'.repeat(64)])).toBe('reserved');
 await finish({...snapshot,checkouts:[monthly],subscriptions:[sub]});
 expect(await status()).toMatchObject({monthlyRemaining:14,purchasedTokens:0});
 await scalar('select release_generation($1)',[id(730)]);
 expect(await status()).toMatchObject({monthlyRemaining:15});
});
let pack;
it('paid packs grant once, cumulative partial refunds revoke only the corresponding units',async()=>{
 await db.query('update lab_monthly_allowances set used=15 where user_id=$1',[user]);
 await begin(721,'tokens30');
 pack={id:id(721),package:'tokens30',sessionId:'cs_test_pack',status:'paid',expiresAt:end,subscriptionId:null,paymentIntent:'pi_pack',refundedUnits:0};
 await finish({...snapshot,checkouts:[monthly,pack],subscriptions:[sub]});
 await finish({...snapshot,checkouts:[monthly,pack],subscriptions:[sub]});
 expect(await status()).toMatchObject({active:true,monthlyRemaining:0,purchasedTokens:30});
 pack={...pack,refundedUnits:7};
 await finish({...snapshot,checkouts:[monthly,pack],subscriptions:[sub]});
 await finish({...snapshot,checkouts:[monthly,pack],subscriptions:[sub]});
 expect(await status()).toMatchObject({purchasedTokens:23});
 expect(await scalar("select count(*)::int from credit_payments where user_id=$1",[user])).toBe(1);
});
it('a full refund arriving before fulfillment grants zero tokens',async()=>{
 await begin(723,'tokens100');
 const refunded={id:id(723),package:'tokens100',sessionId:'cs_test_refunded',status:'paid',expiresAt:end,subscriptionId:null,paymentIntent:'pi_refunded',refundedUnits:100};
 await finish({...snapshot,checkouts:[monthly,pack,refunded],subscriptions:[sub]});
 expect(await status()).toMatchObject({purchasedTokens:23});
});
it('stale leases and mismatched customer/payment ownership cannot change balances',async()=>{
 const token=await scalar('select claim_lab_stripe_sync($1)',[user]);
 expect(await scalar('select claim_lab_stripe_sync($1)',[user])).toBeNull();
 expect(await scalar('select finish_lab_stripe_sync($1,$2,$3)',[user,null,JSON.stringify(snapshot)])).toBe(false);
 expect(await scalar('select finish_lab_stripe_sync($1,$2,$3)',[user,token,JSON.stringify({...snapshot,customerId:'cus_other'})])).toBe(false);
 await expect(scalar('select finish_lab_stripe_sync($1,$2,$3)',[user,token,JSON.stringify({...snapshot,checkouts:[{...pack,paymentIntent:'pi_other'}]})])).rejects.toThrow(/PAYMENT_IDENTITY_MISMATCH/);
 await db.query("update lab_stripe_customers set claim_until=now()-interval '1 second' where user_id=$1",[user]);
 expect(await scalar('select finish_lab_stripe_sync($1,$2,$3)',[user,token,JSON.stringify(snapshot)])).toBe(false);
 await scalar('select release_lab_stripe_sync($1,$2)',[user,token]);
 expect(await status()).toMatchObject({purchasedTokens:23});
});
it('fresh renewal resets allowance while preserving purchased tokens; refund revocation stays sticky',async()=>{
 const newStart=new Date(Date.now()-1000).toISOString(),newEnd=new Date(Date.now()+60*86400000).toISOString();
 const renewal={...receipt,id:'in_renewal',paymentIntent:'pi_renewal',periodStart:newStart,periodEnd:newEnd};
 await finish({...snapshot,checkouts:[monthly,pack],subscriptions:[{...sub,invoices:[receipt,renewal]}]});
 expect(await status()).toMatchObject({monthlyRemaining:15,purchasedTokens:23});
 await finish({...snapshot,checkouts:[monthly,pack],subscriptions:[{...sub,invoices:[{...receipt,refunded:true},{...renewal,refunded:true}]}]});
 await finish({...snapshot,checkouts:[monthly,pack],subscriptions:[{...sub,invoices:[receipt,renewal]}]});
 expect(await status()).toMatchObject({active:false,purchasedTokens:23});
});
it('cancellation is terminal even if an older notification says active',async()=>{
 await finish({...snapshot,checkouts:[monthly,pack],subscriptions:[{...sub,status:'canceled'}]});
 await finish({...snapshot,checkouts:[monthly,pack],subscriptions:[sub]});
 expect(await scalar("select status from lab_stripe_subscriptions where id='sub_labtest'")).toBe('canceled');
 expect(await status()).toMatchObject({active:false});
 for(const role of ['anon','authenticated'])for(const sql of ['select claim_lab_stripe_sync($1)','select begin_lab_stripe_checkout($1,$2,$3)'])await expect(db.as(role,user,sql,sql.includes('begin')?[user,id(740),'monthly']:[user])).rejects.toThrow(/permission denied/);
});
it('closed accounts do not receive late grants and cannot erase unsettled financial records',async()=>{
 // Renew a second subscription solely to prepare a late paid checkout.
 await begin(741,'monthly');
 await db.query('update profiles_data set deletion_started_at=now() where id=$1',[user]);
 const late={...monthly,id:id(741),sessionId:'cs_test_late',subscriptionId:'sub_late'};
 const unpaid={...receipt,id:'in_late',paymentIntent:'pi_late'};
 await finish({...snapshot,checkouts:[late],subscriptions:[{...sub,id:'sub_late',invoices:[unpaid]}]});
 await finish({...snapshot,checkouts:[late],subscriptions:[{...sub,id:'sub_late',invoices:[unpaid]}]});
 expect(await status()).toMatchObject({active:false,needsReview:true,purchasedTokens:0});
 expect(await scalar('select credit_balance from profiles_data where id=$1',[user])).toBe(23);
 await expect(scalar('select begin_account_deletion($1)',[user])).rejects.toThrow(/BILLING_IN_PROGRESS/);
 await expect(begin(742,'monthly')).rejects.toThrow(/ACCOUNT_UNAVAILABLE/);
});
