import { listHomeUpdates } from "../src/features/home/data";
import { publishUpdate } from "../src/features/home/update-data";
import { accountScope } from "../src/lib/account-scope";
import { supabase } from "../src/lib/supabase";
jest.mock("../src/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
function query(data: unknown, error: unknown = null) {
  const q: Record<string, jest.Mock> = {};
  for (const name of [
    "select",
    "eq",
    "in",
    "order",
    "limit",
    "range",
    "abortSignal",
    "maybeSingle",
    "single",
    "insert",
  ])
    q[name] = jest.fn(() => q);
  q.then = jest.fn((resolve) => resolve({ data, error }));
  return q;
}
const row = {
  id: "note",
  creator_id: "owner",
  body: "Studio note",
  created_at: "2026-10-07T00:00:00Z",
};
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("owner", true);
});
test("Updates requests only text notes from self/followed accounts and attaches visible author identity", async () => {
  const follows = query([{ following_id: "artist" }]),
    posts = query([row]),
    profiles = query([
      {
        id: "owner",
        display_name: "Mira",
        username: "mira.nails",
        avatar_url: "https://example.test/avatar.png",
      },
    ]);
  jest
    .mocked(supabase.from)
    .mockImplementation(
      (table) => ({ follows, salon_posts: posts, profiles })[table] as never,
    );
  const result = await listHomeUpdates(
    "owner",
    24,
    new AbortController().signal,
  );
  expect(posts.eq).toHaveBeenCalledWith("media", "[]");
  expect(posts.in).toHaveBeenCalledWith("creator_id", ["owner", "artist"]);
  expect(posts.limit).toHaveBeenCalledWith(24);
  expect(result[0]).toMatchObject({
    name: "Mira",
    username: "mira.nails",
    avatar: { uri: "https://example.test/avatar.png" },
  });
});
test("unavailable author profiles do not create invented author identities", async () => {
  jest
    .mocked(supabase.from)
    .mockImplementation(
      (table) => query(table === "salon_posts" ? [row] : []) as never,
    );
  expect(
    await listHomeUpdates("owner", 24, new AbortController().signal),
  ).toEqual([]);
});
test("late Updates reads cannot return after the account changes", async () => {
  const posts = query([row]);
  posts.then.mockImplementation((resolve) => {
    accountScope.change("another");
    return resolve({ data: [row], error: null });
  });
  jest
    .mocked(supabase.from)
    .mockImplementation(
      (table) => (table === "follows" ? query([]) : posts) as never,
    );
  await expect(
    listHomeUpdates("owner", 24, new AbortController().signal),
  ).rejects.toThrow(/account changed/);
});
test("confirmed existing note reconciles a lost response without inserting again", async () => {
  const existing = query([{ ...row, media: [] }]);
  jest.mocked(supabase.from).mockReturnValue(existing as never);
  await publishUpdate("note", "  Studio note  ");
  expect(existing.insert).not.toHaveBeenCalled();
  expect(existing.eq).toHaveBeenCalledWith("creator_id", "owner");
});
test.each([
  { ...row, body: "Another note", media: [] },
  { ...row, media: [{ path: "photo" }] },
  { ...row, creator_id: "stranger", media: [] },
])(
  "a mismatched existing note cannot become publish success: %j",
  async (existing) => {
    const q = query([existing]);
    jest.mocked(supabase.from).mockReturnValue(q as never);
    await expect(publishUpdate("note", "Studio note")).rejects.toThrow(
      /does not match/,
    );
    expect(q.insert).not.toHaveBeenCalled();
  },
);
test("a new note requires a matching server acknowledgement", async () => {
  const read = query([]),
    write = query({});
  jest
    .mocked(supabase.from)
    .mockReturnValueOnce(read as never)
    .mockReturnValueOnce(write as never);
  await expect(publishUpdate("note", "Studio note")).rejects.toThrow(
    /could not be confirmed/,
  );
  expect(write.insert).toHaveBeenCalledWith({
    id: "note",
    creator_id: "owner",
    body: "Studio note",
    media: [],
    tags: [],
    mentioned_user_ids: [],
  });
});
test("signed-out and blank updates stop before database calls", async () => {
  await expect(publishUpdate("note", " ")).rejects.toThrow(/Write an update/);
  accountScope.change(null);
  await expect(publishUpdate("note", "Studio note")).rejects.toThrow(/Sign in/);
  expect(supabase.from).not.toHaveBeenCalled();
});
