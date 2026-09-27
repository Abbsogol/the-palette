# Combined Phase 1 and Phase 2 review — September 26, 2026

**Current status: all six findings are fixed and verified locally.** See [remediation, tests and rollout requirements](six-issue-fixes.md): 172 automated checks and 10 browser checks pass, including the actual shared-cluster CI sequence. Changes are not pushed, migrated or deployed.

The remainder of this report preserves the original inspection evidence: five application defects and one test-fixture defect, before remediation. Its eight probes and source line numbers refer to that earlier implementation. Current executable regressions are in `tests/security/review-fixes.test.js` and `tests/security/delete-account.test.jsx`.

## Original inspection results

| Check | Result |
|---|---|
| Existing full Vitest suite | 135 passed, 0 failed |
| Native PostgreSQL, in the actual CI order | 50 regression checks passed, then 62 security checks passed, on the same disposable cluster |
| New combined review probes, native PostgreSQL | **6 failed, 2 passed** |
| Production smoke build | Passed with fake service configuration |
| Browser smoke checks | 10 passed across Chromium/mobile WebKit |
| ESLint | Zero errors/warnings |
| Diff whitespace check | Passed |

The eight review probes run independently of the established suite. They are not skipped or marked expected-to-fail. Thus the established suite still passing does not resolve the newly reproduced failures. Routes use SDK/Stripe doubles; SQL probes execute the captured public definitions with both proposed migrations on a disposable local PostgreSQL 17 cluster. No real subscription or charge was created, no real account was deleted, and the production schema was not modified.

## Original confirmed findings

### C12-01 — P1: pending subscription checkouts are not serialized

Two concurrent requests for a first-time account, one for each plan, both returned 200 and called Checkout creation. The idempotency key includes the plan and a five-minute time bucket; the profile check only sees an already recorded subscription, and the Stripe check runs only when a customer ID is already stored. Neither represents a pending checkout. The two resulting sessions could both be completed. The earlier REG-04 fix handles existing subscriptions, but does not close this pending-checkout path.

Source: [create-subscription](../app/api/create-subscription/route.js), lines 39–61. Fix by establishing one customer and one durable pending subscription attempt per user, reusing/expiring sessions safely across plan changes and webhook delay. Verify concurrent first purchase and delayed fulfillment.

### C12-02 — P1: onboarding overwrites purchased credits

An authenticated, not-yet-onboarded user can purchase credits through the checkout API. The probe started with a 40-credit purchase already fulfilled; onboarding returned 200 and changed the balance to 3. The Phase 2 conditional write prevents repeated onboarding completion, but still assigns a fixed balance instead of preserving previously granted credits.

Source: [complete-onboarding](../app/api/complete-onboarding/route.js), lines 35–55. Grant starter credits atomically and once, preserving the existing balance, and test a purchase racing with onboarding.

### C12-03 — P1: an old subscription cancellation clears a current plan

A `customer.subscription.deleted` event for an older customer/subscription, carrying the same app user ID, cleared an account's active premium tier. The handler matches only the user metadata. No current subscription ID is stored or compared, so duplicate/historical subscriptions and out-of-order events can revoke unrelated current access.

Source: [stripe-webhook](../app/api/stripe-webhook/route.js), lines 152–161. Persist and compare the active Stripe subscription/customer identity, and make lifecycle updates safe against old or reordered events. This is related to C12-01 but is a separate webhook failure.

### C12-04 — P1: account deletion fails for a creator but the UI signs out anyway

Calling the actual `delete_own_account()` function for a synthetic user owning a design failed with foreign-key error `designs_created_by_fkey`. The function deletes `auth.users`; profile deletion cascades, but `designs.created_by` does not define a matching deletion action. The UI ignores the RPC error and signs out, leaving the account/data in place without reporting failure.

Sources: [profile deletion UI](../app/profile/page.js), lines 496–499; [captured foreign key](../tests/fixtures/security-baseline.sql), line 514; captured `delete_own_account()` at line 709. Define the intended deletion/retention behavior for dependent designs, generations, bookings, financial records and Storage objects, implement it transactionally where possible, and show deletion failure instead of implying completion through sign-out.

### C12-05 — P2: admin product creation is blocked by database authorization

The admin page writes `products` using the browser Supabase client. A synthetic authenticated user with `is_admin=true` attempted the same insert and received a row-level-security error. The captured product policies allow public reads and service-role management, with no authenticated-admin management policy. Phase 2 does not add one. Updates/deletes through this browser path also lack the necessary policy.

Sources: [admin product actions](../app/admin/page.js), lines 775–785; [captured product policies](../tests/fixtures/security-baseline.sql), lines 1341–1342. Add tightly scoped admin policies or owner-verified server admin endpoints; test legitimate admin writes as well as denial for normal users.

### C12-06 — P2: combined CI silently tests the wrong service-role permissions

Phase 1's fixture creates `service_role` without `BYPASSRLS`. PostgreSQL roles are cluster-wide. The Phase 2 fixture only adds `BYPASSRLS` when creating a missing role, so the actual workflow order (regressions followed by security on the same cluster) retains the restricted role. Both existing jobs still pass. A new assertion checking the effect of a service-role profile update failed: the stored `bio` stayed null. The existing test merely awaited the UPDATE and did not check whether any row changed.

Sources: [entitlement fixture](../tests/fixtures/entitlement-schema.sql), line 8; [security fixture role setup](../tests/fixtures/security-baseline.sql), line 10; [missing positive assertion](../tests/security/authorization.test.js), line 50. Normalize role attributes only inside the guarded disposable test environment and assert both allowed effects and denied effects. This is a test-fidelity defect, not evidence that the production service role is misconfigured.

## Passing targeted controls

- Deleting an owned design referenced by a booking succeeded and cleared the nullable booking reference. The new booking guard did not block the foreign-key action in this test.
- A real like produced exactly one notification and one counter increment with both migrations applied.

## Historical reproduction artifacts and commands

- `.backups/review-tests/routes.test.js` and `.backups/review-tests/database.test.js`: eight focused checks.
- `.backups/combined-review.config.mjs`: isolated Vitest configuration for those checks.
- `.backups/run-combined-review.mjs`: disposable native PostgreSQL run in CI order, followed by the probes.
- `.backups/combined-native-probes.json`: 2 passed / 6 failed.
- `.backups/combined-native-results.json`: runner exit codes and the observed role attributes.
- `.backups/combined-review-tests.json`, `.backups/combined-review-build.log`, `.backups/combined-review-lint.log`, `.backups/combined-review-browser.log`: baseline recheck evidence.

The original probes are retained as historical evidence and target the pre-fix interfaces. Current verification uses `npm test` and `node .backups/run-six-fixes.mjs`; the latter uses the ignored native PostgreSQL utility. Neither targets Supabase.

The existing Phase 1 infrastructure gaps still apply: isolated managed staging, restore rehearsal, service credentials/configuration, live Storage behavior, and the proposed migrations' production rollout remain unverified/pending. These are separate from the six reproduced failures above.
