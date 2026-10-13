import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
import { createSecurityDatabase } from "../helpers/security-database";
const owner = "00000000-0000-4000-8000-000000000881";
const sender = "00000000-0000-4000-8000-000000000882";
const stranger = "00000000-0000-4000-8000-000000000883";
const conversation = "00000000-0000-4000-8000-000000000884";
const installation = "00000000-0000-4000-8000-000000000885";
let db;
beforeAll(async () => {
  db = await createSecurityDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "truncate auth.users, profiles_data, mobile_media_cleanup, storage.objects cascade",
  );
  await db.query("insert into auth.users(id) values($1),($2),($3)", [
    owner,
    sender,
    stranger,
  ]);
  await db.query(
    "update profiles_data set account_type='creator' where id=$1",
    [sender],
  );
  await db.as(
    "authenticated",
    owner,
    "insert into conversations(id,client_id,creator_id) values($1,$2,$3)",
    [conversation, owner, sender],
  );
});
it("a real message creates owned activity; only that recipient can read and toggle it", async () => {
  await db.as(
    "authenticated",
    sender,
    "insert into messages(conversation_id,sender_id,content) values($1,$2,'Synthetic message')",
    [conversation, sender],
  );
  const rows = (
    await db.as(
      "authenticated",
      owner,
      "select id,type,read from notifications",
    )
  ).rows;
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({ type: "new_message", read: false });
  for (const role of ["anon", "authenticated"]) {
    expect(
      (await db.as(role, stranger, "select id from notifications")).rows,
    ).toHaveLength(0);
    if (role === "anon") {
      await expect(
        db.as(
          role,
          stranger,
          "update notifications set read=true where id=$1 returning id",
          [rows[0].id],
        ),
      ).rejects.toThrow(/permission denied/);
    } else {
      expect(
        (
          await db.as(
            role,
            stranger,
            "update notifications set read=true where id=$1 returning id",
            [rows[0].id],
          )
        ).rows,
      ).toHaveLength(0);
    }
  }
  expect(
    (
      await db.as(
        "authenticated",
        owner,
        "update notifications set read=true where id=$1 returning read",
        [rows[0].id],
      )
    ).rows,
  ).toEqual([{ read: true }]);
  expect(
    (await db.query("select read from notifications where id=$1", [rows[0].id]))
      .rows,
  ).toEqual([{ read: true }]);
  expect(
    (
      await db.as(
        "authenticated",
        owner,
        "update notifications set read=false where id=$1 returning read",
        [rows[0].id],
      )
    ).rows,
  ).toEqual([{ read: false }]);
  await expect(
    db.as(
      "authenticated",
      stranger,
      "insert into notifications(user_id,actor_id,type) values($1,$2,'new_message')",
      [owner, stranger],
    ),
  ).rejects.toThrow(/permission denied/);
});
it("device registration is service-only and transfers do not expose another owner status", async () => {
  const register = (user) =>
    db.as(
      "service_role",
      null,
      "select register_mobile_push($1,$2,'ExpoPushToken[fixture]','ios')",
      [user, installation],
    );
  const status = (user) =>
    db.as(
      "service_role",
      null,
      "select enabled,expires_at from mobile_push_registrations where user_id=$1 and installation_id=$2",
      [user, installation],
    );
  await register(owner);
  expect((await status(owner)).rows[0].enabled).toBe(true);
  expect((await status(stranger)).rows).toEqual([]);
  for (const role of ["anon", "authenticated"])
    await expect(
      db.as(
        role,
        owner,
        "select enabled,expires_at from mobile_push_registrations",
      ),
    ).rejects.toThrow(/permission denied/);
  await register(stranger);
  expect((await status(owner)).rows).toEqual([]);
  expect((await status(stranger)).rows[0].enabled).toBe(true);
  expect(
    (
      await db.as(
        "service_role",
        null,
        "delete from mobile_push_registrations where user_id=$1 and installation_id=$2 returning user_id",
        [owner, installation],
      )
    ).rows,
  ).toEqual([]);
  expect((await status(stranger)).rows[0].enabled).toBe(true);
});
