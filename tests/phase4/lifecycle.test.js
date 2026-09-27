import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'
import { sqlSupabase } from '../helpers/sql-supabase'
import { jsonRequest } from '../helpers/supabase'
const mock = vi.hoisted(() => ({ client: {}, user: vi.fn() }))
vi.mock('@/lib/auth', () => ({ getSessionUser: mock.user, serviceClient: mock.client }))
import { POST as generate } from '@/app/api/generate-nail-design/route'
import { GET as reminders } from '@/app/api/send-reminders/route'
import { GET as generationStatus } from '@/app/api/generation-status/route'
import { deliverReminderEmails } from '@/lib/reminder-emails'
const owner = '00000000-0000-4000-8000-000000000401'
const member = '00000000-0000-4000-8000-000000000402'
const other = '00000000-0000-4000-8000-000000000403'
const board = '10000000-0000-4000-8000-000000000401'
const design = '20000000-0000-4000-8000-000000000401'
const booking = '30000000-0000-4000-8000-000000000401'
const service = '40000000-0000-4000-8000-000000000401'
const intent = '50000000-0000-4000-8000-000000000401'
const spec = { requestId: intent, vibe: ['Minimal'], shape: 'Almond', length: 'Short' }
let db, upstream
const scalar = async (sql, args = []) => Object.values((await db.query(sql, args)).rows[0])[0]
const as = (id, sql, args = []) => db.as(id ? 'authenticated' : 'anon', id, sql, args)
beforeAll(async () => { db = await createSecurityDatabase() }, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {})
  await db.exec('truncate auth.users,profiles_data,processed_webhook_events cascade')
  await db.query('insert into auth.users(id) values ($1),($2),($3)', [owner, member, other])
  await db.query("update profiles_data set credit_balance=5,account_type='creator' where id=$1", [owner])
  Object.assign(mock.client, sqlSupabase(db))
  mock.user.mockResolvedValue({ id: owner })
  mock.client.storage = { from: () => ({
    upload: async () => ({ error: null }),
    getPublicUrl: name => ({ data: { publicUrl: `${owner}/${name.split('/').pop()}` } }),
    createSignedUrl: async () => ({ data: { signedUrl: 'https://storage.invalid/signed' }, error: null }),
  }) }
  upstream = vi.fn(async () => ({ ok: true, json: async () => ({ data: [{ b64_json: 'aW1hZ2U=' }] }) }))
  vi.stubGlobal('fetch', upstream)
})
async function seedBoard() {
  await db.query("insert into moodboards(id,user_id,name) values ($1,$2,'Shared privately')", [board, owner])
  await db.query("insert into designs(id,created_by,title,is_published) values ($1,$2,'Shared design',true)", [design, owner])
  await as(owner, 'insert into moodboard_designs(moodboard_id,design_id) values ($1,$2)', [board, design])
  await as(owner, 'insert into moodboard_members(moodboard_id,user_id,invited_by) values ($1,$2,$3)', [board, member, owner])
}
async function seedBooking() {
  await db.query("insert into services(id,creator_id,name,duration_minutes,price) values ($1,$2,'Manicure',60,100)", [service, owner])
  await db.query("insert into bookings(id,client_id,creator_id,service_id,booking_date,start_time,end_time,status) values ($1,$2,$3,$4,current_date+1,'10:00','11:00','confirmed')", [booking, member, owner, service])
}
const rpc = async (name, args = {}) => {
  const { data, error } = await mock.client.rpc(name, args)
  if (error) throw error
  return data
}
const claim = () => rpc('claim_generation', { p_id: intent, p_user_id: owner, p_parent_id: null, p_hash: 'a'.repeat(64) })
const enqueue = async () => rpc('enqueue_booking_reminders', { p_date: await scalar('select (current_date+1)::text') })
it('P4-02: an invited member can read a private board and its published designs', async () => {
  await db.query("insert into moodboards(id,user_id,name) values ($1,$2,'Shared privately')", [board, owner])
  await db.query("insert into designs(id,created_by,title,is_published) values ($1,$2,'Shared design',true)", [design, owner])
  await as(owner, 'insert into moodboard_designs(moodboard_id,design_id) values ($1,$2)', [board, design])
  await as(owner, 'insert into moodboard_members(moodboard_id,user_id,invited_by) values ($1,$2,$3)', [board, member, owner])
  expect((await as(member, 'select * from moodboards where id=$1', [board])).rows).toHaveLength(1)
  expect((await as(member, 'select * from moodboard_designs where moodboard_id=$1', [board])).rows).toHaveLength(1)
})
it('P4-03: retrying an acknowledged generation intent returns the saved result without spending again', async () => {
  const first = await generate(jsonRequest(spec))
  expect(first.status).toBe(200)
  const retry = await generate(jsonRequest(spec))
  expect(retry.status).toBe(200)
  expect((await retry.json()).generationId).toBe((await first.json()).generationId)
  expect(upstream).toHaveBeenCalledTimes(1)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [owner])).toBe(4)
  expect(await scalar('select count(*)::integer from nail_lab_generations')).toBe(1)
})
it('P4-04: an interrupted reminder transaction cannot permanently consume the booking claim', async () => {
  await db.query("insert into services(id,creator_id,name,duration_minutes,price) values ($1,$2,'Manicure',60,100)", [service, owner])
  await db.query("insert into bookings(id,client_id,creator_id,service_id,booking_date,start_time,end_time,status) values ($1,$2,$3,$4,current_date+1,'10:00','11:00','confirmed')", [booking, member, owner, service])
  const client = sqlSupabase(db)
  // Simulate a broken follow-up connection after the claim. A single DB
  // transaction must roll back both the claim and notifications on failure.
  mock.client.from = table => {
    if (table === 'notifications') return { insert: async () => { throw new Error('Connection lost after claim') } }
    return client.from(table)
  }
  await db.exec("create function public.fail_reminder_test() returns trigger language plpgsql as $$ begin if new.type='appointment_reminder' then raise exception 'notification failure'; end if; return new; end $$; create trigger fail_reminder_test before insert on notifications for each row execute function fail_reminder_test()")
  vi.stubEnv('CRON_SECRET', 'test-scheduler-secret')
  try {
    await reminders(new Request('http://localhost/api/send-reminders', { headers: { authorization: 'Bearer test-scheduler-secret' } })).catch(() => {})
    expect(await scalar('select reminder_sent_at from bookings where id=$1', [booking])).toBeNull()
    expect(await scalar("select count(*)::integer from notifications where type='appointment_reminder'")).toBe(0)
  } finally {
    await db.exec('drop trigger fail_reminder_test on notifications; drop function fail_reminder_test()')
  }
})

it.each(['creator', 'salon', 'user'])('P4-01: signup persists %s before confirmation with no extra privileges', async type => {
  await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2)', [intent, JSON.stringify({ account_type: type, display_name: ' New member ', is_admin: true, credit_balance: 999, subscription_tier: 'pro', onboarding_complete: true })])
  const profile = (await db.query('select account_type,display_name,is_admin,credit_balance,subscription_tier,onboarding_complete from profiles_data where id=$1', [intent])).rows[0]
  expect(profile).toMatchObject({ account_type: type, display_name: 'New member', is_admin: false, credit_balance: 0, onboarding_complete: false })
  expect(profile.subscription_tier).not.toBe('pro')
})
it('P4-01: forged admin signup type falls back to an ordinary user', async () => {
  await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2)', [intent, JSON.stringify({ account_type: 'admin', is_admin: true })])
  expect((await db.query('select account_type,is_admin from profiles_data where id=$1', [intent])).rows[0]).toEqual({ account_type: 'user', is_admin: false })
})
it('P4-02: membership grants no owner powers, exposes no private drafts, and revocation removes access', async () => {
  await seedBoard()
  await db.query("insert into designs(id,created_by,title,is_published) values ($1,$2,'Private draft',false)", [intent, owner])
  await as(owner, 'insert into moodboard_designs(moodboard_id,design_id) values ($1,$2)', [board, intent])
  expect((await as(member, 'select design_id from moodboard_designs')).rows).toEqual([{ design_id: design }])
  expect((await as(owner, 'select design_id from moodboard_designs')).rows).toHaveLength(2)
  for (const id of [null, other]) {
    expect((await as(id, 'select * from moodboards')).rows).toHaveLength(0)
    expect((await as(id, 'select * from moodboard_designs')).rows).toHaveLength(0)
  }
  expect((await as(member, "update moodboards set is_public=true where id=$1 returning id", [board])).rows).toHaveLength(0)
  expect((await as(member, 'delete from moodboard_designs returning id')).rows).toHaveLength(0)
  await expect(as(member, 'insert into moodboard_members(moodboard_id,user_id,invited_by) values ($1,$2,$3)', [board, other, member])).rejects.toThrow()
  await as(owner, 'delete from moodboard_members where moodboard_id=$1 and user_id=$2', [board, member])
  expect((await as(member, 'select * from moodboards')).rows).toHaveLength(0)
  expect((await as(member, 'select * from moodboard_designs')).rows).toHaveLength(0)
})
it('P4-02: leaving a board removes membership without changing the owner or public visibility', async () => {
  await seedBoard()
  await as(member, 'delete from moodboard_members where moodboard_id=$1', [board])
  expect((await as(member, 'select * from moodboards')).rows).toHaveLength(0)
  await as(owner, 'update moodboards set is_public=true where id=$1', [board])
  expect((await as(null, 'select * from moodboards')).rows).toHaveLength(1)
  expect((await as(null, 'select * from moodboard_designs')).rows).toHaveLength(1)
})
it('P4-03: simultaneous retries of the same intent run one provider request and do not release its credit', async () => {
  let unblock, entered
  const started = new Promise(resolve => { entered = resolve })
  const response = new Promise(resolve => { unblock = resolve })
  upstream.mockImplementation(async () => { entered(); return response })
  const first = generate(jsonRequest(spec))
  await started
  const retry = await generate(jsonRequest(spec))
  expect(retry.status).toBe(202)
  expect(await scalar('select status from generation_reservations where id=$1', [intent])).toBe('reserved')
  expect(await scalar('select credit_balance from profiles_data where id=$1', [owner])).toBe(4)
  unblock({ ok: true, json: async () => ({ data: [{ b64_json: 'aW1hZ2U=' }] }) })
  expect((await first).status).toBe(200)
  expect(upstream).toHaveBeenCalledTimes(1)
})
it('P4-03: another account or changed prompt cannot replay a completed intent', async () => {
  expect((await generate(jsonRequest(spec))).status).toBe(200)
  expect((await generate(jsonRequest({ ...spec, shape: 'Square' }))).status).toBe(409)
  mock.user.mockResolvedValue({ id: other })
  expect((await generate(jsonRequest(spec))).status).toBe(409)
  expect((await generationStatus(new Request(`http://localhost/api/generation-status?requestId=${intent}`))).status).toBe(404)
  expect(upstream).toHaveBeenCalledTimes(1)
})
it('P4-03: lost completion acknowledgment keeps the charged result and returns it on retry', async () => {
  const execute = mock.client.rpc.getMockImplementation()
  mock.client.rpc.mockImplementation(async (name, args) => {
    const result = await execute(name, args)
    return name === 'complete_generation' ? { data: null, error: new Error('Response lost after commit') } : result
  })
  expect((await generate(jsonRequest(spec))).status).toBe(500)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [owner])).toBe(4)
  expect((await generate(jsonRequest(spec))).status).toBe(200)
  expect(upstream).toHaveBeenCalledTimes(1)
})
it('P4-03: an abandoned paid hold expires once, rejects late completion, and permits deletion', async () => {
  expect(await claim()).toBe('claimed')
  await expect(rpc('begin_account_deletion', { p_user_id: owner })).rejects.toThrow('GENERATION_IN_PROGRESS')
  await db.query("update generation_reservations set expires_at=now()-interval '1 second' where id=$1", [intent])
  await Promise.all([rpc('recover_generations', { p_user_id: owner }), rpc('recover_generations', { p_user_id: owner })])
  expect(await scalar('select credit_balance from profiles_data where id=$1', [owner])).toBe(5)
  expect(await claim()).toBe('released')
  await expect(rpc('complete_generation', { p_id: intent, p_generation: { image_url: `${owner}/late.png` } })).rejects.toThrow('Reservation unavailable')
  expect(await scalar('select count(*)::integer from nail_lab_generations')).toBe(0)
  await rpc('begin_account_deletion', { p_user_id: owner })
  expect(await scalar('select deletion_started_at from profiles_data where id=$1', [owner])).not.toBeNull()
})
it('P4-03: loading the generation balance recovers a crashed worker without requiring another credit', async () => {
  await db.query('update profiles_data set credit_balance=1 where id=$1', [owner])
  expect(await claim()).toBe('claimed')
  await db.query("update generation_reservations set expires_at=now()-interval '1 second' where id=$1", [intent])
  const response = await generationStatus(new Request('http://localhost/api/generation-status'))
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('no-store')
  expect(await response.json()).toEqual({ creditsRemaining: 1 })
})
it('P4-03: deletion itself recovers a crashed free regeneration and preserves its entitlement', async () => {
  await db.query('insert into nail_lab_generations(id,user_id,image_url) values ($1,$2,$3)', [design, owner, `${owner}/root.png`])
  await rpc('claim_generation', { p_id: intent, p_user_id: owner, p_parent_id: design, p_hash: 'a'.repeat(64) })
  expect(await scalar('select free_regen_used from nail_lab_generations where id=$1', [design])).toBe(true)
  await db.query("update generation_reservations set expires_at=now()-interval '1 second' where id=$1", [intent])
  await rpc('begin_account_deletion', { p_user_id: owner })
  expect(await scalar('select free_regen_used from nail_lab_generations where id=$1', [design])).toBe(false)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [owner])).toBe(5)
})
it('P4-03: expiration before completion fails closed even before the recovery worker runs', async () => {
  expect(await claim()).toBe('claimed')
  await db.query("update generation_reservations set expires_at=now()-interval '1 second' where id=$1", [intent])
  await expect(rpc('complete_generation', { p_id: intent, p_generation: {} })).rejects.toThrow('Reservation expired')
  expect(await scalar('select count(*)::integer from nail_lab_generations')).toBe(0)
})
it('P4-04: concurrent reminder runs commit one pair of notifications and one pair of email jobs', async () => {
  await seedBooking()
  const counts = await Promise.all([enqueue(), enqueue(), enqueue()])
  expect(counts.reduce((a, b) => a + b)).toBe(1)
  expect(await scalar("select count(*)::integer from notifications where type='appointment_reminder'")).toBe(2)
  expect(await scalar('select count(*)::integer from reminder_emails')).toBe(2)
})
it('P4-04: partial email delivery retries only the failed recipient and freezes the provider request', async () => {
  await seedBooking(); await enqueue()
  mock.client.auth = { admin: { getUserById: async id => ({ data: { user: { email: `${id}@example.invalid` } } }) } }
  const requests = new Map()
  let failOnce = true
  const resend = { emails: { send: vi.fn(async (body, options) => {
    if (requests.has(options.idempotencyKey)) expect(body).toEqual(requests.get(options.idempotencyKey))
    requests.set(options.idempotencyKey, body)
    if (failOnce) { failOnce = false; throw new Error('Email response lost') }
    return { data: { id: 'email-test' } }
  }) } }
  expect(await deliverReminderEmails(mock.client, resend)).toMatchObject({ emailsSent: 1, emailsFailed: 1 })
  await db.query("update reminder_emails set retry_at=now()-interval '1 second' where status='pending'")
  await db.query("update profiles_data set display_name='Changed after request' where id=$1", [owner])
  mock.client.auth.admin.getUserById = () => { throw new Error('Retry must use saved recipient') }
  expect(await deliverReminderEmails(mock.client, resend)).toMatchObject({ emailsSent: 1, emailsFailed: 0 })
  expect(resend.emails.send).toHaveBeenCalledTimes(3)
  expect(requests.size).toBe(2)
  expect(await scalar("select count(*)::integer from reminder_emails where status='sent'")).toBe(2)
})
it('P4-04: concurrent email workers receive disjoint claims and an old token cannot acknowledge a new lease', async () => {
  await seedBooking(); await enqueue()
  const claims = await Promise.all([rpc('claim_reminder_emails'), rpc('claim_reminder_emails')])
  expect(claims.flat()).toHaveLength(2)
  expect(new Set(claims.flat().map(job => job.id)).size).toBe(2)
  const old = claims.flat()[0]
  await db.query("update reminder_emails set lease_until=now()-interval '1 second' where id=$1", [old.id])
  const [current] = await rpc('claim_reminder_emails')
  expect(await rpc('finish_reminder_email', { p_id: old.id, p_token: old.claim_token, p_status: 'sent' })).toBe(false)
  expect(await rpc('finish_reminder_email', { p_id: current.id, p_token: current.claim_token, p_status: 'sent' })).toBe(true)
})
it('P4-04: over-age ambiguous email sends require review, while cancelled bookings skip unsent jobs', async () => {
  await seedBooking(); await enqueue()
  const jobs = await rpc('claim_reminder_emails')
  await db.query("update reminder_emails set first_attempt_at=now()-interval '24 hours',lease_until=null where id=$1", [jobs[0].id])
  await db.query("update bookings set status='cancelled' where id=$1", [booking])
  await db.exec("update reminder_emails set lease_until=null")
  expect(await rpc('claim_reminder_emails')).toEqual([])
  expect((await db.query('select status from reminder_emails order by status')).rows).toEqual([{ status: 'needs_review' }, { status: 'skipped' }])
})
it('P4-04: unavailable recipient lookup stays retryable rather than silently discarding an email', async () => {
  await seedBooking(); await enqueue()
  mock.client.auth = { admin: { getUserById: async () => ({ error: new Error('Auth unavailable') }) } }
  const resend = { emails: { send: vi.fn() } }
  expect(await deliverReminderEmails(mock.client, resend)).toMatchObject({ emailsSent: 0, emailsFailed: 2 })
  expect(resend.emails.send).not.toHaveBeenCalled()
  expect(await scalar("select count(*)::integer from reminder_emails where status='pending' and lease_until is null")).toBe(2)
})
it('service RPCs, email addresses, and recovery controls are inaccessible to browser roles', async () => {
  for (const role of ['anon', 'authenticated']) {
    for (const signature of ['claim_generation(uuid,uuid,uuid,text)', 'recover_generations(uuid)', 'begin_account_deletion(uuid)', 'enqueue_booking_reminders(date)', 'claim_reminder_emails(integer)', 'prepare_reminder_email(uuid,uuid,jsonb)', 'finish_reminder_email(uuid,uuid,text)']) {
      expect(await scalar("select has_function_privilege($1,$2,'EXECUTE')", [role, signature])).toBe(false)
    }
    await expect(db.as(role, owner, 'select * from reminder_emails')).rejects.toThrow()
    await expect(db.as(role, owner, 'select * from generation_reservations')).rejects.toThrow()
  }
})

it('P4-05: a refund during generation cannot reappear as spendable credit when generation fails', async () => {
  await db.query('update profiles_data set credit_balance=0 where id=$1', [owner])
  await rpc('apply_credit_payment', { p_event_id: 'evt_paid', p_payment_intent: 'pi_credit', p_user_id: owner, p_credits: 1, p_session_id: 'cs_credit' })
  expect(await claim()).toBe('claimed')
  await rpc('apply_credit_payment', { p_event_id: 'evt_refund', p_payment_intent: 'pi_credit', p_user_id: owner, p_credits: 1, p_refunded_credits: 1 })
  await rpc('release_generation', { p_id: intent })
  expect(await scalar('select credit_balance from profiles_data where id=$1', [owner])).toBe(0)
})
it.each(['refund-first', 'release-first', 'concurrent', 'expired'])('P4-05: refund and hold release stay consistent (%s)', async order => {
  await db.query('update profiles_data set credit_balance=0 where id=$1', [owner])
  const payment = { p_payment_intent: 'pi_credit', p_user_id: owner, p_credits: 1 }
  await rpc('apply_credit_payment', { ...payment, p_event_id: 'evt_paid', p_session_id: 'cs_credit' })
  expect(await claim()).toBe('claimed')
  const refund = () => rpc('apply_credit_payment', { ...payment, p_event_id: 'evt_refund', p_refunded_credits: 1 })
  const release = () => rpc('release_generation', { p_id: intent })
  if (order === 'concurrent') await Promise.all([refund(), release()])
  else if (order === 'release-first') { await release(); await refund() }
  else if (order === 'expired') {
    await refund()
    await db.query("update generation_reservations set expires_at=now()-interval '1 second' where id=$1", [intent])
    await rpc('recover_generations', { p_user_id: owner })
  } else { await refund(); await release() }
  await release(); await refund()
  expect(await scalar('select credit_balance from profiles_data where id=$1', [owner])).toBe(0)
  expect(await scalar("select deducted_credits from credit_payments where payment_intent='pi_credit'")).toBe(1)
})
it('P4-05: partial refunds reverse only the required held credits, never free regeneration or unrelated new grants', async () => {
  await db.query('update profiles_data set credit_balance=0 where id=$1', [owner])
  const payment = { p_payment_intent: 'pi_credit', p_user_id: owner, p_credits: 2 }
  await rpc('apply_credit_payment', { ...payment, p_event_id: 'evt_paid', p_session_id: 'cs_credit' })
  expect(await claim()).toBe('claimed')
  await rpc('claim_generation', { p_id: board, p_user_id: owner, p_parent_id: null, p_hash: 'b'.repeat(64) })
  await db.query('insert into nail_lab_generations(id,user_id,image_url) values ($1,$2,$3)', [design, owner, `${owner}/root.png`])
  await rpc('claim_generation', { p_id: booking, p_user_id: owner, p_parent_id: design, p_hash: 'c'.repeat(64) })
  await rpc('apply_credit_payment', { ...payment, p_event_id: 'evt_refund', p_refunded_credits: 1 })
  await rpc('release_generation', { p_id: booking })
  expect(await scalar('select free_regen_used from nail_lab_generations where id=$1', [design])).toBe(false)
  await rpc('increment_credits', { user_id: owner, amount: 3 })
  await Promise.all([rpc('release_generation', { p_id: intent }), rpc('release_generation', { p_id: board })])
  await rpc('apply_credit_payment', { ...payment, p_event_id: 'evt_refund_duplicate', p_refunded_credits: 1 })
  expect(await scalar('select credit_balance from profiles_data where id=$1', [owner])).toBe(4)
  expect(await scalar('select count(*)::integer from generation_reservations where credit_reversed')).toBe(1)
})
it('P4-05: a refunded in-flight generation can finish, but its later release never grants a credit', async () => {
  await db.query('update profiles_data set credit_balance=0 where id=$1', [owner])
  const payment = { p_payment_intent: 'pi_credit', p_user_id: owner, p_credits: 1 }
  await rpc('apply_credit_payment', { ...payment, p_event_id: 'evt_paid', p_session_id: 'cs_credit' })
  expect(await claim()).toBe('claimed')
  await rpc('apply_credit_payment', { ...payment, p_event_id: 'evt_refund', p_refunded_credits: 1 })
  await rpc('complete_generation', { p_id: intent, p_generation: { image_url: `${owner}/image.png` } })
  expect(await rpc('release_generation', { p_id: intent })).toBe(false)
  expect(await scalar('select credit_balance from profiles_data where id=$1', [owner])).toBe(0)
  expect(await scalar('select count(*)::integer from nail_lab_generations')).toBe(1)
})
