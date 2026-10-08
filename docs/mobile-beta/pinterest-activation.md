# Activate the Pinterest beta pilot

8 October 2026. Local adapter and Home/Search UI are implemented. LaQue app **1616792** has active Trial access. An owner-approved test token is stored as a sensitive variable in the isolated `laque-beta` Vercel project; its conservative expiry is **9 October 2026, 06:13 UTC**. Both board reads and real adapter pages returned successfully. Activation/deployment and device acceptance must be recorded separately. Do not put tokens or app secrets in chat, mobile configuration, screenshots, logs or source control.

Public sources created through Pinterest's normal board interface:

- Minimal Nail Designs: `1107604170798182011`, https://www.pinterest.com/05p0ht4ynqxmeia1b8b9sop5u6lt6s/minimal-nail-designs/ — 500 saved Pins verified.
- Halloween Nail Designs: `1107604170798182008`, https://www.pinterest.com/05p0ht4ynqxmeia1b8b9sop5u6lt6s/halloween-nail-designs/ — 500 saved Pins verified.

The isolated backend pilot is enabled for three existing synthetic beta accounts. The latest phone-test deployment `laque-beta-e7r7m60o4-sogol-s-projects1.vercel.app` is READY and aliased to https://laque-beta.vercel.app. Both board pages and details returned 200 through this hosted endpoint; signed-out and cross-account access were rejected. Connected-device acceptance and renewable credentials remain open. The Expo Go visual preview remains disconnected and does not authenticate the synthetic preview identity.

Featured and the ordinary topics read the Minimal source. Halloween reads only its separately configured board; it never falls back to another board. Tickets are bound to the selected board, topic and account. This is an on-demand selection, not a combined searchable inventory of all 1,000 Pins. Text filters apply to loaded pages.

Hosted migration `202610080027` was applied to `atjwbdrvgljddedtwoqo`. Eight simultaneous service-role RPC requests allowed five and denied three with no errors. Existing Supabase Pro spend cap is enabled; observed egress was 0.22/250 GB, storage 0.72/100 GB, and beta disk provisioned at 2 GB. Vercel uses its existing Hobby plan. No new compute, paid AI, image transformation, upgrade or add-on is provisioned. These readings do not imply that the pre-existing Supabase subscription is free.

## 1. Verify the source

Choose an authorized **public nail board** or obtain explicit **partner-search approval**. Record the permitted source, read scopes and audience. Trial approval alone does not permit a global Pinterest catalogue. For a board, record its numeric board ID and public URL; verify that displaying these Pins in LaQue is permitted. The adapter rejects private boards, other-board Pins and unsupported media.

Partner mode calls `/v5/search/partner/pins` with a server-defined term and country `AE`. It is not the ordinary account-only `/search/pins` endpoint. Do not select partner mode without endpoint approval. Neither mode imports a permanent catalogue or scrapes Pinterest.

## 2. Prepare isolated services and credentials

Rehearse `supabase/migrations/202610080027_pinterest_budget.sql` in isolated PostgreSQL, then apply through the normal migration process. Verify RLS/function privileges and simultaneous requests across distinct connections/server instances. The service client must target the isolated beta database; counter errors deny fetching.

Provision the permitted token in the backend secret store with minimum read scopes and a verified expiry. A browser action that creates or expands security-sensitive access requires action-time confirmation. The current implementation accepts an expiring server token; it does not create OAuth grants or automatically refresh them. Plan an operator renewal/revocation procedure before the pilot.

## 3. Server configuration

These are backend variables, never `EXPO_PUBLIC_*` values:

| Variable | Value / purpose |
| --- | --- |
| `PINTEREST_ENABLED` | Keep `0` until all gates pass; `1` enables the pilot. |
| `PINTEREST_SOURCE_APPROVED` | `1` only after the source/audience permission is documented. |
| `PINTEREST_ZERO_SPEND_VERIFIED` | `1` only after the existing platform's enforceable spending limits/headroom are verified. |
| `PINTEREST_PILOT_USER_IDS` | Comma-separated authenticated LaQue UUIDs permitted for this pilot. |
| `PINTEREST_SOURCE` | `board` or explicitly approved `partner`. |
| `PINTEREST_BOARD_ID` | Numeric authorized public board ID, required in board mode. |
| `PINTEREST_HALLOWEEN_BOARD_ID` | Public Halloween board ID, required for the Halloween topic in board mode. |
| `PINTEREST_PARTNER_APPROVED` | `1` required in partner mode. |
| `PINTEREST_COUNTRY_CODE` | `AE` required in partner mode. |
| `PINTEREST_ACCESS_TOKEN` | Server secret; use the approved environment/source. |
| `PINTEREST_TOKEN_EXPIRES_AT` | Actual token expiry as an ISO timestamp; must exceed now by at least 60 seconds. |
| `PINTEREST_SIGNING_SECRET` | Random server secret of at least 32 characters; rotation invalidates view tickets. |
| `PINTEREST_DAILY_LIMIT` | Optional integer 1–100 upstream requests per rolling 24 hours; default 100. |
| `PINTEREST_MINUTE_LIMIT` | Optional integer 1–5 upstream requests per minute globally; default 5. |
| `PINTEREST_USER_DAILY_LIMIT` | Optional integer 1–30 upstream requests per user per rolling 24 hours; default 10, isolated pilot configured at 30. |
| `PINTEREST_WEB_ORIGINS` | Optional comma-separated exact trusted web origins for browser previews, including scheme/port. No wildcard. Native bearer requests omit Origin. |

Missing, expired or invalid readiness configuration leaves the feature unavailable. The existing mobile backend base URL must point to this isolated deployment. No mobile Pinterest key is required.

Every upstream call reserves capacity, including failed calls and public-board checks. A successful board page/detail generally costs **two API calls**, not one per design. Limits may be lowered but cannot exceed these beta ceilings. Provider exhaustion/access failures establish a durable shared pause. The budget counts only reads made by this adapter; separately account for credential operations and any other callers sharing the Pinterest app.

## 4. Verify zero additional spend and real behavior

Confirm existing hosting/database allowances, other workloads and hard spending controls. Pinterest request counts alone do not bound all app requests, image transfers or hosting charges. Keep the feature disabled if the owner's no-overage constraint cannot be enforced. No paid AI, intermediary, upgrade or automatic paid fallback is included.

Run a small owner-authorized read in the isolated environment, then record only status, field names, pagination and rate-limit behavior—not credentials or Pin payloads. Verify the provider's actual schema/media/creator fields before acceptance. Add the actual Pinterest data flow to the public privacy notice before activation.

With approved pilot accounts, verify Home entry and Search without typing, local query/Length filtering without extra calls, explicit topic/page retrieval, attribution and original links. Check missing text, unrelated products, expired tickets, source privacy changes, 401/403/404/429, duplicates, timeouts and unsafe media. Verify account-switch/background clearing, no persistent Pin/image storage and no Lab/save/share/repost path for external Pins. Test iPhone/Android external links, large text, screen readers and denied/offline states.

The preview intentionally shows no live Pins. PGlite/mock tests and Expo exports do not close these hosted/device gates.

## 5. Enable or roll back

After all evidence passes, set `PINTEREST_ENABLED=1` for the approved allowlisted pilot and verify database counters plus both platforms. Wider production access requires its own provider/audience approval and operating review.

To stop fetching, set `PINTEREST_ENABLED=0`. New reads fail closed; mounted records expire within five minutes or clear sooner on account/background/navigation changes. If removing the migration, disable the feature first and follow the rollback comments. Counter tables contain no Pin content; no imported catalogue needs deleting.

## Connected Expo Go phone check — 8 October

Port 8084 runs the visual preview and deliberately disables Pinterest and real sign-in. Port 8083 now runs the connected native application with `EXPO_PUBLIC_DESIGN_PREVIEW=0 expo start --go --port 8083 --clear`. The LAN QR is saved privately at `.backups/pinterest-connected-go-qr.png`; its URL is `exp://10.255.254.26:8083`. Both devices must be on the same reachable local network.

The third existing synthetic beta account is allowlisted. Its email/password login and hosted Pinterest page request returned success. Credentials are in the private, gitignored `.backups/pinterest-phone-login.txt`; do not publish this file. Skip the introduction, choose email sign-in, then open Home → Explore → Pinterest inspiration, or Search → Designs → Pinterest. Requests use the pilot's 30-upstream-calls/account/day ceiling, with shared 100/day and five/minute ceilings unchanged. The iOS manifest advertises the reachable LAN address and its bundle returned 200. Physical-phone rendering, external links and accessibility are still unverified. Google OAuth return, push and native billing require separate development-build acceptance.

## Phone request-pause recovery — 8 October

The owner’s connected Expo Go screenshots confirmed Home/Search rendering but a stuck `PINTEREST_BUDGET` state. Hosted counters recorded five calls between 06:57:25 and 06:57:36 UTC; the provider gate was not blocked. This was LaQue’s local rolling minute limit. The old UI hid Retry for all budget errors.

Migrations 028/029 are applied and registered in the isolated beta. Board reads now atomically reserve two calls before either upstream request, preventing a partial visibility check from spending the final available call. Responses distinguish minute, account/day, shared/day and provider pauses and include the applicable reset time. The mobile UI disables topic/retry requests during a known cooldown, enables an explicit Retry when it ends, and never polls the API. Older responses without reset metadata retain a manual retry. Account/background/view clearing stays intact.

The pilot account ceiling is now explicitly configured at 30 upstream calls/rolling 24 hours, within the unchanged shared 100/day and five/minute ceilings. The unconfigured per-account default remains ten; configuration rejects values over 30. Existing usage and provider pauses were preserved. No infrastructure or paid service was added. A complete board operation charges two reservations even if the first upstream check fails.

Mobile type-check/lint and 687 tests passed. Backend regressions cover complete reservations, cooldown times, shared/personal ceilings and service-only privileges. A real hosted feed returned 24 records, all 24 accepted by the mobile nail filter. Screenshots of SQL registration/permissions and redacted feed/cooldown results are saved in `.backups/pinterest-recovery-*`. Physical phone confirmation of the updated retry UI remains pending.

Final recovery checks: mobile type-check/lint and 687 tests across 84 suites passed; backend 218 passed / one skipped across 26 files, root lint and deployed production build passed. The updated API also stops before the Pin call when a successful visibility response reports zero remaining provider allowance.
