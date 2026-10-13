# Home V2 implementation — 2026-09-28

Current source: [Figma Main V2 - Filter, 345:3470](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-3470), 393×1785, with the owner's requested New This Week and community sections restored from Home main (345:3621). Six bottom tabs, including Saved, remain the owner's confirmed choice.

## Implemented

- The new lips/jewellery hero, overlaid brand and original bell/star icons, story circles, Explore/Community/Following/Updates tabs, search, category chips and sort controls.
- The complete discovery controls block is one sticky header. A single vertical scroll offset raises the rounded panel over the fixed hero. Once expanded, every control stays at the safe top edge while only the feed moves. Reversing to the feed's beginning lowers the panel and reveals the hero. Native sticky-header transforms and the panel's counter-transform use separate nested views so React Native cannot overwrite either animation.
- Original 140×160 Trending cards and the two-column library with alternating 190/150-pixel images, measured gaps, captions, tags and save buttons. Feed content is occluded by an opaque matching backdrop under the pinned controls.
- Search routes its query to discovery; the bell opens notifications and the star opens Saved. Category filters are applied before the server query limit. Community selects published, non-curated designs; Following uses the authenticated account's follow edges. Newest and Most saved use server ordering. For you ranks the loaded candidates using the existing web feed's shape, occasion, technique and capped popularity weights. Load more expands the candidate pool. Updates reads salon posts from the viewer and followed creators; design category/sort controls are disabled on this text-post feed.
- Stories read the existing `stories` table within a 24-hour window and re-query when opened. The native viewer includes previous/next, unavailable states and a profile link. The new photo/caption composer uses the existing public story storage path and RLS, discloses public visibility, guards account changes and reconciles a stable story ID before retrying publication. Selecting a photo does not publish it. Story viewer/composer layout beyond Home was not present in this frame and uses existing mobile screen components.
- Saving retains the previous account-scoped cache, duplicate-tap protection, unknown/stale-state checks and signed-out return intent. No Figma sample record enters Supabase.
- Reduced motion, large text and very short viewports use ordinary scrolling to keep all controls and content reachable. The user-requested white-strip removal places the photograph behind the real system status bar, with light status icons and the hero controls inset below the Dynamic Island. There is one overlaid LaQue logo and no separate brand strip.

## Assets and typography

Original files are local, with SHA-256 manifests under `mobile/assets/figma/home-v2` and `home-main`. The hero uses the original image source with its 180-degree rotation and cover crop; this removes the old layer export’s baked corner pixels when the photograph fills the screen top. Other controls are real native components. Shared unchanged assets are reused.

Anola Regular is bundled from the owner's supplied archive. **Sofia Pro Regular, Light and Medium remain missing.** The supplied Sofia Regular archive is a different family and was not substituted. Explicit system-font fallbacks are still visible; final typography and line-wrap acceptance is open. Figma's optical glass and native blur/translucency also differ.

## Preview

Run `cd mobile && npm run preview:home`; open `http://localhost:8084` or the advertised Expo Go development server. The preview uses only local Figma fixtures, without auth, billing or backend services. Its category/sort/save controls are interactive; other routes display an explanatory preview alert. The actual Home tab uses real service queries and routes. Release builds always use the real router entry.

## Verification

- `npm run verify`: type-check, lint and all **41 tests** passed. Tests include filters/actions, independent errors/retries, save races, sticky-header grouping, short-screen/reduced-motion fallback, follow-feed isolation, recommendation ranking, story insert retry/reconciliation and account changes during photo selection.
- Browser, 393×852: controls height 357; the original V2 panel started at y528, Trending at y885 and the library at y1148. The later requested white-strip removal moves those positions up 51 px to y477 / y834 / y1097. Before that strip removal, at offsets 0 / 300 / 600 / 850 the hero remains y0; panel/control tops are 528 / 228 / 0 / 0. Search remains y177 at both expanded offsets while the feed moves from y285 to y35. Reverse gestures restore the initial positions. Real pointer taps that shorten the feed preserve pinning. Semantic automation's automatic scroll-into-view can move transformed containers, so pointer input was used for this gesture check.
- iOS 27 simulator / Expo Go: native panel expansion, content scrolling, category taps while pinned and reversing to the hero verified with actual gestures. Expo Go sometimes fails hot reload with `Cannot find native module ExpoAsset`; reopening the project restores rendering. This tooling issue remains open for validation in the app's development build.
- Browser at 320×480 uses ordinary scrolling, keeping the controls reachable. Returning to phone height restores pinning.
- iOS and Android production JavaScript/asset bundle exports both passed. These are compilation checks, not signed store builds or Android device verification.
- Evidence: `.backups/home-v2-scroll-evidence.json`, `home-v2-pinned.png`, `home-v2-verification.log`, `home-v2-export.log`, and the downloaded Figma reference `home-v2-figma.png`.

## Still open

- Final matching Sofia Pro fonts and final visual acceptance. Do not call the screen pixel-identical yet.
- Android device gestures, physical iPhone checks, VoiceOver/TalkBack and full large-text/keyboard coverage.
- Hosted verification of the newly connected story publishing/viewing and Community/Following/Updates flows. Their query and retry tests use mocks and do not prove database policy behavior. No live story was published during this UI task.
- Broader beta acceptance, billing, signing and store delivery gates remain separate. No production service configuration or database migration changed here.

## White-strip removal follow-up

Removed the separate white brand/status mock strip at the owner's request. The original hero photograph now fills the top without baked white corners, keeps its aspect ratio, and sits behind the native light status bar. The overlaid title/buttons respect the real safe-area inset. Browser and iPhone simulator visuals were checked; the browser panel still pins its controls at y0 and search at y177. Type-check, lint and the same 41 tests passed again (`.backups/home-hero-verification.log`). Updated preview: `.backups/home-hero-no-strip.png`.

## Restored weekly and community sections

Added New This Week and Explore our community between Trending and the library, preserving the V2 hero, fixed controls and six-tab navigation. The weekly row uses the earlier 140×222 cards, 8 px gaps, original preview image crops and save controls. The rose community panel restores its 377×280 photo, separate avatar/heart layers, text, two 124 px photo tiles and full-width CTA.

The real weekly query includes only published records created in the previous seven days, applies the active category before limiting, and always orders newest first. Its IDs participate in the account-scoped saved-state query. Community totals use RLS-visible creator/salon profiles and salon posts; loading, unavailable and retry states never replace unknown counts with zero or sample marketing figures. Preview-only reactions and sample counts stay in the development fixture. The CTA selects the existing Community feed and resets its scroll position below the pinned controls.

Verification: type-check, lint and **48 tests passed** (`.backups/home-community-verification.log`). New checks cover weekly cutoff/order/category, real and unavailable counts, weekly save targets, independent retries and the CTA. Browser at 393×852 verified original asset loading/crops and geometry, pinned controls during both sections, and CTA navigation to scroll offset 477 with the feed starting at y357. At 320×480 the screen uses ordinary scrolling, fits the viewport and has no page-width overflow. iOS simulator / Expo Go rendered the updated native screen and retained panel expansion and reverse-to-hero behavior; detailed native card-crop and CTA acceptance remains unverified. The existing ExpoAsset hot-reload issue recurred and cleared after reopening the project.

Evidence: `.backups/home-restored-week.png`, `home-restored-community-photo.png`, `home-restored-community.png`, `home-restored-geometry.json`. No hosted database behavior, physical-device acceptance or Android device behavior was verified in this UI follow-up. The existing typography and beta acceptance gaps above remain open.

## Hero headline and carousel

Restored the earlier 38 px Anola “Nail & beauty / design library” headline near the bottom of the hero, with a contrast gradient. Removed the duplicate small subtitle beside the logo. The existing photograph remains first; the owner's `Rectangle 2.png` is copied unchanged to `mobile/assets/home/hero-second.png` for the second slide, with a top-aligned cover crop.

`HomeHero` uses a horizontal paging ScrollView and two accessible page controls. There is no automatic advance. The selected photo is retained when the viewport width changes. Offscreen photos leave the accessibility tree. The hero's headline, logo and actions remain over both photos.

Verification: TypeScript, lint and **65 tests passed**, including swipe-state changes in both directions, page controls and retained selection on resize. iOS and Android production bundles exported successfully. Browser horizontal scrolling reached x393 for photo two and x0 on return. Vertical feed scrolling reached y600 with its header at y0, then returned to y0 while retaining photo two; horizontal scrolling did not change the vertical offset. Expo Go on the iPhone simulator rendered both photos and switched them using the page controls. Simulator drag automation did not produce a swipe, so native finger gestures and physical-device acceptance remain unverified. The existing ExpoAsset hot-reload issue cleared after reopening the project.

Evidence: `.backups/home-carousel-first.png`, `home-carousel-second.png`, `home-carousel-verification.log`, `home-carousel-export.log`. No deployment or database changes were made.

## Hero backdrop correction against Home main

Re-inspected the live Figma frame `345:3621`, its screenshot, and the actual effect properties on `345:3624`. The generated design-context code omitted the key detail: this is a **progressive** background blur, starting at radius 0 and ending at radius 20. The previous uniform `BlurView` added a system tint and a hard horizontal edge; it has been replaced.

The hero now crossfades four aligned photo layers with increasing blur, without a system tint, beneath the original transparent-to-80%-burgundy gradient. Each photo owns its blur layers so they move together during swipes. This approximates Figma's continuously variable blur with four smooth stages; it is not a claim of mathematically pixel-identical rendering. Browser and native use the same image layers, with platform-specific masks. The photos continue behind the sheet's existing 32-point rounded corners.

At 393 px width, the panel starts at y491, the 169 px backdrop starts at y342, and the headline begins at x24 / y374 with 38 px Anola and 45.6 px line height. The overlay continues 20 px beneath the panel. This supersedes the earlier y477 geometry. The existing two photos, pagination, logo/actions, V2 discovery controls and six bottom tabs are preserved.

Verification: type-check, lint and all **65 tests / 10 suites passed**. Browser visuals were checked at 393×852 and 320×740. Horizontal scrolling returned the carousel to x0; vertical scrolling reached y600 with the controls pinned at y0, then returned to scroll 0 and panel y491. Expo Go on the iOS simulator rendered the corrected fade on both photos, with the page buttons switching correctly. The known ExpoAsset hot-reload error cleared after reopening the project. Android runtime, physical devices and native swipe gestures were not verified in this correction.

Evidence: `.backups/home-main-hero-reference.png`, `home-hero-progressive-fixed.png`, `home-hero-progressive-second.png`, `home-hero-progressive-ios.png`, and `home-hero-progressive-verification.log`. No deployment or database changes were made.
