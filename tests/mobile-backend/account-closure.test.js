import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'
const client='00000000-0000-4000-8000-000000000901', creator='00000000-0000-4000-8000-000000000902', other='00000000-0000-4000-8000-000000000903', service='00000000-0000-4000-8000-000000000904', booking='00000000-0000-4000-8000-000000000905', design='00000000-0000-4000-8000-000000000906'
let db
beforeAll(async()=>{db=await createSecurityDatabase()},30000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{
 await db.exec('truncate auth.users,profiles_data,account_legal_records cascade')
 await db.query('insert into auth.users(id) values($1),($2),($3)',[client,creator,other])
 await db.query("update profiles_data set display_name='Customer',bio='Private bio',allergies='sensitive',onboarding_complete=true where id=$1",[client])
 await db.query("update profiles_data set account_type='creator',booking_area='Studio' where id=$1",[creator])
 await db.query("insert into services(id,creator_id,name,duration_minutes,price,deposit_amount) values($1,$2,'Nails',30,100,20)",[service,creator])
 await db.query("insert into availability(creator_id,day_of_week,start_time,end_time) select $1,generate_series(0,6),'00:00'::time,'23:59'::time",[creator])
 await db.query("insert into creator_booking_settings values($1,'Asia/Dubai')",[creator])
 await db.query("insert into designs(id,created_by,title,is_published) values($1,$2,'Mine',true)",[design,client])
})
const close=id=>db.as('service_role',null,'select close_account($1)',[id])
const book=()=>db.as('authenticated',client,"insert into bookings(id,client_id,creator_id,service_id,booking_date,start_time,end_time,time_zone) values($1,$2,$3,$4,current_date+2,'10:00','10:30','Asia/Dubai')",[booking,client,creator,service])
it('closes immediately despite a pending purchase, hides public content and scrubs personal fields',async()=>{
 await db.query("insert into payment_checkouts(user_id,scope,params) values($1,'credits','{}')",[client])
 await close(client)
 expect((await db.query('select display_name,bio,allergies,deletion_started_at from profiles_data where id=$1',[client])).rows[0]).toMatchObject({display_name:'Deleted account',bio:null,allergies:null,deletion_started_at:expect.anything()})
 for(const role of ['anon','authenticated']) {
  expect((await db.as(role,role==='anon'?null:other,'select id from profiles where id=$1',[client])).rows).toEqual([])
  expect((await db.as(role,role==='anon'?null:other,'select id from designs where id=$1',[design])).rows).toEqual([])
 }
 expect((await db.query('select count(*)::int n from payment_checkouts where user_id=$1',[client])).rows[0].n).toBe(1)
})
it('denies stale-token reads, writes and new bookings while workers can settle money',async()=>{
 await close(client)
 expect((await db.as('authenticated',client,'select id from profiles')).rows).toEqual([])
 await expect(book()).rejects.toThrow(/ACCOUNT_CLOSED|row-level security/)
 await expect(db.as('authenticated',client,"insert into follows(follower_id,following_id) values($1,$2)",[client,other])).rejects.toThrow(/ACCOUNT_CLOSED|row-level security/)
 await expect(db.as('authenticated',client,'select close_account($1)',[other])).rejects.toThrow(/permission denied/)
 expect((await db.as('service_role',null,"select reserve_generation($1,$2)",[booking,client])).rows[0].reserve_generation).toBe(false)
})
it('cancellation commits a full-refund obligation without waiting for Stripe',async()=>{
 await book()
 await db.query("insert into order_payments(payment_intent,user_id,kind,target_id,fulfilled) values('pi_closure',$1,'deposit',$2,true)",[client,booking])
 await close(client)
 expect((await db.query('select status from bookings where id=$1',[booking])).rows[0].status).toBe('cancelled')
 expect((await db.query("select refund_required,refund_reconciliation_pending from order_payments where payment_intent='pi_closure'")).rows[0]).toEqual({refund_required:true,refund_reconciliation_pending:true})
 await expect(db.as('service_role',null,'select delete_account($1)',[client])).rejects.toThrow(/BILLING_IN_PROGRESS|RETENTION_REVIEW_REQUIRED/)
})
it('closure retries are idempotent and cleanup claims are exclusive',async()=>{
 await close(client);await close(client)
 expect((await db.query('select count(*)::int n from account_closures')).rows[0].n).toBe(1)
 expect((await db.as('service_role',null,'select * from claim_account_cleanup(3)')).rows).toHaveLength(1)
 expect((await db.as('service_role',null,'select * from claim_account_cleanup(3)')).rows).toHaveLength(0)
})
it('erases ordinary saved content without discarding a pending financial target',async()=>{
 await db.query('insert into saved_designs(user_id,design_id) values($1,$2)',[client,design])
 await db.query("insert into payment_checkouts(user_id,scope,params,design_id) values($1,'boost','{}',$2)",[client,design])
 await close(client)
 await db.as('service_role',null,'select erase_closed_account_content($1)',[client])
 expect((await db.query('select * from saved_designs where user_id=$1',[client])).rows).toHaveLength(0)
 expect((await db.query('select id from designs where id=$1',[design])).rows).toHaveLength(1)
})
it('restricted retention records are unavailable to both owner and stranger',async()=>{
 await db.query("insert into account_retention_holds(user_id,category,basis,retain_until,review_at) values($1,'financial','Specific tax record requirement',now()+interval '7 years',now()+interval '1 year')",[client])
 for(const id of [client,other]) await expect(db.as('authenticated',id,'select * from account_retention_holds')).rejects.toThrow(/permission denied/)
 await expect(db.as('service_role',null,'select delete_account($1)',[client])).rejects.toThrow('RETENTION_IN_PROGRESS')
})
it('a closed creator cannot be booked or have existing requests confirmed',async()=>{
 await book();await close(creator)
 await expect(db.as('service_role',null,"update bookings set status='confirmed' where id=$1",[booking])).rejects.toThrow('ACCOUNT_CLOSED')
 expect((await db.as('anon',null,'select * from services where creator_id=$1',[creator])).rows).toHaveLength(0)
})
it('accounts with no outstanding obligations can be physically erased after cleanup',async()=>{
 await close(client)
 await db.as('service_role',null,'select erase_closed_account_content($1)',[client])
 await db.as('service_role',null,'select delete_account($1)',[client])
 expect((await db.query('select * from auth.users where id=$1',[client])).rows).toHaveLength(0)
})
it('a delayed deposit for a closed customer remains refundable and is never lost',async()=>{
 await book(); await close(client)
 await db.as('service_role',null,"select apply_order_payment('evt_after_closure','pi_after_closure',$1,'deposit',$2,0,'cs_after_closure')",[client,booking])
 expect((await db.query("select refund_required,needs_review from order_payments where payment_intent='pi_after_closure'")).rows[0]).toEqual({refund_required:true,needs_review:true})
})
it('legal evidence is limited to explicitly preserved records and expires independently of account deletion',async()=>{
 const insert="insert into account_legal_records(subject_id,case_reference,basis,record_scope,evidence,retain_until,review_at) values($1,$2,'Documented legal claim','Selected booking receipt','{}',$3,$4)"
 await db.query(insert,[client,'active',new Date(Date.now()+86400000),new Date()])
 await db.query(insert,[client,'expired',new Date(Date.now()-86400000),new Date(Date.now()-172800000)])
 await close(client);await db.as('service_role',null,'select erase_closed_account_content($1)',[client]);await db.as('service_role',null,'select delete_account($1)',[client])
 expect((await db.query('select count(*)::int n from account_legal_records')).rows[0].n).toBe(2)
 await expect(db.as('authenticated',other,'select * from account_legal_records')).rejects.toThrow(/permission denied/)
 await expect(db.as('authenticated',other,'select purge_expired_account_legal_records()')).rejects.toThrow(/permission denied/)
 await db.as('service_role',null,'select purge_expired_account_legal_records()')
 expect((await db.query('select case_reference from account_legal_records')).rows).toEqual([{case_reference:'active'}])
})
it.skipIf(!process.env.DATABASE_TEST_URL)('racing closure with a booking cannot leave an active appointment',async()=>{
 const results=await Promise.allSettled([close(client),book()])
 expect(results[0].status).toBe('fulfilled')
 expect((await db.query("select id from bookings where client_id=$1 and status in ('pending','confirmed')",[client])).rows).toEqual([])
})
it('creator deletion preserves receipts from appointments paid for by clients',async()=>{
 await book()
 await db.as('service_role',null,"select apply_order_payment('evt_creator_receipt','pi_creator_receipt',$1,'deposit',$2,0,'cs_creator_receipt',true)",[client,booking])
 await close(creator)
 await expect(db.as('service_role',null,'select delete_account($1)',[creator])).rejects.toThrow('RETENTION_REVIEW_REQUIRED')
 expect((await db.query("select payment_intent from order_payments where payment_intent='pi_creator_receipt'")).rows).toHaveLength(1)
})
