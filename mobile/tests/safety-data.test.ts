import { accountScope } from "../src/lib/account-scope";
import { api } from "../src/lib/api";
import { supabase } from "../src/lib/supabase";
import {
  savePrivacy,
  unblockAccount,
  reportTarget,
  sendReport,
  loadPrivacy,
} from "../src/features/safety/data";
jest.mock("../src/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../src/lib/api", () => ({
  api: jest.fn(),
  checked: async (q: any) => {
    const r = await q;
    if (r.error) throw r.error;
    return r.data;
  },
}));
let q: Record<string, jest.Mock>, result: any;
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("owner", true);
  result = { data: [], error: null };
  q = Object.fromEntries(
    ["select", "eq", "in", "abortSignal", "order", "delete"].map((m) => [
      m,
      jest.fn(() => q),
    ]),
  );
  q.then = jest.fn((done) => Promise.resolve(result).then(done));
  q.single = jest.fn(() => Promise.resolve(result));
  jest.mocked(supabase.from).mockReturnValue(q as never);
});
afterEach(() => accountScope.change(null));
test("malformed report targets, including array parameters, never pass validation", () => {
  for (const [type, id] of [
    ["story", "00000000-0000-4000-8000-000000000001"],
    [["profile"], "00000000-0000-4000-8000-000000000001"],
    ["profile", "invalid"],
  ])
    expect(reportTarget(type, id)).toBeNull();
});
test("privacy saving requires confirmed fields and never treats a generic OK as success", async () => {
  jest.mocked(api).mockResolvedValue({ ok: true });
  await expect(savePrivacy("owner", { is_private: true })).rejects.toThrow(
    /could not be confirmed/,
  );
  jest
    .mocked(api)
    .mockResolvedValue({
      ok: true,
      settings: {
        is_private: false,
        message_permission: "none",
        show_saves: false,
      },
    });
  await expect(savePrivacy("owner", { is_private: true })).rejects.toThrow();
  jest
    .mocked(api)
    .mockResolvedValue({
      ok: true,
      settings: {
        is_private: true,
        message_permission: "none",
        show_saves: false,
      },
    });
  expect((await savePrivacy("owner", { is_private: true })).is_private).toBe(
    true,
  );
});
test("unblocking is owner scoped and requires exactly the confirmed block ID", async () => {
  await expect(unblockAccount("owner", "block")).rejects.toThrow(
    /blocked account changed/,
  );
  expect(q.eq).toHaveBeenCalledWith("blocker_id", "owner");
  result.data = [{ id: "other" }];
  await expect(unblockAccount("owner", "block")).rejects.toThrow();
  result.data = [{ id: "block" }];
  await unblockAccount("owner", "block");
});
test("an unconfirmed report response never becomes submitted", async () => {
  jest.mocked(api).mockResolvedValue({});
  await expect(
    sendReport({ type: "profile", id: "target" }, "Spam"),
  ).rejects.toThrow(/not confirmed/);
});
test("privacy reads reject another owner before reading any blocked identities", async () => {
  q.single.mockResolvedValue({
    data: {
      id: "foreign",
      is_private: false,
      message_permission: "everyone",
      show_saves: true,
    },
    error: null,
  });
  await expect(
    loadPrivacy("owner", new AbortController().signal),
  ).rejects.toThrow(/access changed/);
  expect(q.in).not.toHaveBeenCalled();
});
test("late report responses are discarded after account switching", async () => {
  jest.mocked(api).mockImplementation(async () => {
    accountScope.change("other");
    return { ok: true };
  });
  await expect(
    sendReport({ type: "profile", id: "target" }, "Spam"),
  ).rejects.toThrow(/account changed/);
});
