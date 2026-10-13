import { syncJobs } from "@/lib/calendar/google";
import { reconcileMobileBilling } from "@/lib/mobile-billing";
import { reconcileLateDepositRefund } from "@/lib/deposit-refund";

export async function processMobileJobs(supabase, stripe, send = fetch) {
  const result = { refundsChecked: 0, notificationsDelivered: 0, failed: 0 };
  const { data: refunds, error } = await supabase
    .from("order_payments")
    .select("payment_intent")
    .eq("kind", "deposit")
    .eq("refund_required", true)
    .or(
      "refund_status.is.null,refund_status.neq.succeeded,refund_reconciliation_pending.eq.true",
    )
    .order("created_at")
    .limit(5);
  if (error) throw error;
  for (const receipt of refunds || []) {
    try {
      await reconcileLateDepositRefund(
        supabase,
        stripe,
        receipt.payment_intent,
        Math.floor(Date.now() / 1000),
      );
      result.refundsChecked++;
    } catch {
      result.failed++;
    }
  }
  const { data: jobs, error: claimError } = await supabase.rpc(
    "claim_mobile_notifications",
    { p_limit: 5 },
  );
  if (claimError) throw claimError;
  for (const job of jobs || []) {
    let status = job.status,
      ticket = job.ticket_id,
      message = null;
    try {
      // Recheck the recipient's current preference just before dispatch, including
      // jobs queued before they muted or blocked the conversation.
      if (
        job.status !== "receipt" &&
        !(await canDeliverMobileMessage(supabase, job))
      ) {
        status = "skipped";
      } else {
        // Never include sender names, message text, health data or financial
        // amounts on a lock screen. The app rechecks RLS after the tap.
        const url =
          job.status === "receipt"
            ? "https://exp.host/--/api/v2/push/getReceipts"
            : "https://exp.host/--/api/v2/push/send";
        const body =
          job.status === "receipt"
            ? { ids: [ticket] }
            : {
                to: job.token,
                title: "LaQue",
                body:
                  job.kind === "message"
                    ? "You have a new message."
                    : "Your appointment has an update.",
                data: { kind: job.kind, id: job.target_id },
                channelId: "activity",
                ttl: 3600,
              };
        const response = await send(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(process.env.EXPO_ACCESS_TOKEN
              ? { Authorization: `Bearer ${process.env.EXPO_ACCESS_TOKEN}` }
              : {}),
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error("Push provider unavailable");
        const payload = await response.json();
        const data =
          job.status === "receipt"
            ? payload.data?.[ticket]
            : Array.isArray(payload.data)
              ? payload.data[0]
              : payload.data;
        if (!data) throw new Error("Push receipt not ready");
        if (data.status === "error") {
          if (data.details?.error === "DeviceNotRegistered") {
            const { error } = await supabase
              .from("mobile_push_registrations")
              .update({ enabled: false })
              .eq("id", job.registration_id)
              .eq("user_id", job.user_id)
              .eq("token", job.token);
            if (error) throw error;
            status = "skipped";
          } else throw new Error(data.details?.error || "Push delivery failed");
        } else if (data.status === "ok") {
          if (job.status === "receipt") {
            status = "delivered";
            result.notificationsDelivered++;
          } else {
            if (typeof data.id !== "string")
              throw new Error("Push ticket missing");
            status = "receipt";
            ticket = data.id;
          }
        } else throw new Error("Invalid push response");
      }
    } catch (e) {
      message = e.message;
      result.failed++;
    }
    const { data: saved, error: saveError } = await supabase.rpc(
      "finish_mobile_notification",
      {
        p_id: job.id,
        p_claim: job.claim_token,
        p_status: status,
        p_ticket: ticket,
        p_error: message,
      },
    );
    if (saveError || !saved) result.failed++;
  }
  const { data: reviews, error: reviewError } = await supabase
    .from("mobile_billing_reconciliations")
    .select("user_id")
    .eq("needs_review", true)
    .lte("retry_after", new Date().toISOString())
    .order("retry_after")
    .limit(5);
  if (reviewError) throw reviewError;
  for (const review of reviews || []) {
    try {
      await reconcileMobileBilling(supabase, review.user_id, send);
      result.billingVerified++;
    } catch {
      result.failed++;
    }
  }
  const { data: expired, error: expiryError } = await supabase
    .from("mobile_entitlements")
    .select("user_id")
    .lte("expires_at", new Date().toISOString())
    .order("expires_at", { ascending: false })
    .limit(50);
  if (expiryError) throw expiryError;
  for (const userId of new Set((expired || []).map((row) => row.user_id))) {
    const { error } = await supabase.rpc("refresh_mobile_entitlements", {
      p_user_id: userId,
    });
    if (error) result.failed++;
  }
  const { data: media, error: mediaError } = await supabase.rpc(
    "claim_mobile_media_cleanup",
  );
  if (mediaError) throw mediaError;
  for (const job of media || []) {
    const { error } = await supabase.storage
      .from(job.bucket)
      .remove([job.path]);
    const { error: saveError } = await supabase.rpc(
      "finish_mobile_media_cleanup",
      {
        p_bucket: job.bucket,
        p_path: job.path,
        p_token: job.token,
        p_success: !error,
      },
    );
    if (error || saveError) result.failed++;
    else result.mediaRemoved++;
  }
  const calendars = await syncJobs(supabase, null, send);
  result.calendarsSynced = calendars.synced;
  result.failed += calendars.failed;
  return result;
}

export async function canDeliverMobileMessage(supabase, job) {
  if (job.kind !== "message") return true;
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("client_id,creator_id,muted_by")
    .eq("id", job.target_id)
    .maybeSingle();
  if (error) throw error;
  if (
    !conversation ||
    ![conversation.client_id, conversation.creator_id].includes(job.user_id) ||
    conversation.muted_by?.includes(job.user_id)
  )
    return false;
  const { data: blocks, error: blockError } = await supabase
    .from("blocks")
    .select("id")
    .or(
      `and(blocker_id.eq.${conversation.client_id},blocked_id.eq.${conversation.creator_id}),and(blocker_id.eq.${conversation.creator_id},blocked_id.eq.${conversation.client_id})`,
    )
    .limit(1);
  if (blockError) throw blockError;
  return !blocks?.length;
}
