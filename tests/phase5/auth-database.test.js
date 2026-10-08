import { afterAll, beforeAll, beforeEach, expect, it, vi } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'
import { sqlSupabase } from '../helpers/sql-supabase'
import { jsonRequest } from '../helpers/supabase'
const mock = vi.hoisted(() => ({ user: vi.fn(), client: {} }))
vi.mock('@/lib/auth', () => ({ getSessionUser: mock.user, serviceClient: mock.client }))
import { POST as applyReferral } from '@/app/api/apply-referral/route'
import { POST as completeOnboarding } from '@/app/api/complete-onboarding/route'
const owner = '00000000-0000-4000-8000-000000000511'
const inviter = '00000000-0000-4000-8000-000000000512'
const stranger = '00000000-0000-4000-8000-000000000513'
let db
beforeAll(async () => { db = await createSecurityDatabase() }, 30000)
afterAll(async () => { await db?.close() })
beforeEach(async () => {
  vi.clearAllMocks(); vi.spyOn(console, 'error').mockImplementation(() => {})
  await db.exec('truncate auth.users,profiles_data,processed_webhook_events cascade')
  await db.query('insert into auth.users(id) values ($1),($2),($3)', [owner, inviter, stranger])
  await db.query("update profiles_data set referral_code='INVITE22' where id=$1", [inviter])
  await db.query("update profiles_data set credit_balance=2,account_type='creator' where id=$1", [owner])
  Object.assign(mock.client, sqlSupabase(db)); mock.user.mockResolvedValue({ id: owner })
})
const read = async () => (await db.query('select credit_balance,onboarding_complete,phone_number,allergies from profiles_data where id=$1', [owner])).rows[0]
const invite = () => applyReferral(jsonRequest({ code: 'INVITE22', userId: stranger }))
const finish = () => completeOnboarding(jsonRequest({ age_confirmed:true, privacy_accepted:true, display_name: 'Owner', phone_number: '+123456789', allergies: 'Latex', userId: stranger, credit_balance: 9999, is_admin: true }))

it('P5-referral: a referral acknowledgment lost before onboarding can be retried without duplicate awards or onboarding credits', async () => {
  const initial = await invite()
  expect(initial.status).toBe(200)
  // The first response is deliberately discarded, matching an interrupted
  // browser request after the database transaction committed.
  const retry = await invite()
  expect(retry.status).toBe(200)
  expect((await finish()).status).toBe(200)
  expect((await finish()).status).toBe(200)
  expect(await read()).toMatchObject({ credit_balance: 7, onboarding_complete: true, phone_number: '+123456789', allergies: 'Latex' })
  expect((await db.query('select user_id,points,reason from rewards order by points')).rows).toEqual([
    { user_id: owner, points: 25, reason: 'joined_via_invite' },
    { user_id: inviter, points: 50, reason: 'invite_friend' },
  ])
  expect((await db.query('select is_admin from profiles_data where id=$1', [owner])).rows[0].is_admin).not.toBe(true)
  expect((await db.query('select onboarding_complete,referred_by from profiles_data where id=$1', [stranger])).rows[0]).toEqual({ onboarding_complete: false, referred_by: null })
})

it('P5-referral: a failed onboarding write after referral application remains safely retryable', async () => {
  expect((await invite()).status).toBe(200)
  await db.exec("create function fail_phase5_onboarding() returns trigger language plpgsql as $$ begin if new.onboarding_complete then raise exception 'transient write failure'; end if; return new; end $$; create trigger fail_phase5_onboarding before update on profiles_data for each row execute function fail_phase5_onboarding()")
  try {
    expect((await finish()).status).toBe(500)
    expect(await read()).toMatchObject({ credit_balance: 2, onboarding_complete: false })
  } finally {
    await db.exec('drop trigger fail_phase5_onboarding on profiles_data; drop function fail_phase5_onboarding()')
  }
  expect((await invite()).status).toBe(200)
  expect((await finish()).status).toBe(200)
  expect(await read()).toMatchObject({ credit_balance: 7, onboarding_complete: true })
  expect((await db.query('select count(*)::integer as count from rewards')).rows[0].count).toBe(2)
})

it.each(['anon', 'authenticated'])('P5-auth: %s cannot call privileged onboarding/referral/deletion functions directly', async role => {
  for (const [sql, values] of [
    ['select complete_onboarding($1,$2)', [owner, { credit_balance: 9999 }]],
    ['select apply_referral($1,$2)', [owner, 'INVITE22']],
    ['select begin_account_deletion($1)', [owner]],
    ['select delete_account($1)', [owner]],
  ]) await expect(db.as(role, role === 'authenticated' ? stranger : null, sql, values)).rejects.toThrow(/permission denied/i)
  expect(await read()).toMatchObject({ credit_balance: 2, onboarding_complete: false })
})

it('P5-auth: private health/contact fields remain owner-only under database roles', async () => {
  // Creator/salon contact details are intentionally public; client contact
  // details and every account's health notes are private in the profiles view.
  await db.query("update profiles_data set account_type='user' where id=$1", [owner])
  expect((await finish()).status).toBe(200)
  expect((await db.as('authenticated', owner, 'select phone_number,allergies from profiles where id=$1', [owner])).rows[0]).toEqual({ phone_number: '+123456789', allergies: 'Latex' })
  for (const [role, id] of [['anon', null], ['authenticated', stranger]]) {
    expect((await db.as(role, id, 'select phone_number,allergies from profiles where id=$1', [owner])).rows[0]).toEqual({ phone_number: null, allergies: null })
  }
})
