import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { database, ok } from "../helpers/supabase";
import {
  seal,
  unseal,
  permittedReturn,
  startConnection,
  receiveCallback,
  finalizeConnection,
  saveSources,
  freeBusy,
  filterSlots,
  checkBooking,
  syncJobs,
  status,
  scopes,
} from "../../lib/calendar/google";

beforeEach(() => {
  vi.stubEnv("GOOGLE_CALENDAR_ENABLED", "true");
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_ID", "calendar-test-client");
  vi.stubEnv("GOOGLE_CALENDAR_CLIENT_SECRET", "calendar-test-secret");
  vi.stubEnv(
    "GOOGLE_CALENDAR_REDIRECT_URI",
    "https://beta.example.invalid/api/calendar/google/callback",
  );
  vi.stubEnv(
    "GOOGLE_CALENDAR_TOKEN_KEY",
    Buffer.alloc(32, 3).toString("base64"),
  );
  vi.stubEnv("GOOGLE_CALENDAR_RETURN_URLS", "laque-dev://calendar-connect");
});
afterEach(() => vi.unstubAllEnvs());
const booking = {
  id: "booking",
  creator_id: "tech",
  client_id: "client",
  service_id: "service",
  status: "confirmed",
  starts_at: "2026-10-01T10:00:00Z",
  ends_at: "2026-10-01T11:00:00Z",
  time_zone: "Asia/Dubai",
  location_snapshot: "Studio",
  notes: "Never share me",
};
const slot = {
  available: true,
  starts_at: booking.starts_at,
  ends_at: booking.ends_at,
};
const conn = (user) => ({
  id: `connection-${user}`,
  user_id: user,
  revision: 1,
  status: "connected",
  account_label: `${user}@example.invalid`,
  refresh_token_encrypted: seal({ refreshToken: `refresh-${user}` }, user),
  calendar_id: "laque-calendar",
  source_calendars: [{ id: `${user}@example.invalid`, name: "Personal" }],
});
const response = (data, status = 200) =>
  new Response(status === 204 ? null : JSON.stringify(data), { status });
const connections = (users = ["tech", "client"]) =>
  database((q) => {
    if (q.table === "google_calendar_connections")
      return ok(
        q.operation === "update"
          ? null
          : users.includes(q.filters[0][2])
            ? conn(q.filters[0][2])
            : null,
      );
    if (q.table === "google_calendar_checks") return ok(null);
    throw new Error("Unexpected query " + q.table);
  });
function provider(busyByUser = {}) {
  return vi.fn(async (url, init) => {
    if (url.includes("/token"))
      return response({
        access_token: new URLSearchParams(init.body).get("refresh_token"),
      });
    if (url.endsWith("/freeBusy")) {
      const { items } = JSON.parse(init.body);
      return response({
        calendars: Object.fromEntries(
          items.map(({ id }) => [id, { busy: busyByUser[id] || [] }]),
        ),
      });
    }
    throw new Error("Unexpected Google operation");
  });
}
it("encrypts OAuth grants with account binding and tamper detection", () => {
  const token = seal({ refreshToken: "private" }, "client");
  expect(token).not.toContain("private");
  expect(unseal(token, "client")).toEqual({ refreshToken: "private" });
  expect(() => unseal(token, "stranger")).toThrow();
  const bytes = Buffer.from(token, "base64");
  bytes[18] ^= 1;
  expect(() => unseal(bytes.toString("base64"), "client")).toThrow();
});
it("rejects arbitrary return hosts, query injection and Expo Go return schemes", () => {
  for (const url of [
    "https://evil.invalid",
    "laque-dev://calendar-connect?next=evil",
    "exp://local",
  ])
    expect(() => permittedReturn(url)).toThrow();
  expect(permittedReturn("laque-dev://calendar-connect")).toBe(
    "laque-dev://calendar-connect",
  );
});
it("stores only a state hash; OAuth requests only calendar permissions and offline consent", async () => {
  const db = database((q) =>
    ok(q.operation === "insert" ? { id: "attempt" } : null),
  );
  const start = await startConnection(
    db,
    "client",
    "laque-dev://calendar-connect",
  );
  const url = new URL(start.url);
  const saved = db.calls.find((q) => q.operation === "insert").values;
  expect(saved.state_hash).not.toBe(url.searchParams.get("state"));
  expect(saved.user_id).toBe("client");
  expect(url.searchParams.get("scope").split(" ")).toEqual(scopes);
  expect(url.searchParams.get("access_type")).toBe("offline");
  expect(start.attemptId).toBe("attempt");
});
it("callback stores an encrypted grant and only redirects an opaque attempt, never tokens", async () => {
  const db = database(
    () => ok(null),
    async () =>
      ok({
        id: "attempt",
        user_id: "client",
        return_url: "laque-dev://calendar-connect",
      }),
  );
  const send = vi.fn(async () =>
    response({
      access_token: "access",
      refresh_token: "private",
      scope: scopes.join(" "),
    }),
  );
  const result = await receiveCallback(
    db,
    new URLSearchParams({ state: "state", code: "code" }),
    send,
  );
  expect(result).toBe(
    "laque-dev://calendar-connect?attempt=attempt&calendar=authorized",
  );
  const saved = db.calls.find((q) => q.values?.grant_encrypted).values;
  expect(unseal(saved.grant_encrypted, "client")).toEqual({
    refreshToken: "private",
  });
  expect(JSON.stringify(db.calls)).not.toContain("private");
});
it.each(["denied", "missing-scope", "missing-token"])(
  "rejects incomplete calendar consent: %s",
  async (kind) => {
    const db = database(
      () => ok(null),
      async () =>
        ok({
          id: "attempt",
          user_id: "client",
          return_url: "laque-dev://calendar-connect",
        }),
    );
    const send = vi.fn(async () =>
      response({
        access_token: "access",
        refresh_token: kind === "missing-token" ? undefined : "private",
        scope: kind === "missing-scope" ? scopes[0] : scopes.join(" "),
      }),
    );
    const result = await receiveCallback(
      db,
      new URLSearchParams(
        kind === "denied"
          ? { state: "state", error: "access_denied" }
          : { state: "state", code: "code" },
      ),
      send,
    );
    expect(result).toContain("calendar=failed");
    expect(db.calls.some((q) => q.values?.grant_encrypted)).toBe(false);
    if (kind === "denied") expect(send).not.toHaveBeenCalled();
  },
);
it("rejects replayed callbacks before making a Google call", async () => {
  const db = database(
      () => {
        throw Error("unexpected");
      },
      async () => ok(null),
    ),
    send = vi.fn();
  await expect(
    receiveCallback(
      db,
      new URLSearchParams({ state: "state", code: "code" }),
      send,
    ),
  ).rejects.toMatchObject({ code: "CALENDAR_AUTH_EXPIRED" });
  expect(send).not.toHaveBeenCalled();
});
it("finalization is account-scoped, and retry after committed success is idempotent", async () => {
  const send = vi.fn(),
    db = database((q) =>
      ok(
        q.table === "google_calendar_oauth"
          ? null
          : { ...conn("client"), last_oauth_attempt: "attempt" },
      ),
    );
  await finalizeConnection(db, "client", "attempt", send);
  expect(db.calls[0].filters).toContainEqual(["eq", "user_id", "client"]);
  expect(send).not.toHaveBeenCalled();
  await expect(
    finalizeConnection(db, "client", "someone-elses-attempt", send),
  ).rejects.toMatchObject({ code: "CALENDAR_AUTH_EXPIRED" });
});
it("source calendars must belong to the connected account and exclude the LaQue output calendar", async () => {
  const db = connections(),
    send = vi.fn(async (url) =>
      url.includes("/token")
        ? response({ access_token: "access" })
        : response({
            items: [
              { id: "client@example.invalid", primary: true },
              { id: "laque-calendar" },
            ],
          }),
    );
  for (const ids of [
    [],
    ["client@example.invalid", "client@example.invalid"],
    ["stranger"],
    ["laque-calendar"],
  ])
    await expect(saveSources(db, "client", ids, send)).rejects.toMatchObject({
      code: "INVALID_CALENDARS",
    });
  expect(db.calls.filter((q) => q.operation === "update")).toHaveLength(0);
});
it("filters creator busy intervals across timezones; clients get warnings without private event data", async () => {
  const db = connections(),
    send = provider({
      "tech@example.invalid": [
        {
          start: "2026-10-01T14:30:00+04:00",
          end: "2026-10-01T15:00:00+04:00",
        },
      ],
      "client@example.invalid": [
        {
          start: "2026-10-01T10:00:00Z",
          end: "2026-10-01T11:00:00Z",
          summary: "Private",
        },
      ],
    });
  const result = await filterSlots(
    db,
    "client",
    "tech",
    [
      slot,
      {
        available: true,
        starts_at: "2026-10-01T11:00:00Z",
        ends_at: "2026-10-01T12:00:00Z",
      },
    ],
    send,
  );
  expect(result[0]).toMatchObject({
    available: false,
    client_calendar_conflict: true,
    client_calendar_state: "checked",
  });
  expect(result[1]).toMatchObject({
    available: true,
    client_calendar_conflict: false,
  });
  expect(JSON.stringify(result)).not.toContain("Private");
  expect(
    send.mock.calls.filter(([url]) => url.endsWith("/freeBusy")),
  ).toHaveLength(2);
});
it("fails closed for an unreadable creator calendar but returns an explicit unchecked state for a client", async () => {
  const bad = vi.fn(async (url) =>
    url.includes("/token")
      ? response({ access_token: "access" })
      : response({ calendars: {} }),
  );
  await expect(
    filterSlots(connections(["tech"]), "client", "tech", [slot], bad),
  ).rejects.toThrow("could not be checked");
  expect(
    await filterSlots(connections(["client"]), "client", "tech", [slot], bad),
  ).toEqual([
    {
      ...slot,
      client_calendar_state: "unavailable",
      client_calendar_conflict: false,
    },
  ]);
});
it("revoked OAuth grants become reconnect_required; no free/busy call is attempted", async () => {
  const db = connections(),
    send = vi.fn(async () => response({ error: "invalid_grant" }, 400));
  await expect(
    freeBusy(db, conn("tech"), slot.starts_at, slot.ends_at, send),
  ).rejects.toMatchObject({ code: "CALENDAR_RECONNECT" });
  expect(db.calls[0].values).toEqual({ status: "reconnect_required" });
  expect(send).toHaveBeenCalledTimes(1);
});
it("fresh client conflict needs acknowledgement; creator conflict cannot be overridden", async () => {
  const db = connections();
  const conflict = [{ start: booking.starts_at, end: booking.ends_at }];
  await expect(
    checkBooking(
      db,
      booking,
      "request",
      false,
      provider({ "client@example.invalid": conflict }),
    ),
  ).rejects.toMatchObject({ code: "CLIENT_CALENDAR_CONFLICT" });
  expect(db.calls.some((q) => q.table === "google_calendar_checks")).toBe(
    false,
  );
  await checkBooking(
    db,
    booking,
    "request",
    true,
    provider({ "client@example.invalid": conflict }),
  );
  expect(
    db.calls.find((q) => q.table === "google_calendar_checks").values,
  ).toMatchObject({
    booking_id: "booking",
    connection_id: "connection-tech",
    connection_revision: 1,
  });
  await expect(
    checkBooking(
      db,
      booking,
      "request",
      true,
      provider({ "tech@example.invalid": conflict }),
    ),
  ).rejects.toMatchObject({ code: "CREATOR_CALENDAR_CONFLICT" });
});
it("confirmation checks the tech again without reading the client calendar", async () => {
  const send = provider();
  await checkBooking(connections(), booking, "confirm", false, send);
  expect(
    send.mock.calls.filter(([url]) => url.endsWith("/freeBusy")),
  ).toHaveLength(1);
  expect(JSON.stringify(send.mock.calls)).not.toContain("refresh-client");
});
function jobDb(status = "confirmed") {
  return database(
    (q) =>
      q.table === "google_calendar_connections"
        ? ok(conn("client"))
        : ok(status === null ? null : { ...booking, status }),
    async (name) =>
      ok(
        name === "claim_google_calendar_jobs"
          ? [
              {
                user_id: "client",
                booking_id: "booking",
                revision: 2,
                claim_token: "claim",
              },
            ]
          : true,
      ),
  );
}
it("deterministic event IDs recover a lost create response without duplicate events or private notes", async () => {
  const db = jobDb(),
    events = new Set();
  let lost = true;
  const send = vi.fn(async (url, init) => {
    if (url.includes("/token")) return response({ access_token: "access" });
    const id =
      init.method === "POST" ? JSON.parse(init.body).id : url.split("/").at(-1);
    if (init.method === "PUT" && !events.has(id)) return response({}, 404);
    if (init.method === "POST") {
      events.add(id);
      if (lost) {
        lost = false;
        throw new Error("response lost");
      }
    }
    return response({ id });
  });
  expect(await syncJobs(db, "client", send)).toEqual({ synced: 0, failed: 1 });
  expect(await syncJobs(db, "client", send)).toEqual({ synced: 1, failed: 0 });
  expect(events.size).toBe(1);
  expect(
    send.mock.calls.filter(
      ([, i]) =>
        i.method === "POST" && i.headers["Content-Type"] === "application/json",
    ),
  ).toHaveLength(1);
  expect(JSON.stringify(send.mock.calls)).not.toContain("Never share me");
  expect(db.rpc.mock.calls.at(-1)[1]).toMatchObject({
    p_revision: 2,
    p_claim: "claim",
    p_error: null,
  });
});
it.each(["cancelled", "declined", null])(
  "latest %s booking state removes calendar copy idempotently",
  async (status) => {
    const db = jobDb(status),
      send = vi.fn(async (url) =>
        url.includes("/token")
          ? response({ access_token: "access" })
          : response({}, 410),
      );
    expect(await syncJobs(db, "client", send)).toEqual({
      synced: 1,
      failed: 0,
    });
    expect(send.mock.calls[1][1].method).toBe("DELETE");
  },
);
it("provider failures leave durable retry work and never report a successful sync", async () => {
  const db = jobDb(),
    send = vi.fn(async (url) =>
      url.includes("/token")
        ? response({ access_token: "access" })
        : response({ error: "private upstream payload" }, 503),
    );
  expect(await syncJobs(db, "client", send)).toEqual({ synced: 0, failed: 1 });
  expect(db.rpc.mock.calls.at(-1)[1].p_error).toBe(
    "Calendar update pending. Retry is safe.",
  );
});

it('calendar status remains manageable when Google revokes access, with counts computed in SQL',async()=>{
 const db=database(q=>ok(q.operation==='update'?null:conn('client')),async name=>name==='google_calendar_sync_status'?ok({pending:1001,syncFailed:true}):ok(null));
 const state=await status(db,'client',true,vi.fn(async()=>response({error:'invalid_grant'},400)));
 expect(state).toMatchObject({configured:true,status:'reconnect_required',pending:1001,syncFailed:true,calendarError:expect.any(String)});
 expect(JSON.stringify(state)).not.toContain('refreshToken');
});
