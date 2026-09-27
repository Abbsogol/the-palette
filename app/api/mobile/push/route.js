import { getSessionUser, serviceClient } from "@/lib/auth";
import { mobileJson, uuidPattern } from "@/lib/mobile-auth";
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const { installationId, token, platform } = await request
    .json()
    .catch(() => ({}));
  if (
    !uuidPattern.test(installationId || "") ||
    !["ios", "android"].includes(platform) ||
    typeof token !== "string" ||
    token.length > 250
  )
    return mobileJson({ error: "Invalid device registration" }, 400);
  const { data, error } = await serviceClient.rpc("register_mobile_push", {
    p_user_id: user.id,
    p_installation: installationId,
    p_token: token,
    p_platform: platform,
  });
  if (error)
    return mobileJson(
      { error: "Notifications could not be registered. Please retry." },
      503,
    );
  return mobileJson({ registrationId: data });
}
export async function DELETE(request) {
  const user = await getSessionUser(request, { allowDeleting: true });
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const { installationId } = await request.json().catch(() => ({}));
  if (!uuidPattern.test(installationId || ""))
    return mobileJson({ error: "Invalid device" }, 400);
  const { error } = await serviceClient
    .from("mobile_push_registrations")
    .delete()
    .eq("user_id", user.id)
    .eq("installation_id", installationId);
  return error
    ? mobileJson({ error: "Could not unregister notifications" }, 503)
    : mobileJson({ ok: true });
}
