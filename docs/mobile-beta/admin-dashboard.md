# Connected beta admin dashboard

Implementation and beta verification: 8 October 2026. Dashboard: https://laque-beta.vercel.app/admin. Supabase project: `atjwbdrvgljddedtwoqo`. Production activation is not included in this rollout.

## Access and delivery

The initial Owner is bound to the explicitly selected, verified account UUID, with an audited bootstrap. Owner access is assigned. The real Owner still needs to enroll and verify an authenticator. Email/password and existing Supabase sessions are supported; all protected data and mutations require a verified TOTP factor and an AAL2 session on the server. Each request checks current staff membership and account status. Synthetic acceptance staff have been revoked, leaving the real Owner as the sole active staff account.

The desktop and responsive dashboard has Overview, Users & Creators, Content, Home Editor, Bookings, Lab Diagnostics, Subscriptions & Tokens, Safety Reports, Pinterest, Integrations, Team and Activity. Support and Moderator menus and counts are restricted to their role. Administrative changes require reasons and are audited. Ordinary app permissions are retained; legacy browser writes and writable `is_admin` shortcuts are retired.

Lists use server search, filters and pagination. Home's owned-design selector currently shows up to 100 designs; Team displays the small staff membership list. The Owner can assign Support or Moderator to existing verified account UUIDs. Owners cannot remove the final Owner. Adding a replacement Owner remains an explicitly approved service operation.

Reports expose only the targeted item. Reported chats contain the one message/attachment and participant identities, without neighbouring messages or the conversation identifier. Moderation is reversible and restoration retains privacy/deletion restrictions. Suspension stops new activity while existing cancellation, refund recovery and deletion safeguards remain available. Lab diagnostics omit private prompts and images.

Credit tools use an integer delta, mandatory reason and idempotency key. The database locks the account and records the correction atomically. Purchases/refunds remain provider-owned. Nail Lab now requires the in-app monthly subscription; the dashboard can inspect status and correct extra token balances, but cannot sell, grant or cancel subscriptions or execute refunds. See [lab-subscription.md](lab-subscription.md).

## Home and private images

Home drafts, preview and explicit publish use optimistic versions; stale writes return HTTP 409. The initial published content retains the app's two hero photographs and typography. Announcements appear as LaQue announcements in Updates; owned featured designs have a labelled Explore section without changing Trending ranking.

`GET /api/mobile/home-content` returns only published heroes, viewer-visible featured IDs, announcements and revision. The connected mobile app refreshes on screen focus, foreground and pull to refresh. Older builds can continue their existing Home layout without calling this additive endpoint.

New admin uploads use the existing private `mobile-uploads` bucket. Persistent image references are resolved to temporary signed previews for authorized staff. The public Home endpoint signs only published hero images for 60 seconds, after media visibility checks. Published design images use ordinary design RLS, so drafts, private authors, blocks, hidden content, suspension and deletion also restrict newly issued access. Previously issued signed URLs last until expiry; already downloaded images and legacy public assets cannot be recalled. Unused admin uploads do not yet have an automated orphan-cleanup workflow.

Applied beta migrations: `202610080030_admin_operations`, `202610080031_pinterest_oauth`, `202610080032_admin_private_media`. Migrations 030/031 were rehearsed together; 032 has separate database audience and storage tests.

## Pinterest readiness and remaining connection

The Owner controls Connect, Reconnect, Disconnect, display pause and public-board verification. OAuth uses only boards, Pins and account identity read scopes. Tokens are encrypted in service-only records. Authorization attempts are tied to the initiating Owner/browser, expire and are single-use. Callbacks recheck Owner/MFA. Token refresh uses a shared lease; revocation and late responses cannot silently restore disconnected credentials.

Pinterest app 1616792 has the registered redirect `https://laque-beta.vercel.app/api/pinterest/oauth/callback`. App ID, app secret, redirect URI and encryption key are configured only on beta's server. The callback renders its own completion screen with a manual Return to dashboard action.

Minimal and Halloween board IDs are configured for verification. Live Owner consent, successful callback, both boards' public visibility and a real refresh journey still need verification. OAuth adapter mode remains off until that succeeds; existing pilot/approval gates and request ceilings are unchanged. No permanent Pinterest catalogue or partner-search entitlement is added.

See [the review-recording guide](pinterest-upgrade-recording.md). Do not record a test-token screen as OAuth or submit the application before live consent, pagination and original-Pin opening are verified.

## Evidence and release gates

- Full root suite: 83 files, 869 passing tests, 2 skipped; lint and smoke build passed. This includes the private-media migration’s 10-case database suite. Relevant security suites also passed (156 tests).
- Live beta: 20 allowed role/section requests, wrong-role denial, AAL1 denial, AAL2 access, immediate staff revocation, idempotent corrections, concurrent correction/generation balance, reversible moderation, suspension and reported-message isolation.
- Live private media/Home: private upload, protected preview, draft isolation, stale edit conflict, published signed hero, ordinary published-design access and hidden-design media denial. Temporary content was removed and original Home restored through versioned APIs.
- Desktop and 390 px dashboard layout checked; no horizontal overflow. Review dialogs support keyboard focus, cancellation and Escape. Real Owner authenticator setup is intentionally left to the account owner.
- Evidence is in ignored `.backups/admin-*` files. These contain private test credentials and operational records; do not publish the backup directory.

Remaining acceptance gates: real Owner authenticator, genuine Pinterest authorization/board/refresh/denial journeys, the final review recording, and connected iOS/Android acceptance plus physical-device accessibility checks. Production requires separate acceptance and activation.

## Expanded Overview — 8 October 2026

The beta Overview now includes 7/30-day activity charts, booking and Lab distributions, profile setup, design publication and Owner-only opted-in behavioral analytics. See [admin-analytics.md](admin-analytics.md) for definitions, privacy, cleanup and verification. Final root verification: 884 passed, 2 skipped; mobile verification: 696 passed. Connected beta API checks and Owner desktop chart/range/keyboard/table controls passed. A narrow viewport override did not affect the dashboard tab, so narrow-screen visual verification remains open; physical-device tracking also remains to be confirmed.

## Exports and complete account details — 8 October 2026

Users & Creators now searches sign-in email and displays grouped profile, contact, account, creator and activity information. User CSV and individual-account JSON exports are Owner-only, with audited role-scoped operational exports and an aggregate Overview export. See [admin-exports-users.md](admin-exports-users.md) for field/access boundaries, limits and evidence.
