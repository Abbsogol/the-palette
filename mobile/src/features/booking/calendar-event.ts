import type { Booking } from "../../lib/types";
const escape = (value: string) =>
  value
    .replace(/\\/g, "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
const stamp = (date: string) =>
  new Date(date)
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
export function appointmentICS(b: Booking) {
  if (b.status !== "confirmed" || !b.starts_at || !b.ends_at)
    throw new Error(
      "Only confirmed appointments can be added to your calendar.",
    );
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LaQue//Appointments//EN",
    "BEGIN:VEVENT",
    `UID:${escape(b.id)}@laque.app`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(b.starts_at)}`,
    `DTEND:${stamp(b.ends_at)}`,
    `SUMMARY:${escape(b.services?.name || "LaQue appointment")}`,
    `LOCATION:${escape(b.location_snapshot || "")}`,
    `DESCRIPTION:${escape(`LaQue appointment. Artist time zone: ${b.time_zone || "not recorded"}. Check LaQue for any changes.`)}`,
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
