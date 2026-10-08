# Verification and open acceptance gates

Date: 27 September 2026. See `results.json` for the recorded local counts and environment. Local automated total: **662 passed, 0 failed**. Hosted API evidence is recorded separately below; it does not establish physical-device or native-store acceptance.

## Verification order

Root: locked `npm ci`; lint and unit jobs; PostgreSQL regressions → security → Phase 3 → Phase 4 → Phase 5 → Phase 6 → mobile backend; browser installation → production smoke build → Playwright.

Mobile: separate locked `npm ci`; TypeScript → Expo lint → Jest/RN Testing Library; iOS and Android Hermes bundle export. GitHub mobile workflow adds actual Android/iOS compilation. EAS workflow adds Maestro on both native builds. The Expo project is linked and both initial standalone EAS smoke builds finished; connected beta Android APK and iOS Simulator builds also finished. EAS-hosted Maestro rejected the free account; local Maestro 2.10.0 completed the connected iOS 27 journey: real sign-in, saved design, session recovery after stop/relaunch, and cancelled appointment with a completed full refund and no pay action. Native customer→creator→customer data isolation and a native message mutation also passed. Android native journeys remain unverified. Build status is recorded separately in `account-setup.md`. The local system has Xcode 27 but no usable CocoaPods; attempting isolated CocoaPods installation failed at the system Ruby header dependency. Android SDK is absent.

The existing CI order is retained. Local execution used macOS arm64, Node24 and native PostgreSQL17.10 with multiple connections. CI uses Ubuntu for backend jobs; the root locked-install/lint/unit/PostgreSQL-in-order/browser sequence passed on GitHub Ubuntu at `cc6e3f9`. Mobile type/lint/component/export passed too. The first Android native job failed in SDK setup because the action requested removed package `tools`; explicitly requesting `platform-tools` corrected it and the Android native build passed. The iOS native CI build also passed. Successful runs: [root Verify](https://github.com/Abbsogol/the-palette/actions/runs/36329861274) and [Mobile verification including both native builds](https://github.com/Abbsogol/the-palette/actions/runs/36329861250). These runs attest application commit `cc6e3f9`; later report/Maestro-only commits do not change runtime code.

## Actual isolated hosted evidence

Project `atjwbdrvgljddedtwoqo`, backend `https://laque-beta.vercel.app`, synthetic accounts only:

- Schema-only baseline plus actual managed Auth/Storage schemas rehearsed; 22 migrations applied atomically to beta, 66 public tables protected by RLS.
- Real customer, creator and stranger JWTs; onboarding roles persisted; signed-out mutation and direct private-billing access denied.
- Private upload bytes accessible only through signed URLs; draft hidden from stranger; published image bytes available. Customer saved into own collection; stranger denied.
- Retrying the same message UUID created one row. Stranger and blocked sender rejected.
- Creator time zone/working hours saved through the app API; customer denied. Concurrent same-slot requests created one booking; stranger cancellation denied; creator confirmation persisted.
- Two actual AED20 sandbox Checkouts settled through Stripe-hosted forms and signed webhooks. Cancellation after payment produced a succeeded full refund; settlement after cancellation also automatically produced a succeeded full refund and left the booking cancelled/unpaid. Both participant status APIs report refunded; a stranger receives 404. Exact synthetic receipt/refund IDs are in `hosted-results.json`.
- Connected iOS build `3fc3e493-07dd-4c85-9c77-78bb5f8dd79c` passed Maestro on a dedicated iPhone 17/iOS 27 Simulator. It signed in, displayed the hosted saved design, retained authentication across stop/relaunch, and displayed the late-deposit booking as cancelled with “Full deposit refund completed” and no payment action.
- A second connected iOS journey switched customer→creator→customer, asserted the previous profile was absent, verified the creator saved list was empty and creator business controls were present, then recovered the customer saved design. It does not cover switching during an in-flight native purchase or realtime event.
- A third iOS journey opened the shared design and sent a unique text message. The creator’s real JWT independently read exactly one persisted customer message from Supabase. This proves a permitted native mutation; simultaneous two-device realtime behavior remains unverified.
- A largest-text simulator spot check navigated Profile→Saved→Design. Manual screenshot inspection still found awkward heading growth and word wrapping; this is not a visual/accessibility acceptance pass. The dedicated simulator was restored to its original `large` text setting.
- A fourth disposable creator uploaded private bytes and deleted its account through the app endpoint. Auth user, profile and actual Storage bytes were removed.
- A real sandbox checkout event was deliberately signed and replayed twice to the hosted webhook after refund. Both returned 200 and left exactly one receipt and one Stripe refund. This tests hosted deduplication; it is not a claim of Stripe-origin redelivery.
- Three scheduled worker deliveries returned HTTP 200 with no timeout.

The first hosted fixture incorrectly tried to write `creator_booking_settings` directly. Permission denial was correct; the mobile implementation already uses `/api/update-availability`. The fixture was corrected without weakening permissions. Test-script field-name errors were also corrected against the actual schema; these were not app defects.

## Role and transition coverage

| Flow | States/roles that matter | Local evidence | Remaining acceptance |
|---|---|---|---|
| Authentication | Signed out → verification/recovery → onboarded; customer/creator; expired callbacks | Callback scheme/error validation, protected children, storage partial-write tests, prior auth suites | Real email/Google/Apple, expired links, interrupt/kill and two devices |
| Account switching | A → B → A during in-flight work; logout; token refresh | Epoch rejects old responses even after returning to A; serialized encrypted storage; native customer→creator→customer profile/saved-data isolation passed | Real realtime channels/SDK purchase dialog during switch, OS image cache |
| Discovery | Public/private/deleted design; stranger/owner; loading/error/empty; pagination | Existing RLS plus new component/collection constraints; typed adapters | Hosted publish/discover/save/collection passed; iOS saved content rendered. Native publishing/sharing and Android remain open |
| Collections | Own association create/retry/remove; private referenced design | Unique association and visibility policy; ignored duplicate upserts | Native offline save retry and disappearing source content |
| Messaging | Participant/stranger; sent/retry; block/hide/unhide; private attachment | Actual-role SQL forbids stranger/blocked messaging, participant-only hide, private-image reads, attachment-cleanup race | Hosted permitted/forbidden messaging and actual signed Storage bytes passed. Native two-account realtime disconnect/reconnect and OS picker remain open |
| Notifications | Permission denied; token moves account; expired token; receipt retry; tap after revoked access | Exclusive claims, stale-token acknowledgement denied, account transfer deletes old queued deliveries | APNs/FCM/Expo receipts, denied OS permission, invalid real token, revoked-access taps |
| Booking | Customer request; creator confirm/decline; either participant pre-start cancel; stranger denied | Real roles and concurrency, IANA instant checks, immutable price/deposit/location, stale location rejection, cancel retry | Native two-account lifecycle, timezone-different devices, actual service location and API/SDK contract |
| Deposit/refund | Pending checkout → settlement; cancel before/after settlement; refund pending/failed/succeeded | Existing late-refund/reconciliation tests; new creator outcome and concurrent return-context tests; DB obligation blocks deletion | Actual two Stripe test Checkouts, signed webhooks and succeeded refunds verified; native completed-refund screen passed. Refund failure and checkout return/kill/retry remain open |
| Reschedule | Cancel existing → durable refund → independent new request | Separate state and deposit UI, shared cancellation transaction | Two distinct receipts; old refund delay/failure while new booking proceeds |
| Generation | Reserve → processing → complete/released; refund during hold; process restart | Existing generation/credit SQL suites and mobile durable request implementation | Actual AI worker, app termination/backgrounding, signed image expiry and user-visible balance |
| Consumable credits | Purchase/pending/cancel; duplicate/delayed events; restore after spending; refund-before-grant | Store/environment/transaction dedupe, owner binding, server claims; duplicate restore does not grant consumed credits | Real Apple/Google sandbox transactions and restore; provider cancellation/partial failures |
| Subscriptions | Web/native entitlement merge; renewal/expiry/revocation; cross-channel checkout | Profile lock prevents simultaneous reservations; expired entitlement cannot bypass upload quota; snapshot fence | Historical period refunds, refund reversals and transfer policy remain critical implementation/integration gaps |
| Reports | Reporter visibility; stranger; administrator review | Report target checked using real actor JWT; admin API denies non-admin and invalid writes | Support team's actual moderation workflow and retention policy |
| Deletion | Active booking, unsettled refund, store event/purchase pending, active subscription; terminal deletion | Database blocks both participants while refund outstanding; prior deletion/storage tests | Actual Auth/profile/private Storage byte deletion passed for a disposable creator. Provider subscription termination and re-registration/restore remain open |
| Accessibility | Screen reader, large text, keyboard, contrast, touch targets | Labels, roles, 44–52-point controls and keyboard containers implemented | Physical VoiceOver/TalkBack, dynamic font scaling, final contrast/clipping review |

## Mocks and local fixtures are limited

- PostgreSQL uses ordinary authenticated/anon roles (`rolbypassrls=false`) and a privileged server role; this checks actual SQL effects, locking and RLS, not mocked SQL. Its baseline is a reconstructed public catalog. Auth helpers and Storage catalogs are minimal substitutes for managed Supabase, and no actual email, Storage byte fetch or Realtime service is present.
- Server endpoint tests mock provider replies/SDK adapters. They do not verify RevenueCat's real response shape, original account identity behavior, sandbox transactions, Stripe/Apple/Google timing or APNs/FCM delivery.
- Jest renders React Native components with Expo/native mocks. It does not exercise the OS Keychain, native purchase sheet, real keyboard or accessibility engines.
- Existing Playwright tests cover the production-built **web** application with synthetic network fixtures. They are not native mobile E2E tests.
- Metro export proves both platform bundles compile. It is not a native binary, successful app launch, signed distribution, or device acceptance.

## Required evidence before closing Phase 1

For each scenario, record app/build SHA, platform/device/OS, actor role, isolated project ID, input action, redacted database state before/after and visible outcome. Record expected denials as well as permitted changes. Store secrets outside artifacts.

1. Physical iPhone and Android authenticate, onboard and switch accounts; no earlier account's content reappears.
2. Creator publishes a design; customer discovers/saves/organizes/shares; stranger cannot access private content or messages.
3. Two requests race one slot. Exactly one reservation exists. Test stale price/location/timezone and daylight-saving boundaries.
4. Actual Stripe test deposits: cancel before settlement, after payment, delayed event, duplicate event and refund failure; full obligation remains durable and both users see the correct status.
5. Native sandbox credit and subscription purchase/restore/renewal/expiry/refund/reversal with exact ledger and balance evidence. Resolve the unsupported cases in README first.
6. Kill/background the app during auth, booking, generation and checkout; recover without duplicate effects.
7. Denied push permission, token transfer and invalid token; notification tap after blocking or content deletion.
8. Deletion denied during unresolved financial work; terminal deletion removes Auth/profile and owned Storage bytes. Restore cannot attach an old consumed purchase to a new account.
9. VoiceOver/TalkBack, large text, keyboard-open forms, contrast and Figma comparisons on real renderings.
10. CI native builds passed at `cc6e3f9`; complete native journeys, TestFlight and Google Play internal-testing installation remain required.

## Verification defects corrected during execution

- Actual schema grants allowed authenticated clients to TRUNCATE a public lookup table, bypassing RLS. Reproduced before migration 022; five privilege tests now pass and the fix is deployed only to isolated beta.
- Android CI setup requested the removed SDK `tools` package. Explicit `platform-tools` configuration corrects the job setup; compilation is tracked separately.
- Maestro’s initial selectors targeted visible field labels instead of inputs, and omitted the tab accessibility suffix, keyboard Return actions and iOS password-save prompt. The account-switch fixture also selected the background sign-out control instead of the native alert; a relational selector targets the confirmation beside “Stay”. Those test-fixture defects were corrected from actual hierarchy/screenshot evidence; the complete iOS auth/save/relaunch/refund journey then passed.
- The message fixture initially omitted Maestro’s required environment-variable prefix and targeted a control covered by the multiline keyboard. Prefixing the variable and dismissing the keyboard via the heading corrected the test; the message then persisted exactly once and was readable by the creator.
- A fresh dedicated simulator resolved an old simulator’s stale runtime reference. No existing simulator or its data was erased.
