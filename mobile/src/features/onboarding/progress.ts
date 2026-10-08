import { readPending, writePending } from "../../lib/pending";
import { accountScope, type AccountTicket } from "../../lib/account-scope";
import type { ProfileProgress, ProfileDraft } from "../secondary/profile-form";
const name = "onboarding-profile-v1";
// Only profile fields belong in a saved draft. Eligibility must be confirmed
// explicitly in the active form and is never inferred from saved progress.
export function parseProgress(value: unknown): ProfileProgress | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { step?: unknown; draft?: unknown };
  if ((v.step !== 0 && v.step !== 1) || !v.draft || typeof v.draft !== "object")
    return null;
  const input = v.draft as Record<string, unknown>;
  if (input.role !== "Customer" && input.role !== "Creator") return null;
  const draft: ProfileDraft = {
    role: input.role,
    display_name: "",
    username: "",
    location: "",
    bio: "",
    booking_area: "",
  };
  for (const [key, max] of [
    ["display_name", 80],
    ["username", 31],
    ["location", 100],
    ["bio", 1000],
    ["booking_area", 300],
  ] as const) {
    if (typeof input[key] !== "string" || input[key].length > max) return null;
    draft[key] = input[key];
  }
  for (const key of ["avatar_url", "banner_url"] as const) {
    if (input[key] === null || typeof input[key] === "string")
      draft[key] = input[key];
  }
  if (input.specialties !== undefined) {
    if (
      !Array.isArray(input.specialties) ||
      input.specialties.length > 20 ||
      input.specialties.some(
        (tag) => typeof tag !== "string" || !tag.trim() || tag.length > 50,
      )
    )
      return null;
    draft.specialties = input.specialties;
  }
  return { draft, step: v.step };
}
export async function loadProgress(ticket = accountScope.capture()) {
  return parseProgress(await readPending(name, ticket));
}
export function saveProgress(progress: ProfileProgress, ticket: AccountTicket) {
  const valid = parseProgress(progress);
  if (!valid) throw new Error("This profile draft could not be saved.");
  return writePending(name, valid, ticket);
}
export function clearProgress(ticket = accountScope.capture()) {
  return writePending(name, null, ticket);
}
