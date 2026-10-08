import { supabase } from "../src/lib/supabase";
import { countSearchDesigns, searchDesigns } from "../src/features/search/data";
import {
  emptyFilters,
  toggleFilter,
  selectedTerms,
} from "../src/features/search/filters";
jest.mock("../src/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
function builder({
  count = 3,
  data = [{ id: "a" }],
  error = null,
}: {
  count?: number | null;
  data?: unknown[] | null;
  error?: { message: string } | null;
} = {}) {
  const b: Record<string, jest.Mock> = {};
  for (const name of [
    "select",
    "eq",
    "ilike",
    "or",
    "order",
    "range",
    "abortSignal",
  ])
    b[name] = jest.fn(() => b);
  b.then = jest.fn((resolve) => resolve({ data, count, error }));
  return b;
}
test("results and count apply identical server-side filters, including colors, before pagination", async () => {
  const b = builder();
  jest.mocked(supabase.from).mockReturnValue(b as never);
  const request = {
    query: "rose",
    sort: "Most saved" as const,
    filters: {
      ...emptyFilters(),
      vibe: ["Y2k & Retro"],
      color: ["Mauve", "Red"],
      shape: ["Oval", "Ballerina"],
      length: ["Long"],
      occasion: ["Holiday"],
      technique: ["Gel"],
    },
  };
  await searchDesigns(request, 1, new AbortController().signal);
  expect(b.select).toHaveBeenCalledWith("*,design_colours!inner(colour_name)", {
    count: "exact",
    head: false,
  });
  expect(b.eq).toHaveBeenCalledWith("is_published", true);
  expect(b.or).toHaveBeenCalledWith("shape.ilike.oval,shape.ilike.ballerina");
  expect(b.or).toHaveBeenCalledWith("length.ilike.long");
  expect(b.or).toHaveBeenCalledWith(
    expect.stringContaining("colour_name.ilike.%mauve%"),
    { referencedTable: "design_colours" },
  );
  expect(b.range).toHaveBeenCalledWith(24, 47);
  expect(b.order).toHaveBeenNthCalledWith(1, "saves_count", {
    ascending: false,
  });
  const resultFilters = b.or.mock.calls;
  b.or.mockClear();
  expect(await countSearchDesigns(request, new AbortController().signal)).toBe(
    3,
  );
  expect(b.or.mock.calls).toEqual(resultFilters);
  expect(b.select).toHaveBeenLastCalledWith(
    "*,design_colours!inner(colour_name)",
    { count: "exact", head: true },
  );
});
test("free text stays a bound filter value and invalid option strings cannot enter raw filter grammar", async () => {
  const b = builder();
  jest.mocked(supabase.from).mockReturnValue(b as never);
  await searchDesigns(
    {
      query: "rose%,id.eq.secret",
      sort: "Newest",
      filters: {
        ...emptyFilters(),
        shape: ["Oval", "x),is_published.eq.false"],
      },
    },
    0,
    new AbortController().signal,
  );
  expect(b.ilike).toHaveBeenCalledWith("title", "%rose\\%,id.eq.secret%");
  expect(b.or).toHaveBeenCalledWith("shape.ilike.oval");
  expect(selectedTerms("color", ["not an option"])).toEqual([]);
});
test("zero results and unavailable totals are distinct", async () => {
  jest
    .mocked(supabase.from)
    .mockReturnValue(builder({ count: 0, data: [] }) as never);
  const req = { query: "", filters: emptyFilters(), sort: "Newest" as const };
  expect(await searchDesigns(req, 0, new AbortController().signal)).toEqual({
    records: [],
    total: 0,
  });
  jest.mocked(supabase.from).mockReturnValue(builder({ count: null }) as never);
  await expect(
    countSearchDesigns(req, new AbortController().signal),
  ).rejects.toThrow("unavailable");
});
test("multi-selection is reversible without mutating applied filters", () => {
  const applied = emptyFilters();
  const draft = toggleFilter(
    toggleFilter(applied, "shape", "Oval"),
    "shape",
    "Ballerina",
  );
  expect(draft.shape).toEqual(["Oval", "Ballerina"]);
  expect(applied.shape).toEqual([]);
  expect(toggleFilter(draft, "shape", "Oval").shape).toEqual(["Ballerina"]);
});
