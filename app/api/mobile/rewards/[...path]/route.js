import { getSessionUser, serviceClient as db } from "@/lib/auth";
import { mobileUserClient, uuidPattern } from "@/lib/mobile-auth";
import { AdminError } from "@/lib/admin/auth";
import {
  checkedRewards,
  validCountry,
  rewardsEnabled,
} from "@/lib/rewards/data";
const response = (body, status = 200) =>
  Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "Access-Control-Allow-Origin": "*",
      "X-Content-Type-Options": "nosniff",
    },
  });
const failure = (e) =>
  response(
    {
      error:
        e instanceof AdminError
          ? e.message
          : "Rewards is temporarily unavailable.",
      code: e instanceof AdminError ? e.code : "REWARDS_UNAVAILABLE",
    },
    e instanceof AdminError ? e.status : 503,
  );
async function identity(request) {
  const u = await getSessionUser(request);
  if (!u) throw new AdminError("Sign in to continue.", 401);
  if (!u.email_confirmed_at)
    throw new AdminError(
      "Verify your LaQue account to continue.",
      403,
      "VERIFIED_ACCOUNT_REQUIRED",
    );
  return u;
}
async function pathOf(context) {
  const path = (await context.params).path;
  if (
    !path ||
    !["updates", "campaigns", "country", "entries"].includes(path[0]) ||
    path.length > 2 ||
    (path[0] === "entries" && path.length !== 1) ||
    (path[1] && !uuidPattern.test(path[1]))
  )
    throw new AdminError("Invalid Rewards route.", 404);
  return path;
}
async function signedOriginal(request, url) {
  if (!url) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url.startsWith(`${base}/storage/v1/object/public/`))
    throw new AdminError("Entry image is unavailable.", 503);
  const rest = url.slice(`${base}/storage/v1/object/public/`.length),
    bucket = rest.split("/")[0],
    path = rest.slice(bucket.length + 1);
  if (
    !["nail-lab", "mobile-uploads", "designs"].includes(bucket) ||
    !path ||
    path.includes("..") ||
    /[%\\?#]/.test(path)
  )
    throw new AdminError("Entry image is unavailable.", 503);
  const r = await mobileUserClient(request)
    .storage.from(bucket)
    .createSignedUrl(path, 60);
  return r.error ? null : r.data?.signedUrl || null;
}
export async function GET(request, context) {
  try {
    const user = await identity(request),
      path = await pathOf(context),
      offset = Number(new URL(request.url).searchParams.get("offset") || 0);
    if (!Number.isInteger(offset) || offset < 0 || offset > 100000)
      throw new AdminError("Invalid page.");
    const entry = new URL(request.url).searchParams.get("entry");
    if (entry && !uuidPattern.test(entry))
      throw new AdminError("Invalid shared entry.");
    if (path[0] === "entries") {
      const feed = await checkedRewards(db.rpc("rewards_home_entries", {
        p_user: user.id, p_offset: offset,
      }));
      return response({
        country: feed.country,
        enabled: !!feed.enabled && rewardsEnabled(),
        hasMore: feed.items.length > 25,
        items: await Promise.all(feed.items.slice(0,25).map(async e => ({
          ...e, snapshot: {...e.snapshot,image_url: await signedOriginal(request,e.snapshot.image_url)},
        }))),
      });
    }
    const result = await checkedRewards(
      db.rpc("rewards_member_read", {
        p_user: user.id,
        p_section: path[0],
        p_id: path[1] || null,
        p_offset: offset,
        p_entry: entry || null,
      }),
    );
    result.enabled = !!result.enabled && rewardsEnabled();
    // Sign as the member, preserving storage RLS, author privacy and moderation.
    if (result.winners)
      result.winners = await Promise.all(
        result.winners.map(async (e) => ({
          ...e,
          snapshot: {
            ...e.snapshot,
            image_url: await signedOriginal(request, e.snapshot.image_url),
          },
        })),
      );
    if (result.campaign) {
      result.items = await Promise.all(
        result.items.map(async (e) => ({
          ...e,
          snapshot: {
            ...e.snapshot,
            image_url: await signedOriginal(request, e.snapshot.image_url),
          },
        })),
      );
      result.ownItems = await Promise.all(
        result.ownItems.map(async (e) => ({
          ...e,
          snapshot: {
            ...e.snapshot,
            image_url: await signedOriginal(request, e.snapshot.image_url),
          },
        })),
      );
      result.candidates = await Promise.all(
        result.candidates.map(async (d) => ({
          ...d,
          image_url: await signedOriginal(request, d.image_url),
        })),
      );
    }
    return response(result);
  } catch (e) {
    return failure(e);
  }
}
export async function POST(request, context) {
  try {
    const user = await identity(request),
      path = await pathOf(context),
      raw = await request.text();
    if (new TextEncoder().encode(raw).length > 4096)
      throw new AdminError("Request is too large.", 413);
    let body;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AdminError("Invalid request.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new AdminError("Invalid request.");
    if (path[0] === "country" && !path[1]) {
      if (
        Object.keys(body).some((k) => k !== "country") ||
        !validCountry(body.country)
      )
        throw new AdminError("Choose a valid profile country.");
      await checkedRewards(
        db.rpc("reward_profile_country", {
          p_user: user.id,
          p_country: body.country,
        }),
      );
      return response({ country: body.country });
    }
    if (
      path[0] !== "campaigns" ||
      !path[1] ||
      !["submit", "vote"].includes(body.action)
    )
      throw new AdminError("Invalid action.");
    if (!rewardsEnabled())
      throw new AdminError(
        "Prize competitions are not activated yet.",
        409,
        "ACTIVATION_DISABLED",
      );
    const data =
      body.action === "submit"
        ? {
            designId: body.designId,
            acceptedRules: body.acceptedRules,
            rulesVersion: body.rulesVersion,
          }
        : { entryId: body.entryId, liked: body.liked };
    if (
      (body.action === "submit" &&
        (!uuidPattern.test(body.designId || "") ||
          body.acceptedRules !== true ||
          !Number.isInteger(body.rulesVersion))) ||
      (body.action === "vote" &&
        (!uuidPattern.test(body.entryId || "") ||
          typeof body.liked !== "boolean"))
    )
      throw new AdminError("Check your selection.");
    return response(
      await checkedRewards(
        db.rpc("rewards_member_action", {
          p_user: user.id,
          p_campaign: path[1],
          p_action: body.action,
          p_data: data,
        }),
      ),
    );
  } catch (e) {
    return failure(e);
  }
}
export function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Authorization, Content-Type",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    },
  });
}
