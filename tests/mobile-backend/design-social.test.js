import { beforeAll, beforeEach, afterAll, it, expect } from "vitest";
import { createSecurityDatabase } from "../helpers/security-database";
import { validateDesignDetails } from "@/lib/design-details";
const owner = "00000000-0000-4000-8000-000000000931",
  tech = "00000000-0000-4000-8000-000000000932",
  stranger = "00000000-0000-4000-8000-000000000933",
  design = "00000000-0000-4000-8000-000000000934",
  conversation = "00000000-0000-4000-8000-000000000935",
  message = "00000000-0000-4000-8000-000000000936",
  post = "00000000-0000-4000-8000-000000000937";
const path = `${owner}/clip.mp4`,
  url = `https://test.supabase.co/storage/v1/object/public/mobile-uploads/${owner}/designs/cover.webp`;
let db;
beforeAll(async () => {
  db = await createSecurityDatabase();
}, 30000);
afterAll(async () => db?.close());
beforeEach(async () => {
  await db.exec(
    "truncate auth.users,profiles_data,designs,storage.objects,mobile_media_cleanup cascade",
  );
  await db.query("insert into auth.users(id) values($1),($2),($3)", [
    owner,
    tech,
    stranger,
  ]);
  await db.query(
    "update profiles_data set username=case when id=$1 then 'nail.lover' when id=$2 then 'my_tech' else 'someone.else' end, display_name='A member', message_permission='everyone'",
    [owner, tech],
  );
  await db.query(
    "insert into conversations(id,client_id,creator_id) values($1,$2,$3)",
    [conversation, owner, tech],
  );
});
const fields = {
  title: "Cathedral",
  description: "Ivory with sculpted arches",
  shape: "Stiletto",
  length: "Long",
  category: "Gothic",
  technique: "Gel, 3D gel",
  occasion: "Editorial",
  image_url: url,
  is_published: false,
};
const save = (
  user = owner,
  colors = [
    {
      colour_name: "Ivory",
      hex_code: "#D8D4CC",
      brand_name: "",
      brand_code: "",
    },
  ],
) =>
  db.as("service_role", null, "select save_mobile_design($1,$2,$3,$4,$5,$6)", [
    user,
    design,
    fields,
    JSON.stringify([`${url}-close`]),
    JSON.stringify(colors),
    JSON.stringify(["ivory", "gothic"]),
  ]);
async function upload() {
  await db.query(
    "insert into storage.objects(bucket_id,name) values('social-media',$1)",
    [path],
  );
  await db.query(
    "insert into mobile_media_cleanup(bucket,path,user_id) values('social-media',$1,$2)",
    [path, owner],
  );
}
it("stores D36 details together and rejects invalid colours without partial updates", async () => {
  await save();
  expect(
    (await db.query("select title,shape,length,technique from designs"))
      .rows[0],
  ).toMatchObject({
    title: "Cathedral",
    shape: "Stiletto",
    length: "Long",
    technique: "Gel, 3D gel",
  });
  expect((await db.query("select * from design_tags")).rows).toHaveLength(2);
  await expect(
    save(owner, [{ colour_name: "Broken", hex_code: "#BAD" }]),
  ).rejects.toThrow("INVALID_COLOUR");
  expect(
    (await db.query("select colour_name from design_colours")).rows,
  ).toEqual([{ colour_name: "Ivory" }]);
  expect((await db.query("select * from design_images")).rows).toHaveLength(1);
});
it("forbids a stranger taking another design and prevents direct service RPC calls", async () => {
  await save();
  await expect(save(stranger)).rejects.toThrow("DESIGN_OWNER_REQUIRED");
  await expect(
    db.as(
      "authenticated",
      owner,
      "select save_mobile_design($1,$2,$3,null,null,null)",
      [owner, design, fields],
    ),
  ).rejects.toThrow();
});
it("sharing a private design is atomic, idempotent and visible only to the selected nail tech", async () => {
  await save();
  expect(
    (await db.as("authenticated", tech, "select id from designs")).rows,
  ).toHaveLength(0);
  for (let i = 0; i < 2; i++)
    await db.as(
      "authenticated",
      owner,
      "select send_design_message($1,$2,$3,$4)",
      [message, conversation, design, "Shared a design"],
    );
  expect((await db.query("select * from messages")).rows).toHaveLength(1);
  expect(
    (await db.as("authenticated", tech, "select id from designs")).rows,
  ).toEqual([{ id: design }]);
  expect(
    (await db.as("authenticated", stranger, "select id from designs")).rows,
  ).toHaveLength(0);
  expect(
    (await db.as("anon", null, "select id from designs")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.as(
        "authenticated",
        tech,
        "select colour_name from design_colours",
      )
    ).rows,
  ).toHaveLength(1);
  expect(
    (await db.query("select is_published from designs")).rows[0].is_published,
  ).toBe(false);
});
it("a failed or blocked share does not leave a grant and blocking revokes existing shares", async () => {
  await save();
  await db.query(
    "update profiles_data set message_permission='none' where id=$1",
    [tech],
  );
  await expect(
    db.as("authenticated", owner, "select send_design_message($1,$2,$3,$4)", [
      message,
      conversation,
      design,
      "Shared a design",
    ]),
  ).rejects.toThrow();
  expect(
    (await db.query("select * from design_chat_shares")).rows,
  ).toHaveLength(0);
  await db.query(
    "update profiles_data set message_permission='everyone' where id=$1",
    [tech],
  );
  await db.as(
    "authenticated",
    owner,
    "select send_design_message($1,$2,$3,$4)",
    [message, conversation, design, "Shared a design"],
  );
  await db.query("insert into blocks(blocker_id,blocked_id) values($1,$2)", [
    tech,
    owner,
  ]);
  expect(
    (await db.as("authenticated", tech, "select id from designs")).rows,
  ).toHaveLength(0);
});
it("a recipient cannot forward an unpublished design", async () => {
  await save();
  await db.as(
    "authenticated",
    owner,
    "select send_design_message($1,$2,$3,$4)",
    [message, conversation, design, "Shared a design"],
  );
  await db.query(
    "update conversations set client_id=$1,creator_id=$2 where id=$3",
    [tech, stranger, conversation],
  );
  await expect(
    db.as(
      "authenticated",
      tech,
      "select send_design_message(gen_random_uuid(),$1,$2,$3)",
      [conversation, design, "Forwarded"],
    ),
  ).rejects.toThrow("DESIGN_UNAVAILABLE");
});
it("customers publish video posts with caption, tags and stable tagged IDs without creating a design", async () => {
  await upload();
  await db.as(
    "authenticated",
    owner,
    "insert into salon_posts(id,creator_id,body,media,tags,mentioned_user_ids) values($1,$2,$3,$4,$5,$6)",
    [
      post,
      owner,
      "Fresh set",
      JSON.stringify([{ path, type: "video" }]),
      ["nailart"],
      [tech],
    ],
  );
  expect((await db.query("select * from designs")).rows).toHaveLength(0);
  expect(
    (
      await db.as(
        "authenticated",
        tech,
        "select body,media,tags,mentioned_user_ids from salon_posts",
      )
    ).rows[0],
  ).toMatchObject({
    body: "Fresh set",
    tags: ["nailart"],
    mentioned_user_ids: [tech],
  });
  expect(
    (
      await db.as(
        "authenticated",
        tech,
        "select name from storage.objects where bucket_id='social-media'",
      )
    ).rows,
  ).toEqual([{ name: path }]);
  await db.query("update profiles_data set username='tech.new' where id=$1", [
    tech,
  ]);
  expect(
    (await db.query("select mentioned_user_ids from salon_posts")).rows[0]
      .mentioned_user_ids,
  ).toEqual([tech]);
});
it("rejects stolen media, missing mentions, future story times and exposes only permitted social audiences", async () => {
  await upload();
  await expect(
    db.as(
      "authenticated",
      stranger,
      "insert into salon_posts(creator_id,body,media) values($1,$2,$3)",
      [stranger, "Stolen", JSON.stringify([{ path, type: "video" }])],
    ),
  ).rejects.toThrow("MEDIA_OWNER_REQUIRED");
  await expect(
    db.as(
      "authenticated",
      owner,
      "insert into salon_posts(creator_id,body,mentioned_user_ids) values($1,$2,$3)",
      [owner, "Missing", [post]],
    ),
  ).rejects.toThrow("TAGGED_ACCOUNT_UNAVAILABLE");
  await db.as(
    "authenticated",
    owner,
    "insert into stories(id,user_id,image_url,media_path,media_type,created_at) values($1,$2,'',$3,'video',now()+interval '10 years')",
    [post, owner, path],
  );
  expect(
    (
      await db.query(
        "select created_at<now()+interval '1 minute' as recent from stories",
      )
    ).rows[0].recent,
  ).toBe(true);
  await db.query("update profiles_data set is_private=true where id=$1", [
    owner,
  ]);
  expect(
    (await db.as("authenticated", stranger, "select id from stories")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.as(
        "authenticated",
        stranger,
        "select name from storage.objects where bucket_id='social-media'",
      )
    ).rows,
  ).toHaveLength(0);
  await db.query(
    "insert into follows(follower_id,following_id) values($1,$2)",
    [tech, owner],
  );
  expect(
    (await db.as("authenticated", tech, "select id from stories")).rows,
  ).toHaveLength(1);
  await db.query("update stories set created_at=now()-interval '25 hours'");
  expect(
    (await db.as("authenticated", tech, "select id from stories")).rows,
  ).toHaveLength(0);
  expect(
    (
      await db.as(
        "authenticated",
        tech,
        "select name from storage.objects where bucket_id='social-media'",
      )
    ).rows,
  ).toHaveLength(0);
});
it("cleans expired story media", async () => {
  await upload();
  await db.as(
    "authenticated",
    owner,
    "insert into stories(user_id,image_url,media_path,media_type) values($1,'',$2,'video')",
    [owner, path],
  );
  await db.query("update stories set created_at=now()-interval '25 hours'");
  const claimed = (
    await db.as(
      "service_role",
      null,
      "select claim_mobile_media_cleanup() as jobs",
    )
  ).rows[0].jobs;
  expect(claimed).toEqual([
    expect.objectContaining({ bucket: "social-media", path }),
  ]);
});
it("usernames are unique, searchable for customers and searchable by handle after a rename", async () => {
  expect(
    (
      await db.as(
        "authenticated",
        tech,
        "select id,username from search_accounts('@nail.')",
      )
    ).rows,
  ).toEqual([{ id: owner, username: "nail.lover" }]);
  await expect(
    db.query("update profiles_data set username='nail.lover' where id=$1", [
      stranger,
    ]),
  ).rejects.toThrow();
  await db.query("update profiles_data set username='new.name' where id=$1", [
    owner,
  ]);
  expect(
    (
      await db.as(
        "authenticated",
        tech,
        "select id from search_accounts('@new.name')",
      )
    ).rows,
  ).toEqual([{ id: owner }]);
  await expect(
    db.as("anon", null, "select id from search_accounts('')"),
  ).rejects.toThrow();
});
it("validates required design metadata without inventing unknown product shades", () => {
  const body = {
    ...fields,
    isPublished: true,
    images: [url],
    colours: [
      { colour_name: "Ivory", hex_code: "", brand_name: "", brand_code: "" },
    ],
    tags: ["#Ivory"],
  };
  expect(validateDesignDetails(body).tags).toEqual(["ivory"]);
  expect(() => validateDesignDetails({ ...body, technique: "" })).toThrow(
    "technique",
  );
  expect(() => validateDesignDetails({ ...body, tags: ["bad.tag"] })).toThrow(
    "Tags",
  );
});
it("sharing a forged private-image URL never grants access to another account’s bytes", async () => {
  await save();
  const foreign = `${stranger}/designs/private.webp`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('mobile-uploads',$1)",
    [foreign],
  );
  await db.query("update designs set image_url=$1 where id=$2", [
    `https://test.supabase.co/storage/v1/object/public/mobile-uploads/${foreign}`,
    design,
  ]);
  await db.as(
    "authenticated",
    owner,
    "select send_design_message($1,$2,$3,$4)",
    [message, conversation, design, "Shared a design"],
  );
  expect(
    (
      await db.as(
        "authenticated",
        tech,
        "select name from storage.objects where bucket_id='mobile-uploads'",
      )
    ).rows,
  ).toHaveLength(0);
});
it("recipient can sign owned draft cover and closeups, but strangers cannot", async () => {
  await save();
  const own = `${owner}/designs/cover.webp`;
  await db.query(
    "insert into storage.objects(bucket_id,name) values('mobile-uploads',$1),('mobile-uploads',$2)",
    [own, `${own}-close`],
  );
  await db.as(
    "authenticated",
    owner,
    "select send_design_message($1,$2,$3,$4)",
    [message, conversation, design, "Shared a design"],
  );
  expect(
    (
      await db.as(
        "authenticated",
        tech,
        "select name from storage.objects where bucket_id='mobile-uploads'",
      )
    ).rows,
  ).toHaveLength(2);
  expect(
    (
      await db.as(
        "authenticated",
        stranger,
        "select name from storage.objects where bucket_id='mobile-uploads'",
      )
    ).rows,
  ).toHaveLength(0);
});
it("search hides accounts which blocked the searching user", async () => {
  await db.query("insert into blocks(blocker_id,blocked_id) values($1,$2)", [
    owner,
    tech,
  ]);
  expect(
    (
      await db.as(
        "authenticated",
        tech,
        "select id from search_accounts('@nail.lover')",
      )
    ).rows,
  ).toHaveLength(0);
});
it("concurrent claims of the same design ID cannot overwrite another owner", async () => {
  const results = await Promise.allSettled([save(owner), save(stranger)]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  expect((await db.query("select id from designs")).rows).toHaveLength(1);
});
it("concurrent username claims have exactly one winner", async () => {
  const results = await Promise.allSettled([
    db.query("update profiles_data set username='unique.id' where id=$1", [
      owner,
    ]),
    db.query("update profiles_data set username='unique.id' where id=$1", [
      stranger,
    ]),
  ]);
  expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
});
it("removing a post releases its media and leaves unrelated design data intact", async () => {
  await save();
  await upload();
  await db.as(
    "authenticated",
    owner,
    "insert into salon_posts(id,creator_id,body,media) values($1,$2,$3,$4)",
    [post, owner, "My clip", JSON.stringify([{ path, type: "video" }])],
  );
  await db.as("authenticated", owner, "delete from salon_posts where id=$1", [
    post,
  ]);
  expect(
    (
      await db.query(
        "select state from mobile_media_cleanup where bucket='social-media'",
      )
    ).rows,
  ).toEqual([{ state: "pending" }]);
  expect((await db.query("select id from designs")).rows).toHaveLength(1);
});

it("editing or retrying a design does not consume another upload slot", async () => {
  await save();
  await db.query("update profiles_data set weekly_uploads=5,week_reset_at=now() where id=$1",[owner]);
  await save();
  expect((await db.query("select weekly_uploads from profiles_data where id=$1",[owner])).rows[0].weekly_uploads).toBe(5);
});
it("rejects social media with a missing or null type", async () => {
  await upload();
  for(const type of [undefined,null]) {
    await expect(db.as("authenticated", owner, "insert into salon_posts(creator_id,body,media) values($1,'Broken',$2)",[owner,JSON.stringify([{path,type}])])).rejects.toThrow();
  }
});
it("private-account owners can explicitly share a private D36 with a non-follower", async () => {
  await save();
  await db.query("update profiles_data set is_private=true where id=$1",[owner]);
  await db.as("authenticated",owner,"select send_design_message($1,$2,$3,$4)",[message,conversation,design,"Shared a design"]);
  expect((await db.as("authenticated",tech,"select id from designs")).rows).toEqual([{id:design}]);
});
it('a regular user can publish/unpublish their design and a stranger cannot delete it; owner deletion revokes shared access',async()=>{
 await save();
 await db.as('authenticated',owner,'select send_design_message($1,$2,$3,$4)',[message,conversation,design,'Shared my design']);
 expect((await db.as('authenticated',tech,'select id from designs where id=$1',[design])).rows).toHaveLength(1);
 expect((await db.as('authenticated',stranger,'delete from designs where id=$1 returning id',[design])).rows).toHaveLength(0);
 await db.as('service_role',null,'select save_mobile_design($1,$2,$3,$4,$5,$6)',[owner,design,{...fields,is_published:true},JSON.stringify([]),JSON.stringify([]),JSON.stringify([])]);
 expect((await db.as('authenticated',stranger,'select id from designs where id=$1',[design])).rows).toHaveLength(1);
 await save();
 expect((await db.as('authenticated',stranger,'select id from designs where id=$1',[design])).rows).toHaveLength(0);
 expect((await db.as('authenticated',owner,'delete from designs where id=$1 returning id',[design])).rows).toEqual([{id:design}]);
 expect((await db.query('select * from design_chat_shares where design_id=$1',[design])).rows).toHaveLength(0);
 expect((await db.as('authenticated',tech,'select id from designs where id=$1',[design])).rows).toHaveLength(0);
 expect((await db.query('select * from design_images where design_id=$1',[design])).rows).toHaveLength(0);
});

it('Updates shows chronological text notes, excludes Community media, and obeys private-follow/block visibility', async () => {
 await upload();
 await db.as('authenticated', owner, "insert into salon_posts(id,creator_id,body,media) values($1,$2,'My note','[]')", [post,owner]);
 const note='00000000-0000-4000-8000-000000000961', mediaPost='00000000-0000-4000-8000-000000000962';
 await db.as('authenticated',tech,"insert into salon_posts(id,creator_id,body,media) values($1,$2,'Private studio note','[]')",[note,tech]);
 // Give the chronological fixtures distinct server timestamps; fast inserts can tie.
 await db.query("update salon_posts set created_at=case when id=$1 then '2026-09-28T10:00:00Z'::timestamptz else '2026-09-28T10:01:00Z'::timestamptz end where id in($1,$2)",[post,note]);
 await db.as('authenticated',owner,'insert into salon_posts(id,creator_id,body,media) values($1,$2,$3,$4)',[mediaPost,owner,'Community caption',JSON.stringify([{path,type:'video'}])]);
 await db.query('update profiles_data set is_private=true where id=$1',[tech]);
 const read=()=>db.as('authenticated',owner,"select id from salon_posts where media='[]'::jsonb and creator_id=any($1::uuid[]) order by created_at desc,id",[[owner,tech]]);
 expect((await read()).rows).toEqual([{id:post}]);
 await db.as('authenticated',owner,'insert into follows(follower_id,following_id) values($1,$2)',[owner,tech]);
 expect((await read()).rows.map(row=>row.id)).toEqual([note,post]);
 expect((await db.as('authenticated',stranger,'select id from salon_posts where id=$1',[note])).rows).toHaveLength(0);
 await db.as('authenticated',tech,'insert into blocks(blocker_id,blocked_id) values($1,$2)',[tech,owner]);
 expect((await read()).rows).toEqual([{id:post}]);
});
it('text-update ownership and stable-ID uniqueness prevent impersonation and duplicate rows',async()=>{
 await expect(db.as('authenticated',owner,"insert into salon_posts(id,creator_id,body,media) values($1,$2,'Forged note','[]')",[post,tech])).rejects.toThrow();
 await db.as('authenticated',owner,"insert into salon_posts(id,creator_id,body,media) values($1,$2,'My note','[]')",[post,owner]);
 await expect(db.as('authenticated',owner,"insert into salon_posts(id,creator_id,body,media) values($1,$2,'My note','[]')",[post,owner])).rejects.toThrow();
 expect((await db.as('authenticated',owner,'select id,body from salon_posts where id=$1',[post])).rows).toEqual([{id:post,body:'My note'}]);
});
