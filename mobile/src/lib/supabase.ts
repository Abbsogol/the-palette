import "react-native-url-polyfill/auto";
import { createClient, processLock } from "@supabase/supabase-js";
import { configurationError, environment } from "./config";
import { secureStorage } from "./secure-storage";

// The root layout displays a setup state before rendering any networked screen
// when configuration is absent. This placeholder is never a fallback service.
export const supabase = createClient(
  configurationError
    ? "https://unconfigured.invalid"
    : environment.supabaseUrl!,
  configurationError ? "unconfigured" : environment.supabaseKey!,
  {
    auth: {
      storage: secureStorage,
      storageKey: "laque.auth",
      flowType: "pkce",
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    },
  },
);
