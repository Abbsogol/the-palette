# Public and owner profile UI — 29 September 2026

Implemented the user-selected cover-photo frames in the shared native/mobile UI:

- [Artist Profile 1 — Public, 415:2087](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=415-2087)
- [Profile 2 — Redesigned, 419:3185](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=419-3185)
- [Profile — Setting 1, 421:3669](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=421-3669)

## Implemented

`mobile/src/features/profiles` contains the typed data adapters, reusable native layouts and connected screen. Public identity, owner dashboard and content queries have separate account-scoped keys. Content is paginated in 24-record pages. Public portfolios explicitly require published designs, including when an owner opens their public presentation. Public customer views omit location, booking, artist favorites and ratings. Private public profiles do not request portfolio records.

The UI includes the cover and overlapping avatar, role badge, bio/specialties, booking/message actions, favorite/follow/report/block menu, statistics, portfolio, services, reviews and About. Owner views add edit/settings, Public Profile, account shortcuts, next appointment, My Designs/Saved/Collections, and publication badges. Appointment labels retain the creator's time zone. Unknown counts and failed reads are not represented as zero.

Existing booking, conversation, report, collection, editing, billing and creator-management routes remain connected. Service booking opens the existing service/date/time/review flow. Settings retains sign-out and deletion. The new Favorites route lists the account's favorite artists. Signed-out visitors can open a valid public profile link; protected actions still require authentication. Search, Lab and other protected routes remain gated.

Shared controls have 44-point touch targets, accessibility labels, safe-area padding, loading/error/empty states and retry actions. Portfolio grids reduce to one column on narrow screens or at large text sizes. Bottom padding keeps the last portfolio captions above navigation. Profile is selected on the owner screen, correcting Figma's Home-selected placeholder.

## Visual implementation

Assets were downloaded from the exact selected frames and verified against `mobile/assets/figma/profiles/manifest.json`. Native components render the interface; no full-screen Figma screenshot is used as UI. At the 393-point reference width the cover is 266 points, portrait is 120 points inside its 124-point frame, centered 12-point stroke is rendered separately, side inset is 24, and portfolio images are 169 × 222 with 24-point corners. The owner cover crop uses the Figma image transform. The button's visible gradient begins at #981A2E, the sampled left edge of Figma's off-frame gradient.

The original inspection's 96-point avatar estimate was corrected after reading the Figma node bounds: its centered stroke does not reduce the child image bounds. Native glass uses a restrained translucent edge approximation; Figma's GLASS renderer is not available in React Native.

Anola is bundled. Sofia Pro is still missing; existing platform body-font fallbacks remain. Exact typography/pixel-perfect acceptance is therefore open. No artificial status-bar time or battery layers were copied.

## Preview

The 29 September header follow-up removes the LaQue wordmark overlay from both public and owner cover photos. Cover geometry, safe areas and navigation controls are retained.

Reload the running preview at http://localhost:8084 or the existing Expo Go preview. Select **Explore demo account** when signed out.

- **Profile** opens Sarah's owner fixture; Public Profile, Back, Settings, edit, Saved and Collections are interactive.
- **Search → Artists & Salons → an artist/salon** opens its public fixture with the same name, portrait, location and role as its search card.
- Sample saves/favorites/follows are temporary. Billing, bookings, messages and account changes explain that they require the connected app. Fixtures never write to Supabase.

Connected routes do not import the demo profiles. Real names, avatars, records, counts, reviews, services and appointment/credit values come from the existing backend. Figma cover images are decorative defaults because profiles have no cover-upload contract yet; the same default follows the account role in both presentations. Editing cover/avatar/specialties is not added by this task. Unverified response-time claims are omitted from real profiles.

## Verification

- Mobile TypeScript and lint: passed.
- Full mobile suite: **233 tests passed in 25 suites**. Includes public/owner separation, public published-only queries, private profile denial, customer privacy, rating pagination, creator time zones, failed relationship reads, duplicate saves, account changes during requests, new UI navigation, and demo exit/data clearing.
- Expo production bundle exports: **iOS, Android and web passed**, with the design-preview flag off. These are compilation checks, not signed device builds.
- Browser at 393 × 852: owner and artist entry, Public Profile/Back, Settings, Collections, identity consistency and bottom-of-portfolio scrolling inspected. Saved screenshots: `.backups/profile-owner-preview.jpg`, `.backups/profile-public-preview.jpg`; Figma reference: `.backups/profile-owner-reference.png`.
- Logs: `.backups/profile-verification.log`, `.backups/profile-export.log`.

Not performed for this UI task: physical iPhone/Android testing, VoiceOver/TalkBack, real staging mutations, or hosted RLS verification. Existing RLS and APIs were reused without schema, production or Figma changes. No release, deployment or phase-completion claim is made.

## Profile — Setting 1 follow-up

Implemented the renamed Settings frame `421:3669` with its six primary rows, three-dot header button and Figma assets. The header has a 44-point brand band followed by a 56-point navigation row. At 393 points wide the back control is `(24,56,32,32)`, More is `(335,55,34,34)`, and the main rows are 345 × 46 at x=24, y=126/182/238/294/350/406. Header controls include hit slop for 44-point touch targets. Icons retain their original 16 × 16 dimensions; row borders do not increase the measured height. Native safe-area space is added above the brand to avoid obscuring it with system hardware/status content. Row text wraps at larger text sizes.

Edit, creator management, deletion and sign-out now live in **More → Account settings**. The preview puts Edit Profile and Exit demo account in that menu. Opening/dismissing the menu does not invoke actions. Deletion still opens its existing confirmation flow; sign-out retains its confirmation. Profile remains the active bottom tab. No fake status-bar or home-indicator graphics are added.

Verification: mobile type-check/lint and **235 tests in 26 suites passed**. Added coverage for preserving creator/account actions and the sign-out confirmation after moving them. Browser checks confirmed the six row bounds, icon geometry, overflow menu, Edit dialog and dismissal. Assets passed manifest hash/non-empty checks. iOS/Android/web production bundle export passed. Evidence: `.backups/settings-verification.log`, `.backups/settings-export.log`, `.backups/profile-setting-1-geometry.json`, `.backups/profile-setting-1-preview.jpg`; reference `.backups/profile-setting-1-reference.png`.

Sofia Pro remains unavailable, so the previously documented body-font fallback still applies. Physical-device/accessibility checks were not performed in this follow-up. No deployment was made.
