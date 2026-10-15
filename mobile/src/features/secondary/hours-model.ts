import type { Day } from "./hours-form";
export const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
export const clockTime = (value: string) => value.slice(0, 5);
export function weekDays(initial: Day[]) {
  return dayNames.map((_, day_of_week) => {
    const saved = initial.find((d) => d.day_of_week === day_of_week);
    return saved
      ? {
          ...saved,
          start_time: clockTime(saved.start_time),
          end_time: clockTime(saved.end_time),
        }
      : {
          day_of_week,
          start_time: "09:00",
          end_time: "18:00",
          is_active: day_of_week > 0 && day_of_week < 6,
        };
  });
}
export function validZone(zone: string) {
  if (zone !== "UTC" && !zone.includes("/")) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format();
    return true;
  } catch {
    return false;
  }
}
export function validRange(day: Day) {
  return (
    /^([01]\d|2[0-3]):[0-5]\d$/.test(day.start_time) &&
    (/^([01]\d|2[0-3]):[0-5]\d$/.test(day.end_time) ||
      day.end_time === "24:00") &&
    day.start_time < day.end_time
  );
}
export function hoursPayload(days: Day[]) {
  // Closed days are not bookable, but the atomic server operation still requires
  // valid time values for each row. Preserve remembered controls in the draft.
  return days.map((d) =>
    !d.is_active && !validRange(d)
      ? { ...d, start_time: "09:00", end_time: "18:00" }
      : d,
  );
}
