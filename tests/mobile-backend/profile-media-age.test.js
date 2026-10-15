import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { createSecurityDatabase } from "../helpers/security-database";
const owner = "00000000-0000-4000-8000-000000000941",
  other = "00000000-0000-4000-8000-000000000942";
const url = (path) =>
  `https://test.supabase.co/storage/v1/object/public/designs/${path}`;
let db;
beforeAll(async () => {
  db = await createSecurityDatabase();
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => {
  await db.exec(
    "truncate auth.users,profiles_data,storage.objects,mobile_media_cleanup cascade",
  );
  await db.query("insert into auth.users(id) values($1),($2)", [owner, other]);
});
const finish = (fields, user = owner, role = "service_role") =>
  db.as(
    role,
    role === "authenticated" ? user : null,
    "select complete_onboarding($1,$2) as completed",
    [user, fields],
  );
const consent = {
  display_name: "Sarah",
  age_confirmed: true,
  privacy_accepted: true,
};
it("service-owned tag edits persist and are visible through the public profile while direct client writes remain forbidden", async()=>{
  await db.as("service_role",null,"update profiles_data set specialties=$1 where id=$2",[["Chrome","Minimal"],owner]);
  for(const [role,user] of [["anon",null],["authenticated",owner],["authenticated",other]]) {
    expect((await db.as(role,user,"select specialties from profiles where id=$1",[owner])).rows[0].specialties).toEqual(["Chrome","Minimal"]);
  }
  await expect(db.as("authenticated",other,"update profiles_data set specialties=$1 where id=$2",[["Forged"],owner])).rejects.toThrow(/permission denied/);
  await expect(db.as("authenticated",owner,"update profiles_data set specialties=$1 where id=$2",[["Direct"],owner])).rejects.toThrow(/permission denied/);
  expect((await db.query("select specialties from profiles_data where id=$1",[owner])).rows[0].specialties).toEqual(["Chrome","Minimal"]);
});
async function media(folder = "avatars", user = owner, name = "image.webp") {
  const path = `${folder}/${user}/${name}`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('designs',$1)",
    [path],
  );
  await db.query(
    "insert into mobile_media_cleanup(bucket,path,user_id) values('designs',$1,$2)",
    [path, user],
  );
  return path;
}
it("links owned avatar and banner; removing one cleans only that image", async () => {
  const avatar = await media(),
    banner = await media("banners");
  await db.query(
    "update profiles_data set avatar_url=$1,banner_url=$2 where id=$3",
    [url(avatar), url(banner), owner],
  );
  await db.query(
    "update mobile_media_cleanup set state='pending',run_after=now()-interval '1 day'",
  );
  expect(
    (
      await db.as(
        "service_role",
        null,
        "select claim_mobile_media_cleanup() as jobs",
      )
    ).rows[0].jobs,
  ).toEqual([]);
  await db.query("update profiles_data set avatar_url=null where id=$1", [
    owner,
  ]);
  await db.query(
    "update mobile_media_cleanup set run_after=now()-interval '1 minute'",
  );
  expect(
    (
      await db.as(
        "service_role",
        null,
        "select claim_mobile_media_cleanup() as jobs",
      )
    ).rows[0].jobs,
  ).toEqual([expect.objectContaining({ path: avatar, bucket: "designs" })]);
  expect(
    (
      await db.query(
        "select avatar_url,banner_url from profiles_data where id=$1",
        [owner],
      )
    ).rows[0],
  ).toEqual({ avatar_url: null, banner_url: url(banner) });
});
it("refuses foreign, missing and already-claimed media without replacing a profile image", async () => {
  const foreign = await media("avatars", other),
    own = await media();
  await expect(
    db.query("update profiles_data set avatar_url=$1 where id=$2", [
      url(foreign),
      owner,
    ]),
  ).rejects.toThrow("PROFILE_MEDIA_OWNER_REQUIRED");
  await expect(
    db.query("update profiles_data set avatar_url=$1 where id=$2", [
      url(`avatars/${owner}/missing.webp`),
      owner,
    ]),
  ).rejects.toThrow("PROFILE_MEDIA_UNAVAILABLE");
  await db.query(
    "update mobile_media_cleanup set state='deleting' where path=$1",
    [own],
  );
  await expect(
    db.query("update profiles_data set avatar_url=$1 where id=$2", [
      url(own),
      owner,
    ]),
  ).rejects.toThrow("PROFILE_MEDIA_UNAVAILABLE");
  expect(
    (
      await db.query("select avatar_url from profiles_data where id=$1", [
        owner,
      ])
    ).rows[0].avatar_url,
  ).toBeNull();
});
it("account closure clears its banner and retains a durable storage cleanup obligation", async () => {
  const banner = await media("banners");
  await db.query("update profiles_data set banner_url=$1 where id=$2", [
    url(banner),
    owner,
  ]);
  await db.as("service_role", null, "select close_account($1)", [owner]);
  expect(
    (
      await db.query("select banner_url from profiles_data where id=$1", [
        owner,
      ])
    ).rows[0].banner_url,
  ).toBeNull();
  expect(
    (
      await db.as(
        "service_role",
        null,
        "select * from account_storage_objects($1)",
        [owner],
      )
    ).rows,
  ).toContainEqual({ bucket_id: "designs", name: banner });
});
it.each([
  {},
  { age_confirmed: false, privacy_accepted: true },
  { age_confirmed: true, privacy_accepted: false },
  { age_confirmed: "true", privacy_accepted: true },
])(
  "rejects incomplete or non-boolean eligibility %j without granting credits",
  async (fields) => {
    const before = (
      await db.query("select credit_balance from profiles_data where id=$1", [
        owner,
      ])
    ).rows[0];
    await expect(finish(fields)).rejects.toThrow(
      "AGE_AND_PRIVACY_CONFIRMATION_REQUIRED",
    );
    expect(
      (
        await db.query(
          "select credit_balance,onboarding_complete,age_confirmed_at from profiles_data where id=$1",
          [owner],
        )
      ).rows[0],
    ).toEqual({
      ...before,
      onboarding_complete: false,
      age_confirmed_at: null,
    });
  },
);
it("concurrent completions award credits once, record server timestamps and keep those timestamps on retry", async () => {
  const before = (
    await db.query("select credit_balance from profiles_data where id=$1", [
      owner,
    ])
  ).rows[0].credit_balance;
  const results = await Promise.all([finish(consent), finish(consent)]);
  expect(results.map((r) => r.rows[0].completed).sort()).toEqual([false, true]);
  const record = (
    await db.query(
      "select credit_balance,age_confirmed_at,privacy_accepted_at,privacy_policy_version from profiles_data where id=$1",
      [owner],
    )
  ).rows[0];
  expect(record.credit_balance).toBe(before + 3);
  expect(record.age_confirmed_at).toBeTruthy();
  expect(record.privacy_accepted_at).toBeTruthy();
  expect(record.privacy_policy_version).toBe("2026-09-29");
  await finish({});
  expect(
    (
      await db.query("select age_confirmed_at from profiles_data where id=$1", [
        owner,
      ])
    ).rows[0].age_confirmed_at,
  ).toEqual(record.age_confirmed_at);
});
it("keeps attestations private and prevents clients from writing them or invoking privileged onboarding", async () => {
  await finish(consent);
  await expect(finish(consent, other, "authenticated")).rejects.toThrow(
    /permission denied/,
  );
  await expect(
    db.as(
      "authenticated",
      owner,
      "select complete_onboarding_before_age_policy($1,$2)",
      [owner, {}],
    ),
  ).rejects.toThrow(/permission denied/);
  await expect(
    db.as(
      "authenticated",
      owner,
      "update profiles_data set age_confirmed_at=now() where id=$1",
      [other],
    ),
  ).rejects.toThrow();
  const profile = (
    await db.as("authenticated", other, "select * from profiles where id=$1", [
      owner,
    ])
  ).rows[0];
  expect(profile).toHaveProperty("banner_url");
  expect(profile).not.toHaveProperty("age_confirmed_at");
  expect(profile).not.toHaveProperty("privacy_accepted_at");
});
