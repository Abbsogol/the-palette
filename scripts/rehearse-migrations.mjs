import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile, chmod } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import pg from 'pg';
import { localRehearsalUrl, migrationManifest, migrate, sha256 } from './lib/migration-journal.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = promisify(execFile);
const ids = [1, 2, 3].map(n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
const [owner, member, closed] = ids;

export async function rehearse({ connectionString, output, pgDump = 'pg_dump', pgRestore = 'pg_restore' }) {
  const controlUrl = localRehearsalUrl(connectionString);
  const manifest = await migrationManifest(new URL('../supabase/migrations/', import.meta.url));
  const prefix = `palette_rehearsal_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client({ connectionString: controlUrl.href });
  const databases = [], clients = new Set();
  const report = { scope: 'Disposable local PostgreSQL; synthetic accounts only',
    productionVerified: false, baselineDate: '2026-09-27', checks: [], backups: [], manifest: manifest.map(({ name, checksum }) => ({ name, checksum })) };
  const check = name => { report.checks.push(name); console.log(`PASS ${name}`); };
  await mkdir(output, { recursive: true, mode: 0o700 });
  const connect = async name => {
    const url = new URL(controlUrl); url.pathname = `/${name}`;
    const client = new pg.Client({ connectionString: url.href });
    await client.connect(); clients.add(client); return client;
  };
  const end = async client => { clients.delete(client); await client.end(); };
  const create = async suffix => {
    const name = `${prefix}_${suffix}`;
    await admin.query(`create database ${name}`); databases.push(name); return name;
  };
  const toolEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('PG')));
  Object.assign(toolEnv, { PGHOST: controlUrl.hostname, PGPORT: controlUrl.port || '5432',
    PGUSER: decodeURIComponent(controlUrl.username), PGPASSWORD: decodeURIComponent(controlUrl.password), PGSSLMODE: 'disable' });
  const backup = async (name, label) => {
    const file = join(output, `${label}.dump`);
    await run(pgDump, ['--format=custom', '--file', file, '--dbname', name], { env: toolEnv });
    await chmod(file, 0o600);
    const destination = await create(`restore${report.backups.length}`);
    await run(pgRestore, ['--exit-on-error', '--dbname', destination, file], { env: toolEnv });
    report.backups.push({ label, sha256: sha256(await readFile(file)), restored: true });
    check(`backup and restore ${label}`);
    return connect(destination);
  };
  const as = async (client, role, id, sql, args = []) => {
    assert.ok(['anon', 'authenticated', 'service_role'].includes(role));
    await client.query('begin');
    try {
      await client.query(`set local role ${role}; set local row_security=on`);
      await client.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claim.role',$2,true)", [id || '', role]);
      const result = await client.query(sql, args); await client.query('commit'); return result;
    } catch (error) { await client.query('rollback'); throw error; }
  };
  const snapshot = async client => (await client.query(`select id,display_name,credit_balance,onboarding_complete,
    deletion_started_at::text from profiles_data order by id`)).rows;
  const schema = async client => (await client.query(`select n.nspname,c.relname,c.relkind,c.relrowsecurity,
    coalesce(pg_get_viewdef(c.oid,true),'') as definition from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in('public','auth','storage','release_ops') and c.relkind in('r','v') order by 1,2`)).rows;
  // Catalog row/ACL ordering varies with server collation. Preserve column
  // order and every value, normalizing only unordered metadata collections.
  const canonical = value => {
    const normalize = (item, key = '') => {
      if (key === 'acl' && typeof item === 'string') return item.slice(1, -1).split(',').sort().join(',');
      if (Array.isArray(item)) {
        const values = item.map(child => normalize(child));
        return key === 'columns' ? values : values.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b), 'en'));
      }
      if (item && typeof item === 'object') return Object.fromEntries(Object.keys(item).sort().map(k => [k, normalize(item[k], k)]));
      return item;
    };
    return JSON.stringify(normalize(value));
  };
  await admin.connect();
  try {
    // Same lock as other SQL suites: roles are shared across databases.
    await admin.query('select pg_advisory_lock(86427004)');
    for (const role of ['anon', 'authenticated', 'service_role', 'supabase_admin', 'supabase_auth_admin', 'supabase_storage_admin', 'dashboard_user']) {
      if (!(await admin.query('select 1 from pg_roles where rolname=$1', [role])).rows.length)
        await admin.query(`create role ${role} ${role === 'service_role' ? 'bypassrls' : role.startsWith('supabase_') ? 'superuser' : ''}`);
    }
    const name = await create('upgrade'), client = await connect(name);
    report.postgres = (await client.query('show server_version')).rows[0].server_version;
    assert.equal(Number(report.postgres.split('.')[0]), 17, 'Rehearsal requires PostgreSQL 17, not an emulator');
    await client.query('create schema extensions; create extension "uuid-ossp" with schema extensions; create extension pgcrypto with schema extensions; create publication supabase_realtime');
    for (const path of ['tests/fixtures/supabase-managed-schema.sql', 'supabase/bootstrap/20260927_legacy_schema.sql', 'supabase/bootstrap/20261015_rehearsal_alignment.sql']) {
      const bytes = await readFile(join(root, path));
      report[path] = sha256(bytes); await client.query(bytes.toString());
    }
    await client.query('set search_path=public,extensions; set row_security=on; set check_function_bodies=on');
    const inventorySql = await readFile(join(root, 'supabase/operations/production-schema-inventory.sql'), 'utf8');
    const baselineInventory = (await client.query(inventorySql)).rows[0].inventory;
    await writeFile(join(output, 'baseline-inventory.json'), JSON.stringify(baselineInventory, null, 2) + '\n', { mode: 0o600 });
    const productionBytes = await readFile(join(root, 'supabase/bootstrap/20261015_production_inventory.json'));
    const productionInventory = JSON.parse(productionBytes);
    for (const field of ['relations', 'functions', 'default_privileges', 'publication_tables']) {
      if (canonical(baselineInventory[field]) !== canonical(productionInventory[field])) throw new Error(`Production baseline mismatch: ${field}`);
    }
    assert.equal(productionInventory.migration_history_present, false);
    report.productionBaseline = { project: 'faunikvhoommbebsmevg', capturedAt: productionInventory.captured_at,
      version: productionInventory.database_version, inventorySha256: sha256(productionBytes), matched: true,
      fields: ['relations including owners/options/ACL/columns/constraints/indexes/policies/triggers/views', 'functions including body hashes/owners/ACL/settings', 'default privileges', 'publication tables'] };
    report.productionVerified = true;
    report.managedServiceLimits = 'Local PG17.10 versus hosted PG17.6. Managed pg_stat_statements and supabase_vault extensions, Auth/Storage HTTP and production object bytes are not reproduced.';
    check('fresh production schema inventory matches reconstructed baseline including privileges and function hashes');
    await admin.query('select pg_advisory_unlock(86427004)');
    for (const [index, id] of ids.entries()) {
      await client.query("insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values($1,$2,now(),'{}')", [id, `rehearsal${index}@example.invalid`]);
      await client.query('update profiles_data set display_name=$1,credit_balance=$2,onboarding_complete=true where id=$3', [`Synthetic ${index}`, [37, 0, 19][index], id]);
    }
    const legacy = (await client.query('select id,display_name,credit_balance,onboarding_complete from profiles_data order by id')).rows;
    const legacyRestore = await backup(name, 'legacy');
    assert.deepEqual((await legacyRestore.query('select id,display_name,credit_balance,onboarding_complete from profiles_data order by id')).rows, legacy);
    await end(legacyRestore);
    const first = await migrate(client, manifest.slice(0, 26));
    assert.equal(first.applied.length, 26);
    assert.deepEqual((await client.query('select id,display_name,credit_balance,onboarding_complete from profiles_data order by id')).rows, legacy);
    await as(client, 'service_role', null,
      "select apply_credit_payment('evt_rehearsal_existing','pi_rehearsal_existing',$1,30,'cs_rehearsal_existing',0)", [owner]);
    // Upgrade a populated intermediate schema, including irreversible closure
    // and a durable pending financial obligation, not just empty CREATE TABLEs.
    await as(client, 'service_role', null, 'select close_account($1)', [closed]);
    await client.query("insert into payment_checkouts(user_id,scope,params) values($1,'credits','{}')", [closed]);
    const intermediate = await snapshot(client);
    const existingReceipt = (await client.query('select * from credit_payments')).rows;
    const checkpoint = await backup(name, 'checkpoint026');
    assert.deepEqual(await snapshot(checkpoint), intermediate);
    const concurrent = await connect(name);
    const runs = await Promise.all([migrate(client, manifest), migrate(concurrent, manifest)]);
    assert.equal(runs.reduce((n, r) => n + r.applied.length, 0), manifest.length - 26);
    await end(concurrent);
    assert.deepEqual(await snapshot(client), intermediate);
    assert.deepEqual((await client.query('select * from credit_payments')).rows, existingReceipt);
    assert.equal((await client.query('select count(*)::int n from account_closures where user_id=$1', [closed])).rows[0].n, 1);
    assert.equal((await client.query('select count(*)::int n from payment_checkouts where user_id=$1', [closed])).rows[0].n, 1);
    check('001 through 042 preserve existing identities, balances, closure and financial obligation');
    check('two independent migration connections apply each remaining migration exactly once');
    await migrate(checkpoint, manifest);
    assert.deepEqual(await snapshot(checkpoint), intermediate);
    assert.deepEqual(await schema(checkpoint), await schema(client));
    await end(checkpoint);
    check('restored intermediate backup upgrades to the matching final schema');
    const rerun = await migrate(client, manifest);
    assert.equal(rerun.applied.length, 0); assert.equal(rerun.skipped.length, manifest.length);
    check('complete rerun skips the unchanged checksum journal');
    const altered = manifest.map((item, i) => i === 0 ? { ...item, checksum: '0'.repeat(64) } : item);
    await assert.rejects(migrate(client, altered), /history mismatch/);
    await assert.rejects(migrate(client, manifest.slice(1)), /history mismatch/);
    check('changed or missing applied history fails closed');
    // Synthetic 043 only in this disposable database. No checked-in historical
    // migration is edited, nor is a failed migration falsely marked complete.
    const failed = { name: '202610150043_rehearsal_failure.sql', checksum: sha256('failed rehearsal'),
      sql: "create table release_ops.repair_probe(id int); update profiles_data set credit_balance=9999; select 1/0" };
    await assert.rejects(migrate(client, [...manifest, failed]), /22012/);
    assert.equal((await client.query("select to_regclass('release_ops.repair_probe') as name")).rows[0].name, null);
    assert.deepEqual(await snapshot(client), intermediate);
    assert.equal((await client.query('select count(*)::int n from release_ops.migrations')).rows[0].n, manifest.length);
    const repair = { ...failed, checksum: sha256('corrected unapplied rehearsal'), sql: 'create table release_ops.repair_probe(id int)' };
    await migrate(client, [...manifest, repair]);
    const forward = { name: '202610150044_rehearsal_forward_repair.sql', checksum: sha256('forward rehearsal'), sql: 'alter table release_ops.repair_probe add column repaired boolean not null default true' };
    await migrate(client, [...manifest, repair, forward]);
    check('injected failure rolls back DDL, balances and journal; retry and additive forward repair succeed');
    await assert.rejects(as(client, 'anon', null, 'select id from profiles'), /permission denied/);
    await assert.rejects(as(client, 'authenticated', member, 'select email,credit_balance from profiles_data'), /permission denied/);
    await assert.rejects(as(client, 'authenticated', member, 'select * from release_ops.migrations'), /permission denied/);
    await assert.rejects(as(client, 'authenticated', member, 'select * from admin_staff'), /permission denied/);
    assert.equal((await as(client, 'authenticated', member, 'select id,banner_url from profiles where id=$1', [member])).rows.length, 1);
    assert.equal((await as(client, 'authenticated', member, 'select id from profiles where id=$1', [closed])).rows.length, 0);
    assert.equal((await as(client, 'authenticated', closed, 'select id from profiles')).rows.length, 0);
    await assert.rejects(as(client, 'service_role', null, 'select delete_account($1)', [closed]), /BILLING_IN_PROGRESS|RETENTION_REVIEW_REQUIRED/);
    const status = (await as(client, 'service_role', null, 'select lab_subscription_status($1) as status', [owner])).rows[0].status;
    assert.equal(status.active, false); assert.equal(status.purchasedTokens, 67);
    await Promise.all([client, await connect(name)].map(async c => {
      await as(c, 'service_role', null,
        "select apply_credit_payment('evt_rehearsal_existing','pi_rehearsal_existing',$1,30,'cs_rehearsal_existing',0)", [owner]);
      if (c !== client) await end(c);
    }));
    assert.equal((await client.query('select credit_balance from profiles_data where id=$1', [owner])).rows[0].credit_balance, 67);
    assert.equal((await client.query('select count(*)::int n from credit_payments')).rows[0].n, 1);
    check('existing purchase survives the upgrade and concurrent provider replay grants no duplicate credits');
    check('member identity/banner contract, private raw columns, staff isolation and closure safeguards');
    const contender = await connect(name), period = new Date(Date.now() - 86400000);
    await client.query("insert into mobile_entitlements(user_id,store,product_id,plan_id,expires_at,refunded) values($1,'APP_STORE','laque_lab_monthly_5','premium',now()+interval '25 days',false)", [owner]);
    await client.query("insert into lab_monthly_allowances(user_id,store,product_id,period_start,period_end) values($1,'APP_STORE','laque_lab_monthly_5',$2,now()+interval '25 days')", [owner, period]);
    const request = randomUUID();
    const race = await Promise.all([client, contender].map(c => as(c, 'service_role', null, 'select claim_generation($1,$2,null,$3) as status', [request, owner, 'a'.repeat(64)])));
    assert.deepEqual(race.map(r => r.rows[0].status).sort(), ['claimed', 'reserved']);
    assert.equal((await client.query('select used from lab_monthly_allowances where user_id=$1', [owner])).rows[0].used, 1);
    await Promise.all([client, contender].map(c => as(c, 'service_role', null, 'select release_generation($1)', [request])));
    assert.equal((await client.query('select used from lab_monthly_allowances where user_id=$1', [owner])).rows[0].used, 0);
    await client.query("insert into admin_staff(user_id,role) values($1,'owner')", [owner]);
    const key = randomUUID(), correction = { key, delta: 3 };
    await Promise.all([client, contender].map(c => as(c, 'service_role', null, "select admin_mutate($1,'credits',$2,'Synthetic correction',$3)", [owner, member, correction])));
    assert.equal((await client.query('select credit_balance from profiles_data where id=$1', [member])).rows[0].credit_balance, 3);
    assert.equal((await client.query('select count(*)::int n from admin_credit_corrections')).rows[0].n, 1);
    await end(contender);
    check('concurrent generation/release and duplicate credit correction preserve exactly-once balances');
    const newcomer = '00000000-0000-4000-8000-000000000004';
    await client.query("insert into auth.users(id,email,email_confirmed_at) values($1,'onboarding@example.invalid',now())", [newcomer]);
    const consent = { display_name: 'New synthetic member', age_confirmed: true, privacy_accepted: true,
      allergies: 'Synthetic private note', product_sensitivities: ['Gel'], removal_needed: true };
    assert.equal((await as(client, 'service_role', null, 'select complete_onboarding($1,$2) as ok', [newcomer, consent])).rows[0].ok, true);
    assert.equal((await as(client, 'service_role', null, 'select complete_onboarding($1,$2) as ok', [newcomer, consent])).rows[0].ok, false);
    assert.equal((await client.query('select credit_balance from profiles_data where id=$1', [newcomer])).rows[0].credit_balance, 3);
    assert.equal((await as(client, 'authenticated', member, 'select * from client_health_notes where user_id=$1', [newcomer])).rows.length, 0);
    assert.equal((await client.query('select allergies from client_health_notes where user_id=$1', [newcomer])).rows[0].allergies, 'Synthetic private note');
    const publicTables = (await client.query("select tablename,rowsecurity from pg_tables where schemaname='public' order by tablename")).rows;
    assert.ok(publicTables.every(table => table.rowsecurity), 'All public tables must have RLS');
    report.publicTables = publicTables;
    check('complete-profile RPC replay, private health fields and RLS match the app contract');
    const restored = await backup(name, 'final');
    assert.deepEqual(await snapshot(restored), await snapshot(client));
    assert.deepEqual(await schema(restored), await schema(client));
    const currentInventory = (await client.query(inventorySql)).rows[0].inventory;
    const restoredInventory = (await restored.query(inventorySql)).rows[0].inventory;
    delete currentInventory.captured_at; delete restoredInventory.captured_at;
    assert.equal(canonical(restoredInventory), canonical(currentInventory));
    for (const table of ['account_closures', 'payment_checkouts', 'credit_payments', 'client_health_notes', 'lab_monthly_allowances', 'generation_reservations', 'admin_credit_corrections', 'release_ops.migrations']) {
      const sql = `select to_jsonb(t) as row from ${table} t order by to_jsonb(t)::text`;
      assert.deepEqual((await restored.query(sql)).rows, (await client.query(sql)).rows);
    }
    await end(restored);
    check('final restore retains schema, grants, journal, closed accounts and exact financial rows');
    report.journal = (await client.query('select name,checksum,applied_at,elapsed_ms from release_ops.migrations order by name')).rows;
    await writeFile(join(output, 'final-inventory.json'), JSON.stringify((await client.query(inventorySql)).rows[0].inventory, null, 2) + '\n', { mode: 0o600 });
    report.productionNextStep = 'The captured 15 October production schema is matched in this disposable rehearsal. Recheck schema drift and migration history at rollout, take an encrypted production recovery backup, and verify hosted workers/PostgREST/app contracts before enabling writes. No production migration was applied. Storage object bytes and external services are not restored by SQL.';
    report.completedAt = new Date().toISOString();
    await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n', { mode: 0o600 });
    return report;
  } finally {
    for (const client of clients) await client.end();
    for (const name of databases.reverse()) await admin.query(`drop database ${name}`);
    await admin.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const output = resolve(root, 'scripts/output', `migration-rehearsal-${randomUUID()}`);
  try {
    const report = await rehearse({ connectionString: process.env.DATABASE_TEST_URL, output,
      pgDump: process.env.REHEARSAL_PG_DUMP || 'pg_dump', pgRestore: process.env.REHEARSAL_PG_RESTORE || 'pg_restore' });
    console.log(`${report.checks.length} checks passed; report: ${join(output, 'report.json')}`);
  } catch (error) {
    // No connection strings, pg stderr or source database row values in logs.
    console.error(`Rehearsal failed (${error.code || error.name}). Inspect locally; no production changes were made.`);
    process.exitCode = 1;
  }
}
