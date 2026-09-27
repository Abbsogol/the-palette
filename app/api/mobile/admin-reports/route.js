import { getSessionUser, isAdmin, serviceClient as db } from "@/lib/auth";
import { mobileJson, uuidPattern } from "@/lib/mobile-auth";
async function administrator(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  if (!(await isAdmin(user.id))) return mobileJson({ error: "Forbidden" }, 403);
  return null;
}
export async function GET(request) {
  const denied = await administrator(request);
  if (denied) return denied;
  const params = new URL(request.url).searchParams;
  const status = params.get("status") || "open";
  const offset = Number(params.get("offset") || 0);
  if (
    !["open", "reviewed", "resolved"].includes(status) ||
    !Number.isSafeInteger(offset) ||
    offset < 0
  )
    return mobileJson({ error: "Invalid report filter" }, 400);
  const { data, error } = await db
    .from("mobile_reports")
    .select("id,reporter_id,target_type,target_id,reason,status,created_at")
    .eq("status", status)
    .order("created_at")
    .order("id")
    .range(offset, offset + 49);
  return error
    ? mobileJson({ error: "Unable to load reports" }, 503)
    : mobileJson({ reports: data });
}
export async function PATCH(request) {
  const denied = await administrator(request);
  if (denied) return denied;
  const body = await request.json().catch(() => ({}));
  if (
    !uuidPattern.test(body.id || "") ||
    !["open", "reviewed", "resolved"].includes(body.status)
  )
    return mobileJson({ error: "Invalid report update" }, 400);
  const { data, error } = await db
    .from("mobile_reports")
    .update({ status: body.status })
    .eq("id", body.id)
    .select("id")
    .maybeSingle();
  return error
    ? mobileJson({ error: "Report update failed" }, 503)
    : !data
      ? mobileJson({ error: "Report not found" }, 404)
      : mobileJson({ ok: true });
}
