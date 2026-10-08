import { accountScope } from "../src/lib/account-scope";
import * as WebBrowser from "expo-web-browser";
import { supabase } from "../src/lib/supabase";
import {
  oauth,
  exchangeAuthUrl,
  consumeAuthCallback,
} from "../src/features/auth-actions";
jest.mock("../src/lib/config", () => ({
  appScheme: "laque-dev",
  environment: {
    supabaseUrl: "https://beta.example.test",
    supabaseKey: "public-test-key",
  },
}));
jest.mock("expo-web-browser", () => ({ openAuthSessionAsync: jest.fn() }));
jest.mock("../src/lib/supabase", () => ({
  supabase: {
    auth: {
      signInWithOAuth: jest.fn(),
      exchangeCodeForSession: jest.fn(),
      getSession: jest.fn(),
    },
  },
}));
const settingsFetch = jest.spyOn(globalThis, "fetch");
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("customer", true);
  jest.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: "customer" } } },
    error: null,
  } as never);
  settingsFetch.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({ external: { google: true, apple: true } }),
  } as Response);
});
afterAll(() => settingsFetch.mockRestore());
test("enabled Google sign-in exchanges the returned callback and reports success", async () => {
  jest.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
    data: { url: "https://accounts.example.test" },
    error: null,
  } as never);
  jest.mocked(WebBrowser.openAuthSessionAsync).mockResolvedValue({
    type: "success",
    url: "laque-dev://auth/callback?code=enabled-google",
  } as never);
  jest.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
    data: {
      session: { user: { id: "customer", email_confirmed_at: "2026-10-07" } },
      redirectType: null,
    },
    error: null,
  } as never);
  expect(await oauth("google")).toBe(true);
  expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(
    "enabled-google",
  );
});
test("offline provider checks remain retryable without opening a browser", async () => {
  settingsFetch.mockRejectedValueOnce(new TypeError("Network request failed"));
  await expect(oauth("google")).rejects.toThrow(
    /Check your connection and try again/,
  );
  expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
});
test("a stalled availability request is aborted after ten seconds", async () => {
  jest.useFakeTimers();
  try {
    settingsFetch.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            "abort",
            () => reject(new Error("Aborted")),
            { once: true },
          );
        }),
    );
    const failed = expect(oauth("google")).rejects.toThrow(
      /Could not check Google sign-in/,
    );
    await jest.advanceTimersByTimeAsync(10000);
    await failed;
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  } finally {
    jest.useRealTimers();
  }
});
test.each(["google", "apple"] as const)(
  "a disabled %s provider is caught before the SDK's locally generated authorize URL opens",
  async (provider) => {
    // The real SDK returns a URL and null error even when the server disables Google.
    jest.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
      data: { url: "https://beta.example.test/auth/v1/authorize" },
      error: null,
    } as never);
    settingsFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ external: { [provider]: false } }),
    } as Response);
    await expect(oauth(provider)).rejects.toThrow(
      `${provider === "google" ? "Google" : "Apple"} sign-in is unavailable. Please use email for now.`,
    );
    expect(supabase.auth.signInWithOAuth).not.toHaveBeenCalled();
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  },
);
test.each([
  { ok: false, json: async () => ({}) },
  { ok: true, json: async () => ({}) },
  {
    ok: true,
    json: async () => {
      throw new Error("Invalid response");
    },
  },
])(
  "unverifiable provider settings stay in the app with retry guidance",
  async (response) => {
    settingsFetch.mockResolvedValue(response as Response);
    await expect(oauth("google")).rejects.toThrow(
      /Could not check Google sign-in/,
    );
    expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
  },
);
test("provider availability is refreshed on retry, so enabling it needs no app update", async () => {
  settingsFetch.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ external: { google: false } }),
  } as Response);
  await expect(oauth("google")).rejects.toThrow(/unavailable/);
  jest.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
    data: { url: "https://accounts.example.test" },
    error: null,
  } as never);
  jest
    .mocked(WebBrowser.openAuthSessionAsync)
    .mockResolvedValue({ type: "cancel" } as never);
  expect(await oauth("google")).toBe(false);
  expect(settingsFetch).toHaveBeenCalledTimes(2);
  expect(settingsFetch).toHaveBeenLastCalledWith(
    "https://beta.example.test/auth/v1/settings",
    expect.objectContaining({
      headers: { apikey: "public-test-key" },
      signal: expect.anything(),
    }),
  );
});
test("cancelled social login never exchanges a code or reports success", async () => {
  jest.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
    data: { url: "https://accounts.example.test" },
    error: null,
  } as never);
  jest
    .mocked(WebBrowser.openAuthSessionAsync)
    .mockResolvedValue({ type: "cancel" } as never);
  expect(await oauth("google")).toBe(false);
  expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
});
test("disabled providers produce an email fallback without opening a browser", async () => {
  jest.mocked(supabase.auth.signInWithOAuth).mockResolvedValue({
    data: {},
    error: new Error("Unsupported provider: provider is not enabled"),
  } as never);
  await expect(oauth("apple")).rejects.toThrow(
    "Apple sign-in is unavailable. Please use email for now.",
  );
  expect(WebBrowser.openAuthSessionAsync).not.toHaveBeenCalled();
});
test("a failed code exchange can be retried; concurrent duplicate callbacks share one exchange", async () => {
  jest
    .mocked(supabase.auth.exchangeCodeForSession)
    .mockResolvedValueOnce({ error: new Error("Network unavailable") } as never)
    .mockResolvedValueOnce({
      data: { session: { user: { id: "customer" } }, redirectType: null },
      error: null,
    } as never);
  await expect(
    exchangeAuthUrl("laque-dev://auth/callback?code=retry-code"),
  ).rejects.toThrow("Network unavailable");
  const [a, b] = await Promise.all([
    exchangeAuthUrl("laque-dev://auth/callback?code=retry-code"),
    exchangeAuthUrl("laque-dev://auth/callback?code=retry-code"),
  ]);
  expect(a).toBe(false);
  expect(b).toBe(false);
  expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(2);
});
test("malformed callbacks cannot trigger session exchange", async () => {
  await expect(
    exchangeAuthUrl("https://evil.example/auth/callback?code=steal"),
  ).rejects.toThrow("not valid");
  expect(supabase.auth.exchangeCodeForSession).not.toHaveBeenCalled();
});

test("cached callbacks cannot outlive their account session", async () => {
  jest.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
    data: { session: { user: { id: "customer" } }, redirectType: null },
    error: null,
  } as never);
  const url = "laque-dev://auth/callback?code=cached-account";
  await exchangeAuthUrl(url);
  jest.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: "another-account" } } },
    error: null,
  } as never);
  await expect(exchangeAuthUrl(url)).rejects.toThrow(/different session/);
  expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledTimes(1);
});
test("a URL recovery hint cannot authorize password recovery", async () => {
  jest.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
    data: { session: { user: { id: "customer" } }, redirectType: null },
    error: null,
  } as never);
  await expect(
    exchangeAuthUrl(
      "laque-dev://auth/callback?code=forged-recovery&flow=recovery",
    ),
  ).rejects.toThrow(/not a password recovery/);
});
test("SDK recovery markers and explicit PKCE flow IDs survive native callback parsing", async () => {
  jest.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
    data: { session: { user: { id: "customer" } }, redirectType: "recovery" },
    error: null,
  } as never);
  expect(
    await exchangeAuthUrl(
      "laque-dev://auth/callback?code=real-recovery&sb_flow_id=abcdefgh12345678",
    ),
  ).toBe(true);
  expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith(
    "real-recovery",
    { flowId: "abcdefgh12345678" },
  );
});
test("missing sessions never show a successful callback", async () => {
  jest.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
    data: { session: null, redirectType: null },
    error: null,
  } as never);
  await expect(
    exchangeAuthUrl("laque-dev://auth/callback?code=no-session"),
  ).rejects.toThrow(/could not be confirmed/);
});

test("completed recovery links cannot reopen the password form from the exchange cache", async () => {
  jest.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
    data: { session: { user: { id: "customer" } }, redirectType: "recovery" },
    error: null,
  } as never);
  const url = "laque-dev://auth/callback?code=consumed-recovery";
  expect(await exchangeAuthUrl(url)).toBe(true);
  consumeAuthCallback(url);
  await expect(exchangeAuthUrl(url)).rejects.toThrow(/already been used/);
});

test("a cached recovery link cannot survive logout and a new login by the same account", async () => {
  jest
    .mocked(supabase.auth.exchangeCodeForSession)
    .mockResolvedValue({
      data: { session: { user: { id: "customer" } }, redirectType: "recovery" },
      error: null,
    } as never);
  const url = "laque-dev://auth/callback?code=same-account-relogin";
  await exchangeAuthUrl(url);
  accountScope.change(null);
  accountScope.change("customer");
  await expect(exchangeAuthUrl(url)).rejects.toThrow(/different session/);
});
