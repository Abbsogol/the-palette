# Profile design inspection — 29 September 2026

Update: the user subsequently selected **Artist Profile 1 — Public** (`415:2087`) and **Profile 2 — Redesigned** (`419:3185`). Implementation and current verification are recorded in [profile-ui.md](profile-ui.md). The following is the earlier inspection record.

Scope: inspect the named Figma screens and compare them with the mobile implementation. No application, database, or Figma changes were made during this inspection.

## Source frames and duplicate names

File: `VEodtjFruvXPaIwWW2BjMC`, page `345:2` (app). Both requested names occur more than once. Node IDs distinguish them; node numbering is not evidence of revision order.

| Purpose | Cover-photo version | Gradient-only version |
| --- | --- | --- |
| Public artist profile | [Artist Profile — Public, 415:2087](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=415-2087), 393 × 1506 | [Artist Profile — Public, 345:5642](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-5642), 393 × 1372 |
| Account owner | [Profile — Redesigned, 419:3185](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=419-3185), 393 × 1779 | [Profile — Redesigned, 345:5779](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-5779), 393 × 1909 |

A third frame named [Profile — Redesigned, 421:3669](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=421-3669), 393 × 668, is a separate **Settings** screen.

The cover-photo pair is the proposed reference. Selection was asked through an asynchronous question and was still pending when this report was written. Do not combine the variants silently.

## Cover-photo public profile

Top to bottom:

- Full-width nail photograph, centered LaQue wordmark, back/share/more controls.
- Circular portrait overlapping the cover, NAIL ARTIST badge, and a heart action.
- Centered name, location, biography and specialty chips.
- Full-width gradient Book Appointment button, outlined Message button, response-time caption.
- Three statistics: Followers, Designs, Rating.
- Designs / Services / Reviews / About tabs; Designs is the rendered state.
- Two-column portfolio, image save hearts, design title and category.
- Floating six-tab navigation.

Measured at the 393-point reference width: cover 393 × 266; avatar container 124 × 124 at y=200; content side inset 24; name 32; wordmark 24; biography 14; specialties 12; booking button 345 × 47; message button 345 × 44; statistics height 52; tab labels 16. Portfolio images are 169 × 222 with 24-point corners, 8-point column gap and 16-point row gap. Body fill is #3C000E. The main controls use burgundy-to-pink gradients and translucent glass edges.

The name and body use Sofia Pro in several weights. The wordmark and main action labels use Anola. Sofia Pro is still not supplied in the app's licensed font assets; the earlier uploaded Sofia font is a different family.

## Cover-photo owner profile

Shares the cover, portrait overlap, centered identity, biography and chips. Owner differences:

- Edit icon beside the portrait; header settings/account and more controls.
- Public Profile button opens the visitor presentation of the same account.
- My Account section with Followers / Designs / Following statistics.
- Private shortcuts for Upcoming, Saved, Favorites, Collections and Credits.
- Upcoming Appointment card: status, artist, service, date/time and View Appointment.
- My Designs / Saved / Collections tabs.
- Own design grid with Public or Private badges; private items have a lock symbol.

The separate Settings frame contains Booking History, Nail Lab History, Notifications, Privacy & Safety, Payment Methods, and Help & Support. Rows have 16-point corners, 10-point gaps, 16-point horizontal padding, 15-point labels and pink line icons.

The gradient owner version instead has inline Edit Profile and Public Profile buttons, an Add Design control, and the settings links at the bottom of the same page. The gradient public version has an @username, a compact rating/reply-time strip, side-by-side action buttons and a starting-price booking bar. These are meaningful differences between the variants.

## Application mapping and gaps

| Design element | Existing mobile behavior / implementation work |
| --- | --- |
| Public view | `mobile/src/app/creator/[id].tsx` has basic identity and published-design reads, booking, messaging, follow, report and block actions. It does not match either reference layout. |
| Owner view | `mobile/src/app/(tabs)/profile.tsx` has basic identity/credits and links to profile, saves, collections, appointments, billing, notifications, privacy and creator tools. It lacks the designed dashboard and tabbed grids. |
| Preview | `mobile/src/preview/home-main.tsx` has a basic LaQue Demo profile. Tapping a preview search artist currently opens an explanatory alert, not a profile. |
| Account data | Existing schema has specialties, follows, favourite_creators, reviews, saved designs, collections, bookings and owner credit balance. Each section needs its own correctly scoped read and loading/error/empty state. |
| Cover photo | No profile cover field was found in the checked profile schema, mobile type or profile-edit form. The existing cover_image_url field belongs to moodboards. A real editable profile cover needs a storage/data contract; Figma images must stay fixtures. |
| Reply time | No response-time field/calculation was found. The Figma “Usually replies in 1hr” text must not be displayed as a real claim without evidence. |
| Edit profile | Current mobile form edits display name, username, location and bio. Avatar/cover/specialty editing is not provided there. |
| Reviews and services | Database records exist, but the current mobile public profile does not render these tabs. No separate Services/Reviews/About profile state frames were found among the app page's top-level frames. |
| Safety | Existing report/block, account deletion, sign out, and creator service/availability management must remain reachable in the redesigned menus, even though the supplied frames do not show all of them. |

## Visibility and behavior requirements

- Public means visitor-facing data only. The account dashboard, credit balance, appointment details, private designs and private collections belong exclusively to the owner.
- “Public Profile” must render the visitor projection even when the signed-in viewer owns the account; an owner-authorized query can otherwise include extra data.
- The current `RouteAccess` guard allows guests only Home and authentication routes. Therefore a signed-out user currently cannot open `/creator/[id]`. If “everyone” includes signed-out visitors, this is a required change to the earlier Home-only guest rule; booking/message/favorite/follow actions must still require authentication.
- Respect profile/content privacy and server permissions. A public screen is not permission to expose private records.
- Ratings and counts must come from permitted live records, with unknown states distinct from zero. Do not ship the sample 4.9, 847, 48 or appointment values as real data.
- Heart favorites and follows are distinct existing relationships; do not conflate them. The public heart should align with Search's favorite-creator behavior.
- Customer profiles should not advertise bookable services merely because the reference is an artist profile. Creator/salon actions depend on the actual account role.
- Appointment times must retain each creator's configured time zone.

## Design corrections and verification still required

- The cover-photo owner and Settings frames highlight Home in the bottom navigation. The owner view should select Profile; a public profile should retain its entry context.
- The public cover-photo frame clips its final portfolio captions below its 1506-point boundary; its content extends to roughly y=1653. Use real scrolling and adequate bottom inset so navigation never hides the last card.
- All three cover/settings frames have overflow NONE and no prototype reactions in the inspected frame/text descendants. They specify appearance, not verified scrolling or tap behavior.
- Preserve visible icon dimensions, but provide adequate touch areas for 28–34-point controls and 25-point chips.
- Native status-bar content must come from the operating system, not copied 9:41/battery mockup layers.
- Figma glass effects need platform-appropriate rendering and visual comparison; exact equivalence has not been established.
- Loading, empty, failed/retry, private/unavailable, long-name, large-text, account-switch and permission states are not represented by these static examples.

Evidence: all five profile/settings design contexts and screenshots were inspected, cover-photo dimensions/type styles were read directly through the Figma API, and current mobile routes, preview actions and repository schema were compared. This was a design/code inspection, not a runtime test or hosted database verification. No implementation or pixel-perfect acceptance is claimed.
