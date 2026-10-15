import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'

const client = '00000000-0000-4000-8000-000000000631'
const creator = '00000000-0000-4000-8000-000000000632'
const stranger = '00000000-0000-4000-8000-000000000633'
const service = '00000000-0000-4000-8000-000000000634'
let db
beforeAll(async () => { db = await createSecurityDatabase() }, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec('truncate auth.users,profiles_data cascade')
  await db.query('insert into auth.users(id) values($1),($2),($3)', [client, creator, stranger])
  await db.query("update profiles_data set account_type='creator' where id=$1", [creator])
  await db.query("insert into services(id,creator_id,name,duration_minutes,price,deposit_amount) values($1,$2,'Manicure',30,100,20)", [service, creator])
})
const schedule = (start='00:00', end='23:59') => Array.from({ length: 7 }, (_, day_of_week) => ({ day_of_week, start_time: start, end_time: end, is_active: true }))
const save = (zone='UTC', hours=schedule()) => db.as('service_role', null, 'select save_creator_availability($1,$2,$3)', [creator, zone, JSON.stringify(hours)])
const book = (start='10:00', end='10:30') => db.as('authenticated', client,
  "insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time) values($1,$2,$3,current_date+2,$4,$5) returning *", [client, creator, service, start, end])

it('a failed seven-day save rolls back every earlier day and the zone', async () => {
  await save('Asia/Dubai', schedule('09:00', '17:00'))
  const invalid = schedule('08:00', '19:00')
  invalid[6].end_time = '07:00'
  await expect(save('America/New_York', invalid)).rejects.toThrow()
  expect((await db.query('select distinct start_time::text,end_time::text from availability')).rows).toEqual([{ start_time: '09:00:00', end_time: '17:00:00' }])
  expect((await db.query('select time_zone from creator_booking_settings')).rows).toEqual([{ time_zone: 'Asia/Dubai' }])
})

it('anonymous and authenticated callers cannot invoke the service-owned schedule function', async () => {
  for (const [role, id] of [['anon', null], ['authenticated', creator], ['authenticated', stranger]]) {
    await expect(db.as(role, id, 'select save_creator_availability($1,$2,$3)', [creator, 'UTC', JSON.stringify(schedule())])).rejects.toThrow(/permission denied/)
  }
  expect((await db.query('select count(*)::int n from availability')).rows[0].n).toBe(0)
})

it('snapshots the creator zone and ignores forged booking instants', async () => {
  await save('Asia/Dubai')
  const { rows: [booking] } = await db.as('authenticated', client,
    `insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,time_zone,starts_at,ends_at)
     values($1,$2,$3,current_date+2,'10:00','10:30','Asia/Dubai',now()+interval '1 year',now()+interval '2 years') returning *`, [client, creator, service])
  expect(booking.time_zone).toBe('Asia/Dubai')
  expect(new Date(booking.starts_at).getUTCHours()).toBe(6)
  await save('America/New_York')
  const { rows: [persisted] } = await db.query('select time_zone,starts_at from bookings where id=$1', [booking.id])
  expect(persisted.time_zone).toBe('Asia/Dubai')
  expect(new Date(persisted.starts_at).valueOf()).toBe(new Date(booking.starts_at).valueOf())
  await expect(db.as('authenticated', client, "update bookings set starts_at=now()+interval '3 years' where id=$1", [booking.id])).rejects.toThrow(/IMMUTABLE/)
})

it('rejects overlaps in absolute time after the creator changes zones', async () => {
  await save('UTC')
  await book('10:00', '10:30')
  await save('Asia/Dubai')
  await expect(book('14:00', '14:30')).rejects.toThrow(/BOOKING_SLOT_UNAVAILABLE/)
  await expect(book('10:00', '10:30')).resolves.toBeDefined()
  const { rows } = await db.as('authenticated', stranger, 'select * from booking_available_slots($1,current_date+2,$2)', [creator, service])
  expect(rows.find(slot => slot.start_time === '14:00:00')?.available).toBe(false)
  expect((await db.as('authenticated', stranger, 'select id from bookings')).rows).toHaveLength(0)
})

it.each([
  ['2027-03-14', '02:30', 'America/New_York'],
  ['2026-11-01', '01:30', 'America/New_York'],
  ['2026-10-04', '02:15', 'Australia/Lord_Howe'],
  ['2027-04-04', '01:45', 'Australia/Lord_Howe'],
])('rejects nonexistent or repeated local time %s %s in %s', async (date, time, zone) => {
  const { rows: [row] } = await db.as('authenticated', client, 'select booking_local_instant($1,$2,$3) as instant', [date, time, zone])
  expect(row.instant).toBeNull()
})

it('unknown legacy appointments do not allow payments or new conflicting bookings', async () => {
  await save()
  const { rows: [legacy] } = await db.query("insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,status) values($1,$2,$3,current_date+2,'10:00','10:30','confirmed') returning id", [client, creator, service])
  await expect(book('11:00', '11:30')).rejects.toThrow(/LEGACY_BOOKING_TIME_REVIEW_REQUIRED/)
  await expect(db.as('service_role', null, 'select reserve_deposit_checkout($1,$2,$3)', [client, legacy.id, 'https://example.test'])).rejects.toThrow(/BOOKING_NOT_PAYABLE/)
})

it('a creator cannot retain shared private notes after the actual appointment end', async () => {
  // UTC+14 guarantees the local date remains at least the UTC day, while the
  // persisted appointment instant is unambiguously in the past.
  await db.query(`insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,status,time_zone)
    select $1,$2,$3,d::date,d::time,(d+interval '30 minutes')::time,'confirmed','Pacific/Kiritimati'
    from (select date_trunc('hour',now() at time zone 'Pacific/Kiritimati')-interval '2 hours' as d) slot`, [client, creator, service])
  await db.as('authenticated', client, 'insert into client_health_notes(user_id,allergies,share_with_tech) values($1,$2,true)', [client, 'Private allergy'])
  await db.as('authenticated', client, 'insert into client_booking_notes(user_id,booking_notes) values($1,$2)', [client, 'Private note'])
  expect((await db.as('authenticated', creator, 'select allergies from client_health_notes')).rows).toHaveLength(0)
  expect((await db.as('authenticated', creator, 'select booking_notes from client_booking_notes')).rows).toHaveLength(0)
  expect((await db.as('authenticated', client, 'select allergies from client_health_notes')).rows).toEqual([{ allergies: 'Private allergy' }])
})

it('a valid appointment that ends at midnight is offered by the slot RPC', async () => {
  await save('UTC', schedule('23:00', '24:00'))
  const { rows } = await db.as('authenticated', client, 'select * from booking_available_slots($1,current_date+2,$2)', [creator, service])
  expect(rows.some(slot => slot.start_time === '23:30:00')).toBe(true)
  await expect(book('23:30', '24:00')).resolves.toBeDefined()
})

it('direct browser writes cannot bypass the atomic schedule validation', async () => {
  await save()
  await expect(db.as('authenticated', creator, "update availability set start_time='18:00',end_time='09:00' where creator_id=$1 and day_of_week=1", [creator])).rejects.toThrow(/permission denied/)
  await expect(db.as('authenticated', client, "insert into availability(creator_id,day_of_week,start_time,end_time) values($1,1,'09:00','17:00')", [client])).rejects.toThrow(/permission denied/)
})

it('private notes remain available only for a permitted participant before actual end', async () => {
  await save()
  const { rows: [booking] } = await book()
  await db.as('authenticated', client, 'insert into client_health_notes(user_id,allergies,share_with_tech) values($1,$2,true)', [client, 'Private allergy'])
  expect((await db.as('authenticated', creator, 'select allergies from client_health_notes')).rows).toEqual([{ allergies: 'Private allergy' }])
  expect((await db.as('authenticated', stranger, 'select allergies from client_health_notes')).rows).toHaveLength(0)
  await db.as('authenticated', client, 'update client_health_notes set share_with_tech=false where user_id=$1', [client])
  expect((await db.as('authenticated', creator, 'select allergies from client_health_notes')).rows).toHaveLength(0)
  await db.as('authenticated', client, 'update client_health_notes set share_with_tech=true where user_id=$1', [client])
  await db.as('authenticated', client, "update bookings set status='cancelled' where id=$1", [booking.id])
  expect((await db.as('authenticated', creator, 'select allergies from client_health_notes')).rows).toHaveLength(0)
})
