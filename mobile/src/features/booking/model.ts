import type { Booking, Service, Slot } from "../../lib/types";
export type BookingContext = {
  creator: { id: string; name: string };
  services: Service[];
  timeZone: string;
  location: string;
};
export type BookingDraft = {
  allowCalendarConflict?: boolean;
  service: Service;
  date: string;
  slot: Slot;
  notes: string;
  designId?: string;
};
export type BookingRequest = {
  allowCalendarConflict?: boolean;
  id: string;
  creatorId: string;
  serviceId: string;
  date: string;
  start: string;
  end: string;
  timeZone: string;
  price: number;
  deposit: number;
  location: string;
  designId?: string;
  notes: string;
};
export const bookingPolicy =
  "Cancel before the appointment for a full deposit refund. Changing the date or time cancels the original booking and creates a new request. Refunds and any new deposit are separate.";
export const paymentLabels: Record<string, string> = {
  fulfilled: "Deposit received",
  refunded: "Full deposit refund completed",
  refund_pending: "Full deposit refund pending",
  refund_failed: "Refund needs attention. Contact support.",
  payment_review: "Payment is being reviewed. Do not pay again.",
  pending: "Deposit not yet confirmed",
  partial_refund: "Deposit partially refunded",
  partially_refunded: "Deposit partially refunded",
  failed: "Payment failed",
  expired: "Checkout expired",
};
export function dateLabel(date: string, long = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Choose a date";
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: long ? "long" : "short",
    ...(long ? { year: "numeric" } : {}),
    timeZone: "UTC",
  }).format(new Date(`${date}T12:00:00Z`));
}
export function timeLabel(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}
export function durationLabel(minutes: number) {
  return minutes % 60 ? `${minutes} min` : `${minutes / 60} hr`;
}
export function requestFromDraft(
  id: string,
  context: BookingContext,
  draft: BookingDraft,
): BookingRequest {
  return {
    id,
    creatorId: context.creator.id,
    serviceId: draft.service.id,
    date: draft.date,
    start: draft.slot.start_time,
    end: draft.slot.end_time,
    timeZone: context.timeZone,
    price: Number(draft.service.price),
    deposit: Number(draft.service.deposit_amount),
    location: context.location,
    designId: draft.designId,
    notes: draft.notes.trim(),
    ...(draft.allowCalendarConflict ? { allowCalendarConflict: true } : {}),
  };
}
export function canPayDeposit(
  b: Booking,
  userId: string,
  status: string | undefined,
  now: number,
) {
  return (
    b.client_id === userId &&
    b.status === "confirmed" &&
    !!b.starts_at &&
    Date.parse(b.starts_at) > now &&
    !b.deposit_paid &&
    Number(b.deposit_snapshot ?? b.services?.deposit_amount) > 0 &&
    ["pending", "failed", "expired"].includes(status || "")
  );
}
export function canManage(b: Booking, userId: string, now: number) {
  return (
    [b.client_id, b.creator_id].includes(userId) &&
    ["pending", "confirmed"].includes(b.status) &&
    !!b.starts_at &&
    Date.parse(b.starts_at) > now
  );
}
export function changeMessage(b: Booking, date: string, slot: Slot) {
  return `Date/time change request for ${b.services?.name || "our appointment"} (#${b.id.slice(0, 8)}): ${dateLabel(date, true)}, ${timeLabel(slot.start_time)}–${timeLabel(slot.end_time)} (${b.time_zone}). Does this time work for you? Your current appointment remains unchanged. If you agree, please use Manage appointment to cancel and rebook; your existing deposit will be fully refunded and any new deposit is separate.`;
}
