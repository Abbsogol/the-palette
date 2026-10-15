import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { database, ok, jsonRequest } from "../helpers/supabase";
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  client: {},
  service: {},
  check: vi.fn(),
  sync: vi.fn(),
  after: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getSessionUser: mocks.user,
  serviceClient: mocks.service,
}));
vi.mock("@/lib/mobile-auth", async (importOriginal) => ({
  ...(await importOriginal()),
  mobileUserClient: () => mocks.client,
}));
vi.mock("@/lib/calendar/google", async (importOriginal) => ({
  ...(await importOriginal()),
  checkBooking: mocks.check,
  syncJobs: mocks.sync,
}));
vi.mock("next/server", () => ({ after: mocks.after }));
import { POST as requestBooking } from "@/app/api/mobile/request-booking/route";
import { POST as bookingAction } from "@/app/api/mobile/booking-action/route";
import { POST as calendarAction } from "@/app/api/mobile/calendar/route";
import { CalendarError } from "@/lib/calendar/google";
const id = "00000000-0000-4000-8000-000000000111",
  creator = "00000000-0000-4000-8000-000000000112",
  service = "00000000-0000-4000-8000-000000000113";
const body = {
  id,
  creatorId: creator,
  serviceId: service,
  date: "2026-10-01",
  start: "10:00",
  end: "11:00",
  timeZone: "Asia/Dubai",
  price: 100,
  deposit: 20,
  location: "Studio",
  starts_at: "tampered",
  client_id: "stranger",
};
const slot = {
  available: true,
  start_time: "10:00:00",
  end_time: "11:00:00",
  starts_at: "2026-10-01T06:00:00Z",
  ends_at: "2026-10-01T07:00:00Z",
};
const booking = {
  id,
  client_id: "client",
  creator_id: creator,
  service_id: service,
  booking_date: body.date,
  start_time: "10:00:00",
  time_zone: body.timeZone,
  status: "pending",
};
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CALENDAR_ENABLED", "true");
  mocks.user.mockResolvedValue({ id: "client" });
  mocks.check.mockResolvedValue(undefined);
  mocks.sync.mockResolvedValue({ synced: 0, failed: 0 });
});
afterEach(() => vi.unstubAllEnvs());
const setup = (existing) =>
  Object.assign(
    mocks.client,
    database(
      (q) =>
        q.operation === "insert"
          ? ok({ ...booking, ...q.values })
          : ok(existing || null),
      async (name) =>
        name === "booking_available_slots" ? ok([slot]) : ok(booking),
    ),
  );
it("uses authenticated ownership and database UTC instants instead of body fields before insertion", async () => {
  setup();
  const response = await requestBooking(jsonRequest(body));
  expect(response.status).toBe(200);
  expect(mocks.check).toHaveBeenCalledWith(
    mocks.service,
    expect.objectContaining({
      client_id: "client",
      starts_at: slot.starts_at,
      ends_at: slot.ends_at,
    }),
    "request",
    false,
  );
  expect(mocks.client.calls.at(-1).operation).toBe("insert");
});
it.each([
  "CLIENT_CALENDAR_CONFLICT",
  "CREATOR_CALENDAR_CONFLICT",
  "CLIENT_CALENDAR_UNCHECKED",
])("calendar failure %s never inserts a booking", async (code) => {
  setup();
  mocks.check.mockRejectedValue(new CalendarError("Conflict", code, 409));
  const response = await requestBooking(jsonRequest(body));
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code });
  expect(mocks.client.calls.some((q) => q.operation === "insert")).toBe(false);
});
it("only an explicit boolean allows a client conflict override", async () => {
  setup();
  await requestBooking(jsonRequest({ ...body, allowCalendarConflict: "true" }));
  expect(mocks.check.mock.calls[0][3]).toBe(false);
  await requestBooking(jsonRequest({ ...body, allowCalendarConflict: true }));
  expect(mocks.check.mock.calls[1][3]).toBe(true);
});
it("lost-response retry returns the original request without rechecking its now-occupied slot", async () => {
  setup(booking);
  expect((await requestBooking(jsonRequest(body))).status).toBe(200);
  expect(mocks.client.rpc).not.toHaveBeenCalled();
  expect(mocks.check).not.toHaveBeenCalled();
  expect(mocks.client.calls[0].filters).toContainEqual([
    "eq",
    "client_id",
    "client",
  ]);
  expect(
    (await requestBooking(jsonRequest({ ...body, start: "11:00" }))).status,
  ).toBe(409);
});
it("creator confirmation checks the latest calendar before status changes", async () => {
  mocks.user.mockResolvedValue({ id: creator });
  Object.assign(
    mocks.client,
    database((q) =>
      ok(
        q.operation === "update"
          ? { ...booking, status: "confirmed" }
          : booking,
      ),
    ),
  );
  expect(
    (await bookingAction(jsonRequest({ bookingId: id, action: "confirm" })))
      .status,
  ).toBe(200);
  expect(mocks.check).toHaveBeenCalledWith(mocks.service, booking, "confirm");
  expect(mocks.after).toHaveBeenCalledTimes(1);
  expect(mocks.client.calls[0].filters).toContainEqual([
    "eq",
    "creator_id",
    creator,
  ]);
});
it("confirmation cannot bypass an unavailable Google calendar", async () => {
  mocks.user.mockResolvedValue({ id: creator });
  Object.assign(
    mocks.client,
    database(() => ok(booking)),
  );
  mocks.check.mockRejectedValue(new CalendarError("Try again"));
  expect(
    (await bookingAction(jsonRequest({ bookingId: id, action: "confirm" })))
      .status,
  ).toBe(503);
  expect(mocks.client.calls.some((q) => q.operation === "update")).toBe(false);
});
it("cancellation remains available even when Google cannot be checked", async () => {
  setup();
  expect(
    (await bookingAction(jsonRequest({ bookingId: id, action: "cancel" })))
      .status,
  ).toBe(200);
  expect(mocks.check).not.toHaveBeenCalled();
  expect(mocks.client.rpc).toHaveBeenCalledWith("cancel_mobile_booking", {
    p_booking_id: id,
  });
  expect(mocks.after).toHaveBeenCalledTimes(1);
});
it("disconnect ignores a body user ID and acts only for the authenticated account", async () => {
  Object.assign(
    mocks.service,
    database(
      () => ok(null),
      async () => ok(null),
    ),
  );
  // Configuration is intentionally absent: response reports unavailable setup, but disconnect succeeds.
  const r = await calendarAction(
    jsonRequest({ action: "disconnect", userId: "stranger" }),
  );
  expect(r.status).toBe(200);
  expect(mocks.service.rpc).toHaveBeenCalledWith("disconnect_google_calendar", {
    p_user_id: "client",
  });
});
