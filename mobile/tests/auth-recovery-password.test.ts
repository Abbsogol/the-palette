import { saveRecoveryPassword } from "../src/features/auth-callback/password";
import { accountScope } from "../src/lib/account-scope";
import { supabase } from "../src/lib/supabase";
jest.mock("../src/lib/config", () => ({
  environment: {
    supabaseUrl: "https://auth.example.test",
    supabaseKey: "public-test-key",
  },
}));
jest.mock("../src/lib/supabase", () => ({
  supabase: { auth: { getSession: jest.fn() } },
}));
const request = jest.spyOn(globalThis, "fetch");
beforeEach(() => {
  jest.clearAllMocks();
  accountScope.change("owner", true);
  jest.mocked(supabase.auth.getSession).mockResolvedValue({
    data: {
      session: { user: { id: "owner" }, access_token: "owner-test-bearer" },
    },
    error: null,
  } as never);
  request.mockReset().mockResolvedValue({
    ok: true,
    json: async () => ({ id: "owner" }),
  } as Response);
});
afterEach(() => accountScope.change(null));
afterAll(() => request.mockRestore());
test("password update uses a fixed bearer for its confirmed owner", async () => {
  await saveRecoveryPassword(
    "owner",
    "synthetic-password",
    "synthetic-password",
  );
  expect(request).toHaveBeenCalledWith(
    "https://auth.example.test/auth/v1/user",
    expect.objectContaining({
      method: "PUT",
      headers: {
        apikey: "public-test-key",
        Authorization: "Bearer owner-test-bearer",
        "Content-Type": "application/json",
        "X-Supabase-Api-Version": "2024-01-01",
      },
      body: JSON.stringify({ password: "synthetic-password" }),
    }),
  );
});
test.each([
  ["short", "short"],
  ["long-password", "mismatch"],
])(
  "invalid password fields do not make a network request",
  async (password, confirmation) => {
    await expect(
      saveRecoveryPassword("owner", password, confirmation),
    ).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
  },
);
test("account change before session resolution prevents the mutation", async () => {
  let resolve!: (v: unknown) => void;
  jest.mocked(supabase.auth.getSession).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }) as never,
  );
  const failed = expect(
    saveRecoveryPassword("owner", "synthetic-password", "synthetic-password"),
  ).rejects.toThrow(/account changed/);
  accountScope.change("other");
  resolve({
    data: { session: { user: { id: "other" }, access_token: "other-token" } },
    error: null,
  });
  await failed;
  expect(request).not.toHaveBeenCalled();
});
test("switching accounts aborts an in-flight update and discards even a committed old result", async () => {
  let resolve!: (v: Response) => void;
  request.mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const failed = expect(
    saveRecoveryPassword("owner", "synthetic-password", "synthetic-password"),
  ).rejects.toThrow(/account changed/);
  await Promise.resolve();
  await Promise.resolve();
  const options = request.mock.calls[0][1]!;
  accountScope.change("other");
  expect(options.signal?.aborted).toBe(true);
  expect((options.headers as Record<string, string>).Authorization).toBe(
    "Bearer owner-test-bearer",
  );
  resolve({ ok: true, json: async () => ({ id: "owner" }) } as Response);
  await failed;
});
test("a stale or different session cannot update another account", async () => {
  jest.mocked(supabase.auth.getSession).mockResolvedValue({
    data: { session: { user: { id: "other" } } },
    error: null,
  } as never);
  await expect(
    saveRecoveryPassword("owner", "synthetic-password", "synthetic-password"),
  ).rejects.toThrow(/expired/);
  expect(request).not.toHaveBeenCalled();
});
test.each([
  [401, {}, /no longer valid/],
  [422, { error_code: "weak_password" }, /stronger/],
  [422, { error_code: "same_password" }, /already in use/],
  [500, { message: "secret provider internals" }, /couldn’t be updated/],
])(
  "Auth status %i presents actionable feedback",
  async (status, result, expected) => {
    request.mockResolvedValue({
      ok: false,
      status,
      json: async () => result,
    } as Response);
    await expect(
      saveRecoveryPassword("owner", "synthetic-password", "synthetic-password"),
    ).rejects.toThrow(expected);
  },
);
test("an unconfirmed identity never presents password success", async () => {
  request.mockResolvedValue({
    ok: true,
    json: async () => ({ id: "other" }),
  } as Response);
  await expect(
    saveRecoveryPassword("owner", "synthetic-password", "synthetic-password"),
  ).rejects.toThrow(/could not be confirmed/);
});
test("timeout remains uncertain rather than claiming the password was unchanged", async () => {
  jest.useFakeTimers();
  try {
    request.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) =>
          options?.signal?.addEventListener(
            "abort",
            () => reject(new Error("AbortError")),
            { once: true },
          ),
        ),
    );
    const failed = expect(
      saveRecoveryPassword("owner", "synthetic-password", "synthetic-password"),
    ).rejects.toThrow(/Try signing in with your new password/);
    await jest.advanceTimersByTimeAsync(15000);
    await failed;
    expect(jest.getTimerCount()).toBe(0);
  } finally {
    jest.useRealTimers();
  }
});

test("current Auth code fields and wrapped user responses match the SDK contract", async () => {
  request.mockResolvedValueOnce({
    ok: false,
    status: 422,
    json: async () => ({ code: "weak_password" }),
  } as Response);
  await expect(
    saveRecoveryPassword("owner", "synthetic-password", "synthetic-password"),
  ).rejects.toThrow(/stronger/);
  request.mockResolvedValueOnce({
    ok: true,
    json: async () => ({ user: { id: "owner" } }),
  } as Response);
  await expect(
    saveRecoveryPassword("owner", "synthetic-password", "synthetic-password"),
  ).resolves.toBeUndefined();
});
