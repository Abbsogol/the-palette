import { loadSetupRecords } from "../src/features/creator-setup/data";
import { accountScope } from "../src/lib/account-scope";
import { supabase } from "../src/lib/supabase";
jest.mock("../src/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
function builder(data: unknown, error: unknown = null) {
  const b: Record<string, jest.Mock> = {};
  for (const m of [
    "select",
    "eq",
    "neq",
    "not",
    "limit",
    "abortSignal",
    "maybeSingle",
  ])
    b[m] = jest.fn(() => b);
  b.then = jest.fn((resolve) => resolve({ data, error }));
  return b;
}
beforeEach(() => {
  accountScope.change("creator-a", true);
  jest.mocked(supabase.from).mockReset();
});
test("reads use the current owner, active services, saved time zone and a published portfolio", async () => {
  const rows = {
    services: builder([]),
    availability: builder([]),
    creator_booking_settings: builder({ time_zone: "Asia/Dubai" }),
    designs: builder([{ id: "design" }]),
  };
  jest
    .mocked(supabase.from)
    .mockImplementation((t) => rows[t as keyof typeof rows] as never);
  const signal = new AbortController().signal;
  expect(await loadSetupRecords("creator-a", signal)).toMatchObject({
    timeZone: "Asia/Dubai",
    publishedDesigns: 1,
  });
  for (const t of [
    "services",
    "availability",
    "creator_booking_settings",
  ] as const)
    expect(rows[t].eq).toHaveBeenCalledWith("creator_id", "creator-a");
  expect(rows.designs.eq).toHaveBeenCalledWith("created_by", "creator-a");
  expect(rows.designs.eq).toHaveBeenCalledWith("is_published", true);
  expect(rows.services.eq).toHaveBeenCalledWith("is_active", true);
  for (const b of Object.values(rows))
    expect(b.abortSignal).toHaveBeenCalledWith(signal);
});
test("forbidden owner checks do not issue database reads", async () => {
  await expect(
    loadSetupRecords("stranger", new AbortController().signal),
  ).rejects.toThrow("Sign in");
  expect(supabase.from).not.toHaveBeenCalled();
});
test("one database failure does not turn unknown setup into completion", async () => {
  jest
    .mocked(supabase.from)
    .mockImplementation(
      (t) =>
        builder(
          t === "creator_booking_settings" ? null : [],
          t === "creator_booking_settings"
            ? new Error("Permission denied")
            : null,
        ) as never,
    );
  await expect(
    loadSetupRecords("creator-a", new AbortController().signal),
  ).rejects.toThrow("Permission denied");
});
test("a response from a previous account is discarded", async () => {
  const b = builder([]);
  b.then.mockImplementation((resolve) => {
    accountScope.change("creator-b");
    resolve({ data: [], error: null });
  });
  jest.mocked(supabase.from).mockReturnValue(b as never);
  await expect(
    loadSetupRecords("creator-a", new AbortController().signal),
  ).rejects.toThrow("Your account changed");
});
