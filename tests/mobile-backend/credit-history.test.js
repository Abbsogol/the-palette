import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createSecurityDatabase } from "../helpers/security-database";
import { readMobileCreditHistory } from "../../lib/mobile-credit-history";
const owner = "00000000-0000-4000-8000-000000000971",
  other = "00000000-0000-4000-8000-000000000972";
let db;
beforeAll(async () => {
  db = await createSecurityDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "truncate auth.users,mobile_store_transactions,mobile_store_products cascade",
  );
  await db.query("insert into auth.users(id) values($1),($2)", [owner, other]);
  await db.query(
    "insert into mobile_store_products(store,product_id,kind,credits) values('APP_STORE','pack5','credits',5)",
  );
  for (const [user, tx, granted, refunded] of [
    [owner, "credited", true, false],
    [owner, "refund", true, true],
    [owner, "pending", false, false],
    [other, "foreign", true, false],
  ]) {
    await db.query(
      "insert into mobile_store_transactions(store,environment,transaction_id,original_transaction_id,user_id,product_id,kind,credits,purchased_at,granted,refunded) values('APP_STORE','SANDBOX',$1,$1,$2,'pack5','credits',5,1791374400000,$3,$4)",
      [tx, user, granted, refunded],
    );
  }
});
// Minimal PostgREST transport adapter: the application builds the projection,
// filters, order and limit; PostgreSQL executes them under the requested real role.
function reader(role) {
  return {
    from(table) {
      const filters = [],
        orders = [];
      let fields, maximum;
      const identifier = (v) => {
        if (!/^[a-z_]+$/.test(v)) throw new Error("Invalid identifier");
        return '"' + v + '"';
      };
      const q = {
        select(v) {
          fields = v.split(",").map(identifier).join(",");
          return q;
        },
        eq(k, v) {
          filters.push([identifier(k), v]);
          return q;
        },
        order(k, options = {}) {
          orders.push(
            identifier(k) + (options.ascending === false ? " desc" : " asc"),
          );
          return q;
        },
        limit(v) {
          maximum = v;
          return q;
        },
        then(ok, no) {
          const sql = `select ${fields} from ${identifier(table)} where ${filters.map(([k], i) => k + "=$" + (i + 1)).join(" and ")} order by ${orders.join(",")} limit $${filters.length + 1}`;
          return db
            .as(role, owner, sql, [...filters.map(([, v]) => v), maximum])
            .then(
              (r) => ({ data: r.rows, error: null }),
              (error) => ({ data: null, error }),
            )
            .then(ok, no);
        },
      };
      return q;
    },
  };
}
it("service reads return only the authenticated owner's credit receipts with correct persisted states", async () => {
  const history = await readMobileCreditHistory(reader("service_role"), owner);
  expect(history.items).toHaveLength(3);
  expect(history.items.map((r) => r.status).sort()).toEqual([
    "credited",
    "refunded",
    "verifying",
  ]);
  expect(
    history.items.every(
      (r) => r.credits === 5 && r.purchasedAt === "2026-10-07T12:00:00.000Z",
    ),
  ).toBe(true);
  expect(JSON.stringify(history)).not.toMatch(
    /foreign|original_transaction_id|transaction_id|user_id/,
  );
  expect(
    (await readMobileCreditHistory(reader("service_role"), other)).items,
  ).toHaveLength(1);
});
it.each(["anon", "authenticated"])(
  "%s cannot read or modify receipts directly, even for their own account",
  async (role) => {
    expect(await readMobileCreditHistory(reader(role), owner)).toBeNull();
    await expect(
      db.as(
        role,
        owner,
        "update mobile_store_transactions set refunded=false where user_id=$1",
        [owner],
      ),
    ).rejects.toThrow(/permission denied/);
    const row = (
      await db.query(
        "select refunded from mobile_store_transactions where transaction_id='refund'",
      )
    ).rows[0];
    expect(row.refunded).toBe(true);
  },
);
it("sentinel pagination and equal timestamps are deterministic without including foreign accounts or subscription grants", async () => {
  await db.query(
    "insert into mobile_store_transactions(store,environment,transaction_id,original_transaction_id,user_id,product_id,kind,credits,purchased_at,granted) select 'APP_STORE','SANDBOX','extra-'||n,'extra-'||n,$1,'pack5','credits',5,1791374400000,true from generate_series(1,25) n",
    [owner],
  );
  await db.query(
    "insert into mobile_store_transactions(store,environment,transaction_id,original_transaction_id,user_id,product_id,kind,credits,purchased_at,granted) values('PLAY_STORE','PRODUCTION','subscription','subscription',$1,'legacy','subscription',20,1791375400000,true)",
    [owner],
  );
  const a = await readMobileCreditHistory(reader("service_role"), owner),
    b = await readMobileCreditHistory(reader("service_role"), owner);
  expect(a).toEqual(b);
  expect(a.hasMore).toBe(true);
  expect(a.items).toHaveLength(20);
  expect(a.items.every((r) => r.productId === "pack5")).toBe(true);
});
it("ledger grants, consumed credits, duplicate restores and a delayed post-refund event agree with displayed receipt states", async () => {
  await db.query("delete from mobile_store_transactions where user_id=$1", [
    owner,
  ]);
  await db.query("update profiles_data set credit_balance=0 where id=$1", [
    owner,
  ]);
  const event = {
    id: "history-purchase",
    app_user_id: owner,
    original_app_user_id: owner,
    type: "NON_RENEWING_PURCHASE",
    store: "APP_STORE",
    environment: "SANDBOX",
    product_id: "pack5",
    transaction_id: "ledger-history",
    original_transaction_id: "ledger-history",
    purchased_at_ms: Date.now(),
    event_timestamp_ms: Date.now(),
  };
  const apply = async (e) => {
    await db.as(
      "service_role",
      null,
      "select stage_mobile_store_event($1,$2,$3::jsonb)",
      [e.id, owner, JSON.stringify(e)],
    );
    const token = (
      await db.as(
        "service_role",
        null,
        "select claim_mobile_billing($1) token",
        [owner],
      )
    ).rows[0].token;
    expect(
      (
        await db.as(
          "service_role",
          null,
          "select finish_mobile_billing($1,$2,'[]'::jsonb,'[]'::jsonb) saved",
          [owner, token],
        )
      ).rows[0].saved,
    ).toBe(true);
  };
  const balance = async () =>
    (
      await db.query("select credit_balance from profiles_data where id=$1", [
        owner,
      ])
    ).rows[0].credit_balance;
  const receipt = async () =>
    (await readMobileCreditHistory(reader("service_role"), owner)).items[0];
  await apply(event);
  expect(await balance()).toBe(5);
  expect(await receipt()).toMatchObject({ status: "credited", credits: 5 });
  const generation = "00000000-0000-4000-8000-000000000973";
  expect(
    (
      await db.as(
        "service_role",
        null,
        "select reserve_generation($1,$2,null) ok",
        [generation, owner],
      )
    ).rows[0].ok,
  ).toBe(true);
  await db.as(
    "service_role",
    null,
    "select complete_generation($1,$2::jsonb)",
    [
      generation,
      JSON.stringify({
        image_url: owner + "/synthetic.png",
        vibe: ["Minimal"],
      }),
    ],
  );
  expect(await balance()).toBe(4);
  await apply({ ...event, id: "history-replay" });
  expect(await balance()).toBe(4);
  expect(await receipt()).toMatchObject({ status: "credited", credits: 5 });
  await apply({ ...event, id: "history-refund", type: "CANCELLATION" });
  expect(await balance()).toBe(0);
  expect(await receipt()).toMatchObject({ status: "refunded", credits: 5 });
  await apply({ ...event, id: "history-late-purchase" });
  expect(await balance()).toBe(0);
  expect(await receipt()).toMatchObject({ status: "refunded", credits: 5 });
});
