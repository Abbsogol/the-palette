import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  getSessionUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  mobileUserClient: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  getSessionUser: m.getSessionUser,
  serviceClient: { rpc: m.rpc, from: m.from },
}));
vi.mock("@/lib/mobile-auth", () => ({
  mobileUserClient: m.mobileUserClient,
  uuidPattern: /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i,
}));
import { GET, POST } from "@/app/api/mobile/rewards/[...path]/route";
import { rewardsAdminPost, validateRewardDraft } from "@/lib/rewards/data";
const user = "00000000-0000-4000-8000-000000000871",
  campaign = "00000000-0000-4000-8000-000000000872",
  entry = "00000000-0000-4000-8000-000000000873";
const ctx = (path) => ({ params: Promise.resolve({ path }) });
const req = (path, body) =>
  new Request("https://beta.invalid/api/mobile/rewards/" + path, {
    method: body ? "POST" : "GET",
    headers: { Authorization: "Bearer verified" },
    body: body ? JSON.stringify(body) : undefined,
  });
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.LAQUE_REWARDS_ENABLED;
  m.getSessionUser.mockResolvedValue({
    id: user,
    email_confirmed_at: "2026-10-01T00:00:00Z",
  });
  m.rpc.mockResolvedValue({
    data: { items: [], winners: [], enabled: true },
    error: null,
  });
});
it("requires a verified session for both reads and writes", async () => {
  m.getSessionUser.mockResolvedValue(null);
  expect((await GET(req("campaigns"), ctx(["campaigns"]))).status).toBe(401);
  expect(
    (await POST(req("country", { country: "IN" }), ctx(["country"]))).status,
  ).toBe(401);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("Home entry discovery uses only verified identity and signs a bounded page, never profile or subscription setup data",async()=>{
  m.rpc.mockResolvedValue({data:{enabled:true,country:"IN",items:Array.from({length:26},(_,i)=>({id:String(i),snapshot:{title:"Entry",image_url:null},campaign:{id:campaign}})),candidates:["PRIVATE"]}});
  const r=await GET(req("entries?offset=25&country=TR&userId=attacker"),ctx(["entries"]));
  expect(r.status).toBe(200);
  expect(m.rpc).toHaveBeenCalledWith("rewards_home_entries",{p_user:user,p_offset:25});
  const data=await r.json();expect(data.items).toHaveLength(25);expect(data.hasMore).toBe(true);expect(data.enabled).toBe(false);
  expect(JSON.stringify(data)).not.toContain("PRIVATE");
  expect((await GET(req("entries/"+campaign),ctx(["entries",campaign]))).status).toBe(404);
});
it("uses verified account country on the backend; caller country and actor values do not become read authority", async () => {
  const r = await GET(
    req("campaigns?country=TR&userId=attacker"),
    ctx(["campaigns"]),
  );
  expect(r.status).toBe(200);
  expect(m.rpc).toHaveBeenCalledWith("rewards_member_read", {
    p_user: user,
    p_section: "campaigns",
    p_id: null,
    p_offset: 0,
    p_entry: null,
  });
  expect((await r.json()).enabled).toBe(false);
});
it("shared links target only their campaign and entry, preserving country checks", async () => {
  await GET(
    req(`campaigns/${campaign}?entry=${entry}`),
    ctx(["campaigns", campaign]),
  );
  expect(m.rpc).toHaveBeenCalledWith(
    "rewards_member_read",
    expect.objectContaining({ p_user: user, p_id: campaign, p_entry: entry }),
  );
  m.rpc.mockResolvedValue({ error: { message: "CAMPAIGN_UNAVAILABLE" } });
  expect(
    (await GET(req("campaigns/" + campaign), ctx(["campaigns", campaign])))
      .status,
  ).toBe(404);
});
it("does not activate prize submission from the client", async () => {
  const r = await POST(
    req("campaigns/" + campaign, {
      action: "submit",
      designId: entry,
      acceptedRules: true,
      rulesVersion: 3,
      enabled: true,
    }),
    ctx(["campaigns", campaign]),
  );
  expect(r.status).toBe(409);
  expect(m.rpc).not.toHaveBeenCalled();
});
it("accepts explicit idempotent vote state, without accepting an actor override", async () => {
  process.env.LAQUE_REWARDS_ENABLED = "true";
  const r = await POST(
    req("campaigns/" + campaign, {
      action: "vote",
      entryId: entry,
      liked: true,
      userId: "other",
    }),
    ctx(["campaigns", campaign]),
  );
  expect(r.status).toBe(200);
  expect(m.rpc).toHaveBeenCalledWith("rewards_member_action", {
    p_user: user,
    p_campaign: campaign,
    p_action: "vote",
    p_data: { entryId: entry, liked: true },
  });
});
it("country writes use a bounded real ISO code and cannot carry staff or entitlement changes", async () => {
  expect(
    (await POST(req("country", { country: "XX" }), ctx(["country"]))).status,
  ).toBe(400);
  expect(
    (
      await POST(
        req("country", { country: "IN", role: "owner" }),
        ctx(["country"]),
      )
    ).status,
  ).toBe(400);
  expect(m.rpc).not.toHaveBeenCalled();
  expect(
    (await POST(req("country", { country: "IN" }), ctx(["country"]))).status,
  ).toBe(200);
});
it("ordinary staff roles cannot publish; MFA boundary retains the current assigned publisher role", async () => {
  await expect(
    rewardsAdminPost(
      { rpc: m.rpc },
      "updates",
      campaign,
      { action: "publish", version: 1, reason: "Test publishing reason" },
      { role: "support", user: { id: user } },
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(m.rpc).not.toHaveBeenCalled();
  await rewardsAdminPost(
    { rpc: m.rpc },
    "updates",
    campaign,
    { action: "publish", version: 1, reason: "Test publishing reason" },
    { role: "moderator", user: { id: user } },
  );
  expect(m.rpc).toHaveBeenCalledWith(
    "rewards_admin_change",
    expect.objectContaining({
      p_actor: user,
      p_section: "updates",
      p_action: "publish",
    }),
  );
});
it("country and date validation reject malformed drafts", () => {
  expect(() =>
    validateRewardDraft("updates", {
      title: "News",
      body: "Official text",
      countryCodes: ["XX"],
    }),
  ).toThrow(/country/);
  expect(() =>
    validateRewardDraft("updates", {
      title: "News",
      body: "Official text",
      countryCodes: ["IN", "IN"],
    }),
  ).toThrow(/country/);
  expect(
    validateRewardDraft("updates", {
      title: " News ",
      body: "Official text",
      countryCodes: [],
    }),
  ).toMatchObject({ title: "News", countryCodes: [] });
});

it("signs originals with the requesting member, and strips denied image access", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://beta.supabase.co";
  const sign = vi
    .fn()
    .mockResolvedValueOnce({
      data: { signedUrl: "https://beta.supabase.co/signed/member-only" },
      error: null,
    })
    .mockResolvedValueOnce({ error: { message: "denied" } });
  const bucket = vi.fn(() => ({ createSignedUrl: sign }));
  m.mobileUserClient.mockReturnValue({ storage: { from: bucket } });
  m.rpc.mockResolvedValue({
    data: {
      campaign: { id: campaign },
      items: [
        {
          snapshot: {
            image_url: `https://beta.supabase.co/storage/v1/object/public/nail-lab/${user}/design.png`,
          },
        },
      ],
      ownItems: [],
      candidates: [
        {
          image_url: `https://beta.supabase.co/storage/v1/object/public/nail-lab/${user}/other.png`,
        },
      ],
      enabled: true,
    },
  });
  const result = await GET(
    req("campaigns/" + campaign),
    ctx(["campaigns", campaign]),
  );
  expect(result.status).toBe(200);
  const data = await result.json();
  expect(data.items[0].snapshot.image_url).toBe(
    "https://beta.supabase.co/signed/member-only",
  );
  expect(data.candidates[0].image_url).toBe(null);
  expect(bucket).toHaveBeenCalledWith("nail-lab");
  expect(sign).toHaveBeenCalledWith(`${user}/design.png`, 60);
  expect(m.mobileUserClient).toHaveBeenCalled();
});
it("never forwards arbitrary source hosts or raw operational errors", async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://beta.supabase.co";
  m.rpc.mockResolvedValue({
    data: {
      campaign: { id: campaign },
      items: [
        { snapshot: { image_url: "https://attacker.invalid/secret.png" } },
      ],
      ownItems: [],
      candidates: [],
    },
  });
  const bad = await GET(
    req("campaigns/" + campaign),
    ctx(["campaigns", campaign]),
  );
  expect(bad.status).toBe(503);
  expect(JSON.stringify(await bad.json())).not.toContain("attacker.invalid");
  expect(m.mobileUserClient).not.toHaveBeenCalled();
  m.rpc.mockResolvedValue({
    error: { message: "database password SECRET in internal schema" },
  });
  const error = await GET(req("campaigns"), ctx(["campaigns"]));
  expect(error.status).toBe(503);
  expect(JSON.stringify(await error.json())).not.toContain("SECRET");
});

it("denies unverified and anonymous sessions before reading Rewards", async () => {
  m.getSessionUser.mockResolvedValue({ id: user, email_confirmed_at: null });
  expect((await GET(req("campaigns"), ctx(["campaigns"]))).status).toBe(403);
  expect(m.rpc).not.toHaveBeenCalled();
});
