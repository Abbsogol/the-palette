import { after } from "next/server";
import {
  CalendarError,
  checkBooking,
  enabled,
  syncJobs,
} from "@/lib/calendar/google";
import { getSessionUser, serviceClient } from "@/lib/auth";
import { mobileJson, mobileUserClient, uuidPattern } from "@/lib/mobile-auth";
export const maxDuration = 300;
export async function POST(request) {
  const user = await getSessionUser(request, { allowSuspended: true });
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const { bookingId, action } = await request.json().catch(() => ({}));
  if (
    !uuidPattern.test(bookingId || "") ||
    !["cancel", "confirm", "decline"].includes(action)
  )
    return mobileJson({ error: "Invalid booking action" }, 400);
  const client = mobileUserClient(request);
  if (action === "confirm" && enabled()) {
    const { data: booking, error } = await client
      .from("bookings")
      .select("*")
      .eq("id", bookingId)
      .eq("creator_id", user.id)
      .maybeSingle();
    if (error || !booking)
      return mobileJson({ error: "Appointment unavailable." }, 404);
    if (booking.status === "confirmed") return mobileJson({ booking });
    if (booking.status !== "pending")
      return mobileJson(
        { error: "This appointment is no longer pending." },
        409,
      );
    try {
      await checkBooking(serviceClient, booking, "confirm");
    } catch (e) {
      return mobileJson(
        {
          error:
            e instanceof CalendarError
              ? e.message
              : "Calendars could not be checked. Please retry.",
          code: e.code || "CALENDAR_UNAVAILABLE",
        },
        e.status || 503,
      );
    }
  }
  const result =
    action === "cancel"
      ? await client.rpc("cancel_mobile_booking", { p_booking_id: bookingId })
      : await client
          .from("bookings")
          .update({ status: action === "confirm" ? "confirmed" : "declined" })
          .eq("id", bookingId)
          .eq("creator_id", user.id)
          .eq("status", "pending")
          .select("*")
          .single();
  if (result.error || !result.data)
    return mobileJson(
      {
        error:
          "The appointment changed or this action is no longer permitted. Refresh its status.",
      },
      409,
    );
  if (enabled()) after(() => syncJobs(serviceClient).catch(() => undefined));
  return mobileJson({
    booking: result.data,
    refundNotice:
      action === "cancel"
        ? "Any paid deposit is queued for a full refund."
        : null,
  });
}
