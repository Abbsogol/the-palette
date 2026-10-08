# Account and business secondary screens — 29 September 2026

Implemented locally using the existing Anola headings, shared body typography, dark burgundy background, translucent cards and gradient actions. No new bottom tab or duplicate LaQue header.

| Entry | Screen and behavior |
|---|---|
| Settings → Edit Profile | Add/change/remove photo and banner with a draft preview; identity, public interests/specialties and creator service location. Save confirmation, retry with retained edits, unsaved-change sheet and connected navigation guard. Storage ownership/cleanup is implemented locally; hosted and device proof remains MB-009. See `profile-edit.md`. |
| First authenticated onboarding | Customer/creator choice, then profile details and explicit 18+ / Privacy Policy confirmations; role-appropriate fields. Completion waits for successful server writes. Interrupted setup can retry. |
| Settings → Creator Studio | Explicit creator activation; saved-state profile/location, services, hours/time zone and published portfolio checklist with progress, Continue setup and ready state. Refreshes after tool edits; failed checks suppress readiness. Appointment and optional Calendar links stay here. Customer accounts cannot accidentally activate business tools by tapping a checklist row. See `creator-setup.md`. |
| Creator Studio → Services | Finished fixed-price AED cards/editor with live total/deposit/balance, duration presets, filters/counts, save/retry states, unsaved draft guards and hide/show confirmations. Owner-scoped writes and stable create IDs preserve retries; existing appointments retain their snapshots. See `services-management.md` for remaining hosted/device checks. |
| Creator Studio → Working Hours | Mobile hour/minute selection sheets, remembered closed-day times, searchable IANA zones and explanation, per-day validation, save/retry and unsaved-change guards. Existing appointments stay unchanged. Real beta seven-day saves and denied customer writes verified; physical-device/Calendar/concurrency checks remain open. See `working-hours.md`. |
| Profile → My Designs / Creator Studio → Portfolio | Customer/creator upload entry, filtered manager, weekly allowance, cover/close-ups and D36 editor, actual upload stages/retry, draft/public save feedback, unsaved guards and confirmed delete. Local checks pass; hosted beta has the older creator-only upload/save API. See `my-designs.md`. |
| Settings → Booking History | Requests / Upcoming / Past / Cancelled; My bookings versus Client bookings, participant names/avatars, recorded creator-zone dates, verified payment/refund badges, owner-scoped pagination, loading/error/retry and existing detail links. See `appointments-list.md` for 7 October verification and remaining hosted/device gates. |
| Lab credit badge / Settings → Lab Credits | One-time 5/15/40-credit packs, localized store prices, account balance, pending approval/verification, cancellation/retry, explicit restore results, owner-only recent receipts and refund/revocation status. Appointment deposits are explained separately; subscriptions remain removed. See `credits-ui.md` for hosted/store/device gates. |
| Email / provider return → Account link | Branded checking, verified, password recovery/completion, expired, invalid, retry and account-change states; correct fresh-link email forms, password draft clearing and guarded return. See `auth-recovery-ui.md` for remaining email/device acceptance. |
| Settings → Privacy & Safety | Confirmed privacy controls; names/photos/searchable @IDs, unavailable-account fallback and owner-only unblock with an in-sheet error. Branded reporting reasons/confirmation and policy/deletion links. See `safety-stories-ui.md` for 7 October verification and rollout gaps. |
| Home bell / Settings → Notifications | Activity / Preferences linked screen with confirmed read/unread actions, typed rows and distinct device permission/registration states. Deployment and physical-device acceptance remain open. See `notifications-ui.md`. |
| Settings / Privacy → Delete Account | Review, exact `DELETE` entry/acknowledgement, submitting/retry and irreversible closure. Appointment/refund, credit-purchase and support actions; restricted retention and historical provider billing disclosed. Existing atomic cancellation/refund safeguards retained. See `safety-stories-ui.md`. |

Preview: localhost:8084 → Profile → Explore demo account → Profile → Settings. The same presentation components are shared by preview and connected routes. Demo state changes stay in memory; demo deletion does not contact Auth or delete an account. Preview components do not import the connected route tree or live authentication.

Connected forms use the existing authenticated APIs and RLS; account tickets discard responses after an account change. Successful account closure suppresses the old UUID immediately, clears account-scoped caches, persists a device tombstone, and refreshes the latest Supabase session without globally signing out a different account. A provider or local cleanup error cannot turn committed closure into “deletion failed.”

## Verification

Locked root and mobile installs completed with Node 24.20.0. Root lint and mobile type-check/lint passed. Unit: 62 passed; mobile: 361 passed. PostgreSQL 17.10 was run in the CI order: regressions 50, security 120, Phase 3 59, Phase 4 58, Phase 5 143, Phase 6 126, mobile backend 89 (645 total, no failures or skips). Host was macOS, not CI's Ubuntu container; this is local evidence, not a new GitHub run.

Deletion coverage includes owner authentication, failed commit, Auth outage after commit, late deposits, full refund obligations, stale JWTs, concurrent booking/closure, duplicate cleanup claims, Storage failure, replay after Auth erasure, restricted evidence access, retention expiry and financial records for both appointment participants. Component coverage includes destructive confirmation, rapid double taps, failed deletion retry, form validation and failed unblock.

Production smoke build passed; all 20 Chromium/WebKit browser tests passed after browser installation. Connected iOS, Android and web bundle exports passed with design-preview mode disabled. These are JavaScript/Hermes bundles, not signed native binaries. Browser preview checks are synthetic and do not establish native or hosted integration acceptance.

## Remaining acceptance

Apply migration 024 after 023 only on the isolated staging project, deploy the worker/API and verify the retention policy there. Run synthetic account closure with actual Supabase Auth and Storage, Stripe sandbox refunds and delayed settlement, including worker interruption. Check existing account switching on physical iPhone/Android, VoiceOver/TalkBack, large text and native keyboard layouts. Avatar replacement/upload remains open. No live accounts were deleted; no changes from this task have been deployed or pushed.

## Profile media and eligibility follow-up — 30 September 2026

See [profile-media-age-review.md](profile-media-age-review.md) for the latest implementation, test results and rollout gates. This follow-up supersedes the older avatar implementation gap above; hosted/device verification is still open.
