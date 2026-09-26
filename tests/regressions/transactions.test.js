import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest'
import { createTestDatabase } from '../helpers/test-database'

const owner = '00000000-0000-4000-8000-000000000001'
const inviter = '00000000-0000-4000-8000-000000000002'
const parent = '00000000-0000-4000-8000-000000000003'
const first = '00000000-0000-4000-8000-000000000004'
const second = '00000000-0000-4000-8000-000000000005'
let db
beforeAll(async () => { db = await createTestDatabase() }, 30_000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  await db.exec('truncate auth.users, public.profiles_data, public.processed_webhook_events cascade')
  await db.query('insert into auth.users(id) values ($1), ($2)', [owner, inviter])
  await db.query("insert into public.profiles_data(id, credit_balance, referral_code) values ($1, 1, 'OWNER'), ($2, 0, 'INVITER')", [owner, inviter])
  await db.query('insert into public.nail_lab_generations(id, user_id) values ($1, $2)', [parent, owner])
})
async function scalar(sql, args = []) { return Object.values((await db.query(sql, args)).rows[0])[0] }
const balance = () => scalar('select credit_balance from public.profiles_data where id = $1', [owner])
const reserve = (id, parentId = null, userId = owner) => scalar('select public.reserve_generation($1, $2, $3)', [id, userId, parentId])
const release = id => scalar('select public.release_generation($1)', [id])
const payment = (event, { session = null, refunded = 0, credits = 40, userId = owner } = {}) => scalar(
  'select public.apply_credit_payment($1, $2, $3, $4, $5, $6)', [event, 'pi-test', userId, credits, session, refunded])

it('REG-02 SQL: concurrent reservations spend the last credit only once', async () => {
  // Widen the overlap in native PostgreSQL so a broken read-then-debit
  // implementation cannot pass just because the statements finish quickly.
  if (process.env.DATABASE_TEST_URL) await db.exec(`
    create function public.delay_test_debit() returns trigger language plpgsql as $$
    begin perform pg_sleep(0.1); return new; end $$;
    create trigger delay_test_debit before update on public.profiles_data for each row execute function public.delay_test_debit();
  `)
  let results
  try { results = await Promise.all([reserve(first), reserve(second)]) }
  finally {
    if (process.env.DATABASE_TEST_URL) await db.exec('drop trigger delay_test_debit on public.profiles_data; drop function public.delay_test_debit()')
  }
  expect(results.filter(Boolean)).toHaveLength(1)
  expect(await balance()).toBe(0)
  expect(await scalar('select count(*)::integer from public.generation_reservations')).toBe(1)
})

it('REG-06 SQL: free retry release is idempotent and checks ownership', async () => {
  expect(await reserve(first, parent, inviter)).toBe(false)
  expect(await reserve(first, parent)).toBe(true)
  expect(await reserve(second, parent)).toBe(false)
  expect(await release(first)).toBe(true)
  expect(await release(first)).toBe(false)
  expect(await reserve(second, parent)).toBe(true)
  expect(await balance()).toBe(1)
})

it('a committed generation cannot be refunded by an ambiguous completion response', async () => {
  await reserve(first)
  const complete = () => scalar('select public.complete_generation($1, $2)', [first, JSON.stringify({ image_url: 'test.png', vibe: ['Minimal'] })])
  expect(await complete()).toBe(first)
  expect(await complete()).toBe(first)
  expect(await release(first)).toBe(false)
  expect(await balance()).toBe(0)
  expect(await scalar('select count(*)::integer from public.nail_lab_generations where id=$1', [first])).toBe(1)
})

it('failed generation persistence leaves a releasable reservation and no image record', async () => {
  await reserve(first)
  await expect(scalar('select public.complete_generation($1, $2)', [first, '{"vibe":"not an array"}'])).rejects.toThrow()
  expect(await release(first)).toBe(true)
  expect(await balance()).toBe(1)
  expect(await scalar('select count(*)::integer from public.nail_lab_generations where id=$1', [first])).toBe(0)
})

it('completed free regenerations record zero credits spent', async () => {
  await reserve(first, parent)
  await scalar('select public.complete_generation($1, $2)', [first, '{}'])
  expect(await scalar('select credits_used from public.nail_lab_generations where id=$1', [first])).toBe(0)
})

it('REG-03 SQL: partial, duplicate, out-of-order and concurrent refunds debit only the new cumulative entitlement', async () => {
  await payment('purchase', { session: 'cs-paid' })
  await Promise.all([payment('refund-a', { refunded: 10 }), payment('refund-b', { refunded: 20 })])
  await payment('refund-b', { refunded: 20 })
  await payment('refund-old', { refunded: 10 })
  await payment('purchase-retry', { session: 'cs-paid' })
  expect(await balance()).toBe(21)
})

it('a refund arriving before checkout cannot be regranted on delayed fulfillment', async () => {
  await payment('refund-first', { refunded: 20 })
  await payment('purchase', { session: 'cs-paid' })
  expect(await balance()).toBe(21)
})

it('different checkout events fulfill the same payment only once', async () => {
  await Promise.all([payment('completed', { session: 'cs-paid' }), payment('async-success', { session: 'cs-paid' })])
  expect(await balance()).toBe(41)
})

it('payment failure rolls back the event receipt so Stripe can retry', async () => {
  const missing = '00000000-0000-4000-8000-000000000099'
  await expect(payment('retry-me', { session: 'cs-paid', userId: missing })).rejects.toThrow()
  expect(await scalar("select count(*)::integer from public.processed_webhook_events where event_id='retry-me'")).toBe(0)
  await payment('retry-me', { session: 'cs-paid' })
  expect(await balance()).toBe(41)
})

it('legacy processed events are not credited again after the migration', async () => {
  await db.exec("insert into public.processed_webhook_events(event_id) values ('legacy')")
  await payment('legacy', { session: 'cs-legacy' })
  expect(await balance()).toBe(1)
})

it('REG-10 SQL: failure on the second reward rolls back the claim and first award', async () => {
  await db.exec("alter table public.rewards add constraint simulated_failure check (reason <> 'joined_via_invite')")
  try {
    await expect(scalar('select public.apply_referral($1, $2)', [owner, 'INVITER'])).rejects.toThrow()
    expect(await scalar('select referred_by from public.profiles_data where id=$1', [owner])).toBe(null)
    expect(await scalar('select count(*)::integer from public.rewards')).toBe(0)
  } finally { await db.exec('alter table public.rewards drop constraint simulated_failure') }
  await Promise.all([scalar('select public.apply_referral($1, $2)', [owner, 'INVITER']), scalar('select public.apply_referral($1, $2)', [owner, 'INVITER'])])
  expect(await scalar('select count(*)::integer from public.rewards')).toBe(2)
  expect(await scalar('select sum(points)::integer from public.rewards')).toBe(75)
})

it('a historical referral with a missing award is repaired without duplicating the other award', async () => {
  await db.query("update public.profiles_data set referred_by='INVITER' where id=$1", [owner])
  await db.query("insert into public.rewards(user_id, points, reason, ref_id) values ($1, 50, 'invite_friend', $2)", [inviter, owner])
  await scalar('select public.apply_referral($1, $2)', [owner, 'INVITER'])
  expect(await scalar('select count(*)::integer from public.rewards')).toBe(2)
})

it('anonymous/authenticated callers cannot execute entitlement mutations or read the ledger', async () => {
  const names = (await db.query("select oid::regprocedure::text as name from pg_proc where proname in ('reserve_generation','release_generation','complete_generation','apply_credit_payment','apply_referral','decrement_credits_by')")).rows
  expect(names).toHaveLength(6)
  for (const { name } of names) {
    for (const role of ['anon', 'authenticated']) expect(await scalar("select has_function_privilege($1,$2,'EXECUTE')", [role, name])).toBe(false)
    expect(await scalar("select has_function_privilege('service_role',$1,'EXECUTE')", [name])).toBe(true)
  }
  expect(await scalar("select has_table_privilege('anon','public.credit_payments','SELECT')")).toBe(false)
  await expect(scalar('select public.decrement_credits_by($1, -10)', [owner])).rejects.toThrow()
  expect(await balance()).toBe(1)
})
