import type { Booking } from "../../lib/types";
import { dateLabel, timeLabel, paymentLabels } from "../booking/model";
export type AppointmentRole = "customer" | "creator";
export type AppointmentFilter = "Requests" | "Upcoming" | "Past" | "Cancelled";
export const appointmentFilters: AppointmentFilter[] = [
  "Requests",
  "Upcoming",
  "Past",
  "Cancelled",
];
export type AppointmentPerson = {
  id: string;
  name: string;
  username: string | null;
  avatar: string | null;
};
export type AppointmentItem = Booking & {
  person?: AppointmentPerson;
  identityUnavailable?: boolean;
};
export type DepositState = { status?: string; unavailable?: boolean };
export function needsTimeReview(b: Booking) {
  return (
    !b.starts_at ||
    !b.ends_at ||
    !Number.isFinite(Date.parse(b.starts_at)) ||
    !Number.isFinite(Date.parse(b.ends_at)) ||
    Date.parse(b.ends_at) <= Date.parse(b.starts_at)
  );
}
export function appointmentCategory(
  b: Booking,
  now: number,
): AppointmentFilter {
  if (b.status === "cancelled" || b.status === "declined") return "Cancelled";
  if (
    b.ends_at &&
    Number.isFinite(Date.parse(b.ends_at)) &&
    Date.parse(b.ends_at) < now
  )
    return "Past";
  return b.status === "pending" ? "Requests" : "Upcoming";
}
export function appointmentTiming(b: Booking) {
  let validZone = false;
  try {
    if (b.time_zone) {
      new Intl.DateTimeFormat("en", { timeZone: b.time_zone }).format();
      validZone = true;
    }
  } catch {}
  if (validZone && b.starts_at && Number.isFinite(Date.parse(b.starts_at))) {
    const date = new Intl.DateTimeFormat("en-GB", {
      timeZone: b.time_zone!,
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(b.starts_at));
    const format = new Intl.DateTimeFormat("en-GB", {
      timeZone: b.time_zone!,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    const start = format.format(new Date(b.starts_at));
    const end =
      b.ends_at && Number.isFinite(Date.parse(b.ends_at))
        ? format.format(new Date(b.ends_at))
        : null;
    return {
      date,
      time: start + (end ? " – " + end : ""),
      zone: b.time_zone!,
      review: needsTimeReview(b),
    };
  }
  const safeTime = (t: string) =>
    /^(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(t || "")
      ? timeLabel(t.slice(0, 5))
      : "Time unavailable";
  let date = "Date unavailable";
  if (/^\d{4}-\d{2}-\d{2}$/.test(b.booking_date || "")) {
    const parsed = new Date(`${b.booking_date}T12:00:00Z`);
    if (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === b.booking_date
    )
      date = dateLabel(b.booking_date, true);
  }
  return {
    date,
    time: safeTime(b.start_time) + " – " + safeTime(b.end_time),
    zone: validZone ? b.time_zone! : "Time zone needs review",
    review: true,
  };
}
export function depositBadge(
  b: Booking,
  state: DepositState | undefined,
  loading = false,
): { label: string; attention: boolean } {
  if (loading) return { label: "Checking deposit / refund…", attention: false };
  if (!state || state.unavailable || !state.status)
    return {
      label: "Payment status unavailable · open details",
      attention: true,
    };
  const amount = b.deposit_snapshot == null ? NaN : Number(b.deposit_snapshot);
  if (state.status === "pending")
    return {
      label:
        Number.isFinite(amount) && amount === 0
          ? "No deposit required"
          : b.status === "pending"
            ? "Deposit after approval"
            : b.status === "confirmed"
              ? "Deposit not yet confirmed"
              : "No deposit payment confirmed",
      attention:
        b.status === "confirmed" && (!Number.isFinite(amount) || amount > 0),
    };
  const known = paymentLabels[state.status];
  return {
    label: known || "Payment status needs review",
    attention:
      [
        "refund_pending",
        "refund_failed",
        "payment_review",
        "partial_refund",
        "partially_refunded",
      ].includes(state.status) || !known,
  };
}
export function appointmentActionLabel(
  b: Booking,
  role: AppointmentRole,
  now: number,
) {
  const category = appointmentCategory(b, now);
  if (category === "Requests")
    return role === "creator" ? "Review request" : "View request";
  return category === "Upcoming" && !needsTimeReview(b)
    ? "Manage appointment"
    : "View appointment";
}
