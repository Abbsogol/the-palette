import { createClient } from "@supabase/supabase-js";
const user = {
  id: "00000000-0000-4000-8000-000000000001",
  aud: "authenticated",
  role: "authenticated",
  email: "synthetic@example.test",
  email_confirmed_at: "2026-10-07T00:00:00Z",
  app_metadata: {},
  user_metadata: {},
  created_at: "2026-10-07T00:00:00Z",
};
function client() {
  const entries = new Map<string, string>();
  const fetcher = jest.fn(
    async (url: RequestInfo | URL, options?: RequestInit) => {
      void options;
      if (String(url).includes("/token?grant_type=pkce"))
        return new Response(
          JSON.stringify({
            access_token: "synthetic-access-token",
            refresh_token: "synthetic-refresh-token",
            expires_in: 3600,
            token_type: "bearer",
            user,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      return new Response("{}", {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  );
  const supabase = createClient(
    "https://contract.example.test",
    "public-test-key",
    {
      global: { fetch: fetcher },
      auth: {
        storageKey: "contract",
        storage: {
          getItem: (key) => entries.get(key) ?? null,
          setItem: (key, value) => {
            entries.set(key, value);
          },
          removeItem: (key) => {
            entries.delete(key);
          },
        },
        flowType: "pkce",
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false,
      },
    },
  );
  return { supabase, entries, fetcher };
}
test("installed SDK marks recovery from the local PKCE verifier and returns a real session", async () => {
  const { supabase, entries, fetcher } = client();
  await supabase.auth.resetPasswordForEmail(user.email, {
    redirectTo: "laque-dev://auth/callback?flow=recovery",
  });
  const verifier = entries.get("contract-code-verifier");
  expect(verifier).toContain("/recovery");
  const result = await supabase.auth.exchangeCodeForSession("synthetic-code");
  expect("redirectType" in result.data && result.data.redirectType).toBe(
    "recovery",
  );
  expect(result.data.session?.user.id).toBe(user.id);
  const body = JSON.parse(
    String(
      fetcher.mock.calls.find(([url]) =>
        String(url).includes("/token?grant_type=pkce"),
      )?.[1]?.body,
    ),
  );
  expect(body.code_verifier).toBe(JSON.parse(verifier!).split("/")[0]);
  expect((await supabase.auth.getSession()).data.session?.user.id).toBe(
    user.id,
  );
});
test("the real SDK removes a failed verifier, so a second exchange requires a fresh email", async () => {
  const { supabase, entries, fetcher } = client();
  await supabase.auth.resetPasswordForEmail(user.email);
  fetcher.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ code: "flow_state_expired", msg: "Expired" }),
      {
        status: 400,
        headers: {
          "Content-Type": "application/json",
          "X-Supabase-Api-Version": "2024-01-01",
        },
      },
    ),
  );
  const first = await supabase.auth.exchangeCodeForSession("expired-code");
  expect(first.error?.code).toBe("flow_state_expired");
  expect(entries.has("contract-code-verifier")).toBe(false);
  const second = await supabase.auth.exchangeCodeForSession("expired-code");
  expect(second.error?.name).toBe("AuthPKCECodeVerifierMissingError");
});

test("verification resend generates a fresh local PKCE verifier", async () => {
  const { supabase, entries, fetcher } = client();
  await supabase.auth.resend({
    type: "signup",
    email: user.email,
    options: { emailRedirectTo: "laque-dev://auth/callback" },
  });
  expect(entries.has("contract-code-verifier")).toBe(true);
  const body = JSON.parse(
    String(
      fetcher.mock.calls.find(([url]) => String(url).includes("/resend"))?.[1]
        ?.body,
    ),
  );
  expect(body.code_challenge).toBeTruthy();
  expect(body.code_challenge_method).toMatch(/s256|plain/i);
  const result =
    await supabase.auth.exchangeCodeForSession("verification-code");
  expect("redirectType" in result.data && result.data.redirectType).toBeNull();
  expect(result.data.session?.user.email_confirmed_at).toBeTruthy();
});
