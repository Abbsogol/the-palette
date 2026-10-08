# Appointments — requests, upcoming and history

Updated 7 October 2026. Local implementation is ready for review; Phase 1 acceptance remains open.

Profile → Settings → Booking History and Creator Studio → Appointments open the same connected route. It uses the established Anola/body typography, dark burgundy background, translucent cards and rose selection controls. Customer accounts see their own bookings. Verified creators can switch between My bookings and Client bookings; creators can also book another artist as a customer.

| List | Meaning and order |
| --- | --- |
| Requests | Pending requests whose end has not passed; earliest first. Creator cards say Request to review; customer cards say Awaiting artist. |
| Upcoming | Confirmed visits that have not ended, including a visit in progress; earliest first. |
| Past | Confirmed visits and unconfirmed requests whose actual end has passed; latest first. Elapsed pending requests say Unconfirmed · time passed, not completed. |
| Cancelled | Cancelled and declined records, regardless of date; latest first. Refund state remains separate from the booking decision. |

Appointments without verified instants stay visible in their pending/confirmed list with a time-review warning and a View action. They are not assumed safely manageable future slots. Dates and times use the booking's recorded creator zone, even if the creator subsequently changes zone or the phone is elsewhere. Unavailable/malformed legacy dates, times and zones do not crash the list.

Each card includes participant name, searchable ID, avatar or initials fallback, service, date/time/zone, recorded location and price/deposit terms where available. Hidden services and unavailable profiles do not discard accessible bookings. Missing historical prices cannot borrow a changed service's current terms; the card requests review instead. Images use no shared persistent cache.

The list opens the existing `/booking/[id]` detail. Acceptance, decline, cancellation, payment and refund actions remain there. No financial rule was duplicated in the list. Badges use authenticated GET `/api/mobile/deposit-status`: received, full refund pending/completed, failed refund, partial refund and payment review are distinct. An old `deposit_paid` flag never substitutes for verification. Partial read failures or malformed responses produce an unavailable badge and a payment retry, while preserving other verified rows.

Reads filter the appropriate owner column under RLS, order deterministically and request one extra row to establish Load more. Only displayed bookings receive financial reads, with at most four requests in flight. Focus, foreground return, manual refresh and known appointment time boundaries refresh the list. Booking-detail invalidation includes the new list payment cache. Account changes reset role/filter/pagination and discard late identity/payment responses. Failed list reads suppress cached cards until access is rechecked.

## Verification

| Check | Result and limits |
| --- | --- |
| Mobile sequence | Type-check → lint → all **521 Jest tests / 67 suites passed**, including 36 new appointment model, adapter, route and presentation checks. SDK/native boundaries are mocked. |
| Deposit endpoint | All **3 existing API regressions passed**: creator refund visibility, stranger denial despite a faulty adapter, and partial refund precedence. Supabase SDK is mocked here. |
| Actual PostgreSQL | **19 checks passed** on PostgreSQL 17.10, macOS: six appointment-list checks plus thirteen existing booking-zone checks. Actual authenticated/anonymous/service roles and RLS cover both sides, stranger/signed-out reads, creator-as-client separation, hidden service snapshots, acceptance/cancellation movement, DST ambiguity, immutable zones and legacy safeguards. These are fixture databases, not Supabase HTTP or real payment providers. |
| Connected exports | Preview disabled; **iOS and Android Hermes exports passed**. These are bundles, not signed binaries or physical-device tests. |
| Browser preview | Both roles and all four lists inspected at 393×852 and 320×800; no horizontal document overflow. Creator request and cancelled-refund rows open their matching existing detail data. Card actions remain reachable by scrolling above the bottom navigation. Preview state is synthetic and does not contact providers. |
| Hosted reads | Isolated backend/project identity verified. Existing synthetic customer and creator authenticate; all role/filter projections succeed. Both can read the two existing cancelled bookings, participant identities and verified `refunded` deposit status. Signed-out booking reads return no rows; deposit-status returns 401. No new hosted booking or payment was created. |
| Full CI | Locked installs, the complete repository CI sequence and a new GitHub run were **not** repeated for this UI task. Dependencies and migrations were unchanged. |

Early verification failures were corrected: the image-error test needed Expo's native event shape; the database fixture initially reused a unique username; render-time clock use failed purity lint; a misplaced price-review notice failed type-checking. Final checks above have no failures or skips.

Evidence: `.backups/appointments-mobile-verify.log`, `appointments-payment-api.json`, `appointments-database.json`, `appointments-export.log`, `appointments-hosted-check.json`, `appointments-creator-requests.png`, and `appointments-320.png`.

## Remaining acceptance

Deploy the matching mobile implementation to isolated beta. Verify newly requested and confirmed appointments, elapsed and unknown-time records, pagination, concurrent decisions, live avatar changes/access revocation, unavailable status recovery and account switching through the connected app. This task's hosted data contained cancelled records only; successful empty queries do not prove those other populated journeys.

Physical iPhone/Android, VoiceOver/TalkBack, large text, interruption/background timing, real notification-driven refresh and provider refund failures remain untested here. A filter cancellation prevents further status requests and discards late results, but up to four already-running API GETs may finish; account changes also trigger the API's existing abort handling. No push, deployment, provider transaction or production change was made. Existing Phase 1 integration and device gates remain open.
