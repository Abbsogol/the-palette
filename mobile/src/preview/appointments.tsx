// Synthetic list states only. Real booking decisions and payment verification live in connected routes.
import { useMemo, useState } from "react";
import { AppointmentList } from "../features/secondary/history-view";
import {
  appointmentCategory,
  type AppointmentRole,
  type AppointmentFilter,
  type AppointmentItem,
} from "../features/appointments/model";
import { calendarDay } from "../lib/calendar";
import type { Booking } from "../lib/types";
import { demoAppointment } from "./booking";
export type PreviewAppointment = {
  booking: Booking;
  role: AppointmentRole;
  paymentStatus: string;
  artist: string;
  client: string;
};
export function sampleAppointments(now: number, role: AppointmentRole) {
  const base = demoAppointment();
  const sample = (
    id: string,
    status: Booking["status"],
    days: number,
    name: string,
    username: string,
    paymentStatus: string,
  ) => {
    const day = calendarDay(now + days * 86400000, "Asia/Dubai");
    const item: AppointmentItem = {
      ...base,
      id,
      status,
      booking_date: day,
      starts_at: day + "T15:00:00+04:00",
      ends_at: day + "T16:00:00+04:00",
      deposit_paid: [
        "fulfilled",
        "refund_pending",
        "refund_failed",
        "refunded",
      ].includes(paymentStatus),
      person: {
        id: role === "customer" ? base.creator_id : base.client_id,
        name,
        username:
          role === "customer"
            ? {
                "Anelia Cafe": "anelia.cafe",
                "Sarah M.": "sarah.nails",
                "Elena R.": "elena.nails",
              }[name] || username
            : username,
        avatar: null,
      },
    };
    return {
      item,
      paymentStatus,
      artist: role === "customer" ? name : "Kim",
      client: role === "creator" ? name : "Sarah",
    };
  };
  return [
    sample(
      "sample-request",
      "pending",
      2,
      role === "customer" ? "Anelia Cafe" : "Keyvan",
      "keyvan.nails",
      "pending",
    ),
    sample(
      "sample-upcoming",
      "confirmed",
      3,
      role === "customer" ? "Sarah M." : "Elena R.",
      "elena.nails",
      "fulfilled",
    ),
    sample(
      "sample-past",
      "confirmed",
      -5,
      role === "customer" ? "Anelia Cafe" : "Keyvan",
      "keyvan.nails",
      "fulfilled",
    ),
    sample(
      "sample-unconfirmed",
      "pending",
      -3,
      role === "customer" ? "Elena R." : "Sarah M.",
      "sarah.designs",
      "pending",
    ),
    sample(
      "sample-cancelled",
      "cancelled",
      1,
      role === "customer" ? "Anelia Cafe" : "Keyvan",
      "keyvan.nails",
      "refund_pending",
    ),
    sample(
      "sample-refunded",
      "cancelled",
      -2,
      role === "customer" ? "Elena R." : "Sarah M.",
      "sarah.designs",
      "refunded",
    ),
    sample(
      "sample-refund-failed",
      "cancelled",
      -4,
      role === "customer" ? "Sarah M." : "Elena R.",
      "elena.nails",
      "refund_failed",
    ),
    sample(
      "sample-declined",
      "declined",
      -7,
      role === "customer" ? "Elena R." : "Sarah M.",
      "sarah.designs",
      "pending",
    ),
  ];
}
export function AppointmentPreviewList({
  onOpen,
}: {
  onOpen: (selection: PreviewAppointment) => void;
}) {
  const [role, setRole] = useState<AppointmentRole>("customer"),
    [filter, setFilter] = useState<AppointmentFilter>("Requests"),
    [now, setNow] = useState(() => Date.now());
  const samples = useMemo(() => sampleAppointments(now, role), [now, role]),
    visible = samples
      .filter((s) => appointmentCategory(s.item, now) === filter)
      .sort(
        (a, b) =>
          (filter === "Requests" || filter === "Upcoming" ? 1 : -1) *
            (Date.parse(a.item.starts_at!) - Date.parse(b.item.starts_at!)) ||
          a.item.id.localeCompare(b.item.id),
      );
  return (
    <>
      <AppointmentList
        items={visible.map((s) => s.item)}
        role={role}
        canCreate
        onRole={setRole}
        filter={filter}
        onFilter={setFilter}
        now={now}
        onRetry={() => setNow(Date.now())}
        onMore={() => {}}
        onRetryPayments={() => {}}
        payments={Object.fromEntries(
          visible.map((s) => [s.item.id, { status: s.paymentStatus }]),
        )}
        onOpen={(id) => {
          const s = samples.find((s) => s.item.id === id)!;
          onOpen({
            booking: s.item,
            role,
            paymentStatus: s.paymentStatus,
            artist: s.artist,
            client: s.client,
          });
        }}
      />
    </>
  );
}
