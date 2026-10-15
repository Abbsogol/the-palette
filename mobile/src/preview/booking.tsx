import { CalendarPreview, usePreviewCalendar } from "./calendar";
// Interactive sample bookings only. Never reads or writes a hosted service.
import { useCallback, useMemo, useState } from "react";
import { Modal } from "react-native";
import { BookingFormView } from "../features/booking/booking-form";
import {
  AppointmentView,
  type AppointmentAction,
} from "../features/booking/appointment-view";
import { BookingButton } from "../features/booking/primitives";
import {
  changeMessage,
  type BookingContext,
  type BookingDraft,
} from "../features/booking/model";
import { exportAppointment } from "../features/booking/calendar-export";
import { calendarDay, monthCells } from "../lib/calendar";
import type { Booking, Service, Slot } from "../lib/types";
export const demoServices: Service[] = [
  ["Nail polish", 60, 125, 25],
  ["Gel manicure", 90, 180, 40],
  ["Acrylic full set", 120, 250, 50],
  ["Chrome finish", 45, 90, 20],
  ["Nail art", 15, 35, 0],
].map(([name, duration, price, deposit], i) => ({
  id: `sample-service-${i}`,
  creator_id: "sample-artist",
  name: String(name),
  description: null,
  duration_minutes: Number(duration),
  price: Number(price),
  deposit_amount: Number(deposit),
  is_active: true,
}));
export async function demoSlots(
  serviceId: string,
  date: string,
): Promise<Slot[]> {
  const service =
    demoServices.find((s) => s.id === serviceId) || demoServices[0];
  return Array.from({ length: 17 }, (_, i) => {
    const start = 600 + i * 30,
      end = start + service.duration_minutes;
    const hm = (m: number) =>
      `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00`;
    const starts_at = `${date}T${hm(start)}+04:00`;
    return {
      start_time: hm(start),
      end_time: hm(end),
      starts_at,
      ends_at: `${date}T${hm(end)}+04:00`,
      available:
        Date.parse(starts_at) > Date.now() && i !== 3 && i !== 6 && end <= 1140,
    };
  });
}
export async function demoMonth(service: string, month: string) {
  const days: Record<string, boolean> = {};
  await Promise.all(
    monthCells(month)
      .filter((d): d is string => !!d)
      .map(async (d) => {
        days[d] =
          new Date(`${d}T12:00:00Z`).getUTCDay() !== 0 &&
          (await demoSlots(service, d)).some((s) => s.available);
      }),
  );
  return days;
}
export function demoAppointment(): Booking {
  const day = calendarDay(Date.now() + 3 * 86400000, "Asia/Dubai");
  return {
    id: "sample-appointment",
    client_id: "sample-client",
    creator_id: "sample-artist",
    service_id: demoServices[0].id,
    services: demoServices[0],
    booking_date: day,
    start_time: "15:00:00",
    end_time: "16:00:00",
    starts_at: `${day}T15:00:00+04:00`,
    ends_at: `${day}T16:00:00+04:00`,
    time_zone: "Asia/Dubai",
    status: "confirmed",
    deposit_paid: false,
    reference_design_id: null,
    notes: null,
    price_snapshot: 125,
    deposit_snapshot: 25,
    location_snapshot: "LaQue Nail Studio, Dubai",
  };
}
export function BookingPreview({
  width,
  artist = "Kim",
  client = "Sarah",
  initialAppointment,
  initialRole = "client",
  initialPaymentStatus,
  onClose,
  onChat,
}: {
  width: number;
  artist?: string;
  client?: string;
  initialAppointment?: Booking;
  initialRole?: "client" | "creator";
  initialPaymentStatus?: string;
  onClose: () => void;
  onChat?: (draft?: string, booking?: Booking) => void;
}) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const connected = usePreviewCalendar()?.state.status === "connected";
  const calendarSlots = useCallback(
    async (service: string, day: string) =>
      (await demoSlots(service, day)).map((slot, i) => ({
        ...slot,
        client_calendar_state: connected
          ? ("checked" as const)
          : ("disconnected" as const),
        client_calendar_conflict: connected && [2, 12].includes(i),
      })),
    [connected],
  );
  const [booking, setBooking] = useState(initialAppointment),
    [payment, setPayment] = useState(
      initialPaymentStatus ||
        (initialAppointment?.deposit_paid ? "fulfilled" : "pending"),
    ),
    [role, setRole] = useState<"client" | "creator">(initialRole),
    [proposing, setProposing] = useState(false),
    [rescheduled, setRescheduled] = useState(false),
    [error, setError] = useState("");
  const context: BookingContext = useMemo(
    () => ({
      creator: { id: "sample-artist", name: artist },
      services: demoServices,
      timeZone: "Asia/Dubai",
      location: "LaQue Nail Studio, Dubai",
    }),
    [artist],
  );
  const references = useCallback(
    async () => [
      { id: "sample-chrome", title: "Chrome Marble Dream" },
      { id: "sample-cathedral", title: "Cathedral" },
    ],
    [],
  );
  const submit = (d: BookingDraft) => {
    if (proposing && booking) {
      onChat?.(changeMessage(booking, d.date, d.slot), booking);
      onClose();
      return;
    }
    setBooking({
      ...demoAppointment(),
      status: "pending",
      service_id: d.service.id,
      services: d.service,
      booking_date: d.date,
      start_time: d.slot.start_time,
      end_time: d.slot.end_time,
      starts_at: d.slot.starts_at,
      ends_at: d.slot.ends_at,
      price_snapshot: d.service.price,
      deposit_snapshot: d.service.deposit_amount,
      notes: d.notes,
      reference_design_id: d.designId || null,
    });
    setPayment("pending");
  };
  const action = (kind: AppointmentAction) => {
    if (!booking) return;
    if (kind === "confirm") {
      setBooking({ ...booking, status: "confirmed" });
      setRole("client");
    }
    if (kind === "decline") setBooking({ ...booking, status: "declined" });
    if (kind === "cancel") {
      setBooking({ ...booking, status: "cancelled" });
      if (booking.deposit_paid) setPayment("refund_pending");
    }
    if (kind === "reschedule") {
      setBooking(undefined);
      setRescheduled(true);
    }
    if (kind === "propose") setProposing(true);
    if (kind === "pay") {
      setPayment("fulfilled");
      setBooking({ ...booking, deposit_paid: true });
    }
    if (kind === "chat") {
      onChat?.(undefined, booking);
      onClose();
    }
    if (kind === "connect-calendar") setCalendarOpen(true);
    if (kind === "calendar")
      void exportAppointment(booking).catch((e) => setError(e.message));
    if (kind === "design")
      setError(
        "Sample reference: Chrome Marble Dream. Your real reference opens its original design in the connected app.",
      );
  };
  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      {!booking || proposing ? (
        <BookingFormView
          key={proposing ? "propose" : rescheduled ? "rebook" : "new"}
          width={width}
          context={context}
          loadSlots={calendarSlots}
          onCalendarConnect={() => setCalendarOpen(true)}
          loadMonth={demoMonth}
          loadReferences={references}
          onSubmit={submit}
          onBack={() => (proposing ? setProposing(false) : onClose())}
          rescheduled={rescheduled}
          proposing={proposing}
          initialStep={proposing ? 1 : 0}
          initialServiceId={proposing ? booking?.service_id : undefined}
        />
      ) : (
        <AppointmentView
          simulated
          key={`${booking.id}:${role}`}
          width={width}
          booking={booking}
          artist={artist}
          client={client}
          userId={role === "client" ? booking.client_id : booking.creator_id}
          paymentStatus={payment}
          error={error}
          onBack={onClose}
          onAction={action}
          previewControls={
            <BookingButton
              title={
                role === "client" ? "Preview as nail tech" : "Preview as client"
              }
              plain
              onPress={() => setRole(role === "client" ? "creator" : "client")}
            />
          }
        />
      )}
      {calendarOpen && (
        <CalendarPreview width={width} onBack={() => setCalendarOpen(false)} />
      )}
    </Modal>
  );
}
