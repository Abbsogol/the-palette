import { createHmac, timingSafeEqual } from "node:crypto";

export const topics = {
  all: "nail art designs",
  french: "French tip nails",
  chrome: "chrome nail art",
  minimal: "minimal nail designs",
  halloween: "Halloween nail designs",
  dark: "dark nail art",
  short: "short nail designs",
};
export class PinterestError extends Error {
  constructor(message, code = "PINTEREST_UNAVAILABLE", status = 503, retryAt = null) {
    super(message); this.code = code; this.status = status; this.retryAt = retryAt;
  }
}
const unavailable = () => new PinterestError("Pinterest inspiration isn’t available yet.", "PINTEREST_DISABLED");
export function configuration(userId, topic = "all", connection = {}) {
  const env = { ...process.env, ...connection };
  if (env.PINTEREST_ENABLED !== "1" || env.PINTEREST_SOURCE_APPROVED !== "1" ||
      env.PINTEREST_ZERO_SPEND_VERIFIED !== "1" ||
      !env.PINTEREST_PILOT_USER_IDS?.split(",").map(s => s.trim()).includes(userId)) throw unavailable();
  if (!["board", "partner"].includes(env.PINTEREST_SOURCE) ||
      !env.PINTEREST_ACCESS_TOKEN || !env.PINTEREST_SIGNING_SECRET ||
      env.PINTEREST_SIGNING_SECRET.length < 32 ||
      !(Date.parse(env.PINTEREST_TOKEN_EXPIRES_AT) > Date.now() + 60000)) throw unavailable();
  const board = topic === "halloween" ? env.PINTEREST_HALLOWEEN_BOARD_ID : env.PINTEREST_BOARD_ID;
  if (env.PINTEREST_SOURCE === "board" && !/^\d{1,30}$/.test(board || "")) throw unavailable();
  if (env.PINTEREST_SOURCE === "partner" &&
      (env.PINTEREST_PARTNER_APPROVED !== "1" || env.PINTEREST_COUNTRY_CODE !== "AE")) throw unavailable();
  const limit = (name, ceiling, fallback = ceiling) => {
    const value = env[name] === undefined ? fallback : Number(env[name]);
    if (!Number.isInteger(value) || value < 1 || value > ceiling) throw unavailable();
    return value;
  };
  return {
    mode: env.PINTEREST_SOURCE, board: board || "", country: "AE",
    token: env.PINTEREST_ACCESS_TOKEN, secret: env.PINTEREST_SIGNING_SECRET,
    day: limit("PINTEREST_DAILY_LIMIT", 100), minute: limit("PINTEREST_MINUTE_LIMIT", 5),
    user: limit("PINTEREST_USER_DAILY_LIMIT", 30, 10),
  };
}
function scope(config) { return `${config.mode}:${config.board}:${config.country}`; }
export function signTicket(config, userId, data) {
  const payload = Buffer.from(JSON.stringify({ ...data, userId, scope: scope(config), expires: Date.now() + 300000 })).toString("base64url");
  return payload + "." + createHmac("sha256", config.secret).update(payload).digest("base64url");
}
export function readTicket(config, userId, token, kind) {
  const invalid = () => new PinterestError("This Pinterest view expired. Reload inspiration.", "PINTEREST_VIEW_EXPIRED", 400);
  if (typeof token !== "string" || token.length > 5000) throw invalid();
  const [payload, mac, extra] = token.split(".");
  const expected = createHmac("sha256", config.secret).update(payload || "").digest();
  const actual = Buffer.from(mac || "", "base64url");
  if (extra || actual.length !== expected.length || !timingSafeEqual(expected, actual)) throw invalid();
  let data; try { data = JSON.parse(Buffer.from(payload, "base64url").toString()); } catch { throw invalid(); }
  if (data.userId !== userId || data.scope !== scope(config) || data.kind !== kind ||
      !(data.expires > Date.now()) || !Object.hasOwn(topics, data.topic)) throw invalid();
  return data;
}
const shortText = (value, max) => typeof value === "string" ? value.slice(0, max) : "";
export function pinRecord(pin, config, userId, topic) {
  if (!pin || typeof pin.id !== "string" || !/^\d{1,30}$/.test(pin.id) ||
      pin.privacy != null && pin.privacy !== "PUBLIC" || (config.mode === "board" && String(pin.board_id) !== config.board)) return null;
  // Do not publish videos/products as image nail designs. Unsupported media is withheld.
  const images = pin.media?.images;
  if (!images || !["image", "multiple_images"].includes(pin.media?.media_type)) return null;
  const candidates = ["600x", "400x300", "1200x", "originals"].map(size => images[size]).filter(Boolean);
  const picture = candidates.find(image => {
    try { const url = new URL(image.url); return url.protocol === "https:" && url.hostname === "i.pinimg.com" && !url.username && !url.password && !url.port; } catch { return false; }
  });
  if (!picture) return null;
  return {
    source: "pinterest", id: String(pin.id), title: shortText(pin.title, 240),
    description: shortText(pin.description, 4000), alt_text: shortText(pin.alt_text, 4000),
    imageUrl: picture.url, pinUrl: `https://www.pinterest.com/pin/${pin.id}/`,
    creator: shortText(pin.creator?.username, 100) || null,
    detailTicket: signTicket(config, userId, { kind: "pin", pinId: pin.id, topic }),
  };
}
async function readLimited(response) {
  if (!response.body || Number(response.headers.get("content-length")) > 524288) throw new PinterestError("Pinterest returned an unsupported response.");
  const reader = response.body.getReader(); const chunks = []; let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      length += value.byteLength;
      if (length > 524288) throw new PinterestError("Pinterest returned an unsupported response.");
      chunks.push(Buffer.from(value));
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch { await reader.cancel().catch(() => undefined); throw new PinterestError("Pinterest returned an unsupported response."); }
}
async function reserveRead(db, userId, config) {
  const { data, error } = await db.rpc("reserve_pinterest_request_batch", { p_user_id: userId,
    p_day_limit: config.day, p_minute_limit: config.minute, p_user_limit: config.user,
    p_request_count: config.mode === "board" ? 2 : 1 });
  const messages = {
    minute: "LaQue’s short request limit was reached. You can retry when the pause ends.",
    user: "Today’s Pinterest viewing allowance for this beta account is used. You can retry when it resets.",
    day: "LaQue’s daily Pinterest viewing allowance is used. You can retry when it resets.",
    provider: "Pinterest has temporarily paused requests. You can retry when the pause ends.",
  };
  const retryAt = Number.isFinite(Date.parse(data?.retryAt)) ? new Date(data.retryAt).toISOString() : null;
  if (error || !data?.allowed) throw new PinterestError(
    error ? "Pinterest inspiration couldn’t load. Try again later." : messages[data?.reason] || "Pinterest requests are paused. LaQue designs are still available.",
    error ? "PINTEREST_UNAVAILABLE" : "PINTEREST_BUDGET", error ? 503 : 429, retryAt);
}
async function upstreamRead(db, config, url, isDetail = false, isVisibility = false) {
  let response;
  let retryAt = null;
  try {
    response = await fetch(url, { headers: { Authorization: `Bearer ${config.token}`, Accept: "application/json" },
      cache: "no-store", redirect: "error", signal: AbortSignal.timeout(10000) });
  } catch { throw new PinterestError("Pinterest couldn’t be reached. Try again later."); }
  if (response.status === 429 || response.headers.get("x-ratelimit-remaining") === "0") {
    const seconds = Number(response.headers.get("retry-after") || response.headers.get("x-ratelimit-reset"));
    const pause = Number.isFinite(seconds) && seconds > 0 ? Math.min(Math.ceil(seconds), 604800) : 86400;
    retryAt = new Date(Date.now() + pause * 1000).toISOString();
    const result = await db.rpc("pause_pinterest_requests", { p_seconds: pause });
    if (result.error) throw new PinterestError("Pinterest inspiration is paused.");
    if (response.ok && isVisibility) throw new PinterestError(
      "Pinterest has temporarily paused requests. You can retry when the pause ends.", "PINTEREST_BUDGET", 429, retryAt);
  }
  if (!response.ok) {
    if ([401, 403].includes(response.status)) {
      if (response.status === 401 && process.env.PINTEREST_OAUTH_MODE === '1') await (await import('./connection')).invalidateConnectedToken(db, config.token);
      await db.rpc("pause_pinterest_requests", { p_seconds: 86400 });
      throw new PinterestError("Pinterest access is unavailable. LaQue designs are still available.", "PINTEREST_ACCESS");
    }
    if (response.status === 404 && isDetail) throw new PinterestError("This Pin is no longer available.", "PINTEREST_GONE", 404);
    throw new PinterestError("Pinterest inspiration is temporarily unavailable.", response.status === 429 ? "PINTEREST_BUDGET" : "PINTEREST_UNAVAILABLE", response.status === 429 ? 429 : 503,
      retryAt);
  }
  return readLimited(response);
}
export async function inspiration(db, userId, params) {
  const topic = params.get("topic") || "all";
  if (!Object.hasOwn(topics, topic) || [...params.keys()].some(k => !["topic", "cursor", "pin"].includes(k)) ||
      params.get("cursor") && params.get("pin")) throw new PinterestError("Invalid inspiration request.", "PINTEREST_INVALID", 400);
  if (process.env.PINTEREST_OAUTH_MODE === "1" && (process.env.PINTEREST_ENABLED !== "1" || process.env.PINTEREST_SOURCE_APPROVED !== "1" || process.env.PINTEREST_ZERO_SPEND_VERIFIED !== "1" || !process.env.PINTEREST_PILOT_USER_IDS?.split(",").map(s=>s.trim()).includes(userId))) throw unavailable();
  let connection={};
  if (process.env.PINTEREST_OAUTH_MODE === "1") {
    try { connection=await (await import("./connection")).sharedConfiguration(db, topic); }
    catch(error) { throw new PinterestError(error.code==='PINTEREST_BUDGET'?'Pinterest requests are paused. Retry when the allowance resets.':'Pinterest inspiration needs a verified connection.',error.code==='PINTEREST_BUDGET'?'PINTEREST_BUDGET':'PINTEREST_ACCESS',error.status===429?429:503,error.retryAt||null); }
  }
  const config = configuration(userId, topic, connection);
  const cursor = params.get("cursor") ? readTicket(config, userId, params.get("cursor"), "page") : null;
  const detail = params.get("pin") ? readTicket(config, userId, params.get("pin"), "pin") : null;
  if (cursor && cursor.topic !== topic || detail && detail.topic !== topic) throw new PinterestError("Invalid inspiration request.", "PINTEREST_INVALID", 400);
  const url = new URL(detail ? `https://api.pinterest.com/v5/pins/${detail.pinId}` :
    config.mode === "board" ? `https://api.pinterest.com/v5/boards/${config.board}/pins` : "https://api.pinterest.com/v5/search/partner/pins");
  if (!detail) {
    if (config.mode === "board") url.searchParams.set("page_size", "24");
    else { url.searchParams.set("term", topics[topic]); url.searchParams.set("country_code", config.country); url.searchParams.set("limit", "24"); }
    if (cursor) url.searchParams.set("bookmark", cursor.bookmark);
  }
  // Reserve the entire operation before any upstream call, including the visibility check.
  await reserveRead(db, userId, config);
  if (config.mode === "board") {
    const board = await upstreamRead(db, config, new URL(`https://api.pinterest.com/v5/boards/${config.board}`), false, true);
    if (String(board.id) !== config.board || board.privacy !== "PUBLIC")
      throw new PinterestError("Pinterest’s source is no longer available.", "PINTEREST_ACCESS");
  }
  const body = await upstreamRead(db, config, url, !!detail);
  if (detail) {
    const record = pinRecord(body, config, userId, topic);
    if (!record || record.id !== detail.pinId) throw new PinterestError("This Pin is no longer available.", "PINTEREST_GONE", 404);
    return { records: [record], cursor: null, topic };
  }
  if (!Array.isArray(body.items) || body.items.length > 100 || body.bookmark != null && typeof body.bookmark !== "string") throw new PinterestError("Pinterest returned an unsupported response.");
  const seen = new Set();
  const records = body.items.slice(0, 24).map(pin => pinRecord(pin, config, userId, topic)).filter(pin => {
    if (!pin || seen.has(pin.id)) return false; seen.add(pin.id); return true;
  });
  return { records, topic, cursor: body.bookmark && body.bookmark.length <= 2000 ? signTicket(config, userId, { kind: "page", topic, bookmark: body.bookmark }) : null };
}
