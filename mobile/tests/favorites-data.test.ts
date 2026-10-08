import { loadFavorites, changeFavorite } from "../src/features/favorites/data";
import { supabase } from "../src/lib/supabase";
import { accountScope } from "../src/lib/account-scope";
import { resolvePrivateImage, setSaved } from "../src/lib/designs";
jest.mock("../src/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../src/lib/designs", () => ({
  resolvePrivateImage: jest.fn(async (url: string | null) => url),
  setSaved: jest.fn(),
}));
type Builder = Record<string, jest.Mock>;
function builder(data: unknown, error: unknown = null): Builder {
  const b: Builder = {};
  for (const name of [
    "select",
    "eq",
    "order",
    "range",
    "abortSignal",
    "in",
    "upsert",
    "single",
    "update",
    "delete",
  ])
    b[name] = jest.fn(() => b);
  b.then = jest.fn((resolve) => resolve({ data, error }));
  return b;
}
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("owner", true);
});
test("loads beyond the first 100 saves, deduplicates folder designs, and resolves visible private images", async () => {
  const saved = Array.from({ length: 101 }, (_, i) => ({ design_id: `d${i}` }));
  const requests: { table: string; b: Builder }[] = [];
  jest.mocked(supabase.from).mockImplementation((table: string) => {
    const b = builder([]);
    requests.push({ table, b });
    b.then = jest.fn((resolve) => {
      let data: unknown = [];
      if (table === "saved_designs") {
        const [from, to] = b.range.mock.calls[0];
        data = saved.slice(from, to + 1);
      }
      if (table === "collections") data = [{ id: "f", name: "Next" }];
      if (table === "collection_designs")
        data = [
          { collection_id: "f", design_id: "d0" },
          { collection_id: "f", design_id: "private" },
        ];
      if (table === "designs")
        data = b.in.mock.calls[0][1]
          .filter((id: string) => id !== "private")
          .map((id: string) => ({
            id,
            title: id,
            image_url: "signed-source",
            shape: "Oval",
          }));
      resolve({ data, error: null });
    });
    return b as never;
  });
  const result = await loadFavorites("owner", new AbortController().signal);
  expect(result.savedIds).toHaveLength(101);
  expect(result.designs).toHaveLength(101);
  expect(result.folders[0].designIds).toEqual(["d0", "private"]);
  expect(result.designs.some((d) => d.id === "private")).toBe(false);
  expect(
    requests
      .filter((r) => r.table === "saved_designs")
      .map((r) => r.b.range.mock.calls[0]),
  ).toEqual([
    [0, 99],
    [100, 199],
  ]);
  expect(resolvePrivateImage).toHaveBeenCalledTimes(101);
  for (const r of requests.filter((r) =>
    ["saved_designs", "collections", "favourite_creators"].includes(r.table),
  ))
    expect(r.b.eq).toHaveBeenCalledWith("user_id", "owner");
});
test("folder mutations reject a non-owner before writing", async () => {
  const ownership = builder(null, { message: "No access" });
  jest.mocked(supabase.from).mockReturnValue(ownership as never);
  await expect(
    changeFavorite("owner", {
      kind: "add",
      folderId: "foreign",
      designIds: ["a"],
    }),
  ).rejects.toThrow("No access");
  expect(ownership.eq).toHaveBeenCalledWith("user_id", "owner");
  expect(supabase.from).toHaveBeenCalledTimes(1);
  expect(ownership.upsert).not.toHaveBeenCalled();
});
test("duplicate folder adds and create retries use stable database keys", async () => {
  const b = builder({ id: "f" });
  jest.mocked(supabase.from).mockReturnValue(b as never);
  await changeFavorite("owner", {
    kind: "add",
    folderId: "f",
    designIds: ["a", "a"],
  });
  expect(b.upsert).toHaveBeenCalledWith(
    [{ collection_id: "f", design_id: "a" }],
    { onConflict: "collection_id,design_id", ignoreDuplicates: true },
  );
  await changeFavorite("owner", {
    kind: "create",
    id: "request-id",
    name: "  Next  ",
  });
  expect(b.upsert).toHaveBeenLastCalledWith(
    { id: "request-id", user_id: "owner", name: "Next" },
    { onConflict: "id" },
  );
});
test("account changes during ownership reads stop subsequent mutations", async () => {
  const b = builder({ id: "f" });
  b.then = jest.fn((resolve) => {
    accountScope.change("other");
    resolve({ data: { id: "f" }, error: null });
  });
  jest.mocked(supabase.from).mockReturnValue(b as never);
  await expect(
    changeFavorite("owner", { kind: "delete", folderId: "f" }),
  ).rejects.toThrow("account changed");
  expect(b.delete).not.toHaveBeenCalled();
});
test("signed-out or mismatched owners cannot load or mutate favorites", async () => {
  await expect(
    loadFavorites("other", new AbortController().signal),
  ).rejects.toThrow("Sign in");
  await expect(
    changeFavorite("other", {
      kind: "save-design",
      designId: "a",
      saved: true,
    }),
  ).rejects.toThrow("Sign in");
  expect(supabase.from).not.toHaveBeenCalled();
  expect(setSaved).not.toHaveBeenCalled();
});
test("folder removal leaves the separate saved record intact", async () => {
  const b = builder({ id: "f" });
  jest.mocked(supabase.from).mockReturnValue(b as never);
  await changeFavorite("owner", {
    kind: "remove",
    folderId: "f",
    designId: "a",
  });
  expect(supabase.from).toHaveBeenLastCalledWith("collection_designs");
  expect(b.eq).toHaveBeenCalledWith("collection_id", "f");
  expect(b.eq).toHaveBeenCalledWith("design_id", "a");
  expect(setSaved).not.toHaveBeenCalled();
});
