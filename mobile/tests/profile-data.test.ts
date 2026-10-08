import {
  loadContent,
  loadIdentity,
  loadStats,
  appointmentDate,
} from "../src/features/profiles/data";
import type { ProfileIdentity } from "../src/features/profiles/model";
const mockCalls: { table: string; method: string; args: unknown[] }[] = [];
let mockResponses: unknown[] = [];
jest.mock("../src/lib/supabase", () => ({
  supabase: {
    from: (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const method of [
        "select",
        "eq",
        "in",
        "or",
        "order",
        "range",
        "abortSignal",
        "single",
        "limit",
        "overrideTypes",
      ])
        chain[method] = (...args: unknown[]) => {
          mockCalls.push({ table, method, args });
          return chain;
        };
      chain.then = (resolve: (v: unknown) => unknown) =>
        Promise.resolve(
          mockResponses.shift() ?? { data: [], error: null, count: 0 },
        ).then(resolve);
      return chain;
    },
  },
}));
jest.mock("../src/lib/designs", () => ({
  resolvePrivateImage: async (v: string) => v,
}));
jest.mock("../src/lib/config", () => ({ configurationError: null }));
const profile: ProfileIdentity = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Kim",
  role: "creator",
  specialties: [],
};
const signal = new AbortController().signal;
beforeEach(() => {
  mockCalls.length = 0;
  mockResponses = [];
});
test("public profile query selects only its approved columns and never reads credits", async () => {
  mockResponses = [
    {
      data: {
        id: profile.id,
        display_name: "Kim",
        account_type: "user",
        avatar_url: "https://images.test/avatar.webp",
        banner_url: "https://images.test/banner.webp",
        location: "Private city",
        specialties: [],
        credit_balance: 999,
      },
      error: null,
    },
  ];
  const p = await loadIdentity(profile.id, signal);
  expect(p.location).toBeNull();
  expect(p.avatar).toEqual({ uri: "https://images.test/avatar.webp" });
  expect(p.cover).toEqual({ uri: "https://images.test/banner.webp" });
  expect(p).not.toHaveProperty("credit_balance");
  expect(mockCalls.find((c) => c.method === "select")?.args[0]).not.toContain(
    "credit_balance",
  );
});
test("public portfolio explicitly filters published designs even for owner-authorized sessions", async () => {
  await loadContent(profile, false, "Designs", 1, signal);
  expect(mockCalls).toContainEqual({
    table: "designs",
    method: "eq",
    args: ["is_published", true],
  });
  expect(mockCalls).toContainEqual({
    table: "designs",
    method: "range",
    args: [24, 47],
  });
});
test("owner portfolio includes unpublished records but always restricts creator ID", async () => {
  await loadContent(profile, true, "My Designs", 0, signal);
  expect(mockCalls).toContainEqual({
    table: "designs",
    method: "eq",
    args: ["created_by", profile.id],
  });
  expect(
    mockCalls.some((c) => c.method === "eq" && c.args[0] === "is_published"),
  ).toBe(false);
});
test("private public profile never fetches owner-authorized portfolio data", async () => {
  const result = await loadContent(
    { ...profile, private: true },
    false,
    "Designs",
    0,
    signal,
  );
  expect(result.designs).toEqual([]);
  expect(mockCalls).toEqual([]);
});
test("public requests cannot load saved or collection content", async () => {
  await expect(loadContent(profile, false, "Saved", 0, signal)).rejects.toThrow(
    "Sign in",
  );
  await expect(
    loadContent(profile, false, "Collections", 0, signal),
  ).rejects.toThrow("Sign in");
  expect(mockCalls).toEqual([]);
});
test("rating calculation includes records after the first 500", async () => {
  mockResponses = [
    { count: 7, error: null },
    { count: 5, error: null },
    { data: Array.from({ length: 500 }, () => ({ rating: 1 })), error: null },
    { data: Array.from({ length: 500 }, () => ({ rating: 5 })), error: null },
    { data: [], error: null },
  ];
  const result = await loadStats(profile.id, false, false, signal);
  expect(result.rating).toBe(3);
  expect(mockCalls).toContainEqual({
    table: "reviews",
    method: "range",
    args: [1000, 1499],
  });
});
test("appointment labels use the creator zone rather than the device zone", () => {
  expect(
    appointmentDate({
      starts_at: "2026-10-01T10:00:00Z",
      time_zone: "Asia/Dubai",
      booking_date: "2026-10-01",
      start_time: "14:00",
    }),
  ).toContain("2:00 PM");
  expect(
    appointmentDate({
      starts_at: "2026-10-01T10:00:00Z",
      time_zone: "Asia/Dubai",
      booking_date: "2026-10-01",
      start_time: "14:00",
    }),
  ).toContain("Asia/Dubai");
});

test("public user profile counts followers, published designs and following without creator reviews", async () => {
  mockResponses = [
    { count: 12, error: null },
    { count: 3, error: null },
    { count: 8, error: null },
  ];
  const stats = await loadStats(profile.id, false, false, signal, true);
  expect(stats).toEqual({
    followers: 12,
    designs: 3,
    following: 8,
    rating: null,
  });
  expect(mockCalls.some((c) => c.table === "reviews")).toBe(false);
  expect(mockCalls).toContainEqual({
    table: "designs",
    method: "eq",
    args: ["is_published", true],
  });
  mockCalls.length = 0;
  await loadContent({ ...profile, role: "user" }, false, "Designs", 0, signal);
  expect(mockCalls).toContainEqual({
    table: "designs",
    method: "eq",
    args: ["created_by", profile.id],
  });
  expect(mockCalls).toContainEqual({
    table: "designs",
    method: "eq",
    args: ["is_published", true],
  });
});
test("the shared profile/chat identity refresh uses current avatar/banner records and clears removed images", async () => {
  for (const [avatar, banner] of [
    ["https://images.test/first.webp", "https://images.test/cover1.webp"],
    ["https://images.test/replacement.webp", "https://images.test/cover2.webp"],
    [null, null],
  ]) {
    mockResponses = [
      {
        data: {
          id: profile.id,
          display_name: "Kim",
          account_type: "creator",
          avatar_url: avatar,
          banner_url: banner,
          specialties: [],
        },
        error: null,
      },
    ];
    const current = await loadIdentity(profile.id, signal);
    expect(current.avatar).toEqual(avatar ? { uri: avatar } : null);
    expect(current.cover).toEqual(banner ? { uri: banner } : undefined);
  }
});
