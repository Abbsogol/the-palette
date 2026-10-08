import type { Booking } from "../../lib/types";
import { appointmentICS } from "./calendar-event";
export async function exportAppointment(b: Booking) {
  const uri = URL.createObjectURL(
    new Blob([appointmentICS(b)], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = uri;
  link.download = "laque-appointment.ics";
  link.click();
  setTimeout(() => URL.revokeObjectURL(uri), 1000);
}
