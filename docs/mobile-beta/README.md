# LaQue native beta — implementation in progress

**Phase 1 remains open.** The isolated backend is deployed at [laque-beta.vercel.app](https://laque-beta.vercel.app). Supabase beta `atjwbdrvgljddedtwoqo` has the complete schema and 22 migrations, real synthetic accounts and verified Auth/Storage/RLS paths. Both initial native smoke binaries compiled; connected builds and native journeys are being verified. This is an engineering preview, not TestFlight/Play private-beta acceptance. Apple Developer, Google Play Console, RevenueCat and the implementation gaps below remain open. See [account setup evidence](account-setup.md).

## Run locally

From `mobile/`: `npm ci`, then `npm run verify`. Copy `.env.example` to `.env.local` and configure only an isolated project. An unconfigured app deliberately displays the setup screen and makes no service calls. `npx expo run:ios` requires Xcode and CocoaPods; `npx expo run:android` requires Android SDK/JDK. RevenueCat and push notification verification require native development builds. Expo Go is insufficient.

There is a separate mobile lockfile; the root Next.js install and CI sequence remain intact. `npm run test:mobile-backend` runs the additive contract/database suites. For actual concurrent PostgreSQL connections, set the existing guarded `DATABASE_TEST_URL` to a **local** database named `palette_test`.

## Implementation map

| Area | Files | Current implementation |
|---|---|---|
| Native routing | `mobile/src/app` | Home, Search, Lab, Messages, Profile; protected routes and nested creator/account flows |
| Shared UI | `mobile/src/components` | Burgundy/rose components, cards, chips, form fields, calendar, keyboard handling and explicit query states |
| Sessions/data | `mobile/src/lib/{auth,api,account-scope,secure-storage,pending}` | PKCE; encrypted chunked sessions; account epochs, query clearing and request cancellation; durable request identities |
| Discovery | `mobile/src/features/discovery.tsx`, design/creator/collection routes | Search/Length filters, pagination, saving, sharing, public/private content under RLS |
| Creator tools | portfolio, services, availability routes | Private image upload, publishing/edit/delete, fixed service terms, explicit IANA timezone and working hours |
| Messaging/safety | inbox/conversation/privacy/report routes | Text, image/design sharing, unread state, realtime refresh, retry IDs, reporting, blocking and participant-only hiding |
| Appointments | book/booking/appointments routes | Service/date/time/review/request; creator decisions; frozen price/deposit/location; cancellation, refund status, cancel/rebook |
| Lab | `mobile/src/features/lab.tsx` | Existing server credit reservation and recovery; encrypted request ID; history/save/publish |
| Billing | mobile billing/purchases; `lib/mobile-billing.js` | Account-bound SDK, localized offerings, durable webhook transactions, ownership and version fences, provider-derived entitlements, restore without client grants |
| Background work | `lib/mobile-jobs.js` | Bounded refund reconciliation, push receipts/retries, store reconciliation and abandoned-media cleanup |
| Admin | `/admin/reports` | Admin-only report queue with reviewed/resolved state; linked from the existing administration page |

## Milestone status

1. **Environment:** configurations, isolation handshake and development/beta build profiles exist. Hosted API authentication is verified; native platform authentication remains **unverified**.
2. **Accounts/design:** screens and shared foundation exist; basic storage, account switching, callbacks and component checks are automated. Native accessibility, complete visual matching and hosted OAuth/email remain **unverified**.
3. **Discovery/portfolios:** adapters and flows implemented; native two-account publishing/discovery/collection proof remains **unverified**.
4. **Messaging/appointments:** local role/concurrency/refund tests exist. Real private/public Storage bytes, messaging denials and hosted concurrent booking are verified. Push delivery and the two-device lifecycle remain **unverified**.
5. **Lab/billing:** adapters and server ledger implemented. Store integration still has **critical unresolved cases** described below. Native store transactions have not run.

## Remaining implementation and release gates

- **Critical — store event coverage:** `REFUND_REVERSED` is retained pending and fails closed for review. Transfers/family sharing/anonymous legacy ownership are rejected. Historical subscription-period refunds that RevenueCat's latest v1 subscriber snapshot cannot identify need transaction-level provider verification. Do not enable store sales until those cases are implemented and sandbox-tested.
- **Critical — unresolved purchase intents:** interrupted unpaid purchases remain pending until provider/operator reconciliation. A verified expiry/release policy for these intents is still needed; guessing success or granting from a restore response is forbidden.
- **Hosted acceptance:** the separate `laque-beta` Vercel project uses only beta Supabase and Stripe test credentials. All 22 migrations passed a complete managed-schema rehearsal and were applied to beta. Email/OAuth, AI and native store integration remain unverified. The original Vercel Preview still shares production configuration; Git deployment of this feature branch is disabled.
- **Build/device:** signed TestFlight/Play builds, native workflow results, physical iPhone/Android, app termination/resume, VoiceOver/TalkBack, large text and keyboard journeys are unverified. Local Xcode exists, but CocoaPods installation failed because the system Ruby headers are incompatible/missing; Android SDK is absent.
- **Design:** canonical Figma Home background and tab assets are included. Shared native styling and layouts are an initial implementation; no pixel-match claim. Licensed Anola/Sofia Pro fonts, final app icon, onboarding artwork, complete screen comparisons and some profile polish/avatar editing remain open.
- **Operations:** Supabase pg_cron invokes `/api/mobile/process-jobs` every minute using a Vault-held secret; actual HTTP200 responses are verified. Stripe test webhook is registered. Monitoring/alerting, RevenueCat ownership configuration and APNs/FCM remain open. The existing Vercel reminder schedule is unchanged.
- **E2E:** Maestro configuration smoke and an initial staging sign-in journey are checked in. The full two-account booking, messaging, billing, termination and deletion matrix is not yet automated/executed natively.

See [service contracts](contracts.md), [environment setup](environment.md), [verification matrix](verification.md) and [migration/rollback notes](migrations.md). Passing mocked checks or the configuration smoke does not close any of these gates.

Remaining work is tracked with stable IDs in [open beta issues](issues.md).

## Dependency notes

The mobile lockfile includes a CommonJS adaptation of upstream `decode-uri-component` 0.5.0 (MIT license retained in `mobile/vendor`) because Expo Router 57's CommonJS `query-string` dependency still selects the vulnerable older decoder. Only the export format changed; a malformed-URL regression tests the actual router dependency. The xcode tool's `uuid` dependency is overridden to 11.1.1; xcode uses its compatible v4 API, and both native project generations were rerun. `test-renderer` is pinned to 1.2.0 to match React19.2 rather than its newer React19.3 reconciler.

References: [URI decoder advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr), [UUID advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq). Retest and remove these overrides when compatible upstream dependencies include the fixes. Do not use `npm audit fix --force`, which proposed downgrading Expo to SDK46.
