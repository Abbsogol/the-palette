import { getSessionUser, serviceClient as db } from "@/lib/auth";
import { mobileJson, mobileUserClient, uuidPattern } from "@/lib/mobile-auth";
export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const id = new URL(request.url).searchParams.get("booking");
  if (!uuidPattern.test(id || ""))
    return mobileJson({ error: "Invalid booking" }, 400);
  try {
    const { data: booking, error } = await mobileUserClient(request)
      .from("bookings")
      .select("id,client_id,creator_id,deposit_paid")
      .eq("id", id)
      .maybeSingle();
    if (error) throw error;
    if (!booking || ![booking.client_id, booking.creator_id].includes(user.id))
      return mobileJson({ error: "Booking not found" }, 404);
    const { data: receipts, error: receiptError } = await db
      .from("order_payments")
      .select(
        "payment_intent,refund_required,refund_status,refunded,needs_review,refund_reconciliation_pending,fulfilled",
      )
      .eq("user_id", booking.client_id)
      .eq("kind", "deposit")
      .eq("target_id", id)
      .order("created_at", { ascending: false });
    if (receiptError) throw receiptError;
    // An unresolved older payment cannot be concealed by a newer receipt.
    if (
      receipts?.some(
        (r) =>
          r.refund_required &&
          !r.refunded &&
          ["failed", "canceled", "requires_action"].includes(r.refund_status),
      )
    )
      return mobileJson({ status: "refund_failed" });
    if (receipts?.some((r) => r.refund_required && !r.refunded))
      return mobileJson({ status: "refund_pending" });
    if (
      receipts?.some((r) => r.needs_review || r.refund_reconciliation_pending)
    )
      return mobileJson({ status: "payment_review" });
    if (
      receipts?.length &&
      receipts.every((r) => r.refunded || r.refund_status === "succeeded")
    )
      return mobileJson({ status: "refunded" });
    const intents = (receipts || [])
      .map((r) => r.payment_intent)
      .filter(Boolean);
    if (intents.length) {
      const { data: refunds, error: refundError } = await db
        .from("payment_refund_states")
        .select("status")
        .eq("user_id", booking.client_id)
        .eq("kind", "deposit")
        .in("payment_intent", intents);
      if (refundError) throw refundError;
      for (const status of [
        "payment_review",
        "refund_failed",
        "refund_pending",
        "partially_refunded",
      ]) {
        if (refunds?.some((r) => r.status === status))
          return mobileJson({
            status: status === "partially_refunded" ? "partial_refund" : status,
          });
      }
    }
    return mobileJson({
      status: booking.deposit_paid ? "fulfilled" : "pending",
    });
  } catch {
    return mobileJson({ error: "Unable to confirm deposit" }, 503);
  }
}
