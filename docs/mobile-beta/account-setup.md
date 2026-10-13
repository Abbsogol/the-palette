# Account setup — updated 29 September 2026

## 29 September credits-only decision

Mobile Lab billing now offers only one-time 5/15/40-credit packs. Do not create subscription products for the new mobile offering. The Stripe subscription setup below is a historical record for the existing website; no provider subscriptions, prices or financial records were deleted. See [Lab credits](credits-ui.md) for implementation scope and remaining native store tests.

## 29 September Google Play update

- The owner reports that Google Play verification is complete. Live Play Console access was checked for developer account `7727154482127874343`, with display name **WeActivate Project Management Services LLC**. Its account type is **Personal**; the display name does not make it an organization account.
- The console lists no apps and offers **Create app**. Android developer verification initially showed a status-checking message; after one refresh it displayed **Package names** and **Identity** tabs and an enabled **Register package name** action. The Identity tab reads identity information from the existing Play Console account. No further identity task was displayed on these inspected pages.
- No app, package registration, build upload, release or credential was created during this read-only check. Next Android steps are the LaQue app record, package/signing registration using the existing `app.laque.mobile` configuration, and a store AAB for the internal-testing track.
- The financial-reports page reports that a Google Payments merchant account has not been set up. Payment-account setup remains owner work before paid digital-product acceptance. RevenueCat, Google billing products and purchase testing remain open.
- Apple approval remains unconfirmed since the owner's last update that it was under review. Android account progress does not close Apple signing or physical-device acceptance.

## 28 September service setup

- The owner reports that Apple Developer and Google Play enrollment are under review. Approval, signing and store distribution are not yet verified.
- The owner will create RevenueCat after the store accounts are verified; provider billing acceptance remains open.
- OpenAI Platform was verified as signed in to the owner's requested account, `kimiya.abb@gmail.com`, in the Personal organization. Created the isolated **LaQue Beta** project, `proj_OgUB64ui48oYU4tS4sVYeXx5`. Its backend key is prepared with restricted image/chat request and model-read permissions and a 30-day expiry, but has not been created or installed. No AI request or credit purchase was made.
- Resend workspace **abb.sogol1** is accessible and **laque.app** is verified. The owner created and supplied **laque-beta-email**, key ID `175103f6-c7c0-4d14-8499-c53aa4617957`. Its detail page confirms sending-only permission restricted to **laque.app**. Existing website keys were left unchanged.
- The supplied key passed TLS SMTP authentication (`235`) at `smtp.resend.com:465`. Supabase **laque-beta** Auth now uses that SMTP provider and the sender **LaQue Beta <auth-beta@laque.app>**. A page reload confirmed SMTP stayed enabled with the saved sender/host/port and a hidden stored password. No signup/recovery email has been sent or verified in an inbox yet.
- Installed the key as a Secret in the isolated Vercel **laque-beta** project's Production/Preview targets and in owner-only, ignored `.env.beta.local` / `.env.development.local`. Redeployed the existing beta application to `https://laque-beta-n4uxkr4bo-sogol-s-projects1.vercel.app`, aliased to `https://laque-beta.vercel.app`. These target names belong to the separate beta project; the live website configuration remains unchanged.
- `OPENAI_API_KEY` is still absent from beta/development configuration. The Resend credential does not establish an OpenAI connection. See `service-connections.json` for email smoke checks and remaining delivery gaps.

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
- Supabase Auth site URL uses the beta origin. `laque` and `laque-dev` callback/recovery URLs and the beta web profile return are registered. Synthetic customer, creator and stranger accounts are confirmed and real password logins are verified. SMTP was connected on 28 September as recorded above. The owner subsequently configured Google: public settings confirm it is enabled, and the authorization endpoint redirects to Google with the supplied client ID and beta Supabase callback. Consent, token exchange and device return remain unverified. Apple remains disabled. See `google-sign-in.md`.
- Supabase pg_cron job `laque-beta-mobile-jobs` runs every minute through pg_net. Authorization lives in Supabase Vault. Three actual worker deliveries returned HTTP 200 without timeout.
- `.env.beta.local`, `mobile/.env.local` and `.backups/beta-test-accounts.json` are private and ignored. Do not paste their secrets into tickets, screenshots, Git or client bundles.
- The original `the-palette` Production/Preview configuration remains unchanged. Branch-specific Git deployment is disabled for `codex/native-mobile-beta`; deployments use an explicit CLI link to the separate beta project.

## Expo project

- Owner/project: [@kiimiia/laque-mobile](https://expo.dev/accounts/kiimiia/projects/laque-mobile)
- EAS project ID: `c798894e-db94-4b60-88ca-0f75a1e05cdd`
- CLI authentication and `project:info` verified ownership/linkage. Dynamic app configuration now includes the project ID and owner; push registration reads that resolved Expo configuration.
- Initial `e2e-smoke` cloud builds submitted: [Android](https://expo.dev/accounts/kiimiia/projects/laque-mobile/builds/cba6e738-3078-466e-a893-280e8915cba3), [iOS Simulator](https://expo.dev/accounts/kiimiia/projects/laque-mobile/builds/149b705c-e640-485c-b1f3-08dbfb9be4f4). Both initial smoke builds **finished successfully**. They deliberately show the unconfigured-service screen. They do not establish authentication, billing, signed beta distribution or physical-device acceptance.

Both connected `beta-preview` builds finished successfully and use the verified isolated backend: iOS Simulator `3fc3e493-07dd-4c85-9c77-78bb5f8dd79c`, Android APK `2b7f0df7-92fb-4256-93ac-4c923f764943`. This profile does not require store accounts. It cannot be installed on a physical iPhone.

Google Play account progress is recorded above. Apple enrollment, store app/package/signing setup, RevenueCat, APNs/FCM credentials, email delivery verification, OAuth and physical-device acceptance remain open.

## Verification and fixes

- Reproduced the old-account price fallback in test mode. Sandbox configuration now requires explicit prices and returns 503 before database reservation when missing. The existing live catalog behavior is retained. Four new unit tests cover these boundaries.
- EAS rejected empty strings in the smoke profile's environment. Non-empty invalid-service sentinels keep the profile valid and disable connections; a mobile regression test verifies this behavior.
- Root lint caught a synchronous state update in the existing new admin report screen; initial loading now follows the asynchronous request, and obsolete initial responses are discarded.
- Root lint, 29 unit tests, all PostgreSQL suites in CI order, production smoke build and 20 browser tests passed locally. Mobile type-checking/lint and 21 component/security tests passed. See `results.json` for counts and environment; this is not a hosted CI or physical-device certification.

The connected iOS Simulator build passed Maestro 2.10.0 on iPhone 17/iOS 27: sign-in, saved design, authenticated stop/relaunch and completed-refund UI. A second native journey passed customer→creator→customer switching, separate saved lists and creator business controls. A third journey opened a shared design and sent a unique message; the creator JWT verified exactly one database row. Android native journeys and physical-device acceptance remain open. EAS-hosted Maestro requires a paid plan on this account; no plan was purchased. The local simulator fallback does not require that subscription.

The release source is committed in `0240854` with the CI SDK fix in `cc6e3f9`. EAS connected binaries were uploaded before that source commit, from the same mobile runtime files; later edits only changed CI, tests and reports. They are engineering preview artifacts. Store release builds still require a final approved commit and complete acceptance.
