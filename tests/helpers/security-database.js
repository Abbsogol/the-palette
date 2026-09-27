import { readFile } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { PGlite } from '@electric-sql/pglite'
import pg from 'pg'

export async function createSecurityDatabase({ hardened = true } = {}) {
  let db
  let releaseSetupLock = async () => {}
  if (process.env.DATABASE_TEST_URL) {
    const url = new URL(process.env.DATABASE_TEST_URL)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) || url.pathname !== '/palette_test') {
      throw new Error('Security tests require a local palette_test database')
    }
    const admin = new pg.Client({ connectionString: url.href })
    await admin.connect()
    // Roles are cluster-wide even though each suite gets its own database.
    // Serialize fixture DDL on the shared control database, then unlock before
    // any test runs; actual application concurrency remains fully exercised.
    await admin.query('select pg_advisory_lock(86427004)')
    releaseSetupLock = () => admin.query('select pg_advisory_unlock(86427004)')
    const name = `palette_security_${randomUUID().replaceAll('-', '')}`
    await admin.query(`create database ${name}`)
    url.pathname = `/${name}`
    const pool = new pg.Pool({ connectionString: url.href, max: 8 })
    db = {
      query: (sql, args) => pool.query(sql, args), exec: sql => pool.query(sql),
      async as(role, id, sql, args = []) {
        const client = await pool.connect()
        try {
          await client.query('begin')
          await client.query(`set local role ${role}`)
          await client.query("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role',$2,true)", [id || '', role])
          const result = await client.query(sql, args)
          await client.query('commit')
          return result
        } catch (error) { await client.query('rollback'); throw error }
        finally { client.release() }
      },
      async close() {
        await pool.end()
        await admin.query(`drop database ${name}`)
        await admin.end()
      },
    }
  } else {
    db = await PGlite.create()
    db.as = (role, id, sql, args = []) => db.transaction(async tx => {
      await tx.exec(`set local role ${role}`)
      await tx.query("select set_config('request.jwt.claim.sub',$1,true), set_config('request.jwt.claim.role',$2,true)", [id || '', role])
      return tx.query(sql, args)
    })
  }
  try {
    await db.exec(await readFile(new URL('../fixtures/security-baseline.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../../supabase/migrations/202609260001_atomic_entitlements.sql', import.meta.url), 'utf8'))
    if (hardened) {
      await db.exec(await readFile(new URL('../../supabase/migrations/202609260002_authorization.sql', import.meta.url), 'utf8'))
      await db.exec(await readFile(new URL('../../supabase/migrations/202609260003_review_fixes.sql', import.meta.url), 'utf8'))
      await db.exec(await readFile(new URL('../../supabase/migrations/202609260004_credit_refund_order.sql', import.meta.url), 'utf8'))
      await db.exec(await readFile(new URL('../../supabase/migrations/202609260005_phase3_transactions.sql', import.meta.url), 'utf8'))
      await db.exec(await readFile(new URL('../../supabase/migrations/202609270006_phase4_lifecycle.sql', import.meta.url), 'utf8'))
      await db.exec(await readFile(new URL('../../supabase/migrations/202609270007_refunded_generation_holds.sql', import.meta.url), 'utf8'))
      await db.exec(await readFile(new URL('../../supabase/migrations/202609270008_checkout_failures.sql', import.meta.url), 'utf8'))
      await db.exec(await readFile(new URL('../../supabase/migrations/202609270009_subscription_recovery.sql', import.meta.url), 'utf8'))
      await db.exec(await readFile(new URL('../../supabase/migrations/202609270010_refund_reconciliation.sql', import.meta.url), 'utf8'))
      await db.exec(await readFile(new URL('../../supabase/migrations/202609270011_booking_availability.sql', import.meta.url), 'utf8'))
      await db.exec(await readFile(new URL('../../supabase/migrations/202609270012_payment_refund_states.sql', import.meta.url), 'utf8'))
    }
    await releaseSetupLock()
    return db
  } catch (error) { await db.close(); throw error }
}
