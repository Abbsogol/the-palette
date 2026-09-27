import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'
const client = '00000000-0000-4000-8000-000000000601'
const creator = '00000000-0000-4000-8000-000000000602'
const service = '00000000-0000-4000-8000-000000000603'
let db
beforeAll(async () => { db = await createSecurityDatabase() }, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec('truncate auth.users,profiles_data cascade')
  await db.query('insert into auth.users(id) values ($1),($2)', [client, creator])
  await db.query("update profiles_data set account_type='creator' where id=$1", [creator])
  await db.query("insert into services(id,creator_id,name,duration_minutes,price) values ($1,$2,'Manicure',60,100)", [service, creator])
  await db.query("insert into availability(creator_id,day_of_week,start_time,end_time) select $1,generate_series(0,6),'09:00'::time,'17:00'::time", [creator])
  await db.query("insert into creator_booking_settings(creator_id,time_zone) values($1,'UTC')",[creator])
})
const book = (day=1,start='10:00',end='11:00',role='authenticated',who=client) => db.as(role,who,
  "insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,status) values ($1,$2,$3,current_date+$4::integer,$5,$6,'pending') returning id", [client,creator,service,day,start,end])
it.each([[-2,'10:00','11:00'],[1,'08:00','09:00'],[1,'16:30','17:30'],[1,'10:15','11:15']])('a direct client cannot book outside offered dates or slots (%s %s)', async (day,start,end) => {
  await expect(book(day,start,end)).rejects.toThrow()
  expect((await db.query('select count(*)::integer as n from bookings')).rows[0].n).toBe(0)
  expect((await db.query("select count(*)::integer as n from notifications where type='booking_request'")).rows[0].n).toBe(0)
})
it('a direct client cannot book an inactive or missing availability day', async () => {
  await db.query('update availability set is_active=false where creator_id=$1',[creator])
  await expect(book()).rejects.toThrow()
  await db.query('delete from availability where creator_id=$1',[creator])
  await expect(book()).rejects.toThrow()
})
it('an offered slot commits one booking and owner/client visibility, but no stranger or anonymous access', async () => {
  const result = await book()
  expect(result.rows).toHaveLength(1)
  expect((await db.as('authenticated',creator,'select id from bookings')).rows).toHaveLength(1)
  expect((await db.as('anon',null,'select id from bookings')).rows).toHaveLength(0)
  await expect(book(1,'11:00','12:00','authenticated',creator)).rejects.toThrow()
})
it('existing appointments remain cancellable when the creator changes availability', async () => {
  const {rows:[{id}]} = await book()
  await db.query('delete from availability where creator_id=$1',[creator])
  await db.as('authenticated',client,"update bookings set status='cancelled' where id=$1",[id])
  expect((await db.query('select status from bookings where id=$1',[id])).rows[0].status).toBe('cancelled')
})
it('two concurrent requests for the same offered slot still commit at most once', async () => {
  const results=await Promise.allSettled([book(),book()])
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1)
  expect((await db.query('select count(*)::integer as n from bookings')).rows[0].n).toBe(1)
})
