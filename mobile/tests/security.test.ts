import { AccountScope, AccountChangedError } from "../src/lib/account-scope";
import { createSecureStorage } from "../src/lib/secure-storage";
import {
  parseAuthLink,
  notificationPath,
  safeReturnPath,
} from "../src/lib/links";

test("late responses remain invalid when a user switches A → B → A", () => {
  const scope = new AccountScope();
  scope.change("A");
  const ticket = scope.capture();
  const abort = jest.fn();
  scope.onChange(abort);
  scope.change("B");
  scope.change("A");
  expect(abort).toHaveBeenCalledTimes(1);
  expect(() => scope.assert(ticket)).toThrow(AccountChangedError);
  expect(() => scope.assert(scope.capture())).not.toThrow();
});
test("token refresh for the same account does not discard current work", () => {
  const scope = new AccountScope();
  scope.change("A");
  const ticket = scope.capture();
  scope.change("A");
  expect(scope.isCurrent(ticket)).toBe(true);
});
function vault() {
  const data = new Map<string, string>();
  let sequence = 0;
  const adapter = {
    getItemAsync: jest.fn(async (key: string) => data.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      data.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      data.delete(key);
    }),
  };
  return {
    data,
    adapter,
    storage: createSecureStorage(adapter, () => `version-${++sequence}`),
  };
}
test("session write failure preserves the previous complete session", async () => {
  const { storage, adapter } = vault();
  await storage.setItem("session", "original");
  adapter.setItemAsync.mockRejectedValueOnce(new Error("Keychain unavailable"));
  await expect(
    storage.setItem("session", "new token".repeat(100)),
  ).rejects.toThrow("Keychain unavailable");
  expect(await storage.getItem("session")).toBe("original");
});
test("concurrent writes commit complete sessions and deletion removes all chunks", async () => {
  const { storage, data } = vault();
  await Promise.all([
    storage.setItem("session", "A".repeat(2048)),
    storage.setItem("session", "B".repeat(4096)),
  ]);
  expect(await storage.getItem("session")).toBe("B".repeat(4096));
  await storage.removeItem("session");
  expect(await storage.getItem("session")).toBeNull();
  expect(data.size).toBe(0);
});
test("a missing encrypted chunk cannot yield a partial auth token", async () => {
  const { storage, data } = vault();
  await storage.setItem("session", "secret".repeat(100));
  data.delete("session.version-1.1");
  await expect(storage.getItem("session")).rejects.toThrow("incomplete");
});
test.each([
  "https://evil.invalid/auth/callback?code=x",
  "laque://auth/callback?code=x",
  "laque-dev://auth/callback?code=x#access_token=secret",
  "laque-dev://auth/callback",
])("rejects unsafe or incomplete authentication links: %s", (url) => {
  expect(() => parseAuthLink(url, "laque-dev")).toThrow();
});
test("recovery links use the registered callback and preserve the recovery flow", () => {
  expect(
    parseAuthLink(
      "laque-dev://auth/callback?code=one-time&flow=recovery",
      "laque-dev",
    ),
  ).toEqual({ code: "one-time", recovery: true });
});
test("notification data cannot navigate to arbitrary routes or URLs", () => {
  const id = "00000000-0000-4000-8000-000000000711";
  expect(notificationPath({ kind: "booking", id })).toBe(`/booking/${id}`);
  expect(
    notificationPath({ kind: "booking", id: "https://evil.invalid" }),
  ).toBeNull();
  expect(notificationPath({ kind: "billing", id })).toBeNull();
  expect(safeReturnPath("//evil.invalid")).toBe("/");
});
import { calendarDay, monthCells, moveMonth } from "../src/lib/calendar";
test("the creator calendar date can differ from the device UTC date", () => {
  const now = Date.parse("2026-09-27T23:30:00Z");
  expect(calendarDay(now, "Asia/Dubai")).toBe("2026-09-28");
  expect(calendarDay(now, "America/Los_Angeles")).toBe("2026-09-27");
});
test("calendar handles leap days and year boundaries without device timezone arithmetic", () => {
  expect(monthCells("2028-02").filter(Boolean)).toHaveLength(29);
  expect(monthCells("2027-02").filter(Boolean)).toHaveLength(28);
  expect(moveMonth("2026-12", 1)).toBe("2027-01");
  expect(moveMonth("2026-01", -1)).toBe("2025-12");
});
import { validateEnvironment } from "../src/lib/config";
test("the EAS smoke profile always disables service access with schema-valid values", () => {
  const { build } = jest.requireActual("../eas.json");
  const env = build["e2e-smoke"].env;
  expect(Object.values(env).every((value) => typeof value === "string" && value.length > 0)).toBe(true);
  expect(validateEnvironment({
    appEnv: env.EXPO_PUBLIC_APP_ENV,
    apiUrl: env.EXPO_PUBLIC_API_URL,
    supabaseUrl: env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseKey: env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    projectRef: env.EXPO_PUBLIC_SUPABASE_PROJECT_REF,
  })).toBe("Invalid service configuration.");
});
test("beta config refuses production, service-role keys and credential-bearing URLs", () => {
  const valid = {
    appEnv: "beta",
    apiUrl: "https://beta.example.invalid",
    supabaseUrl: "https://isolated.supabase.co",
    projectRef: "isolated",
    supabaseKey: "sb_publishable_test",
  };
  expect(validateEnvironment(valid)).toBeNull();
  expect(
    validateEnvironment({ ...valid, supabaseKey: "sb_secret_no" }),
  ).toMatch(/secret/);
  expect(
    validateEnvironment({
      ...valid,
      supabaseUrl: "https://faunikvhoommbebsmevg.supabase.co",
    }),
  ).toMatch(/production/);
  expect(
    validateEnvironment({
      ...valid,
      apiUrl: "https://secret:password@beta.example.invalid",
    }),
  ).toMatch(/credentials/);
  expect(
    validateEnvironment({ ...valid, apiUrl: "http://beta.example.invalid" }),
  ).toMatch(/HTTPS/);
});
import { protectedReturnPath } from "../src/lib/links";
test("sign-in preserves a valid booking reference without accepting an arbitrary return URL", () => {
  const id = "00000000-0000-4000-8000-000000000711";
  expect(
    protectedReturnPath(`/book/${id}`, {
      designId: id,
      redirect: "https://evil.invalid",
    }),
  ).toBe(`/book/${id}?designId=${id}`);
  expect(protectedReturnPath("//evil.invalid", {})).toBe("/");
});
test("Expo Router query parsing handles long malformed encoded URLs without recursive decoding", () => {
  expect(
    jest.requireActual<{ version: string }>("decode-uri-component/package.json")
      .version,
  ).toBe("0.5.0");
  const parser = jest.requireActual<{
    parse: (input: string) => Record<string, string>;
  }>("query-string");
  const invalid = "%EA".repeat(4000);
  expect(parser.parse(`name=rose%20gold&bad=${invalid}`).name).toBe(
    "rose gold",
  );
  expect(parser.parse(`bad=${invalid}`).bad).toBe(invalid);
});
