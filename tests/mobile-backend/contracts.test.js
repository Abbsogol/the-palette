import { expect, it } from "vitest";
import {
  normalizeStoreEvent,
  validRevenueCatAuthorization,
  verifiedStoreSnapshot,
} from "@/lib/mobile-billing";
import { depositReturnContext, depositReturnUrls } from "@/lib/mobile-return";
const user = "00000000-0000-4000-8000-000000000711";
const e = {
  app_id: "app_beta",
  environment: "SANDBOX",
  store: "APP_STORE",
  app_user_id: user,
  original_app_user_id: user,
  id: "event",
  type: "NON_RENEWING_PURCHASE",
  product_id: "pack5",
  transaction_id: "tx",
  original_transaction_id: "tx",
  purchased_at_ms: 100,
  event_timestamp_ms: 100,
};
const options = { apps: ["app_beta"], environment: "SANDBOX" };
it("webhook secrets are required and compared exactly", () => {
  const secret = "test-only-secret-more-than-24";
  expect(validRevenueCatAuthorization(`Bearer ${secret}`, secret)).toBe(true);
  expect(validRevenueCatAuthorization(`Bearer ${secret}x`, secret)).toBe(false);
  expect(validRevenueCatAuthorization("Bearer undefined", "")).toBe(false);
});
it.each([
  { environment: "PRODUCTION" },
  { app_id: "other-app" },
  { original_app_user_id: "another-user" },
  { is_family_share: true },
  { transaction_id: "" },
])("rejects unverifiable store identities: %j", (override) =>
  expect(() => normalizeStoreEvent({ ...e, ...override }, options)).toThrow(),
);
it("persists only minimal accounting fields rather than subscriber attributes", () => {
  const value = normalizeStoreEvent(
    {
      ...e,
      subscriber_attributes: { email: "private" },
      ip_address: "private",
    },
    options,
  );
  expect(value).not.toHaveProperty("subscriber_attributes");
  expect(value).not.toHaveProperty("ip_address");
  expect(value.transaction_id).toBe("tx");
});
it("a client-like snapshot with missing original ownership cannot grant entitlements", () => {
  expect(() =>
    verifiedStoreSnapshot(
      { subscriber: { subscriptions: {} } },
      user,
      [],
      "SANDBOX",
    ),
  ).toThrow("ownership");
});
it("rejects shared or production subscriptions in beta snapshots", () => {
  const products = [
    { store: "APP_STORE", product_id: "pro", kind: "subscription" },
  ];
  const subscription = {
    store: "app_store",
    is_sandbox: false,
    ownership_type: "PURCHASED",
    purchase_date: "2026-09-01",
    expires_date: "2026-10-01",
  };
  expect(() =>
    verifiedStoreSnapshot(
      {
        subscriber: {
          original_app_user_id: user,
          subscriptions: { pro: subscription },
        },
      },
      user,
      products,
      "SANDBOX",
    ),
  ).toThrow("environment");
  expect(() =>
    verifiedStoreSnapshot(
      {
        subscriber: {
          original_app_user_id: user,
          subscriptions: {
            pro: {
              ...subscription,
              is_sandbox: true,
              ownership_type: "FAMILY_SHARED",
            },
          },
        },
      },
      user,
      products,
      "SANDBOX",
    ),
  ).toThrow("ownership");
});
it("mobile checkout redirects require a server allowlist", () => {
  expect(() => depositReturnContext("https://evil.invalid")).toThrow();
  expect(depositReturnContext(undefined)).toBe("web");
  const urls = depositReturnUrls(
    { base_url: "https://staging.example" },
    user,
    "web",
  );
  expect(new URL(urls.success_url).origin).toBe("https://staging.example");
});
import { GET as mobileConfig } from "@/app/api/mobile/config/route";
import { vi, afterEach } from "vitest";
afterEach(() => vi.unstubAllEnvs());
it("the public environment handshake exposes no secrets or personal records", async () => {
  vi.stubEnv("MOBILE_ENVIRONMENT", "beta");
  vi.stubEnv("MOBILE_SUPABASE_PROJECT_REF", "isolated");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://isolated.supabase.co");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_never_connect");
  const response = await mobileConfig();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    environment: "beta",
    projectRef: "isolated",
    contractVersion: 1,
  });
});
it("the handshake refuses production database and live Stripe configuration", async () => {
  vi.stubEnv("MOBILE_ENVIRONMENT", "beta");
  vi.stubEnv("MOBILE_SUPABASE_PROJECT_REF", "faunikvhoommbebsmevg");
  vi.stubEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    "https://faunikvhoommbebsmevg.supabase.co",
  );
  expect((await mobileConfig()).status).toBe(503);
  vi.stubEnv("MOBILE_SUPABASE_PROJECT_REF", "isolated");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://isolated.supabase.co");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_forbidden");
  expect((await mobileConfig()).status).toBe(503);
});
