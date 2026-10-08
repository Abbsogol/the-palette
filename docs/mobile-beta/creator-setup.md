# Creator studio setup

Implemented locally on 7 October 2026. Entry: Profile → Settings → Creator Studio. The six existing bottom tabs are unchanged.

The studio checks four saved steps:

1. Profile: completed onboarding, name, valid unique-ID format, city and explicit service location. Photos and bio are optional.
2. Services: at least one active service with valid fixed price, deposit and duration.
3. Hours: a saved valid time zone and at least one valid open interval long enough for an active service. Closed days do not count.
4. Portfolio: at least one published design with a cover image. Private drafts do not count.

Each step shows Done or To do and remains editable. Continue setup opens the first incomplete step. Four complete steps show Ready to take bookings and an appointment-requests action. This is configuration guidance; actual slots remain subject to server availability, existing bookings and calendar conflicts.

Customers explicitly activate their creator account before accessing creator-only tools. Reads use the authenticated account ID, account-scoped cache and abort signals; late responses from another account are discarded. Returning to the studio refetches profile and setup records. A loading or failed check suppresses the ready badge; failures offer Retry setup check. Existing mutation endpoints and financial rules are unchanged.

## Verification

- Mobile type-check and lint passed.
- Connected-mode iOS and Android JavaScript/Hermes exports passed. These are bundle checks, not signed native builds or device tests.
- Full Jest run passed: 53 suites, 412 tests. Added checks cover step progression, invalid/missing configuration, hidden services, private-only portfolio, forbidden-owner reads, failed reads, account changes, explicit activation, navigation and ready-state actions.
- Reproduced a preview navigation defect where a checklist profile save exited to Settings and reset studio progress; fixed it and added a regression journey through profile save, hours save and the ready state.
- Local browser preview at 393 × 852 verified 2/4 → 3/4 → 4/4 completion using synthetic data. Screenshot: `.backups/creator-setup-ready.png`.
- Logs: `.backups/creator-setup-verify.log` and `.backups/creator-setup-export.log`.

Jest database builders mock Supabase responses; the preview keeps synthetic edits in memory. Neither proves hosted RLS, actual persisted writes, creator conversion or booking availability. Real staging account verification, native-device navigation, large text, keyboard and VoiceOver/TalkBack checks remain open. This work does not close the overall Phase 1 acceptance gates.
