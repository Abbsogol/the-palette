import { accountScope } from "../src/lib/account-scope";
import {
  markActivity,
  loadActivity,
  activityDestination,
} from "../src/features/notifications/data";
import { supabase } from "../src/lib/supabase";
import type { Activity } from "../src/features/notifications/model";
jest.mock("../src/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
let q: Record<string, jest.Mock>, result: { data: unknown; error: unknown };
const row: Activity = {
  id: "00000000-0000-4000-8000-000000000003",
  user_id: "owner",
  actor_id: "00000000-0000-4000-8000-000000000002",
  type: "like",
  read: false,
  design_id: "00000000-0000-4000-8000-000000000004",
  comment_preview: null,
  created_at: "2026-10-07T00:00:00Z",
};
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("owner", true);
  result = { data: [], error: null };
  q = Object.fromEntries(
    ["select", "eq", "order", "range", "abortSignal", "update", "in"].map(
      (method) => [method, jest.fn(() => q)],
    ),
  );
  q.then = jest.fn((done) => Promise.resolve(result).then(done));
  q.maybeSingle = jest.fn(() => Promise.resolve(result));
  jest.mocked(supabase.from).mockReturnValue(q as never);
});
afterEach(() => accountScope.change(null));
test("reads are owner scoped and use a sentinel row for pagination", async () => {
  result.data = [row, { ...row, id: "sentinel" }];
  const page = await loadActivity("owner", 1, new AbortController().signal);
  expect(page.items).toHaveLength(1);
  expect(page.hasMore).toBe(true);
  expect(q.eq).toHaveBeenCalledWith("user_id", "owner");
  expect(q.range).toHaveBeenCalledWith(0, 1);
});
test("foreign data is rejected even if a transport returns it", async () => {
  result.data = [{ ...row, user_id: "other" }];
  await expect(
    loadActivity("owner", 40, new AbortController().signal),
  ).rejects.toThrow(/access changed/);
});
test("marking read requires confirmed matching rows and never treats a denied zero-row update as success", async () => {
  await expect(markActivity("owner", [row.id], true)).rejects.toThrow(
    /no longer available/,
  );
  expect(q.eq).toHaveBeenCalledWith("user_id", "owner");
  result.data = [{ id: row.id, read: true }];
  await markActivity("owner", [row.id], true);
  expect(q.update).toHaveBeenCalledWith({ read: true });
  result.data = [{ id: row.id, read: false }];
  await expect(markActivity("owner", [row.id], true)).rejects.toThrow();
});
test("revoked content stays in activity and cannot navigate", async () => {
  result.data = null;
  await expect(activityDestination("owner", row)).rejects.toThrow(
    /no longer have access/,
  );
  result.data = { id: row.design_id };
  expect(await activityDestination("owner", row)).toBe(
    `/design/${row.design_id}`,
  );
  expect(q.eq).toHaveBeenCalledWith("id", row.design_id);
});
test("message and booking activities use protected lists rather than inventing a target ID", async () => {
  expect(
    await activityDestination("owner", { ...row, type: "new_message" }),
  ).toBe("/messages");
  expect(
    await activityDestination("owner", { ...row, type: "booking_request" }),
  ).toBe("/appointments");
  expect(supabase.from).not.toHaveBeenCalled();
});
test("account changes after a write discard completion", async () => {
  q.then.mockImplementation((done) => {
    accountScope.change("other");
    return Promise.resolve({
      data: [{ id: row.id, read: true }],
      error: null,
    }).then(done);
  });
  await expect(markActivity("owner", [row.id], true)).rejects.toThrow(
    /account changed/,
  );
});
test("activity uses the current permitted profile photo and falls back for unavailable actors", async () => {
  const actor = {
    id: row.actor_id,
    display_name: "Sarah",
    username: "sarah",
    avatar_url: "https://example.invalid/current-avatar.png",
  };
  q.then.mockImplementationOnce((done) =>
    Promise.resolve({ data: [row], error: null }).then(done),
  );
  q.then.mockImplementationOnce((done) =>
    Promise.resolve({ data: [actor], error: null }).then(done),
  );
  expect(
    (await loadActivity("owner", 40, new AbortController().signal)).items[0]
      .actor,
  ).toEqual(actor);
  expect(q.in).toHaveBeenCalledWith("id", [row.actor_id]);
  q.then.mockImplementationOnce((done) =>
    Promise.resolve({ data: [row], error: null }).then(done),
  );
  q.then.mockImplementationOnce((done) =>
    Promise.resolve({ data: [], error: null }).then(done),
  );
  expect(
    (await loadActivity("owner", 40, new AbortController().signal)).items[0]
      .actor,
  ).toBeNull();
});
