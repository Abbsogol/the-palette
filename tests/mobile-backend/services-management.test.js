import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createSecurityDatabase } from "../helpers/security-database";
const owner = "00000000-0000-4000-8000-000000000941",
  client = "00000000-0000-4000-8000-000000000942",
  other = "00000000-0000-4000-8000-000000000943",
  id = "00000000-0000-4000-8000-000000000944";
let db;
beforeAll(async () => {
  db = await createSecurityDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("truncate auth.users cascade");
  await db.query("insert into auth.users(id) values($1),($2),($3)", [
    owner,
    client,
    other,
  ]);
  await db.query(
    "update profiles_data set account_type='creator',booking_area='Demo studio' where id=$1",
    [owner],
  );
});
const upsert = (actor, creator = owner) =>
  db.as(
    "authenticated",
    actor,
    "insert into services(id,creator_id,name,duration_minutes,price,deposit_amount,is_active) values($1,$2,'Gel',60,125.50,25.25,true) on conflict(id) do update set name=excluded.name,price=excluded.price,deposit_amount=excluded.deposit_amount returning *",
    [id, creator],
  );
it("the owner can retry a create with the same ID without a duplicate service", async () => {
  await expect(
    db.as(
      "anon",
      null,
      "insert into services(creator_id,name,duration_minutes,price) values($1,'Forbidden',60,100)",
      [owner],
    ),
  ).rejects.toThrow(/row-level security/);
  await upsert(owner);
  const retry = (await upsert(owner)).rows[0];
  expect(Number(retry.price)).toBe(125.5);
  expect(Number(retry.deposit_amount)).toBe(25.25);
  expect(
    (await db.query("select count(*)::int n from services where id=$1", [id]))
      .rows[0].n,
  ).toBe(1);
  for (const actor of [client, other])
    await expect(upsert(actor)).rejects.toThrow(/row-level security/);
  expect(
    (await db.query("select creator_id from services where id=$1", [id]))
      .rows[0].creator_id,
  ).toBe(owner);
});
it("hide removes public discovery, owner edits retain hidden status, and restore makes it public again", async () => {
  await upsert(owner);
  expect(
    (await db.as("anon", null, "select id from services where id=$1", [id]))
      .rows,
  ).toHaveLength(1);
  for (const actor of [client, other])
    expect(
      (
        await db.as(
          "authenticated",
          actor,
          "update services set is_active=false where id=$1 returning id",
          [id],
        )
      ).rows,
    ).toHaveLength(0);
  await db.as(
    "authenticated",
    owner,
    "update services set is_active=false where id=$1",
    [id],
  );
  expect(
    (await db.as("anon", null, "select id from services where id=$1", [id]))
      .rows,
  ).toHaveLength(0);
  expect(
    (
      await db.as(
        "authenticated",
        client,
        "select id from services where id=$1",
        [id],
      )
    ).rows,
  ).toHaveLength(0);
  const edited = (
    await db.as(
      "authenticated",
      owner,
      "update services set name='New gel',price=150,deposit_amount=50 where id=$1 returning *",
      [id],
    )
  ).rows[0];
  expect(edited.is_active).toBe(false);
  expect(Number(edited.price) - Number(edited.deposit_amount)).toBe(100);
  await db.as(
    "authenticated",
    owner,
    "update services set is_active=true where id=$1",
    [id],
  );
  expect(
    (await db.as("anon", null, "select name from services where id=$1", [id]))
      .rows[0].name,
  ).toBe("New gel");
});
it("editing and hiding preserve booking snapshots and prevent new requests for the hidden service", async () => {
  await upsert(owner);
  await db.query(
    "insert into creator_booking_settings(creator_id,time_zone) values($1,'Asia/Dubai')",
    [owner],
  );
  await db.query(
    "insert into availability(creator_id,day_of_week,start_time,end_time) select $1,generate_series(0,6),'00:00'::time,'23:59'::time",
    [owner],
  );
  const booking = (
    await db.as(
      "authenticated",
      client,
      "insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,status) values($1,$2,$3,current_date+2,'10:00','11:00','pending') returning *",
      [client, owner, id],
    )
  ).rows[0];
  await db.as(
    "authenticated",
    owner,
    "update services set price=200,deposit_amount=50,is_active=false where id=$1",
    [id],
  );
  const saved = (
    await db.as("authenticated", client, "select * from bookings where id=$1", [
      booking.id,
    ])
  ).rows[0];
  expect(Number(saved.price_snapshot)).toBe(125.5);
  expect(Number(saved.deposit_snapshot)).toBe(25.25);
  expect(saved.status).toBe("pending");
  await expect(
    db.as(
      "authenticated",
      client,
      "insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,status) values($1,$2,$3,current_date+2,'12:00','13:00','pending')",
      [client, owner, id],
    ),
  ).rejects.toThrow(/INVALID_BOOKING_SERVICE/);
  const checkout = (
    await db.as(
      "service_role",
      null,
      "select reserve_deposit_checkout($1,$2,$3) checkout",
      [client, booking.id, "https://staging.example"],
    )
  ).rows[0].checkout;
  expect(checkout.amount).toBe(2525);
});
