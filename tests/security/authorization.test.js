import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'

const alice = '00000000-0000-4000-8000-000000000001'
const bob = '00000000-0000-4000-8000-000000000002'
const admin = '00000000-0000-4000-8000-000000000003'
const other = '00000000-0000-4000-8000-000000000004'
const design = '10000000-0000-4000-8000-000000000001'
const draft = '10000000-0000-4000-8000-000000000002'
const conversation = '20000000-0000-4000-8000-000000000001'
const message = '30000000-0000-4000-8000-000000000001'
const booking = '40000000-0000-4000-8000-000000000001'
const service = '50000000-0000-4000-8000-000000000001'
const board = '60000000-0000-4000-8000-000000000001'
let db
const as = (id, sql, args = []) => db.as(id ? 'authenticated' : 'anon', id, sql, args)
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0]
beforeAll(async () => { db = await createSecurityDatabase({ hardened: process.env.SECURITY_BASELINE !== '1' }) }, 30_000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec('truncate auth.users, public.profiles_data, public.designs cascade')
  await db.query('insert into auth.users(id) values ($1),($2),($3),($4)', [alice, bob, admin, other])
  await db.query("update public.profiles_data set account_type='creator', credit_balance=10, onboarding_complete=true, phone_number='private phone', email='private@example.invalid'")
  await db.query('update public.profiles_data set is_admin=true where id=$1', [admin])
  await db.query("insert into public.designs(id,title,created_by,is_published) values ($1,'Visible',$3,true),($2,'Draft',$3,false)", [design, draft, alice])
  await db.query('insert into public.conversations(id,client_id,creator_id) values ($1,$2,$3)', [conversation, alice, bob])
  await db.query("insert into public.messages(id,conversation_id,sender_id,content) values ($1,$2,$3,'Original')", [message, conversation, alice])
  await db.query("insert into public.services(id,creator_id,name,duration_minutes,price) values ($1,$2,'Manicure',60,100)", [service,bob])
  await db.query("insert into public.availability(creator_id,day_of_week,start_time,end_time) select $1,generate_series(0,6),'09:00'::time,'17:00'::time", [bob])
  await db.query("insert into public.bookings(id,client_id,creator_id,service_id,booking_date,start_time,end_time) values ($1,$2,$3,$4,current_date+1,'10:00','11:00')", [booking,alice,bob,service])
  await db.query("insert into public.moodboards(id,user_id,name) values ($1,$2,'Private board')", [board,alice])
})

it('keeps credit RPCs inaccessible to browser roles, including negative debits', async () => {
  for (const role of ['anon','authenticated']) {
    for (const name of ['increment_credits(uuid,integer)','decrement_credits(uuid)','decrement_credits_by(uuid,integer)']) {
      expect(await scalar("select has_function_privilege($1,$2,'EXECUTE')", [role, name])).toBe(false)
    }
  }
  await expect(db.as('service_role', null, 'select public.increment_credits($1,-10)', [alice])).rejects.toThrow()
  expect(await scalar('select credit_balance from public.profiles_data where id=$1',[alice])).toBe(10)
})

it('prevents browser profile writes while preserving masked profile reads and trusted writes', async () => {
  await expect(as(alice,"update public.profiles set stripe_customer_id='cus_someone_else', onboarding_complete=false where id=$1",[alice])).rejects.toThrow()
  await expect(as(alice,"update public.profiles_data set is_verified=true where id=$1",[alice])).rejects.toThrow()
  const own = (await as(alice,'select email,credit_balance from public.profiles where id=$1',[alice])).rows[0]
  const stranger = (await as(bob,'select email,credit_balance,is_admin from public.profiles where id=$1',[alice])).rows[0]
  expect(own.credit_balance).toBe(10)
  expect(stranger).toEqual({email:null,credit_balance:null,is_admin:null})
  const updated = await db.as('service_role',null,"update public.profiles_data set bio='Allowed API edit' where id=$1 returning bio",[alice])
  expect(updated.rows).toEqual([{bio:'Allowed API edit'}])
  expect(await scalar('select bio from public.profiles_data where id=$1',[alice])).toBe('Allowed API edit')
})

it('generation records and retry flags can only be changed by trusted service paths', async () => {
  await db.query('insert into nail_lab_generations(id,user_id,image_url) values ($1,$2,$3)',[draft,alice,`${alice}/owned.png`])
  expect((await as(alice,'select * from nail_lab_generations')).rows).toHaveLength(1)
  expect((await as(bob,'select * from nail_lab_generations')).rows).toHaveLength(0)
  await expect(as(alice,'update nail_lab_generations set image_url=$1,free_regen_used=false where id=$2',[`${bob}/private.png`,draft])).rejects.toThrow()
  await expect(as(alice,'insert into nail_lab_generations(user_id) values ($1)',[alice])).rejects.toThrow()
})

it('cannot replace conversation participants or rewrite another person’s message', async () => {
  await expect(as(alice,'update conversations set creator_id=$1 where id=$2',[other,conversation])).rejects.toThrow()
  await expect(as(alice,"update conversations set last_message_at=now()+interval '1 year' where id=$1",[conversation])).rejects.toThrow()
  await expect(as(bob,"update messages set content='Rewritten', sender_id=$1 where id=$2",[bob,message])).rejects.toThrow()
  expect((await as(other,'select * from messages')).rows).toHaveLength(0)
  await as(bob,'update messages set is_read=true where id=$1',[message])
  expect(await scalar('select is_read from messages where id=$1',[message])).toBe(true)
})

it('honors blocked and disabled messaging at the database boundary', async () => {
  await db.query("update profiles_data set message_permission='none' where id=$1",[bob])
  await expect(as(alice,"insert into messages(conversation_id,sender_id,content) values ($1,$2,'Disallowed')",[conversation,alice])).rejects.toThrow()
  await db.query("update profiles_data set message_permission='everyone' where id=$1",[bob])
  await db.query('insert into blocks(blocker_id,blocked_id) values ($1,$2)',[bob,alice])
  await expect(as(alice,"insert into messages(conversation_id,sender_id,content) values ($1,$2,'Blocked')",[conversation,alice])).rejects.toThrow()
})

it('booking participants cannot forge payment or change ownership, but can use their allowed status transitions', async () => {
  for (const user of [alice,bob]) await expect(as(user,'update bookings set deposit_paid=true where id=$1',[booking])).rejects.toThrow()
  await expect(as(alice,"update bookings set status='confirmed' where id=$1",[booking])).rejects.toThrow()
  await expect(as(bob,'update bookings set client_id=$1 where id=$2',[other,booking])).rejects.toThrow()
  await as(bob,"update bookings set status='confirmed' where id=$1",[booking])
  await as(alice,"update bookings set status='cancelled' where id=$1",[booking])
  expect(await scalar('select status from bookings where id=$1',[booking])).toBe('cancelled')
})

it('new bookings cannot forge a paid deposit or target a service belonging to another creator', async () => {
  await expect(as(alice,"insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,deposit_paid) values ($1,$2,$3,current_date+1,'12:00','13:00',true)",[alice,bob,service])).rejects.toThrow()
  await expect(as(alice,"insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time) values ($1,$2,$3,current_date+1,'12:00','13:00')",[alice,other,service])).rejects.toThrow()
})

it('only the actual board owner can invite a member', async () => {
  await expect(as(bob,'insert into moodboard_members(moodboard_id,user_id,invited_by) values ($1,$2,$3)',[board,other,bob])).rejects.toThrow()
  await as(alice,'insert into moodboard_members(moodboard_id,user_id,invited_by) values ($1,$2,$3)',[board,bob,alice])
})

it('draft image and metadata rows follow the parent design visibility', async () => {
  await db.query("insert into design_images(design_id,image_url) values ($1,'private-image'),($2,'public-image')",[draft,design])
  expect((await as(bob,'select image_url from design_images')).rows).toEqual([{image_url:'public-image'}])
  expect((await as(alice,'select image_url from design_images')).rows).toHaveLength(2)
  await expect(as(bob,'insert into design_likes(user_id,design_id) values ($1,$2)',[bob,draft])).rejects.toThrow()
})

it('creators cannot set paid promotion, curation, source generation or engagement counters', async () => {
  await expect(as(alice,'update designs set is_curated=true,boosted_until=now()+interval \'7 days\',likes_count=999 where id=$1',[design])).rejects.toThrow()
  await expect(as(alice,"insert into designs(title,created_by,is_curated) values ('Forged',$1,true)",[alice])).rejects.toThrow()
  await as(alice,"update designs set title='My edit' where id=$1",[design])
  await as(admin,'update designs set is_curated=true where id=$1',[design])
})

it('engagement counters track real rows atomically and cannot be inflated by RPC calls', async () => {
  await as(bob,'insert into design_likes(user_id,design_id) values ($1,$2)',[bob,design])
  expect(await scalar('select likes_count from designs where id=$1',[design])).toBe(1)
  await expect(as(bob,'select increment_likes($1)',[design])).rejects.toThrow()
  await expect(as(null,'select decrement_saves($1)',[design])).rejects.toThrow()
  await as(bob,'delete from design_likes where user_id=$1 and design_id=$2',[bob,design])
  expect(await scalar('select likes_count from designs where id=$1',[design])).toBe(0)
})

it('private storage reads require the matching owner prefix', async () => {
  await db.exec('truncate storage.objects')
  await db.query("insert into storage.objects(bucket_id,name) values ('nail-lab',$1),('nail-lab',$2)",[`${alice}/a.png`,`${bob}/b.png`])
  expect((await as(alice,'select name from storage.objects')).rows).toEqual([{name:`${alice}/a.png`}])
  expect((await as(null,'select name from storage.objects')).rows).toHaveLength(0)
})

it('generates one notification from a real action and rejects forged notifications', async () => {
  await db.exec('truncate public.notifications')
  await expect(as(alice,"insert into notifications(user_id,actor_id,type) values ($1,$2,'appointment_reminder')",[bob,alice])).rejects.toThrow()
  await as(bob,'insert into design_likes(user_id,design_id) values ($1,$2)',[bob,design])
  expect((await as(alice,'select user_id,actor_id,type from notifications')).rows).toEqual([{user_id:alice,actor_id:bob,type:'like'}])
  await as(alice,'update notifications set read=true')
  await expect(as(alice,"update notifications set type='booking_confirmed'")).rejects.toThrow()
})

it('rejects reviews of another client’s appointment and preserves legitimate review edits', async () => {
  await db.query("update bookings set booking_date=current_date-1,status='confirmed' where id=$1",[booking])
  await expect(as(other,'insert into reviews(booking_id,reviewer_id,creator_id,rating) values ($1,$2,$3,5)',[booking,other,bob])).rejects.toThrow()
  await as(alice,'insert into reviews(booking_id,reviewer_id,creator_id,rating) values ($1,$2,$3,5)',[booking,alice,bob])
  await as(alice,"update reviews set text='Updated review',rating=4 where booking_id=$1",[booking])
  await expect(as(alice,'update reviews set creator_id=$1 where booking_id=$2',[other,booking])).rejects.toThrow()
})

it('reserves the final weekly upload slot once under concurrent requests', async () => {
  await db.query('update profiles_data set weekly_uploads=4,week_reset_at=now() where id=$1',[alice])
  const results=await Promise.allSettled([1,2].map(n=>as(alice,'insert into designs(title,created_by) values ($1,$2)',[`Concurrent ${n}`,alice])))
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
  expect(await scalar('select weekly_uploads from profiles_data where id=$1',[alice])).toBe(5)
})

it('concurrent reactions increment counters without losing an update', async () => {
  await Promise.all([bob,other].map(id=>as(id,'insert into design_likes(user_id,design_id) values ($1,$2)',[id,design])))
  expect(await scalar('select likes_count from designs where id=$1',[design])).toBe(2)
})

it('all exposed definer routines pin search_path and browser roles cannot create shadow objects', async () => {
  expect((await db.query("select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and prosecdef and not exists(select from unnest(proconfig) c where c like 'search_path=%')")).rows).toEqual([])
  expect(await scalar("select has_schema_privilege('authenticated','public','CREATE')")).toBe(false)
  expect(await scalar("select has_schema_privilege('anon','public','CREATE')")).toBe(false)
})

it('design insertion enforces the creator role even when bypassing the upload page', async () => {
  await db.query("update profiles_data set account_type='user' where id=$1",[other])
  await expect(as(other,"insert into designs(title,created_by) values ('Not a creator',$1)",[other])).rejects.toThrow()
})

it('retains the service-only reservation and generation workflow after hardening', async () => {
  const reservation='70000000-0000-4000-8000-000000000001'
  expect((await db.as('service_role',null,'select reserve_generation($1,$2,null) as ok',[reservation,alice])).rows[0].ok).toBe(true)
  await db.as('service_role',null,'select complete_generation($1,$2)',[reservation,JSON.stringify({image_url:`${alice}/test.png`})])
  expect((await as(alice,'select id from nail_lab_generations')).rows).toEqual([{id:reservation}])
  expect(await scalar('select credit_balance from profiles_data where id=$1',[alice])).toBe(9)
})
