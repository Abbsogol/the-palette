import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createSecurityDatabase } from "../helpers/security-database";
const client = "00000000-0000-4000-8000-000000000961",
  creator = "00000000-0000-4000-8000-000000000962",
  otherCreator = "00000000-0000-4000-8000-000000000963",
  stranger = "00000000-0000-4000-8000-000000000964",
  service = "00000000-0000-4000-8000-000000000965",
  otherService = "00000000-0000-4000-8000-000000000966";
let db;
beforeAll(async () => {
  db = await createSecurityDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec("truncate auth.users cascade");
  await db.query("insert into auth.users(id) values($1),($2),($3),($4)", [
    client,
    creator,
    otherCreator,
    stranger,
  ]);
  await db.query(
    "update profiles_data set account_type='creator',display_name='Nail Artist',username=case when id=$1 then 'artist' else 'other_artist' end,avatar_url='https://example.invalid/avatar',booking_area='Demo studio' where id in($1,$2)",
    [creator, otherCreator],
  );
  await db.query(
    "insert into services(id,creator_id,name,duration_minutes,price,deposit_amount) values($1,$2,'Manicure',60,125,25),($3,$4,'Gel',60,200,40)",
    [service, creator, otherService, otherCreator],
  );
  for (const [status, day, zone] of [
    ["pending", 2, "Asia/Dubai"],
    ["confirmed", 3, "Asia/Dubai"],
    ["pending", -3, "Asia/Dubai"],
    ["confirmed", -2, "Asia/Dubai"],
    ["cancelled", 4, "Asia/Dubai"],
    ["declined", 5, "Asia/Dubai"],
    ["confirmed", -5, null],
  ])
    await db.query(
      "insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,status,time_zone) values($1,$2,$3,current_date+$4::int,'10:00','11:00',$5,$6)",
      [client, creator, service, day, status, zone],
    );
  await db.query(
    "insert into bookings(client_id,creator_id,service_id,booking_date,start_time,end_time,status,time_zone) values($1,$2,$3,current_date+6,'10:00','11:00','pending','UTC')",
    [creator, otherCreator, otherService],
  );
});
const list = (actor, side, filter) => {
  const clause =
    filter === "Requests"
      ? "status='pending' and (ends_at>=now() or ends_at is null)"
      : filter === "Upcoming"
        ? "status='confirmed' and (ends_at>=now() or ends_at is null)"
        : filter === "Past"
          ? "status in('pending','confirmed') and ends_at<now()"
          : "status in('cancelled','declined')";
  const column = side === "customer" ? "client_id" : "creator_id";
  return db.as(
    "authenticated",
    actor,
    `select * from bookings where ${column}=$1 and ${clause} order by starts_at asc nulls last,booking_date,start_time,id`,
    [actor],
  );
};
it.each([
  ["customer", client],
  ["creator", creator],
])(
  "permitted %s list separates requests, confirmed visits, expired pending and terminal appointments",
  async (side, actor) => {
    const requests = (await list(actor, side, "Requests")).rows,
      upcoming = (await list(actor, side, "Upcoming")).rows,
      past = (await list(actor, side, "Past")).rows,
      cancelled = (await list(actor, side, "Cancelled")).rows;
    expect(requests).toHaveLength(1);
    expect(requests[0].status).toBe("pending");
    expect(upcoming).toHaveLength(2);
    expect(upcoming.every((b) => b.status === "confirmed")).toBe(true);
    expect(upcoming.at(-1).starts_at).toBeNull();
    expect(past.map((b) => b.status)).toEqual(["pending", "confirmed"]);
    expect(cancelled.map((b) => b.status)).toEqual(["cancelled", "declined"]);
    expect(
      new Set(
        [...requests, ...upcoming, ...past, ...cancelled].map((b) => b.id),
      ).size,
    ).toBe(7);
  },
);
it("a creator who also books services keeps personal requests separate from client requests", async () => {
  const personal = (await list(creator, "customer", "Requests")).rows,
    clients = (await list(creator, "creator", "Requests")).rows;
  expect(personal).toHaveLength(1);
  expect(personal[0].creator_id).toBe(otherCreator);
  expect(clients).toHaveLength(1);
  expect(clients[0].client_id).toBe(client);
  expect(personal[0].id).not.toBe(clients[0].id);
});
it("anonymous and stranger list reads cannot expose another participant, including forged owner filters", async () => {
  for (const [role, actor] of [
    ["anon", null],
    ["authenticated", stranger],
  ]) {
    expect(
      (await db.as(role, actor, "select * from bookings")).rows,
    ).toHaveLength(0);
    expect(
      (
        await db.as(
          role,
          actor,
          "select * from bookings where client_id=$1 or creator_id=$2",
          [client, creator],
        )
      ).rows,
    ).toHaveLength(0);
  }
});
it("hidden services do not remove bookings or rewrite their recorded price, deposit, location or zone", async () => {
  const before = (await list(client, "customer", "Requests")).rows[0];
  await db.as(
    "authenticated",
    creator,
    "update services set is_active=false,price=999,deposit_amount=500 where id=$1",
    [service],
  );
  const after = (
    await db.as(
      "authenticated",
      client,
      "select b.*,s.name from bookings b left join services s on b.service_id=s.id where b.id=$1",
      [before.id],
    )
  ).rows[0];
  expect(after.name).toBeNull();
  expect(Number(after.price_snapshot)).toBe(125);
  expect(Number(after.deposit_snapshot)).toBe(25);
  expect(after.location_snapshot).toBe("Demo studio");
  expect(after.time_zone).toBe("Asia/Dubai");
});
it("creator acceptance moves a request into Upcoming and client cancellation moves it into Cancelled", async () => {
  const b = (await list(client, "customer", "Requests")).rows[0];
  await db.as(
    "authenticated",
    creator,
    "update bookings set status='confirmed' where id=$1",
    [b.id],
  );
  expect((await list(client, "customer", "Requests")).rows).toHaveLength(0);
  expect(
    (await list(client, "customer", "Upcoming")).rows.some(
      (v) => v.id === b.id,
    ),
  ).toBe(true);
  await db.as(
    "authenticated",
    client,
    "update bookings set status='cancelled' where id=$1",
    [b.id],
  );
  expect(
    (await list(creator, "creator", "Upcoming")).rows.some(
      (v) => v.id === b.id,
    ),
  ).toBe(false);
  expect(
    (await list(creator, "creator", "Cancelled")).rows.some(
      (v) => v.id === b.id,
    ),
  ).toBe(true);
});
