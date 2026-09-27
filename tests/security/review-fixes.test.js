import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'
import { database, jsonRequest, ok } from '../helpers/supabase'

const mocks = vi.hoisted(() => ({ client: {}, user: vi.fn(), create: vi.fn(), session: vi.fn(), subscriptions: vi.fn(), subscription: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getSessionUser: mocks.user, serviceClient: mocks.client }))
vi.mock('stripe', () => ({ default: class Stripe {
  checkout = { sessions: { create: mocks.create, retrieve: mocks.session } }
  subscriptions = { list: mocks.subscriptions, retrieve: mocks.subscription }
  webhooks = { constructEvent: body => JSON.parse(body) }
} }))
import { POST as subscribe } from '@/app/api/create-subscription/route'
import { POST as onboard } from '@/app/api/complete-onboarding/route'
import { POST as webhook } from '@/app/api/stripe-webhook/route'
import { POST as deleteAccount } from '@/app/api/delete-account/route'

const alice = '00000000-0000-4000-8000-000000000101'
const bob = '00000000-0000-4000-8000-000000000102'
const admin = '00000000-0000-4000-8000-000000000103'
const design = '10000000-0000-4000-8000-000000000101'
const generation = '20000000-0000-4000-8000-000000000101'
const board = '30000000-0000-4000-8000-000000000101'
let db, sessions
const as = (id, sql, args = []) => db.as(id ? 'authenticated' : 'anon', id, sql, args)
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0]
const profile = async () => (await db.query('select * from profiles_data where id=$1',[alice])).rows[0]
const attempt = async () => (await db.query('select * from subscription_checkouts where user_id=$1',[alice])).rows[0]
// SDK transport double only: all RPCs and mutations execute real migrated SQL,
// with the same service role as production. Unknown operations fail loudly.
const rpcSignatures = {
  reserve_subscription_checkout_v2: ['p_user_id','p_plan_id','p_email','p_base_url','p_price_id'],
  expire_subscription_checkout: ['p_user_id','p_id','p_session_id'],
  complete_onboarding: ['p_user_id','p_fields'],
  account_storage_objects: ['p_user_id'],
  delete_account: ['p_user_id'],
  begin_account_deletion: ['p_user_id'],
  resolve_subscription_price: ['p_price_id','p_plan_id'],
  subscription_owner_matches: ['p_subscription_id','p_customer_id','p_user_id'],
  claim_subscription_reconciliation: ['p_subscription_id','p_customer_id','p_user_id'],
  finish_subscription_reconciliation: ['p_subscription_id','p_token','p_event_id','p_plan_id','p_status','p_created','p_attempt_id','p_session_id'],
  release_subscription_reconciliation: ['p_subscription_id','p_token'],
}
const sdk = () => database(async q => {
  try {
    if (['deposit_checkouts','payment_checkouts'].includes(q.table) && q.operation==='select') return ok([])
    if (q.table === 'profiles_data' && q.operation === 'select') return ok(await profile())
    if (q.table === 'subscription_checkouts' && q.operation === 'select') return ok(await attempt() || null)
    if (q.table === 'subscription_checkouts' && q.operation === 'update') {
      const id = q.filters.find(f=>f[1]==='id')[2]
      const result = await db.as('service_role',null,'update subscription_checkouts set session_id=$1 where user_id=$2 and id=$3 returning id',[q.values.session_id,alice,id])
      return ok(result.rows[0])
    }
    throw new Error(`Unexpected query: ${q.table} ${q.operation}`)
  } catch (error) { return { data:null, error } }
}, async (name,args) => {
  const keys = rpcSignatures[name]
  if (!keys) throw new Error(`Unexpected RPC ${name}`)
  try {
    if(name==='account_storage_objects') return ok((await db.as('service_role',null,'select * from account_storage_objects($1)',[args.p_user_id])).rows)
    const result = await db.as('service_role',null,`select public.${name}(${keys.map((_,i)=>`$${i+1}`).join(',')}) as result`,keys.map(k=>args[k]))
    return ok(result.rows[0].result)
  } catch (error) { return {data:null,error} }
})
beforeAll(async () => { db = await createSecurityDatabase() },30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  vi.clearAllMocks()
  vi.spyOn(console,'error').mockImplementation(()=>{})
  await db.exec('truncate auth.users,public.profiles_data,public.designs,public.processed_webhook_events,public.products,public.collections,storage.objects cascade')
  await db.query('insert into auth.users(id) values ($1),($2),($3)',[alice,bob,admin])
  await db.query('update profiles_data set is_admin=true where id=$1',[admin])
  mocks.user.mockResolvedValue({id:alice,email:'alice@example.invalid'})
  Object.assign(mocks.client,sdk())
  mocks.client.storage={from:bucket=>({remove:vi.fn(async names=>{
    await db.query('delete from storage.objects where bucket_id=$1 and name=any($2)',[bucket,names])
    return ok(null)
  })})}
  sessions = new Map()
  mocks.create.mockImplementation(async (params,options) => {
    // Stripe's idempotency contract: one external session per stable key.
    if (!sessions.has(options.idempotencyKey)) sessions.set(options.idempotencyKey,{
      id:`cs_${sessions.size+1}`,url:`https://checkout.invalid/${sessions.size+1}`,mode:'subscription',status:'open',metadata:params.metadata,
    })
    return sessions.get(options.idempotencyKey)
  })
  mocks.session.mockImplementation(async id=>[...sessions.values()].find(s=>s.id===id))
  mocks.subscriptions.mockResolvedValue({data:[],has_more:false})
})

it('C12-01: concurrent first checkouts for different plans open only one payable session',async()=>{
  const results=await Promise.all(['premium','pro_creator'].map(planId=>subscribe(jsonRequest({planId}))))
  expect(results.map(r=>r.status).sort()).toEqual([200,409])
  expect(sessions.size).toBe(1)
  expect(await attempt()).toMatchObject({session_id:'cs_1'})
})
it('same-plan concurrency and later retries reuse one persisted session',async()=>{
  const results=await Promise.all([1,2].map(()=>subscribe(jsonRequest({planId:'premium'}))))
  expect(results.map(r=>r.status)).toEqual([200,200])
  expect(sessions.size).toBe(1)
  const first=await results[0].json()
  expect(await (await subscribe(jsonRequest({planId:'premium'}))).json()).toEqual(first)
  expect(new Set(mocks.create.mock.calls.map(c=>c[1].idempotencyKey)).size).toBe(1)
})
it('an ambiguous Stripe timeout retains the attempt and retries the same idempotency key',async()=>{
  const create=mocks.create.getMockImplementation()
  mocks.create.mockImplementationOnce(async(...args)=>{await create(...args);throw new Error('Connection lost after create')})
  expect((await subscribe(jsonRequest({planId:'premium'}))).status).toBe(500)
  const reserved=await attempt()
  expect(reserved.session_id).toBeNull()
  expect((await subscribe(jsonRequest({planId:'pro_creator'}))).status).toBe(409)
  expect((await subscribe(jsonRequest({planId:'premium'}))).status).toBe(200)
  expect((await attempt()).id).toBe(reserved.id)
  expect(sessions.size).toBe(1)
})
it('only confirmed session expiry releases a pending attempt',async()=>{
  await subscribe(jsonRequest({planId:'premium'}))
  const first=await attempt()
  const session=[...sessions.values()][0]
  session.status='complete'
  expect((await subscribe(jsonRequest({planId:'pro_creator'}))).status).toBe(409)
  expect((await attempt()).id).toBe(first.id)
  session.status='expired'
  expect((await subscribe(jsonRequest({planId:'pro_creator'}))).status).toBe(200)
  expect((await attempt()).id).not.toBe(first.id)
  expect(sessions.size).toBe(2)
  expect(await scalar('select expire_subscription_checkout($1,$2,$3)',[alice,first.id,first.session_id])).toBe(false)
})
it('does not reuse an unconfirmed creation after Stripe can prune its idempotency key',async()=>{
  await db.query("select reserve_subscription_checkout($1,'premium','old@example.invalid','https://old.invalid')",[alice])
  await db.query("update subscription_checkouts set created_at=now()-interval '24 hours'")
  expect((await subscribe(jsonRequest({planId:'premium'}))).status).toBe(503)
  expect(mocks.create).not.toHaveBeenCalled()
  expect(await attempt()).toBeTruthy()
})

it.each([['user',3],['creator',5],['salon',5]])('C12-02: onboarding preserves 40 purchased credits for a %s',async(type,grant)=>{
  await db.query('update profiles_data set account_type=$2,credit_balance=40 where id=$1',[alice,type])
  expect((await onboard(jsonRequest({display_name:'Alice',credit_balance:900,is_admin:true}))).status).toBe(200)
  expect(await profile()).toMatchObject({credit_balance:40+grant,onboarding_complete:true,is_admin:false,display_name:'Alice'})
  await db.query('update profiles_data set credit_balance=1 where id=$1',[alice])
  expect(await (await onboard(jsonRequest({display_name:'Changed'}))).json()).toMatchObject({alreadyCompleted:true})
  expect(await profile()).toMatchObject({credit_balance:1,display_name:'Alice'})
})
it('a purchase racing with two onboarding requests preserves the pack and grants the starter amount once',async()=>{
  const results=await Promise.all([
    onboard(jsonRequest({display_name:'Alice'})),onboard(jsonRequest({display_name:'Alice'})),
    db.as('service_role',null,"select apply_credit_payment('evt_pack','pi_pack',$1,40,'cs_pack')",[alice]),
  ])
  expect(results.slice(0,2).map(r=>r.status)).toEqual([200,200])
  expect(await profile()).toMatchObject({credit_balance:43,onboarding_complete:true})
})

const currentSubscription=(overrides={})=>({id:'sub_current',customer:'cus_current',status:'active',metadata:{userId:alice,planId:'premium'},items:{data:[{price:{id:'price_1TnxOq14PyqGjXgedydlYqto'}}]},...overrides})
async function lifecycle({id='evt_lifecycle',type='customer.subscription.deleted',created=200,subscription=currentSubscription({status:'canceled'})}={}) {
  mocks.subscription.mockResolvedValue(subscription)
  return webhook(jsonRequest({id,type,created,data:{object:subscription}}))
}
async function checkoutEvent({id='evt_checkout',created=100,subscription=currentSubscription()}={}) {
  const reserved=await attempt()
  mocks.subscription.mockResolvedValue(subscription)
  return webhook(jsonRequest({id,created,type:'checkout.session.completed',data:{object:{
    id:reserved.session_id,mode:'subscription',payment_status:'paid',customer:subscription.customer,subscription:subscription.id,
    metadata:{userId:alice,planId:'premium',checkoutAttemptId:reserved.id},
  }}}))
}
async function activate() {
  await subscribe(jsonRequest({planId:'premium'}))
  expect((await checkoutEvent()).status).toBe(200)
  expect(await profile()).toMatchObject({stripe_subscription_id:'sub_current',stripe_customer_id:'cus_current',subscription_tier:'premium',subscription_status:'active'})
}
it.each(['cus_old','cus_current'])('C12-03: cancellation of an old subscription for %s cannot remove the current plan',async customer=>{
  await activate()
  expect((await lifecycle({subscription:currentSubscription({id:'sub_old',customer,status:'canceled'})})).status).toBe(200)
  expect(await profile()).toMatchObject({subscription_tier:'premium',stripe_subscription_id:'sub_current',subscription_status:'active'})
})
it('current cancellation removes access once and stale activation/update cannot resurrect it',async()=>{
  await activate()
  await lifecycle()
  await lifecycle()
  expect(await profile()).toMatchObject({subscription_tier:null,subscription_status:'canceled',stripe_subscription_id:'sub_current'})
  await lifecycle({id:'evt_old_active',type:'customer.subscription.updated',created:99,subscription:currentSubscription()})
  expect((await profile()).subscription_tier).toBeNull()
  expect(await scalar("select count(*)::integer from processed_webhook_events where event_id='evt_lifecycle'")).toBe(1)
})
it('checkout delivered after cancellation reads current Stripe state and grants no access',async()=>{
  await subscribe(jsonRequest({planId:'premium'}))
  await lifecycle()
  expect((await checkoutEvent({subscription:currentSubscription({status:'canceled'})})).status).toBe(200)
  expect(await profile()).toMatchObject({subscription_tier:null,subscription_status:'canceled'})
})
it('a legitimate new checkout can replace a cancelled subscription, but its old cancellation cannot revoke the new plan',async()=>{
  await activate();await lifecycle()
  expect((await subscribe(jsonRequest({planId:'premium'}))).status).toBe(200)
  expect((await checkoutEvent({id:'evt_new_checkout',created:300,subscription:currentSubscription({id:'sub_new'})})).status).toBe(200)
  await lifecycle({id:'evt_old_cancel_late',created:400})
  expect(await profile()).toMatchObject({subscription_tier:'premium',stripe_subscription_id:'sub_new'})
})
it('subscription receipts roll back with a failed entitlement write so Stripe can retry',async()=>{
  await subscribe(jsonRequest({planId:'premium'}))
  expect((await checkoutEvent({subscription:currentSubscription({items:{data:[{price:{id:'price_unrecognized'}}]}})})).status).toBe(500)
  expect(await scalar("select count(*)::integer from processed_webhook_events where event_id='evt_checkout'")).toBe(0)
  expect(await attempt()).toBeTruthy()
  expect((await checkoutEvent()).status).toBe(200)
  expect((await profile()).subscription_tier).toBe('premium')
})
it('mismatched customer lifecycle events cannot change the current subscription',async()=>{
  await activate()
  await lifecycle({subscription:currentSubscription({customer:'cus_stranger',status:'canceled'})})
  expect((await profile()).subscription_tier).toBe('premium')
})

it('C12-04: deletes the owning account and its linked content while preserving another account and collection',async()=>{
  await db.query("insert into nail_lab_generations(id,user_id,image_url) values ($1,$2,'owned.png')",[generation,alice])
  await db.query("insert into designs(id,created_by,title,source_generation_id,is_published) values ($1,$2,'Owned',$3,true)",[design,alice,generation])
  await db.query("insert into design_images(design_id,image_url) values ($1,'owned.png')",[design])
  await db.query("insert into collections(id,user_id,name) values ($1,$2,'Keep collection')",[board,bob])
  await db.query('insert into collection_designs(collection_id,design_id) values ($1,$2)',[board,design])
  await db.query("insert into moodboards(id,user_id,name) values ($1,$2,'Keep board')",[board,bob])
  await db.query('insert into moodboard_members(moodboard_id,user_id,invited_by) values ($1,$2,$3)',[board,bob,alice])
  await as(bob,'insert into design_likes(user_id,design_id) values ($1,$2)',[bob,design])
  await db.query("select apply_credit_payment('evt_pack','pi_pack',$1,40,'cs_pack')",[alice])
  await as(alice,'select delete_own_account()')
  expect(await profile()).toBeUndefined()
  for (const table of ['designs','design_images','nail_lab_generations','collection_designs','moodboard_members','credit_payments','notifications','design_likes']) {
    expect(await scalar(`select count(*)::integer from ${table}`)).toBe(0)
  }
  expect(await scalar('select count(*)::integer from auth.users where id=$1',[alice])).toBe(0)
  expect(await scalar('select count(*)::integer from auth.users where id=$1',[bob])).toBe(1)
  expect(await scalar('select count(*)::integer from collections where id=$1',[board])).toBe(1)
  expect(await scalar('select count(*)::integer from moodboards where id=$1',[board])).toBe(1)
  expect(await scalar("select count(*)::integer from processed_webhook_events where event_id='evt_pack'")).toBe(1)
})
it('anonymous callers cannot delete accounts',async()=>{
  await expect(as(null,'select delete_own_account()')).rejects.toThrow()
  expect(await profile()).toBeTruthy()
})
it('an account deletion failure rolls back dependent row deletion',async()=>{
  await db.exec('create table deletion_blocker(user_id uuid references auth.users(id))')
  try {
    await db.query('insert into deletion_blocker values ($1)',[alice])
    await db.query("insert into designs(id,created_by,title) values ($1,$2,'Owned')",[design,alice])
    await expect(as(alice,'select delete_own_account()')).rejects.toThrow()
    expect(await profile()).toBeTruthy()
    expect(await scalar('select count(*)::integer from designs where id=$1',[design])).toBe(1)
  } finally { await db.exec('drop table deletion_blocker') }
})

it('C12-05: an authenticated admin can create, read drafts, edit and delete products',async()=>{
  const created=await as(admin,"insert into products(name,affiliate_url,is_published) values ('Test polish','https://example.invalid',false) returning id")
  expect(created.rows).toHaveLength(1)
  const id=created.rows[0].id
  expect((await as(admin,'select name from products where id=$1',[id])).rows).toEqual([{name:'Test polish'}])
  expect((await as(admin,"update products set name='Updated polish' where id=$1 returning name",[id])).rows).toEqual([{name:'Updated polish'}])
  expect(await scalar('select name from products where id=$1',[id])).toBe('Updated polish')
  expect((await as(admin,'delete from products where id=$1 returning id',[id])).rows).toHaveLength(1)
  expect(await scalar('select count(*)::integer from products where id=$1',[id])).toBe(0)
})
it.each([alice,null])('non-admin %s cannot mutate products or read drafts',async id=>{
  await db.query("insert into products(id,name,affiliate_url,is_published) values ($1,'Draft','https://example.invalid',false)",[design])
  await expect(as(id,"insert into products(name,affiliate_url) values ('Forged','https://example.invalid')")).rejects.toThrow()
  expect((await as(id,'select * from products')).rows).toHaveLength(0)
  expect((await as(id,"update products set name='Forged' returning id")).rows).toHaveLength(0)
  expect((await as(id,'delete from products returning id')).rows).toHaveLength(0)
  expect(await scalar('select name from products where id=$1',[design])).toBe('Draft')
})
it('C12-06: service-role bypass and successful write effects match production semantics',async()=>{
  expect((await db.query("select rolname,rolbypassrls from pg_roles where rolname in ('anon','authenticated','service_role') order by rolname")).rows).toEqual([
    {rolname:'anon',rolbypassrls:false},{rolname:'authenticated',rolbypassrls:false},{rolname:'service_role',rolbypassrls:true},
  ])
  expect((await db.as('service_role',null,"update profiles_data set bio='Real write' where id=$1 returning bio",[alice])).rows).toEqual([{bio:'Real write'}])
  expect((await profile()).bio).toBe('Real write')
})
it('browser roles cannot call the new privileged RPCs or mutate checkout attempts',async()=>{
  for (const role of ['anon','authenticated']) {
    for (const signature of ['account_storage_objects(uuid)','delete_account(uuid)','complete_onboarding(uuid,jsonb)','reserve_subscription_checkout(uuid,text,text,text)','expire_subscription_checkout(uuid,uuid,text)','apply_subscription_event(text,uuid,text,text,text,text,bigint,uuid,text)']) {
      expect(await scalar("select has_function_privilege($1,$2,'EXECUTE')",[role,signature])).toBe(false)
    }
    await expect(db.as(role,alice,"insert into subscription_checkouts(user_id,plan_id,base_url) values ($1,'premium','https://example.invalid')",[alice])).rejects.toThrow()
  }
})

it('cancellation racing with a stale checkout snapshot remains terminal',async()=>{
  await subscribe(jsonRequest({planId:'premium'}))
  await lifecycle()
  // Deliberately simulate an activation handler that fetched active state
  // before cancellation, but commits after the cancellation handler.
  expect((await checkoutEvent({subscription:currentSubscription()})).status).toBe(200)
  expect(await profile()).toMatchObject({subscription_tier:null,subscription_status:'canceled'})
})
it('account deletion removes only owned files through Storage and then removes the account',async()=>{
  await db.query("insert into storage.objects(bucket_id,name) values ('nail-lab',$1),('designs',$2),('designs',$3),('designs',$4),('designs',$5)",[
    `${alice}/private.png`,`avatars/${alice}/avatar.jpg`,`${alice}-upload.webp`,`challenges/challenge/${alice}-photo.webp`,`${bob}-keep.webp`,
  ])
  // Direct SQL deletion must not orphan actual object bytes.
  await expect(as(alice,'select delete_own_account()')).rejects.toThrow('ACCOUNT_FILES_REMAIN')
  expect((await deleteAccount(jsonRequest({userId:bob}))).status).toBe(200)
  expect(await profile()).toBeUndefined()
  expect((await db.query('select name from storage.objects')).rows).toEqual([{name:`${bob}-keep.webp`}])
  expect(await scalar('select count(*)::integer from auth.users where id=$1',[bob])).toBe(1)
})
it('a Storage failure preserves the account and a retry can complete cleanup',async()=>{
  await db.query("insert into storage.objects(bucket_id,name) values ('nail-lab',$1)",[`${alice}/owned.png`])
  const store=mocks.client.storage
  mocks.client.storage={from:()=>({remove:async()=>({error:new Error('Storage unavailable')})})}
  expect((await deleteAccount(jsonRequest({}))).status).toBe(503)
  expect(await profile()).toBeTruthy()
  expect(await scalar('select count(*)::integer from storage.objects')).toBe(1)
  mocks.client.storage=store
  expect((await deleteAccount(jsonRequest({}))).status).toBe(200)
  expect(await profile()).toBeUndefined()
})
it('cannot delete an account while its subscription or checkout is unresolved',async()=>{
  await subscribe(jsonRequest({planId:'premium'}))
  expect((await deleteAccount(jsonRequest({}))).status).toBe(409)
  await expect(as(alice,'select delete_own_account()')).rejects.toThrow('BILLING_IN_PROGRESS')
  await checkoutEvent()
  expect((await deleteAccount(jsonRequest({}))).status).toBe(409)
  expect(await profile()).toBeTruthy()
})
it('deletion removes legacy owned collections as well as their membership rows',async()=>{
  await db.query("insert into collections(id,user_id,name) values ($1,$2,'Owned collection')",[board,alice])
  await db.query("insert into designs(id,created_by,title) values ($1,$2,'Keep design')",[design,bob])
  await db.query('insert into collection_designs(collection_id,design_id) values ($1,$2)',[board,design])
  await as(alice,'select delete_own_account()')
  expect(await scalar('select count(*)::integer from collections')).toBe(0)
  expect(await scalar('select count(*)::integer from collection_designs')).toBe(0)
  expect(await scalar('select count(*)::integer from designs where id=$1',[design])).toBe(1)
})

it('an old event that observes a now-canceled current subscription still revokes access',async()=>{
  await activate()
  await lifecycle({id:'evt_old_observing_cancel',created:50})
  expect(await profile()).toMatchObject({subscription_tier:null,subscription_status:'canceled'})
})
it('expired pending checkout no longer prevents account deletion',async()=>{
  await subscribe(jsonRequest({planId:'premium'}))
  ;[...sessions.values()][0].status='expired'
  expect((await deleteAccount(jsonRequest({}))).status).toBe(200)
  expect(await profile()).toBeUndefined()
})
