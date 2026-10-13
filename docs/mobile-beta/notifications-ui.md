# Notifications — Activity & Preferences

Implemented locally on 7 October 2026. Notifications stays a linked screen from Home and Profile settings, with Activity / Preferences sections inside the screen. It does not add a bottom tab.

## Delivered

- Shared Anola heading/body typography, dark burgundy background, fixed header, translucent cards and rose actions. Activity groups by Today / Yesterday / Earlier with type badges, current permitted actor names/photos, explicit read labels and unread dots.
- Message, booking request/confirmation/decline/reminder, design likes/comments and follower rows have accurate descriptions. Message/booking rows open the existing inbox/appointment lists because the current notification schema has no conversation/booking ID. Design/profile links recheck access before opening; missing targets retain the activity with an actionable error. Collection invitations remain readable but unlinked: Saved folders are not collaborative moodboards.
- All / Unread filters, individual read/unread actions, “Mark shown as read”, refresh and older-page loading. The count covers loaded recent activity; the screen does not claim the entire history is read. Loading, empty, offline/retry and stale-data states are explicit.
- Read updates wait for confirmed owner-scoped rows. A failed or zero-row update never becomes success and never opens the destination. Duplicate action taps submit once; late account responses cannot update the new account or navigate it.
- Preferences distinguishes checking, on, quietly authorized iOS, off, denied by the device, unavailable builds and unconfirmed server status. Enable, disable, device settings and status refresh are separate actions. Returning to the foreground refreshes activity and permissions. Known denied device permission remains visible during a failed server check.
- Device settings affect this account on this installation. They do not erase in-app activity. No category toggles were added because the current backend implements a device-level registration only.
- Failed server disable retains the local enabled preference for retry. Push action partial failures refresh the actual device/server state instead of displaying assumed success.
- `GET /api/mobile/push?installationId=<UUID>` returns only an authenticated owner-scoped, non-cacheable `enabled` boolean. Expired/missing/invalidated registrations are off. The service-only registration table and push tokens are not exposed directly to mobile. Existing registration/deletion/outbox rules remain in use; no migration is required.

## Verification

Passed locally:

- Mobile verification in project order: TypeScript → Expo lint → Jest. **75 suites / 621 tests** passed. The four new notification suites contribute **39 tests**, including UI states, safe navigation, duplicate/failed writes, account changes, current profile projection, permission states and failed-disable retry.
- Reproduced the original disable ordering with its regression test: clearing the local preference before a rejected DELETE fails the test. Restored the corrected implementation; the regression passes in the complete suite.
- **14 backend API/worker tests** passed, including authentication, installation validation, exact owner filtering, expiry/missing state, safe service failure and existing lock-screen payload/worker behavior.
- **15 actual PostgreSQL 17.10 tests** passed across notification preferences, existing mobile safety and table privileges. A real message creates recipient activity; recipient read/unread writes persist. Another signed-in user sees no rows and updates none; anonymous writes and client notification inserts are denied. Push registrations are service-only, transfer ownership correctly and cannot be disabled through another owner’s filter. Existing outbox claim/transfer checks passed.
- Root ESLint and Next production smoke build passed. Connected-mode iOS and Android Hermes exports passed. Exports are not signed native builds.
- Browser preview checked at 393×852 and 320×800: activity, preferences, enable/off/denied controls and narrow text wrapping. Read/unread changes are synthetic in preview; device controls simulate states without sending pushes or opening real permission prompts.

Isolated hosted beta (`atjwbdrvgljddedtwoqo`) read-only verification succeeded for synthetic customer/creator accounts: owned notification queries returned two/four rows respectively; permitted actor/profile-photo projections succeeded, and signed-out activity leaked no rows. No credentials or notification contents are recorded in the evidence report.

## Remaining acceptance gates

The matching device-status GET is not deployed on `laque-beta.vercel.app` (both authenticated checks returned HTTP 405). Until deployment, connected Preferences with an existing installation reports unconfirmed status instead of falsely showing enabled. This task did not deploy or change hosted registrations.

Still unverified: physical iPhone/Android permission prompts and quiet authorization, actual Expo token registration/delivery, revoked permission and invalid/expired token recovery, foreground/background and notification-tap journeys, account changes during OS/token/storage operations, hosted read/unread writes, two-account delivery, VoiceOver/TalkBack and large-text testing. Existing worker mocks and browser simulation cannot close these gates. No complete release CI run, signed build or store submission was performed. Phase 1 remains open.

Local evidence: `.backups/notifications-mobile-verify.log`, `notifications-disable-reproduction.log`, `notifications-backend-api.log`, `notifications-database.json`, `notifications-hosted-check.json`, `notifications-root-lint.log`, `notifications-smoke-build.log`, `notifications-export.log`, and activity/preferences/denied screenshots.
