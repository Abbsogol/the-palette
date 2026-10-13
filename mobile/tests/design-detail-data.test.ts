import {
  detailModel,
  loadDetail,
  type DetailRecord,
} from "../src/features/design-detail/data";
import { resolvePrivateImage } from "../src/lib/designs";
import { accountScope } from "../src/lib/account-scope";
import { supabase } from "../src/lib/supabase";
jest.mock("../src/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../src/lib/designs", () => ({ resolvePrivateImage: jest.fn() }));
const record: DetailRecord = {
  id: "design-a",
  title: "My nails",
  description: "Mine",
  image_url: "main",
  created_by: "creator-a",
  category: "Gothic",
  shape: "Stiletto",
  length: "Long",
  technique: "Gel",
  occasion: "Editorial",
  saves_count: 5,
  is_published: false,
  created_at: "2026-09-28",
  design_images: [
    { id: "2", image_url: "second", image_order: 2 },
    { id: "0", image_url: "main", image_order: 0 },
    { id: "1", image_url: "first", image_order: 1 },
  ],
  design_colours: [
    {
      id: "2",
      colour_name: null,
      hex_code: "invalid",
      brand_name: "Brand",
      brand_code: "ABC",
      colour_order: 2,
    },
    {
      id: "1",
      colour_name: "Ivory",
      hex_code: "#D8D4CC",
      brand_name: null,
      brand_code: null,
      colour_order: 1,
    },
  ],
  design_tags: [
    { tags: { name: "gothic" } },
    { tags: [{ name: "gothic" }, { name: "ivory" }] },
    { tags: null },
  ],
};
beforeEach(() => {
  accountScope.change("customer-a", true);
  jest
    .mocked(resolvePrivateImage)
    .mockReset()
    .mockImplementation(async (url) => `signed:${url}`);
});
test("all photographs are signed, ordered and deduplicated; colours and tags retain their real values", async () => {
  const d = await detailModel(record);
  expect(d.photos.map((p) => p.source)).toEqual([
    "signed:main",
    "signed:first",
    "signed:second",
  ]);
  expect(resolvePrivateImage).toHaveBeenCalledTimes(3);
  expect(d.closeups.map((p) => p.source)).toEqual([
    "signed:first",
    "signed:second",
  ]);
  expect(d.colours.map((c) => c.code)).toEqual(["#D8D4CC", "ABC"]);
  expect(d.colours[1].hex).toBeUndefined();
  expect(d.tags).toEqual(["gothic", "ivory"]);
  expect(d.reviewCount).toBeUndefined();
});
test("failed private image signing rejects instead of falling back to a public URL", async () => {
  jest
    .mocked(resolvePrivateImage)
    .mockRejectedValue(new Error("Private image unavailable"));
  await expect(detailModel(record)).rejects.toThrow(
    "Private image unavailable",
  );
});
test("late signed URLs from a previous account are discarded", async () => {
  jest.mocked(resolvePrivateImage).mockImplementation(async (url) => {
    accountScope.change("customer-b");
    return `signed:${url}`;
  });
  await expect(detailModel(record)).rejects.toThrow("Your account changed");
});
test("permission denial from the detail query does not fetch images or expose fallback data", async () => {
  const b: Record<string, jest.Mock> = {};
  for (const method of ["select", "eq", "abortSignal", "single"])
    b[method] = jest.fn(() => b);
  b.then = jest.fn((resolve) =>
    resolve({ data: null, error: { message: "Not permitted" } }),
  );
  jest.mocked(supabase.from).mockReturnValue(b as never);
  const signal = new AbortController().signal;
  await expect(loadDetail("design-a", signal)).rejects.toThrow("Not permitted");
  expect(b.eq).toHaveBeenCalledWith("id", "design-a");
  expect(b.abortSignal).toHaveBeenCalledWith(signal);
  expect(resolvePrivateImage).not.toHaveBeenCalled();
});
test("the owner editor can keep canonical media references when signing fails, while the public detail still requires usable photos", async () => {
  jest
    .mocked(resolvePrivateImage)
    .mockRejectedValue(new Error("Photo unavailable"));
  await expect(detailModel(record)).rejects.toThrow("Photo unavailable");
  const draft = await detailModel(record, { allowUnavailablePhotos: true });
  expect(draft.photos.map((p) => p.source)).toEqual([
    "main",
    "first",
    "second",
  ]);
  expect(draft.title).toBe("My nails");
});
