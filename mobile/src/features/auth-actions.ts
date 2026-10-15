import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";
import { appScheme, environment } from "../lib/config";
import { parseAuthLink } from "../lib/links";
import { accountScope, type AccountTicket } from "../lib/account-scope";
import { AuthLinkError } from "./auth-callback/model";

export const authCallback = `${appScheme}://auth/callback`;
async function requireProvider(provider: "google" | "apple") {
  const name = provider === "google" ? "Google" : "Apple";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);
  let enabled: unknown;
  try {
    // signInWithOAuth only constructs a URL locally; it cannot detect a
    // disabled provider. Check public settings before opening the auth browser.
    const response = await fetch(
      `${environment.supabaseUrl}/auth/v1/settings`,
      {
        headers: { apikey: environment.supabaseKey! },
        signal: controller.signal,
      },
    );
    if (!response.ok) throw new Error("Auth settings unavailable");
    const settings = await response.json();
    enabled = settings?.external?.[provider];
    if (typeof enabled !== "boolean") throw new Error("Invalid auth settings");
  } catch {
    throw new Error(
      `Could not check ${name} sign-in. Check your connection and try again, or use email.`,
    );
  } finally {
    clearTimeout(timeout);
  }
  if (!enabled)
    throw new Error(
      `${name} sign-in is unavailable. Please use email for now.`,
    );
}
export type AuthCallbackOutcome = {
  userId: string;
  recovery: boolean;
  verified: boolean;
};
let exchange:
  | {
      code: string;
      promise: Promise<AuthCallbackOutcome>;
      consumed?: boolean;
      ticket?: AccountTicket;
    }
  | undefined;
export async function completeAuthCallback(
  url: string,
): Promise<AuthCallbackOutcome> {
  const { code, recovery, flowId } = parseAuthLink(url, appScheme);
  if (exchange?.code !== code) {
    const promise = supabase.auth
      .exchangeCodeForSession(code, ...(flowId ? [{ flowId }] : []))
      .then(({ data, error }) => {
        if (error) throw error;
        if (!data?.session?.user?.id)
          throw new AuthLinkError("retry", "Sign-in could not be confirmed.");
        // auth-js returns this runtime field but AuthTokenResponse omits it from its type.
        // The SDK's stored PKCE recovery marker supplies authority, not a URL flag.
        const redirectType = "redirectType" in data ? data.redirectType : null;
        if (recovery && redirectType !== "recovery")
          throw new AuthLinkError(
            "invalid",
            "This is not a password recovery link.",
          );
        return {
          userId: data.session.user.id,
          recovery: redirectType === "recovery",
          verified: !!data.session.user.email_confirmed_at,
        };
      })
      .catch((error) => {
        if (exchange?.code === code) exchange = undefined;
        throw error;
      });
    exchange = { code, promise };
  }
  const entry = exchange;
  const outcome = await entry.promise;
  if (entry.consumed)
    throw new AuthLinkError(
      "expired",
      "This link has already been used. Request a new link.",
    );
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  if (!data.session || data.session.user.id !== outcome.userId)
    throw new AuthLinkError(
      "account-changed",
      "This link belongs to a different session. Request a fresh link.",
    );
  if (entry.ticket && !accountScope.isCurrent(entry.ticket))
    throw new AuthLinkError(
      "account-changed",
      "This link belongs to a different session. Request a fresh link.",
    );
  // Initial SDK sign-in can finish before AuthProvider adopts the new account.
  // Once adopted, keep the cache within that account's lifecycle, including logout/relogin.
  const ticket = accountScope.capture();
  if (ticket.id === outcome.userId) entry.ticket ??= ticket;
  return outcome;
}
// Navigator remounts share the exchange; completed forms must not reopen it.
export function consumeAuthCallback(url: string) {
  const { code } = parseAuthLink(url, appScheme);
  if (exchange?.code === code) exchange.consumed = true;
}
// Keep the existing provider integration's boolean contract.
export async function exchangeAuthUrl(url: string) {
  return (await completeAuthCallback(url)).recovery;
}
export async function oauth(provider: "google" | "apple") {
  await requireProvider(provider);
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: authCallback, skipBrowserRedirect: true },
  });
  if (error || !data.url) {
    if (error && /provider|not enabled|unsupported/i.test(error.message))
      throw new Error(
        `${provider === "google" ? "Google" : "Apple"} sign-in is unavailable. Please use email for now.`,
      );
    throw error || new Error("Sign-in is unavailable.");
  }
  const result = await WebBrowser.openAuthSessionAsync(data.url, authCallback);
  if (result.type !== "success") return false;
  await exchangeAuthUrl(result.url);
  return true;
}
