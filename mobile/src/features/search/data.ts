import { supabase } from "../../lib/supabase";
import { type Design, type Profile } from "../../lib/types";
import { selectedTerms, type SearchFilters, type SearchSort } from "./filters";
export type SearchDesignRecord = Design & {
  design_colours?: { colour_name: string | null }[];
};
export type SearchRequest = {
  query: string;
  filters: SearchFilters;
  sort: SearchSort;
};
function designQuery({ query: text, filters }: SearchRequest, head: boolean) {
  // Embedded INNER filtering keeps colors, pagination and exact totals in one RLS-protected query.
  const colors = selectedTerms("color", filters.color);
  let query = supabase
    .from("designs")
    .select(`*,design_colours${colors.length ? "!inner" : ""}(colour_name)`, {
      count: "exact",
      head,
    })
    .eq("is_published", true);
  if (text.trim())
    query = query.ilike("title", `%${text.trim().replace(/[\\%_]/g, "\\$&")}%`);
  for (const [group, column] of [
    ["vibe", "category"],
    ["shape", "shape"],
    ["length", "length"],
    ["occasion", "occasion"],
    ["technique", "technique"],
  ] as const) {
    const terms = selectedTerms(group, filters[group]);
    if (terms.length)
      query = query.or(
        terms
          .map(
            (term) =>
              `${column}.ilike.${group === "shape" || group === "length" ? term : `%${term}%`}`,
          )
          .join(","),
      );
  }
  if (colors.length)
    query = query.or(
      colors.map((term) => `colour_name.ilike.%${term}%`).join(","),
      { referencedTable: "design_colours" },
    );
  return query;
}
export async function searchDesigns(
  request: SearchRequest,
  page: number,
  signal: AbortSignal,
) {
  const { data, count, error } = await designQuery(request, false)
    .order(request.sort === "Most saved" ? "saves_count" : "created_at", {
      ascending: false,
    })
    .order("id")
    .range(page * 24, page * 24 + 23)
    .abortSignal(signal);
  if (error || data === null || count === null)
    throw new Error(error?.message || "Search results are unavailable.");
  return { records: data as unknown as SearchDesignRecord[], total: count };
}
export async function countSearchDesigns(
  request: SearchRequest,
  signal: AbortSignal,
) {
  const { count, error } = await designQuery(request, true).abortSignal(signal);
  if (error || count === null)
    throw new Error(error?.message || "The result count is unavailable.");
  return count;
}
export async function searchArtists(
  text: string,
  page: number,
  signal: AbortSignal,
) {
  const query = supabase.rpc("search_accounts", { p_query: text.trim() }, {count:"exact"});
  const { data, error, count } = await query
    .order("display_name")
    .order("id")
    .range(page * 24, page * 24 + 23)
    .abortSignal(signal);
  if (error || data === null || count === null)
    throw new Error(error?.message || "Artists could not load.");
  return {
    records: data as Pick<
      Profile,
      | "id"
      | "display_name"
      | "username"
      | "avatar_url"
      | "location"
      | "account_type"
    >[],
    total: count,
  };
}
