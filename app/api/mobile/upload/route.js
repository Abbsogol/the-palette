import { randomUUID } from "node:crypto";
import { getSessionUser, serviceClient } from "@/lib/auth";
import { mobileJson, mobileUserClient, uuidPattern } from "@/lib/mobile-auth";
import { validatedImage } from "@/lib/validated-image";
export const runtime = "nodejs";
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const form = await request.formData().catch(() => null);
  if (!form) return mobileJson({ error: "Invalid upload" }, 400);
  const kind = form.get("kind"),
    conversationId = form.get("conversationId");
  if (!["design", "message", "profile-avatar", "profile-banner"].includes(kind))
    return mobileJson({ error: "Invalid upload type" }, 400);
  if (kind === "message") {
    if (!uuidPattern.test(conversationId || ""))
      return mobileJson({ error: "Invalid conversation" }, 400);
    const { data, error } = await mobileUserClient(request)
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .single();
    if (error || !data)
      return mobileJson({ error: "Conversation unavailable" }, 403);
  }

  let bytes;
  try {
    bytes = await validatedImage(form.get("file"));
  } catch (error) {
    return mobileJson({ error: error.message }, 400);
  }
  const profileMedia = kind === "profile-avatar" || kind === "profile-banner";
  const bucket = profileMedia ? "designs" : "mobile-uploads";
  const path = profileMedia ? `${kind === "profile-avatar" ? "avatars" : "banners"}/${user.id}/${randomUUID()}.webp` :
    kind === "message"
      ? `${user.id}/messages/${conversationId}/${randomUUID()}.webp`
      : `${user.id}/designs/${randomUUID()}.webp`;
  const { error: queueError } = await serviceClient
    .from("mobile_media_cleanup")
    .insert({ bucket, path, user_id: user.id });
  if (queueError)
    return mobileJson({ error: "Upload could not be prepared" }, 503);
  const { error } = await serviceClient.storage
    .from(bucket)
    .upload(path, bytes, { contentType: "image/webp", upsert: false });
  if (error)
    return mobileJson({ error: "Image upload failed. Please retry." }, 503);
  const { data: signed, error: signError } = await serviceClient.storage
    .from(bucket)
    .createSignedUrl(path, 900);
  if (signError)
    return mobileJson(
      { error: "Image uploaded but preview failed. Please retry." },
      503,
    );
  return mobileJson({
    path,
    previewUrl: signed.signedUrl,
    privateUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`,
  });
}
