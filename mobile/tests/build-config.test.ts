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
test('production discovery works before EAS downloads registered identifiers',()=>{
  process.env.APP_VARIANT='production';
  expect(config().scheme).toBe('laque-app');
  expect(config().ios?.bundleIdentifier).toBeUndefined();
});
test.each(['beta','development'])('%s worker rejects production mislabeled as a non-production binary',variant=>{
  productionWorker();process.env.APP_VARIANT=variant;
  expect(config).toThrow(/cannot use production/);
});
function productionWorker() {
  Object.assign(process.env,{APP_VARIANT:'production',EAS_BUILD:'true',EXPO_PUBLIC_APP_ENV:'production',EXPO_PUBLIC_API_URL:'https://www.laque.app',EXPO_PUBLIC_SUPABASE_URL:'https://faunikvhoommbebsmevg.supabase.co',EXPO_PUBLIC_SUPABASE_PROJECT_REF:'faunikvhoommbebsmevg',EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fixture',MOBILE_PRODUCTION_IOS_BUNDLE_ID:'app.laque.release',MOBILE_PRODUCTION_ANDROID_PACKAGE:'app.laque.release',EXPO_PUBLIC_DESIGN_PREVIEW:'0'});
}
test('production worker enforces services, preview and separate identifiers',()=>{
  productionWorker();expect(config().scheme).toBe('laque-app');
  process.env.EXPO_PUBLIC_API_URL='https://laque-beta.vercel.app';expect(config).toThrow(/approved services/);
  productionWorker();process.env.EXPO_PUBLIC_DESIGN_PREVIEW='1';expect(config).toThrow(/preview disabled/);
  productionWorker();delete process.env.MOBILE_PRODUCTION_IOS_BUNDLE_ID;expect(config).toThrow(/registered/);
  productionWorker();process.env.MOBILE_PRODUCTION_ANDROID_PACKAGE='app.laque.mobile';expect(config).toThrow(/distinct/);
});
test('release candidate uses production services and internal submission, not beta profile inheritance',()=>{
  const eas=jest.requireActual('../eas.json');
  expect(eas.build.production.environment).toBe('production');
  expect(eas.build.production.developmentClient).toBe(false);
  expect(eas.build.production.env.EXPO_PUBLIC_DESIGN_PREVIEW).toBe('0');
  expect(eas.build['production-release-candidate'].extends).toBe('production');
  expect(eas.submit['production-release-candidate'].android.track).toBe('internal');
});
