# Combined review remediation — September 26, 2026

All six findings from the combined Phase 1/2 review are fixed and verified locally. The changes are unpushed and unapplied to production. This closes the six reproduced code/test defects, not the outstanding managed staging, backup/restore, or deployment requirements.

## Changes and regression evidence

| Finding | Correction | Verification |
|---|---|---|
| C12-01: duplicate pending subscription checkout | A profile-row lock creates one durable checkout attempt per account across plans. The attempt pins its customer/email and return URL, supplies a stable Stripe idempotency key, and stores the resulting session. Only a positively expired session releases an attempt. Timeouts never silently release it. | Concurrent different-plan requests yield one success/one conflict and one external session. Same-plan retries reuse the session. A timeout after Stripe creation retains the attempt; retry uses the same key. Completed sessions block a second purchase while fulfillment is pending. |
| C12-02: purchased credits overwritten by onboarding | A service-only SQL transaction adds the starter grant to the existing balance, atomically with the first completion and allowlisted profile fields. | A 40-credit balance becomes 43 for users and 45 for creators/salons. A pack purchase racing with two onboarding requests ends at 43. Repeated completion cannot reset spent credits or edit the completed profile. |
| C12-03: old cancellation removes current plan | Persist the subscription and customer identity. Read current Stripe state, then atomically apply the event and its receipt. Ignore unrelated identities and older nonterminal events. Store cancellations even before checkout fulfillment so a concurrent stale activation cannot resurrect access. | Old subscriptions on both the same and different customers leave the current plan intact. Current cancellation works, duplicates are harmless, reordered checkout/update events cannot resurrect it, a legitimate new subscription can bind after cancellation, and a failed transaction leaves the event retryable. |
| C12-04: deletion blocked and falsely shown as successful | Add matching FK deletion behavior for owned designs, generation references, collection links and invitations. Remove legacy owned collections explicitly. Delete owned object bytes through Storage's API before the transactional account deletion. The UI shows errors and signs out only after confirmed success. | Real SQL account deletion with owned generations/designs/images/likes/notifications/collection links/invitations succeeds while another user's account and collection survive. A deliberately blocking FK rolls everything back. Storage failure preserves the account and can be retried. Component checks cover network/database failure, pending deletion, confirmation cancellation and sign-out failure. |
| C12-05: admin products rejected by RLS | Add an authenticated-admin policy with both row visibility and mutation checks. | Admin creation, draft reads, edits and deletion succeed with stored-value/returned-row assertions. Anonymous/ordinary users cannot mutate products or see drafts. |
| C12-06: incorrect service-role fixture and empty successful write | Both guarded local fixtures normalize role attributes; service_role has BYPASSRLS, anon/authenticated do not. Successful-write tests assert returned rows and persisted values. | Phase 1 and Phase 2 run in CI order on one PostgreSQL 17 cluster. Role attributes and the actual service-role profile update are asserted. |

New executable coverage lives in `tests/security/review-fixes.test.js` and `tests/security/delete-account.test.jsx`. The review-flow tests call the real API handlers and execute their database RPCs and writes under service_role against all three migrations. Stripe and Storage transports are doubles; they do not make remote requests. The previous onboarding route test now checks the atomic RPC contract instead of simulating the old profile overwrite. The earlier successful-write assertion was strengthened.

## Completed verification

| Check | Result |
|---|---|
| `npm test` | **172 passed, 0 failed, 0 skipped** — 37 more checks than the previous 135-test baseline |
| Native PostgreSQL 17, one cluster in CI order | **50 regression checks passed, then 99 security checks passed**; all role attributes correct |
| `npm run build:smoke` | Passed with synthetic service configuration |
| `npm run test:e2e` | **10 passed**, Chromium and mobile WebKit |
| `npm run lint -- --max-warnings=0` | Zero errors/warnings |
| `git diff --check` | Passed |

Local evidence is retained in ignored `.backups/six-fixes-tests.json`, `six-fixes-native-regressions.json`, `six-fixes-native-security.json`, `six-fixes-native-results.json`, and the matching lint/build/browser logs. `.backups/run-six-fixes.mjs` runs the native cluster sequence and returns a failing exit code if either suite fails. CI already runs regressions followed by security on its PostgreSQL service. Generated `.backups/` artifacts are excluded from source linting.

## Rollout requirements and limits

1. Rehearse migrations **001 → 002 → 003** on an isolated, current schema before a coordinated app/database release. The new file is `supabase/migrations/202609260003_review_fixes.sql`. No migration was applied to hosted Supabase in this work.
2. **Reconcile existing Stripe subscriptions before deploying the new handler.** Historical profiles have no `stripe_subscription_id`. Verify the actual customer/subscription pair and plan from Stripe, backfill those identities, and resolve duplicate subscriptions and outstanding legacy checkouts. The handler intentionally refuses to infer a current subscription solely from a user ID. Unknown-customer legacy checkouts need explicit reconciliation; this local change does not claim to have migrated live billing identities.
3. An ambiguous checkout creation older than 23 hours is held for support reconciliation instead of replaying a potentially pruned idempotency key. Inspect the original attempt/session in Stripe; do not clear the row merely because it is old. A known expired session can be released normally.
4. Account deletion removes account-owned database content using the existing cascade semantics, including bookings/messages and the app's per-user credit ledger. Event receipt IDs remain. External Stripe financial records are untouched. An active plan or unresolved checkout blocks deletion; a confirmed expired checkout is cleared on retry. Storage cleanup is retryable but cannot be atomic with PostgreSQL: a later failure can leave some files removed while the account remains. The UI explicitly reports that possibility. Verify retention requirements and managed Supabase Storage/Auth deletion behavior on staging before release. Legacy objects without a trustworthy owner/path still require the existing object inventory; do not delete guessed objects.
5. Real Stripe test-mode payments/webhooks, managed Supabase Auth/Storage, isolated credentials, restore rehearsal and remote CI remain outside this local verification. Browser checks are smoke coverage, not live checkout/account-deletion certification. Other known release issues such as monthly credit fulfillment and booking overlaps remain tracked separately.

Design references: [Stripe event ordering](https://docs.stripe.com/webhooks), [Stripe idempotent requests](https://docs.stripe.com/api/idempotent_requests), [Checkout session lifecycle](https://docs.stripe.com/api/checkout/sessions).
