import { it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { createSecurityDatabase } from '../helpers/security-database';
import { reconcileLabStripe } from '../../lib/lab-stripe';
import { LAB_STRIPE_SANDBOX as config } from '../../lib/lab-stripe-sandbox.mjs';
it('runs provider verification into the real ledger: monthly, token pack, retry, partial refund and cancellation',async()=>{
 const sql=await createSecurityDatabase();
 try {
  await sql.exec('alter table auth.users add column email text');
  for(const file of ['202610080027_pinterest_budget.sql','202610080028_pinterest_budget_recovery.sql','202610080029_pinterest_pilot_allowance.sql','202610080030_admin_operations.sql','202610080035_lab_subscription.sql','202610080036_lab_play_base_plan.sql','202610090040_lab_stripe_sandbox.sql'])await sql.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
  const user='00000000-0000-4000-8000-000000000901',monthly='00000000-0000-4000-8000-000000000902',pack='00000000-0000-4000-8000-000000000903',customer='cus_provider';
  const call=async(name,args)=>Object.values((await sql.as('service_role',null,`select ${name}(${args.map((_,i)=>'$'+(i+1)).join(',')})`,args)).rows[0])[0];
  await sql.query('insert into auth.users(id) values($1)',[user]);await call('bind_lab_stripe_customer',[user,customer]);await call('begin_lab_stripe_checkout',[user,monthly,'monthly']);
  const db={rpc:async(name,p)=>{const args=name==='claim_lab_stripe_sync'?[p.p_user_id]:name==='release_lab_stripe_sync'?[p.p_user_id,p.p_token]:[p.p_user_id,p.p_token,JSON.stringify(p.p_snapshot)];return {data:await call(name,args),error:null}},from:table=>{expect(['lab_stripe_customers','lab_stripe_checkouts']).toContain(table);let filter;const query={select:()=>query,eq:(_field,id)=>{filter=id;return query},limit:()=>query,maybeSingle:async()=>({data:(await sql.query(`select * from ${table} where user_id=$1`,[filter])).rows[0]||null,error:null}),then:async resolve=>resolve({data:(await sql.query(`select * from ${table} where user_id=$1`,[filter])).rows,error:null})};return query}};
  const now=Math.floor(Date.now()/1000),period={start:now-3600,end:now+30*86400};
  let subStatus='active',refund=0;
  const sessions=[{id:'cs_monthly',client_reference_id:monthly,customer,livemode:false,mode:'subscription',currency:'usd',amount_total:500,status:'complete',payment_status:'paid',expires_at:now+1800,subscription:'sub_provider',payment_intent:null}];
  const iter=items=>({async *[Symbol.asyncIterator](){yield*items}});
  const invoice={id:'in_provider',livemode:false,customer,parent:{subscription_details:{subscription:'sub_provider'}},status:'paid',currency:'usd',amount_paid:500,total:500,billing_reason:'subscription_create',lines:{has_more:false,data:[{quantity:1,amount:500,pricing:{price_details:{price:config.products[0].priceId}},parent:{subscription_item_details:{subscription:'sub_provider'}},period}]}};
  const stripe={checkout:{sessions:{list:()=>iter(sessions),retrieve:async id=>sessions.find(s=>s.id===id),listLineItems:id=>iter([{quantity:1,amount_total:id==='cs_monthly'?500:1000,price:{id:config.products[id==='cs_monthly'?0:1].priceId}}])}},subscriptions:{retrieve:async()=>({id:'sub_provider',livemode:false,customer,status:subStatus,cancel_at_period_end:false,items:{has_more:false,data:[{quantity:1,price:{id:config.products[0].priceId}}]}})},invoices:{list:()=>iter([invoice])},invoicePayments:{list:()=>iter([{status:'paid',livemode:false,currency:'usd',invoice:invoice.id,amount_paid:500,payment:{type:'payment_intent',payment_intent:'pi_monthly'}}])},paymentIntents:{retrieve:async id=>{const amount=id==='pi_monthly'?500:1000;return {id,livemode:false,customer,status:'succeeded',currency:'usd',amount_received:amount,latest_charge:{id:'ch_'+id,payment_intent:id,customer,livemode:false,paid:true,currency:'usd',amount,amount_refunded:id==='pi_monthly'?0:refund,disputed:false}}}}};
  const status=()=>call('lab_subscription_status',[user]);
  await reconcileLabStripe(db,stripe,user);expect(await status()).toMatchObject({active:true,monthlyRemaining:15,purchasedTokens:0});
  await sql.query('update lab_monthly_allowances set used=15 where user_id=$1',[user]);await call('begin_lab_stripe_checkout',[user,pack,'tokens30']);
  sessions.push({...sessions[0],id:'cs_pack',client_reference_id:pack,mode:'payment',amount_total:1000,subscription:null,payment_intent:'pi_pack'});
  await reconcileLabStripe(db,stripe,user);await reconcileLabStripe(db,stripe,user);expect(await status()).toMatchObject({monthlyRemaining:0,purchasedTokens:30});
  refund=250;await reconcileLabStripe(db,stripe,user);await reconcileLabStripe(db,stripe,user);expect(await status()).toMatchObject({purchasedTokens:22});
  subStatus='canceled';await reconcileLabStripe(db,stripe,user);expect(await status()).toMatchObject({active:false,purchasedTokens:22});
 } finally {await sql.close()}
},30000);
