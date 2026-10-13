import { accountScope } from "../../lib/account-scope";
import { checked } from "../../lib/api";
import { supabase } from "../../lib/supabase";
import { resolvePrivateImage } from "../../lib/designs";
import type { Design } from "../../lib/types";
import type { PortfolioFilter, PortfolioItem } from "./manager";
export async function loadPortfolio(
  owner: string,
  filter: PortfolioFilter,
  limit: number,
  signal: AbortSignal,
) {
  const ticket = accountScope.capture();
  let query = supabase.from("designs").select("*").eq("created_by", owner);
  if (filter !== "All")
    query = query.eq("is_published", filter === "Published");
  const records = await checked<Design[]>(
    query
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(0, limit)
      .abortSignal(signal),
  );
  const items: PortfolioItem[] = await Promise.all(
    records.slice(0, limit).map(async (d) => ({
      id: d.id,
      title: d.title,
      published: d.is_published,
      shape: d.shape,
      length: d.length,
      category: d.category,
      image: await resolvePrivateImage(d.image_url).catch(() => null),
    })),
  );
  accountScope.assert(ticket);
  return { items, hasMore: records.length > limit };
}
