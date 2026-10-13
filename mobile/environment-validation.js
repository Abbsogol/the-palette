const contract = require("./environment-contract.json");
function validateEnvironment(env) {
  if (!["development", "beta", "production"].includes(env.appEnv || ""))
    return "Choose the development, beta or production environment.";
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
    const production = env.appEnv === "production";
    if (!production && (supabase.hostname === `${contract.productionProjectRef}.supabase.co` || env.projectRef === contract.productionProjectRef || contract.productionApiOrigins.includes(api.origin)))
      return "The recorded production database is forbidden in development and beta builds.";
    if (production && (env.projectRef !== contract.productionProjectRef || !contract.productionApiOrigins.includes(api.origin) || supabase.origin !== `https://${contract.productionProjectRef}.supabase.co`))
      return "Production requires the approved LaQue API and database identities.";
    const localDatabase = env.appEnv === "development" && ["localhost", "127.0.0.1", "10.0.2.2"].includes(supabase.hostname);
    if (supabase.port && !localDatabase || !supabase.hostname.endsWith(".supabase.co") && !localDatabase)
      return "Use an approved Supabase service origin.";
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
      if (payload.ref && payload.ref !== env.projectRef)
        return "Supabase public key belongs to a different project.";
    } else if (!env.supabaseKey.startsWith("sb_publishable_")) {
      return "Use only a public Supabase client key.";
    }
    return null;
  } catch {
    return "Invalid service configuration.";
  }
}

function schemeForEnvironment(value) { return contract.schemes[value] || "laque-dev"; }
function validateServiceIdentity(config, env) {
  if (!config || config.environment !== env.appEnv || config.projectRef !== env.projectRef || config.contractVersion !== 1) return false;
  if (env.appEnv === "production") return config.apiOrigin === new URL(env.apiUrl).origin && config.appScheme === schemeForEnvironment(env.appEnv);
  return (!config.apiOrigin || config.apiOrigin === new URL(env.apiUrl).origin) && (!config.appScheme || config.appScheme === schemeForEnvironment(env.appEnv));
}
module.exports = { validateEnvironment, schemeForEnvironment, validateServiceIdentity };
