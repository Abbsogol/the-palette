# Authentication link screens — 7 October 2026

The connected callback now uses LaQue’s shared burgundy/rose background, Anola heading typography, translucent password card and gradient actions. This is an app layout implementation; Google/Apple consent and payment confirmation remain provider-owned screens.

## Screens and transitions

- Checking: waits for a successful SDK code exchange and a matching current session.
- Email verified / signed in: explicit Continue returns to the saved, allowlisted destination. Profile completion remains handled by the existing onboarding guard.
- Recovery: masked new password and confirmation, show/hide, minimum-length/matching validation, submitting state, correction/retry feedback, and explicit Password updated completion. Draft passwords are never persisted.
- Expired/used/missing-verifier links: a fresh recovery or verification email request, plus Back to sign in. Verification requests do not require a password or repeat sign-up.
- Invalid/incomplete links: safe explanations without raw callback codes or provider descriptions.
- Connection failure: retry the exchange or request a new link. No successful session is implied by returning to the app.
- Account change: clears password drafts, prevents new mutations and discards late completion. An in-flight request is aborted where possible; its bearer is fixed to the original owner, so it cannot update a newly selected account.

Fresh-link forms can remain open with an existing session. Verification resend uses a neutral success message. Completed forms consume the in-memory callback cache, while initial navigator remounts share the exchange rather than exchanging the same single-use code twice. Once AuthProvider adopts the confirmed account, the cache is bound to that account lifecycle and cannot survive logout/relogin.

Recovery authority comes from the SDK’s stored PKCE recovery marker, not the `flow=recovery` query alone. Optional `sb_flow_id` values are validated and passed through to the installed SDK. Callback success is checked against the current session before presentation. Password changes use the same Auth `/user` endpoint as the SDK with a fixed owner bearer, a 15-second abort timeout, versioned error handling, and checked response identity. An uncertain timeout suggests trying the new password rather than claiming that the update did not happen.

## Preview

At `localhost:8084`, tap Profile → Preview account links. The modal provides Verified, New password, Expired and Retry layouts, with a clear preview notice. Preview actions do not send email or call Auth. Request a new recovery link opens the shared email request form; completion remains synthetic.

Visual evidence: `.backups/auth-verified.png`, `.backups/auth-recovery.png`, `.backups/auth-expired-320.png`. Checked at 393 × 852 and 320 × 800; the narrow password fields stayed within the viewport and content scrolls. This does not establish native keyboard or large-text acceptance.

## Verification

- Mobile type-check, Expo lint and all 582 tests across 71 mobile suites passed. The 54 new checks cover this follow-up; see `.backups/auth-verify.log`.
- Connected iOS and Android Hermes bundle exports passed with design preview disabled: `.backups/auth-export.log`. These are bundles, not signed installable builds.
- A controlled restoration of the original callback-cache function reproduced accepting a cached callback after switching accounts. The new regression rejected it after the fix; `.backups/auth-cache-reproduction.log` records the original failure. The implemented source was restored before final checks.
- Component and route tests cover checking/success/error states, fresh-link destinations, password masking/confirmation, duplicate taps/keyboard submits, failed-update draft retention, expired-session clearing, consumed callbacks, unsafe return paths, new incoming links and discarded old responses.
- Mutation tests check immutable bearer ownership, abort on account change, identity mismatches, server weak/same-password feedback, unconfirmed timeouts and current/legacy Auth response formats.
- Contract tests run the installed Supabase SDK with memory storage and mocked HTTP responses. They confirm its recovery marker, verification-resend verifier generation, returned session shape and removal of failed verifiers. The actual SDK may require a fresh email after a failed exchange; the mocked successful retry does not prove a consumed verifier can be reused.
- The isolated beta project `atjwbdrvgljddedtwoqo` rejected a synthetic invalid code with HTTP 404 / `flow_state_not_found`, without creating a session. Evidence: `.backups/auth-hosted-invalid-link.json`. No email was sent and no account password was changed.

The SDK sources inspected were `@supabase/auth-js`’s `GoTrueClient.ts`, `lib/helpers.ts` and `lib/fetch.ts`. The runtime exchange result includes `redirectType` although its public TypeScript return type omits that field. Official API guidance: [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords), [code exchange](https://supabase.com/docs/reference/javascript/auth-exchangecodeforsession), [user updates](https://supabase.com/docs/reference/javascript/auth-updateuser), [Expo Router parameters](https://docs.expo.dev/router/reference/url-parameters/).

## Open acceptance

Real email delivery, successful verification/recovery, expired email retries, provider cancellation/consent, cold-start/backgrounded callbacks and actual password changes on physical iPhone/Android development builds remain open. Complete VoiceOver/TalkBack, large text and native keyboard checks. Verify interruption/account-switch outcomes against hosted Auth, including a server commit whose response is lost.

The complete root CI/database/browser sequence was not rerun for this mobile-only follow-up; no backend schema or API changed. No deployment, store submission or push was performed. MB-002, MB-005 and MB-012 and the broader Phase 1 acceptance gates remain open.
