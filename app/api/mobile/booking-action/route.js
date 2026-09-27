import { getSessionUser } from "@/lib/auth";
import { mobileJson, mobileUserClient, uuidPattern } from "@/lib/mobile-auth";
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const { bookingId, action } = await request.json().catch(() => ({}));
  if (
    !uuidPattern.test(bookingId || "") ||
    !["cancel", "confirm", "decline"].includes(action)
  )
    return mobileJson({ error: "Invalid booking action" }, 400);
  const client = mobileUserClient(request);
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
  return mobileJson({
    booking: result.data,
    refundNotice:
      action === "cancel"
        ? "Any paid deposit is queued for a full refund."
        : null,
  });
}
