import type { ExpoConfig } from "expo/config";

const originalEnvironment = process.env;
beforeEach(() => {
  process.env = { ...originalEnvironment, APP_VARIANT: "beta" };
  for (const name of [
    "EAS_BUILD",
    "EXPO_PUBLIC_SUPABASE_PROJECT_REF",
    "EXPO_PUBLIC_API_URL",
  ]) {
    delete process.env[name];
  }
});
afterEach(() => {
  process.env = originalEnvironment;
});

function config(): ExpoConfig {
  let result!: ExpoConfig;
  jest.isolateModules(() => {
    result = require("../app.config").default;
  });
  return result;
}

test("EAS can discover the project before downloading its beta environment", () => {
  const result = config();
  expect(result.extra?.eas.projectId).toBeTruthy();
  expect(result.scheme).toBe("laque");
});
test("the build worker still rejects missing beta service configuration", () => {
  process.env.EAS_BUILD = "true";
  expect(config).toThrow(/verified isolated service configuration/);
});
test("a configured beta build uses the registered beta authentication scheme", () => {
  process.env.EAS_BUILD = "true";
  process.env.EXPO_PUBLIC_SUPABASE_PROJECT_REF = "beta-test-project";
  process.env.EXPO_PUBLIC_API_URL = "https://beta.example.test";
  expect(config().scheme).toBe("laque");
});
test("development and beta keep distinct registered authentication schemes", () => {
  process.env.APP_VARIANT = "development";
  expect(config().scheme).toBe("laque-dev");
});
