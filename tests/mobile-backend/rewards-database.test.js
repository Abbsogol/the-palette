import { beforeAll, afterAll, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { createSecurityDatabase } from "../helpers/security-database";
let db;
const [owner, moderator, support, user, voter, turkey] = Array.from(
  { length: 6 },
  (_, i) => `00000000-0000-4000-8000-000000000${810 + i}`,
);
const call = (sql, args = []) => db.as("service_role", null, sql, args);
const scalar = async (sql, args = []) =>
  Object.values((await call(sql, args)).rows[0])[0];
const change = (section, id, action, version, data = {}, actor = owner) =>
  scalar("select rewards_admin_change($1,$2,$3,$4,$5,$6,$7)", [
    actor,
    section,
    id,
    action,
    version,
    "Test operation reason",
    data,
  ]);
const read = (who, section = "campaigns", id = null) =>
  scalar("select rewards_member_read($1,$2,$3,0,null)", [who, section, id]);
const act = (who, id, action, data) =>
  scalar("select rewards_member_action($1,$2,$3,$4)", [who, id, action, data]);
const draft = {
  title: "India nail challenge",
  theme: "Minimal",
  description: "Support designers",
  prizeType: "cash",
  prizeLabel: "$2,000",
  rules: "Official published rules: three designs maximum and no self-voting.",
  countryCodes: ["IN"],
  opensAt: "2026-01-01T00:00:00Z",
  entriesCloseAt: "2030-01-01T00:00:00Z",
  votesCloseAt: "2030-01-02T00:00:00Z",
  awardAt: "2030-01-03T00:00:00Z",
  winnerCount: 1,
};
let campaign,
  news,
  designs = [];
beforeAll(async () => {
  db = await createSecurityDatabase();
  await db.exec(
    "alter table auth.users add column email text,add column email_confirmed_at timestamptz",
  );
  for (const n of [
    "202610080027_pinterest_budget.sql",
    "202610080028_pinterest_budget_recovery.sql",
    "202610080029_pinterest_pilot_allowance.sql",
    "202610080030_admin_operations.sql",
    "202610080035_lab_subscription.sql",
    "202610080036_lab_play_base_plan.sql",
    "202610080037_members_only_app.sql",
    "202610090038_rewards_updates.sql",
    "202610090039_rewards_home_feed.sql",
  ])
    await db.exec(
      await readFile(
        new URL("../../supabase/migrations/" + n, import.meta.url),
        "utf8",
      ),
    );
  for (const id of [owner, moderator, support, user, voter, turkey]) {
    await db.query(
      "insert into auth.users(id,email_confirmed_at) values($1,now())",
      [id],
    );
    await db.query(
      "update profiles_data set display_name='Designer',username=$2,location='City',onboarding_complete=true,age_confirmed_at=now(),privacy_accepted_at=now(),country_code='IN',is_private=false where id=$1",
      [id, "user" + id.slice(-3)],
    );
  }
  await db.query("update profiles_data set country_code='TR' where id=$1", [
    turkey,
  ]);
  await db.query(
    "insert into admin_staff(user_id,role) values($1,'owner'),($2,'moderator'),($3,'support')",
    [owner, moderator, support],
  );
  campaign = await change("rewards", null, "save", 0, draft);
  news = await change("updates", null, "save", 0, {
    title: "Official news",
    body: "Regional news",
    countryCodes: ["IN"],
  });
  await db.query(
    "insert into mobile_entitlements(user_id,store,product_id,plan_id,expires_at,refunded) values($1,'APP_STORE','laque_lab_monthly_5','premium',now()+interval '30 days',false)",
    [user],
  );
  await db.query(
    "insert into lab_monthly_allowances(user_id,store,product_id,period_start,period_end) values($1,'APP_STORE','laque_lab_monthly_5',now()-interval '1 day',now()+interval '30 days')",
    [user],
  );
  for (let i = 0; i < 4; i++) {
    const gen = crypto.randomUUID(),
      design = crypto.randomUUID();
    await db.query(
      "insert into nail_lab_generations(id,user_id,image_url,shape,length) values($1,$2,$3,'Almond','Long')",
      [
        gen,
        user,
        `https://beta.supabase.co/storage/v1/object/public/nail-lab/${user}/${gen}.png`,
      ],
    );
    await db.query(
      "insert into generation_reservations(id,user_id,status) values($1,$2,'completed')",
      [gen, user],
    );
    await db.query(
      "insert into designs(id,created_by,source_generation_id,title,shape,length,is_published,image_url) values($1,$2,$3,'Lab nails','Almond','Long',true,$4)",
      [
        design,
        user,
        gen,
        `https://beta.supabase.co/storage/v1/object/public/nail-lab/${user}/${gen}.png`,
      ],
    );
    designs.push(design);
  }
}, 30000);
afterAll(() => db?.close());
it("keeps all operational tables and functions service-only", async () => {
  for (const role of ["anon", "authenticated"]) {
    await expect(db.as(role,user,"select rewards_home_entries($1,0)",[user])).rejects.toThrow(/permission denied/);
    await expect(
      db.as(role, user, "select * from reward_campaigns"),
    ).rejects.toThrow(/permission denied/);
    await expect(
      db.as(role, user, "select rewards_member_read($1,$2,null,0,null)", [
        user,
        "campaigns",
      ]),
    ).rejects.toThrow(/permission denied/);
  }
  await expect(
    db.as(
      "authenticated",
      user,
      "update profiles_data set country_code='TR' where id=$1",
      [user],
    ),
  ).rejects.toThrow(/permission denied/);
});
it("only assigned publishers can manage official news and competitions; revocation is immediate", async () => {
  await expect(
    change(
      "updates",
      null,
      "save",
      0,
      { title: "No", body: "No", countryCodes: [] },
      user,
    ),
  ).rejects.toThrow(/FORBIDDEN/);
  await expect(
    change(
      "updates",
      null,
      "save",
      0,
      { title: "No", body: "No", countryCodes: [] },
      support,
    ),
  ).rejects.toThrow(/FORBIDDEN/);
  await db.query("update admin_staff set active=false where user_id=$1", [
    moderator,
  ]);
  await expect(
    change(
      "updates",
      null,
      "save",
      0,
      { title: "No", body: "No", countryCodes: [] },
      moderator,
    ),
  ).rejects.toThrow(/FORBIDDEN/);
  await db.query("update admin_staff set active=true where user_id=$1", [
    moderator,
  ]);
});
it("drafts stay private; regional news requires explicit publication and rejects stale edits", async () => {
  expect((await read(user, "updates")).items).toEqual([]);
  news = await change(
    "updates",
    news.id,
    "publish",
    news.version,
    {},
    moderator,
  );
  expect((await read(user, "updates")).items).toHaveLength(1);
  expect((await read(turkey, "updates")).items).toEqual([]);
  await expect(change("updates", news.id, "archive", 1)).rejects.toThrow(
    /CONFLICT/,
  );
  expect(
    (
      await db.query(
        "select count(*)::int n from admin_actions where action='updates-publish'",
      )
    ).rows[0].n,
  ).toBe(1);
});
it("requires Owner review and separate activation; regional direct links cannot bypass targeting", async () => {
  expect((await read(user)).items).toEqual([]);
  await expect(
    change("rewards", campaign.id, "publish", campaign.version),
  ).rejects.toThrow(/DISABLED/);
  await expect(
    change(
      "rewards",
      campaign.id,
      "review",
      campaign.version,
      { reference: "Review evidence for fixture" },
      moderator,
    ),
  ).rejects.toThrow(/REVIEW/);
  campaign = await change("rewards", campaign.id, "review", campaign.version, {
    reference: "Synthetic fixture approval only",
  });
  await expect(
    change("rewards", campaign.id, "publish", campaign.version),
  ).rejects.toThrow(/DISABLED/);
  await db.query("update reward_settings set activation_enabled=true");
  campaign = await change("rewards", campaign.id, "publish", campaign.version);
  expect((await read(user)).items).toHaveLength(1);
  expect((await read(turkey)).items).toEqual([]);
  await expect(read(turkey, "campaigns", campaign.id)).rejects.toThrow(
    /UNAVAILABLE/,
  );
  await expect(
    act(turkey, campaign.id, "vote", {
      entryId: crypto.randomUUID(),
      liked: true,
    }),
  ).rejects.toThrow(/UNAVAILABLE/);
});
it("rejects uploaded, unconfirmed or foreign generations and locks published rules", async () => {
  const badDesign = crypto.randomUUID(),
    gen = crypto.randomUUID();
  await db.query(
    "insert into designs(id,created_by,title,shape,length,is_published) values($1,$2,'Upload','Almond','Long',true)",
    [badDesign, user],
  );
  const submit = (designId) =>
    act(user, campaign.id, "submit", {
      designId,
      acceptedRules: true,
      rulesVersion: campaign.version,
    });
  await expect(submit(badDesign)).rejects.toThrow(
    /PUBLISHED_LAB_DESIGN_REQUIRED/,
  );
  await db.query(
    "insert into nail_lab_generations(id,user_id,image_url) values($1,$2,'https://beta.invalid/original.png')",
    [gen, user],
  );
  await db.query("update designs set source_generation_id=$2 where id=$1", [
    badDesign,
    gen,
  ]);
  await expect(submit(badDesign)).rejects.toThrow(
    /CONFIRMED_GENERATION_REQUIRED/,
  );
  await db.query(
    "insert into generation_reservations(id,user_id,status) values($1,$2,'completed')",
    [gen, user],
  );
  await db.query("update nail_lab_generations set user_id=$2 where id=$1", [
    gen,
    voter,
  ]);
  await expect(submit(badDesign)).rejects.toThrow(
    /CONFIRMED_GENERATION_REQUIRED/,
  );
  await db.query("delete from designs where id=$1", [badDesign]);
  await expect(
    change("rewards", campaign.id, "save", campaign.version, {
      ...draft,
      countryCodes: ["TR"],
    }),
  ).rejects.toThrow(/DRAFT_REQUIRED/);
});
it("requires subscription and completed public profile, enforces three entries and lost-response replay without spending credits", async () => {
  await expect(
    act(voter, campaign.id, "submit", {
      designId: designs[0],
      acceptedRules: true,
      rulesVersion: campaign.version,
    }),
  ).rejects.toThrow(/SUBSCRIPTION/);
  await db.query("update profiles_data set is_private=true where id=$1", [
    user,
  ]);
  await expect(
    act(user, campaign.id, "submit", {
      designId: designs[0],
      acceptedRules: true,
      rulesVersion: campaign.version,
    }),
  ).rejects.toThrow(/PROFILE/);
  await db.query("update profiles_data set is_private=false where id=$1", [
    user,
  ]);
  await expect(
    act(user, campaign.id, "submit", {
      designId: designs[0],
      acceptedRules: true,
      rulesVersion: 1,
    }),
  ).rejects.toThrow(/RULES/);
  const before = await scalar("select lab_subscription_status($1)", [user]);
  const enter = (designId) =>
    act(user, campaign.id, "submit", {
      designId,
      acceptedRules: true,
      rulesVersion: campaign.version,
    });
  await Promise.all([
    enter(designs[0]),
    enter(designs[0]),
    enter(designs[1]),
    enter(designs[2]),
  ]);
  await expect(enter(designs[3])).rejects.toThrow(/LIMIT/);
  expect(await scalar("select lab_subscription_status($1)", [user])).toEqual(
    before,
  );
  expect((await read(user, "campaigns", campaign.id)).myEntries).toHaveLength(
    3,
  );
  await expect(
    scalar("select reward_profile_country($1,$2)", [user, "TR"]),
  ).rejects.toThrow(/LOCKED/);
  await expect(
    db.query("update designs set title='Changed' where id=$1", [designs[0]]),
  ).rejects.toThrow(/LOCKED/);
});
it("Home shows newly submitted entries without a second publication, with regional/privacy checks and deterministic pagination", async () => {
  const home=(who,offset=0)=>scalar("select rewards_home_entries($1,$2)",[who,offset]);
  const original=await home(voter);
  expect(original.items).toHaveLength(3);
  expect((await home(turkey)).items).toHaveLength(0);
  expect((await home(voter,2)).items).toHaveLength(1);
  expect(original).not.toHaveProperty("candidates");
  const newest=original.items[0].id;
  await db.query("update reward_entries set created_at=now()+interval '1 second' where id=$1",[newest]);
  expect((await home(voter)).items[0].id).toBe(newest);
  await db.query("update profiles_data set is_private=true where id=$1",[user]);
  expect((await home(voter)).items).toHaveLength(0);
  await db.query("update profiles_data set is_private=false where id=$1",[user]);
  await db.query("insert into blocks(blocker_id,blocked_id) values($1,$2)",[voter,user]);
  expect((await home(voter)).items).toHaveLength(0);
  await db.query("delete from blocks where blocker_id=$1 and blocked_id=$2",[voter,user]);
  expect((await home(voter)).items).toHaveLength(3);
});
it("votes are separate, idempotent and free to verified non-subscribers; self-votes and hidden entries are rejected", async () => {
  const entry = (await read(voter, "campaigns", campaign.id)).items[0];
  await expect(
    act(user, campaign.id, "vote", { entryId: entry.id, liked: true }),
  ).rejects.toThrow(/SELF/);
  await Promise.all([
    act(voter, campaign.id, "vote", { entryId: entry.id, liked: true }),
    act(voter, campaign.id, "vote", { entryId: entry.id, liked: true }),
  ]);
  expect(
    (await read(voter, "campaigns", campaign.id)).items.find(
      (e) => e.id === entry.id,
    ),
  ).toMatchObject({ votes: 1, liked: true });
  await db.query(
    "insert into admin_moderation(target_type,target_id,hidden) values('design',$1,true)",
    [entry.design_id],
  );
  expect(
    (await read(voter, "campaigns", campaign.id)).items.some(
      (e) => e.id === entry.id,
    ),
  ).toBe(false);
  await expect(
    act(voter, campaign.id, "vote", { entryId: entry.id, liked: true }),
  ).rejects.toThrow(/UNAVAILABLE/);
  await db.query("delete from admin_moderation where target_id=$1", [
    entry.design_id,
  ]);
});
it("admin pause, disqualification and restoration change availability while consumed slots remain", async () => {
  const entry = (await read(voter, "campaigns", campaign.id)).items[0];
  campaign = await change(
    "rewards",
    campaign.id,
    "pause",
    campaign.version,
    {},
    moderator,
  );
  await expect(
    act(voter, campaign.id, "vote", { entryId: entry.id, liked: true }),
  ).rejects.toThrow(/CAMPAIGN_UNAVAILABLE/);
  campaign = await change(
    "rewards",
    campaign.id,
    "disqualify",
    campaign.version,
    { entryId: entry.id },
    moderator,
  );
  expect(
    (await read(voter, "campaigns", campaign.id)).items.some(
      (e) => e.id === entry.id,
    ),
  ).toBe(false);
  expect((await read(user, "campaigns", campaign.id)).myEntries).toHaveLength(
    3,
  );
  campaign = await change(
    "rewards",
    campaign.id,
    "restore-entry",
    campaign.version,
    { entryId: entry.id },
    moderator,
  );
  campaign = await change(
    "rewards",
    campaign.id,
    "resume",
    campaign.version,
    {},
    moderator,
  );
  expect(
    (await read(voter, "campaigns", campaign.id)).items.some(
      (e) => e.id === entry.id,
    ),
  ).toBe(true);
});
it("admin review includes submitted designs and vote diagnostics, without exposing private Lab images", async () => {
  const review = () =>
    scalar("select rewards_admin_entries($1,$2,0)", [moderator, campaign.id]);
  expect((await review())[0].snapshot.image_url).toBeTruthy();
  await expect(
    scalar("select rewards_admin_entries($1,$2,0)", [support, campaign.id]),
  ).rejects.toThrow(/ADMIN_FORBIDDEN/);
  await db.query("update profiles_data set is_private=true where id=$1", [
    user,
  ]);
  expect((await review()).every((e) => !e.snapshot.image_url)).toBe(true);
  await db.query("update profiles_data set is_private=false where id=$1", [
    user,
  ]);
});
it("closing freezes results, excludes suspended voters and limits wins per person; promotion expires after 30 days", async () => {
  await db.query(
    "update reward_campaigns set opens_at=now()-interval '3 days',entries_close_at=now()-interval '2 days',votes_close_at=now()-interval '1 day' where id=$1",
    [campaign.id],
  );
  await expect(
    act(voter, campaign.id, "vote", {
      entryId: (await read(voter, "campaigns", campaign.id)).items[0].id,
      liked: true,
    }),
  ).rejects.toThrow(/CLOSED/);
  await db.query(
    "insert into admin_suspensions(user_id,suspended) values($1,true)",
    [voter],
  );
  campaign = await change("rewards", campaign.id, "results", campaign.version);
  const feed = await read(user);
  expect(feed.winners).toHaveLength(1);
  expect(feed.winners[0].votes).toBe(0);
  expect(
    (
      await db.query("select * from reward_results where campaign_id=$1", [
        campaign.id,
      ])
    ).rows,
  ).toHaveLength(1);
  await db.query(
    "update reward_campaigns set results_at=now()-interval '31 days' where id=$1",
    [campaign.id],
  );
  expect((await read(user)).winners).toHaveLength(0);
});

it("closure removes competition personal snapshots and voting records without blocking deletion", async () => {
  await db.query(
    "update profiles_data set deletion_started_at=now() where id=$1",
    [user],
  );
  const closed = (
    await db.query(
      "select user_id,design_id,generation_id,country_code,snapshot from reward_entries where campaign_id=$1",
      [campaign.id],
    )
  ).rows;
  expect(closed).toHaveLength(3);
  expect(
    closed.every(
      (e) =>
        e.user_id === null &&
        e.design_id === null &&
        e.generation_id === null &&
        e.country_code === null &&
        JSON.stringify(e.snapshot) === "{}",
    ),
  ).toBe(true);
  expect((await read(turkey)).winners).toHaveLength(0);
  expect(
    (
      await db.query("select country_code from profiles_data where id=$1", [
        user,
      ])
    ).rows[0].country_code,
  ).toBe(null);
});
