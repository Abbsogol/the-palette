import { beforeEach, expect, it, vi } from "vitest";
import { database, ok } from "../helpers/supabase";
import { readMobilePushStatus } from "../../lib/mobile-push-status";
const state = vi.hoisted(() => ({ user: null, db: null }));
vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => state.user),
  get serviceClient() {
    return state.db;
  },
}));
import { GET } from "../../app/api/mobile/push/route";
const installation = "00000000-0000-4000-8000-000000000005";
const request = (id = installation) =>
  new Request(
    `https://example.invalid/api/mobile/push?installationId=${id}&userId=stranger`,
  );
beforeEach(() => {
  state.user = { id: "owner" };
  state.db = database(() =>
    ok({
      enabled: true,
      expires_at: new Date(Date.now() + 60000).toISOString(),
    }),
  );
});
it("requires authentication and a valid installation before touching registrations", async () => {
  state.user = null;
  expect((await GET(request())).status).toBe(401);
  state.user = { id: "owner" };
  expect((await GET(request("invalid"))).status).toBe(400);
  expect(state.db.calls).toEqual([]);
});
it("returns a no-store boolean scoped to the authenticated owner and installation without tokens", async () => {
  const response = await GET(request());
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({ enabled: true });
  expect(state.db.calls).toEqual([
    expect.objectContaining({
      table: "mobile_push_registrations",
      columns: "enabled,expires_at",
      filters: [
        ["eq", "user_id", "owner"],
        ["eq", "installation_id", installation],
      ],
    }),
  ]);
});
it.each([
  [null],
  [{ enabled: false, expires_at: "2099-01-01" }],
  [{ enabled: true, expires_at: "2026-10-07T00:00:00Z" }],
  [{ enabled: true, expires_at: "invalid" }],
])(
  "missing, disabled, expired and invalid registrations are off: %j",
  async (row) => {
    const client = database(() => ok(row));
    expect(
      await readMobilePushStatus(
        client,
        "owner",
        installation,
        Date.parse("2026-10-07T00:00:00Z"),
      ),
    ).toEqual({ enabled: false });
  },
);
it("a service failure returns retryable status rather than enabled or raw data", async () => {
  state.db = database(() => ({
    data: null,
    error: new Error("private token must never escape"),
  }));
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(await response.json()).toEqual({
    error: "Device notifications could not be checked. Please retry.",
  });
});
