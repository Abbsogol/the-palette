import { beforeEach, it, expect, vi } from "vitest";
import { database, jsonRequest, ok } from "../helpers/supabase";
const state = vi.hoisted(() => ({ user: { id: "owner" }, db: null }));
vi.mock("@/lib/auth", () => ({
  getSessionUser: vi.fn(async () => state.user),
  get serviceClient() {
    return state.db;
  },
}));
import { POST } from "../../app/api/update-privacy-settings/route";
beforeEach(() => {
  state.user = { id: "owner" };
  state.db = database(() =>
    ok({
      is_private: true,
      message_permission: "followers",
      show_saves: false,
    }),
  );
});
it("requires owner auth and returns the actually updated settings with no caching", async () => {
  const response = await POST(
    jsonRequest({
      is_private: true,
      message_permission: "followers",
      show_saves: false,
      id: "stranger",
      is_admin: true,
    }),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(await response.json()).toEqual({
    ok: true,
    settings: {
      is_private: true,
      message_permission: "followers",
      show_saves: false,
    },
  });
  expect(state.db.calls[0]).toMatchObject({
    table: "profiles_data",
    values: {
      is_private: true,
      message_permission: "followers",
      show_saves: false,
    },
    filters: [["eq", "id", "owner"]],
  });
  state.user = null;
  expect((await POST(jsonRequest({ is_private: true }))).status).toBe(401);
});
it.each([
  null,
  { is_private: false, message_permission: "everyone", show_saves: false },
])(
  "zero rows and mismatching writes cannot show a saved setting: %j",
  async (data) => {
    state.db = database(() => ok(data));
    expect((await POST(jsonRequest({ is_private: true }))).status).toBe(503);
  },
);
it("invalid messaging permissions never reach the database", async () => {
  expect(
    (await POST(jsonRequest({ message_permission: "made-up" }))).status,
  ).toBe(400);
  expect(state.db.calls).toEqual([]);
});
