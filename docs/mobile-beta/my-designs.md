# My Designs — Manage / Publish / Edit

Updated 7 October 2026. Local implementation is ready to review; hosted integration and native-device acceptance remain open.

## Product flow

Profile → My Designs now exposes **Upload a design** for customers and creators, including empty profiles. **Manage my designs / Manage portfolio** and the Creator Studio portfolio checklist open the same manager. Lab generations continue to use the existing editor and D36 design page; Community posts and Stories remain separate content types.

The manager has All / Published / Drafts filters, owner-scoped deterministic pagination, image/error/empty/loading states and retry. Cards show visibility, specifications, View, Edit and a confirmed permanent-delete action. The server supplies the rolling weekly allowance; reaching it disables new uploads while existing designs remain editable. Private saves count as new photo designs; edits and retries do not consume another slot. Existing verified uncapped entitlement rules are preserved, without adding subscription offers.

The editor supports a cover and up to eight photos, cover reordering/removal, title/description, shape, Length, technique, style, occasion, twelve colours and twenty tags. Unknown shade/product information can remain blank. It has actual choosing/uploading stages, upload failure/retry with retained details, validation, explicit private-save/publish feedback and saved-D36 navigation. Publishing requires description, shape, length and technique. Preview opens D36 without saving or unmounting the editor. Unsaved edits and pending operations protect native navigation; account changes remount the editor and discard late results. Failed signing/image previews leave owner metadata and replacement/removal controls available. Private photo previews avoid persistent image caching.

Deletion requires a branded confirmation. Cancel keeps the record, provider/database failure keeps the dialog and draft, and success follows an acknowledged owned-row deletion. Shared design links no longer resolve after database deletion. Media disposal remains the existing durable cleanup job; previously public images are not promised to disappear immediately from external caches or downloads.

## Defects reproduced and corrected

- An owner-filtered DELETE matching zero rows reported success. Two pre-fix regression tests failed in `.backups/portfolio-reproduction.log`; the route now selects deleted IDs and returns 404 when no owned row matched.
- The weekly-upload RPC rejection appeared as a generic retryable 503. It now returns 409 / `UPLOAD_LIMIT`, with actionable allowance feedback and retained-draft wording.
- Publishing/unpublishing copies photos into a different bucket. The save response now returns canonical photo URLs, and the still-open editor rebases its photo references before another save. Route/component regressions verify that later edits do not reuse staged paths.
- Owner editor loading previously depended on every private-photo signature succeeding. Owner editing now permits unavailable previews while retaining canonical references; public D36 detail loading keeps its existing stricter behavior.

## Verification this task

| Check | Result and limits |
| --- | --- |
| Mobile sequence | Type-check → lint → all 485 Jest tests passed, 63 suites. SDK/native boundaries are mocked; these do not establish physical-device behavior. |
| API regressions | 14 tests across portfolio management, uploads and existing design/social API suites passed; changed-route/test lint passed. Regular customers can upload through the local API, cleanup preparation failure writes no bytes, signed-out requests fail, owner filters and error feedback are checked. Supabase SDK is mocked here. |
| Real PostgreSQL | 20 design/social regressions passed on PostgreSQL 17.10, macOS. Tests use actual authenticated/service roles and RLS: regular-user publish/unpublish, stranger read/delete denial, owner deletion/cascaded share revocation, atomic metadata writes, quota-safe edits/retries and concurrent ownership claims. Storage objects are SQL fixtures, not real Supabase Storage HTTP delivery. |
| Connected bundles | Design preview disabled; both iOS and Android Hermes exports passed. These are bundles, not freshly signed binaries or store builds. |
| Browser preview | Shared UI checked at 393×852 and 320×800 with no horizontal document overflow. Verified regular-user upload entry, status filters, create/private-save, publishing feedback, D36 with Share with my nail tech, keep/discard unsaved edits and visible confirmation. Sample state/photos are in memory; preview does not upload to a service. Temporary viewport override was reset. |
| Full repository CI | Not rerun for this UI task. This is focused local verification, not a new CI/release acceptance result. |

Evidence: `.backups/portfolio-mobile-check.log`, `portfolio-api-check.log`, `portfolio-api-lint.log`, `portfolio-database.json`, `portfolio-export.log`, `portfolio-hosted-preflight.json`, `portfolio-hosted-journey.json`, `portfolio-hosted-creator-journey.json`, and `my-designs-manager.png`.

## Actual hosted preflight and remaining gates

The verified backend identifies `https://laque-beta.vercel.app` and isolated Supabase project `atjwbdrvgljddedtwoqo`. Existing synthetic customer and creator accounts authenticate. The design metadata projection (including technique and child ordering fields) exists on this project.

The deployed API is older than the local implementation:

- GET `/api/mobile/portfolio` returns **405** for both roles, so the new allowance contract is not deployed.
- Customer design upload returns **403 — Creator account required**, contradicting the required regular-user upload feature.
- Creator upload succeeds with synthetic PNG pixels, but saving the current D36 payload returns **400 — Choose an image first**. The deployed route still expects the older image argument. No synthetic design row remained after either attempt. The unattached creator upload is left to the existing upload cleanup obligation; this task did not verify its worker disposal.

Deploy matching backend/mobile changes to isolated beta, then verify real customer and creator upload → private save → publish → edit → unpublish → share → delete, including actual bytes and cleanup, quota exhaustion, two-account permitted/forbidden actions and interrupted/duplicate saves. The new canonical-media response and DELETE/limit feedback require that deployment. Do not treat the exposed database fields as proof that its API is current.

Physical iPhone/Android photo-library permissions, HEIC/platform preparation, interruption/backgrounding, keyboard/large text, VoiceOver/TalkBack, expired signed URLs, real Storage failures and cleanup remain unverified. No production changes were made. Phase 1 remains open.
