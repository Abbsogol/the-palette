import { checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { resolvePrivateImage } from "../../lib/designs";
import { accountScope } from "../../lib/account-scope";
import type { Design } from "../../lib/types";
import type { DetailModel } from "./model";

export type DetailRecord = Design & {
  source_generation_id?: string | null;
  design_images: { id: string; image_url: string; image_order: number }[];
  design_colours: {
    id: string;
    colour_name: string | null;
    hex_code: string | null;
    brand_name: string | null;
    brand_code: string | null;
    colour_order: number;
  }[];
  design_tags: { tags: { name: string } | { name: string }[] | null }[];
};
const unique = (values: (string | null | undefined)[]) => [
  ...new Set(values.map((v) => v?.trim()).filter((v): v is string => !!v)),
];

export async function detailModel(
  record: DetailRecord,
  options?: { allowUnavailablePhotos?: boolean },
): Promise<DetailModel> {
  const ticket = accountScope.capture();
  // Deduplicate before signing: two URLs for the same object must not become two slides.
  const urls = unique([
    record.image_url,
    ...[...(record.design_images || [])]
      .sort((a, b) => a.image_order - b.image_order)
      .map((image) => image.image_url),
  ]);
  const photos = await Promise.all(
    urls.map(async (url, i) => ({
      id: `${record.id}-photo-${i}`,
      source: await resolvePrivateImage(url).catch((error) => {
        if (options?.allowUnavailablePhotos) return url;
        throw error;
      }),
    })),
  );
  accountScope.assert(ticket);
  return {
    id: record.id,
    title: record.title,
    description: record.description || "",
    photos: photos.filter(
      (photo): photo is { id: string; source: string } => !!photo.source,
    ),
    closeups: photos
      .slice(1)
      .filter(
        (photo): photo is { id: string; source: string } => !!photo.source,
      ),
    techniques: unique([
      record.shape,
      record.length,
      ...(record.technique || "").split(","),
      record.category,
      record.occasion,
    ]),
    colours: [...(record.design_colours || [])]
      .sort((a, b) => a.colour_order - b.colour_order)
      .map((colour) => ({
        id: colour.id,
        name:
          [colour.colour_name, colour.brand_name].filter(Boolean).join(" · ") ||
          "Colour",
        code: colour.brand_code || colour.hex_code || "",
        hex: /^#[0-9a-f]{6}$/i.test(colour.hex_code || "")
          ? colour.hex_code!
          : undefined,
      })),
    tags: unique(
      (record.design_tags || []).flatMap(({ tags }) =>
        Array.isArray(tags) ? tags.map((tag) => tag.name) : [tags?.name],
      ),
    ),
    saves: Math.max(0, record.saves_count || 0),
  };
}

export async function loadDetail(
  id: string,
  signal: AbortSignal,
  options?: { allowUnavailablePhotos?: boolean },
) {
  // Both parent and children remain protected by the signed-in/anonymous client's RLS.
  const record = await checked<DetailRecord>(
    supabase
      .from("designs")
      .select(
        "*,design_images(id,image_url,image_order),design_colours(id,colour_name,hex_code,brand_name,brand_code,colour_order),design_tags(tags(name))",
      )
      .eq("id", id)
      .abortSignal(signal)
      .single(),
  );
  return { record, model: await detailModel(record, options) };
}
