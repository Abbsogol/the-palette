import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'
const client='00000000-0000-4000-8000-000000000611', creator='00000000-0000-4000-8000-000000000612', service='00000000-0000-4000-8000-000000000613'
let db
beforeAll(async()=>{db=await createSecurityDatabase()},30000)
afterAll(async()=>{await db?.close()})
beforeEach(async()=>{
  await db.exec('truncate auth.users,profiles_data cascade')
  await db.query('insert into auth.users(id) values($1),($2)',[client,creator])
  await db.query("update profiles_data set account_type='creator' where id=$1",[creator])
  await db.query("insert into services(id,creator_id,name,duration_minutes,price,deposit_amount) values($1,$2,'Manicure',30,100,20)",[service,creator])
  await db.query("insert into availability(creator_id,day_of_week,start_time,end_time) select $1,generate_series(0,6),'00:00'::time,'23:59'::time",[creator])
  // Allows reproducing the pre-migration defect with the actual old schema.
  if((await db.query("select to_regclass('public.creator_booking_settings') as name")).rows[0].name)
    await db.query("insert into creator_booking_settings(creator_id,time_zone) values($1,'UTC')",[creator])
})
const book=(date,start='10:00',end='10:30')=>db.as('authenticated',client,
  "insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,status) values($1,$2,$3,$4,$5,$6,'pending') returning *",[client,creator,service,date,start,end])
it('rejects yesterday in the creator zone even though Phase 5 permitted yesterday UTC',async()=>{
  const {rows:[{day}]}=await db.query("select (current_date-1)::text as day")
  await expect(book(day)).rejects.toThrow()
  expect((await db.query('select count(*)::int as n from bookings')).rows[0].n).toBe(0)
})
it('rejects a same-day slot that has already started',async()=>{
  const {rows:[slot]}=await db.query("select d::date::text as day,d::time::text as start,(d+interval '30 minutes')::time::text as finish from (select date_trunc('hour',now() at time zone 'UTC')-interval '1 hour' as d) s")
  await expect(book(slot.day,slot.start,slot.finish)).rejects.toThrow()
})

it('a creator cannot confirm a pending request after its actual start, but the client can still cancel',async()=>{
  const {rows:[booking]}=await db.query(`insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,time_zone)
    select $1,$2,$3,d::date,d::time,(d+interval '30 minutes')::time,'UTC'
    from (select date_trunc('hour',now() at time zone 'UTC')-interval '2 hours' d) s returning id`,[client,creator,service])
  await expect(db.as('authenticated',creator,"update bookings set status='confirmed' where id=$1",[booking.id])).rejects.toThrow('BOOKING_DATE_UNAVAILABLE')
  await db.as('authenticated',client,"update bookings set status='cancelled' where id=$1",[booking.id])
  expect((await db.query('select status from bookings where id=$1',[booking.id])).rows[0].status).toBe('cancelled')
})

it('deposit eligibility uses the saved instant rather than the UTC calendar day',async()=>{
  // Both local dates can differ from UTC; the same-day past appointment fails.
  for(const [zone,offset,allowed] of [['America/Los_Angeles',2,true],['Pacific/Kiritimati',-2,false]]){
    const {rows:[booking]}=await db.query(`insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,time_zone,status)
      select $1,$2,$3,d::date,d::time,(d+interval '30 minutes')::time,$4,'confirmed'
      from (select date_trunc('hour',now() at time zone $4)+$5::integer*interval '1 hour' d) s returning id`,[client,creator,service,zone,offset])
    const result=db.as('service_role',null,'select reserve_deposit_checkout($1,$2,$3)',[client,booking.id,'https://example.test'])
    if(allowed) await expect(result).resolves.toBeDefined()
    else await expect(result).rejects.toThrow('BOOKING_NOT_PAYABLE')
  }
  expect((await db.query('select count(*)::int n from deposit_checkouts')).rows[0].n).toBe(1)
})

it('a review is allowed only after the actual end, with immutable booking identity',async()=>{
  for(const [offset,allowed] of [[2,false],[-2,true]]){
    const {rows:[booking]}=await db.query(`insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,time_zone,status)
      select $1,$2,$3,d::date,d::time,(d+interval '30 minutes')::time,'Pacific/Kiritimati','confirmed'
      from (select date_trunc('hour',now() at time zone 'Pacific/Kiritimati')+$4::integer*interval '1 hour' d) s returning id`,[client,creator,service,offset])
    const result=db.as('authenticated',client,'insert into reviews(booking_id,reviewer_id,creator_id,rating) values($1,$2,$3,5)',[booking.id,client,creator])
    if(allowed) await expect(result).resolves.toBeDefined()
    else await expect(result).rejects.toThrow()
  }
  expect((await db.query('select count(*)::int n from reviews')).rows[0].n).toBe(1)
})

it('reminders choose tomorrow in the saved zone, are idempotent, and skip cancelled jobs',async()=>{
  const ids=[]
  for(const zone of ['Pacific/Kiritimati','America/Los_Angeles']){
    const {rows:[booking]}=await db.query(`insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,time_zone,status)
      values($1,$2,$3,(now() at time zone $4)::date+1,'10:00','10:30',$4,'confirmed') returning id`,[client,creator,service,zone])
    ids.push(booking.id)
  }
  // The legacy UTC parameter must not override the appointment's saved zone.
  expect((await db.as('service_role',null,"select enqueue_booking_reminders(current_date-100) n")).rows[0].n).toBe(2)
  expect((await db.as('service_role',null,"select enqueue_booking_reminders(current_date+100) n")).rows[0].n).toBe(0)
  expect((await db.query("select count(*)::int n from notifications where type='appointment_reminder'")).rows[0].n).toBe(4)
  await db.as('authenticated',client,"update bookings set status='cancelled' where id=$1",[ids[0]])
  const {rows:[{jobs}]}=await db.as('service_role',null,'select claim_reminder_emails() jobs')
  expect(jobs).toHaveLength(2)
  expect(jobs.every(job=>job.time_zone==='America/Los_Angeles'&&job.booking_id===ids[1])).toBe(true)
  expect((await db.query("select count(*)::int n from reminder_emails where status='skipped'")).rows[0].n).toBe(2)
})

it('concurrent clients cannot create duplicate reservations across the timezone boundary',async()=>{
  await db.query("update creator_booking_settings set time_zone='Asia/Dubai' where creator_id=$1",[creator])
  const {rows:[{day}]}=await db.query("select ((now() at time zone 'Asia/Dubai')::date+2)::text as day")
  const results=await Promise.allSettled([book(day),book(day)])
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1)
  const {rows}=await db.query('select time_zone,starts_at,ends_at from bookings')
  expect(rows).toHaveLength(1)
  expect(rows[0].time_zone).toBe('Asia/Dubai')
  expect(new Date(rows[0].starts_at).getUTCHours()).toBe(6)
})

it('direct booking obeys the same private-creator follower requirement as the UI',async()=>{
  await db.query('update profiles_data set is_private=true where id=$1',[creator])
  const {rows:[{day}]}=await db.query('select (current_date+2)::text as day')
  await expect(book(day)).rejects.toThrow('CREATOR_NOT_BOOKABLE')
  expect((await db.query('select count(*)::int n from bookings')).rows[0].n).toBe(0)
  await db.as('authenticated',client,'insert into follows(follower_id,following_id) values($1,$2)',[client,creator])
  await expect(book(day)).resolves.toBeDefined()
})
