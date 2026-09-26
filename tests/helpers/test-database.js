import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'

export async function createTestDatabase() {
  const url = process.env.DATABASE_TEST_URL
  let db
  if (url) {
    // Never run fixtures/truncation against a linked Supabase project.
    const parsed = new URL(url)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname) || parsed.pathname !== '/palette_test') {
      throw new Error('DATABASE_TEST_URL must target a local palette_test database')
    }
    const pool = new pg.Pool({ connectionString: url, max: 8 })
    db = { query: (sql, values) => pool.query(sql, values), exec: sql => pool.query(sql), close: () => pool.end() }
  } else {
    db = await PGlite.create()
  }
  await db.exec(await readFile(new URL('../fixtures/entitlement-schema.sql', import.meta.url), 'utf8'))
  await db.exec(await readFile(new URL('../../supabase/migrations/202609260001_atomic_entitlements.sql', import.meta.url), 'utf8'))
  return db
}
