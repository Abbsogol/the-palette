import { getSessionUser, serviceClient } from "@/lib/auth";
import { mobileJson } from "@/lib/mobile-auth";
import { inspiration, PinterestError } from "@/lib/pinterest/inspiration";
function originAllowed(request) {
  const origin = request.headers.get("origin");
  if (!origin) return true; // Native requests use bearer authentication, not cookies.
  return (process.env.PINTEREST_WEB_ORIGINS || "").split(",").map(value => value.trim()).includes(origin);
}
function response(request, body, status = 200) {
  const result = mobileJson(body, status);
  const origin = request.headers.get("origin");
  if (origin && originAllowed(request)) {
    result.headers.set("Access-Control-Allow-Origin", origin);
    result.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
    result.headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type");
  }
  result.headers.set("Vary", "Origin");
  return result;
}
export function OPTIONS(request) {
  if (!originAllowed(request)) return response(request, { error: "Origin not permitted." }, 403);
  return new Response(null, { status: 204, headers: response(request, {}).headers });
}
export async function GET(request) {
  if (!originAllowed(request)) return response(request, { error: "Origin not permitted." }, 403);
  const user = await getSessionUser(request);
  if (!user) return response(request, { error: "Sign in to see Pinterest inspiration." }, 401);
  try { return response(request, await inspiration(serviceClient, user.id, new URL(request.url).searchParams)); }
  catch (error) {
    return response(request, { error: error instanceof PinterestError ? error.message : "Pinterest inspiration couldn’t load.",
      code: error instanceof PinterestError ? error.code : "PINTEREST_UNAVAILABLE",
      ...(error instanceof PinterestError && error.retryAt ? { retryAt: error.retryAt } : {}) }, error instanceof PinterestError ? error.status : 503);
  }
}
