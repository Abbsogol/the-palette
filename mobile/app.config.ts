import type { ExpoConfig } from "expo/config";

const beta = process.env.APP_VARIANT === "beta";
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
const config: ExpoConfig = {
  name: beta ? "LaQue" : "LaQue Dev",
  slug: "laque-mobile",
  owner: "kiimiia",
  version: "0.1.0",
  scheme: beta ? "laque" : "laque-dev",
  orientation: "portrait",
  userInterfaceStyle: "dark",
  ios: {
    bundleIdentifier: `${process.env.MOBILE_IOS_BUNDLE_ID || "app.laque.mobile"}${suffix}`,
    supportsTablet: false,
    usesAppleSignIn: true,
    infoPlist: { ITSAppUsesNonExemptEncryption: false },
  },
  android: {
    package: `${process.env.MOBILE_ANDROID_PACKAGE || "app.laque.mobile"}${suffix}`,
    predictiveBackGestureEnabled: true,
    blockedPermissions: ["android.permission.RECORD_AUDIO"],
  },
  plugins: [
    "expo-router",
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
  extra: { ...(projectId ? { eas: { projectId } } : {}) },
};
export default config;
