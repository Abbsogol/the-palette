import { supabase } from "./supabase";
import { checked } from "./api";
import type { Design } from "./types";
import { environment } from "./config";

export type DesignFilters = {
  query?: string;
  vibe?: string;
  shape?: string;
  length?: string;
  sort?: string;
  creator?: string;
};
export async function listDesigns(
  filters: DesignFilters,
  page: number,
  signal: AbortSignal,
) {
  let query = supabase.from("designs").select("*").eq("is_published", true);
  if (filters.query?.trim())
    query = query.ilike(
      "title",
      `%${filters.query.trim().replace(/[%_]/g, "")}%`,
    );
  if (filters.vibe && filters.vibe !== "All")
    query = query.ilike("category", filters.vibe);
  if (filters.shape && filters.shape !== "All")
    query = query.eq("shape", filters.shape);
  if (filters.length && filters.length !== "All")
    query = query.eq("length", filters.length);
  if (filters.creator) query = query.eq("created_by", filters.creator);
  return checked<Design[]>(
    query
      .order(filters.sort === "Most saved" ? "saves_count" : "created_at", {
        ascending: false,
      })
      .order("id")
      .range(page * 24, page * 24 + 23)
      .abortSignal(signal),
  );
}
export async function resolvePrivateImage(
  url: string | null,
): Promise<string | null> {
  if (!url) return null;
  const bucket = url.startsWith(
    `${environment.supabaseUrl}/storage/v1/object/public/mobile-uploads/`,
  )
    ? "mobile-uploads"
    : "nail-lab";
  const prefix = `${environment.supabaseUrl}/storage/v1/object/public/${bucket}/`;
  if (!url.startsWith(prefix)) return url;
  const path = url.slice(prefix.length);
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 900);
  if (error || !data?.signedUrl)
    throw new Error("This private image is unavailable.");
  return data.signedUrl;
}
export async function setSaved(
  userId: string,
  designId: string,
  saved: boolean,
) {
  if (saved)
    await checked(
      supabase
        .from("saved_designs")
        .upsert(
          { user_id: userId, design_id: designId },
          { onConflict: "user_id,design_id", ignoreDuplicates: true },
        )
        .select("id"),
    );
  else
    await checked(
      supabase
        .from("saved_designs")
        .delete()
        .eq("user_id", userId)
        .eq("design_id", designId)
        .select("id"),
    );
}
