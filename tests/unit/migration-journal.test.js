import { expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { localRehearsalUrl, migrationManifest, sha256 } from '../../scripts/lib/migration-journal.mjs';

it('cannot point rehearsal at production, beta, a different database or connection overrides', () => {
  for (const url of ['postgres://db.supabase.co/palette_test', 'postgres://127.0.0.1/postgres',
    'postgres://localhost/palette_test?host=production', 'https://localhost/palette_test']) {
    expect(() => localRehearsalUrl(url)).toThrow();
  }
  expect(localRehearsalUrl('postgres://localhost/palette_test').hostname).toBe('localhost');
});
it('checksums every actual migration and unwraps only the outer transaction', async () => {
  const files = await migrationManifest(new URL('../../supabase/migrations/', import.meta.url));
  expect(files.length).toBeGreaterThanOrEqual(42);
  expect(files[0].checksum).toMatch(/^[a-f0-9]{64}$/);
  expect(files[0].sql).not.toMatch(/^\s*begin;/i);
  expect(files[0].sql).toContain('create table public.generation_reservations');
});
it('rejects missing migration numbers and unbalanced transaction boundaries', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'laque-journal-'));
  const url = pathToFileURL(directory + '/');
  try {
    await writeFile(join(directory, '202610150002_gap.sql'), 'select 1;');
    await expect(migrationManifest(url)).rejects.toThrow('gap');
    await rm(join(directory, '202610150002_gap.sql'));
    await writeFile(join(directory, '202610150001_bad.sql'), 'begin; select 1;');
    await expect(migrationManifest(url)).rejects.toThrow('Missing commit');
    await writeFile(join(directory, '202610150001_bad.sql'), 'begin; select 1; commit;\nrollback;');
    await expect(migrationManifest(url)).rejects.toThrow();
    expect(sha256('a')).not.toBe(sha256('b'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
