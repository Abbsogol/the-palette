import { beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  db: { from: vi.fn(), rpc: vi.fn() },
  reconcile: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getSessionUser: mocks.getSessionUser,
  serviceClient: mocks.db,
}));
vi.mock("@/lib/mobile-billing", () => ({
  reconcileMobileBilling: mocks.reconcile,
}));
import { GET, POST } from "../../app/api/mobile/billing/route.js";
const id = "00000000-0000-4000-8000-000000000001";
let product, chains, history;
function chain(result) {
  const q = {
    select: vi.fn(() => q),
    eq: vi.fn(() => q),
    in: vi.fn(() => q),
    update: vi.fn(() => q),
    order: vi.fn(() => q),
    limit: vi.fn(() => q),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (ok, no) => Promise.resolve(result).then(ok, no),
  };
  return q;
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.getSessionUser.mockResolvedValue({ id: "owner" });
  mocks.db.rpc.mockImplementation(async(name)=>({data:name==="lab_subscription_status"?{active:true,monthlyRemaining:0,purchasedTokens:7}:id,error:null}));
  mocks.reconcile.mockResolvedValue(undefined);
  product = { data: { kind: "credits", credits: 30 }, error: null };
  history = { data: [], error: null };
  chains = {};
  mocks.db.from.mockImplementation(
    (table) =>
      (chains[table] = chain(
        table === "mobile_store_transactions"
          ? history
          : table === "mobile_store_products"
            ? product
            : table === "profiles_data"
              ? { data: { credit_balance: 7 }, error: null }
              : {
                  data:
                    table === "mobile_entitlements" ||
                    table === "mobile_purchase_intents"
                      ? []
                      : null,
                  error: null,
                },
      )),
  );
});
const request = (body) =>
  new Request("https://test.invalid/api/mobile/billing", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
const purchase = () =>
  POST(
    request({
      action: "purchase",
      id,
      store: "APP_STORE",
      productId: "laque_lab_tokens_30",
    }),
  );
it("returns the subscription plan and only new registered token offers", async () => {
  product = { data: [{ kind: "credits", credits: 30 }], error: null };
  const response = await GET(
    new Request("https://test.invalid/api/mobile/billing"),
  );
  expect(response.status).toBe(200);
  expect(chains.mobile_store_products.in).toHaveBeenCalledWith("product_id", ["laque_lab_monthly_5", "laque_lab_monthly_5:monthly", "laque_lab_tokens_30", "laque_lab_tokens_100"]);
  expect(await response.json()).toMatchObject({
    credits: 7,
    canSubscribe: false,
    catalog: product.data,
  });
});
it.each([
  { kind: "subscription", credits: 20 },
  { kind: "credits", credits: 20 },
  null,
])("rejects retired or unknown products before reserving: %o", async (data) => {
  product.data = data;
  expect((await purchase()).status).toBe(410);
  expect(mocks.db.rpc).not.toHaveBeenCalled();
});
it("checks active store/product identity and retains transactional one-time reservations", async () => {
  expect((await purchase()).status).toBe(200);
  expect(chains.mobile_store_products.eq.mock.calls).toEqual([
    ["store", "APP_STORE"],
    ["product_id", "laque_lab_tokens_30"],
    ["active", true],
  ]);
  expect(mocks.db.rpc).toHaveBeenCalledWith("begin_mobile_purchase", {
    p_user_id: "owner",
    p_id: id,
    p_store: "APP_STORE",
    p_product: "laque_lab_tokens_30",
  });
});
it("catalog failures and invalid purchase requests cannot reserve", async () => {
  product.error = { message: "offline" };
  expect((await purchase()).status).toBe(503);
  expect(mocks.db.rpc).not.toHaveBeenCalled();
  expect(
    (
      await POST(
        request({
          action: "purchase",
          id: "bad",
          store: "APP_STORE",
          productId: "laque_lab_tokens_30",
        }),
      )
    ).status,
  ).toBe(400);
});
it("authentication still gates reads, purchases, cancellations and reconciliation", async () => {
  mocks.getSessionUser.mockResolvedValue(null);
  expect((await GET(new Request("https://test.invalid"))).status).toBe(401);
  for (const action of ["purchase", "cancel", undefined])
    expect((await POST(request({ action, id }))).status).toBe(401);
  expect(mocks.db.from).not.toHaveBeenCalled();
  expect(mocks.reconcile).not.toHaveBeenCalled();
});
it("cancellation stays scoped to this account's pending intent; reconciliation remains available", async () => {
  expect((await POST(request({ action: "cancel", id }))).status).toBe(200);
  expect(chains.mobile_purchase_intents.eq.mock.calls).toEqual([
    ["id", id],
    ["user_id", "owner"],
    ["status", "pending"],
  ]);
  expect((await POST(request({}))).status).toBe(200);
  expect(mocks.reconcile).toHaveBeenCalledWith(mocks.db, "owner");
});

it("returns bounded owner-only receipt summaries, retaining refunded precedence and hiding provider identifiers", async () => {
  history.data = Array.from({ length: 21 }, (_, i) => ({
    store: i % 2 ? "PLAY_STORE" : "APP_STORE",
    environment: "SANDBOX",
    product_id: "pack15",
    credits: 15,
    purchased_at: "1791374400000",
    granted: true,
    refunded: i === 0,
    transaction_id: "private-transaction",
    original_transaction_id: "private-original",
    user_id: "owner",
  }));
  const response = await GET(
    new Request("https://test.invalid/api/mobile/billing?user=other"),
  );
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(chains.mobile_store_transactions.eq.mock.calls).toEqual([
    ["user_id", "owner"],
    ["kind", "credits"],
  ]);
  expect(chains.mobile_store_transactions.limit).toHaveBeenCalledWith(21);
  expect(body.history.items).toHaveLength(20);
  expect(body.history.hasMore).toBe(true);
  expect(body.history.items[0]).toEqual({
    store: "APP_STORE",
    environment: "SANDBOX",
    productId: "pack15",
    credits: 15,
    purchasedAt: "2026-10-07T12:00:00.000Z",
    status: "refunded",
  });
  expect(JSON.stringify(body)).not.toMatch(
    /private-transaction|private-original|user_id/,
  );
});
it("a partial history failure is unknown, not a false empty history or a lost balance", async () => {
  history.error = new Error("history offline");
  const response = await GET(
    new Request("https://test.invalid/api/mobile/billing"),
  );
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ credits: 7, history: null });
});
it("ungranted receipts remain verifying and unavailable dates never become fabricated dates", async () => {
  history.data = [
    {
      store: "APP_STORE",
      product_id: "pack5",
      environment: "PRODUCTION",
      credits: 5,
      purchased_at: "bad",
      granted: false,
      refunded: false,
    },
  ];
  const body = await (
    await GET(new Request("https://test.invalid/api/mobile/billing"))
  ).json();
  expect(body.history).toMatchObject({
    hasMore: false,
    items: [{ status: "verifying", purchasedAt: null }],
  });
});

it("Google subscription purchases require the exact modern base-plan identity", async () => {
 product.data={kind:"subscription",credits:15};
 expect((await POST(request({action:"purchase",id,store:"PLAY_STORE",productId:"laque_lab_monthly_5:monthly"}))).status).toBe(200);
 expect(mocks.db.rpc).toHaveBeenCalledWith("begin_mobile_purchase",expect.objectContaining({p_product:"laque_lab_monthly_5:monthly",p_store:"PLAY_STORE"}));
 mocks.db.rpc.mockClear();
 expect((await POST(request({action:"purchase",id,store:"PLAY_STORE",productId:"laque_lab_monthly_5"}))).status).toBe(410);
 expect(mocks.db.rpc).not.toHaveBeenCalled();
});
