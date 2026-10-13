# Release base reconciliation (F04)

Reviewed 13 October 2026. The combined candidate reconciles the protected app/backend/Admin Studio work with the actual web release base. Final completion evidence belongs to the exact candidate's GitHub checks and the one-tab Excel tracker. No production merge, deployment, signing or hosted database change is part of this task.

## Actual release base and PR stack

| Source | Reviewed SHA | Disposition |
|---|---|---|
| `origin/main` | `1bc0a544262da2865a8df89fa549b04df801a9d9` | Merged into the candidate, including the wine design system, redesigned routes, image dimensions/WebP pipeline and expanded search from PR11. |
| PR1 security foundation | `6499c0b2f13d27b1bd68fa719edfef045d1242a6` | An ancestor of the candidate; server authentication, RLS, transactions and recovery preserved. |
| PR3 mobile/admin | `2548c9bf16fdf075819d44e20a4689a25419820b` | Candidate parent. PR3 targets PR1's branch rather than main, so it cannot serve as the combined release review by itself. |
| PR4 privacy policy | `a6909af44aef65d2b6d9fb534576befb4c8708b9` | Content compared separately. Its stylesheet and purposes remain, with the later Calendar, permanent-closure/retention, 18+, banner, Pinterest and analytics disclosures. Do not merge the older policy branch wholesale over this notice. |

PRs: [foundation](https://github.com/Abbsogol/the-palette/pull/1), [app/admin](https://github.com/Abbsogol/the-palette/pull/3), [policy](https://github.com/Abbsogol/the-palette/pull/4).

The [initial inventory](release-base-review-2026-10-13.json) preserves the historical review of `7c2bf2a`: 46 web/security conflicts and 45 conflicts from a direct old-policy merge. All 46 release-base conflicts were resolved in this candidate. Run `git fetch origin`, then `npm run release:review`; the current result must include both the latest release base and PR1. This read-only ancestry/conflict inventory does not replace code review or CI.

## Reconciliation decisions and evidence

- Preserved main's redesigned screens and reusable primitives. Protected Admin Studio and its service-controlled staff roles, authenticator MFA, API writes and action history take precedence over the legacy direct-browser admin implementation. No `is_admin` shortcut is restored.
- Retained atomic generation reservations, immutable/replay-safe generation identity, provider-confirmed billing/refund outcomes, account-bound actions and creator-local booking snapshots. Restored booking-slot errors, calendar-conflict acknowledgement, revoked-tier billing management and distinct refund states in the redesigned layouts. No payment success is inferred from the return URL or a balance change.
- The new web `upload-image` route requires a verified account, delegates avatar/chat uploads to the existing protected upload contract, and rejects legacy administrative purposes. Chat photos use conversation-scoped private objects and `messages.image_path`. Hand photos are owner-scoped private uploads. Main's WebP conversion, actual-byte validation, pixel limit, orientation and output dimensions remain shared by uploads and explicit generated-design publication. Private drafts are never copied publicly merely by saving them.
- The new creator reply aggregate requires a verified account and caller-RLS profile visibility before reading service metadata. Its response contains only aggregate timing and has `no-store`; no conversation bodies or neighbouring messages are exposed.
- Signed-in web design detail now uses the caller's RLS browser client instead of an anonymous server singleton. Logout and foreground refresh clear inaccessible designs. Cards, galleries, hand photos and private attachments use authenticated Storage signing. Navigation badges and presence discard an old account on session changes.
- The complete-profile flow keeps the atomic age/privacy/entitlement chain. Migration **042** saves health fields in the existing private table within the same transaction, preserves the sharing choice, and protects hand-photo ownership and cleanup leases. It also records the current policy version for newly completed onboarding. Existing consent records are not rewritten. The existing one-time legacy onboarding credits remain unchanged; migration 042 does not grant a Lab subscription or reset balances.
- The current policy explicitly describes eligible native Stripe processing and active subscription management. Its date and new-signup metadata are aligned to 13 October 2026. Tax/legal retention wording is preserved; this source reconciliation is not legal approval.

Tests cover the new routes' session/visibility barriers, rejected legacy admin uploads, corrupt image rejection, private image signing across account changes, onboarding rollback/replay/privacy, owned media adoption/cleanup, detail logout/refresh and real browser SDK requests. Provider mocks distinguish the new RLS title lookup from the paid image-provider boundary while preserving original charge, retry and concurrency assertions. Existing auth tests open the redesigned editor/settings controls; their isolation assertions remain intact. Final review restored the username editor’s guarded save callback and checks the rendered actor before uploading a private hand photo. Additional tests reject account changes before the auth event, reject delayed photo adoption after A→B→A, and preserve a verified username save during a same-account token refresh.

## Repository and credential checks

Gitleaks **8.30.1** uses the upstream tagged binary with verified SHA-256. The initial full-history scan inspected 463 reachable commits. Eleven findings were exact Figma document identifiers, one fixed mock signing value and one prose list. Exceptions are exact **value AND path**, limited to the generic-key rule. No directories, commits, credential baselines or inline-ignore bypasses are excluded. The current candidate and full reachable history must also pass before completion.

CI rejects tracked local environment files, keys, native/Expo build state, database backups and recognizable account screenshot paths. Only four named environment templates are allowed. Actual account passwords, tokens, OAuth keys and private screenshots stay ignored/outside Git. The loopback PostgreSQL `test-only` password and fixed mock values are synthetic fixtures that cannot authenticate to LaQue or a provider. Secret scanning is not OCR; added binaries from main are product branding/redesign assets, including the reviewed logo and hero image.

Both `codex/native-mobile-beta` and **`codex/release-foundation`** have automatic Vercel deployment explicitly disabled. A Git push cannot activate this release against production.

## Verification and remaining release gates

Local clean `npm ci`, full backend suites, lint (no errors; existing warnings remain), Next build and **24 Chromium/WebKit checks** passed during reconciliation. Two local PGlite concurrency cases are intentionally skipped because they require independent PostgreSQL connections; CI executes those against native PostgreSQL without skips. Final CI must run all backend tests, repository/history checks, mobile verification/exports and native Android Release/iOS Release simulator builds on this commit. The exact SHA and run URLs are recorded in the Excel tracker and combined release PR; passing an ancestor is insufficient.

Reproduce with the committed workflows, `.nvmrc` and lockfiles. Browser/build fixtures explicitly replace inherited service settings with loopback-only values. Migrations are rehearsed in fresh local test databases; **042 has not been installed in beta or production**. F05 remains the deployment/database rehearsal gate. F01 still requires developer-account registration, signed production-candidate verification and environment acceptance. These unsigned smoke builds do not satisfy it. Legacy web product/billing parity (F07), public-media revocation and other privacy/store/device acceptance tasks remain in the launch tracker. F04 completion is not permission to launch.
