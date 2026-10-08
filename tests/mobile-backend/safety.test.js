import { beforeAll, beforeEach, afterAll, expect, it } from "vitest";
import { createSecurityDatabase } from "../helpers/security-database";
const a = "00000000-0000-4000-8000-000000000801",
  b = "00000000-0000-4000-8000-000000000802",
  c = "00000000-0000-4000-8000-000000000803",
  conversation = "00000000-0000-4000-8000-000000000804",
  installation = "00000000-0000-4000-8000-000000000805";
let db;
beforeAll(async () => {
  db = await createSecurityDatabase();
}, 30000);
afterAll(async () => {
  await db?.close();
});
beforeEach(async () => {
  await db.exec(
    "truncate auth.users,profiles_data,mobile_media_cleanup,storage.objects cascade",
  );
  await db.query("insert into auth.users(id) values($1),($2),($3)", [a, b, c]);
  await db.query(
    "update profiles_data set account_type='creator' where id=$1",
    [b],
  );
  await db.as(
    "authenticated",
    a,
    "insert into conversations(id,client_id,creator_id) values($1,$2,$3)",
    [conversation, a, b],
  );
});
const message = (user = a, extra = "") =>
  db.as(
    "authenticated",
    user,
    `insert into messages(conversation_id,sender_id,content${extra ? ",image_path" : ""}) values($1,$2,'Hello'${extra ? ",$3" : ""}) returning id`,
    extra ? [conversation, user, extra] : [conversation, user],
  );
it("blocked identities stay readable to their blocker, while block rows and unblocking remain owner-only", async () => {
  await db.query(
    "update profiles_data set display_name='Elena',username='elena.nails',avatar_url='https://example.invalid/elena.webp' where id=$1",
    [b],
  );
  const block = (
    await db.as(
      "authenticated",
      a,
      "insert into blocks(blocker_id,blocked_id) values($1,$2) returning id",
      [a, b],
    )
  ).rows[0].id;
  expect(
    (await db.as("authenticated", a, "select id from blocks")).rows,
  ).toEqual([{ id: block }]);
  expect(
    (
      await db.as(
        "authenticated",
        a,
        "select display_name,username,avatar_url from profiles where id=$1",
        [b],
      )
    ).rows,
  ).toEqual([
    {
      display_name: "Elena",
      username: "elena.nails",
      avatar_url: "https://example.invalid/elena.webp",
    },
  ]);
  expect(
    (await db.as("authenticated", c, "select id from blocks")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.as(
        "authenticated",
        c,
        "delete from blocks where id=$1 returning id",
        [block],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.as(
        "authenticated",
        b,
        "delete from blocks where id=$1 returning id",
        [block],
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.as(
        "authenticated",
        a,
        "delete from blocks where id=$1 and blocker_id=$2 returning id",
        [block, a],
      )
    ).rows,
  ).toEqual([{ id: block }]);
});
it("hiding a conversation affects only its participant and a new message unhides the recipient", async () => {
  await db.as(
    "authenticated",
    a,
    "insert into hidden_conversations(user_id,conversation_id) values($1,$2)",
    [a, conversation],
  );
  expect(
    (await db.as("authenticated", b, "select * from hidden_conversations"))
      .rows,
  ).toHaveLength(0);
  await expect(
    db.as(
      "authenticated",
      c,
      "insert into hidden_conversations(user_id,conversation_id) values($1,$2)",
      [c, conversation],
    ),
  ).rejects.toThrow();
  await message(b);
  expect(
    (await db.as("authenticated", a, "select * from hidden_conversations"))
      .rows,
  ).toHaveLength(0);
});
it("blocking prevents new messages at the database boundary", async () => {
  await db.as(
    "authenticated",
    b,
    "insert into blocks(blocker_id,blocked_id) values($1,$2)",
    [b, a],
  );
  await expect(message()).rejects.toThrow();
  expect((await db.query("select * from messages")).rows).toHaveLength(0);
});
it("token transfer removes old queued deliveries without moving their ownership", async () => {
  await db.as(
    "service_role",
    null,
    "select register_mobile_push($1,$2,'ExpoPushToken[token1]','ios')",
    [b, installation],
  );
  await message();
  expect(
    (await db.query("select * from mobile_notification_outbox")).rows,
  ).toHaveLength(1);
  await db.as(
    "service_role",
    null,
    "select register_mobile_push($1,$2,'ExpoPushToken[token1]','ios')",
    [c, installation],
  );
  expect(
    (await db.query("select * from mobile_notification_outbox")).rows,
  ).toHaveLength(0);
  expect(
    (await db.query("select user_id from mobile_push_registrations")).rows,
  ).toEqual([{ user_id: c }]);
  await expect(
    db.as("authenticated", a, "select * from mobile_push_registrations"),
  ).rejects.toThrow(/permission denied/);
});
it("notification claims are exclusive and stale workers cannot acknowledge a newer lease", async () => {
  await db.as(
    "service_role",
    null,
    "select register_mobile_push($1,$2,'ExpoPushToken[token1]','ios')",
    [b, installation],
  );
  await message();
  const jobs = await Promise.all(
    [1, 2].map(() =>
      db.as("service_role", null, "select claim_mobile_notifications(1) jobs"),
    ),
  );
  const claims = jobs.flatMap((r) => r.rows[0].jobs);
  expect(claims).toHaveLength(1);
  const job = claims[0];
  expect(
    (
      await db.as(
        "service_role",
        null,
        "select finish_mobile_notification($1,$2,'delivered',null,null) saved",
        [job.id, c],
      )
    ).rows[0].saved,
  ).toBe(false);
  expect(
    (
      await db.as(
        "service_role",
        null,
        "select finish_mobile_notification($1,$2,'delivered',null,null) saved",
        [job.id, job.claim_token],
      )
    ).rows[0].saved,
  ).toBe(true);
});
it("private message images are readable only by their owner and actual conversation participants", async () => {
  const path = `${a}/messages/${conversation}/image.webp`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('mobile-uploads',$1)",
    [path],
  );
  await message(a, path);
  expect(
    (
      await db.as(
        "authenticated",
        b,
        "select * from storage.objects where bucket_id='mobile-uploads'",
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (
      await db.as(
        "authenticated",
        c,
        "select * from storage.objects where bucket_id='mobile-uploads'",
      )
    ).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.as(
        "anon",
        null,
        "select * from storage.objects where bucket_id='mobile-uploads'",
      )
    ).rows,
  ).toHaveLength(0);
  await expect(message(b, path)).rejects.toThrow("SHARED_IMAGE_UNAVAILABLE");
});
it("an image claimed for deletion cannot race back into a conversation", async () => {
  const path = `${a}/messages/${conversation}/expired.webp`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('mobile-uploads',$1)",
    [path],
  );
  await db.query(
    "insert into mobile_media_cleanup(bucket,path,user_id,run_after) values('mobile-uploads',$1,$2,now()-interval '1 minute')",
    [path, a],
  );
  const jobs = (
    await db.as(
      "service_role",
      null,
      "select claim_mobile_media_cleanup() jobs",
    )
  ).rows[0].jobs;
  expect(jobs).toHaveLength(1);
  await expect(message(a, path)).rejects.toThrow("IMAGE_UPLOAD_EXPIRED");
  expect((await db.query("select * from messages")).rows).toHaveLength(0);
});
it("a photo linked before cleanup is retained", async () => {
  const path = `${a}/messages/${conversation}/attached.webp`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('mobile-uploads',$1)",
    [path],
  );
  await db.query(
    "insert into mobile_media_cleanup(bucket,path,user_id,run_after) values('mobile-uploads',$1,$2,now()-interval '1 minute')",
    [path, a],
  );
  await message(a, path);
  expect(
    (
      await db.as(
        "service_role",
        null,
        "select claim_mobile_media_cleanup() jobs",
      )
    ).rows[0].jobs,
  ).toEqual([]);
});
it("chat mute changes are scoped to the current participant and preserve a concurrent preference", async () => {
  const mute = (user, values, before) =>
    db.as(
      "authenticated",
      user,
      "update conversations set muted_by=$1::uuid[] where id=$2 and muted_by=$3::uuid[] returning muted_by",
      [values, conversation, before],
    );
  expect((await mute(a, [a], [])).rows).toEqual([{ muted_by: [a] }]);
  // The other participant read an old empty value: no lost update is allowed.
  expect((await mute(b, [b], [])).rows).toEqual([]);
  expect((await mute(b, [a, b], [a])).rows).toEqual([{ muted_by: [a, b] }]);
  await expect(mute(a, [], [a, b])).rejects.toThrow(
    /CANNOT_CHANGE_OTHER_USER_MUTE/,
  );
  expect((await mute(a, [b], [a, b])).rows).toEqual([{ muted_by: [b] }]);
  expect((await mute(c, [c], [b])).rows).toEqual([]);
  expect(
    (
      await db.query("select muted_by from conversations where id=$1", [
        conversation,
      ])
    ).rows,
  ).toEqual([{ muted_by: [b] }]);
});
