import * as WebBrowser from "expo-web-browser";
import { supabase } from "../lib/supabase";
import { appScheme } from "../lib/config";
import { parseAuthLink } from "../lib/links";

export const authCallback = `${appScheme}://auth/callback`;
let exchange: { code: string; promise: Promise<boolean> } | undefined;
export async function exchangeAuthUrl(url: string) {
  const { code, recovery } = parseAuthLink(url, appScheme);
  if (exchange?.code === code) return exchange.promise;
  const promise = supabase.auth
    .exchangeCodeForSession(code)
    .then(({ error }) => {
      if (error) throw error;
      return recovery;
    });
  exchange = { code, promise };
  return promise;
}
export async function oauth(provider: "google" | "apple") {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: authCallback, skipBrowserRedirect: true },
  });
  if (error || !data.url) throw error || new Error("Sign-in is unavailable.");
  const result = await WebBrowser.openAuthSessionAsync(data.url, authCallback);
  if (result.type !== "success") return false;
  await exchangeAuthUrl(result.url);
  return true;
}
