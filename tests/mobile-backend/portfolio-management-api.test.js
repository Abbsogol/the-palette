import { beforeEach, expect, it, vi } from "vitest";
import { database, ok, jsonRequest } from "../helpers/supabase";
const state = vi.hoisted(() => ({ user: null, db: null }));
vi.mock("@/lib/auth", () => ({
  getSessionUser: async () => state.user,
  get serviceClient() {
    return state.db;
  },
}));
vi.mock("@/lib/mobile-auth", () => ({
  mobileUserClient: () => state.db,
  mobileJson: (body, status = 200) => Response.json(body, { status }),
  uuidPattern: /^[a-f0-9-]{36}$/i,
}));
import * as portfolio from "@/app/api/mobile/portfolio/route";
const uid = "00000000-0000-4000-8000-000000000951",
  id = "00000000-0000-4000-8000-000000000952";
beforeEach(() => {
  state.user = { id: uid };
});
it("does not claim a design was deleted when the owner-filtered write matches no row", async () => {
  state.db = database(() => ok([]));
  const r = await portfolio.DELETE(jsonRequest({ id }));
  expect(r.status).toBe(404);
  expect(state.db.calls[0].filters).toContainEqual(["eq", "created_by", uid]);
});
it("returns actionable quota feedback instead of a generic retryable server failure", async () => {
  state.db = database(
    () => ok(null),
    async () => ({ data: null, error: { message: "WEEKLY_UPLOAD_LIMIT" } }),
  );
  const r = await portfolio.POST(
    jsonRequest({
      id,
      title: "Draft",
      create: true,
      detailsVersion: 1,
      isPublished: false,
      description: "",
      shape: "",
      length: "",
      category: "",
      technique: "",
      occasion: "",
      images: [`${uid}/designs/00000000-0000-4000-8000-000000000953.webp`],
      colours: [],
      tags: [],
    }),
  );
  expect(r.status).toBe(409);
  expect(await r.json()).toEqual(
    expect.objectContaining({
      code: "UPLOAD_LIMIT",
      error: expect.stringMatching(/weekly/i),
    }),
  );
});
it("delete success requires an owned returned row and database errors are never reported as success", async () => {
  state.db = database(() => ok([{ id }]));
  expect((await portfolio.DELETE(jsonRequest({ id }))).status).toBe(200);
  expect(state.db.calls[0]).toEqual(
    expect.objectContaining({
      operation: "delete",
      columns: "id",
      filters: expect.arrayContaining([
        ["eq", "id", id],
        ["eq", "created_by", uid],
      ]),
    }),
  );
  state.db = database(() => ({
    data: null,
    error: { message: "Database offline" },
  }));
  expect((await portfolio.DELETE(jsonRequest({ id }))).status).toBe(503);
});
it("all portfolio operations reject signed-out requests before database work", async () => {
  state.user = null;
  state.db = database(() => ok(null));
  for (const handler of [portfolio.GET, portfolio.POST, portfolio.DELETE])
    expect((await handler(jsonRequest({ id }))).status).toBe(401);
  expect(state.db.from).not.toHaveBeenCalled();
  expect(state.db.rpc).not.toHaveBeenCalled();
});
it("the allowance follows the database rolling window, owner and effective provider entitlements", async () => {
  const now = Date.now(),
    start = new Date(now - 86400000).toISOString();
  state.db = database(
    () => ok({ weekly_uploads: 3, week_reset_at: start, is_admin: false }),
    async () => ok("free"),
  );
  const r = await portfolio.GET(jsonRequest({}));
  expect(await r.json()).toEqual({
    used: 3,
    limit: 5,
    remaining: 2,
    resetsAt: new Date(Date.parse(start) + 7 * 86400000).toISOString(),
  });
  expect(state.db.calls[0].filters).toContainEqual(["eq", "id", uid]);
  expect(state.db.rpc).toHaveBeenCalledWith("effective_subscription_tier", {
    p_user_id: uid,
  });
  state.db = database(
    () =>
      ok({
        weekly_uploads: 5,
        week_reset_at: new Date(now - 8 * 86400000).toISOString(),
      }),
    async () => ok("free"),
  );
  expect(await (await portfolio.GET(jsonRequest({}))).json()).toEqual({
    used: 0,
    limit: 5,
    remaining: 5,
    resetsAt: null,
  });
  state.db = database(
    () => ok({ weekly_uploads: 10, week_reset_at: start }),
    async () => ok("pro_creator"),
  );
  expect(await (await portfolio.GET(jsonRequest({}))).json()).toEqual(
    expect.objectContaining({ limit: null, remaining: null }),
  );
});
it("a failed entitlement read does not invent a permissive upload allowance", async () => {
  state.db = database(
    () => ok({ weekly_uploads: 0 }),
    async () => ({ data: null, error: { message: "Offline" } }),
  );
  expect((await portfolio.GET(jsonRequest({}))).status).toBe(503);
});
it("a saved draft returns the canonical owner photo URLs used by subsequent edits", async () => {
  const path = `${uid}/designs/00000000-0000-4000-8000-000000000953.webp`;
  state.db = database(
    () => ok(null),
    async () => ok(id),
  );
  const r = await portfolio.POST(
    jsonRequest({
      id,
      title: "Draft",
      create: true,
      detailsVersion: 1,
      isPublished: false,
      description: "",
      shape: "",
      length: "",
      category: "",
      technique: "",
      occasion: "",
      images: [path],
      colours: [],
      tags: [],
    }),
  );
  expect(r.status).toBe(200);
  expect(await r.json()).toEqual({
    designId: id,
    images: [
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/mobile-uploads/${path}`,
    ],
  });
});

it("generated design images cannot be replaced or expanded, including the legacy imagePath route",async()=>{
 const original=`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/designs/generated.webp`;
 state.db=database(()=>ok({id,created_by:uid,source_generation_id:id,image_url:original}));
 for(const extra of [{detailsVersion:1,images:[original,'replacement']},{detailsVersion:1,images:['replacement']},{imagePath:`${uid}/designs/${id}.webp`}]){
  expect((await portfolio.POST(jsonRequest({id,title:'Design',isPublished:true,...extra}))).status).toBe(409);
 }
 expect(state.db.rpc).not.toHaveBeenCalled();
 expect(state.db.calls.every(q=>q.operation==='select')).toBe(true);
});
it("generated design publishing details can be saved without adding or replacing images",async()=>{
 const original=`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/designs/generated.webp`;
 state.db=database(q=>ok(q.table==='design_images'?[]:{id,created_by:uid,source_generation_id:id,image_url:original}),async()=>ok(id));
 const response=await portfolio.POST(jsonRequest({id,title:'Rose design',isPublished:true,detailsVersion:1,images:[original],description:'Salon instructions',shape:'Almond',length:'Long',category:'Minimal',technique:'Gel',occasion:'Everyday',colours:[],tags:[]}));
 expect(response.status).toBe(200);
 expect(state.db.rpc).toHaveBeenCalledWith('save_mobile_design',expect.objectContaining({p_images:[],p_fields:expect.objectContaining({image_url:original,title:'Rose design'})}));
});
