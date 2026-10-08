# LaQue Pinterest implementation plan

Prepared 8 October 2026. Status: adapter, budgets and Home/Search UI implemented locally; live integration not enabled. See [implementation evidence](pinterest-inspiration.md) and [activation guide](pinterest-activation.md).

## Product outcome

Show a limited selection of nail inspiration in LaQue Home and Search, clearly labelled Pinterest and linked to the original Pin. Users search the selection available in the app using LaQue’s existing vocabulary, including Length. Home can display a selection before anyone searches. There is no promise to provide every nail design on Pinterest.

Owner constraints: no paid AI classification, paid Pinterest intermediary, additional paid infrastructure or usage overages. If an approved source or enforceable spending limit is unavailable, keep this feature disabled rather than substituting a paid service.

## What exists

`mobile/src/features/pinterest/nail-design-filter.ts` supplies local text rules for relevance and LaQue categories. The adapter and Home/Search source UI now use it, preserving source metadata and removing duplicate IDs. Representative live-source accuracy remains unverified. It cannot verify image contents or replace moderation. See [current implementation](pinterest-inspiration.md).

The owner's dashboard was inspected on 8 October: LaQue app 1616792 has active Trial access. No live token, permitted source/audience, partner entitlement or enforceable hosting spending controls have been verified. No token was generated, app permission changed or live API read performed.

## Source and permission gate

Select one source after checking the actual approved app:

| Source | Intended use | Gate |
| --- | --- | --- |
| Partner keyword search | Request predefined terms such as French-tip nails, chrome nails and short nail art | `/search/partner/pins` is restricted; verify explicit endpoint access and the proposed LaQue audience. |
| Authorized nail board | Read a small, deliberately curated board | `/boards/{board_id}/pins` reads owned/shared boards; access to a board is not proof that its Pins may be redistributed to all LaQue users. Verify this use case. |
| Neither source permitted | Keep LaQue’s own designs available | No live Pinterest cards; do not substitute scraping. |

The ordinary `/search/pins` endpoint searches the token account’s Pins, not Pinterest globally. Trial and Standard are access tiers, not proof of partner-search entitlement. Pinterest recommends Standard for a product serving users. These constraints are documented in [Pinterest’s search reference](https://github.com/pinterest/pinterest-python-generated-api-client/blob/main/docs/SearchApi.md), [board reference](https://github.com/pinterest/pinterest-python-generated-api-client/blob/main/docs/BoardsApi.md) and [access tiers](https://developers.pinterest.com/docs/key-concepts/access-tiers/).

Record the app ID, current tier, permitted source/audience, required read scopes and approval evidence. Keep secrets out of documentation and mobile bundles. Start with read-only access; publishing to Pinterest is outside this feature.

## Delivery milestones

### 1. Verify a source and a zero-spend envelope

- Make a small owner-authorized read against the selected endpoint. Record status, returned field names, pagination and rate-limit headers without logging credentials or Pin payloads.
- Confirm media-display and attribution requirements for that source. Check whether returned records contain enough text for the existing filter.
- Verify the existing hosting/database plan’s remaining allowance, other application usage and available hard spending controls. A Pinterest request cap alone cannot guarantee no hosting overages. Do not activate if the deployment cannot enforce the owner’s constraint.

Exit: a permitted source, usable response and enforceable operating limits are documented. Failure leaves the integration off.

### 2. Add a bounded server adapter

- Use existing backend hosting; no new paid service or runtime dependency. Proposed read route: `/api/pinterest/inspiration`, protected by LaQue authentication for the initial beta pilot.
- Keep a server-owned source/topic allowlist. Accept a topic key and validated pagination cursor, never an arbitrary upstream URL, account, board or endpoint.
- Validate upstream responses and return a distinct Pinterest record type. Do not insert Pins into `designs` or masquerade as a LaQue creator.
- Store OAuth credentials securely with minimum read scopes, expiry/revocation handling and redacted logs. Where OAuth is needed, bind state to the initiating account; the registered callback renders its own completion page rather than immediately redirecting elsewhere, as required by [Pinterest’s connection guide](https://developers.pinterest.com/docs/getting-started/connect-app/).
- Apply timeouts, response-size limits, account/request isolation and explicit unavailable, unauthorized, budget-exhausted and retry-later results.

Exit: adapter and permission tests pass; no mobile credential exposure.

### 3. Enforce budgets before upstream requests

Pinterest currently documents a universal Trial limit of **1,000 requests/day**; category limits also apply and can change. This is a request ceiling, not a catalogue size or guaranteed allowance. One paginated response can contain multiple Pins; pagination, token operations and retries consume additional calls. [Rate limits](https://developers.pinterest.com/docs/reference/rate-limits/).

Implemented beta ceilings, reduced if verified headroom requires it: at most 100 upstream requests per rolling 24 hours, five per minute globally, ten upstream requests per signed-in user per rolling 24 hours and 24 exposed records per page. A board page/detail requires a public-board check plus the Pins read: two budgeted calls. Respect the stricter provider headers as well. An atomic shared counter in the existing database reserves before sending and counts failed calls. Only counters/status are stored. The current adapter requires an explicitly expiring server token; OAuth grant/refresh operations are not implemented and their allowance must be reserved separately before adding them.

No polling, bulk imports, scheduled harvesting, speculative pagination or automatic retry loops. Fetch when the user opens the Pinterest section or explicitly requests a topic, refresh or another page. Search queries and LaQue category/Length filters change the loaded selection locally, without calls on each keystroke. Stop on 429 until the provider permits retry; show a clear message while LaQue’s own catalogue continues working.

Exit: concurrency, restart, pagination, retry and limit-exhaustion tests cannot exceed configured upstream budgets. Hosting limits are separately verified before activation.

### 4. Finish the product UI

- Home: a separate Pinterest inspiration section using LaQue typography and colours; it can load on section entry without a search query. Keep Community and Updates user-authored.
- Search: add a source selector within Designs, not a new bottom tab. Existing LaQue search remains unchanged. Pinterest mode searches only its loaded selection and says so; “Load more” is explicit. No fabricated total count or Most saved ordering when the source lacks verified metrics.
- Cards: original image, source label below it, title and creator/source attribution when provided. Treat inferred categories as text-derived suggestions. Withhold ambiguous/non-nail results.
- Detail: a source-aware version of the D36 layout, with “View on Pinterest.” Omit unprovided gel brands, hex codes, techniques, reviews, save counts and booking identities. Do not invent a LaQue artist for an external Pin.
- Initial release: viewing and original-link opening only. LaQue folder saving, Share with my nail tech, reposting and Pinterest write actions require separate permission/storage design before enabling them for Pins. They remain available for LaQue-owned designs.
- Include loading, empty, offline, broken-media, deleted/private, revoked-access and request-budget states. Recheck authorization on reopening; clear transient records on account changes.

Pinterest’s guidelines require clear source links and unaltered/unobscured content, prohibit general storage of API information and prohibit unauthorized scraping, model training and derivative redistribution. Therefore this plan uses no durable Pin catalogue, search index, response/CDN cache, offline persistence or copied image storage. Disable disk image caching for this source and do not send Pins into Lab. Only transient state needed for the current authorized view is proposed; verify that handling before activation. [Developer guidelines](https://policy.pinterest.com/en/developer-guidelines).

Exit: source distinctions and unavailable states work in browser and native previews, with no silent fallback to copied content.

### 5. Verify and release a limited pilot

Run existing filter cases plus adapter, budget and UI tests. Use synthetic fixtures locally and real permitted Pins only for owner-authorized integration checks. Verify no tokens/content in logs, persistent cache or LaQue Storage; no network request from filtering; account-change discard; 401/403/404/429; duplicate pages; unsafe URLs; attribution/link behaviour; and removal of inaccessible content.

Check a human-reviewed sample for unrelated products, construction/medical content and weak metadata. Increase exclusions or withhold results rather than add paid classification. Test iPhone/Android layouts, accessibility and external links. Update the privacy notice to the actual source/data flow before activation. Enable an allowlisted beta audience only after all gates pass; retain a server kill switch and rollback by disabling the source. A mock preview or Trial approval alone does not close these gates.

## Work order

8 October update: the adapter/counters and source UI are built. Two public boards have 500 saved Pins each. The approved temporary token is stored in the isolated beta backend, the migration is applied, hosting limits/spend cap are verified, and real hosted page/detail reads pass for a three-account synthetic pilot. No new paid service is provisioned. See [connection evidence](pinterest-inspiration.md). Next complete connected-device and filter-quality acceptance, provision renewable OAuth access, and obtain any required Standard/partner approval before wider release. The Expo Go visual preview remains disconnected.

## Phone request-pause recovery — 8 October

The owner’s connected Expo Go screenshots confirmed Home/Search rendering but a stuck `PINTEREST_BUDGET` state. Hosted counters recorded five calls between 06:57:25 and 06:57:36 UTC; the provider gate was not blocked. This was LaQue’s local rolling minute limit. The old UI hid Retry for all budget errors.

Migrations 028/029 are applied and registered in the isolated beta. Board reads now atomically reserve two calls before either upstream request, preventing a partial visibility check from spending the final available call. Responses distinguish minute, account/day, shared/day and provider pauses and include the applicable reset time. The mobile UI disables topic/retry requests during a known cooldown, enables an explicit Retry when it ends, and never polls the API. Older responses without reset metadata retain a manual retry. Account/background/view clearing stays intact.

The pilot account ceiling is now explicitly configured at 30 upstream calls/rolling 24 hours, within the unchanged shared 100/day and five/minute ceilings. The unconfigured per-account default remains ten; configuration rejects values over 30. Existing usage and provider pauses were preserved. No infrastructure or paid service was added. A complete board operation charges two reservations even if the first upstream check fails.

Mobile type-check/lint and 687 tests passed. Backend regressions cover complete reservations, cooldown times, shared/personal ceilings and service-only privileges. A real hosted feed returned 24 records, all 24 accepted by the mobile nail filter. Screenshots of SQL registration/permissions and redacted feed/cooldown results are saved in `.backups/pinterest-recovery-*`. Physical phone confirmation of the updated retry UI remains pending.

Final recovery checks: mobile type-check/lint and 687 tests across 84 suites passed; backend 218 passed / one skipped across 26 files, root lint and deployed production build passed. The updated API also stops before the Pin call when a successful visibility response reports zero remaining provider allowance.
