export type MobileEnvironment = {
  appEnv?: string;
  apiUrl?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  projectRef?: string;
};
export function validateEnvironment(env: MobileEnvironment): string | null {
  if (!["development", "beta"].includes(env.appEnv || ""))
    return "Choose the development or beta environment.";
  if (!env.apiUrl || !env.supabaseUrl || !env.supabaseKey || !env.projectRef)
    return "Isolated services have not been configured for this build.";
  try {
    const api = new URL(env.apiUrl),
      supabase = new URL(env.supabaseUrl);
    for (const url of [api, supabase]) {
      if (
        url.username ||
        url.password ||
        url.search ||
        url.hash ||
        !["", "/"].includes(url.pathname)
      )
        return "Service URLs must be origins without credentials or paths.";
      if (
        url.protocol !== "https:" &&
        !(
          env.appEnv === "development" &&
          ["localhost", "127.0.0.1", "10.0.2.2"].includes(url.hostname) &&
          url.protocol === "http:"
        )
      )
        return "Services require HTTPS.";
    }
    if (supabase.hostname === "faunikvhoommbebsmevg.supabase.co")
      return "The recorded production database is forbidden in development and beta builds.";
    if (
      supabase.hostname.endsWith(".supabase.co") &&
      supabase.hostname !== `${env.projectRef}.supabase.co`
    )
      return "Supabase project identity does not match this build.";
    if (/^(sk_|sb_secret_)/.test(env.supabaseKey))
      return "A server secret cannot be embedded in the app.";
    const jwt = env.supabaseKey.split(".")[1];
    if (jwt) {
      const payload = JSON.parse(
        atob(jwt.replace(/-/g, "+").replace(/_/g, "/")),
      );
      if (payload.role !== "anon")
        return "Use only a public Supabase client key.";
    }
    return null;
  } catch {
    return "Invalid service configuration.";
  }
}
export const environment = {
  appEnv: process.env.EXPO_PUBLIC_APP_ENV,
  apiUrl: process.env.EXPO_PUBLIC_API_URL,
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  projectRef: process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF,
};
export const configurationError = validateEnvironment(environment);
export const appScheme = environment.appEnv === "beta" ? "laque" : "laque-dev";
