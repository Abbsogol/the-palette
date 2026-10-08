# Pinterest inspiration: implementation status

Updated 8 October 2026. **The live backend pilot is deployed to `laque-beta.vercel.app` for three synthetic test accounts.** Production LaQue is unchanged. Owner constraints: no paid AI classification, paid intermediaries, additional paid infrastructure or usage overages. Connected mobile/device acceptance remains open; Expo Go's visual preview still deliberately shows a disconnected source.

## Delivered

- Home Explore has a separate Pinterest inspiration section. Community and Updates retain their own posts.
- Home and Search render Pinterest looks in two columns inside the screen's existing vertical scroll. Topic chips retain their own sideways scroll. Pagination announces added matching looks, explains pages without new matches and retries failed pages with the same cursor.
- Search Designs has LaQue / Pinterest source controls. Queries and the existing filters, including Length, operate on the loaded selection. People & Salons is unchanged. Counts describe the selection only; unsupported popularity sorting is omitted.
- Cards show original images without cropping or overlays, Pinterest attribution and creator attribution when returned. Details recheck access before displaying content and offer **View on Pinterest**.
- Explicit topic buttons request a new selection; refresh and pagination are manual. Typing or changing LaQue category filters sends no Pinterest request. No polling, harvesting or automatic retry loop.
- Guest, disconnected preview, loading, empty, failed image, expired/revoked access, offline and request-budget states are handled. The preview contains no invented Pinterest Pins.

External Pins are distinct from LaQue designs: no insertion into `designs`, copied image upload, local folder saving, Share to Chat, booking identity or Lab reference action. Existing LaQue design actions remain available.

## Filter and data handling

`mobile/src/features/pinterest/nail-design-filter.ts` uses title, description, alt text and optional supplied tags to identify nail inspiration and infer the existing categories. Word boundaries, compound hashtags and exclusions reduce unrelated construction, medical and product/tool matches. Missing useful text is withheld. The filter is a text heuristic, not image recognition or moderation; false positives and omissions remain possible. Labels explicitly describe categories as inferred.

`mobile/src/features/pinterest/inspiration.tsx` holds records only in the active view. It has no persisted query cache, offline catalogue or disk image cache. Records clear on account changes, backgrounding, leaving the view or five-minute expiry; pagination does not extend older records' lifetime. Late responses from another account are discarded.

`lib/pinterest/inspiration.js` and `/api/pinterest/inspiration` implement authenticated, allowlisted board/partner reads with server-only credentials, expiring account/source-bound pagination and detail tickets, fixed topics, response limits and timeouts. Unsupported media and unsafe URLs are withheld. Every board page/detail read first rechecks that the configured board is public. Browser origins require an exact allowlist; native bearer requests do not need an Origin header.

The additive migration `202610080027_pinterest_budget.sql` stores request counters and shared pauses only. Row locking reserves capacity before every upstream read across server instances. Default ceilings: **100 upstream requests/rolling 24 hours, five/minute globally, ten/user/rolling 24 hours**. Failed calls count. A board page or detail normally consumes **two** upstream calls: board visibility plus Pins. Provider limits and revocation can pause further reads. The migration is applied and registered in the isolated beta database, with service-only access, RLS and rollback notes.

## Connection evidence and remaining gates

The owner's Pinterest dashboard was inspected on 8 October: LaQue app **1616792**, **Trial access active**. Following explicit approval, a 24-hour test token was generated and stored as a sensitive variable only in the isolated beta project. The configured conservative expiry is **9 October, 10:13 Dubai / 06:13 UTC**. No mobile/source-control token was added. This does not establish partner-search or public-release approval.

Both public boards were created and curated through Pinterest's normal Save interface: **500 saved Pins each** in Halloween Nail Designs and Minimal Nail Designs. The server maps Halloween to its own fixed board and ordinary topics/Featured to Minimal. This is not an indexed combined catalogue of 1,000 designs; filters apply to the loaded selection.

Deployment `dpl_9LG8MT4yjNUfKhfyzLnuont5tZ3B` is READY and aliased to the beta URL. Real authenticated hosted requests returned 24 records plus pagination for both boards, and rechecked details returned the same Pin. Signed-out requests returned 401; cross-account tickets returned 400. Eight simultaneous hosted budget requests allowed five and denied three. Both counter tables have RLS, no anon/authenticated read grant, and neither role can execute the reservation function. Redacted evidence is in `.backups/pinterest-hosted-{feed,halloween,budget}.json`; board and SQL screenshots are saved locally. Existing Vercel Hobby and Supabase's enabled spend cap were verified with substantial quota headroom; no infrastructure change was made.

The remaining work is recorded in the [activation guide](pinterest-activation.md): connected iPhone/Android and accessibility acceptance, representative visual/filter quality checks, a renewable OAuth credential, and any required wider-audience provider approval. The beta privacy notice describes the actual data flow. Credential expiry fails closed; an OAuth connection/automatic refresh workflow is not implemented.

The additional connected mobile-web check on port 8083 cannot complete: `expo-secure-store` has no native `getValueWithKeyAsync` implementation in the browser. Native secure session storage was preserved; no plaintext browser storage or authentication bypass was introduced. A separate connected native Expo Go session now runs on port 8083; its LAN manifest and iOS bundle returned 200. The third allowlisted synthetic account passed email/password sign-in and a hosted Pinterest page read. The owner has a new QR and private login guide; physical-phone confirmation is pending. Development builds remain necessary for native billing and release acceptance. This limitation is distinct from the working backend checks and deliberately disconnected visual preview on port 8084.

The feature uses no new paid service or dependency. Its request budgets limit Pinterest reads; they do **not** independently prevent hosting/database overages. `PINTEREST_ZERO_SPEND_VERIFIED` is an activation gate requiring separately verified platform controls, not a billing mechanism.

## Local verification

- `npm --prefix mobile run verify`: type-check, lint and **687 tests across 84 suites** passed; 13 UI integration cases cover protected entry, attribution, local filters, board topic matching, pagination, detail access, external links, account changes and background clearing.
- `npm run test:mobile-backend`: **212 passed, one skipped** across 26 files, including separate-board configuration and source-bound tickets.
- Root lint and production smoke build passed. iOS and Android Expo bundle exports passed.
- Phone-width browser preview verified Home placement, Search source selection and the disconnected state. Screenshot: `.backups/pinterest-search-preview-8oct.png`.

Connection logs are in `.backups/pinterest-connect-*.log`, `.backups/pinterest-two-boards-tests.log` and `.backups/pinterest-beta-deploy.log`. Unit API tests use synthetic responses and local database tests use PGlite; hosted evidence is recorded separately. Bundle export is not a signed build or physical-device test. No Phase 1 release gate is closed by this pilot alone.

See the [implementation plan](pinterest-plan.md) and Pinterest's [developer guidelines](https://policy.pinterest.com/en/developer-guidelines), [access tiers](https://developers.pinterest.com/docs/key-concepts/access-tiers/) and [rate limits](https://developers.pinterest.com/docs/reference/rate-limits/) for the integration gates.

## Phone request-pause recovery — 8 October

The owner’s connected Expo Go screenshots confirmed Home/Search rendering but a stuck `PINTEREST_BUDGET` state. Hosted counters recorded five calls between 06:57:25 and 06:57:36 UTC; the provider gate was not blocked. This was LaQue’s local rolling minute limit. The old UI hid Retry for all budget errors.

Migrations 028/029 are applied and registered in the isolated beta. Board reads now atomically reserve two calls before either upstream request, preventing a partial visibility check from spending the final available call. Responses distinguish minute, account/day, shared/day and provider pauses and include the applicable reset time. The mobile UI disables topic/retry requests during a known cooldown, enables an explicit Retry when it ends, and never polls the API. Older responses without reset metadata retain a manual retry. Account/background/view clearing stays intact.

The pilot account ceiling is now explicitly configured at 30 upstream calls/rolling 24 hours, within the unchanged shared 100/day and five/minute ceilings. The unconfigured per-account default remains ten; configuration rejects values over 30. Existing usage and provider pauses were preserved. No infrastructure or paid service was added. A complete board operation charges two reservations even if the first upstream check fails.

Mobile type-check/lint and 687 tests passed. Backend regressions cover complete reservations, cooldown times, shared/personal ceilings and service-only privileges. A real hosted feed returned 24 records, all 24 accepted by the mobile nail filter. Screenshots of SQL registration/permissions and redacted feed/cooldown results are saved in `.backups/pinterest-recovery-*`. Physical phone confirmation of the updated retry UI remains pending.

Final recovery checks: mobile type-check/lint and 687 tests across 84 suites passed; backend 218 passed / one skipped across 26 files, root lint and deployed production build passed. The updated API also stops before the Pin call when a successful visibility response reports zero remaining provider allowance.

## Phone layout / pagination recovery — 8 October

The owner reported only two photos and no visible change after Load more in both Home and Search. An authenticated hosted check of Featured returned 24 eligible records, followed by 24 different eligible records with a new cursor. All 48 passed the existing text-based nail filter; this was not an exhausted or duplicate API page. Pin payloads and tickets from this check were held only in process memory.

The previous Home layout placed all cards in a sideways carousel, and Search nested a non-scrollable vertical ScrollView inside its screen scroll. Both now use plain View rows with two equal-width cards, allowing the parent screen to scroll every loaded row. Images retain `contain` sizing and no disk cache. Original Pin attribution, local filters, credential/account isolation, five-minute expiry and existing request ceilings remain intact.

Three added regressions failed against the original implementation: missing added-page feedback, missing explanation when a page has no new matching looks, and next-page retry restarting from the first page. They now pass. Mobile type-check, lint and all 690 tests across 84 suites passed. Real API pagination produced 48 different designs, but this check does not establish physical-device layout acceptance. The connected Expo Go server serves these mobile changes; no backend/schema change or budget increase was needed. Evidence: `.backups/pinterest-pagination-reproduction.log`, `.backups/pinterest-grid-verify.log` and `.backups/pinterest-grid-connected-bundle.json`.

## Connected iOS simulator acceptance — 8 October

Tested the connected port-8083 app in Expo Go 57.0.9 on the LaQue Beta Verification iOS 27 simulator. Search displayed live Pinterest images in two columns and increased its count from 24 to 48 after Load more. Home also appended its second page; its final row rendered real images and the visible confirmation read “24 more matching looks added.” Both screens retained their fixed headers while the design rows scrolled. Screenshots: `.backups/pinterest-simulator-search-48.png` and `.backups/pinterest-simulator-home-added.png`.

The original synthetic phone-test account had 29 reservations and correctly rejected another two-call board operation with an account/day reset time. Testing continued with the existing synthetic customer account; no budget was reset or increased. Mobile type-check and lint passed again. This closes the tested simulator layout/pagination case, not physical iPhone/Android, external-link or accessibility acceptance. The simulator remains open on Home with the appended Pinterest page.

The owner's 12:00 screenshot showed a disabled retry beside a reset time rounded to the same minute. Short pauses now display a second-by-second countdown; longer pauses display an exact reset time including seconds. The timer only updates local UI and does not make API calls. Type-check, lint and all 18 Pinterest UI tests passed, including countdown progression, disabled requests before reset and manual retry after reset. The new countdown is test-verified; a fresh simulator cooldown was not induced solely to capture it.
