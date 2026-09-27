import { afterAll,beforeAll,beforeEach,expect,it,vi } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'
import { sqlSupabase } from '../helpers/sql-supabase'
import { jsonRequest } from '../helpers/supabase'
const mock=vi.hoisted(()=>({client:{},user:vi.fn(),admin:vi.fn(),create:vi.fn(),session:vi.fn(),intent:vi.fn(),subscription:vi.fn(),invoice:vi.fn(),refund:vi.fn(),refundRetrieve:vi.fn(),refundList:vi.fn()}))
vi.mock('@/lib/auth',()=>({getSessionUser:mock.user,isAdmin:mock.admin,serviceClient:mock.client}))
vi.mock('stripe',()=>({default:class Stripe {
  checkout={sessions:{create:mock.create,retrieve:mock.session}}
  paymentIntents={retrieve:mock.intent}
  subscriptions={retrieve:mock.subscription,list:async()=>({data:[],has_more:false})}
  invoices={retrieve:mock.invoice}
  refunds={create:mock.refund,retrieve:mock.refundRetrieve,list:mock.refundList}
  webhooks={constructEvent:body=>JSON.parse(body)}
}}))
import { POST as webhook } from '@/app/api/stripe-webhook/route'
import { POST as deposit } from '@/app/api/create-deposit-payment/route'
import { POST as referral } from '@/app/api/generate-referral/route'
import { POST as buyCredits } from '@/app/api/create-checkout-session/route'
import { POST as boostCheckout } from '@/app/api/create-boost-payment/route'
import { GET as subscriptionStatus } from '@/app/api/subscription-checkout-status/route'
import { GET as depositStatus } from '@/app/api/deposit-checkout-status/route'
import { POST as adminCredits } from '@/app/api/admin-profiles/route'
const user='00000000-0000-4000-8000-000000000201'
const creator='00000000-0000-4000-8000-000000000202'
const other='00000000-0000-4000-8000-000000000203'
const design='10000000-0000-4000-8000-000000000201'
const booking='20000000-0000-4000-8000-000000000201'
const service='30000000-0000-4000-8000-000000000201'
let db,sessions,refunds
const scalar=async(sql,args=[])=>Object.values((await db.query(sql,args)).rows[0])[0]
const balance=()=>scalar('select credit_balance from profiles_data where id=$1',[user])
const event=(id,type,object,created=100)=>webhook(jsonRequest({id,type,created,data:{object}}))
const checkout=(id,type,metadata,intent='pi_boost')=>event(id,type,{id:`cs_${intent}`,mode:'payment',payment_status:'paid',payment_intent:intent,metadata})
beforeAll(async()=>{db=await createSecurityDatabase()},30000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{
  vi.clearAllMocks();vi.spyOn(console,'log').mockImplementation(()=>{});vi.spyOn(console,'error').mockImplementation(()=>{})
  await db.exec('truncate auth.users,public.profiles_data,public.designs,public.processed_webhook_events cascade')
  await db.query('insert into auth.users(id) values ($1),($2),($3)',[user,creator,other])
  await db.query('update profiles_data set credit_balance=8 where id=$1',[user])
  await db.query("update profiles_data set account_type='creator' where id=$1",[creator])
  await db.query("insert into designs(id,created_by,title,is_published) values ($1,$2,'Paid promotion',true)",[design,creator])
  await db.query("insert into services(id,creator_id,name,duration_minutes,price,deposit_amount) values ($1,$2,'Manicure',60,100,25)",[service,creator])
  await db.query("insert into availability(creator_id,day_of_week,start_time,end_time) select $1,generate_series(0,6),'09:00'::time,'17:00'::time",[creator])
  await db.query("insert into bookings(id,client_id,creator_id,service_id,booking_date,start_time,end_time) values ($1,$2,$3,$4,current_date+1,'10:00','11:00')",[booking,user,creator,service])
  mock.user.mockResolvedValue({id:user,email:'user@example.invalid'});mock.admin.mockResolvedValue(true)
  Object.assign(mock.client,sqlSupabase(db))
  sessions=new Map()
  mock.create.mockImplementation(async(params,options)=>{
    if(!sessions.has(options.idempotencyKey))sessions.set(options.idempotencyKey,{...params,id:`cs_${options.idempotencyKey}`,url:`https://checkout.invalid/${options.idempotencyKey}`,status:'open',payment_intent:`pi_${options.idempotencyKey}`,payment_status:'paid'})
    return sessions.get(options.idempotencyKey)
  })
  mock.session.mockImplementation(async id=>[...sessions.values()].find(s=>s.id===id))
  refunds=new Map()
  mock.intent.mockImplementation(async id=>({id,amount_received:2500,currency:'aed',metadata:{type:'deposit',bookingId:booking,userId:user}}))
  mock.refund.mockImplementation(async(params,options)=>{
    if(!refunds.has(options.idempotencyKey))refunds.set(options.idempotencyKey,{...params,id:`re_${options.idempotencyKey}`,status:'succeeded',amount:2500,currency:'aed'})
    return refunds.get(options.idempotencyKey)
  })
  mock.refundRetrieve.mockImplementation(async id=>[...refunds.values()].find(r=>r.id===id))
  mock.refundList.mockImplementation(async({payment_intent})=>({data:[...refunds.values()].filter(r=>r.payment_intent===payment_intent),has_more:false}))
})
it('P3-01: a paid subscription period grants the advertised five Premium credits',async()=>{
  await db.query("update profiles_data set stripe_subscription_id='sub_current',stripe_customer_id='cus_current',subscription_tier='premium',subscription_status='active' where id=$1",[user])
  const subscription={id:'sub_current',customer:'cus_current',status:'active',metadata:{userId:user,planId:'premium'},items:{data:[{price:{id:'price_1TnxOq14PyqGjXgedydlYqto'}}]}}
  mock.subscription.mockResolvedValue(subscription)
  const invoice={id:'in_month',status:'paid',billing_reason:'subscription_cycle',customer:'cus_current',parent:{subscription_details:{subscription:'sub_current'}},lines:{has_more:false,data:[{id:'il_month',amount:1900,quantity:1,period:{start:1000,end:2000},parent:{type:'subscription_item_details',subscription_item_details:{subscription:'sub_current',proration:false}},pricing:{price_details:{price:'price_1TnxOq14PyqGjXgedydlYqto'}}}]}}
  mock.invoice.mockResolvedValue(invoice)
  expect((await event('evt_invoice','invoice.paid',invoice)).status).toBe(200)
  expect(await balance()).toBe(13)
})
it('P3-02: two event types for the same boost payment do not extend it twice',async()=>{
  const meta={type:'boost',designId:design,creatorId:creator,days:'1'}
  expect((await checkout('evt_boost','checkout.session.completed',meta)).status).toBe(200)
  const first=await scalar('select boosted_until from designs where id=$1',[design])
  expect((await checkout('evt_boost_async','checkout.session.async_payment_succeeded',meta)).status).toBe(200)
  expect(await scalar('select boosted_until from designs where id=$1',[design])).toEqual(first)
})
it('P3-03: refunding an old boost preserves a different paid boost',async()=>{
  const meta={type:'boost',designId:design,creatorId:creator,days:'1'}
  await checkout('evt_boost_a','checkout.session.completed',meta,'pi_a')
  await checkout('evt_boost_b','checkout.session.completed',{...meta,days:'3'},'pi_b')
  mock.intent.mockResolvedValue({id:'pi_a',amount_received:1500,currency:'aed',metadata:meta})
  refunds.set('manual-boost-a',{id:'re_boost_a',payment_intent:'pi_a',amount:1500,currency:'aed',status:'succeeded'})
  await event('evt_refund_a','charge.refunded',{id:'ch_a',payment_intent:'pi_a',refunded:true,amount:1500,amount_refunded:1500})
  expect(new Date(await scalar('select boosted_until from designs where id=$1',[design])).getTime()).toBeGreaterThan(Date.now()+2*86400000)
})
it('P3-04: an old deposit refund cannot clear the newer paid deposit',async()=>{
  await db.query("update bookings set deposit_paid=true,stripe_payment_intent='pi_new' where id=$1",[booking])
  mock.intent.mockResolvedValue({id:'pi_old',amount_received:2500,currency:'aed',metadata:{type:'deposit',bookingId:booking,userId:user}})
  refunds.set('manual-old',{id:'re_old',payment_intent:'pi_old',amount:2500,currency:'aed',status:'succeeded'})
  expect((await event('evt_refund_old','charge.refunded',{id:'ch_old',payment_intent:'pi_old',refunded:true,amount:2500,amount_refunded:2500})).status).toBe(200)
  expect(await scalar('select deposit_paid from bookings where id=$1',[booking])).toBe(true)
})
it.each(['cancelled','declined'])('P3-05: a %s booking cannot collect a deposit',async status=>{
  await db.query('update bookings set status=$2 where id=$1',[booking,status])
  expect((await deposit(jsonRequest({bookingId:booking}))).status).toBe(409)
  expect(mock.create).not.toHaveBeenCalled()
})
it('P3-06: a refund before fulfillment cannot spend unrelated existing credits',async()=>{
  await db.as('service_role',null,"select apply_credit_payment('evt_refund','pi_unfulfilled',$1,40,null,20)",[user])
  expect(await balance()).toBe(8)
  await db.as('service_role',null,"select apply_credit_payment('evt_paid','pi_unfulfilled',$1,40,'cs_paid',0)",[user])
  expect(await balance()).toBe(28)
})
it('P3-07: concurrent requests publish one stable referral code',async()=>{
  const responses=await Promise.all([referral(jsonRequest({})),referral(jsonRequest({}))])
  const codes=await Promise.all(responses.map(async r=>(await r.json()).code))
  expect(codes[0]).toBeTruthy();expect(new Set(codes).size).toBe(1)
  expect(await scalar('select referral_code from profiles_data where id=$1',[user])).toBe(codes[0])
})
it('P3-08: two clients cannot reserve overlapping appointments for one creator',async()=>{
  const results=await Promise.allSettled([user,other].map(id=>db.as('authenticated',id,"insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time) values ($1,$2,$3,current_date+1,'12:00','13:00')",[id,creator,service])))
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
})
it('P3-09: deletion cannot destroy an account while its paid generation is in flight',async()=>{
  await db.as('service_role',null,'select reserve_generation($1,$2,null)',[design,user])
  await expect(db.as('authenticated',user,'select delete_own_account()')).rejects.toThrow()
  expect(await scalar('select count(*)::integer from profiles_data where id=$1',[user])).toBe(1)
})
it('P3-10: a portal plan change follows the actual Stripe price, not stale metadata',async()=>{
  await db.query("update profiles_data set stripe_subscription_id='sub_current',stripe_customer_id='cus_current',subscription_tier='premium' where id=$1",[user])
  const sub={id:'sub_current',customer:'cus_current',status:'active',metadata:{userId:user,planId:'premium'},items:{data:[{price:{id:'price_1TnxOG14PyqGjXgeKYmTKhQf'}}]}}
  mock.subscription.mockResolvedValue(sub)
  expect((await event('evt_portal','customer.subscription.updated',sub)).status).toBe(200)
  expect(await scalar('select subscription_tier from profiles_data where id=$1',[user])).toBe('pro_creator')
})
it.each([-1,1.5])('P3-11: admin cannot save an invalid credit balance (%s)',async credits=>{
  expect((await adminCredits(jsonRequest({userId:user,credits}))).status).toBe(400)
  expect(await balance()).toBe(8)
})

it('P3-15: a payable boost checkout keeps its design available until settlement',async()=>{
  mock.user.mockResolvedValue({id:creator,email:'creator@example.invalid'})
  expect((await boostCheckout(jsonRequest({designId:design,days:1,price:15}))).status).toBe(200)
  await expect(db.as('authenticated',creator,'delete from designs where id=$1',[design])).rejects.toThrow()
  expect(await scalar('select count(*)::integer from designs where id=$1',[design])).toBe(1)
  const session=[...sessions.values()][0]
  expect((await event('evt_retained_design','checkout.session.completed',session)).status).toBe(200)
  expect(new Date(await scalar('select boosted_until from designs where id=$1',[design])).getTime()).toBeGreaterThan(Date.now())
  await db.as('authenticated',creator,'delete from designs where id=$1',[design])
  expect(await scalar('select count(*)::integer from designs where id=$1',[design])).toBe(0)
})

it('a design deletion racing checkout cannot leave a payable missing target',async()=>{
  mock.user.mockResolvedValue({id:creator,email:'creator@example.invalid'})
  const [payment]=await Promise.allSettled([
    boostCheckout(jsonRequest({designId:design,days:1,price:15})),
    db.as('authenticated',creator,'delete from designs where id=$1',[design]),
  ])
  const exists=await scalar('select count(*)::integer from designs where id=$1',[design])
  if(payment.value.status===200) {
    expect(exists).toBe(1)
    expect(await scalar('select count(*)::integer from payment_checkouts')).toBe(1)
  } else {
    expect(mock.create).not.toHaveBeenCalled()
  }
})

const premiumPrice='price_1TnxOq14PyqGjXgedydlYqto'
const proPrice='price_1TnxOG14PyqGjXgeKYmTKhQf'
const paidInvoice=(overrides={})=>({id:'in_period',status:'paid',billing_reason:'subscription_cycle',customer:'cus_current',parent:{subscription_details:{subscription:'sub_current'}},lines:{has_more:false,data:[{id:'il_period',amount:1900,quantity:1,period:{start:1000,end:2000},parent:{type:'subscription_item_details',subscription_item_details:{subscription:'sub_current',proration:false}},pricing:{price_details:{price:premiumPrice}}}]},...overrides})
async function setupSubscription() {
  await db.query("update profiles_data set stripe_subscription_id='sub_current',stripe_customer_id='cus_current',subscription_tier='premium',subscription_status='active' where id=$1",[user])
  mock.subscription.mockResolvedValue({id:'sub_current',customer:'cus_current',status:'active',metadata:{userId:user,planId:'premium'},items:{data:[{price:{id:premiumPrice}}]}})
}
it('monthly credits are once per invoice and period across duplicates, concurrency and alternate event IDs',async()=>{
  await setupSubscription();const invoice=paidInvoice();mock.invoice.mockResolvedValue(invoice)
  const results=await Promise.all(['evt_a','evt_b','evt_a'].map(id=>event(id,'invoice.paid',invoice)))
  expect(results.map(r=>r.status)).toEqual([200,200,200])
  mock.invoice.mockResolvedValue({...invoice,id:'in_duplicate_period'})
  await event('evt_duplicate_period','invoice.paid',{id:'in_duplicate_period'})
  expect(await balance()).toBe(13)
  expect(await scalar('select count(*)::integer from subscription_credit_grants')).toBe(1)
  invoice.id='in_next';invoice.lines.data[0].period={start:2000,end:3000};invoice.lines.data[0].pricing.price_details.price=proPrice
  mock.invoice.mockResolvedValue(invoice)
  await event('evt_next','invoice.paid',invoice)
  expect(await balance()).toBe(33)
})
it('an invoice before checkout binding stays retryable, then grants once after binding',async()=>{
  await setupSubscription();await db.query('update profiles_data set stripe_subscription_id=null where id=$1',[user])
  const invoice=paidInvoice();mock.invoice.mockResolvedValue(invoice)
  expect((await event('evt_early','invoice.paid',invoice)).status).toBe(500)
  expect(await scalar("select count(*)::integer from processed_webhook_events where event_id='evt_early'")).toBe(0)
  await setupSubscription()
  expect((await event('evt_early','invoice.paid',invoice)).status).toBe(200)
  expect(await balance()).toBe(13)
})
it('historical verified subscription ownership permits delayed earned credits after switching plans',async()=>{
  await setupSubscription()
  await db.query("insert into subscription_accounts(subscription_id,user_id,customer_id) values ('sub_current',$1,'cus_current')",[user])
  await db.query("update profiles_data set stripe_subscription_id='sub_new' where id=$1",[user])
  const invoice=paidInvoice();mock.invoice.mockResolvedValue(invoice)
  expect((await event('evt_late_paid','invoice.paid',invoice)).status).toBe(200)
  expect(await balance()).toBe(13)
})
it.each(['open','draft'])('an %s invoice never grants credits',async status=>{
  await setupSubscription();const invoice=paidInvoice({status});mock.invoice.mockResolvedValue(invoice)
  expect((await event('evt_unpaid','invoice.paid',invoice)).status).toBe(200)
  expect(await balance()).toBe(8)
})
it('failed invoice updates current status without granting credits',async()=>{
  await setupSubscription();const invoice=paidInvoice({status:'open'});mock.invoice.mockResolvedValue(invoice)
  const sub=await mock.subscription();sub.status='past_due';mock.subscription.mockResolvedValue(sub)
  expect((await event('evt_failed','invoice.payment_failed',invoice)).status).toBe(200)
  expect(await scalar('select subscription_status from profiles_data where id=$1',[user])).toBe('past_due')
  expect(await balance()).toBe(8)
})
it('proration invoices and unrecognized prices cannot mint a new monthly grant',async()=>{
  await setupSubscription();const invoice=paidInvoice({billing_reason:'subscription_update'});mock.invoice.mockResolvedValue(invoice)
  expect((await event('evt_prorated','invoice.paid',invoice)).status).toBe(200)
  invoice.billing_reason='subscription_cycle';invoice.lines.data[0].pricing.price_details.price='price_unrecognized'
  expect((await event('evt_unknown_price','invoice.paid',invoice)).status).toBe(500)
  expect(await balance()).toBe(8)
  expect(await scalar("select count(*)::integer from processed_webhook_events where event_id='evt_unknown_price'")).toBe(0)
})
it('monthly grant and receipt roll back together on a failed credit write',async()=>{
  await setupSubscription();const invoice=paidInvoice();mock.invoice.mockResolvedValue(invoice)
  await db.exec('alter table profiles_data add constraint simulated_credit_failure check(credit_balance<=8)')
  try {
    expect((await event('evt_retry','invoice.paid',invoice)).status).toBe(500)
    expect(await scalar('select count(*)::integer from subscription_credit_grants')).toBe(0)
    expect(await scalar("select count(*)::integer from processed_webhook_events where event_id='evt_retry'")).toBe(0)
  } finally {await db.exec('alter table profiles_data drop constraint simulated_credit_failure')}
  expect((await event('evt_retry','invoice.paid',invoice)).status).toBe(200)
  expect(await balance()).toBe(13)
})
it('concurrent separate boost purchases both contribute their paid duration',async()=>{
  const meta={type:'boost',designId:design,creatorId:creator,days:'1'}
  const responses=await Promise.all(['pi_a','pi_b'].map(intent=>checkout(`evt_${intent}`,'checkout.session.completed',meta,intent)))
  expect(responses.map(r=>r.status)).toEqual([200,200])
  const until=new Date(await scalar('select boosted_until from designs where id=$1',[design])).getTime()
  expect(until).toBeGreaterThan(Date.now()+1.99*86400000)
  expect(until).toBeLessThan(Date.now()+2.01*86400000)
})
it('boost refund before fulfillment is remembered and cannot be resurrected',async()=>{
  const meta={type:'boost',designId:design,creatorId:creator,days:'1'};mock.intent.mockResolvedValue({id:'pi_early',amount_received:1500,currency:'aed',metadata:meta})
  refunds.set('manual-boost-early',{id:'re_boost_early',payment_intent:'pi_early',amount:1500,currency:'aed',status:'succeeded'})
  await event('evt_refund_first','charge.refunded',{payment_intent:'pi_early',amount:1500,amount_refunded:1500,refunded:true})
  await checkout('evt_late','checkout.session.completed',meta,'pi_early')
  expect(await scalar('select boosted_until from designs where id=$1',[design])).toBeNull()
  expect((await db.query("select fulfilled,refunded from order_payments where payment_intent='pi_early'")).rows).toEqual([{fulfilled:true,refunded:true}])
})
it('partial boost refund does not erase the promotion',async()=>{
  const meta={type:'boost',designId:design,creatorId:creator,days:'1'};mock.intent.mockResolvedValue({id:'pi_a',amount_received:1500,currency:'aed',metadata:meta})
  refunds.set('manual-boost-partial',{id:'re_boost_partial',payment_intent:'pi_a',amount:500,currency:'aed',status:'succeeded'})
  await checkout('evt_paid','checkout.session.completed',meta,'pi_a')
  const before=await scalar('select boosted_until from designs where id=$1',[design])
  await event('evt_partial','charge.refunded',{payment_intent:'pi_a',amount:1500,amount_refunded:500,refunded:false})
  expect(await scalar('select boosted_until from designs where id=$1',[design])).toEqual(before)
})
it('boost entitlement and event receipt roll back together',async()=>{
  const meta={type:'boost',designId:design,creatorId:creator,days:'1'}
  await db.exec('alter table designs add constraint simulated_boost_failure check(boosted_until is null)')
  try {
    expect((await checkout('evt_retry','checkout.session.completed',meta)).status).toBe(500)
    expect(await scalar('select count(*)::integer from order_payments')).toBe(0)
    expect(await scalar("select count(*)::integer from processed_webhook_events where event_id='evt_retry'")).toBe(0)
  } finally {await db.exec('alter table designs drop constraint simulated_boost_failure')}
  expect((await checkout('evt_retry','checkout.session.completed',meta)).status).toBe(200)
})
it('deposit checkout is stable across retries after the old five-minute window',async()=>{
  const first=await deposit(jsonRequest({bookingId:booking}));expect(first.status).toBe(200)
  const firstBody=await first.json()
  vi.spyOn(Date,'now').mockReturnValue(Date.now()+10*60000)
  const second=await deposit(jsonRequest({bookingId:booking}));expect(second.status).toBe(200)
  expect(await second.json()).toEqual(firstBody)
  expect(mock.create).toHaveBeenCalledTimes(1)
})
it('a deposit records its payment identity and only its matching refund clears it',async()=>{
  const meta={type:'deposit',bookingId:booking,userId:user}
  expect((await checkout('evt_deposit','checkout.session.completed',meta,'pi_deposit')).status).toBe(200)
  expect(mock.refund).not.toHaveBeenCalled()
  expect((await db.query('select deposit_paid,stripe_payment_intent,status from bookings where id=$1',[booking])).rows).toEqual([{deposit_paid:true,stripe_payment_intent:'pi_deposit',status:'pending'}])
  mock.intent.mockResolvedValue({id:'pi_deposit',amount_received:2500,currency:'aed',metadata:meta})
  refunds.set('manual-deposit',{id:'re_deposit',payment_intent:'pi_deposit',amount:2500,currency:'aed',status:'succeeded'})
  expect((await event('evt_refund','charge.refunded',{payment_intent:'pi_deposit',amount:2500,amount_refunded:2500,refunded:true})).status).toBe(200)
  expect(await scalar('select deposit_paid from bookings where id=$1',[booking])).toBe(false)
})
it.each(['cancelled','declined'])('a late deposit for a %s booking automatically requests a full refund',async status=>{
  await db.query('update bookings set status=$2 where id=$1',[booking,status])
  const meta={type:'deposit',bookingId:booking,userId:user}
  expect((await checkout('evt_late','checkout.session.completed',meta,'pi_late')).status).toBe(200)
  expect((await db.query('select status,deposit_paid from bookings where id=$1',[booking])).rows).toEqual([{status,deposit_paid:false}])
  expect(mock.refund).toHaveBeenCalledWith({payment_intent:'pi_late',metadata:{type:'late_deposit',bookingId:booking}},{idempotencyKey:'late-deposit-pi_late'})
  expect(await scalar("select needs_review from order_payments where payment_intent='pi_late'")).toBe(false)
})
it.each([['credit pack',buyCredits,{packId:'starter'}],['boost',boostCheckout,{designId:design,days:1,price:15}]])('%s checkout stays durable and prevents deletion during payment',async(_name,route,body)=>{
  const account=route===boostCheckout?creator:user;mock.user.mockResolvedValue({id:account,email:'owner@example.invalid'})
  const first=await route(jsonRequest(body));expect(first.status).toBe(200)
  const firstBody=await first.json()
  vi.spyOn(Date,'now').mockReturnValue(Date.now()+10*60000)
  expect(await (await route(jsonRequest(body))).json()).toEqual(firstBody)
  expect(mock.create).toHaveBeenCalledTimes(1)
  await expect(db.as('authenticated',account,'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
  const session=[...sessions.values()][0]
  expect((await event('evt_settle','checkout.session.completed',session)).status).toBe(200)
  expect(await scalar('select count(*)::integer from payment_checkouts')).toBe(0)
})
it('paid but unfulfilled checkout cannot start another identical purchase',async()=>{
  await buyCredits(jsonRequest({packId:'starter'}))
  ;[...sessions.values()][0].status='complete'
  expect((await buyCredits(jsonRequest({packId:'starter'}))).status).not.toBe(200)
  expect(mock.create).toHaveBeenCalledTimes(1)
})
it('strangers cannot purchase another person’s deposit or boost',async()=>{
  mock.user.mockResolvedValue({id:other,email:'other@example.invalid'})
  expect((await deposit(jsonRequest({bookingId:booking}))).status).toBe(404)
  expect((await boostCheckout(jsonRequest({designId:design,days:1,price:15}))).status).toBe(404)
  expect(mock.create).not.toHaveBeenCalled()
})
it('adjacent slots remain bookable and strangers see only occupied ranges',async()=>{
  const result=await db.as('authenticated',other,"insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time) values ($1,$2,$3,current_date+1,'11:00','12:00') returning id",[other,creator,service])
  expect(result.rows).toHaveLength(1)
  const busy=await db.as('authenticated',other,'select * from booking_busy_slots($1,current_date+1)',[creator])
  expect(busy.rows).toHaveLength(2)
  expect(Object.keys(busy.rows[0]).sort()).toEqual(['end_time','start_time'])
  await expect(db.as('anon',null,'select * from booking_busy_slots($1,current_date+1)',[creator])).rejects.toThrow()
})
it('deletion and generation reservation cannot both acquire permission for new work',async()=>{
  const results=await Promise.allSettled([
    db.as('service_role',null,'select begin_account_deletion($1)',[user]),
    db.as('service_role',null,'select reserve_generation($1,$2,null) as reserved',[design,user]),
  ])
  const reserved=results[1].status==='fulfilled'&&results[1].value.rows[0].reserved
  expect(results[0].status==='fulfilled'&&reserved).toBe(false)
})
it('new work is denied after deletion has started',async()=>{
  await db.as('service_role',null,'select begin_account_deletion($1)',[user])
  expect((await db.as('service_role',null,'select reserve_generation($1,$2,null) as reserved',[design,user])).rows[0].reserved).toBe(false)
  await expect(db.as('service_role',null,"select reserve_subscription_checkout($1,'premium','test@example.invalid','https://example.invalid')",[user])).rejects.toThrow('ACCOUNT_UNAVAILABLE')
})
it('browser roles cannot mutate the new ledgers or bypass the deletion wrappers',async()=>{
  for(const role of ['anon','authenticated']) {
    for(const name of ['ensure_referral_code(uuid,text)','begin_account_deletion(uuid)','grant_subscription_credits(text,text,uuid,text,text,bigint,bigint,text)','apply_order_payment(text,text,uuid,text,uuid,integer,text,boolean)','record_deposit_refund(text,text,text,bigint)','reserve_deposit_checkout(uuid,uuid,text)','reserve_payment_checkout(uuid,text,jsonb)','settle_payment_checkout(uuid,uuid,text)']) {
      expect(await scalar("select has_function_privilege($1,$2,'EXECUTE')",[role,name])).toBe(false)
    }
    await expect(db.as(role,user,'select * from order_payments')).rejects.toThrow()
    await expect(db.as(role,user,'select * from subscription_credit_grants')).rejects.toThrow()
  }
  expect(await scalar("select has_function_privilege('service_role','reserve_generation_before_deletion_guard(uuid,uuid,uuid)','EXECUTE')")).toBe(false)
})

const lateDeposit = (id='evt_late_retry',type='checkout.session.completed') => checkout(id,type,{type:'deposit',bookingId:booking,userId:user},'pi_late_retry')
const depositRequest = (session='cs_pi_late_retry') => new Request(`http://localhost/api/deposit-checkout-status?booking=${booking}&session_id=${session}`)

it('concurrent duplicate late deposit events issue only one refund',async()=>{
  await db.query("update bookings set status='cancelled' where id=$1",[booking])
  const responses=await Promise.all([lateDeposit(),lateDeposit('evt_late_async','checkout.session.async_payment_succeeded')])
  expect(responses.some(r=>r.status===200)).toBe(true)
  expect(responses.every(r=>[200,500].includes(r.status))).toBe(true)
  // A concurrent reader retries its event after the winner releases the lease.
  // Acknowledging it early could lose a newer provider state.
  expect((await lateDeposit('evt_late_async','checkout.session.async_payment_succeeded')).status).toBe(200)
  expect(refunds.size).toBe(1)
  expect(await scalar('select count(*)::integer from order_payments')).toBe(1)
  expect(await scalar('select deposit_paid from bookings where id=$1',[booking])).toBe(false)
})
it('a failed refund request remains durable and a duplicate webhook resumes it',async()=>{
  await db.query("update bookings set status='cancelled' where id=$1",[booking])
  mock.refund.mockRejectedValueOnce(new Error('Stripe unavailable'))
  expect((await lateDeposit()).status).toBe(500)
  expect((await db.query('select fulfilled,refund_required,needs_review from order_payments')).rows).toEqual([{fulfilled:true,refund_required:true,needs_review:true}])
  await expect(db.as('service_role',null,'select begin_account_deletion($1)',[user])).rejects.toThrow('BILLING_IN_PROGRESS')
  expect((await lateDeposit()).status).toBe(200)
  expect(refunds.size).toBe(1)
  expect(await scalar('select needs_review from order_payments')).toBe(false)
})
it('an accepted refund survives a failed database acknowledgment without another refund',async()=>{
  await db.query("update bookings set status='declined' where id=$1",[booking])
  await db.exec('alter table order_payments add constraint simulated_refund_write_failure check(refund_id is null)')
  try {
    expect((await lateDeposit()).status).toBe(500)
    expect(refunds.size).toBe(1)
    expect(await scalar('select refund_id from order_payments')).toBeNull()
  } finally { await db.exec('alter table order_payments drop constraint simulated_refund_write_failure') }
  expect((await lateDeposit()).status).toBe(200)
  expect(mock.refund).toHaveBeenCalledTimes(1)
  expect(await scalar('select refund_status from order_payments')).toBe('succeeded')
})
it('delayed refund updates change the owner-visible outcome without resurrecting a booking',async()=>{
  await db.query("update bookings set status='cancelled' where id=$1",[booking])
  mock.refund.mockImplementation(async params=>{
    const refund={...params,id:'re_pending',status:'pending',amount:2500,currency:'aed'};refunds.set('pending',refund);return refund
  })
  expect((await lateDeposit()).status).toBe(200)
  expect(await (await depositStatus(depositRequest())).json()).toEqual({status:'refund_pending'})
  await expect(db.as('service_role',null,'select begin_account_deletion($1)',[user])).rejects.toThrow('BILLING_IN_PROGRESS')
  const refund=refunds.get('pending');refund.status='succeeded'
  expect((await event('evt_refund_success','refund.updated',refund,200)).status).toBe(200)
  expect(await (await depositStatus(depositRequest())).json()).toEqual({status:'refunded'})
  // An older event cannot overwrite the newer stored status, even if a
  // concurrent provider read returned the old state before the update.
  mock.refundRetrieve.mockResolvedValueOnce({...refund,status:'pending'})
  expect((await event('evt_refund_stale','refund.updated',refund,150)).status).toBe(200)
  expect(await scalar('select refund_status from order_payments')).toBe('succeeded')
  mock.refundRetrieve.mockResolvedValueOnce({...refund,status:'pending'})
  expect((await event('evt_refund_same_second','refund.updated',refund,200)).status).toBe(200)
  expect(await scalar('select refund_status from order_payments')).toBe('succeeded')
  // A bank can subsequently reject an initially processed refund.
  refund.status='failed'
  expect((await event('evt_refund_failed','refund.failed',refund,300)).status).toBe(200)
  expect(await (await depositStatus(depositRequest())).json()).toEqual({status:'refund_failed'})
  expect(await scalar('select needs_review from order_payments')).toBe(true)
  expect(await scalar('select deposit_paid from bookings where id=$1',[booking])).toBe(false)
})
it('deposit status is private and does not acknowledge an unrelated checkout',async()=>{
  const meta={type:'deposit',bookingId:booking,userId:user}
  await checkout('evt_paid_status','checkout.session.completed',meta,'pi_late_retry')
  const response=await depositStatus(depositRequest())
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toEqual({status:'fulfilled'})
  expect(await (await depositStatus(depositRequest('cs_unrelated'))).json()).toEqual({status:'pending'})
  mock.user.mockResolvedValue({id:other})
  expect((await depositStatus(depositRequest())).status).toBe(404)
  mock.user.mockResolvedValue(null)
  expect((await depositStatus(depositRequest())).status).toBe(401)
})
it('a prior subscription cannot acknowledge an unrelated new checkout',async()=>{
  await setupSubscription()
  mock.session.mockResolvedValue({mode:'subscription',metadata:{userId:user},payment_status:'paid',customer:'cus_current',subscription:'sub_other'})
  mock.subscription.mockResolvedValue({...await mock.subscription(),id:'sub_other'})
  const response=await subscriptionStatus(new Request('http://localhost/api/subscription-checkout-status?session_id=cs_new'))
  expect(await response.json()).toEqual({status:'pending'})
  expect(response.headers.get('cache-control')).toBe('no-store')
  mock.session.mockResolvedValue({mode:'subscription',metadata:{userId:other},payment_status:'paid',customer:'cus_current',subscription:'sub_current'})
  expect((await subscriptionStatus(new Request('http://localhost/api/subscription-checkout-status?session_id=cs_other'))).status).toBe(404)
})
it('a paid, owned checkout confirms only its matching active subscription',async()=>{
  await setupSubscription()
  mock.session.mockResolvedValue({mode:'subscription',metadata:{userId:user},payment_status:'paid',customer:'cus_current',subscription:'sub_current'})
  expect(await (await subscriptionStatus(new Request('http://localhost/api/subscription-checkout-status?session_id=cs_current'))).json()).toEqual({status:'fulfilled',planId:'premium'})
})
