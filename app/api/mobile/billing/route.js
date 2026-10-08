import { getSessionUser, serviceClient as db } from "@/lib/auth";
import { mobileJson, uuidPattern } from "@/lib/mobile-auth";
import { reconcileMobileBilling } from "@/lib/mobile-billing";
import { readMobileCreditHistory } from "@/lib/mobile-credit-history";
export async function GET(request) {
  const user = await getSessionUser(request, { allowSuspended: true });
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  try {
    const { error: refreshError } = await db.rpc(
      "refresh_mobile_entitlements",
      { p_user_id: user.id },
    );
    if (refreshError) throw refreshError;
    const [profile, catalog, store, review, checkout, purchases, history, lab] =
      await Promise.all([
        db
          .from("profiles_data")
          .select(
            "credit_balance,subscription_tier,stripe_subscription_tier,stripe_subscription_id,subscription_status",
          )
          .eq("id", user.id)
          .single(),
        db
          .from("mobile_store_products")
          .select("store,product_id,kind,plan_id,credits")
          .eq("active", true)
          .in("product_id", ["laque_lab_monthly_5", "laque_lab_monthly_5:monthly", "laque_lab_tokens_30", "laque_lab_tokens_100"]),
        db
          .from("mobile_entitlements")
          .select("store,product_id,plan_id,expires_at,refunded")
          .eq("user_id", user.id),
        db
          .from("mobile_billing_reconciliations")
          .select("needs_review,verified_at")
          .eq("user_id", user.id)
          .maybeSingle(),
        db
          .from("subscription_checkouts")
          .select("id")
          .eq("user_id", user.id)
          .maybeSingle(),
        db
          .from("mobile_purchase_intents")
          .select("id,product_id,store,created_at")
          .eq("user_id", user.id)
          .eq("status", "pending"),
        readMobileCreditHistory(db, user.id).catch(() => null),
        db.rpc("lab_subscription_status", { p_user_id: user.id }),
      ]);
    for (const result of [profile, catalog, store, review, checkout, purchases, lab])
      if (result.error) throw result.error;
    const active = (store.data || []).filter(
      (s) => !s.refunded && new Date(s.expires_at) > new Date(),
    );
    const webActive =
      !!profile.data.stripe_subscription_tier ||
      (!!profile.data.stripe_subscription_id &&
        !["canceled", "incomplete_expired"].includes(
          profile.data.subscription_status,
        ));
    return mobileJson({
      credits: lab.data.active ? lab.data.monthlyRemaining + lab.data.purchasedTokens : 0,
      purchasedTokens: lab.data.purchasedTokens,
      subscription: lab.data,
      plan: { monthlyUsd: 5, monthlyDesigns: 15 },
      tier: profile.data.subscription_tier,
      catalog: catalog.data,
      sources: [
        ...(webActive
          ? [
              {
                store: "STRIPE",
                plan_id: profile.data.stripe_subscription_tier,
              },
            ]
          : []),
        ...active,
      ],
      canSubscribe: !lab.data.active && !webActive && !active.length && !checkout.data,
      needsReview: review.data?.needs_review || false,
      pendingPurchases: purchases.data,
      verifiedAt: review.data?.verified_at || null,
      history,
      configured:
        !!process.env.REVENUECAT_SECRET_KEY &&
        !!process.env.REVENUECAT_WEBHOOK_SECRET &&
        !!process.env.REVENUECAT_APP_IDS &&
        !!catalog.data?.length,
    });
  } catch {
    return mobileJson(
      { error: "Billing status is unavailable. Please retry." },
      503,
    );
  }
}
export async function POST(request) {
  const user = await getSessionUser(request, { allowSuspended: true });
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  if (body.action === "purchase") {
    if (
      !uuidPattern.test(body.id || "") ||
      !["APP_STORE", "PLAY_STORE"].includes(body.store) ||
      typeof body.productId !== "string"
    )
      return mobileJson({ error: "Invalid purchase" }, 400);
    const product = await db
      .from("mobile_store_products")
      .select("kind,credits,product_id")
      .eq("store", body.store)
      .eq("product_id", body.productId)
      .eq("active", true)
      .maybeSingle();
    if (product.error)
      return mobileJson(
        { error: "Credit packs are unavailable. Please retry." },
        503,
      );
    if (
      !product.data ||
      !((product.data.kind === "credits" && [30, 100].includes(product.data.credits) && ["laque_lab_tokens_30", "laque_lab_tokens_100"].includes(body.productId)) || (product.data.kind === "subscription" && product.data.credits === 15 && body.productId === (body.store === "PLAY_STORE" ? "laque_lab_monthly_5:monthly" : "laque_lab_monthly_5")))
    )
      return mobileJson(
        {
          error: "This product is no longer offered. Choose the Nail Lab subscription or a design-token pack.",
        },
        410,
      );
    const { data, error } = await db.rpc("begin_mobile_purchase", {
      p_user_id: user.id,
      p_id: body.id,
      p_store: body.store,
      p_product: body.productId,
    });
    return error
      ? mobileJson(
          {
            error:
              "This purchase could not be started. Check any pending purchase before trying again.",
          },
          409,
        )
      : mobileJson({ purchaseId: data });
  }
  if (body.action === "cancel") {
    if (!uuidPattern.test(body.id || ""))
      return mobileJson({ error: "Invalid purchase" }, 400);
    const { error } = await db
      .from("mobile_purchase_intents")
      .update({ status: "cancelled" })
      .eq("id", body.id)
      .eq("user_id", user.id)
      .eq("status", "pending");
    return error
      ? mobileJson(
          { error: "Purchase cancellation could not be recorded" },
          503,
        )
      : mobileJson({ ok: true });
  }
  try {
    await reconcileMobileBilling(db, user.id);
    return mobileJson({ verified: true });
  } catch {
    return mobileJson(
      {
        error:
          "Purchases are still being verified. Do not purchase again. Retry verification shortly.",
      },
      503,
    );
  }
}
