# Google sign-in configuration and verification

## iPhone follow-up — 2026-09-28

The owner confirmed they use Expo Go and that Apple Developer membership is still under review. The earlier phone screenshot reached Google's consent page; the later “visual preview” notice comes from the separate fixture entry point and is not a Google/Supabase rejection. Two Metro servers were running: port 8083 with the connected router and port 8084 with `EXPO_PUBLIC_DESIGN_PREVIEW=1`. Neither the consent screenshot nor passing mocked callbacks proves that Google returned a usable mobile session.

Rechecked live, without signing in: Google is enabled (HTTP 200), authorization redirects to Google (HTTP 302) with the expected client ID and Supabase callback, and `https://laque-beta.vercel.app/api/mobile/config` reports the same beta environment/project as the mobile configuration. The four public EAS Preview service settings match the local beta settings. No provider settings, keys or users were changed.

The existing EAS `development` profile selects an empty Development environment, while the working isolated services are in Preview with `EXPO_PUBLIC_APP_ENV=beta`. Added `beta-development`, which uses Preview settings, beta identifiers and the `laque://auth/callback` scheme with a development client for physical devices. Do not use the simulator-only `beta-preview` binary on an iPhone.

Also reproduced and fixed a bootstrap failure: evaluating `app.config.ts` for beta without environment variables threw before EAS could discover the project and download its saved configuration. Required beta settings are now enforced on the hydrated EAS worker (`EAS_BUILD=true`); runtime configuration and backend identity gates remain intact. A regression failed before the fix and passes after it. EAS now loads all four correct public settings and reaches signing.

**Still blocked:** EAS reports no suitable iOS internal-distribution signing credentials. The two existing iOS builds are simulator builds. No new build was queued, installed or used for a complete Google login. [Expo's OAuth guidance](https://docs.expo.dev/guides/authentication/) requires a development build for custom-scheme OAuth testing rather than Expo Go.

After Apple enrollment is approved, use `npm --prefix mobile run build:connected:ios` and complete normal Apple/EAS signing and iPhone registration. Install the resulting build, stop the old port-8083 Metro process, then run `npm --prefix mobile run start:connected`. This command forces the real router rather than the design preview. Verify Google consent → callback → session → profile/protected screen, then cancellation, retry and relaunch on the phone. Apple/Google store release approval is not a claim of authentication acceptance.

Verification: TypeScript, lint and **201 tests in 20 suites passed**; `git diff --check` passed. Evidence: `.backups/google-build-config-before.log`, `.backups/google-login-readiness-verification.log`, `.backups/google-login-beta-device-build.log`. The build log's remaining failure is signing, not configuration. Tests do not close the physical-device OAuth gate.

## Current status — owner completed setup on 2026-09-28

Read-only verification after the owner's confirmation: `/auth/v1/settings` returned HTTP 200 with Google enabled, Apple disabled and email enabled. Supabase's Google authorization endpoint now returns HTTP 302 to `accounts.google.com/o/oauth2/v2/auth`. The OAuth client ID matches the owner's supplied ID, and the Google callback is exactly `https://atjwbdrvgljddedtwoqo.supabase.co/auth/v1/callback`.

The previous disabled-provider blocker is resolved for beta. This check stopped before Google consent; it does not validate the client secret, Google's redirect-URI allowlist, a completed code exchange or the return into a physical device. Complete one actual Google sign-in in the connected beta build next. The localhost design preview remains a visual fixture app.

## Initial failure and mobile fix

Checked 2026-09-28 against isolated **laque-beta**, project `atjwbdrvgljddedtwoqo`, using only the app's public credentials. No configuration was changed and no user signed in during this check.

- `/auth/v1/settings`: HTTP 200; `external.google=false`, `external.apple=false`, `external.email=true`.
- The installed Supabase SDK's `signInWithOAuth` returned an authorization URL with `error=null` despite Google being disabled.
- Requesting that authorization URL with redirects disabled reproduced HTTP 400, `validation_failed`: **Unsupported provider: provider is not enabled**.

The mobile handler now checks public provider settings before opening the system authentication browser. A disabled provider shows an in-app email fallback; failed or invalid settings responses show retry guidance. The request times out after ten seconds. Each attempt refreshes the settings, so enabling the provider does not require another app update. This fixes the raw-error-page behavior, not the missing provider configuration.

Regression tests reproduce the SDK-success/server-disabled discrepancy for Google and Apple and cover invalid responses, offline requests, timeouts, retry after activation and a successful callback exchange. The six original regression cases failed before the fix; logs are `.backups/google-auth-before.log` and `.backups/google-auth-after.log`.

Final verification: `npm --prefix mobile run verify` passed TypeScript, lint and **191 tests in 18 suites**. `git diff --check` also passed. Successful OAuth callbacks in these tests are mocked; no live Google consent or device sign-in has been verified.

## Setup reference

Follow the [Supabase Google setup guide](https://supabase.com/docs/guides/auth/social-login/auth-google) in an appropriate LaQue Google Cloud project:

1. Configure Google Auth Platform branding, audience and basic `openid`, email and profile scopes. If using a test audience, add the intended beta testers as required by the console.
2. Create an OAuth client of type **Web application** for the current browser-based mobile authentication flow.
3. Set its authorized redirect URI to exactly `https://atjwbdrvgljddedtwoqo.supabase.co/auth/v1/callback`. This Google-to-Supabase callback is different from the subsequent Supabase-to-mobile callback.
4. In **laque-beta → Authentication → Sign In / Providers → Google**, enter that client ID and secret, enable Google and save. Keep the secret in the provider configuration, never in chat, the app bundle or Git.
5. Confirm Supabase's app return allowlist includes `laque-dev://auth/callback` and `laque://auth/callback`. These were previously registered; their present dashboard state could not be re-inspected.
6. Recheck public settings, then verify consent, account creation, existing-account login, cancellation and cold-start return on both platforms using synthetic beta accounts.

Dashboard access through the browser tool was denied because it could not verify the admin-enforced policy for `https://supabase.com`. The restriction was not bypassed; the owner performed setup. Production configuration and the website were not modified by the agent. End-to-end Google login verification remains open.
