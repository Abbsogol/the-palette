import { validateDesignDetails } from "@/lib/design-details";
import { randomUUID } from "node:crypto";
import { getSessionUser, serviceClient as db } from "@/lib/auth";
import { mobileJson, mobileUserClient, uuidPattern } from "@/lib/mobile-auth";
export async function GET(request) {
  const user = await getSessionUser(request);
  if (!user) return mobileJson({ error: "Unauthorized" }, 401);
  try {
    const [profile, tier] = await Promise.all([
      db
        .from("profiles_data")
        .select("weekly_uploads,week_reset_at,is_admin")
        .eq("id", user.id)
        .single(),
      db.rpc("effective_subscription_tier", { p_user_id: user.id }),
    ]);
    if (profile.error || !profile.data || tier.error)
      throw new Error("Limit unavailable");
    const reset = profile.data.week_reset_at
      ? Date.parse(profile.data.week_reset_at) + 7 * 86400000
      : null;
    const active =
      reset !== null && Number.isFinite(reset) && reset >= Date.now();
    const used = active
      ? Math.max(0, Number(profile.data.weekly_uploads) || 0)
      : 0;
    const limit =
      profile.data.is_admin || tier.data === "pro_creator" ? null : 5;
    return mobileJson({
      used,
      limit,
      remaining: limit === null ? null : Math.max(0, limit - used),
      resetsAt: active ? new Date(reset).toISOString() : null,
    });
  } catch {
    return mobileJson(
      {
        error: "Upload limits are unavailable. Retry to check your allowance.",
      },
      503,
    );
  }
}
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
  if (body.create && existing && body.detailsVersion !== 1)
    return mobileJson({ designId: existing.id });
  if (!body.create && !existing)
    return mobileJson({ error: "Design unavailable" }, 404);
  if (existing?.source_generation_id && body.imagePath)
    return mobileJson({ error: "Generated images cannot be replaced or edited. Start a new Lab generation for a different design." }, 409);
  if (existing?.source_generation_id && body.detailsVersion === 1 && (!Array.isArray(body.images) || body.images.length !== 1 || body.images[0] !== existing.image_url))
    return mobileJson({ error: "Generated images cannot be replaced or edited. Start a new Lab generation for a different design." }, 409);
  if (body.detailsVersion === 1) {
    try {
      const { fields, colours, tags } = validateDesignDetails(body);
      const prefix = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/`;
      const { data: oldImages, error: imagesError } = existing
        ? await client
            .from("design_images")
            .select("image_url")
            .eq("design_id", body.id)
        : { data: [], error: null };
      if (imagesError)
        throw new Error("Could not load existing photos. Retry.");
      const allowed = new Set([
        existing?.image_url,
        ...(oldImages || []).map((i) => i.image_url),
      ]);
      const converted = new Map();
      for (const source of body.images) {
        if (typeof source !== "string") throw new Error("Invalid photo.");
        let url = source;
        if (
          !allowed.has(url) &&
          !new RegExp(`^${user.id}/designs/[0-9a-f-]{36}\\.webp$`).test(url)
        )
          throw new Error("Invalid image ownership.");
        if (!allowed.has(url)) url = `${prefix}mobile-uploads/${url}`;
        if (converted.has(source)) continue;
        const fromBucket = url.startsWith(`${prefix}mobile-uploads/`)
          ? "mobile-uploads"
          : url.startsWith(`${prefix}nail-lab/`)
            ? "nail-lab"
            : "designs";
        if (
          fromBucket !== "designs" &&
          !url.startsWith(`${prefix}${fromBucket}/${user.id}/`)
        )
          throw new Error("Invalid private image ownership.");
        if (
          (body.isPublished && fromBucket !== "designs") ||
          (!body.isPublished && fromBucket === "designs")
        ) {
          if (!url.startsWith(`${prefix}${fromBucket}/`))
            throw new Error(
              "This image cannot be copied. Choose another photo.",
            );
          const { data: bytes, error } = await db.storage
            .from(fromBucket)
            .download(url.slice(`${prefix}${fromBucket}/`.length));
          if (error || !bytes)
            throw new Error("Photo unavailable. Retry your upload.");
          const mime =
            bytes.type ||
            (fromBucket === "nail-lab" ? "image/png" : "image/webp");
          // Normalize copies, including generated PNGs, for the private WebP bucket.
          const { validatedImage } = await import("@/lib/validated-image");
          const content = await validatedImage(
            new File([bytes], "photo", { type: mime }),
          );
          const toBucket = body.isPublished ? "designs" : "mobile-uploads";
          const path = body.isPublished
            ? `published/${user.id}/mobile-${randomUUID()}.webp`
            : `${user.id}/designs/${randomUUID()}.webp`;
          const queue = await db
            .from("mobile_media_cleanup")
            .insert({ bucket: toBucket, path, user_id: user.id });
          if (queue.error) throw new Error("Could not prepare photo.");
          const upload = await db.storage.from(toBucket).upload(path, content, {
            contentType: "image/webp",
            upsert: false,
          });
          if (upload.error) throw new Error("Could not store photo. Retry.");
          url = `${prefix}${toBucket}/${path}`;
        }
        converted.set(source, url);
      }
      const images = [...converted.values()];
      const result = await db.rpc("save_mobile_design", {
        p_user: user.id,
        p_id: body.id,
        p_fields: {
          ...fields,
          title: body.title.trim(),
          image_url: images[0],
          is_published: body.isPublished,
        },
        p_images: images.slice(1),
        p_colours: colours,
        p_tags: tags,
      });
      if (result.error?.message?.includes("WEEKLY_UPLOAD_LIMIT"))
        return mobileJson(
          {
            error:
              "Your weekly photo-design limit has been reached. Your draft is kept; try again after the allowance resets.",
            code: "UPLOAD_LIMIT",
          },
          409,
        );
      if (result.error)
        return mobileJson(
          {
            error:
              "Design was not saved. Retry; your details are kept on this screen.",
          },
          503,
        );
      return mobileJson({ designId: result.data, images });
    } catch (error) {
      return mobileJson(
        { error: error.message || "Check your design details." },
        400,
      );
    }
  }
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
  const { data, error } = await mobileUserClient(request)
    .from("designs")
    .delete()
    .eq("id", id)
    .eq("created_by", user.id)
    .select("id");
  return error
    ? mobileJson({ error: "Design could not be removed" }, 503)
    : !data?.length
      ? mobileJson({ error: "Design unavailable or already removed." }, 404)
      : mobileJson({ ok: true });
}
