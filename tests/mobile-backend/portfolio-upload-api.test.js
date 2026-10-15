import { beforeEach, expect, it, vi } from "vitest";
import sharp from "sharp";
import { database, ok } from "../helpers/supabase";
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
import { POST } from "@/app/api/mobile/upload/route";
const uid = "00000000-0000-4000-8000-000000000971";
let upload, sign;
beforeEach(() => {
  state.user = { id: uid, account_type: "user" };
  state.db = database((q) => {
    expect(q.table).toBe("mobile_media_cleanup");
    return ok(null);
  });
  upload = vi.fn(async () => ok(null));
  sign = vi.fn(async () => ok({ signedUrl: "https://storage.invalid/signed" }));
  state.db.storage = { from: vi.fn(() => ({ upload, createSignedUrl: sign })) };
});
async function photo() {
  const bytes = await sharp({
    create: { width: 16, height: 16, channels: 3, background: "#812740" },
  })
    .png()
    .toBuffer();
  const body = new FormData();
  body.append("kind", "design");
  body.append("file", new File([bytes], "test.png", { type: "image/png" }));
  return new Request("http://localhost/api/mobile/upload", {
    method: "POST",
    body,
  });
}
it("a regular customer can upload a photo into their server-generated private design path", async () => {
  const response = await POST(await photo());
  expect(response.status).toBe(200);
  const result = await response.json();
  expect(result.path).toMatch(new RegExp(`^${uid}/designs/[0-9a-f-]+\\.webp$`));
  expect(state.db.calls[0].values).toEqual({
    bucket: "mobile-uploads",
    path: result.path,
    user_id: uid,
  });
  expect(upload).toHaveBeenCalledWith(result.path, expect.any(Uint8Array), {
    contentType: "image/webp",
    upsert: false,
  });
  expect(sign).toHaveBeenCalledWith(result.path, 900);
});
it("an upload preparation failure writes no bytes and a signed-out request issues no ticket", async () => {
  state.db.from = vi.fn(() => ({
    insert: async () => ({ error: { message: "Offline" } }),
  }));
  expect((await POST(await photo())).status).toBe(503);
  expect(upload).not.toHaveBeenCalled();
  state.user = null;
  expect((await POST(await photo())).status).toBe(401);
  expect(upload).not.toHaveBeenCalled();
});
