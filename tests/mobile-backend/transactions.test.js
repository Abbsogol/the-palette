import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createSecurityDatabase } from "../helpers/security-database";
const client = "00000000-0000-4000-8000-000000000711",
  creator = "00000000-0000-4000-8000-000000000712",
  stranger = "00000000-0000-4000-8000-000000000713",
  service = "00000000-0000-4000-8000-000000000714";
let db;
beforeAll(async () => {
  db = await createSecurityDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "truncate auth.users,profiles_data,mobile_store_transactions,mobile_store_owners,mobile_store_events,mobile_billing_reconciliations,mobile_entitlements,mobile_store_products,mobile_media_cleanup,credit_payments,processed_webhook_events,order_payments cascade",
  );
  await db.query("insert into auth.users(id) values($1),($2),($3)", [
    client,
    creator,
    stranger,
  ]);
  await db.query(
    "update profiles_data set account_type='creator',booking_area='Studio A',credit_balance=0",
    [],
  );
  await db.query(
    "insert into services(id,creator_id,name,duration_minutes,price,deposit_amount) values($1,$2,'Manicure',30,100,20)",
    [service, creator],
  );
  await db.query(
    "insert into availability(creator_id,day_of_week,start_time,end_time) select $1,generate_series(0,6),'00:00'::time,'23:59'::time",
    [creator],
  );
  await db.query(
    "insert into creator_booking_settings(creator_id,time_zone) values($1,'Asia/Dubai')",
    [creator],
  );
  await db.exec(
    "insert into mobile_store_products(store,product_id,kind,credits,plan_id) values('APP_STORE','pack5','credits',5,null),('PLAY_STORE','pro','subscription',20,'pro_creator')",
  );
});
const book = () =>
  db
    .as(
      "authenticated",
      client,
      "insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,status) values($1,$2,$3,current_date+2,'10:00','10:30','pending') returning *",
      [client, creator, service],
    )
    .then((r) => r.rows[0]);
const event = (id = "purchase", extra = {}) => ({
  id,
  app_user_id: client,
  original_app_user_id: client,
  type: "NON_RENEWING_PURCHASE",
  store: "APP_STORE",
  environment: "SANDBOX",
  product_id: "pack5",
  transaction_id: "tx1",
  original_transaction_id: "tx1",
  purchased_at_ms: Date.now(),
  event_timestamp_ms: Date.now(),
  ...extra,
});
const stage = (e, user = client) =>
  db.as(
    "service_role",
    null,
    "select stage_mobile_store_event($1,$2,$3::jsonb)",
    [e.id, user, JSON.stringify(e)],
  );
const claim = async (user = client) =>
  (
    await db.as("service_role", null, "select claim_mobile_billing($1) token", [
      user,
    ])
  ).rows[0].token;
const finish = (token, entitlements = [], refunds = [], user = client) =>
  db.as(
    "service_role",
    null,
    "select finish_mobile_billing($1,$2,$3::jsonb,$4::jsonb) saved",
    [user, token, JSON.stringify(entitlements), JSON.stringify(refunds)],
  );
const balance = async (user = client) =>
  (
    await db.query("select credit_balance from profiles_data where id=$1", [
      user,
    ])
  ).rows[0].credit_balance;
it("freezes reviewed prices and uses the snapshot after a service price changes", async () => {
  const b = await book();
  expect(Number(b.price_snapshot)).toBe(100);
  expect(b.location_snapshot).toBe("Studio A");
  await db.as(
    "authenticated",
    creator,
    "update services set price=200,deposit_amount=80 where id=$1",
    [service],
  );
  const {
    rows: [{ checkout }],
  } = await db.as(
    "service_role",
    null,
    "select reserve_deposit_checkout($1,$2,$3) checkout",
    [client, b.id, "https://staging.example"],
  );
  expect(checkout.amount).toBe(2000);
  await expect(
    db.as(
      "authenticated",
      client,
      "update bookings set price_snapshot=1 where id=$1",
      [b.id],
    ),
  ).rejects.toThrow("BOOKING_FIELDS_ARE_IMMUTABLE");
});
it("rejects stale prices and locations before creating a reservation", async () => {
  for (const [price, location] of [
    [99, "Studio A"],
    [100, "Old studio"],
  ])
    await expect(
      db.as(
        "authenticated",
        client,
        "insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,price_snapshot,deposit_snapshot,location_snapshot) values($1,$2,$3,current_date+2,'10:00','10:30',$4,20,$5)",
        [client, creator, service, price, location],
      ),
    ).rejects.toThrow("BOOKING_TERMS_CHANGED");
  expect(
    (await db.query("select count(*)::int n from bookings")).rows[0].n,
  ).toBe(0);
});
it("creator cancellation durably obligates a full refund and blocks deletion for both participants", async () => {
  const b = await book();
  await db.query(
    "insert into order_payments(payment_intent,user_id,kind,target_id,fulfilled) values('pi_mobile',$1,'deposit',$2,true)",
    [client, b.id],
  );
  await expect(
    db.as("authenticated", stranger, "select cancel_mobile_booking($1)", [
      b.id,
    ]),
  ).rejects.toThrow("BOOKING_NOT_FOUND");
  await db.as("authenticated", creator, "select cancel_mobile_booking($1)", [
    b.id,
  ]);
  await db.as("authenticated", client, "select cancel_mobile_booking($1)", [
    b.id,
  ]);
  const receipt = (
    await db.query(
      "select refund_required,refund_reconciliation_pending,refund_event_version from order_payments where payment_intent='pi_mobile'",
    )
  ).rows[0];
  expect(receipt).toMatchObject({
    refund_required: true,
    refund_reconciliation_pending: true,
  });
  for (const user of [client, creator])
    await expect(
      db.as("service_role", null, "select begin_account_deletion($1)", [user]),
    ).rejects.toThrow("BOOKING_OR_REFUND_IN_PROGRESS");
});
it("concurrent web and mobile checkout retries share one immutable return context", async () => {
  const b = await book();
  const {
    rows: [{ attempt }],
  } = await db.as(
    "service_role",
    null,
    "select reserve_deposit_checkout($1,$2,$3) attempt",
    [client, b.id, "https://staging.example"],
  );
  const results = await Promise.all(
    ["web", "laque-dev"].map((c) =>
      db.as(
        "service_role",
        null,
        "select bind_deposit_return($1,$2,$3) context",
        [attempt.id, client, c],
      ),
    ),
  );
  expect(results[0].rows[0].context).toBe(results[1].rows[0].context);
  await expect(
    db.as("authenticated", client, "select bind_deposit_return($1,$2,$3)", [
      attempt.id,
      client,
      "laque",
    ]),
  ).rejects.toThrow(/permission denied/);
});
it("a duplicate transaction grants once even with different event IDs, including after credits are spent", async () => {
  const e = event();
  await stage(e);
  expect((await finish(await claim())).rows[0].saved).toBe(true);
  expect(await balance()).toBe(5);
  await db.query("update profiles_data set credit_balance=1 where id=$1", [
    client,
  ]);
  await stage({ ...e, id: "redelivered" });
  await finish(await claim());
  expect(await balance()).toBe(1);
  await finish(await claim());
  expect(await balance()).toBe(1);
});
it("a refund received before a delayed purchase prevents any credit grant", async () => {
  const e = event("refund", { type: "CANCELLATION" });
  await stage(e);
  await finish(await claim());
  expect(await balance()).toBe(0);
  await stage({ ...e, id: "late-purchase", type: "NON_RENEWING_PURCHASE" });
  await finish(await claim());
  expect(await balance()).toBe(0);
});
it("a new event fences an older provider snapshot until it is fetched again", async () => {
  await stage(event());
  const token = await claim();
  await stage(event("refund", { type: "CANCELLATION" }));
  expect((await finish(token)).rows[0].saved).toBe(false);
  expect(await balance()).toBe(0);
  await db.as("service_role", null, "select release_mobile_billing($1,$2)", [
    client,
    token,
  ]);
  await finish(await claim());
  expect(await balance()).toBe(0);
});
it("concurrent restores cannot rebind one original store transaction to a different account", async () => {
  const e = event();
  await stage(e);
  await stage(
    {
      ...e,
      id: "other-user",
      app_user_id: stranger,
      original_app_user_id: stranger,
      transaction_id: "tx2",
    },
    stranger,
  );
  const tokens = await Promise.all([claim(), claim(stranger)]);
  const results = await Promise.allSettled([
    finish(tokens[0]),
    finish(tokens[1], [], [], stranger),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await balance()) + (await balance(stranger))).toBe(5);
});
it("neither a client nor a missing claim token can grant store credits", async () => {
  await stage(event());
  expect((await finish(null)).rows[0].saved).toBe(false);
  await expect(
    db.as("authenticated", client, "select claim_mobile_billing($1)", [client]),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.as(
      "authenticated",
      client,
      "insert into mobile_entitlements values($1,'PLAY_STORE','pro','pro_creator',now()+interval '1 month',false,now())",
      [client],
    ),
  ).rejects.toThrow(/permission denied/);
  expect(await balance()).toBe(0);
});
it("native and web subscription starts cannot reserve both channels concurrently", async () => {
  const results = await Promise.allSettled([
    db.as(
      "service_role",
      null,
      "select begin_mobile_purchase($1,'00000000-0000-4000-8000-000000000799','PLAY_STORE','pro')",
      [client],
    ),
    db.as(
      "service_role",
      null,
      "select reserve_subscription_checkout_v2($1,'pro_creator','test@example.invalid','https://staging.example','price_test')",
      [client],
    ),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
});
it("an expired native entitlement no longer bypasses the database upload quota", async () => {
  await db.query(
    "insert into mobile_entitlements values($1,'PLAY_STORE','pro','pro_creator',now()+interval '1 minute',false,now())",
    [creator],
  );
  await db.as("service_role", null, "select refresh_mobile_entitlements($1)", [
    creator,
  ]);
  await db.query(
    "update mobile_entitlements set expires_at=now()-interval '1 minute' where user_id=$1",
    [creator],
  );
  await db.query(
    "update profiles_data set weekly_uploads=5,week_reset_at=now() where id=$1",
    [creator],
  );
  await expect(
    db.as(
      "authenticated",
      creator,
      "insert into designs(title,created_by,is_published,image_url) values('Expired privilege',$1,true,'https://example.invalid/image.webp')",
      [creator],
    ),
  ).rejects.toThrow("WEEKLY_UPLOAD_LIMIT");
});
