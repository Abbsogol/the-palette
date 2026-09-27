import { getSessionUser, serviceClient as db } from "@/lib/auth";
import { mobileJson, uuidPattern } from "@/lib/mobile-auth";
import { reconcileMobileBilling } from "@/lib/mobile-billing";
export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  try {
    const { error: refreshError } = await db.rpc(
      "refresh_mobile_entitlements",
      { p_user_id: user.id },
    );
    if (refreshError) throw refreshError;
    const [profile, catalog, store, review, checkout, purchases] =
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
          .eq("active", true),
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
      ]);
    for (const result of [profile, catalog, store, review, checkout, purchases])
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
      credits: profile.data.credit_balance,
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
      canSubscribe:
        !webActive &&
        !active.length &&
        !checkout.data &&
        !review.data?.needs_review &&
        !purchases.data?.length,
      needsReview: review.data?.needs_review || false,
      pendingPurchases: purchases.data,
      verifiedAt: review.data?.verified_at || null,
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
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  if (body.action === "purchase") {
    if (
      !uuidPattern.test(body.id || "") ||
      !["APP_STORE", "PLAY_STORE"].includes(body.store) ||
      typeof body.productId !== "string"
    )
      return mobileJson({ error: "Invalid purchase" }, 400);
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
              "An active subscription or pending purchase prevents this checkout. Check purchases first.",
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
