import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ user: { id: "owner" }, db: null }));
vi.mock("@/lib/auth", () => ({ getSessionUser: async () => state.user, get serviceClient() { return state.db; } }));
import { GET, OPTIONS } from "../../app/api/pinterest/inspiration/route";
import { configuration, signTicket } from "../../lib/pinterest/inspiration";
const picture = { id: "123", board_id: "456", title: "Short pink nail art",
  description: "French tip manicure", media: { media_type: "image", images: { "600x": { url: "https://i.pinimg.com/test.jpg" } } } };
const request = (query = "") => new Request("https://example.invalid/api/pinterest/inspiration" + query);
const fetchMock = vi.fn();
const pinResponse = vi.fn();
beforeEach(() => {
  vi.stubEnv("PINTEREST_ENABLED", "1"); vi.stubEnv("PINTEREST_SOURCE_APPROVED", "1");
  vi.stubEnv("PINTEREST_ZERO_SPEND_VERIFIED", "1"); vi.stubEnv("PINTEREST_PILOT_USER_IDS", "owner");
  vi.stubEnv("PINTEREST_SOURCE", "board"); vi.stubEnv("PINTEREST_BOARD_ID", "456");
  vi.stubEnv("PINTEREST_ACCESS_TOKEN", "secret-must-not-escape");
  vi.stubEnv("PINTEREST_SIGNING_SECRET", "test-signing-secret-at-least-32-characters");
  vi.stubEnv("PINTEREST_TOKEN_EXPIRES_AT", "2099-01-01T00:00:00Z");
  state.user = { id: "owner" }; state.db = { rpc: vi.fn(async () => ({ data: { allowed: true }, error: null })) };
  pinResponse.mockReset().mockImplementation(async () => Response.json({ items: [picture], bookmark: "next" }));
  fetchMock.mockReset().mockImplementation(async url => /^\/v5\/boards\/[^/]+$/.test(url.pathname)
    ? Response.json({ id: "456", privacy: "PUBLIC" }) : pinResponse());
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
it("authenticates before accessing provider or budgets", async () => {
  state.user = null; expect((await GET(request())).status).toBe(401);
  expect(fetchMock).not.toHaveBeenCalled(); expect(state.db.rpc).not.toHaveBeenCalled();
});
it.each([
  ["PINTEREST_ENABLED", "0"], ["PINTEREST_SOURCE_APPROVED", "0"], ["PINTEREST_ZERO_SPEND_VERIFIED", "0"],
  ["PINTEREST_PILOT_USER_IDS", "stranger"], ["PINTEREST_TOKEN_EXPIRES_AT", "2001-01-01"],
  ["PINTEREST_BOARD_ID", "../secret"], ["PINTEREST_DAILY_LIMIT", "101"],
  ["PINTEREST_USER_DAILY_LIMIT", "31"],
  ["PINTEREST_ACCESS_TOKEN", ""], ["PINTEREST_SIGNING_SECRET", "short"],
])("fails closed for %s without any upstream request", async (key, value) => {
  vi.stubEnv(key, value); const response = await GET(request());
  expect(response.status).toBe(503); expect((await response.json()).code).toBe("PINTEREST_DISABLED");
  expect(state.db.rpc).not.toHaveBeenCalled(); expect(fetchMock).not.toHaveBeenCalled();
});
it("returns attributed no-store records and signed source/account-bound cursors", async () => {
  const response = await GET(request());
  expect(response.headers.get("cache-control")).toBe("no-store");
  const data = await response.json();
  expect(data.records[0]).toMatchObject({ source: "pinterest", id: "123", pinUrl: "https://www.pinterest.com/pin/123/", imageUrl: "https://i.pinimg.com/test.jpg" });
  expect(JSON.stringify(data)).not.toContain("secret-must-not-escape");
  expect(state.db.rpc).toHaveBeenCalledWith("reserve_pinterest_request_batch", { p_user_id: "owner", p_day_limit: 100, p_minute_limit: 5, p_user_limit: 10, p_request_count: 2 });
  const [url, options] = fetchMock.mock.calls[1];
  expect(url.pathname).toBe("/v5/boards/456/pins"); expect(url.searchParams.get("page_size")).toBe("24");
  expect(options).toMatchObject({ cache: "no-store", redirect: "error" });
  await GET(request("?cursor=" + encodeURIComponent(data.cursor)));
  expect(fetchMock.mock.calls[3][0].searchParams.get("bookmark")).toBe("next");
});
it.each(["?topic=unknown", "?cursor=forged", "?pin=forged", "?board=private", "?userId=stranger"])("rejects untrusted requests %s before reserving", async query => {
  expect((await GET(request(query))).status).toBe(400); expect(state.db.rpc).not.toHaveBeenCalled();
});
it("rejects expired and cross-account/source cursors without fetching", async () => {
  const token = signTicket(configuration("owner"), "owner", { kind: "page", topic: "all", bookmark: "page" });
  vi.stubEnv("PINTEREST_PILOT_USER_IDS", "owner,stranger"); state.user = { id: "stranger" };
  expect((await GET(request("?cursor=" + token))).status).toBe(400);
  state.user = { id: "owner" }; vi.stubEnv("PINTEREST_BOARD_ID", "457");
  expect((await GET(request("?cursor=" + token))).status).toBe(400);
  vi.stubEnv("PINTEREST_BOARD_ID", "456");
  const now = vi.spyOn(Date, "now").mockReturnValue(Date.now() + 360000);
  expect((await GET(request("?cursor=" + token))).status).toBe(400); now.mockRestore();
  expect(fetchMock).not.toHaveBeenCalled();
});
it("rechecks a signed detail and withholds private or foreign-board content", async () => {
  const token = signTicket(configuration("owner"), "owner", { kind: "pin", topic: "all", pinId: "123" });
  pinResponse.mockResolvedValueOnce(Response.json(picture));
  expect((await GET(request("?pin=" + token))).status).toBe(200);
  for (const change of [{ privacy: "SECRET" }, { board_id: "457" }, { id: "124" }]) {
    pinResponse.mockResolvedValueOnce(Response.json({ ...picture, ...change }));
    expect((await GET(request("?pin=" + token))).status).toBe(404);
  }
});
it("withholds unsafe images and unsupported media; never invents missing metadata", async () => {
  pinResponse.mockResolvedValue(Response.json({ items: [
    picture, picture, { ...picture, id: "124", media: { media_type: "video" } },
    { ...picture, id: "125", media: { media_type: "image", images: { "600x": { url: "https://i.pinimg.com.evil.invalid/test.jpg" } } } },
    { ...picture, id: "126", title: null, description: null },
  ] }));
  const data = await (await GET(request())).json();
  expect(data.records.map(p => p.id)).toEqual(["123", "126"]);
  expect(data.records[1].title).toBe(""); expect(data.records[1].creator).toBeNull();
});
it("budget failures never call Pinterest", async () => {
  state.db.rpc.mockResolvedValue({ data: { allowed: false }, error: null });
  expect((await GET(request())).status).toBe(429); expect(fetchMock).not.toHaveBeenCalled();
  state.db.rpc.mockResolvedValue({ error: new Error("secret") });
  const response = await GET(request()); expect(response.status).toBe(503);
  expect(JSON.stringify(await response.json())).not.toContain("secret");
});
it("pauses all accounts on 429 or exhausted provider headers", async () => {
  fetchMock.mockResolvedValue(new Response("private raw payload", { status: 429, headers: { "Retry-After": "120" } }));
  const response = await GET(request()); expect(response.status).toBe(429);
  expect(state.db.rpc).toHaveBeenCalledWith("pause_pinterest_requests", { p_seconds: 120 });
  expect(JSON.stringify(await response.json())).not.toContain("raw payload");
});
it("stops before the Pin read if the visibility response exhausts Pinterest's allowance", async () => {
  fetchMock.mockResolvedValue(Response.json({ id: "456", privacy: "PUBLIC" }, { headers: { "x-ratelimit-remaining": "0", "Retry-After": "60" } }));
  const response = await GET(request());
  expect(response.status).toBe(429);
  expect((await response.json()).retryAt).toBeTruthy();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(state.db.rpc).toHaveBeenCalledWith("pause_pinterest_requests", { p_seconds: 60 });
});
it.each([401, 403, 500])("does not leak provider errors on %s", async status => {
  fetchMock.mockResolvedValue(new Response("private provider details", { status }));
  const response = await GET(request());
  expect(response.status).toBe(503); expect(JSON.stringify(await response.json())).not.toContain("private");
});
it("caps streamed responses and rejects malformed JSON", async () => {
  for (const body of ["not JSON", JSON.stringify({ items: "wrong" }), " ".repeat(524289)]) {
    pinResponse.mockResolvedValueOnce(new Response(body));
    expect((await GET(request())).status).toBe(503);
  }
});
it("partner search remains gated and uses fixed nail topics and country", async () => {
  vi.stubEnv("PINTEREST_SOURCE", "partner");
  expect((await GET(request("?topic=short"))).status).toBe(503);
  vi.stubEnv("PINTEREST_PARTNER_APPROVED", "1"); vi.stubEnv("PINTEREST_COUNTRY_CODE", "AE");
  expect((await GET(request("?topic=short"))).status).toBe(200);
  const url = fetchMock.mock.calls[0][0];
  expect(url.pathname).toBe("/v5/search/partner/pins");
  expect(url.searchParams.get("term")).toBe("short nail designs"); expect(url.searchParams.get("country_code")).toBe("AE");
});

it("rechecks board visibility before any Pin read, charging both upstream requests", async () => {
  await GET(request()); expect(state.db.rpc).toHaveBeenCalledTimes(1);
  fetchMock.mockClear(); state.db.rpc.mockClear();
  fetchMock.mockResolvedValueOnce(Response.json({ id: "456", privacy: "SECRET" }));
  const response = await GET(request()); expect(response.status).toBe(503);
  expect(fetchMock).toHaveBeenCalledTimes(1); expect(state.db.rpc).toHaveBeenCalledTimes(1);
});
it("returns the budget reset time and distinguishes LaQue's short limit from Pinterest access", async () => {
  state.db.rpc.mockResolvedValue({ data: { allowed: false, reason: "minute", retryAt: "2099-01-01T00:00:00Z" }, error: null });
  const response = await GET(request());
  expect(response.status).toBe(429);
  expect(await response.json()).toMatchObject({ code: "PINTEREST_BUDGET", retryAt: "2099-01-01T00:00:00.000Z", error: expect.stringContaining("LaQue’s short request limit") });
  expect(fetchMock).not.toHaveBeenCalled();
});
it("uses only the configured Halloween board and binds its tickets to that source", async () => {
  vi.stubEnv("PINTEREST_HALLOWEEN_BOARD_ID", "789");
  fetchMock.mockImplementation(async url => /^\/v5\/boards\/[^/]+$/.test(url.pathname)
    ? Response.json({ id: "789", privacy: "PUBLIC" })
    : Response.json({ items: [{ ...picture, board_id: "789", title: "Halloween ghost nail art" }], bookmark: "next" }));
  const response = await GET(request("?topic=halloween"));
  expect(response.status).toBe(200);
  const data = await response.json();
  expect(data.records).toHaveLength(1);
  expect(fetchMock.mock.calls.map(([url]) => url.pathname)).toEqual(["/v5/boards/789", "/v5/boards/789/pins"]);
  fetchMock.mockClear();
  expect((await GET(request("?topic=all&cursor=" + data.cursor))).status).toBe(400);
  vi.stubEnv("PINTEREST_HALLOWEEN_BOARD_ID", "790");
  expect((await GET(request("?topic=halloween&pin=" + data.records[0].detailTicket))).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});
it.each(["", "../private"])("fails closed when the Halloween board is unavailable: %s", async board => {
  vi.stubEnv("PINTEREST_HALLOWEEN_BOARD_ID", board);
  expect((await GET(request("?topic=halloween"))).status).toBe(503);
  expect(fetchMock).not.toHaveBeenCalled();
});
it("permits only configured web origins without cookie credentials or upstream preflight calls", async () => {
  vi.stubEnv("PINTEREST_WEB_ORIGINS", "http://localhost:8083");
  const good = new Request("https://example.invalid/api/pinterest/inspiration", { headers: { Origin: "http://localhost:8083" } });
  const preflight = OPTIONS(good);
  expect(preflight.status).toBe(204); expect(preflight.headers.get("access-control-allow-origin")).toBe("http://localhost:8083");
  expect(preflight.headers.get("access-control-allow-credentials")).toBeNull();
  const bad = new Request(good.url, { headers: { Origin: "https://stranger.invalid" } });
  expect(OPTIONS(bad).status).toBe(403); expect((await GET(bad)).status).toBe(403);
  expect(fetchMock).not.toHaveBeenCalled();
  expect((await GET(good)).headers.get("access-control-allow-origin")).toBe("http://localhost:8083");
});
