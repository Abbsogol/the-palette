import { randomUUID } from "node:crypto";
import { getSessionUser, serviceClient as db } from "@/lib/auth";
import { mobileJson, mobileUserClient, uuidPattern } from "@/lib/mobile-auth";
export async function POST(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const body = await request.json().catch(() => ({}));
  if (
    !uuidPattern.test(body.id || "") ||
    typeof body.title !== "string" ||
    !body.title.trim() ||
    body.title.length > 150 ||
    typeof body.isPublished !== "boolean"
  )
    return mobileJson(
      { error: "Enter a title and valid design details." },
      400,
    );
  const client = mobileUserClient(request);
  const { data: existing, error: readError } = await client
    .from("designs")
    .select("*")
    .eq("id", body.id)
    .eq("created_by", user.id)
    .maybeSingle();
  if (readError)
    return mobileJson({ error: "Could not read this design" }, 503);
  if (body.create && existing) return mobileJson({ designId: existing.id });
  if (!body.create && !existing)
    return mobileJson({ error: "Design unavailable" }, 404);
  let image = existing?.image_url;
  const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
  if (body.imagePath) {
    if (
      typeof body.imagePath !== "string" ||
      !new RegExp(`^${user.id}/designs/[0-9a-f-]{36}\\.webp$`).test(
        body.imagePath,
      )
    )
      return mobileJson({ error: "Invalid image ownership" }, 400);
    image = `${prefix}mobile-uploads/${body.imagePath}`;
  }
  if (!image) return mobileJson({ error: "Choose an image first" }, 400);
  try {
    const privatePrefix = `${prefix}mobile-uploads/${user.id}/designs/`;
    const publicPrefix = `${prefix}designs/published/${user.id}/mobile-`;
    if (
      (body.isPublished && image.startsWith(privatePrefix)) ||
      (!body.isPublished && image.startsWith(publicPrefix))
    ) {
      const fromBucket = image.startsWith(privatePrefix)
        ? "mobile-uploads"
        : "designs";
      const fromPath = image.slice(`${prefix}${fromBucket}/`.length);
      const toBucket = body.isPublished ? "designs" : "mobile-uploads";
      const toPath = body.isPublished
        ? `published/${user.id}/mobile-${randomUUID()}.webp`
        : `${user.id}/designs/${randomUUID()}.webp`;
      const { data: bytes, error } = await db.storage
        .from(fromBucket)
        .download(fromPath);
      if (error || !bytes) throw error || new Error("Source image unavailable");
      const { error: queueError } = await db
        .from("mobile_media_cleanup")
        .insert({ bucket: toBucket, path: toPath, user_id: user.id });
      if (queueError) throw queueError;
      const { error: uploadError } = await db.storage
        .from(toBucket)
        .upload(toPath, new Uint8Array(await bytes.arrayBuffer()), {
          contentType: "image/webp",
          upsert: false,
        });
      if (uploadError) throw uploadError;
      image = `${prefix}${toBucket}/${toPath}`;
    } else if (body.isPublished && image.startsWith(`${prefix}nail-lab/`))
      return mobileJson(
        { error: "Publish this generated design from your Lab history." },
        409,
      );
    const text = (key, max) =>
      typeof body[key] === "string"
        ? body[key].trim().slice(0, max)
        : existing?.[key] || null;
    const fields = {
      title: body.title.trim(),
      description: text("description", 2000),
      shape: text("shape", 40),
      length: text("length", 40),
      category: text("category", 40),
      image_url: image,
      is_published: body.isPublished,
    };
    const result = existing
      ? await client
          .from("designs")
          .update(fields)
          .eq("id", body.id)
          .eq("created_by", user.id)
          .select("id")
          .single()
      : await client
          .from("designs")
          .insert({
            ...fields,
            id: body.id,
            created_by: user.id,
            is_curated: false,
          })
          .select("id")
          .single();
    if (result.error || !result.data)
      throw result.error || new Error("Design was not saved");
    return mobileJson({ designId: result.data.id });
  } catch {
    return mobileJson(
      {
        error:
          "Design was not saved. Check your upload limit and retry. Unused uploads are cleaned up automatically.",
      },
      503,
    );
  }
}
export async function DELETE(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  const { id } = await request.json().catch(() => ({}));
  if (!uuidPattern.test(id || ""))
    return mobileJson({ error: "Invalid design" }, 400);
  const { error } = await mobileUserClient(request)
    .from("designs")
    .delete()
    .eq("id", id)
    .eq("created_by", user.id);
  return error
    ? mobileJson({ error: "Design could not be removed" }, 503)
    : mobileJson({ ok: true });
}
