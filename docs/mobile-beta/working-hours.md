# Creator working hours and time zone

Updated locally on 7 October 2026. Entry: Creator Studio → Hours & time zone, or My services → Working hours & time zone. The connected route and synthetic preview share the same schedule editor.

## Behavior

- Weekly summary and seven day cards distinguish open and closed days. Closing a day removes its controls while remembering times if reopened. All-closed schedules explicitly warn that new requests will be unavailable.
- Tap an opening/closing control to choose hours and minutes in a mobile sheet, then confirm or cancel. Values use 24-hour, minute precision. Closing at 24:00 is supported; overnight/multiple daily periods and holiday overrides remain outside this beta.
- Search IANA time zones, including custom valid names. Invalid selections show feedback in the sheet. The service-location zone controls new appointment hours and follows daylight-saving changes; existing bookings retain their saved zone and instants.
- Closing must be later than opening on the same day. Each invalid active day shows feedback. Equal times are compared after normalizing database seconds. Closed rows with invalid remembered ranges send valid inactive placeholders because the server still validates all seven rows; the draft keeps remembered controls.
- Saving shows confirmation, clears the dirty baseline and refreshes dependent booking/setup queries. Failure retains edits for retry. Pending writes disable editing and prevent duplicate submissions. Conflict responses, if returned, explain review/retry rather than claiming success.
- Back, native stack removal and Calendar navigation protect unsaved changes. Account/epoch changes remount the draft; old responses cannot show another account’s success. Failed background profile/schedule reads retain the editor with retry actions. Drafts are not persisted across app termination.
- Closing days or shortening hours does not cancel existing bookings. Existing server transaction, booking snapshots, slot-conflict rules and Calendar integration are preserved. No new dependency, backend route or migration was added.

## Verification

Two regression tests failed against the prior implementation: equal `09:00` / `09:00:00` values reached the save callback, and inverted times on a closed day were submitted unchanged. Both now pass.

- Mobile verification passed in order: TypeScript → Expo lint → 60 Jest suites / 468 tests. New component and connected-route coverage includes time-sheet cancel/confirm, midnight closing, close/reopen, zone search/invalid input, all closed, failed saves, retained drafts on refetch, pending double taps, account changes, conflict feedback, creator permissions and navigation guards.
- Focused backend verification passed: availability API and booking-zone SQL suites, 2 files / 16 tests. These check authenticated owner binding, denied customer writes, invalid/error handling, atomic rollback, existing booking instants, absolute-time overlaps, DST ambiguity and midnight slots. The SQL fixture uses PGlite with actual role policies and simulated auth claims; it is not a concurrent hosted PostgreSQL session test.
- Connected iOS/Android Hermes exports passed. They check bundles, not installed native binaries.
- Browser preview verified selected times, save confirmation, invalid-zone feedback and unsaved-change confirmation. Width checks at 393 × 852 and 320 × 800 found no horizontal page overflow; time-sheet actions remained within the phone width. Screenshot capture initially timed out in the background; bringing the preview to the foreground resolved it. Screenshot: `.backups/working-hours-picker.png`.

Logs: `.backups/working-hours-reproduction.log`, `.backups/working-hours-verify.log`, `.backups/working-hours-backend.log` and `.backups/working-hours-export.log`.

## Hosted beta evidence

Using existing synthetic creator/customer accounts against isolated Supabase project `atjwbdrvgljddedtwoqo` and `https://laque-beta.vercel.app`, verified actual authenticated API/PostgREST reads and writes:

- Creator schedule and zone reads succeed. Signed-out writes return 401; customer writes with forged creator fields return 403.
- An invalid zone returns 400 and leaves stored hours/zone unchanged.
- Creator save stores all seven rows, the selected zone and matching edited opening/closing times. Repeating it leaves identical records.
- Original synthetic creator hours/zone were restored afterward and reread to verify exact restoration. No appointment or payment was changed.

Evidence: `.backups/working-hours-hosted-evidence.json`; reproducible helper: `.backups/working-hours-hosted-check.mjs`, which reads ignored credentials without printing them.

## Still open

Physical iPhone/Android sheet interaction, keyboard, hardware back/gestures, large text and VoiceOver/TalkBack remain unverified. Real Google Calendar busy-event synchronization and concurrent hosted schedule-versus-booking races remain open. Component tests mock native modules/navigation; browser preview writes remain synthetic. Hosted API checks do not prove the entire installed-mobile journey. Full repository CI was not rerun for this focused change. No deployment or push was performed; Phase 1 remains open.
