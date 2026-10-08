export type CalendarSource = { id: string; name: string; primary?: boolean };
export type CalendarStatus = {
  configured: boolean;
  status: "disconnected" | "connected" | "reconnect_required";
  accountLabel?: string;
  sources: CalendarSource[];
  calendars: CalendarSource[];
  pending: number;
  syncFailed?: boolean;
  calendarError?: string;
  lastCheckedAt?: string;
};
export const calendarExplanation =
  "Connect Google Calendar to help avoid overlapping schedules. Busy times hide unavailable nail-tech slots and warn clients before booking.";
