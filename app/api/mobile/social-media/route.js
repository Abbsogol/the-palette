import { randomUUID } from "node:crypto";
import { getSessionUser, serviceClient } from "@/lib/auth";
import { mobileJson } from "@/lib/mobile-auth";
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const { mime } = await request.json().catch(() => ({}));
  const extensions = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/avif": "avif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
  };
  if (!Object.hasOwn(extensions, mime))
    return mobileJson(
      { error: "Choose a supported photo or an MP4/MOV video." },
      400,
    );
  const path = `${user.id}/${randomUUID()}.${extensions[mime]}`;
  const queued = await serviceClient
    .from("mobile_media_cleanup")
    .insert({ bucket: "social-media", path, user_id: user.id });
  if (queued.error)
    return mobileJson({ error: "Could not prepare upload." }, 503);
  const { data, error } = await serviceClient.storage
    .from("social-media")
    .createSignedUploadUrl(path);
  if (error) return mobileJson({ error: "Upload unavailable. Retry." }, 503);
  return mobileJson({ path, token: data.token });
}
