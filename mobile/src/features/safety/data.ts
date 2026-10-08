import { api, checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { accountScope } from "../../lib/account-scope";
import type {
  PrivacySettings,
  BlockedAccount,
} from "../secondary/privacy-view";
export async function loadPrivacy(owner: string, signal: AbortSignal) {
  const ticket = accountScope.capture();
  if (ticket.id !== owner) throw new Error("Sign in to view privacy settings.");
  const [settings, blocks] = await Promise.all([
    checked<PrivacySettings & { id: string }>(
      supabase
        .from("profiles")
        .select("id,is_private,message_permission,show_saves")
        .eq("id", owner)
        .abortSignal(signal)
        .single(),
    ),
    checked<{ id: string; blocker_id: string; blocked_id: string }[]>(
      supabase
        .from("blocks")
        .select("id,blocker_id,blocked_id")
        .eq("blocker_id", owner)
        .order("id")
        .abortSignal(signal),
    ),
  ]);
  accountScope.assert(ticket);
  if (settings.id !== owner || blocks.some((b) => b.blocker_id !== owner))
    throw new Error("Privacy access changed. Refresh to continue.");
  const profiles = blocks.length
    ? await checked<
        {
          id: string;
          display_name: string | null;
          username: string | null;
          avatar_url: string | null;
        }[]
      >(
        supabase
          .from("profiles")
          .select("id,display_name,username,avatar_url")
          .in(
            "id",
            blocks.map((b) => b.blocked_id),
          )
          .abortSignal(signal),
      )
    : [];
  accountScope.assert(ticket);
  return {
    settings,
    blocks: blocks.map((b) => {
      const p = profiles.find((p) => p.id === b.blocked_id);
      return {
        id: b.id,
        name: p?.display_name || p?.username || "Unavailable account",
        username: p?.username || null,
        avatar: p?.avatar_url || null,
      } satisfies BlockedAccount;
    }),
  };
}
export async function savePrivacy(
  owner: string,
  patch: Partial<PrivacySettings>,
) {
  const ticket = accountScope.capture();
  if (ticket.id !== owner)
    throw new Error("Your account changed. Refresh to continue.");
  const result = await api<{ ok: boolean; settings: PrivacySettings }>(
    "/update-privacy-settings",
    patch,
  );
  accountScope.assert(ticket);
  if (
    result.ok !== true ||
    !result.settings ||
    Object.entries(patch).some(
      ([key, value]) => result.settings[key as keyof PrivacySettings] !== value,
    )
  )
    throw new Error(
      "Your privacy setting could not be confirmed. Refresh and retry.",
    );
  return result.settings;
}
export async function unblockAccount(owner: string, id: string) {
  const ticket = accountScope.capture();
  if (ticket.id !== owner)
    throw new Error("Your account changed. Refresh to continue.");
  const rows = await checked<{ id: string }[]>(
    supabase
      .from("blocks")
      .delete()
      .eq("id", id)
      .eq("blocker_id", owner)
      .select("id"),
  );
  accountScope.assert(ticket);
  if (rows.length !== 1 || rows[0].id !== id)
    throw new Error("This blocked account changed. Refresh and try again.");
}
export type ReportTarget = {
  type: "profile" | "design" | "message";
  id: string;
};
export function reportTarget(type: unknown, id: unknown): ReportTarget | null {
  return typeof type === "string" &&
    ["profile", "design", "message"].includes(type) &&
    typeof id === "string" &&
    /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)
    ? { type: type as ReportTarget["type"], id }
    : null;
}
export async function sendReport(target: ReportTarget, reason: string) {
  const ticket = accountScope.capture();
  const result = await api<{ ok: boolean }>("/mobile/report", {
    targetType: target.type,
    targetId: target.id,
    reason,
  });
  accountScope.assert(ticket);
  if (result.ok !== true)
    throw new Error("Your report was not confirmed. Please retry.");
}
