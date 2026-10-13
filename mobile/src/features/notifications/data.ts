import { supabase } from "../../lib/supabase";
import { checked } from "../../lib/api";
import { accountScope } from "../../lib/account-scope";
import { activityDetails, type Activity } from "./model";
export async function loadActivity(
  owner: string,
  limit: number,
  signal: AbortSignal,
) {
  const ticket = accountScope.capture();
  if (ticket.id !== owner) throw new Error("Sign in to view activity.");
  const rows = await checked<Activity[]>(
    supabase
      .from("notifications")
      .select(
        "id,user_id,actor_id,type,read,design_id,comment_preview,created_at",
      )
      .eq("user_id", owner)
      .order("created_at", { ascending: false })
      .order("id")
      .range(0, limit)
      .abortSignal(signal),
  );
  accountScope.assert(ticket);
  if (rows.some((n) => n.user_id !== owner))
    throw new Error("Activity access changed. Refresh to continue.");
  const page = rows.slice(0, limit);
  const actors = [...new Set(page.map((n) => n.actor_id).filter(Boolean))];
  const profiles = actors.length
    ? await checked<NonNullable<Activity["actor"]>[]>(
        supabase
          .from("profiles")
          .select("id,display_name,username,avatar_url")
          .in("id", actors)
          .abortSignal(signal),
      )
    : [];
  accountScope.assert(ticket);
  return {
    items: page.map((n) => ({
      ...n,
      actor: profiles.find((p) => p.id === n.actor_id) || null,
    })),
    hasMore: rows.length > limit,
  };
}
export async function markActivity(
  owner: string,
  ids: string[],
  read: boolean,
) {
  const ticket = accountScope.capture();
  if (ticket.id !== owner)
    throw new Error("Your account changed. Refresh to continue.");
  if (!ids.length) return;
  const rows = await checked<{ id: string; read: boolean }[]>(
    supabase
      .from("notifications")
      .update({ read })
      .eq("user_id", owner)
      .in("id", ids)
      .select("id,read"),
  );
  accountScope.assert(ticket);
  if (
    rows.length !== new Set(ids).size ||
    rows.some((row) => !ids.includes(row.id) || row.read !== read)
  )
    throw new Error(
      "Some activity is no longer available. Refresh and try again.",
    );
}
export async function activityDestination(owner: string, n: Activity) {
  const ticket = accountScope.capture();
  if (ticket.id !== owner || n.user_id !== owner)
    throw new Error("This activity is unavailable.");
  const path = activityDetails(n).path;
  if (!path) throw new Error("This activity has no available link.");
  if (path.startsWith("/design/") || path.startsWith("/creator/")) {
    const design = path.startsWith("/design/");
    const { data, error } = await supabase
      .from(design ? "designs" : "profiles")
      .select("id")
      .eq("id", design ? n.design_id! : n.actor_id)
      .maybeSingle();
    accountScope.assert(ticket);
    if (error || !data)
      throw new Error(
        "This content is unavailable or you no longer have access. Your activity is still here.",
      );
  }
  accountScope.assert(ticket);
  return path;
}
