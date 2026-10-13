# Favorites / Saved mobile UI

Updated 2026-09-29. The Saved bottom tab opens Favorites with Saved Designs and Saved Profiles. There was no dedicated Favorites frame on the inspected Figma app page, so this screen extends Search's rose background, shared typography, design cards and artist/salon cards.

## Behavior

- Fixed title, two tabs and local search; scrolling folder covers and a two-column design/profile grid.
- Create and rename folders (trimmed names, 80-character limit), add multiple saved designs, organize an individual design, remove a member, and delete a folder after confirmation.
- Removing a folder member or deleting its folder preserves Saved Designs. Removing a design from Saved Designs retains any existing folder memberships; the confirmation explains this.
- Existing collection routes and the design-detail collection picker use the same screen and data model.
- Connected routes reuse `saved_designs`, `collections`, `collection_designs` and `favourite_creators`. Reads are account-scoped, paginated beyond 100 records and filtered by existing RLS. Private images are signed and cached in memory only. Inaccessible records are not substituted with demo data.
- Folder creation retries reuse a client-generated ID; membership inserts are deduplicated by the existing unique key. Account changes invalidate pending responses and clear the account cache.
- The visual preview uses session-only sample data. Home/Search/profile heart actions share Favorites state, and folders survive tab changes. Reloading or leaving the demo resets it. No sample data is sent to Supabase.

## Verification

- `cd mobile && npm run verify`: type-check and lint passed; **288 tests across 34 suites passed**.
- `npx vitest run tests/mobile-backend/favorites.test.js`: **4 tests passed** against local PGlite with the migration-backed security fixture and authenticated/anonymous roles. Checked ownership, retry deduplication, private-design rejection, folder deletion preserving saved records, and independent saved-profile ownership.
- Connected Expo exports passed for iOS, Android and web (`EXPO_PUBLIC_DESIGN_PREVIEW=0 npx expo export --platform all`). These are JavaScript bundles, not signed native builds.
- Browser preview checked at 393 × 852 and 320 × 700: designs/profiles tabs, folder creation and adding two designs, profile opening and returning with Saved Profiles still selected. Component tests cover rename, deletion, removing members, failure/retry, duplicate taps and switching tabs.
- Screenshots: `.backups/favorites-designs.png`, `.backups/favorites-profiles.png`, `.backups/favorites-folder.png`.
- Not tested this turn: hosted Supabase persistence, physical devices, VoiceOver/TalkBack. No production changes, deployment or push performed.
