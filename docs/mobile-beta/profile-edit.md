# Edit Profile

Local implementation updated on 7 October 2026. Entry: Profile → Edit profile or Settings → Edit Profile.

The editor uses the existing burgundy background, typography and rounded glass cards. It includes avatar and personal banner previews, add/change/remove controls, name, unique @ID, city, bio and public interests/specialties. Creators also edit their service location. Customers see Interests; creators see Specialties. Suggested and custom tags use the existing `specialties` record field, up to 20 tags of 50 characters each.

Avatar and banner uploads use the authenticated mobile upload API. The connected profile identity selects and renders `banner_url`, provided by migration `202609290026_profile_media_age.sql`. On 8 October, migration 026 and its missing prerequisites 023–025 were applied atomically to the isolated hosted beta. Exact mobile profile reads now succeed; real image delivery and physical-device acceptance remain open. Saved photos remain part of the shared profile identity used in Messages and chat. Removes send explicit nulls; an unchanged image does not get overwritten. Image-picker/upload failures retain the current image and draft.

Save keeps the editor open with confirmation. Failures retain edits for retry. Back offers Keep editing or Discard changes when fields, images or tags have changed. The connected route also guards stack removal/back gestures; busy operations block exit. The web version registers an unload warning. An unfinished custom tag must be added or cleared before saving, preventing silent omission. A failed background profile refresh retains the cached editor and draft, with a refresh retry action. Edit drafts are not persisted across app termination; interrupted onboarding still uses its existing encrypted account-scoped draft storage, now including interests.

The backend now accepts validated `specialties` updates, trims and deduplicates labels, permits clearing the array, rejects invalid/oversized input and continues to target only the authenticated owner. Account roles and entitlement fields remain outside the update allowlist.

## Verification

- Full mobile sequence passed: type-check → lint → 55 Jest suites / 421 tests.
- Focused backend suites passed: 3 files / 26 tests covering API ownership, tag validation, image ownership/removal, age/privacy behavior and public-profile reads. The database suite applied the existing migrations to PGlite and checked service-role writes plus anonymous/owner/stranger reads; direct authenticated writes remained forbidden. This is not a hosted Supabase check.
- Changed backend files passed ESLint. Connected iOS and Android Hermes exports passed; these are bundle checks, not signed native builds or device tests.
- Local browser verified media previews and removal, the unsaved-change sheet, Keep editing, interest selection and saved confirmation at phone size. Selected tag states are exposed as checked on web and native. Screenshot: `.backups/profile-edit-media.png`.
- Regression coverage includes custom and removed tags, duplicate/maximum tags, failed-save retry, unfinished tag drafts, unsaved exit/discard, account changes, connected navigation actions, retained drafts after failed refresh and onboarding tag restoration.

Logs: `.backups/profile-edit-verify.log`, `.backups/profile-edit-backend.log`, `.backups/profile-edit-backend-lint.log` and `.backups/profile-edit-export.log`.

### Follow-up verification — 7 October 2026

Reproduced two upload defects before fixing them: switching accounts during web photo-byte preparation could submit the selected photo using the new account, and unreadable file responses were not rejected before upload. Both regression tests failed against the original implementation. Upload preparation and its returned result now remain bound to the original account; unreadable files and actual bytes exceeding 8 MB are rejected. Six upload tests cover these cases, cancellation, success and late responses.

- Final mobile sequence passed in order: type-check → lint → 58 Jest suites / 450 tests. No new dependency was added.
- Focused backend checks passed: `profile-media-api` and `profile-media-age`, 2 files / 21 tests.
- Connected iOS and Android Hermes exports passed. These are bundle checks, not installable builds or physical-device checks.
- Added refresh tests for replaced/removed avatar and banner records, plus Messages row and Chat header tests showing replacement images and initials after removal. Data tests use real client query construction with mocked HTTP responses; renderer tests use supplied records and mocked native modules. They do not prove hosted Storage delivery, cross-account propagation or device caching.
- Read-only isolated beta preflight passed backend environment/project identification and authentication for the existing synthetic customer and creator. Both profile reads then failed with `column profiles.banner_url does not exist`. No hosted profile mutation or image upload was attempted.

Evidence: `.backups/profile-upload-reproduction.log`, `.backups/profile-edit-followup-final-verify.log`, `.backups/profile-edit-followup-backend.log`, `.backups/profile-edit-followup-export.log`, `.backups/profile-avatar-render.log` and `.backups/profile-hosted-preflight.json`.

## Remaining verification

### Hosted schema recovery — 8 October 2026

The Expo Go Profile error `column profiles.banner_url does not exist` came from a schema gap: beta had migrations 001–022 and Pinterest 027–029, but not 023–026. The four missing migrations were rehearsed in that actual order, including the existing Pinterest tables, then applied in one transaction with migration registrations. No account-closure, data-erasure or cleanup function was invoked by this rollout; production was not touched.

- Focused checks passed: eight backend suites, 83 tests passed and one concurrency test skipped by the PGlite environment. A chronological Updates fixture now uses distinct server timestamps rather than relying on two fast inserts having different clock values; its previous same-timestamp tie caused intermittent test failures. The changed test passed ESLint.
- Hosted backend configuration identifies the isolated beta project. All three existing synthetic accounts authenticated and passed the exact mobile owner-profile query, including `banner_url`; creator-profile and Stories queries also passed.
- Phone/admin fields remain masked for other accounts and signed-out reads. Direct authenticated profile-table writes were denied for all three accounts. Owner-readable profile-table access was not removed.
- The dashboard confirms both saved and public banner fields exist and all four migration registrations are present. This verifies database/API reads, not a new physical-device visual check.

Evidence: `.backups/profile-schema-rehearsal.log`, `.backups/profile-schema-rollout.sql`, `.backups/profile-schema-hosted-check.json` and `.backups/profile-schema-rollout-confirmed.png`.

The missing-schema blocker is resolved. Actual Storage upload, replacement/removal, cleanup and two-account avatar propagation still need hosted acceptance. This recovery reused the already deployed matching backend and did not change mobile UI code. Calendar grants/synchronization and irreversible deletion journeys were not exercised merely by deploying their schema prerequisites.

Browser file-selection automation was previously blocked because the Chrome extension lacks access to local file URLs; no permission was changed. Physical iPhone/Android picker permissions and back gestures, keyboard/large-text behavior and VoiceOver/TalkBack remain open. Preview edits are synthetic and stay in memory. The full repository CI sequence was not rerun for this focused upload/profile follow-up. Phase 1 acceptance remains open.
