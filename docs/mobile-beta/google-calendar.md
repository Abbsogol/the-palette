# Google Calendar — 29 September 2026

## Product behavior

Both clients and nail techs see an optional Calendar connection in Profile → Settings → Google Calendar. Booking service selection, appointment details and creator working-hours setup link to the same screen. It explains that connecting helps prevent overlapping schedules, and that Google sign-in alone does not grant Calendar access. The preview simulates this flow without opening Google or changing hosted data.

- Creators: selected Google calendars' busy intervals remove conflicting slots. The backend rechecks before creating the request and again before creator confirmation. An unavailable connected creator calendar prevents approval until it can be checked, reconnected or explicitly disconnected.
- Clients: busy intervals show a “Busy for you” marker and an overlap warning. Review requires an explicit “book anyway” acknowledgement. If Calendar cannot be checked, the UI says so and requires the same explicit acknowledgement. The backend repeats the check and returns a distinct conflict code if the calendar changed after selection.
- Only confirmed bookings are copied to a separate private **LaQue appointments** calendar for each connected participant. Cancellation and deletion queue removal. Rescheduling retains the existing cancel-and-rebook behavior: remove the original copy and add the newly confirmed appointment.
- Personal event titles, descriptions, guests and attachments are never requested or returned. Busy ranges are not persisted. Only calendar IDs/names, an encrypted refresh grant, check timestamps and job status are stored.
- Users select up to ten source calendars; the app-created output calendar is excluded to avoid an appointment conflicting with its own copy. The primary calendar is initially selected. Transparent/free Google events do not make a slot busy.
- Month highlights still show working-hour availability. Selecting a date checks Google for that date; this avoids a Calendar request for every day in the grid.
- Google changes are checked on slot load, review/request and confirmation. LaQue does not edit personal calendar events, mirror them into its database or continuously watch Google for changes. Changing a Google event after confirmation does not reschedule LaQue; edits must be made in LaQue. A Calendar check and a subsequent Google edit cannot be one atomic transaction, so this reduces overlap risk rather than guaranteeing it against later external changes.

## Server/API contracts

- `GET /api/mobile/calendar?calendars=1`: authenticated connection status and selectable calendar names/IDs. Never exposes tokens or personal event data. A revoked grant reports reconnection needed; a calendar-list outage leaves disconnect/reconnect actions reachable.
- `POST /api/mobile/calendar`: authenticated `connect`, `finish`, `sources`, `sync`, `disconnect`. Account IDs in request bodies have no authority. `connect` returns Google URL and an attempt ID; `finish` requires the initiating authenticated account and a successful, unexpired grant.
- `GET /api/calendar/google/callback`: public OAuth callback authenticated by a cryptographically random one-use state. Stores the encrypted grant temporarily, then redirects only to an exact allowlisted app URL with an opaque attempt ID. It cannot bind a different LaQue account or return tokens in a URL.
- `GET /api/mobile/calendar-slots?creatorId=…&serviceId=…&date=YYYY-MM-DD`: authenticated, RLS-checked creator and existing booking-slot RPC, then busy/free filtering. Returns only `client_calendar_state` and `client_calendar_conflict` to the client.
- `POST /api/mobile/request-booking`: uses canonical database slot instants and authenticated user, not client-supplied instants/ownership. Only literal `allowCalendarConflict: true` acknowledges a client conflict; it cannot override a creator conflict. Retry of a committed request returns the original before checking an already occupied slot.
- `POST /api/mobile/booking-action`: creator-only confirmation freshly checks Google, cancellation stays available without a Calendar read. Database triggers still enforce permissions, immutable terms and booking overlap prevention.
- Worker: `lib/mobile-jobs.js` invokes the Calendar outbox worker after existing tasks. A post-response attempt also follows confirmation/cancellation/connection, and Settings offers **Sync now**. Worker claims up to five jobs concurrently; deterministic event IDs recover unknown create results without duplicate appointment events. Revision fencing preserves cancellation arriving during a confirmation write. Errors remain pending with backoff.

Migration `202609290023_google_calendar.sql` is additive. All four tables and worker/OAuth functions are inaccessible to `anon` and `authenticated`; APIs use the service role. Connected creator bookings require a fresh, exact, single-use server proof even for a direct PostgREST write. Account deletion waits for pending calendar jobs or explicit disconnect; disconnect waits for an active provider write to finish. Disconnect removes credentials and queued work, but existing Google copies remain, as disclosed in the confirmation.

## Activation requirements — not performed

The implementation defaults to disabled. This task has not changed Google Cloud, Supabase, Vercel, Expo builds or any real calendar.

1. In the intended isolated Google Cloud project, enable **Google Calendar API**. Use a dedicated OAuth **Web application** client for Calendar access so revoking this grant does not revoke the sign-in client. Use the existing LaQue branding, real privacy URL and verified domains. Review/publish the new Calendar privacy disclosure before enabling access.
2. Register exactly `https://<isolated-backend>/api/calendar/google/callback` as its Google OAuth redirect. Mobile custom schemes belong in the server's return allowlist, not Google's redirect list. Add synthetic Google test accounts while the consent app is in Testing. Testing grants with Calendar scopes can expire after seven days; public rollout needs the applicable Google consent/verification process. See [Google web-server OAuth](https://developers.google.com/identity/protocols/oauth2/web-server).
3. Request only these [Calendar scopes](https://developers.google.com/workspace/calendar/api/auth): `calendar.events.freebusy`, `calendar.calendarlist.readonly`, `calendar.app.created` (each prefixed `https://www.googleapis.com/auth/`). Refused/partial consent cannot activate the integration.
4. Store these server-only secrets in the isolated backend, never Expo public variables or source control: `GOOGLE_CALENDAR_CLIENT_ID`, `GOOGLE_CALENDAR_CLIENT_SECRET`, `GOOGLE_CALENDAR_TOKEN_KEY` (random 32 bytes, base64). Keep the encryption key stable; rotation needs decrypt/re-encrypt or reconnection. Set `GOOGLE_CALENDAR_REDIRECT_URI` and comma-separated exact `GOOGLE_CALENDAR_RETURN_URLS`, such as `laque-dev://calendar-connect,laque://calendar-connect` plus only intended HTTPS web return URLs. No wildcard, `exp://`, query or fragment returns.
5. Rehearse then apply migration 023 to isolated staging. Set both `GOOGLE_CALENDAR_ENABLED=true` and `NEXT_PUBLIC_GOOGLE_CALENDAR_ENABLED=true` and rebuild the backend/web. The public flag makes legacy web booking/confirmation use the checked APIs; the server flag enables integration. Never enable only one in a mixed web/mobile deployment. Disabling flags alone does not remove database protection from already connected creators; use the rollback procedure below when retiring the feature.
6. Verify an existing authorized scheduler calls `/api/mobile/process-jobs` with its configured job secret often enough for the beta's agreed sync delay. No new paid cron, hosting plan, quota purchase or AI service was added. A durable queue without a working scheduler is not an automatic-retry acceptance pass. Immediate attempts and manual Sync now do not replace scheduler verification. Check current [Google quotas](https://developers.google.com/workspace/calendar/api/guides/quota); do not enable paid overages or upgrades without the owner's approval.
7. Verify custom-scheme returns in signed development builds for iOS and Android. Expo Go is not accepted for this OAuth return. Existing packages suffice; no new native module was installed. Restarted/killed app recovery requires the account-owned pending attempt and its original account; expired attempts require starting again.

## Staging acceptance still required

Use separate synthetic client and creator Google accounts, not personal appointments.

1. Connect each role, deny consent, retry, switch LaQue accounts while consent is open, return after app termination, revoke Google access and reconnect. Verify no grant can attach to another LaQue account; disconnect removes server credentials.
2. Select primary + a secondary calendar; add a timed, all-day and recurring busy event in a different time zone. Creator slots must disappear, adjacent half-open intervals must remain available, and clients see only their own conflict flags. Check DST boundaries. Remove/edit an event and reload the date.
3. Make a client conflict after slot selection. Server returns `CLIENT_CALENDAR_CONFLICT`, review requires acknowledgement; a string or stale acknowledgement cannot override the creator. Create a creator conflict before approval; confirmation must fail with no status or calendar changes.
4. Confirm a booking with both accounts connected. Verify one private Google event per participant, correct UTC time/IANA zone/location and no notes or guest list. Verify outbox completion and visible Calendar status against the database.
5. Disconnect network after event creation; retry the job and verify the same event ID. Cancel during an active confirmation job; verify the later revision removes the event. Simulate Google errors/revocation and verify pending state, backoff, scheduler recovery and manual retry.
6. Cancel/rebook, decline, delete a booking, connect with future confirmed bookings, and attempt account deletion while sync is pending. Explicit disconnect must explain stale copies and stop all further writes once it completes.
7. Physical iPhone/Android OAuth, VoiceOver/TalkBack, large text, keyboard/scroll and slow/offline UI checks remain open.

## Rollback (review before execution)

Do not drop the feature while live users have undelivered calendar updates. Pause new connections, drain jobs and tell affected users that disconnecting leaves calendar copies in Google. Preserve encrypted records only under the appropriate operational retention/access controls. This task has **not** run these commands on hosted data.

After an approved disconnect/retirement plan, stop the worker and set both feature flags false. If schema rollback is needed, in one transaction:

```sql
begin;
drop trigger zz_google_calendar_booking on public.bookings;
drop trigger enqueue_google_calendar_booking on public.bookings;
drop function public.guard_google_calendar_booking();
drop function public.enqueue_google_calendar_booking();
drop function public.begin_account_deletion(uuid);
alter function public.begin_account_deletion_before_google_calendar(uuid) rename to begin_account_deletion;
grant execute on function public.begin_account_deletion(uuid) to service_role;
drop function public.google_calendar_sync_status(uuid);
drop function public.finish_google_calendar_job(uuid,uuid,uuid,bigint,text);
drop function public.claim_google_calendar_jobs(uuid,integer);
drop function public.disconnect_google_calendar(uuid);
drop function public.finish_google_calendar_connection(uuid,uuid,text,text,text,jsonb);
drop function public.claim_google_calendar_oauth(text);
drop table public.google_calendar_checks, public.google_calendar_jobs, public.google_calendar_oauth;
drop table public.google_calendar_connections;
notify pgrst,'reload schema';
commit;
```

## Verification evidence

Local Google transport tests use strict HTTP doubles; database tests use actual migrated PostgreSQL roles, triggers and concurrent connections. Passing either does not establish live Google permissions, delivery, quota behavior or native OAuth return. Detailed counts and final browser/bundle outcomes are appended below after checks finish.

### Results from this implementation

- Mobile type-check and lint passed. Full mobile suite: **350 tests in 42 suites passed**. After the final accessibility-label change, all **32 targeted Calendar/booking/controller tests passed** again.
- Repository lint passed. Unit suite: **57 passed**, including 21 Calendar transport/security/retry tests.
- Native **PostgreSQL 17.10** on this Mac: regressions **50**, security **120**, Phase 3 **59**, Phase 4 **58**, Phase 5 **143**, Phase 6 **126**, mobile backend **73** — **629 passed**, zero failed. The mobile backend includes 10 Calendar database tests and 10 authenticated route tests. The database suites exercise actual SQL/RLS with `anon`, `authenticated` and `service_role`, including concurrent workers and cancellation during an active lease.
- Reproduced and fixed stale selected-slot metadata (2 failing mobile cases before the fix), web conflict consent gating, and the enabled web path's missing reviewed location. Added regressions. The generic API authentication inventory was updated to explicitly test the public OAuth callback's one-use-state boundary; authenticated endpoints still require 401 before database operations.
- Chromium/WebKit installation, production smoke build and browser suite passed: **20 browser tests**. These existing browser tests use synthetic Supabase responses and the default-disabled Calendar feature. The enabled web Calendar branch has a separate component/transport regression. No claim of a real Google browser transaction is made.
- Connected application exports passed for **iOS, Android and web**. These are JS/Hermes bundles, not signed native releases.
- Browser preview at **393 × 852**: opened Profile Settings → Google Calendar; verified optional invitation/privacy explanation, simulated connection, Personal + Work selection, booking “Busy for you” labels, disabled review submit before acknowledgement, enabled submit after acknowledgement, and return from review to Calendar settings. No real booking or calendar event was sent. Screenshots: `.backups/calendar-connect.png`, `calendar-selected.png`, `calendar-overlap.png`.
- `git diff --check` passed.

Logs: `.backups/calendar-mobile-verify.log`, `calendar-final-mobile-focused.log`, `calendar-root-unit.log`, `calendar-native.log`, `calendar-native-*.json`, `calendar-native-phase6-final.log`, `calendar-build.log`, `calendar-browser-tests.log`, `calendar-export.log`. Before-fix evidence: `calendar-booking-regression.log` and `calendar-web-regression.log`.

The repository check sequence was run locally in CI's logical order (lint/unit; PostgreSQL regressions → security → Phase 3 → Phase 4 → Phase 5 → Phase 6 → mobile backend; browser installation → production build → browser tests), with affected checks rerun after fixes. This is **not** an executed GitHub Actions run or an identical Linux environment. Existing lockfile-installed dependencies were used; no fresh locked install was performed in this active development checkout. Hosted Supabase/Google transactions, scheduled delivery, real Google recurrence/time-zone semantics, native OAuth return, physical device accessibility, and store builds remain open acceptance gaps.
