import type { Profile, Service } from "../../lib/types";
import type { Day } from "../secondary/hours-form";
export type SetupDestination =
  "profile-edit" | "services" | "availability" | "portfolio";
export type SetupStep = {
  id: SetupDestination;
  title: string;
  done: boolean;
  detail: string;
};
export type CreatorSetup = {
  steps: SetupStep[];
  completed: number;
  ready: boolean;
  next: SetupStep | null;
  timeZone: string | null;
};
export type SetupRecords = {
  services: Service[];
  days: Day[];
  timeZone: string | null;
  publishedDesigns: number;
};
export const isCreator = (role: string | undefined) =>
  ["creator", "salon", "nail_artist"].includes(role || "");
function minutes(time: string) {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (match && +match[1] === 24 && +match[2] === 0 && +(match[3] || 0) === 0)
    return 1440;
  if (!match || +match[1] > 23 || +match[2] > 59 || +(match[3] || 0) > 59)
    return NaN;
  return +match[1] * 60 + +match[2] + +(match[3] || 0) / 60;
}
function validZone(zone: string | null) {
  if (!zone) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format(0);
    return true;
  } catch {
    return false;
  }
}
export function creatorSetup(
  profile: Pick<
    Profile,
    | "display_name"
    | "username"
    | "location"
    | "booking_area"
    | "onboarding_complete"
    | "account_type"
  >,
  records: SetupRecords,
): CreatorSetup {
  const active = records.services.filter(
    (s) =>
      s.is_active &&
      !!s.name.trim() &&
      Number.isFinite(s.price) &&
      s.price >= 0 &&
      Number.isFinite(s.deposit_amount) &&
      s.deposit_amount >= 0 &&
      s.deposit_amount <= s.price &&
      Number.isInteger(s.duration_minutes) &&
      s.duration_minutes >= 15 &&
      s.duration_minutes <= 480,
  );
  const open = records.days.filter((d) => d.is_active);
  const validHours =
    open.length > 0 &&
    open.every(
      (d) =>
        Number.isInteger(d.day_of_week) &&
        d.day_of_week >= 0 &&
        d.day_of_week <= 6 &&
        minutes(d.end_time) > minutes(d.start_time),
    ) &&
    new Set(open.map((d) => d.day_of_week)).size === open.length;
  const fits =
    validHours &&
    open.some((d) =>
      active.some(
        (s) =>
          minutes(d.end_time) - minutes(d.start_time) >= s.duration_minutes,
      ),
    );
  const zone = validZone(records.timeZone);
  const profileDone =
    profile.onboarding_complete &&
    !!profile.display_name?.trim() &&
    /^[a-z0-9_.]{3,30}$/.test(profile.username || "") &&
    !!profile.location?.trim() &&
    !!profile.booking_area?.trim();
  const steps: SetupStep[] = [
    {
      id: "profile-edit",
      title: "Profile & service location",
      done: profileDone,
      detail: profileDone
        ? "Your name, @ID and service location are set."
        : "Add your name, unique @ID, city and studio or service area. Photos and bio are optional.",
    },
    {
      id: "services",
      title: "Services & deposits",
      done: active.length > 0,
      detail: active.length
        ? `${active.length} active ${active.length === 1 ? "service" : "services"} with price, deposit and duration.`
        : "Add an active service with a fixed price, duration and deposit.",
    },
    {
      id: "availability",
      title: "Hours & time zone",
      done: zone && fits,
      detail: !zone
        ? "Choose your local time zone and save working hours."
        : !validHours
          ? "Save at least one open day with valid working hours."
          : !fits
            ? "Make an open window long enough for an active service."
            : `Working hours saved in ${records.timeZone}.`,
    },
    {
      id: "portfolio",
      title: "Publish your portfolio",
      done: records.publishedDesigns > 0,
      detail:
        records.publishedDesigns > 0
          ? "Your published designs are ready to discover."
          : "Publish at least one design with a cover photo. Private drafts don't count.",
    },
  ];
  const completed = steps.filter((s) => s.done).length;
  const ready = isCreator(profile.account_type) && completed === steps.length;
  return {
    steps,
    completed,
    ready,
    next: steps.find((s) => !s.done) || null,
    timeZone: zone ? records.timeZone : null,
  };
}
