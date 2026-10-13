# Booking UI — 29 September 2026

## Design sources

Inspected design context and screenshots from `VEodtjFruvXPaIwWW2BjMC`, app page `345:2`:

| Frame | Node |
| --- | --- |
| Booking — Select Service | 345:5236 |
| Booking — Select Date | 345:5285 |
| Booking — Select Time | 345:5417 |
| Booking — Review | 345:5478 |
| Booking — Request Sent | 345:5539 |
| Booking — Confirmed | 345:5568 |
| Chat — Manage Appointment | 345:5126 |

Booking uses the exported background, exact divider, attachment, request sparkle, confirmation check and calendar SVG assets. Asset sizes/hashes are recorded in `mobile/assets/figma/booking/manifest.json`. Native status bars and safe areas replace the Figma status-bar mockup. Anola is bundled; body text uses the existing shared platform font fallback because licensed Sofia Pro app-use files remain unavailable. This is not a claim of identical font rendering on physical devices.

The new payment screen follows the same background, translucent cards, typography and rose gradient buttons. Additional real-world details include creator time zone, service location, price/deposit/balance breakdown, payment status and refund disclosures. Dates are a real availability calendar rather than fixed Figma dates. Supported services remain fixed-price; per-nail quantity pricing is deferred under the agreed beta scope.

## Implemented flows

- Public artist profile or chat → service → available date → available time → review, optional note/reference → pending request.
- Creator approves/declines. Client cannot approve their own request. Confirmation and deposit payment are distinct states.
- Client pays a confirmed future appointment's deposit using the existing Stripe endpoint. Booking and payment status are re-fetched before checkout and when the app resumes/checkout closes. A browser return does not mark payment successful.
- Payment page shows paid, pending, refund pending/completed/failed and review states; unverified or refunded payments cannot start another checkout.
- Both participants can manage future appointments. Cancellation uses the existing atomic cancellation/refund RPC through the mobile API.
- Client date/time change confirms cancellation, discloses the refund and separate new deposit, then starts a new booking request.
- Creator date/time change selects a proposed date/time and opens a chat draft for review and sending. The original appointment stays unchanged until the client agrees and cancels/rebooks. This is an explicit chat proposal, not a separate structured rescheduling approval object.
- Confirmed appointments export an ICS calendar file using absolute timestamps. Calendar import requires the user's calendar/share action; private notes are excluded.
- Request IDs persist in account-owned storage before submission. Lost responses replay the same ID; storage failure blocks fresh submission until recovery. Account changes discard late completions.
- Chat's appointment option appears for both client and creator when an appointment exists. Regular client public profiles still have no booking CTA.

Existing Supabase/API authorization, slot locking, reviewed-price validation, cancellation/refund obligations and Stripe rules are reused. No backend route or database migration was changed for this UI task.

## Preview

In the running design preview, choose **Explore demo account** → Messages → Kim → tap Kim's identity → **Book Appointment**. The same flow can be reached from an artist's search profile. After sending a sample request, **Preview as nail tech** exposes approval; accepting returns to the client view. The payment page explicitly offers a simulated deposit, with no card details or money movement. Appointment status and proposed drafts are passed back to the sample chat. Preview records are temporary and do not write to hosted services.

Browser screenshots were captured at 393 × 852 in `.backups/booking-service.png`, `booking-date.png`, `booking-time.png`, `booking-review.png`, `booking-sent.png`, `booking-confirmed.png`, `booking-payment.png`, `booking-paid.png` and `booking-manage.png`.

## Verification

- `npm run verify` in mobile: TypeScript and lint passed; **275 tests in 32 suites passed**.
- Added coverage for the selection/review sequence, failed availability/retry, stale slots, client/creator actions, cancellation confirmation, payment/refund gating, paid-state copy, calendar escaping/time zones, duplicate taps, durable recovery, persistence failure, and account changes. Also verified creator proposals preserve the existing appointment and prefilling chat does not overwrite durable unsent recovery.
- Targeted existing backend suites: availability, creator time zones, mobile safety and deposit status — **27 passed**. These use local PGlite with database roles/RLS; they do not verify hosted services or independent PostgreSQL connections.
- Mobile transaction suite: **11 passed**, additionally exercising reviewed snapshots, stale terms, durable cancellation/refund obligations and deletion safeguards. Combined targeted backend result: **38 passed across five suites**.
- Connected entry exported successfully for iOS, Android and web. These are JavaScript/Hermes bundles, not freshly signed native binaries.
- Browser preview: traversed the full booking/approval/payment simulation; checked cancellation changes to refund pending; verified artist proposal opens in chat and preserves the original date/time.
- `git diff --check` passed.

Local logs: `.backups/booking-mobile-verification.log`, `.backups/booking-transactions-verification.log`, `.backups/booking-export.log`.

## Not verified in this pass

No real booking, charge, refund, push notification or hosted mutation was made. Two-account staging journeys, actual Stripe sandbox checkout/return, refund-provider failures, independent PostgreSQL concurrency, physical iOS/Android interaction, native calendar import, VoiceOver/TalkBack, dynamic type and keyboard checks remain integration gates. Existing shipping builds have not been updated or submitted by this task. The full repository CI sequence was not rerun for this mobile UI change; checks above describe the work actually run.

## Calendar follow-up — 29 September 2026

Optional Google Calendar connection, creator busy-slot checks, client overlap warnings and server-verified confirmation/cancellation sync are implemented in a later change. That change **does** add backend routes and migration 023; the earlier UI-only scope statement above describes the original booking-design task. See `google-calendar.md` for current behavior, tests and hosted activation gates. The one-off ICS export remains available separately from Google synchronization.
