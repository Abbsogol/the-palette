import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// This runner deliberately has no remote/production mode. Use a reviewed
// deployment process for production, never relax this guard to reuse a test.
export function localRehearsalUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'postgres:' && url.protocol !== 'postgresql:' ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.pathname !== '/palette_test' || url.search || url.hash) {
    throw new Error('Rehearsal requires a loopback palette_test control database');
  }
  return url;
}

export async function migrationManifest(directory) {
  const names = (await readdir(directory)).filter(name => name.endsWith('.sql')).sort();
  return Promise.all(names.map(async (name, index) => {
    if (!/^\d{12}_[a-z0-9_]+\.sql$/.test(name) || Number(name.slice(8, 12)) !== index + 1) {
      throw new Error('Migration sequence has a gap or invalid filename');
    }
    const bytes = await readFile(new URL(name, directory));
    const lines = bytes.toString('utf8').split('\n');
    while (lines.length && (!lines.at(-1).trim() || lines.at(-1).trim().startsWith('--'))) lines.pop();
    let sql = lines.join('\n').replace(/^(?:\s|--[^\n]*(?:\n|$))*/, '');
    if (/^begin;/i.test(sql)) {
      if (!/commit;\s*$/i.test(sql)) throw new Error(`Missing commit envelope: ${name}`);
      sql = sql.replace(/^begin;/i, '').replace(/commit;\s*$/i, '');
    }
    if (/^\s*(?:begin|commit|rollback);/im.test(sql)) throw new Error(`Unexpected transaction boundary: ${name}`);
    return { name, checksum: sha256(bytes), sql };
  }));
}

// Dedicated connected pg.Client required: session locks and transactions must
// not be split across pooled connections. Journal and DDL commit together.
export async function migrate(client, manifest) {
  const result = { applied: [], skipped: [] };
  await client.query("select pg_advisory_lock(86427045)");
  try {
    await client.query(`create schema if not exists release_ops;
      revoke all on schema release_ops from public,anon,authenticated;
      create table if not exists release_ops.migrations (
        name text primary key, checksum text not null check(length(checksum)=64),
        applied_at timestamptz not null default clock_timestamp(), elapsed_ms integer not null);
      revoke all on release_ops.migrations from public,anon,authenticated`);
    const history = (await client.query('select name,checksum from release_ops.migrations order by name')).rows;
    for (const [index, row] of history.entries()) {
      if (manifest[index]?.name !== row.name || manifest[index]?.checksum !== row.checksum) {
        throw new Error('Migration history mismatch: missing, reordered or changed applied migration');
      }
    }
    for (const item of manifest) {
      if (history.some(row => row.name === item.name)) { result.skipped.push(item.name); continue; }
      const start = performance.now();
      await client.query('begin');
      try {
        await client.query("set local lock_timeout='5s'; set local statement_timeout='60s'; set local search_path=public,extensions; set local row_security=on");
        await client.query(item.sql);
        await client.query('insert into release_ops.migrations(name,checksum,elapsed_ms) values($1,$2,$3)',
          [item.name, item.checksum, Math.ceil(performance.now() - start)]);
        await client.query('commit');
        result.applied.push(item.name);
      } catch (error) {
        await client.query('rollback');
        // SQL errors can contain row values; callers only receive the migration
        // identity and SQLSTATE, never a connection string or a personal row.
        throw new Error(`Migration failed: ${item.name} (${error.code || 'unknown'})`);
      }
    }
    return result;
  } finally { await client.query('select pg_advisory_unlock(86427045)'); }
}
