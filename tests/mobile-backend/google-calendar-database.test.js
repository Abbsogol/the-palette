import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createSecurityDatabase } from "../helpers/security-database";
const client = "00000000-0000-4000-8000-000000000811",
  creator = "00000000-0000-4000-8000-000000000812",
  stranger = "00000000-0000-4000-8000-000000000813",
  service = "00000000-0000-4000-8000-000000000814",
  booking = "00000000-0000-4000-8000-000000000815";
let db;
beforeAll(async () => {
  db = await createSecurityDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("truncate auth.users,profiles_data cascade");
  await db.query("insert into auth.users(id) values($1),($2),($3)", [
    client,
    creator,
    stranger,
  ]);
  await db.query(
    "update profiles_data set account_type='creator',booking_area='Studio' where id=$1",
    [creator],
  );
  await db.query(
    "insert into services(id,creator_id,name,duration_minutes,price,deposit_amount) values($1,$2,'Nails',30,100,20)",
    [service, creator],
  );
  await db.query(
    "insert into availability(creator_id,day_of_week,start_time,end_time) select $1,generate_series(0,6),'00:00'::time,'23:59'::time",
    [creator],
  );
  await db.query(
    "insert into creator_booking_settings values($1,'Asia/Dubai')",
    [creator],
  );
});
const connect = (u) =>
  db.query(
    "insert into google_calendar_connections(user_id,account_label,refresh_token_encrypted,calendar_id,source_calendars) values($1,'test@example.invalid','encrypted','calendar-id','[{\"id\":\"primary\"}]') returning *",
    [u],
  );
const book = () =>
  db.as(
    "authenticated",
    client,
    "insert into bookings(id,client_id,creator_id,service_id,booking_date,start_time,end_time,time_zone) values($1,$2,$3,$4,current_date+2,'10:00','10:30','Asia/Dubai') returning *",
    [booking, client, creator, service],
  );
const proof = (action = "request", user = client) =>
  db.query(
    "insert into google_calendar_checks(booking_id,action,client_id,creator_id,service_id,starts_at,ends_at,connection_id,connection_revision) select $1,$2,$3,$4,$5,booking_local_instant(current_date+2,'10:00','Asia/Dubai'),booking_local_instant(current_date+2,'10:30','Asia/Dubai'),id,revision from google_calendar_connections where user_id=$4 on conflict(booking_id,action) do update set client_id=excluded.client_id,connection_revision=excluded.connection_revision,expires_at=now()+interval '20 seconds'",
    [booking, action, user, creator, service],
  );
const confirm = () =>
  db.as(
    "authenticated",
    creator,
    "update bookings set status='confirmed' where id=$1 returning *",
    [booking],
  );
const claim = (u = null) =>
  db
    .as("service_role", null, "select claim_google_calendar_jobs($1,5) jobs", [
      u,
    ])
    .then((r) => r.rows[0].jobs);
const finish = (job, error = null) =>
  db
    .as(
      "service_role",
      null,
      "select finish_google_calendar_job($1,$2,$3,$4,$5) saved",
      [job.user_id, job.booking_id, job.claim_token, job.revision, error],
    )
    .then((r) => r.rows[0].saved);
it("denies OAuth tokens, check proofs, outbox reads and worker execution under realistic user roles", async () => {
  await connect(creator);
  for (const role of ["anon", "authenticated"])
    for (const table of [
      "google_calendar_connections",
      "google_calendar_oauth",
      "google_calendar_checks",
      "google_calendar_jobs",
    ])
      await expect(
        db.as(role, client, `select * from ${table}`),
      ).rejects.toThrow(/permission denied/);
  for (const call of [
    "select claim_google_calendar_jobs(null,5)",
    "select disconnect_google_calendar('" + creator + "')",
    "select claim_google_calendar_oauth('hash')",
  ])
    await expect(db.as("authenticated", stranger, call)).rejects.toThrow(
      /permission denied/,
    );
});
it("requires a fresh matching creator check even for direct inserts; consumes proof only with successful booking", async () => {
  await connect(creator);
  await expect(book()).rejects.toThrow("GOOGLE_CALENDAR_CHECK_REQUIRED");
  await proof("request", stranger);
  await expect(book()).rejects.toThrow("GOOGLE_CALENDAR_CHECK_REQUIRED");
  await proof();
  await db.exec(
    "update google_calendar_checks set expires_at=now()-interval '1 second'",
  );
  await expect(book()).rejects.toThrow("GOOGLE_CALENDAR_CHECK_REQUIRED");
  await proof();
  await book();
  expect(
    (await db.query("select count(*)::int n from google_calendar_checks"))
      .rows[0].n,
  ).toBe(0);
  expect(await claim()).toEqual([]);
});
it("rechecks confirmation, rejects a stale connection revision and queues both calendar copies atomically", async () => {
  await connect(creator);
  await connect(client);
  await proof();
  await book();
  await expect(confirm()).rejects.toThrow("GOOGLE_CALENDAR_CHECK_REQUIRED");
  await proof("confirm");
  await db.exec("update google_calendar_connections set revision=revision+1");
  await expect(confirm()).rejects.toThrow("GOOGLE_CALENDAR_CHECK_REQUIRED");
  await proof("confirm");
  await confirm();
  const jobs = await claim();
  expect(jobs.map((j) => j.user_id).sort()).toEqual([client, creator]);
  expect(await claim()).toEqual([]);
  for (const job of jobs) expect(await finish(job)).toBe(true);
  expect(
    (
      await db.query(
        "select count(*)::int n from google_calendar_jobs where synced_at is not null",
      )
    ).rows[0].n,
  ).toBe(2);
});
it("queues cancellation without a new calendar proof and fences an in-flight confirmation write", async () => {
  await connect(creator);
  await proof();
  await book();
  await proof("confirm");
  await confirm();
  const [job] = await claim();
  await db.as("authenticated", client, "select cancel_mobile_booking($1)", [
    booking,
  ]);
  expect(await claim()).toEqual([]);
  expect(await finish(job)).toBe(true);
  const [cancel] = await claim();
  expect(cancel.revision).toBeGreaterThan(job.revision);
  expect(await finish(job)).toBe(false);
  expect(await finish(cancel)).toBe(true);
});
it("preserves failed jobs, retries after backoff and prevents disconnect during an active provider write", async () => {
  await connect(creator);
  await proof();
  await book();
  await proof("confirm");
  await confirm();
  const [job] = await claim();
  await expect(
    db.as("service_role", null, "select disconnect_google_calendar($1)", [
      creator,
    ]),
  ).rejects.toThrow("CALENDAR_SYNC_BUSY");
  await finish(job, "Provider unavailable");
  expect(await claim()).toEqual([]);
  await db.exec(
    "update google_calendar_jobs set retry_at=now()-interval '1 second'",
  );
  const [retry] = await claim();
  expect(retry.claim_token).not.toBe(job.claim_token);
  expect(retry.revision).toBe(job.revision);
  await finish(retry);
  await db.as("service_role", null, "select disconnect_google_calendar($1)", [
    creator,
  ]);
  expect(
    (await db.query("select count(*)::int n from google_calendar_connections"))
      .rows[0].n,
  ).toBe(0);
  expect(
    (await db.query("select count(*)::int n from google_calendar_jobs")).rows[0]
      .n,
  ).toBe(0);
});
it("OAuth callback claims are one-use and cannot finalize for a different account", async () => {
  const {
    rows: [attempt],
  } = await db.query(
    "insert into google_calendar_oauth(user_id,state_hash,return_url) values($1,'hash','laque-dev://calendar-connect') returning *",
    [client],
  );
  const first = await db.as(
    "service_role",
    null,
    "select (claim_google_calendar_oauth('hash')).id id",
  );
  expect(first.rows[0].id).toBe(attempt.id);
  expect(
    (
      await db.as(
        "service_role",
        null,
        "select (claim_google_calendar_oauth('hash')).id id",
      )
    ).rows[0].id,
  ).toBeNull();
  await db.query(
    "update google_calendar_oauth set grant_encrypted='cipher' where id=$1",
    [attempt.id],
  );
  await expect(
    db.as(
      "service_role",
      null,
      "select finish_google_calendar_connection($1,$2,'calendar@example.invalid','cipher','laque-cal','[]')",
      [stranger, attempt.id],
    ),
  ).rejects.toThrow("CALENDAR_AUTH_EXPIRED");
  await db.as(
    "service_role",
    null,
    "select finish_google_calendar_connection($1,$2,'calendar@example.invalid','cipher','laque-cal','[{\"id\":\"primary\"}]')",
    [client, attempt.id],
  );
  expect(
    (
      await db.query(
        "select user_id,last_oauth_attempt from google_calendar_connections",
      )
    ).rows,
  ).toEqual([{ user_id: client, last_oauth_attempt: attempt.id }]);
  expect(
    (await db.query("select count(*)::int n from google_calendar_oauth"))
      .rows[0].n,
  ).toBe(0);
});
it("queues calendar removal if a booking is deleted; missing booking cannot erase the durable job", async () => {
  await connect(creator);
  await proof();
  await book();
  await proof("confirm");
  await confirm();
  const [job] = await claim();
  await finish(job);
  await db.query("delete from bookings where id=$1", [booking]);
  const [removal] = await claim();
  expect(removal.booking_id).toBe(booking);
  expect(removal.revision).toBeGreaterThan(job.revision);
});

it("keeps credentials for pending cancellation updates until sync or explicit disconnect before account deletion", async () => {
  await connect(client);
  await book();
  await confirm();
  for (const job of await claim()) await finish(job);
  await db.as("authenticated", client, "select cancel_mobile_booking($1)", [
    booking,
  ]);
  await expect(
    db.as("service_role", null, "select begin_account_deletion($1)", [client]),
  ).rejects.toThrow("CALENDAR_SYNC_PENDING");
  expect(
    (
      await db.query(
        "select deletion_started_at from profiles_data where id=$1",
        [client],
      )
    ).rows[0].deletion_started_at,
  ).toBeNull();
  for (const job of await claim()) await finish(job);
  await db.as("service_role", null, "select begin_account_deletion($1)", [
    client,
  ]);
  expect(
    (
      await db.query(
        "select deletion_started_at from profiles_data where id=$1",
        [client],
      )
    ).rows[0].deletion_started_at,
  ).not.toBeNull();
});

it("concurrent workers cannot claim the same booking update", async () => {
  await connect(client);
  await book();
  await confirm();
  const results = await Promise.all([
    claim(client),
    claim(client),
    claim(client),
  ]);
  expect(results.flat()).toHaveLength(1);
  expect(await finish(results.flat()[0])).toBe(true);
});

it("counts pending updates beyond the REST row cap without exposing another account", async () => {
  await connect(client);
  await connect(creator);
  await db.query(
    "insert into google_calendar_jobs(user_id,booking_id,last_error) select $1,gen_random_uuid(),'retry' from generate_series(1,1001)",
    [client],
  );
  const result = await db.as(
    "service_role",
    null,
    "select google_calendar_sync_status($1) summary",
    [client],
  );
  expect(result.rows[0].summary).toEqual({ pending: 1001, syncFailed: true });
  expect(
    (
      await db.as(
        "service_role",
        null,
        "select google_calendar_sync_status($1) summary",
        [creator],
      )
    ).rows[0].summary,
  ).toEqual({ pending: 0, syncFailed: false });
  await expect(
    db.as("authenticated", stranger, "select google_calendar_sync_status($1)", [
      client,
    ]),
  ).rejects.toThrow(/permission denied/);
});
