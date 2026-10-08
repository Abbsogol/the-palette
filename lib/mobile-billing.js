import { timingSafeEqual } from "node:crypto";
import { uuidPattern } from "@/lib/mobile-auth";

const eventTypes = new Set([
  "INITIAL_PURCHASE",
  "RENEWAL",
  "NON_RENEWING_PURCHASE",
  "CANCELLATION",
  "UNCANCELLATION",
  "EXPIRATION",
  "BILLING_ISSUE",
  "PRODUCT_CHANGE",
  "SUBSCRIPTION_PAUSED",
  "SUBSCRIPTION_EXTENDED",
  "REFUND_REVERSED",
]);
export function validRevenueCatAuthorization(
  header,
  secret = process.env.REVENUECAT_WEBHOOK_SECRET,
) {
  if (!secret || secret.length < 24 || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`),
    actual = Buffer.from(header);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
export function normalizeStoreEvent(event, options = {}) {
  const environment =
    options.environment || process.env.REVENUECAT_ENVIRONMENT || "SANDBOX";
  const apps =
    options.apps ||
    (process.env.REVENUECAT_APP_IDS || "").split(",").filter(Boolean);
  if (
    !event ||
    typeof event !== "object" ||
    !apps.includes(event.app_id) ||
    event.environment !== environment ||
    !["APP_STORE", "PLAY_STORE"].includes(event.store)
  )
    throw new Error("Wrong store environment or application");
  if (
    !uuidPattern.test(event.app_user_id || "") ||
    event.original_app_user_id !== event.app_user_id ||
    event.is_family_share
  )
    throw new Error("Purchase identity requires review");
  if (
    !eventTypes.has(event.type) ||
    typeof event.id !== "string" ||
    !event.id ||
    event.id.length > 250 ||
    typeof event.product_id !== "string" ||
    !event.product_id ||
    event.product_id.length > 250 ||
    typeof event.transaction_id !== "string" ||
    !event.transaction_id ||
    event.transaction_id.length > 250 ||
    typeof event.original_transaction_id !== "string" ||
    !event.original_transaction_id ||
    event.original_transaction_id.length > 250 ||
    !Number.isSafeInteger(event.purchased_at_ms) ||
    event.purchased_at_ms < 0 ||
    !Number.isSafeInteger(event.event_timestamp_ms)
  )
    throw new Error("Invalid store event");
  // Persist only fields needed for ownership and accounting, not subscriber
  // attributes, location, IP addresses or the full incoming provider payload.
  return Object.fromEntries(
    [
      "id",
      "app_user_id",
      "original_app_user_id",
      "type",
      "store",
      "environment",
      "product_id",
      "transaction_id",
      "original_transaction_id",
      "purchased_at_ms",
      "event_timestamp_ms",
      "period_type",
      "cancel_reason",
    ]
      .filter((key) => event[key] !== undefined)
      .map((key) => [key, event[key]]),
  );
}
export function verifiedStoreSnapshot(payload, userId, products, environment) {
  if (
    !payload?.subscriber ||
    payload.subscriber.original_app_user_id !== userId
  )
    throw new Error("Store ownership could not be verified");
  if (
    !payload.subscriber.subscriptions ||
    typeof payload.subscriber.subscriptions !== "object" ||
    Array.isArray(payload.subscriber.subscriptions)
  )
    throw new Error("Incomplete store snapshot");
  const entitlements = [],
    refunds = [];
  for (const [productId, subscription] of Object.entries(
    payload.subscriber.subscriptions,
  )) {
    const store = { app_store: "APP_STORE", play_store: "PLAY_STORE" }[
      subscription.store
    ];
    if (!store) continue;
    if (
      typeof subscription.is_sandbox !== "boolean" ||
      subscription.is_sandbox !== (environment === "SANDBOX")
    )
      throw new Error("Store environment mismatch");
    if (subscription.ownership_type !== "PURCHASED")
      throw new Error("Shared purchase ownership requires review");
    const product = products.find(
      (p) =>
        p.store === store &&
        p.product_id === productId &&
        p.kind === "subscription",
    );
    if (!product) throw new Error("Unrecognized subscription product");
    const expiration = new Date(
      subscription.grace_period_expires_date || subscription.expires_date,
    ).getTime();
    const purchased = new Date(subscription.purchase_date).getTime();
    if (
      !Number.isFinite(expiration) ||
      !Number.isFinite(purchased) ||
      expiration < purchased
    )
      throw new Error("Invalid subscription dates");
    entitlements.push({
      store,
      product_id: productId,
      expires_at: new Date(expiration).toISOString(),
      purchased_at: new Date(purchased).toISOString(),
      refunded: !!subscription.refunded_at,
    });
    if (subscription.refunded_at) {
      const transaction = subscription.store_transaction_id;
      if (typeof transaction !== "string" || !transaction)
        throw new Error("Refund transaction identity unavailable");
      // The stored binding supplies the original transaction id. It is never
      // inferred from an unrelated subscriber alias or a client receipt.
      refunds.push({
        store,
        environment,
        transaction_id: transaction,
        product_id: productId,
        purchased_at_ms: purchased,
        id: `snapshot-refund:${transaction}`,
      });
    }
  }
  return { entitlements, refunds };
}
export async function reconcileMobileBilling(db, userId, fetcher = fetch) {
  const secret = process.env.REVENUECAT_SECRET_KEY;
  if (!secret) throw new Error("Store verification is not configured");
  const { data: token, error: claimError } = await db.rpc(
    "claim_mobile_billing",
    { p_user_id: userId },
  );
  if (claimError || !token)
    throw claimError || new Error("Store verification is already in progress");
  try {
    const { data: products, error } = await db
      .from("mobile_store_products")
      .select("*");
    if (error) throw error;
    const response = await fetcher(
      `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
      {
        headers: { Authorization: `Bearer ${secret}` },
        signal: AbortSignal.timeout(15000),
        cache: "no-store",
      },
    );
    if (!response.ok)
      throw new Error("Store verification is temporarily unavailable");
    const environment = process.env.REVENUECAT_ENVIRONMENT || "SANDBOX";
    const snapshot = verifiedStoreSnapshot(
      await response.json(),
      userId,
      products || [],
      environment,
    );
    for (const refund of snapshot.refunds) {
      const { data: receipt, error } = await db
        .from("mobile_store_transactions")
        .select("original_transaction_id")
        .eq("store", refund.store)
        .eq("environment", environment)
        .eq("transaction_id", refund.transaction_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (error) throw error;
      if (receipt)
        refund.original_transaction_id = receipt.original_transaction_id;
      else {
        const { data: events, error } = await db
          .from("mobile_store_events")
          .select("payload")
          .eq("user_id", userId)
          .eq("status", "pending");
        if (error) throw error;
        refund.original_transaction_id = events?.find(
          (e) =>
            e.payload.store === refund.store &&
            e.payload.transaction_id === refund.transaction_id,
        )?.payload.original_transaction_id;
        if (!refund.original_transaction_id)
          throw new Error(
            "Refund arrived before its purchase binding. Retry after the purchase event.",
          );
      }
    }
    const { data: saved, error: saveError } = await db.rpc(
      "finish_mobile_billing",
      {
        p_user_id: userId,
        p_token: token,
        p_entitlements: snapshot.entitlements,
        p_refunds: snapshot.refunds,
      },
    );
    if (saveError || !saved)
      throw saveError || new Error("A newer store event requires verification");
  } finally {
    const { error } = await db.rpc("release_mobile_billing", {
      p_user_id: userId,
      p_token: token,
    });
    if (error) throw error;
  }
}
