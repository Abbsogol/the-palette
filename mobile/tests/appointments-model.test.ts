import {
  appointmentCategory,
  appointmentTiming,
  depositBadge,
  needsTimeReview,
  appointmentActionLabel,
} from "../src/features/appointments/model";
import type { Booking } from "../src/lib/types";
export const appointment: Booking = {
  id: "one",
  client_id: "client",
  creator_id: "artist",
  service_id: "service",
  booking_date: "2026-10-10",
  start_time: "10:00:00",
  end_time: "11:00:00",
  starts_at: "2026-10-10T06:00:00Z",
  ends_at: "2026-10-10T07:00:00Z",
  time_zone: "Asia/Dubai",
  status: "pending",
  deposit_paid: false,
  reference_design_id: null,
  notes: null,
  deposit_snapshot: 25,
  price_snapshot: 125,
};
const now = Date.parse("2026-10-10T06:30:00Z");
test("pending requests never become confirmed upcoming visits; elapsed pending requests remain visible in history", () => {
  expect(appointmentCategory(appointment, now)).toBe("Requests");
  expect(
    appointmentCategory({ ...appointment, status: "confirmed" }, now),
  ).toBe("Upcoming");
  expect(
    appointmentCategory(appointment, Date.parse(appointment.ends_at!) + 1),
  ).toBe("Past");
  for (const status of ["cancelled", "declined"] as const)
    expect(appointmentCategory({ ...appointment, status }, now)).toBe(
      "Cancelled",
    );
  expect(appointmentActionLabel(appointment, "creator", now)).toBe(
    "Review request",
  );
  expect(appointmentActionLabel(appointment, "customer", now)).toBe(
    "View request",
  );
});
test("actual instants use the creator snapshot, even across a different calendar day", () => {
  const tokyo = {
    ...appointment,
    time_zone: "Asia/Tokyo",
    starts_at: "2026-10-09T23:30:00Z",
    ends_at: "2026-10-10T00:30:00Z",
  };
  expect(appointmentTiming(tokyo)).toEqual({
    date: "Sat, 10 Oct 2026",
    time: "8:30 am – 9:30 am",
    zone: "Asia/Tokyo",
    review: false,
  });
  expect(
    appointmentTiming({ ...tokyo, time_zone: "America/Los_Angeles" }).date,
  ).toBe("Fri, 9 Oct 2026");
});
test("missing legacy instants are visible but never labelled safely manageable", () => {
  const legacy = {
    ...appointment,
    status: "confirmed" as const,
    starts_at: null,
    ends_at: null,
  };
  expect(appointmentCategory(legacy, now)).toBe("Upcoming");
  expect(needsTimeReview(legacy)).toBe(true);
  expect(appointmentActionLabel(legacy, "customer", now)).toBe(
    "View appointment",
  );
  expect(appointmentTiming(legacy)).toMatchObject({
    review: true,
    time: "10:00 AM – 11:00 AM",
  });
  expect(
    needsTimeReview({ ...appointment, ends_at: appointment.starts_at }),
  ).toBe(true);
});
test("malformed legacy dates, times and zones cannot crash the list or masquerade as valid", () => {
  expect(
    appointmentTiming({
      ...appointment,
      starts_at: null,
      time_zone: "invalid",
      booking_date: "2026-99-99",
      start_time: "25:90:00",
    }),
  ).toMatchObject({
    date: "Date unavailable",
    time: "Time unavailable – 11:00 AM",
    zone: "Time zone needs review",
    review: true,
  });
  expect(
    appointmentTiming({
      ...appointment,
      starts_at: null,
      booking_date: "2026-02-30",
    }).date,
  ).toBe("Date unavailable");
});
test("verified refund obligations override a historic paid flag, even on a zero-deposit snapshot", () => {
  const paid = { ...appointment, deposit_paid: true, deposit_snapshot: 0 };
  expect(depositBadge(paid, { status: "refund_pending" })).toEqual({
    label: "Full deposit refund pending",
    attention: true,
  });
  expect(depositBadge(paid, { status: "refunded" })).toEqual({
    label: "Full deposit refund completed",
    attention: false,
  });
  expect(depositBadge(paid, { status: "refund_failed" }).label).toMatch(
    /Refund needs attention/,
  );
  expect(depositBadge(paid, { status: "partial_refund" }).label).toBe(
    "Deposit partially refunded",
  );
});
test("unverified payment status never infers received/refunded from deposit_paid", () => {
  expect(
    depositBadge({ ...appointment, deposit_paid: true }, { unavailable: true }),
  ).toEqual({
    label: "Payment status unavailable · open details",
    attention: true,
  });
  expect(depositBadge(appointment, undefined, true).label).toBe(
    "Checking deposit / refund…",
  );
  expect(depositBadge(appointment, { status: "unrecognized" }).attention).toBe(
    true,
  );
  expect(
    depositBadge({ ...appointment, deposit_snapshot: 0 }, { status: "pending" })
      .label,
  ).toBe("No deposit required");
});
test("missing historical deposit snapshots cannot borrow a zero deposit from a changed service", () => {
  const legacy = {
    ...appointment,
    status: "confirmed" as const,
    deposit_snapshot: undefined,
    services: {
      id: "service",
      creator_id: "artist",
      name: "Changed",
      description: null,
      price: 300,
      deposit_amount: 0,
      duration_minutes: 60,
      is_active: true,
    },
  };
  expect(depositBadge(legacy, { status: "pending" })).toEqual({
    label: "Deposit not yet confirmed",
    attention: true,
  });
});
