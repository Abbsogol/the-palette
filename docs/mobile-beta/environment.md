# Isolated environment and account setup

Expo is linked to `@kiimiia/laque-mobile`. As of 28 September, the owner reports Apple Developer and Google Play accounts are under review and will create RevenueCat after approval. Store signing and distribution remain unverified. The isolated OpenAI **LaQue Beta** project exists; its credential and generation verification are pending. Resend is configured in the beta backend and Supabase Auth with a sending-only key restricted to **laque.app**; SMTP authentication passed, while inbox delivery and signup/recovery journeys remain unverified. See `account-setup.md` and `service-connections.json` for current evidence. Keep passwords, keys and recovery codes out of chat and Git. Account/project names or IDs are enough for coordination; use each provider's normal secret settings for keys.

1. Create a separate Supabase project and a separate backend deployment for development/beta, with synthetic data only. Record their IDs/origins. Obtain/review a schema-only baseline and rehearse migrations 001–022 in a disposable staging database. The regression fixture is not a deployable Supabase baseline.
2. Configure separate Storage, email delivery, Google/Apple OAuth clients, Stripe **test** keys/webhook endpoint and AI credentials/budget. Verify an incoming JWT is from this project. Do not copy production environment files. The recorded production ref `faunikvhoommbebsmevg` is rejected by the mobile handshake.
3. Register the final bundle/package IDs. Current defaults (`app.laque.mobile`, `.development` suffix) are provisional until accepted by the stores. Register custom auth callback schemes exactly, including development and beta. Configure Supabase redirect allowlists and OAuth callbacks. Universal/app links remain an additional release-hardening task; custom schemes must be exercised on both devices.
4. The Expo project is linked in `mobile/app.config.ts`; configure APNs/FCM credentials. Both build variants use project `c798894e-db94-4b60-88ca-0f75a1e05cdd` unless explicitly overridden. Provision signing only in the normal EAS/provider workflow. `eas.json` separates development, simulator and beta; beta build config refuses missing project/service IDs.
5. In RevenueCat create the two platform apps, use Supabase UUIDs as custom App User IDs, and set restore/transfer behavior to preserve original ownership. Map consumables 5/15/40 and monthly premium5/pro_creator20 to actual store SKUs. Insert those mappings in `mobile_store_products` only after confirming product IDs and quantities. Use offerings containing these SKUs and sandbox public SDK keys. No placeholder SKU is activated by a migration.
6. Configure the protected webhook and an authenticated retry scheduler. Verify duplicate/delayed events and record database receipts before enabling sales. Current unsupported store cases in README are release blockers even after accounts exist.

## Configuration

Mobile public values are in `mobile/.env.example`; only publishable Supabase and RevenueCat SDK keys belong there. The service-role key, Stripe secret, RevenueCat server secret, webhook secret and Expo access token stay on the server.

Additional server settings:

- `MOBILE_ENVIRONMENT=development` or `beta`
- `MOBILE_SUPABASE_PROJECT_REF=<isolated ref>`
- `MOBILE_RETURN_SCHEMES=laque-dev` for development or `laque` for beta
- `REVENUECAT_ENVIRONMENT=SANDBOX`
- `REVENUECAT_APP_IDS=<comma-separated platform app IDs>`
- `REVENUECAT_SECRET_KEY=<server-only key>`
- `REVENUECAT_WEBHOOK_SECRET=<random secret of at least 24 characters>`
- `EXPO_ACCESS_TOKEN=<server-only push access token, if push security enabled>`
- `CRON_SECRET=<server-only scheduler bearer secret>`

Schedule `/api/mobile/process-jobs` at least once per minute on suitable infrastructure; allow up to 300 seconds per bounded worker request. Monitor non-2xx responses, failed outbox rows, expired claims, pending purchase intents and `needs_review` billing rows. Validate retry throughput under realistic load before beta. Notifications have generic text and the app rechecks access after a tap.

## Synthetic account guide

After isolation is verified, create `beta-customer-1`, `beta-customer-2` (stranger) and `beta-creator-1` using test inboxes owned by the team. Use distinct non-production passwords in the test secret store. Never provision real customers by this guide.

- Complete onboarding with ordinary authenticated sessions; creator publishes one public and one private design, sets Asia/Dubai, a 30-minute AED100 service with AED20 deposit and all-week test hours.
- Customer1 saves the public design, creates a collection and requests an available date two days ahead. Customer2 attempts the same slot concurrently and attempts to read the private design/conversation.
- Test reports against synthetic content with a separate admin test account; never give the customer or creator admin privileges.
- Save the resulting user/design/service/booking IDs and redacted before/after query evidence in the verification record. Do not store passwords, tokens or raw payment payloads in artifacts.
- Connected beta Maestro input uses MAESTRO_TEST_EMAIL/MAESTRO_TEST_PASSWORD from the runner's secret environment. Full native multi-account flows remain to be authored against this real fixture.

Official setup references: [Expo push](https://docs.expo.dev/push-notifications/push-notifications-setup/), [Expo native billing](https://docs.expo.dev/guides/in-app-purchases/), [Expo EAS/Maestro builds](https://docs.expo.dev/eas/workflows/examples/e2e-tests/).

## Expo preview before store enrollment

For a physical iPhone development client connected to the existing beta services, use `beta-development` (`npm --prefix mobile run build:connected:ios`). It selects EAS Preview, whose four public backend settings were compared successfully with local beta settings on 2026-09-28. The original Development EAS environment is empty and must not be treated as connected. The beta app config allows initial EAS project discovery before variables are loaded, but requires the service configuration on the build worker; the app also checks configuration and backend identity before authentication. iPhone signing remains blocked pending Apple enrollment and suitable credentials. See `google-sign-in.md`.

The `preview` EAS profile builds a standalone Android APK for direct installation and an iOS Simulator app for a Mac. These do not require Google Play Console or paid Apple Developer enrollment. An Expo account/project and verified isolated service configuration are still needed for a useful connected preview. Without service configuration the app shows its setup screen.

From `mobile/`, use `npm run build:preview:android` or `npm run build:preview:ios` after EAS login/project linkage. The iOS preview is **not installable on an iPhone**. For an EAS build on a physical iPhone use the development/beta profile after Apple enrollment and signing; TestFlight/Play distribution and real store billing remain separate gates. Expo Go cannot verify this app's native purchase integration.

See [Android APK installation](https://docs.expo.dev/build-reference/apk/), [iOS Simulator builds](https://docs.expo.dev/build-reference/simulators/) and [native purchase requirements](https://docs.expo.dev/guides/in-app-purchases/). The first EAS `e2e-smoke` builds completed on 27 September 2026; see [account setup evidence](account-setup.md) for status. These intentionally have no connected backend.

## Provisioned synthetic beta access

The three confirmed fixtures are `customer@laque-beta.example`, `creator@laque-beta.example` and `stranger@laque-beta.example`. They cannot receive email; use them for password-based journeys only. Their generated passwords are in the owner-readable, gitignored `.backups/beta-test-accounts.json` on the deployment workstation; do not copy that file into source control or reports. EAS Preview holds the customer credentials as secret `BETA_TEST_EMAIL`/`BETA_TEST_PASSWORD` variables for the workflow.

Creator fixture: Asia/Dubai, 09:00–18:00 all week, “Beta manicure”, AED100 total/AED20 deposit, 30 minutes, synthetic service location. The customer owns a saved “Beta rose sample” and “Beta favourites” collection. Two cancelled bookings have succeeded full refunds, including one late deposit.

Use `beta-preview`, not the unconfigured `e2e-smoke`, for connected testing: `npx eas-cli@latest build --profile beta-preview --platform android` (APK) or `--platform ios` (Simulator). The beta backend identity is verified through `/api/mobile/config`. Read the current build IDs in `results.json`.

The mobile PR is stacked on the earlier security-review PR1 (`codex/phase-1-foundation`). The separate redesign merged to `main` has unresolved integration conflicts with that earlier branch. Merge neither branch into production until the reviewed fixes and redesign are reconciled and reverified together. Beta deployment uses the reviewed backend branch independently.
