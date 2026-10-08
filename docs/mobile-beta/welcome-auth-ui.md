# Welcome and required authentication

Originally implemented 2026-09-28. Updated 2026-10-08: the connected app is members-only. The beta database installer was confirmed successful by the user; production remains unchanged.

## Reference and entry flow

Inspected the supplied Figma frames:

| Frame | Node |
| --- | --- |
| [Onboarding 1](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-3103) | 345:3103 |
| [Onboarding 2](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-3115) | 345:3115 |
| [Onboarding 3](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-3130) | 345:3130 |
| [Onboarding 4](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-3145) | 345:3145 |
| [Onboarding 0](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=413-4507) | 413:4507 |

First launch shows 1 → 2 → 3 → 4 → 0. Next advances, Back returns to the preceding slide, Skip opens 0 from any slide, and Get started finishes slide 4. Completion is stored as a non-secret device preference. Returning signed-in users skip the introduction; returning signed-out users see authentication. A fresh installation/storage reset repeats the introduction.

Onboarding 0 retains the Figma background, Anola branding and visual style, with Google, Apple, email sign-in/sign-up, creator registration. There is no guest entry or bottom navigation on authentication screens. Six bottom tabs remain inside the signed-in app. Password forms support recovery, visibility controls, inline failures and verification resend. Sign-up without a session does not unlock the app. Profile setup remains after verification/sign-in, without repeating the old introduction.

## Required authentication

All app content, including Home and public member profiles, requires a session. Direct links retain a safe destination after sign-in. On a fresh install, even a Home/profile/authentication deep link shows the introduction first; Skip completes only the introduction and leads to authentication. Cold email/OAuth callbacks and the account-closure receipt remain reachable. Blocked screens never mount or issue queries; loading session state never flashes content. Sign-out clears account-scoped data and removes protected screens immediately.

`GET /api/mobile/home-content` now requires verified Supabase identity and denies unsigned/invalid/deleted-account sessions before accessing configuration or issuing media URLs. Pinterest already requires authentication. Migration 037 removes anonymous/public grants on public application tables, columns, sequences and RPCs, while preserving effective authenticated/service permissions and existing RLS. It denies new anonymous private-media access. It does not make each member's profile private to other members or change balances, purchases, staff access, or deletion safeguards. The masked `profiles` view remains intentional; changing it to security invoker without redesigning its raw-column access is not part of this change.

Apply `supabase/beta-install-members-only.sql` only in beta project `atjwbdrvgljddedtwoqo`. Expected result: `beta members-only ready (037)`, anonymous_profiles=false, member_profiles=true, raw_email=false. The installer verifies the known, verified beta Owner and is safe to repeat. The user confirmed all four expected result fields on 8 October 2026, so hosted beta activation is complete. Privacy/terms web pages, provider callbacks and non-content service-readiness configuration remain accessible. Existing public-storage asset URLs and already-issued signed URLs cannot be recalled by this change.

## Preview

`npm --prefix mobile run preview:home` serves the visual flow at http://localhost:8084 and in the compatible Expo Go preview. Its introduction preference is separate from the connected app. After Next/Skip, choose **Explore demo account** to explore as **LaQue Demo** without an email or password. The same action is available on the preview's email forms. Returning preview visitors also begin at the authentication screen.

The demo unlocks fixture Home categories/sorting, Search and Length filters, artist/salon listings, design details, temporary save toggles, and the Lab/My Generations screens. Profile now opens the Sarah owner fixture and offers **Settings → More → Exit demo account**, which discards the preview session. Search cards open the selected artist/salon public fixture. Owner Public Profile, edit, Saved and Collections preview states are available; see [profile-ui.md](profile-ui.md). Search-local state resets on leaving Search. Messaging, real bookings, notifications and stories explain that they are not connected; fixtures do not submit real mutations.

There is no automatic guest Home or guest button in the preview. Demo access exists only in the isolated preview: it creates no Supabase account/session, never submits credentials and cannot authorize real catalog changes or purchases. The shared authentication view shows no demo action unless its preview caller supplies one. Release entry-point tests verify that even a set preview flag cannot select the preview in a production bundle. Actual authentication runs in the connected LaQue development build with its registered callback scheme; this demo cannot validate live sign-in.

## Verification

After adding the demo account, `npm --prefix mobile run verify` passed: TypeScript, lint and **197 tests in 19 suites**. The new checks exercise demo entry, Search/Length filtering, details and local saves, exiting back to guest restrictions, clearing demo saves, unavailable-tab feedback and development-versus-release entry selection. The normal auth view has no demo button. Evidence: `.backups/demo-account-verification.log`. No physical-device, live-login or pixel comparison result is implied by these component tests; the owner must reload the running Expo Go preview to see the new action.

`npm --prefix mobile run verify` passed: TypeScript, lint and **182 tests in 18 suites**. This includes 49 additional tests covering slide ordering/Skip, completion persistence/failure, direct-link restrictions, session loading/sign-out, connected and preview Home gates, email validation, verification prompts, duplicate submissions, errors/retries, recovery requests, creator destination, OAuth cancellation, malformed callbacks and retryable PKCE exchange.

Supabase, browser sessions and storage calls are mocked in component/authentication tests. These tests do not prove inbox delivery, live OAuth or device callback behavior. The public beta Supabase `/auth/v1/settings` response was checked read-only: email enabled, sign-up allowed, Google disabled, Apple disabled. No users were created and no provider settings were changed.

Logs are saved in `.backups/welcome-verification.log` and `.backups/welcome-export.log`.

`CI=1 npx --no-install expo export --platform all` also passed for iOS, Android and web. This checks production bundling; it is not a signed native build or a device test. `git diff --check` passed.

## Open integration and acceptance checks

- The owner subsequently configured Google on 2026-09-28. Public settings now confirm Google enabled, and its authorization endpoint redirects to Google with the correct client ID and beta callback; end-to-end login remains to be verified. Apple is still disabled and requires configuration. See `google-sign-in.md` for the provider check, mobile availability fix and latest verification evidence.
- Verify email sign-up, delivery, verification, recovery, Google/Apple consent, cancellation, cold-start callbacks and return destinations on physical iOS and Android development builds.
- Complete keyboard, large text, VoiceOver/TalkBack and screenshot comparison checks. Browser inspection failed because the browser could not verify the admin-enforced policy for localhost; no rendered visual comparison was completed.
- Licensed Sofia Pro remains missing. Anola is bundled; body text uses the existing fallback. Pixel-level typography acceptance remains open.

This change does not close the broader private-beta acceptance phase or deploy a signed native build.

## Verification and recovery follow-up — 7 October 2026

Callback/recovery layouts and fresh-link forms are implemented locally. Browser preview checks now work and cover 393/320-pixel phone widths. Owner-bound updates and consumed callback-cache guards have focused regressions; the installed SDK contract is also exercised with mocked HTTP. Successful hosted email/recovery and physical-device acceptance remain open. See [auth-recovery-ui.md](auth-recovery-ui.md) for current evidence and limitations.

## Members-only verification — 8 October 2026

The connected app now requires authentication for Home, all tabs and public profile links. The intro and authentication component checks, sign-in/registration/callback regressions, no-mount guards, release-entry isolation and safe return destinations passed (96 focused checks). The full mobile run passed 85 suites/708 tests before the additional return-destination regression, which passed in the focused run. Mobile TypeScript and lint passed. Release bundle export passed for iOS, Android and web; this is not a signed native release or physical-device acceptance.

The full backend run passed 94 files: 922 tests passed and two optional checks were skipped. Six real PostgreSQL-policy tests cover anonymous tables/columns/RPCs/private media, exact member/service permission preservation, masked fields, privacy/staff boundaries, new account creation, idempotence, and beta-installer ownership guard/history. The Next build passed. Vercel deployment `laque-beta-514b8ai30-sogol-s-projects1.vercel.app` is Ready and aliased to `https://laque-beta.vercel.app`; the Home-content session guard is deployed to beta. Production was not changed.

The browser's admin-policy security check still prevents Supabase interaction and live UI inspection. The user ran `supabase/beta-install-members-only.sql` in the hosted beta and returned `beta members-only ready (037)` with anonymous_profiles=false, member_profiles=true and raw_email=false. Hosted beta activation is confirmed by that user-supplied SQL result; an independent live UI/device check remains unavailable. Local evidence is saved under `.backups/members-only-*`.
