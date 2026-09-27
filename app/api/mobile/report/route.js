import { getSessionUser, serviceClient } from "@/lib/auth";
import { mobileJson, mobileUserClient, uuidPattern } from "@/lib/mobile-auth";
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const { targetType, targetId, reason } = await request
    .json()
    .catch(() => ({}));
  const tables = {
    profile: "profiles",
    design: "designs",
    message: "messages",
  };
  if (
    !Object.hasOwn(tables, targetType) ||
    !uuidPattern.test(targetId || "") ||
    typeof reason !== "string" ||
    reason.trim().length < 3 ||
    reason.length > 2000
  )
    return mobileJson(
      { error: "Choose a valid target and explain your report." },
      400,
    );
  const { data, error } = await mobileUserClient(request)
    .from(tables[targetType])
    .select("id")
    .eq("id", targetId)
    .maybeSingle();
  if (error || !data)
    return mobileJson({ error: "This content is unavailable." }, 404);
  const { error: saveError } = await serviceClient
    .from("mobile_reports")
    .upsert(
      {
        reporter_id: user.id,
        target_type: targetType,
        target_id: targetId,
        reason: reason.trim(),
      },
      { onConflict: "reporter_id,target_type,target_id" },
    );
  return saveError
    ? mobileJson({ error: "Report could not be submitted. Please retry." }, 503)
    : mobileJson({ ok: true });
}
