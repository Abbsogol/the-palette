# Account setup — 27 September 2026

## Stripe development configuration

The owner selected **development and beta only**, leaving the live website on its existing Stripe account.

- Account: **WeActivate**, `acct_1TvxxEGpyT5aBYxx`; Stripe API account retrieval matched this ID and balance retrieval confirmed `livemode=false`.
- The existing test key is stored in the ignored, owner-readable `.env.development.local` (permissions 0600). No credential is committed or embedded in mobile.
- The same key, account ID, mode and both Price IDs are saved as Secret variables scoped **only to Development** in Vercel project `sogol-s-projects1/the-palette`. The UI confirmed successful creation and the Development scope on all five variables. No redeployment was triggered.
- Stripe test mode initially had no prices or webhook endpoints. The following monthly prices were created with stable lookup/idempotency keys and verified through the API:

| Plan | Price ID | Amount | Credits |
|---|---|---|---|
| Premium | `price_1UKJGmGpyT5aBYxxkf0qvyvo` | AED 19/month | 5 |
| Pro Creator | `price_1UKJGmGpyT5aBYxxG3bTbEPq` | AED 49/month | 20 |

Synthetic sandbox Checkout testing is recorded separately in the hosted verification evidence. No live charges or refunds were issued. Native digital purchases still use RevenueCat/Apple/Google; these Stripe prices configure the existing web subscription endpoints for development. Appointment deposits continue to use server-side Checkout with booking-specific AED amounts.

## Isolated hosted beta

- Supabase: **laque-beta**, `atjwbdrvgljddedtwoqo`, in Abbsogol’s Org (`znhsllocognxwjtcowky`), Ireland. Complete schema-only rehearsal and all 22 migrations applied; 66/66 public tables enforce RLS. No live customer rows copied.
- Vercel: **sogol-s-projects1/laque-beta**, project `prj_SoMqxE3wuWJ2mN2oK5aFdkL0M7Lj`, [https://laque-beta.vercel.app](https://laque-beta.vercel.app). Public configuration endpoint verifies beta identity. This separate project uses only beta Supabase/test Stripe configuration.
- Stripe test webhook: `we_1UKJlTGpyT5aBYxxkG1Xl6Hj`, `/api/stripe-webhook`, 14 checkout/refund/invoice/subscription events, API `2026-08-26.dahlia`. Signing secret exists only in private environment storage.
- Supabase Auth site URL uses the beta origin. `laque` and `laque-dev` callback/recovery URLs and the beta web profile return are registered. Synthetic customer, creator and stranger accounts are confirmed and real password logins are verified. SMTP and Google/Apple providers remain unconfigured.
- Supabase pg_cron job `laque-beta-mobile-jobs` runs every minute through pg_net. Authorization lives in Supabase Vault. Three actual worker deliveries returned HTTP 200 without timeout.
- `.env.beta.local`, `mobile/.env.local` and `.backups/beta-test-accounts.json` are private and ignored. Do not paste their secrets into tickets, screenshots, Git or client bundles.
- The original `the-palette` Production/Preview configuration remains unchanged. Branch-specific Git deployment is disabled for `codex/native-mobile-beta`; deployments use an explicit CLI link to the separate beta project.

## Expo project

- Owner/project: [@kiimiia/laque-mobile](https://expo.dev/accounts/kiimiia/projects/laque-mobile)
- EAS project ID: `c798894e-db94-4b60-88ca-0f75a1e05cdd`
- CLI authentication and `project:info` verified ownership/linkage. Dynamic app configuration now includes the project ID and owner; push registration reads that resolved Expo configuration.
- Initial `e2e-smoke` cloud builds submitted: [Android](https://expo.dev/accounts/kiimiia/projects/laque-mobile/builds/cba6e738-3078-466e-a893-280e8915cba3), [iOS Simulator](https://expo.dev/accounts/kiimiia/projects/laque-mobile/builds/149b705c-e640-485c-b1f3-08dbfb9be4f4). Both initial smoke builds **finished successfully**. They deliberately show the unconfigured-service screen. They do not establish authentication, billing, signed beta distribution or physical-device acceptance.

Both connected `beta-preview` builds finished successfully and use the verified isolated backend: iOS Simulator `3fc3e493-07dd-4c85-9c77-78bb5f8dd79c`, Android APK `2b7f0df7-92fb-4256-93ac-4c923f764943`. This profile does not require store accounts. It cannot be installed on a physical iPhone.

Apple/Google enrollment, RevenueCat setup, APNs/FCM credentials, email/OAuth and physical-device acceptance remain open.

## Verification and fixes

- Reproduced the old-account price fallback in test mode. Sandbox configuration now requires explicit prices and returns 503 before database reservation when missing. The existing live catalog behavior is retained. Four new unit tests cover these boundaries.
- EAS rejected empty strings in the smoke profile's environment. Non-empty invalid-service sentinels keep the profile valid and disable connections; a mobile regression test verifies this behavior.
- Root lint caught a synchronous state update in the existing new admin report screen; initial loading now follows the asynchronous request, and obsolete initial responses are discarded.
- Root lint, 29 unit tests, all PostgreSQL suites in CI order, production smoke build and 20 browser tests passed locally. Mobile type-checking/lint and 21 component/security tests passed. See `results.json` for counts and environment; this is not a hosted CI or physical-device certification.

The connected iOS Simulator build passed Maestro 2.10.0 on iPhone 17/iOS 27: sign-in, saved design, authenticated stop/relaunch and completed-refund UI. A second native journey passed customer→creator→customer switching, separate saved lists and creator business controls. A third journey opened a shared design and sent a unique message; the creator JWT verified exactly one database row. Android native journeys and physical-device acceptance remain open. EAS-hosted Maestro requires a paid plan on this account; no plan was purchased. The local simulator fallback does not require that subscription.

The release source is committed in `0240854` with the CI SDK fix in `cc6e3f9`. EAS connected binaries were uploaded before that source commit, from the same mobile runtime files; later edits only changed CI, tests and reports. They are engineering preview artifacts. Store release builds still require a final approved commit and complete acceptance.
