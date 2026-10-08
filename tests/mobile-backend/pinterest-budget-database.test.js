import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
let db;
const owner = "00000000-0000-4000-8000-000000000901";
const stranger = "00000000-0000-4000-8000-000000000902";
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec("create role anon; create role authenticated; create role service_role; create schema auth; create table auth.users(id uuid primary key);");
  await db.exec(await readFile(new URL("../../supabase/migrations/202610080027_pinterest_budget.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../../supabase/migrations/202610080028_pinterest_budget_recovery.sql", import.meta.url), "utf8"));
  await db.exec(await readFile(new URL("../../supabase/migrations/202610080029_pinterest_pilot_allowance.sql", import.meta.url), "utf8"));
  await db.query("insert into auth.users values($1),($2)", [owner, stranger]);
}, 30000);
beforeEach(async () => { await db.exec("truncate pinterest_request_usage; update pinterest_request_gate set blocked_until='-infinity';"); });
afterAll(async () => { await db?.close(); });
const reserve = async (id = owner, day = 100, minute = 5, user = 10) =>
  (await db.query("select reserve_pinterest_request($1,$2,$3,$4) as result", [id, day, minute, user])).rows[0].result.allowed;
it("reserves atomically across interleaved accounts and keeps a shared minute ceiling", async () => {
  const calls = await Promise.all(Array.from({ length: 8 }, (_, i) => reserve(i % 2 ? owner : stranger)));
  expect(calls.filter(Boolean)).toHaveLength(5);
  expect((await db.query("select count(*)::int as count from pinterest_request_usage")).rows[0].count).toBe(5);
});
it("enforces rolling user/day ceilings, counting failed-call reservations too", async () => {
  expect(await reserve(owner, 3, 5, 2)).toBe(true); expect(await reserve(owner, 3, 5, 2)).toBe(true);
  expect(await reserve(owner, 3, 5, 2)).toBe(false);
  expect(await reserve(stranger, 3, 5, 2)).toBe(true); expect(await reserve(stranger, 3, 5, 2)).toBe(false);
  await db.exec("update pinterest_request_usage set requested_at=clock_timestamp()-interval '26 hours';");
  expect(await reserve(owner, 3, 5, 2)).toBe(true);
  expect((await db.query("select count(*)::int as count from pinterest_request_usage")).rows[0].count).toBe(1);
});
it("cooldown applies to every user and cannot be shortened by a later response", async () => {
  await db.query("select pause_pinterest_requests(120)");
  const first = (await db.query("select blocked_until from pinterest_request_gate")).rows[0].blocked_until;
  await db.query("select pause_pinterest_requests(10)");
  expect((await db.query("select blocked_until from pinterest_request_gate")).rows[0].blocked_until).toEqual(first);
  expect(await reserve(owner)).toBe(false); expect(await reserve(stranger)).toBe(false);
});
it("neither client role can read counters or call privileged functions", async () => {
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    try {
      await expect(db.query("select * from pinterest_request_usage")).rejects.toThrow(/permission denied/);
      await expect(reserve()).rejects.toThrow(/permission denied/);
      await expect(db.query("select pause_pinterest_requests(1)")).rejects.toThrow(/permission denied/);
      await expect(db.query("select reserve_pinterest_request_batch($1,100,5,10,2)", [owner])).rejects.toThrow(/permission denied/);
    } finally { await db.exec("reset role"); }
  }
});
it("reserves complete board reads without wasting the last call in a minute", async () => {
  const batch = () => db.query("select reserve_pinterest_request_batch($1,100,5,10,2) as result", [owner]);
  expect((await batch()).rows[0].result.allowed).toBe(true);
  expect((await batch()).rows[0].result.allowed).toBe(true);
  const denied = (await batch()).rows[0].result;
  expect(denied).toMatchObject({ allowed: false, reason: "minute" });
  expect(Date.parse(denied.retryAt)).toBeGreaterThan(Date.now());
  expect((await db.query("select count(*)::int as count from pinterest_request_usage")).rows[0].count).toBe(4);
  await db.exec("update pinterest_request_usage set requested_at=clock_timestamp()-interval '61 seconds'");
  expect((await batch()).rows[0].result.allowed).toBe(true);
});
it("reports the latest applicable reset, keeping daily limits and provider pauses intact", async () => {
  await db.query("insert into pinterest_request_usage(user_id,requested_at) select $1,clock_timestamp()-interval '2 hours' from generate_series(1,9)", [owner]);
  const denied = (await db.query("select reserve_pinterest_request_batch($1,100,5,10,2) as result", [owner])).rows[0].result;
  expect(denied).toMatchObject({ allowed: false, reason: "user" });
  expect(Date.parse(denied.retryAt)).toBeGreaterThan(Date.now()+21*3600000);
  await db.query("select pause_pinterest_requests(86400)");
  expect((await db.query("select reserve_pinterest_request_batch($1,100,5,10,2) as result", [owner])).rows[0].result.reason).toBe("provider");
});
it("permits the configured pilot allowance while keeping the shared limits and usage history", async () => {
  await db.query("insert into pinterest_request_usage(user_id,requested_at) select $1,clock_timestamp()-interval '2 hours' from generate_series(1,10)", [owner]);
  expect((await db.query("select reserve_pinterest_request_batch($1,100,5,30,2) as result", [owner])).rows[0].result.allowed).toBe(true);
  expect((await db.query("select count(*)::int as count from pinterest_request_usage")).rows[0].count).toBe(12);
  await expect(reserve(owner,100,5,31)).rejects.toThrow(/Invalid Pinterest budget/);
});
it("rejects invalid ceilings and fails closed if the gate row is missing", async () => {
  await expect(reserve(owner, 101)).rejects.toThrow(/Invalid Pinterest budget/);
  await expect(reserve(owner, null)).rejects.toThrow(/Invalid Pinterest budget/);
  await db.exec("delete from pinterest_request_gate"); expect(await reserve()).toBe(false);
  await db.exec("insert into pinterest_request_gate(id) values(true)");
});
