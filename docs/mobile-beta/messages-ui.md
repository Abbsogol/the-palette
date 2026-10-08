# Messages and Lab History — 2026-09-29

> **Later update:** Messages now defaults to an inbox with last-message summaries, times and unread state; **New message** retains the contact browser. Share to Chat has a dedicated design/recipient/confirmation flow, and sample messages persist across preview navigation. See [Share to Chat and Messages inbox](share-chat-ui.md) for current behavior, verification and limits. The original frame inspection below records the earlier implementation.

Inspected the original Figma layout, screenshot, assets and effects:

- [Home main - Message 1, 422:4253](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=422-4253)
- [Lab - My Generations, 345:4669](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-4669)

## Messages

The named frame is a **New message** contact list. The Messages tab now uses its 28-point heading, 48-point search pill, 24-point page margins, recent-contact panel, glass rows, role badges, cities and chevrons. The two icons are original Figma exports; dimensions and hashes are recorded in `mobile/assets/figma/messages/manifest.json`. It retains the current 4K background and six-tab navigation, with Messages active. Native safe areas replace the reference's simulated status bar.

In the connected app, the list displays the signed-in participant's existing, non-hidden conversations, with unread indicators. Search matches name, username or city within loaded contacts; filters select artists, salons, clients or unread conversations. Load more extends the existing pagination. New contacts are reached through **Find an artist or salon**. Client locations are not displayed. Selecting a contact opens its existing conversation without sending a message. The separate design-sharing flow remains available and suppresses duplicate taps and navigation after an account change.

Loading, request failure/retry, empty lists and no search matches have explicit states. Refresh is available through pull-to-refresh and the filter sheet. The preview uses the five Figma sample contacts and explains that they are samples when tapped; it makes no message API calls.

## Lab History

History opens **My Generations**, using the original three preview images, a two-column grid with 12-point gaps, 166.5-point cards at the 393-point reference width, 4:3 image slots and the reference's header spacing. Compact widths and large text use one column. The earlier user-requested **Nail Lab** header is retained. Back returns to the Lab; connected history retains account-owned records, signed images, pagination and existing save/publish actions.

## Verification

- `npm --prefix mobile run verify`: typecheck, lint and **243 tests across 28 suites passed**.
- Seven new tests cover contact filtering, states and pagination, preview navigation, conversation routing, share failure/retry identity, duplicate taps and stale-account responses. The old Messages-placeholder assertion now checks the still-unconnected Saved preview tab.
- Expo bundle exports passed for **iOS, Android and web** with design preview disabled. These are exports, not signed native builds.
- Browser preview at the 393-point reference width verified city search, salon filtering, sample contact selection, Lab → History → Back, original gallery imagery and 166.5-point card width.
- Evidence: `.backups/messages-preview.jpg`, `.backups/history-preview.jpg`, `.backups/messages-history-verification.log`, `.backups/messages-history-export.log`.

## Limits

Sofia Pro is unavailable, so body typography uses the existing platform fallback. Figma's glass/refraction effect is approximated with the existing cross-platform glass component. Exact pixel acceptance remains open for those differences. No live messages, generations, purchases or database mutations were performed. Physical-device, keyboard and VoiceOver/TalkBack verification were not performed for this update.
