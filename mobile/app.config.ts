import type { ExpoConfig } from "expo/config";
import { validateEnvironment, schemeForEnvironment } from "./environment-validation";
import contract from './environment-contract.json';

const beta = process.env.APP_VARIANT === "beta";
const production = process.env.APP_VARIANT === "production";
if (!production && process.env.EAS_BUILD === 'true' && (process.env.EXPO_PUBLIC_APP_ENV === 'production' || process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF === contract.productionProjectRef || contract.productionApiOrigins.includes(process.env.EXPO_PUBLIC_API_URL || '') || process.env.EXPO_PUBLIC_SUPABASE_URL === `https://${contract.productionProjectRef}.supabase.co`)) throw new Error('Development/beta builds cannot use production services or labels.');
const suffix = beta ? "" : ".development";
const projectId =
  process.env.EXPO_PUBLIC_EAS_PROJECT_ID ||
  "c798894e-db94-4b60-88ca-0f75a1e05cdd";
if (
  beta &&
  // EAS first reads this file to discover the project before it downloads the
  // selected environment. Enforce build settings on the hydrated build worker;
  // the runtime configuration and service gates also reject missing services.
  process.env.EAS_BUILD === "true" &&
  (!projectId ||
    !process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF ||
    !process.env.EXPO_PUBLIC_API_URL)
) {
  throw new Error(
    "Beta requires a registered Expo project and verified isolated service configuration.",
  );
}
if (production && process.env.EAS_BUILD === "true") {
  const error = validateEnvironment({appEnv:process.env.EXPO_PUBLIC_APP_ENV,apiUrl:process.env.EXPO_PUBLIC_API_URL,supabaseUrl:process.env.EXPO_PUBLIC_SUPABASE_URL,supabaseKey:process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,projectRef:process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF});
  if (process.env.EXPO_PUBLIC_APP_ENV !== "production" || error || !process.env.MOBILE_PRODUCTION_IOS_BUNDLE_ID || !process.env.MOBILE_PRODUCTION_ANDROID_PACKAGE || process.env.EXPO_PUBLIC_DESIGN_PREVIEW === "1") throw new Error("Production requires approved services, registered release identifiers and preview disabled.");
  const ios = process.env.MOBILE_PRODUCTION_IOS_BUNDLE_ID;
  const android = process.env.MOBILE_PRODUCTION_ANDROID_PACKAGE;
  if (![ios,android].every(id=>/^[a-zA-Z][a-zA-Z0-9_-]*(\.[a-zA-Z][a-zA-Z0-9_-]*){2,}$/.test(id) && !id.endsWith('.development')) || ios === (process.env.MOBILE_IOS_BUNDLE_ID || 'app.laque.mobile') || android === (process.env.MOBILE_ANDROID_PACKAGE || 'app.laque.mobile')) throw new Error('Production identifiers must be valid and distinct from beta/development.');
}
const config: ExpoConfig = {
  name: beta || production ? "LaQue" : "LaQue Dev",
  slug: "laque-mobile",
  owner: "kiimiia",
  version: "0.1.0",
  scheme: schemeForEnvironment(production ? "production" : beta ? "beta" : "development"),
  orientation: "portrait",
  userInterfaceStyle: "dark",
  ios: {
    bundleIdentifier: production ? process.env.MOBILE_PRODUCTION_IOS_BUNDLE_ID : `${process.env.MOBILE_IOS_BUNDLE_ID || "app.laque.mobile"}${suffix}`,
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: production ? process.env.MOBILE_PRODUCTION_ANDROID_PACKAGE : `${process.env.MOBILE_ANDROID_PACKAGE || "app.laque.mobile"}${suffix}`,
    predictiveBackGestureEnabled: true,
    blockedPermissions: ["android.permission.RECORD_AUDIO"],
  },
  plugins: [
    "expo-router",
    ["@stripe/stripe-react-native", { enableGooglePay: false }],
    ["expo-font", { fonts: ["./assets/fonts/Anola-Regular.otf"] }],
    "expo-secure-store",
    "expo-web-browser",
    "expo-sharing",
    "expo-video",
    "expo-apple-authentication",
    "expo-notifications",
    [
      "expo-image-picker",
      {
        photosPermission: "Choose photos or videos to share on LaQue.",
        cameraPermission: false,
        microphonePermission: false,
      },
    ],
  ],
  experiments: { typedRoutes: true },
  extra: { appEnvironment: production ? 'production' : beta ? 'beta' : 'development', ...(projectId ? { eas: { projectId } } : {}) },
};
export default config;
