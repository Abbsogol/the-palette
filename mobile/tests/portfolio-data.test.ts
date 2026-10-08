import { loadPortfolio } from "../src/features/portfolio/data";
import { accountScope } from "../src/lib/account-scope";
import { supabase } from "../src/lib/supabase";
import { checked } from "../src/lib/api";
import { resolvePrivateImage } from "../src/lib/designs";
jest.mock("../src/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../src/lib/api", () => ({ checked: jest.fn() }));
jest.mock("../src/lib/designs", () => ({ resolvePrivateImage: jest.fn() }));
let chain: any;
beforeEach(() => {
  accountScope.change("owner", true);
  chain = {};
  for (const method of ["select", "eq", "order", "range", "abortSignal"])
    chain[method] = jest.fn(() => chain);
  jest.mocked(supabase.from).mockReturnValue(chain);
  jest
    .mocked(resolvePrivateImage)
    .mockImplementation(async (url) => "signed:" + url);
});
afterEach(() => accountScope.change(null));
test("private drafts are owner scoped, deterministically paged and use one sentinel row for more", async () => {
  jest.mocked(checked).mockResolvedValue([
    { id: "a", title: "First", is_published: false, image_url: "a" },
    { id: "b", title: "Second", is_published: false, image_url: "b" },
  ]);
  const signal = new AbortController().signal;
  const result = await loadPortfolio("owner", "Drafts", 1, signal);
  expect(chain.eq.mock.calls).toEqual([
    ["created_by", "owner"],
    ["is_published", false],
  ]);
  expect(chain.order.mock.calls).toEqual([
    ["created_at", { ascending: false }],
    ["id", { ascending: false }],
  ]);
  expect(chain.range).toHaveBeenCalledWith(0, 1);
  expect(chain.abortSignal).toHaveBeenCalledWith(signal);
  expect(result).toEqual({
    items: [expect.objectContaining({ id: "a", image: "signed:a" })],
    hasMore: true,
  });
  expect(resolvePrivateImage).toHaveBeenCalledTimes(1);
});
test("unavailable private photo does not hide the owner’s editable metadata", async () => {
  jest
    .mocked(checked)
    .mockResolvedValue([
      { id: "a", title: "Kept", is_published: true, image_url: "missing" },
    ]);
  jest
    .mocked(resolvePrivateImage)
    .mockRejectedValue(new Error("Signing failed"));
  expect(
    await loadPortfolio("owner", "All", 20, new AbortController().signal),
  ).toEqual({
    items: [expect.objectContaining({ title: "Kept", image: null })],
    hasMore: false,
  });
});
test("account change during signing discards even a partially failed list", async () => {
  jest
    .mocked(checked)
    .mockResolvedValue([{ id: "a", title: "Private", image_url: "a" }]);
  jest.mocked(resolvePrivateImage).mockImplementation(async () => {
    accountScope.change("other");
    throw new Error("Account changed");
  });
  await expect(
    loadPortfolio("owner", "All", 20, new AbortController().signal),
  ).rejects.toThrow("Your account changed");
});
