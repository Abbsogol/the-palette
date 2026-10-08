# Mobile design details — Figma 36

Implemented from [frame 36](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-6071), inspected 2026-09-28. The 393-point reference supplies the background, 24-point margins, 345 × 383 hero with 32-point corners, title, chips, 132 × 112 close-ups, glass colour card and gradient action.

## What opens

Home and Search design taps use `/design/[id]`, with the source tab preserved. The local development preview at http://localhost:8084 now opens the same layout instead of an alert. In Search, tap Cathedral for the complete Figma reference. Other cards keep their own selected image/title. Returning closes the preview detail without resetting the Search query, filter or scroll state.

Real records supply the title, description, metadata, ordered extra images, colour specifications and tags. Child reads use the existing Supabase RLS policies, with all private photographs signed. No mock reviews, colours or images are inserted into the live catalog. Missing optional sections are omitted. No migrations, production writes or deployment were needed.

## Interaction

- Swipe the gallery or use its page controls; open a full-size image or close-up.
- Save/unsave the selected design; duplicate taps and stale saved-state errors cannot trigger an unintended write. Late account-scoped requests are rejected.
- Copy the actual colour code with visible success/failure feedback.
- Share a published design with the native share sheet.
- “Show my nail tech” uses the existing authenticated conversation picker. Preview fixtures explain that sending requires the connected catalog.
- Collection, creator profile, booking, owner editing and reporting remain reachable under More options.
- The previously agreed six-tab navigation is retained. Device status bars are real, not simulated.

## Verification

`npm --prefix mobile run verify`: TypeScript, lint and **133 tests across 14 suites passed**, including 24 new detail tests. Coverage includes gallery paging, selected close-ups, copy success/refusal/error, image retry, missing metadata, query failure, revoked full-screen content, duplicate/failed saves, signed-out return intent, account changes, preserved IDs in subsequent actions and Home/Search preview entry/return.

`CI=1 npx --no-install expo export --platform all`: **iOS, Android and web production bundles exported successfully**. This verifies bundling; it is not a signed native build or a physical-device test. Logs: `.backups/design-detail-verification.log` and `.backups/design-detail-export.log`.

Remaining verification limits:

- Browser visual inspection was blocked twice because the browser could not verify the admin-enforced policy for localhost. No automated screenshot comparison was completed; pixel-level sign-off remains open.
- Anola is loaded. Licensed **Sofia Pro** is still missing; body text uses the documented fallback. The previously supplied “Sofia” family is not Sofia Pro.
- No live Supabase interaction, native share/clipboard device test, VoiceOver/TalkBack or physical-device accessibility check was performed in this change. Supabase and clipboard outcomes in unit tests are mocked.
- Expo Clipboard was added using Expo SDK 57's compatible version. Existing custom development binaries need rebuilding to include it; production export alone does not install native modules on a device.
