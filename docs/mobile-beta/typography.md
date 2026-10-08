# Shared tab typography — 2026-09-29

All six tabs now use the font families defined in `mobile/src/theme/typography.ts`. Existing `homeFonts` imports re-export this same definition, so a future font change applies throughout the app.

- Page headings: bundled Anola, regular, 32/38.4 points. Search, Nail Lab, Messages, My Generations, profile names, Settings and generic screens (including Saved) share this style.
- Body, fields, navigation and labels: one explicit fallback per platform (Avenir Next on iOS, Android sans-serif, Arial on web), with light variants where appropriate. Sofia Pro has not been supplied; the separate Sofia archive remains excluded.
- Main action buttons: the body family, regular, 16/20 points. This replaces inconsistent display-font buttons in Home, filters and profiles, and the heavier generic buttons.
- Section headings: body family at 18/22 points. Existing brand wordmarks, hero display text and compact badges retain their purpose-specific sizes.
- Previously unstyled profile counters/status labels, image fallbacks and avatar initials now select the shared family explicitly.
- At compact widths, the Lab header moves its controls onto the next row so its title stays intact.

Validation: mobile typecheck, lint and all 243 tests across 28 suites passed. Browser inspection covered Home, Search, Lab, Messages and Profile at 393-point width, plus the Lab header at 320 points. Saved uses the updated generic screen/card primitives; its connected screen was not opened with a real account in this pass. No physical-device verification or new native build was performed.

Evidence: `.backups/typography-verification.log`, `.backups/typography-search.jpg`, `.backups/typography-lab.jpg`, `.backups/typography-messages.jpg`, `.backups/typography-profile.jpg`.
