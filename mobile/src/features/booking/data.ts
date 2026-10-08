import { api, checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { accountScope } from "../../lib/account-scope";
import { calendarDay, monthCells } from "../../lib/calendar";
import type { BookingContext } from "./model";
import type { Service, Slot } from "../../lib/types";
export async function loadBookingContext(id: string): Promise<BookingContext> {
  const [creator, services, settings] = await Promise.all([
    checked<{
      id: string;
      display_name: string;
      account_type: string;
      booking_area: string;
      location: string;
    }>(
      supabase
        .from("profiles")
        .select("id,display_name,account_type,booking_area,location")
        .eq("id", id)
        .single(),
    ),
    checked<Service[]>(
      supabase
        .from("services")
        .select("*")
        .eq("creator_id", id)
        .eq("is_active", true)
        .order("created_at"),
    ),
    checked<{ time_zone: string }>(
      supabase
        .from("creator_booking_settings")
        .select("time_zone")
        .eq("creator_id", id)
        .single(),
    ),
  ]);
  if (!["creator", "salon", "nail_artist"].includes(creator.account_type))
    throw new Error("This profile does not offer appointments.");
  return {
    creator: { id, name: creator.display_name || "Artist" },
    services,
    timeZone: settings.time_zone,
    location: creator.booking_area || creator.location || "",
  };
}
const loadLocalBookingSlots = (
  creatorId: string,
  serviceId: string,
  date: string,
) =>
  checked<Slot[]>(
    supabase.rpc("booking_available_slots", {
      p_creator_id: creatorId,
      p_service_id: serviceId,
      p_date: date,
    }),
  );
export async function loadBookingSlots(
  creatorId: string,
  serviceId: string,
  date: string,
) {
  const query = new URLSearchParams({ creatorId, serviceId, date });
  return (await api<{ slots: Slot[] }>(`/mobile/calendar-slots?${query}`))
    .slots;
}
export async function loadBookingMonth(
  creatorId: string,
  serviceId: string,
  month: string,
  zone: string,
) {
  const ticket = accountScope.capture(),
    today = calendarDay(Date.now(), zone),
    dates = monthCells(month).filter((d): d is string => !!d && d >= today);
  const result: Record<string, boolean> = {};
  let next = 0;
  // Bound concurrent reads; one month is loaded only when the date picker changes.
  await Promise.all(
    Array.from({ length: Math.min(4, dates.length) }, async () => {
      while (next < dates.length) {
        accountScope.assert(ticket);
        const d = dates[next++],
          slots = await loadLocalBookingSlots(creatorId, serviceId, d);
        accountScope.assert(ticket);
        result[d] = slots.some(
          (s) => s.available && Date.parse(s.starts_at) > Date.now(),
        );
      }
    }),
  );
  return result;
}
export async function loadBookingReferences(userId: string) {
  const saved = await checked<{ design_id: string }[]>(
    supabase
      .from("saved_designs")
      .select("design_id")
      .eq("user_id", userId)
      .limit(50),
  );
  const ids = saved.map((v) => v.design_id);
  const [own, savedItems] = await Promise.all([
    checked<{ id: string; title: string; image_url: string }[]>(
      supabase
        .from("designs")
        .select("id,title,image_url")
        .eq("created_by", userId)
        .eq("is_published", true)
        .limit(50),
    ),
    ids.length
      ? checked<{ id: string; title: string; image_url: string }[]>(
          supabase
            .from("designs")
            .select("id,title,image_url")
            .in("id", ids)
            .eq("is_published", true),
        )
      : [],
  ]);
  return [
    ...new Map(
      [...own, ...savedItems].map((d) => [
        d.id,
        { id: d.id, title: d.title, image: d.image_url },
      ]),
    ).values(),
  ];
}
