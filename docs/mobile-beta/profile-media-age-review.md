# Profile media and 18+ registration — 30 September 2026

Implemented locally in the existing mobile design system. This change has not been pushed or deployed.

## Product behavior

- Edit profile and onboarding include a banner preview and an overlapping profile photo, separate add/change/remove controls, unique username, bio and location. Creator profiles also include service location. Removing the photo displays an initial; removing the banner restores the default backdrop. Selection/removal remains a draft until Save. Picker cancellation and failures preserve entered fields.
- Connected uploads validate/re-encode images on the server. Avatar/banner paths are owned by the authenticated account; profile updates reject external or foreign media paths. Database writes link the uploaded object atomically with cleanup bookkeeping. Replacement/removal releases the old object for retryable cleanup, while linked current objects are retained. Account closure clears banners and includes their bytes in cleanup enumeration.
- Profile reads include banners. Messages and recipient rows load profile photos, and conversation headers already use the shared profile identity loader. Saving invalidates the account cache so subsequent reads use the current image. This is not a promise of instant cross-device propagation.
- Creator Studio retains services/deposits, availability/time zone, portfolio, Calendar and appointment links. Appointment history retains Upcoming/Past/Cancelled and creator/client views. Cancelled/declined cards link to refund/payment status without implying a completed refund.
- Registration shows separate unchecked **I am 18 or older** and **I have read the Privacy Policy** confirmations. Email signup and Google/Apple entry require both; existing email sign-in and password recovery remain available. Authenticated onboarding requires both again and records server timestamps and policy version `2026-09-29` in private profile data. Retrying completion does not grant more bonus credits or replace its original attestation.
- This is self-attestation, not verified date of birth or identity. A direct call to the public Supabase Auth signup/OAuth endpoint can create an Auth record before app onboarding. The database gate protects onboarding completion and its bonus, not all possible direct Auth account creation. Existing completed accounts are not retroactively re-gated.
- The privacy-policy source now describes 18+ eligibility, the confirmation record and profile banners. The published policy has not yet received this revision.

## Verification

Local Node 24.20.0 / PostgreSQL 17.10 on macOS. Locked root/mobile installs had passed earlier in this implementation; no dependency changes followed those installs. The database suite order matches CI. This is not an Ubuntu CI run or a signed native build.

| Check | Result |
| --- | --- |
| Root lint / mobile typecheck + lint | Passed |
| Root unit | 62 passed |
| PostgreSQL regressions → security → Phase 3 → Phase 4 → Phase 5 → Phase 6 → mobile backend | 50 + 121 + 59 + 58 + 143 + 126 + 126 = 683 passed |
| Mobile Jest / React Native Testing Library | 377 passed, 46 suites |
| Playwright browser installation → production smoke build → Chromium/WebKit tests | 20 passed |
| Connected Expo exports: iOS, Android, web | Passed |
| Browser preview at 393×852 | Missing-consent error, profile editor, actual file chooser using a synthetic image, save/reopen, photo/banner removal, creator activation/tools and cancelled history verified |

**1,142 automated tests passed; zero failures.** New coverage includes wrong-owner/missing/deleting media, removal cleanup, closure enumeration, private attestations, literal booleans, concurrent completion/retry, blocked email/provider/keyboard registration and picker failure. Older successful-signup fixtures now explicitly select the required confirmations; forbidden paths have separate negative tests.

Evidence: `.backups/profile-age-*`, `.backups/secondary-native-*.json`, `.backups/profile-editor-20260930.png`. These are ignored local artifacts. The browser demo makes no live uploads or authentication requests. API tests mock the SDK; native PostgreSQL tests execute SQL/RLS with synthetic roles and Storage rows, not hosted Storage HTTP uploads.

## Rollout and remaining gates

1. Rehearse migrations 023–026 in the isolated beta environment; apply `202609290026_profile_media_age.sql` after 025. It appends the public banner projection but keeps attestations out of the public view.
2. Deploy the updated upload, profile and complete-onboarding handlers together with the matching mobile/web forms and privacy policy. Older unfinished onboarding clients must update to send the required booleans.
3. Verify real uploads, owned URL validation, profile/message rendering, replacement/removal cleanup and account closure with synthetic accounts against hosted Auth/Storage/PostgREST. Verify forbidden access with a second account.
4. Build a fresh native app for the earlier `expo-video` addition. Physical iPhone/Android picker permissions, VoiceOver/TalkBack, keyboard/large-text layouts, signed builds and Maestro device journeys remain unverified.

Rollback: prefer reverting application UI while retaining additive columns and cleanup obligations. Do not remove the new cleanup/enumeration logic while banner objects exist. The old onboarding implementation is retained as `complete_onboarding_before_age_policy` with client/service execution revoked; reverting the wrapper would remove the eligibility requirement and should be an explicit product rollback, not an incidental deployment fix. Preserve recorded attestations and populated media references. Rehearse schema rollback on a database copy.

No hosted migration, deployment, real-user account mutation, push or store submission was performed. Phase 1 remains open for its existing integration and device gates.
