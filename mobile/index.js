// Keep the visual workshop separate from sessions, billing and network services.
// Release bundles always enter the real application, even if the flag is set.
if (__DEV__ && process.env.EXPO_PUBLIC_DESIGN_PREVIEW === "1") {
  require("./src/preview/entry");
} else {
  require("expo-router/entry");
}
