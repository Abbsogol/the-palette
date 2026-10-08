import { supabase } from "../../lib/supabase";
import { api, checked } from "../../lib/api";
import { accountScope } from "../../lib/account-scope";
import type { Booking } from "../../lib/types";
import type {
  AppointmentRole,
  AppointmentFilter,
  AppointmentItem,
  DepositState,
} from "./model";
export function appointmentQuery(
  owner: string,
  role: AppointmentRole,
  filter: AppointmentFilter,
  limit: number,
  now: number,
  signal: AbortSignal,
) {
  let q = supabase
    .from("bookings")
    .select("*,services(*)")
    .eq(role === "customer" ? "client_id" : "creator_id", owner);
  const instant = new Date(now).toISOString();
  if (filter === "Cancelled") q = q.in("status", ["cancelled", "declined"]);
  else if (filter === "Past")
    q = q.in("status", ["pending", "confirmed"]).lt("ends_at", instant);
  else
    q = q
      .eq("status", filter === "Requests" ? "pending" : "confirmed")
      .or(`ends_at.gte.${instant},ends_at.is.null`);
  // Null instants remain visible for review; never claim they are safely manageable.
  return q
    .order("starts_at", {
      ascending: filter === "Requests" || filter === "Upcoming",
      nullsFirst: false,
    })
    .order("booking_date", {
      ascending: filter === "Requests" || filter === "Upcoming",
    })
    .order("start_time", {
      ascending: filter === "Requests" || filter === "Upcoming",
    })
    .order("id")
    .range(0, limit)
    .abortSignal(signal);
}
export async function loadAppointments(
  owner: string,
  role: AppointmentRole,
  filter: AppointmentFilter,
  limit: number,
  now: number,
  signal: AbortSignal,
) {
  const ticket = accountScope.capture();
  accountScope.assert(ticket);
  if (ticket.id !== owner)
    throw new Error("Your account changed. Refresh appointments to continue.");
  const rows = await checked<Booking[]>(
    appointmentQuery(owner, role, filter, limit, now, signal),
  );
  if (
    rows.some(
      (b) => (role === "customer" ? b.client_id : b.creator_id) !== owner,
    )
  )
    throw new Error("Appointment access changed. Refresh to continue.");
  const bookings = rows.slice(0, limit),
    ids = [
      ...new Set(
        bookings.map((b) => (role === "customer" ? b.creator_id : b.client_id)),
      ),
    ];
  let people: {
      id: string;
      display_name: string | null;
      username: string | null;
      avatar_url: string | null;
    }[] = [],
    identityUnavailable = false;
  if (ids.length) {
    try {
      people = await checked(
        supabase
          .from("profiles")
          .select("id,display_name,username,avatar_url")
          .in("id", ids)
          .abortSignal(signal),
      );
    } catch {
      accountScope.assert(ticket);
      if (signal.aborted) throw new Error("Appointment read cancelled");
      identityUnavailable = true;
    }
  }
  accountScope.assert(ticket);
  if (signal.aborted) throw new Error("Appointment read cancelled");
  const items: AppointmentItem[] = bookings.map((b) => {
    const id = role === "customer" ? b.creator_id : b.client_id,
      p = people.find((p) => p.id === id);
    return {
      ...b,
      identityUnavailable: identityUnavailable || !p,
      person: p
        ? {
            id: p.id,
            name: p.display_name?.trim() || p.username || "LaQue member",
            username: p.username,
            avatar: p.avatar_url,
          }
        : undefined,
    };
  });
  return { items, hasMore: rows.length > limit };
}
export async function loadAppointmentDeposits(
  ids: string[],
  signal: AbortSignal,
) {
  const ticket = accountScope.capture(),
    states: Record<string, DepositState> = {};
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(4, ids.length) }, async () => {
      while (next < ids.length) {
        accountScope.assert(ticket);
        if (signal.aborted) throw new Error("Payment read cancelled");
        const id = ids[next++];
        try {
          const result = await api<{ status?: unknown } | null>(
            `/mobile/deposit-status?booking=${encodeURIComponent(id)}`,
          );
          states[id] =
            typeof result?.status === "string" && result.status
              ? { status: result.status }
              : { unavailable: true };
        } catch {
          accountScope.assert(ticket);
          states[id] = { unavailable: true };
        }
        accountScope.assert(ticket);
        if (signal.aborted) throw new Error("Payment read cancelled");
      }
    }),
  );
  accountScope.assert(ticket);
  return states;
}
