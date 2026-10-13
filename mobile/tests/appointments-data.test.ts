import {
  appointmentQuery,
  loadAppointments,
  loadAppointmentDeposits,
} from "../src/features/appointments/data";
import { accountScope } from "../src/lib/account-scope";
import { supabase } from "../src/lib/supabase";
import { api, checked } from "../src/lib/api";
jest.mock("../src/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../src/lib/api", () => ({ api: jest.fn(), checked: jest.fn() }));
let chain: any;
const signal = () => new AbortController().signal;
const row = {
  id: "one",
  client_id: "owner",
  creator_id: "artist",
  status: "pending",
};
beforeEach(() => {
  accountScope.change("owner", true);
  chain = {};
  for (const method of [
    "select",
    "eq",
    "in",
    "or",
    "lt",
    "order",
    "range",
    "abortSignal",
  ])
    chain[method] = jest.fn(() => chain);
  jest.mocked(supabase.from).mockReturnValue(chain);
});
afterEach(() => accountScope.change(null));
test.each([
  ["customer", "client_id"],
  ["creator", "creator_id"],
] as const)(
  "role %s reads only its owned side, ordered deterministically with a sentinel and cancellation signal",
  async (role, column) => {
    const abort = signal();
    appointmentQuery("owner", role, "Requests", 20, 0, abort);
    expect(chain.eq.mock.calls).toEqual([
      [column, "owner"],
      ["status", "pending"],
    ]);
    expect(chain.or).toHaveBeenCalledWith(
      "ends_at.gte.1970-01-01T00:00:00.000Z,ends_at.is.null",
    );
    expect(chain.order.mock.calls).toEqual([
      ["starts_at", { ascending: true, nullsFirst: false }],
      ["booking_date", { ascending: true }],
      ["start_time", { ascending: true }],
      ["id"],
    ]);
    expect(chain.range).toHaveBeenCalledWith(0, 20);
    expect(chain.abortSignal).toHaveBeenCalledWith(abort);
  },
);
test.each(["Upcoming", "Past", "Cancelled"] as const)(
  "%s uses distinct status/time filters",
  (filter) => {
    appointmentQuery("owner", "customer", filter, 20, 0, signal());
    if (filter === "Upcoming")
      expect(chain.eq).toHaveBeenCalledWith("status", "confirmed");
    if (filter === "Past") {
      expect(chain.in).toHaveBeenCalledWith("status", ["pending", "confirmed"]);
      expect(chain.lt).toHaveBeenCalledWith(
        "ends_at",
        "1970-01-01T00:00:00.000Z",
      );
    }
    if (filter === "Cancelled") {
      expect(chain.in).toHaveBeenCalledWith("status", [
        "cancelled",
        "declined",
      ]);
      expect(chain.or).not.toHaveBeenCalled();
      expect(chain.lt).not.toHaveBeenCalled();
    }
  },
);
test("sentinel is excluded from cards and profile lookups; participant identity uses the opposite booking side", async () => {
  jest
    .mocked(checked)
    .mockResolvedValueOnce([
      row,
      { ...row, id: "sentinel", creator_id: "unloaded" },
    ])
    .mockResolvedValueOnce([
      {
        id: "artist",
        display_name: "Anelia",
        username: "anelia",
        avatar_url: "photo",
      },
    ]);
  const result = await loadAppointments(
    "owner",
    "customer",
    "Requests",
    1,
    0,
    signal(),
  );
  expect(result).toEqual({
    items: [
      expect.objectContaining({
        person: {
          id: "artist",
          name: "Anelia",
          username: "anelia",
          avatar: "photo",
        },
        identityUnavailable: false,
      }),
    ],
    hasMore: true,
  });
  expect(chain.in).toHaveBeenCalledWith("id", ["artist"]);
});
test("profile read failure keeps existing booking metadata and explicit unavailable identity", async () => {
  jest
    .mocked(checked)
    .mockResolvedValueOnce([row])
    .mockRejectedValueOnce(new Error("Unavailable"));
  expect(
    (await loadAppointments("owner", "customer", "Requests", 20, 0, signal()))
      .items[0],
  ).toMatchObject({ id: "one", identityUnavailable: true });
});
test("forged owner rows cannot leak through an incorrectly implemented backend adapter", async () => {
  jest
    .mocked(checked)
    .mockResolvedValueOnce([{ ...row, client_id: "stranger" }]);
  await expect(
    loadAppointments("owner", "customer", "Requests", 20, 0, signal()),
  ).rejects.toThrow("Appointment access changed");
  expect(checked).toHaveBeenCalledTimes(1);
});
test("late profile success is discarded after an account change, including the same account signing in again", async () => {
  jest
    .mocked(checked)
    .mockResolvedValueOnce([row])
    .mockImplementationOnce(async () => {
      accountScope.change("owner", true);
      return [{ id: "artist", display_name: "Old private identity" }];
    });
  await expect(
    loadAppointments("owner", "customer", "Requests", 20, 0, signal()),
  ).rejects.toThrow("Your account changed");
});
test("one failed deposit verification is isolated; financial reads use the existing server endpoint", async () => {
  jest
    .mocked(api)
    .mockResolvedValueOnce({ status: "refund_pending" })
    .mockRejectedValueOnce(new Error("Offline"));
  expect(await loadAppointmentDeposits(["one", "two"], signal())).toEqual({
    one: { status: "refund_pending" },
    two: { unavailable: true },
  });
  expect(api).toHaveBeenCalledWith("/mobile/deposit-status?booking=one");
});
test("deposit verification uses at most four simultaneous requests", async () => {
  let active = 0,
    peak = 0;
  jest.mocked(api).mockImplementation(async () => {
    active++;
    peak = Math.max(peak, active);
    await new Promise((r) => setTimeout(r, 1));
    active--;
    return { status: "pending" };
  });
  expect(
    Object.keys(
      await loadAppointmentDeposits(
        Array.from({ length: 9 }, (_, i) => String(i)),
        signal(),
      ),
    ),
  ).toHaveLength(9);
  expect(peak).toBe(4);
});
test("account changes during financial reads discard all results and stop remaining work", async () => {
  jest.mocked(api).mockImplementation(async () => {
    accountScope.change("other");
    return { status: "fulfilled" };
  });
  await expect(
    loadAppointmentDeposits(["one", "two", "three", "four", "five"], signal()),
  ).rejects.toThrow("Your account changed");
  expect(jest.mocked(api).mock.calls.length).toBeLessThanOrEqual(4);
});
test("aborted payment reads do not start another request", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(
    loadAppointmentDeposits(["one"], controller.signal),
  ).rejects.toThrow("Payment read cancelled");
  expect(api).not.toHaveBeenCalled();
});
test("an adapter called with a stale owner cannot issue a read for that account", async () => {
  await expect(
    loadAppointments("old-owner", "customer", "Requests", 20, 0, signal()),
  ).rejects.toThrow("Your account changed");
  expect(supabase.from).not.toHaveBeenCalled();
});
test("malformed successful payment responses cannot crash cards or conceal the retry state", async () => {
  jest
    .mocked(api)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce({ status: 42 });
  expect(await loadAppointmentDeposits(["one", "two"], signal())).toEqual({
    one: { unavailable: true },
    two: { unavailable: true },
  });
});
