# Verification and open acceptance gates

Date: 27 September 2026. See `results.json` for the recorded local counts and environment. Local automated total: **662 passed, 0 failed**. Hosted API evidence is recorded separately below; it does not establish physical-device or native-store acceptance.

## Verification order

Root: locked `npm ci`; lint and unit jobs; PostgreSQL regressions → security → Phase 3 → Phase 4 → Phase 5 → Phase 6 → mobile backend; browser installation → production smoke build → Playwright.

Mobile: separate locked `npm ci`; TypeScript → Expo lint → Jest/RN Testing Library; iOS and Android Hermes bundle export. GitHub mobile workflow adds actual Android/iOS compilation. EAS workflow adds Maestro on both native builds. The Expo project is linked and both initial standalone EAS smoke builds finished; connected beta builds and Maestro authentication are being verified. Build status is recorded separately in `account-setup.md`. The local system has Xcode 27 but no usable CocoaPods; attempting isolated CocoaPods installation failed at the system Ruby header dependency. Android SDK is absent.

The existing CI order is retained. Local execution used macOS arm64, Node24 and native PostgreSQL17.10 with multiple connections. CI uses Ubuntu for backend jobs; the exact hosted runner environment has not been executed for this branch.

## Actual isolated hosted evidence

Project `atjwbdrvgljddedtwoqo`, backend `https://laque-beta.vercel.app`, synthetic accounts only:

- Schema-only baseline plus actual managed Auth/Storage schemas rehearsed; 22 migrations applied atomically to beta, 66 public tables protected by RLS.
- Real customer, creator and stranger JWTs; onboarding roles persisted; signed-out mutation and direct private-billing access denied.
- Private upload bytes accessible only through signed URLs; draft hidden from stranger; published image bytes available. Customer saved into own collection; stranger denied.
- Retrying the same message UUID created one row. Stranger and blocked sender rejected.
- Creator time zone/working hours saved through the app API; customer denied. Concurrent same-slot requests created one booking; stranger cancellation denied; creator confirmation persisted.
- Stripe sandbox Checkout created for AED20 and returned through the allowlisted mobile link. Settlement/refund evidence is tracked separately as it completes.
- Three scheduled worker deliveries returned HTTP200 with no timeout.

The first hosted fixture incorrectly tried to write `creator_booking_settings` directly. Permission denial was correct; the mobile implementation already uses `/api/update-availability`. The fixture was corrected without weakening permissions. Test-script field-name errors were also corrected against the actual schema; these were not app defects.

## Role and transition coverage

| Flow | States/roles that matter | Local evidence | Remaining acceptance |
|---|---|---|---|
| Authentication | Signed out → verification/recovery → onboarded; customer/creator; expired callbacks | Callback scheme/error validation, protected children, storage partial-write tests, prior auth suites | Real email/Google/Apple, expired links, interrupt/kill and two devices |
| Account switching | A → B → A during in-flight work; logout; token refresh | Epoch rejects old responses even after returning to A; serialized encrypted storage; cache/SDK cleanup implementation | Real realtime channels/SDK purchase dialog during switch, OS image cache |
| Discovery | Public/private/deleted design; stranger/owner; loading/error/empty; pagination | Existing RLS plus new component/collection constraints; typed adapters | Creator publishes → customer discovers/saves/shares on both platforms |
| Collections | Own association create/retry/remove; private referenced design | Unique association and visibility policy; ignored duplicate upserts | Native offline save retry and disappearing source content |
| Messaging | Participant/stranger; sent/retry; block/hide/unhide; private attachment | Actual-role SQL forbids stranger/blocked messaging, participant-only hide, private-image reads, attachment-cleanup race | Two live accounts, realtime disconnect/reconnect, actual signed Storage URLs and OS picker |
| Notifications | Permission denied; token moves account; expired token; receipt retry; tap after revoked access | Exclusive claims, stale-token acknowledgement denied, account transfer deletes old queued deliveries | APNs/FCM/Expo receipts, denied OS permission, invalid real token, revoked-access taps |
| Booking | Customer request; creator confirm/decline; either participant pre-start cancel; stranger denied | Real roles and concurrency, IANA instant checks, immutable price/deposit/location, stale location rejection, cancel retry | Native two-account lifecycle, timezone-different devices, actual service location and API/SDK contract |
| Deposit/refund | Pending checkout → settlement; cancel before/after settlement; refund pending/failed/succeeded | Existing late-refund/reconciliation tests; new creator outcome and concurrent return-context tests; DB obligation blocks deletion | Stripe test Checkout and webhooks; verify receipt/refund IDs and native outcome after return/kill/retry |
| Reschedule | Cancel existing → durable refund → independent new request | Separate state and deposit UI, shared cancellation transaction | Two distinct receipts; old refund delay/failure while new booking proceeds |
| Generation | Reserve → processing → complete/released; refund during hold; process restart | Existing generation/credit SQL suites and mobile durable request implementation | Actual AI worker, app termination/backgrounding, signed image expiry and user-visible balance |
| Consumable credits | Purchase/pending/cancel; duplicate/delayed events; restore after spending; refund-before-grant | Store/environment/transaction dedupe, owner binding, server claims; duplicate restore does not grant consumed credits | Real Apple/Google sandbox transactions and restore; provider cancellation/partial failures |
| Subscriptions | Web/native entitlement merge; renewal/expiry/revocation; cross-channel checkout | Profile lock prevents simultaneous reservations; expired entitlement cannot bypass upload quota; snapshot fence | Historical period refunds, refund reversals and transfer policy remain critical implementation/integration gaps |
| Reports | Reporter visibility; stranger; administrator review | Report target checked using real actor JWT; admin API denies non-admin and invalid writes | Support team's actual moderation workflow and retention policy |
| Deletion | Active booking, unsettled refund, store event/purchase pending, active subscription; terminal deletion | Database blocks both participants while refund outstanding; prior deletion/storage tests | Real Auth/Storage deletion and byte removal, provider subscription termination, re-registration/restore |
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
10. Successful CI native builds, complete native journeys, TestFlight and Google Play internal-testing installation.
