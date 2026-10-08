import { createClient } from "@supabase/supabase-js";
import { supabase } from "../src/lib/supabase";
import {
  loadInbox,
  loadShareDesign,
  discoverRecipients,
  inboxContact,
} from "../src/features/messages-ui/data";
import { accountScope } from "../src/lib/account-scope";
import { resolvePrivateImage } from "../src/lib/designs";
jest.mock("../src/lib/supabase", () => ({ supabase: { from: jest.fn() } }));
jest.mock("../src/lib/api", () => ({
  checked: async (request: PromiseLike<{ data: unknown; error: unknown }>) => {
    const r = await request;
    if (r.error || r.data === null) throw new Error("Data unavailable");
    return r.data;
  },
}));
jest.mock("../src/lib/designs", () => ({
  resolvePrivateImage: jest
    .fn()
    .mockResolvedValue("https://test.invalid/signed-image"),
}));
const own = "00000000-0000-4000-8000-000000000001",
  other = "00000000-0000-4000-8000-000000000002";
const fetcher = jest.fn();
const client = createClient(
  "https://example.supabase.co",
  "public-fixture-key",
  {
    global: { fetch: fetcher },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  },
);
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change(own, true);
  jest.mocked(supabase.from).mockImplementation((table) => client.from(table));
  fetcher.mockImplementation(async (input: string) => {
    const path = new URL(input).pathname;
    if (path.endsWith("hidden_conversations"))
      return json([
        { conversation_id: "00000000-0000-4000-8000-000000000003" },
      ]);
    if (path.endsWith("/conversations"))
      return json([
        {
          id: "chat",
          client_id: own,
          creator_id: other,
          last_message_at: "2026-09-29T09:00:00Z",
          unread: [{ id: "message" }],
          latest: [
            {
              id: "message",
              content: "Hello",
              sender_id: other,
              created_at: "2026-09-29T09:00:00Z",
            },
          ],
        },
      ]);
    if (path.endsWith("designs"))
      return json({
        id: "design",
        title: "Rose",
        image_url: "path",
        shape: "Almond",
        length: "Short",
        category: "Bridal",
      });
    return json([
      {
        id: other,
        display_name: "Kim",
        avatar_url: "https://images.test/kim.webp",
        account_type: "nail_artist",
        location: "Dubai",
      },
    ]);
  });
});
test("real PostgREST builder bounds previews/unread per conversation and excludes hidden threads", async () => {
  const result = await loadInbox(own, 30, new AbortController().signal);
  const requests = fetcher.mock.calls.map(([url]) => new URL(url));
  const q = requests.find((url) =>
    url.pathname.endsWith("/conversations"),
  )!.searchParams;
  expect(q.get("select")).toContain("latest:messages(");
  expect(q.get("select")).toContain("unread:messages(id)");
  expect(q.get("latest.limit")).toBe("1");
  expect(q.get("latest.order")).toBe("created_at.desc,id.desc");
  expect(q.get("limit")).toBe("30");
  expect(q.get("order")).toBe("last_message_at.desc,id.asc");
  expect(q.get("unread.limit")).toBe("1");
  expect(q.get("unread.sender_id")).toBe(`neq.${own}`);
  expect(q.get("unread.is_read")).toBe("eq.false");
  expect(q.get("id")).toContain("not.in.");
  expect(q.get("or")).toBe(`(client_id.eq.${own},creator_id.eq.${own})`);
  expect(inboxContact(result[0], own)).toMatchObject({
    id: "chat",
    userId: other,
    role: "creator",
    avatar: { uri: "https://images.test/kim.webp" },
    lastMessage: "Hello",
    lastMessageAt: "2026-09-29T09:00:00Z",
    unread: true,
  });
});
test("profile failure rejects the inbox rather than displaying stale recipient identities", async () => {
  fetcher.mockImplementation(async (input: string) =>
    new URL(input).pathname.endsWith("hidden_conversations")
      ? json([])
      : new URL(input).pathname.endsWith("/conversations")
        ? json([{ id: "chat", client_id: own, creator_id: other }])
        : json({ message: "Access denied" }, 403),
  );
  await expect(
    loadInbox(own, 30, new AbortController().signal),
  ).rejects.toThrow("Data unavailable");
});
test("discovery includes only creator roles, excludes self and escapes wildcard input", async () => {
  await discoverRecipients("_%", 30, own, new AbortController().signal);
  const q = new URL(fetcher.mock.calls[0][0]).searchParams;
  expect(q.get("account_type")).toBe("in.(creator,nail_artist,salon)");
  expect(q.get("id")).toBe(`neq.${own}`);
  expect(q.get("display_name")).toBe("ilike.%\\_\\%%");
  expect(q.get("limit")).toBe("30");
});
test("shared preview reads a published design through the user client and signs its image", async () => {
  const result = await loadShareDesign("design", new AbortController().signal);
  const q = new URL(fetcher.mock.calls[0][0]).searchParams;
  expect(q.get("id")).toBe("eq.design");
  expect(q.get("is_published")).toBeNull(); // RLS allows the owner’s private design; sending validates recipient access.
  expect(resolvePrivateImage).toHaveBeenCalledWith("path");
  expect(result).toMatchObject({
    title: "Rose",
    metadata: "Almond · Short · Bridal",
    image: "https://test.invalid/signed-image",
  });
});
test("account changes while signing discard the prior account's preview", async () => {
  jest.mocked(resolvePrivateImage).mockImplementationOnce(async () => {
    accountScope.change(other);
    return "https://test.invalid/private";
  });
  await expect(
    loadShareDesign("design", new AbortController().signal),
  ).rejects.toThrow();
});
test("inbox refresh picks up a replaced photo and removal rather than retaining the old avatar", async () => {
  const original = fetcher.getMockImplementation()!;
  let avatar: string | null = "https://images.test/replaced.webp";
  fetcher.mockImplementation(async (input: string) =>
    new URL(input).pathname.endsWith("/profiles")
      ? json([
          {
            id: other,
            display_name: "Kim",
            avatar_url: avatar,
            account_type: "creator",
            location: "Dubai",
          },
        ])
      : original(input),
  );
  const before = await loadInbox(own, 30, new AbortController().signal);
  expect(inboxContact(before[0], own).avatar).toEqual({
    uri: "https://images.test/replaced.webp",
  });
  avatar = "https://images.test/latest.webp";
  const after = await loadInbox(own, 30, new AbortController().signal);
  expect(inboxContact(after[0], own).avatar).toEqual({
    uri: "https://images.test/latest.webp",
  });
  avatar = null;
  const removed = await loadInbox(own, 30, new AbortController().signal);
  expect(inboxContact(removed[0], own).avatar).toBeNull();
});
