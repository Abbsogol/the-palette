# Chat UI — 29 September 2026

## Design references

Figma file `VEodtjFruvXPaIwWW2BjMC`:

- `345:4846`: **Chat 1— Redesigned**, 393 × 1570.
- `345:4923`: **Chat  1 — More Options**, 393 × 852.
- `345:5033`: **Chat — Upcoming Appointment**, 393 × 874.

Implementation: `mobile/src/features/chat/`. The connected route is `/conversation/[id]`; the local visual preview opens the same view from Messages. Creator/salon demo contacts show the appointment pin; keyvan demonstrates a conversation without a pin.

The header, appointment pin and composer stay outside the message scroll view. Incoming bubbles use 16px corners with a 4px lower-left corner; outgoing bubbles use the burgundy-to-rose gradient and a 4px lower-right corner. Design cards are 240px wide, with 180px image slots. Photos are 200 × 150; the sample location map is 240 × 100. All shrink within a narrow viewport. The options sheet is 638px tall at the reference viewport and scrolls to expose all safety actions.

The 16 exported Figma assets are checked into `mobile/assets/figma/chat/`, with byte sizes and SHA-256 hashes in `manifest.json`. All were verified nonempty. Raster source dimensions: design and studio photo 1184 × 864; map 1536 × 672. Card crops use `cover`, matching the reference slots. No full-frame screenshot is used as UI.

Intentional adaptations: reuse the requested generated 4K background and shared app font mapping (Sofia Pro remains unavailable); native safe areas replace Figma's painted status bar and home indicator; larger touch areas, accessible report actions and brighter safety labels improve usability. The header shows connection status rather than invented live user presence. Booking status and the creator's IANA time zone are explicit.

## Connected behavior

- RLS-protected conversation, public contact fields and messages; explicit participant validation before loading the thread. Private images use short-lived signed URLs with disk caching disabled. Missing/private designs and failed images show an unavailable state.
- Real-time message and booking updates, pull/manual refresh, older-message pagination, local search across the loaded page set, and shared-media filtering. Search tells the user when older messages still need loading.
- Text/photo sending retains a durable idempotency ID through failed responses and retries. Recovery must finish before sending. Rapid taps are latched. Account changes and unmounts discard late UI completions; the route remounts on account epoch changes.
- Menu routes to the contact profile, Services tab, booking request, report form and current booking details. Sharing a design uses Saved → design detail → existing Share to chat flow. The preview's sample map is illustrative; connected users can paste an address/link. No live map provider or structured location-sharing backend was introduced.
- Favorites use the existing account-owned table. Muting uses compare-and-swap on `conversations.muted_by`, preserving the other participant's preference. The notification worker now rechecks mute, participant membership and blocks before sending a queued message push. Already-submitted receipts still get reconciled; appointment notifications remain independent of chat mute.
- Blocking and deleting require explicit in-app confirmation. Deleting hides the conversation only from the current user's inbox; new incoming messages may restore it. Blocking does not cancel an existing appointment.
- The pin selects the nearest future pending/confirmed booking between these two participants. Cancelled/declined, past, invalid timestamps, and other participants' bookings are excluded. Opening it uses the existing access-checked booking route.

## Verification

- Full mobile verification: TypeScript, lint, **253 tests / 30 suites** passed. Focused chat tests were rerun after final UI adjustments.
- Root unit tests: **36 tests / 5 suites** passed, including 7 notification-worker tests for muted, blocked, missing/non-participant recipients, lookup failures, delivery and receipt reconciliation.
- Focused database safety + notification tests: **15 tests / 2 suites** passed. The database suite uses local PGlite with `authenticated`/`service_role` role switches, including a new mute-ownership and stale compare-and-swap regression. This is not hosted Supabase evidence.
- iOS, Android and web production JavaScript bundle exports succeeded in `.backups/chat-export` (not signed store builds).
- Browser preview checked at 393 × 852 and 320 × 740: chat navigation, fixed header/pin/composer, scrollable safety options, mute state, conversation search, sample send and composer reset. At 320px, measured header, appointment action and composer Y positions remain unchanged while messages scroll.
- Evidence: `.backups/chat-appointment.jpg`, `.backups/chat-options.jpg`, `.backups/chat-compact.jpg`.

## Remaining integration checks

No real message, booking, report, block, push notification or database mutation was sent to hosted services during the visual review. Physical iOS/Android keyboard, VoiceOver/TalkBack, large-text behavior, two-account real-time delivery and actual push receipt checks remain unverified. The notification-worker change requires backend deployment before hosted mute delivery behavior changes. No push or deployment was performed in this task.

## Public profiles from chat — follow-up

Chat header, options-sheet identity (name/avatar), and View profile now open the selected person's public profile in the visual preview as well as the connected route. Returning preserves the in-progress chat draft. View services & portfolio opens the Services tab for professionals.

Regular users share the existing profile layout: public designs (including published Lab creations), bio/interests, followers, following, Follow, share and safety controls. They do not show Message, Book Appointment, Services, Reviews, artist favorites or response-time claims. Private generation history, saved designs and account data are not exposed. The public user's design queries keep `created_by` and `is_published=true` filters; private profiles still hide their portfolio. Following counts are loaded without querying professional ratings.

Validation: TypeScript, lint and all **256 mobile tests / 30 suites** passed. New coverage checks both chat profile entry points, draft preservation, user/professional actions, follower state, selected Services tab and published-only data queries. Browser checked the name/avatar entry, client profile layout and local Follow count. Evidence: `.backups/chat-user-public-profile.jpg`. No hosted account mutation was performed.
