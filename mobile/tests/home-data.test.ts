import {
  homeCommunityCounts,
  listHomeDesigns,
  rankForYou,
} from "../src/features/home/data";
import { supabase } from "../src/lib/supabase";
import type { Design } from "../src/lib/types";

jest.mock("../src/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
const design = (id: string, values: Partial<Design> = {}): Design => ({
  id,
  title: id,
  description: null,
  image_url: null,
  created_by: "creator",
  category: "Minimal",
  shape: "Oval",
  length: "Short",
  technique: null,
  occasion: null,
  saves_count: 0,
  is_published: true,
  created_at: "2026-09-28T00:00:00Z",
  ...values,
});
function query(
  data: unknown,
  count: number | null = null,
  error: unknown = null,
) {
  const builder: Record<string, jest.Mock> = {};
  for (const method of [
    "select",
    "eq",
    "gte",
    "in",
    "order",
    "limit",
    "range",
    "ilike",
    "or",
    "abortSignal",
  ])
    builder[method] = jest.fn(() => builder);
  builder.then = jest.fn((resolve) => resolve({ data, count, error }));
  return builder;
}

test("For you respects declared preferences and never mutates the query cache", () => {
  const popular = design("popular", { saves_count: 10000 });
  const matched = design("matched", {
    shape: "Almond",
    technique: "Chrome, foil",
    occasion: "Wedding",
  });
  const cache = [popular, matched];
  expect(
    rankForYou(cache, {
      nail_shape: "almond",
      occasions: ["wedding"],
      nail_techniques: ["chrome"],
    }).map((d) => d.id),
  ).toEqual(["matched", "popular"]);
  expect(cache).toEqual([popular, matched]);
});

test.each(["Most saved", "For you"] as const)(
  "New This Week keeps a seven-day cutoff and newest ordering even with %s selected",
  async (sort) => {
    const now = jest
      .spyOn(Date, "now")
      .mockReturnValue(Date.parse("2026-09-28T12:00:00Z"));
    try {
      const rows = [design("new"), design("popular", { saves_count: 9999 })];
      const catalog = query(rows);
      jest.mocked(supabase.from).mockReturnValue(catalog as never);
      expect(
        await listHomeDesigns("week", new AbortController().signal, {
          tab: "Explore",
          category: "Dark",
          sort,
          limit: 24,
        }),
      ).toEqual(rows);
      expect(catalog.eq).toHaveBeenCalledWith("is_published", true);
      expect(catalog.gte).toHaveBeenCalledWith(
        "created_at",
        "2026-09-21T12:00:00.000Z",
      );
      expect(catalog.ilike).toHaveBeenCalledWith("category", "%Dark%");
      expect(catalog.order).toHaveBeenNthCalledWith(1, "created_at", {
        ascending: false,
      });
    } finally {
      now.mockRestore();
    }
  },
);

test("community totals use visible creator and post counts, including a real zero", async () => {
  const artists = query(null, 17),
    posts = query(null, 0);
  jest
    .mocked(supabase.from)
    .mockImplementation(
      (table) => (table === "profiles" ? artists : posts) as never,
    );
  expect(await homeCommunityCounts(new AbortController().signal)).toEqual({
    artists: 17,
    posts: 0,
  });
  expect(artists.select).toHaveBeenCalledWith("id", {
    count: "exact",
    head: true,
  });
  expect(artists.in).toHaveBeenCalledWith("account_type", ["creator", "salon"]);
});

test("unavailable community counts fail instead of inventing zero totals", async () => {
  jest.mocked(supabase.from).mockReturnValue(query(null) as never);
  await expect(
    homeCommunityCounts(new AbortController().signal),
  ).rejects.toThrow("Community totals are unavailable.");
});

test("an empty following list does not fall back to public designs", async () => {
  const catalog = query([design("stranger")]),
    follows = query([]);
  jest
    .mocked(supabase.from)
    .mockImplementation(
      (table) => (table === "follows" ? follows : catalog) as never,
    );
  const result = await listHomeDesigns(
    "library",
    new AbortController().signal,
    {
      tab: "Following",
      category: "All",
      sort: "Newest",
      limit: 24,
      userId: "customer",
    },
  );
  expect(result).toEqual([]);
  expect(catalog.then).not.toHaveBeenCalled();
});

test("community filters and popularity sorting apply to the server query, before limiting results", async () => {
  const catalog = query([design("dark", { category: "Dark Glam" })]);
  jest.mocked(supabase.from).mockReturnValue(catalog as never);
  await listHomeDesigns("library", new AbortController().signal, {
    tab: "Community",
    category: "Dark",
    sort: "Most saved",
    limit: 48,
  });
  expect(catalog.eq).not.toHaveBeenCalled();
});
