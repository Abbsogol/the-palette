import { checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { accountScope } from "../../lib/account-scope";
import type { Service } from "../../lib/types";
import type { Day } from "../secondary/hours-form";
import type { SetupRecords } from "./model";
export async function loadSetupRecords(
  id: string,
  signal: AbortSignal,
): Promise<SetupRecords> {
  const ticket = accountScope.capture();
  if (!ticket.id || ticket.id !== id)
    throw new Error("Sign in to check your creator setup.");
  const [services, days, settings, designs] = await Promise.all([
    checked<Service[]>(
      supabase
        .from("services")
        .select(
          "id,creator_id,name,description,price,deposit_amount,duration_minutes,is_active",
        )
        .eq("creator_id", id)
        .eq("is_active", true)
        .abortSignal(signal),
    ),
    checked<Day[]>(
      supabase
        .from("availability")
        .select("day_of_week,start_time,end_time,is_active")
        .eq("creator_id", id)
        .abortSignal(signal),
    ),
    supabase
      .from("creator_booking_settings")
      .select("time_zone")
      .eq("creator_id", id)
      .abortSignal(signal)
      .maybeSingle(),
    checked<{ id: string }[]>(
      supabase
        .from("designs")
        .select("id")
        .eq("created_by", id)
        .eq("is_published", true)
        .not("image_url", "is", null)
        .neq("image_url", "")
        .limit(1)
        .abortSignal(signal),
    ),
  ]);
  accountScope.assert(ticket);
  if (settings.error) throw settings.error;
  return {
    services,
    days,
    timeZone: settings.data?.time_zone || null,
    publishedDesigns: designs.length,
  };
}
