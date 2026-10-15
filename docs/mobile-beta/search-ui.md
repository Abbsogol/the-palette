# Search and filters — 28 September 2026

The native Search tab now uses the inspected Figma layouts in file `VEodtjFruvXPaIwWW2BjMC`:

- `345:4066`: Search main.
- `345:3160`: Search - Filter main.
- `345:4257`: Search - Artists & Salons main.

The user requested Length in addition to the filter frame. Short, Medium, Long and Extra Long appear between Shape and Occasion using the same chip styling.

Follow-up: the owner requested removal of the LaQue header from Search. The Search and filter views no longer display it or reserve its empty space. Search starts 24 points below the native safe area; the filter sheet starts at the safe area.

## Implementation

`mobile/src/features/search/` contains the native presentation, typed queries, filter definitions and original Figma asset references. The existing Search route opens this feature. The six-tab navigation remains in place.

The layout uses the original background, design photographs, artist photographs, swatches and icons. Asset provenance and SHA-256 hashes are in `mobile/assets/figma/search/manifest.json`. Screens are native components; no screen screenshot is used as the interface. At the 393-point reference width, the content has 24-point side margins, 345-point cards, 32-point card corners and the measured Figma spacing. Safe areas use actual platform insets, with no simulated clock or battery graphics. Compact widths and large font scales use two filter columns.

Filters support multiple selections, per-group counts, Clear All, draft cancellation and explicit Apply. Close and the native modal dismissal callback discard unapplied edits. Counts and result pages share the same database query. Selections are OR within a group and AND between groups. Color filters use the `design_colours` relationship with an inner join so pagination and totals count matching designs, not color rows. Search input is escaped and free text never enters PostgREST filter expressions. Results support pagination, sorting, empty/error/loading states and retries.

Saves preserve the sign-in return destination, reject duplicate pending writes, check saved state before a write, and reject stale account results. Save errors are scoped to the account epoch. Artist favorites use the existing account-owned favorites table. Existing RLS policies remain in force.

## Verification

- `npm --prefix mobile run verify`: TypeScript, lint and all **63 tests in 9 suites passed**. Search contributes 15 tests covering filter drafts/apply/clear/dismissal, Length, unknown/zero/error counts, query construction, sort/detail/save actions, duplicate writes, failed writes and account changes.
- `npx expo export --platform ios --platform android`: both production JavaScript/Hermes bundles and assets exported successfully. This is compilation evidence, not signed native build or device evidence.
- Browser preview: inspected at 393 × 852 and 320 × 480; the compact filter layout has two columns and no document horizontal overflow. Exercised text search, artist/design tabs, sorting, selection, zero-result apply and clearing. Fixed a background overflow that could move the filter sheet when focusing offscreen choices.
- Expo Go on the iPhone simulator: inspected Search and filter rendering; selected Y2k & Retro and Length: Long; applied the zero-result state; reopened and cleared selections; typed Pistachio and observed its one matching result. The existing Expo Go hot-reload session required reopening after an `ExpoAsset` runtime error; a fresh session rendered successfully.
- Read-only anonymous queries against the isolated beta Supabase project: the actual adapter returned one published design with no filters, and zero results with eight selections across the filter groups. Listing totals agreed with the count query in both cases. No database mutations were issued during this hosted check.

Local evidence is retained in ignored `.backups/search-verification.log`, `.backups/search-export.log`, `.backups/search-staging-read.json` and `.backups/search-*-preview.png`.

## Preview and limits

Run `npm --prefix mobile run preview:home`, open port 8084, and select Search. This visual preview contains the original Figma sample records; its initial 177-design label reproduces the frame. Filtering operates on its three sample designs and displays their matching count. Samples never enter the production catalog. The normal Expo app uses real Supabase records and counts.

Anola is bundled. The supplied Sofia font is a different family from **Sofia Pro**, which Figma uses for body text. Sofia Pro Regular, Light, Medium and ExtraLight app-use font files are still needed for exact typography. Platform fallbacks remain in use; visual acceptance is therefore not pixel-identical yet.

Figma's per-design review totals do not have a verified equivalent in the existing backend (artist appointment reviews are different records). Real design cards show a Details link rather than invented review totals; artist ratings are omitted until backed by real rating data. Preview fixtures retain the Figma sample totals.

Mocked tests do not prove authenticated hosted saves, artist favorites, populated-catalog filter semantics or pagination under concurrent changes. Those need synthetic authenticated accounts and a richer isolated dataset. Android device rendering, physical iPhone testing, screen-reader sessions, software-keyboard layout and large-text device checks remain unverified in this UI task. No production deployment, commit or push was performed.

## Artist and salon card follow-up

Re-inspected `345:4257` and its individual layers after the request to fix account results. The 393-point layout now measures 166 × 218 per card, with 13-point grid gaps, 32-point corners, 125 × 124 avatars, overlapping gradient account-type badges, and an 8-point name/metadata gap. Names can wrap and cards grow for longer content. The existing large-text single-column behavior is retained. Search still omits the LaQue header as requested.

The eight visual-preview portraits now use exports of the individual Figma avatar layers, preserving their crop, exposure and tint. These are image assets only, not rendered cards or screenshots of the UI. Their source node IDs, dimensions and hashes are recorded in the asset manifest. Real accounts continue to use their own uploaded photos; unavailable photos show a centered initial and a replacement image can recover.

Artist save controls are separate from design save controls: 28-point outlined glass hearts when unsaved and 24-point solid rose hearts when saved, each inside a 44-point touch target. Profile and favorite actions stay independent, and pending saves remain disabled. Unverified or invalid rating/review values are omitted. Figma's glass refraction is approximated with the existing native blur and edge treatment; missing Sofia Pro fonts remain a visual difference.

Follow-up verification:

- Mobile TypeScript, lint, and **73 tests in 10 suites passed**. Eight added tests cover artist profile/favorite actions, pending/saved accessibility states, photo failures and recovery, invalid or missing ratings, and salons without photos.
- iOS and Android production JavaScript/Hermes bundles exported successfully. These exports do not constitute signed native builds or physical-device checks.
- Browser preview checked at 393- and 320-point widths. Verified the card/avatar/heart dimensions, loaded images, name search, save/unsave states, wrapping at the compact width, and no document horizontal overflow. Figma sample data remains confined to the local preview.
- Evidence: `.backups/search-artists-verification.log`, `.backups/search-artists-export.log`, `.backups/search-artists-preview.png`, and `.backups/search-artists-compact.png` (ignored local files).

This follow-up changes presentation and local visual fixtures. Hosted favorite writes, real rating integration, physical devices and assistive-technology sessions were not exercised again; the integration limits above remain open.

## Fixed Search header — 28 September 2026

Per the owner's screenshot, the Search heading, subtitle and Designs / Artists & Salons tabs now sit outside the results scroll view, below the device's top safe area. The search input and results scroll below them. The background is anchored to the screen, and switching result tabs returns the list to its top. Both the connected app and Expo Go demo use this shared view. TypeScript, lint and 31 existing Search/welcome/save tests passed; the pinned header was not rechecked on a physical device in this change.
