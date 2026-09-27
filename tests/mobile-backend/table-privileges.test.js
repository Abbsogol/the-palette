import { afterAll, beforeAll, expect, it } from 'vitest'
import { createSecurityDatabase } from '../helpers/security-database'

let db
beforeAll(async () => { db = await createSecurityDatabase() }, 30000)
afterAll(async () => { await db?.close() })

it.each(['anon', 'authenticated'])('%s cannot truncate another account’s records despite RLS', async role => {
  await db.query('insert into tags(name) values ($1)', [`Must survive ${role}`])
  await expect(db.as(role, null, 'truncate tags cascade')).rejects.toThrow(/permission denied/)
  expect((await db.query('select name from tags where name=$1', [`Must survive ${role}`])).rows).toHaveLength(1)
})

it('new application tables and Storage object metadata do not grant client administration', async () => {
  await db.exec('create table public.privilege_regression_probe(id uuid)')
  for (const role of ['anon', 'authenticated']) {
    for (const table of ['public.privilege_regression_probe', 'storage.objects']) {
      const { rows } = await db.query(`select has_table_privilege($1,$2,'TRUNCATE') or
        has_table_privilege($1,$2,'REFERENCES') or has_table_privilege($1,$2,'TRIGGER') or
        has_table_privilege($1,$2,'MAINTAIN') as allowed`, [role, table])
      expect(rows[0].allowed).toBe(false)
    }
  }
})

it.each(['anon', 'authenticated'])('%s has no table administration grants on application tables', async role => {
  const result = await db.query(`select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and (
      has_table_privilege($1,c.oid,'TRUNCATE') or has_table_privilege($1,c.oid,'REFERENCES') or
      has_table_privilege($1,c.oid,'TRIGGER') or has_table_privilege($1,c.oid,'MAINTAIN'))`, [role])
  expect(result.rows).toEqual([])
})
