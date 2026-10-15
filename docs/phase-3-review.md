# Phase 3 — critical journeys and transaction review

**Status: open, not release-ready.** On September 26, 2026, this pass reproduced 18 failing checks across 15 defect categories, corrected the local implementation, and added regression coverage. The user's automatic late-deposit refund policy was also implemented and tested. Final verification: **235 automated tests and 12 browser smoke checks passed; zero failures or skipped tests in the final complete suites.** Lint and the production smoke build passed. These results do not close the managed-service, recovery, reconciliation, or Linux CI gaps below.

Work is on `codex/phase-1-foundation`, above the Phase 1 commit `c50829a`, together with the Phase 2 and combined-review fixes. Publication and current remote checks are tracked in [draft PR #1](https://github.com/Abbsogol/the-palette/pull/1). No production deployment, migration, payment, or refund was performed during this review.

## Flow, role and state map

| Flow | Roles and transitions | Required invariant / review focus |
|---|---|---|
| Login / recovery / OAuth | Anonymous → verified user; expired/revoked token → denied; recovery → password update | Server verifies identity; callbacks stay in the correct environment; no token or admin claim trusted from request body. Managed OAuth/recovery requires staging. |
| Profile and administration | User edits allowlisted own fields; admin manages products and adjusts credits | Other users cannot write; admin writes must actually affect rows; integer nonnegative credits only. |
| Onboarding | New user/creator/salon → completed once; purchase before or during completion | Preserve paid balance and grant starter credits once under concurrent writes. |
| Credit packs | Checkout pending → paid → fulfilled; duplicate/delayed/refund-before-paid events | One grant per payment; cumulative refunds; no debit of unrelated credits before a purchase was ever fulfilled. |
| AI generation / free retry | Reserved → completed or released; upstream/storage/DB failure; concurrent last credit | Single charge/claim; completed work cannot be refunded accidentally; deletion cannot remove in-flight paid work. Process termination and real provider behavior require integration verification. |
| Subscription checkout | No plan → one pending attempt → active/terminal; timeout/retry/expiry | Durable attempt across plans; no second payable session during fulfillment delay; existing customer/subscription binding. |
| Renewal and monthly credits | Paid initial/cycle invoice → once-per-period grant; failed/unpaid/proration event | Grant advertised 5 Premium / 20 Pro Creator credits only for a verified paid billing period, without overwriting purchases. |
| Subscription lifecycle / portal | Active ↔ past_due/paused; plan switch; cancellation before/after checkout | Verify actual price and subscription/customer identity; old cancellation cannot revoke another plan; terminal state cannot resurrect. |
| Deposit checkout | Eligible booking → pending checkout → paid; cancellation/decline/refund | Stable checkout; server checks state/amount/owner; receipt and booking update atomic; old refund cannot clear a different payment. |
| Boost checkout | Owned design → pending → promoted; duplicate/concurrent payments/refund | One grant per payment; concurrent distinct grants are additive; refund affects only that grant's remaining promotion. |
| Booking | Pending → confirmed/declined/cancelled; competing clients | Immutable identity/payment fields; reject overlapping active bookings atomically; adjacent/noncompeting slots remain valid. |
| Referrals / rewards | Code created once → claim → two awards; duplicate request/retry | Published referral code stable under races; ownership verification and unique awards; existing atomic referral awards preserved. |
| Account deletion | Existing user → cleanup → deleted; cleanup/DB/sign-out failure | Block active billing/in-flight work; remove only owned resources; preserve transaction rollback; never imply success after failure. |
| Payment return screens | Pending → confirmed or timeout/error | Redirect query parameters are not proof of payment or entitlement; a paid deposit does not imply creator confirmation. |
| Browser/database authorization | anon, authenticated owner, stranger, creator, admin, service_role | Test permitted and forbidden effects, with actual stored values and real PostgreSQL roles. |

Other application areas remain explicitly outside this Phase 3 transaction pass: broad visual/accessibility review, load/abuse testing, shared-board collaboration and complete catalog pagination. Their mention in earlier phases is not verification.

## Reproduced defects and corrections

All rows below are fixed and regression-tested locally. P1 means money, authorization, or transaction integrity; P2 means incorrect user outcome or environment behavior. This is a risk ranking for this review, not a claim about observed customer incidents.

| ID | Risk | Reproduction and corrected outcome |
|---|---|---|
| P3-01 | P1 | Paid subscription invoices granted no monthly credits. Verified paid initial/renewal periods now grant Premium 5 / Pro Creator 20 once per subscription period, in the same transaction as the receipt, without replacing purchased credits. |
| P3-02 | P1 | Completed and async-success events for one boost added duration twice. A PaymentIntent ledger now deduplicates fulfillment across event IDs/types. |
| P3-03 | P1 | Refunding one boost erased newer paid promotion. Each allocation records its time range; refunds remove only that allocation's unused time and preserve later grants. |
| P3-04 | P1 | Refunding an old deposit cleared a newer paid deposit. Reversal now checks the booking's recorded PaymentIntent. |
| P3-05 | P1 | Cancelled and declined bookings could collect deposits. Checkout now checks ownership, state, date, paid state, and server-side amount atomically. |
| P3-06 | P1 | A refund delivered before purchase fulfillment debited unrelated credits. The ledger remembers the refund, then grants the net purchase amount when fulfillment arrives. |
| P3-07 | P2 | Concurrent first referral requests returned different codes and invalidated one. Profile locking publishes one stable code. |
| P3-08 | P1 | Concurrent overlapping bookings both succeeded. Database locking rejects overlapping pending/confirmed appointments; adjacent bookings remain allowed. A restricted busy-slot RPC returns times without exposing client identity/notes. |
| P3-09 | P1 | Account deletion could remove reserved paid generation. Deletion and work reservations now serialize on the account, with a persistent deletion gate and checks for pending billing. |
| P3-10 | P1 | Portal plan changes used stale subscription metadata. Entitlement follows the actual recognized Stripe Price. Environment-specific Price IDs can be configured. |
| P3-11 | P1 | Admin updates accepted negative credits and returned 500 for fractional balances. The API now rejects invalid integers with 400; new database writes also enforce a nonnegative balance. |
| P3-12 | P2 | Visiting a subscription success URL announced activation without fulfillment. An authenticated status endpoint verifies checkout ownership and the stored subscription/customer pair before the page shows success. |
| P3-13 | P2 | A paid deposit claimed the appointment was confirmed while the booking remained pending. The page now distinguishes deposit receipt from the creator's booking decision. |
| P3-14 | P2 | Google login and password recovery always returned to production. Both now return to the initiating origin; managed redirect allowlists still need staging validation. |
| P3-15 | P1 | An owner could delete a design while its boost checkout remained payable. A database reference retains the target until settlement/expiry and closes the checkout/deletion race. |

The initial 15 failures are recorded in ignored `.backups/phase3-before.json`; the additional two authentication failures and one design-deletion failure are in `phase3-auth-before.json` and `phase3-design-delete-before.json`. Reproduction assertions remain enabled in the final suites. No expected-failure annotation or test skip hides these defects.

Additional safeguards tested alongside these fixes include durable credit/boost/deposit checkout attempts across the old five-minute retry window, full-refund-before-fulfillment handling, concurrent distinct boosts, late/duplicate invoice grants, historical subscription ownership, invoice-before-checkout retries, failed/unpaid/prorated invoices, SQL failure rollback, deletion versus new work, and checkout status ownership.

The user selected **automatic full refunds for deposits settling after cancellation or decline**. Two failing cases documented the previously missing behavior before implementation (`.backups/phase3-auto-refund-before.json`; this is the new policy, not an extra original defect category). Fulfillment now commits `refund_required=true` before contacting Stripe, refunds the remaining full amount with a stable per-PaymentIntent key, and records the refund ID/status. Duplicate webhooks resume failed work. Refund history lookup recovers an accepted refund whose database acknowledgment failed, even after idempotency-cache expiry. Pending obligations block account deletion. `refund.created`, `refund.updated` and `refund.failed` refresh the current provider state; older events cannot regress a newer result. An authenticated deposit-status endpoint and the return page expose pending/refunded/needs-attention outcomes without confirming a cancelled appointment. Failed or action-required refunds retain `needs_review=true` for support; no live refunds were issued.

## Verification sequence and evidence

The jobs in `.github/workflows/verify.yml` are independent. Within each job, the local run followed the same order. All commands used Node **24.20.0**, the lockfile from `npm ci`, offline test values, and `CI=1` for the final verification commands. PostgreSQL was **17.10**, native on macOS. **This local run is not the same operating-system environment as `ubuntu-latest`.** Docker is not installed locally. Check [the pull request's current checks](https://github.com/Abbsogol/the-palette/pull/1/checks) for the separate Ubuntu run; local results alone do not satisfy that gate.

| CI job / order | Final local result | Evidence in ignored `.backups/` |
|---|---|---|
| Install: `npm ci` | Passed; audit reported zero vulnerabilities | `phase3-npm-ci.log` |
| Lint: `npm run lint` | Passed, zero errors/warnings | `phase3-final-lint.log` |
| Unit: `npm run test:unit` | 25 passed | `phase3-final-unit.json` |
| PostgreSQL: `npm run test:regressions` | 50 passed | `phase3-native-regressions.json` |
| Same PostgreSQL cluster, next: `npm run test:security` | 101 passed | `phase3-native-security.json` |
| Same PostgreSQL cluster, next: `npm run test:phase3` | 59 passed | `phase3-native-phase3.json` |
| Browser install: `npx playwright install --with-deps chromium webkit` | Passed on macOS; Linux dependencies not verified | `phase3-browser-install.log` |
| Browser build: `npm run build:smoke` | Passed | `phase3-build.log` |
| Browser execution: `npm run test:e2e` | 12 passed: 6 journeys in each of Chromium and mobile WebKit | `phase3-e2e.log` |
| Patch whitespace: `git diff --check` | Passed | Command result |

The native PostgreSQL run creates disposable local databases and applies the captured public-schema fixture plus migrations 001–005. The fixture does not contain customer data. `phase3-native-results.json` records that `anon` and `authenticated` have `rolbypassrls=false`, while `service_role` has `rolbypassrls=true`. Tests assert actual rows, balances, subscription identity, payment receipts, grants, booking state, and rollback after failure; permission tests include successful permitted writes and denied cross-user operations.

Phase 3's 59 checks comprise 46 route/SQL financial-flow checks, 7 payment-page component checks, 2 authentication-redirect component checks, and 4 signature checks using the actual Stripe SDK. Existing Phase 1/2 suites cover onboarding grants, referral awards, generation compensation, private data/storage authorization, and the previous six corrections. Passing these suites is evidence for their stated assertions, not exhaustive correctness.

## Where test doubles differ from real services

| Boundary | Actual verification | Remaining difference |
|---|---|---|
| PostgreSQL | Native concurrent connections, transactions, real roles/RLS, captured public definitions and all local migrations | Managed extensions, Auth/Storage internals, production-scale data, locks and schema drift are not recreated completely. |
| Supabase transport | Application routes call a test adapter that issues real SQL under `service_role`; separate tests issue direct SQL as browser roles | No PostgREST HTTP/JWT integration, schema-cache behavior, realtime delivery, managed Auth sessions, or actual Storage bytes. |
| Stripe | Real signature generation/verification rejects tampering, expired signatures and missing headers; payment routes and ledgers execute | Checkout, invoices, subscriptions and PaymentIntents use SDK doubles. Actual request parameters, account mode, catalog, portal settings, webhook endpoint/API version, asynchronous delivery and rate limits remain unverified. |
| User interface | React components execute success/pending/failure states; production build runs in two browser engines | Browser smoke traffic is restricted to localhost and has no signed-in hosted-service journeys. Component mocks do not prove email/OAuth/card checkout completion. |
| OpenAI, Resend, Storage | Existing tests inject failures and verify local compensation or visible errors | No real provider timeout/process termination, generated/uploaded asset lifecycle, email delivery or account deletion against managed services. |

Contract corrections to older tests include actual Stripe subscription item/Price data instead of metadata-only objects, current deletion RPCs and pending-checkout tables, and explicit single-row SDK results. The former unhandled-webhook test now asserts acknowledgment with no database fulfillment; actual duplicate-payment behavior is covered by SQL-backed cases.

## Remaining critical gaps and blocked work

1. **Isolated managed staging is not established.** Read-only dashboard checks in this pass confirm access to production Supabase `faunikvhoommbebsmevg` (the-palette, main PRODUCTION, no branches or registered migrations) and Vercel `sogol-s-projects1/the-palette`. The nine Vercel variables still apply to both Production and Preview. Do not use those previews for destructive integration tests. No secret values were retrieved or changed. Managed Auth, recovery, OAuth, Storage upload/delete, payment checkout and browser-to-database journeys remain untested.
2. **Stripe sandbox access is blocked.** The Stripe connector returned `UNAUTHORIZED` and requested reauthentication. A verified isolated Stripe account/catalog/webhook and matching staging app are required for test-card purchases, renewals, portal switches, delayed events, refunds and disputes. Billing tax configuration and email/service configuration were not audited.
3. **Automatic late-deposit refunds need managed verification and operations.** The policy decision is resolved and implemented locally. Verify sandbox refund creation/status callbacks, insufficient-balance pending refunds, bank rejection and customer-visible status with actual Stripe/Supabase. Failed/action-required refunds and unrelated duplicate deposits remain recorded for support; an operator queue/alert is not implemented. Confirm webhook event subscriptions include the refund lifecycle events. Stripe retry exhaustion still requires reconciliation of outstanding `refund_required`/`needs_review` records.
4. **Historical reconciliation is required before rollout.** Existing boosts/deposits lack the new allocation ledgers, and old subscription/payment events may already be recorded. Backfill and reconcile ownership, pending sessions, previously paid invoice periods and active boost allocations against Stripe before enabling replay. Otherwise old replayed events can be skipped or grant twice. No historical grants/debits or customer data were changed. Audit existing negative credit balances before validating the migration's initially `NOT VALID` constraint.
5. **Recovery and exceptional billing paths remain unverified.** Process termination after reserving a generation has no tested recovery worker; identical paid-generation submissions across lost responses need an intent-level idempotency review. Disputes and subscription-invoice refunds have no new automated credit-reversal policy in this pass. Multi-line/paginated or unrecognized-price invoices deliberately fail for retry/reconciliation instead of guessing a grant. Deleted legacy payment targets also need reconciliation. These paths prevent an end-to-end completion claim.
6. **CI and deployment remain separate gates.** Require passing GitHub Actions checks for the exact published head; local macOS browser/native-PG results cannot certify the GitHub runner. Migration/restore rehearsal on managed staging, Storage backup coverage, historical object cleanup, scheduler configuration, and the Phase 1/2 rollout gates remain open even when CI passes.

Not tested in this pass: exhaustive signup with every managed email-confirmation setting; real declined cards/3DS/bank-payment settlement; full checkout UI through webhook to stored balance; live subscription renewal time travel; real Storage deletion rollback/races; reminder duplicate/retry delivery; sustained load/abuse; every timezone/DST booking edge; every UI/accessibility path. The matrix above records risk and local coverage, not a blanket assertion that every state transition has been proven.

## Rollout order

Preserve the existing Phase 1/2 recovery gates. Establish synthetic staging and a complete managed schema baseline first. Rehearse migrations 001, 002, 003, **004 (credit refund ordering)** and **005 (Phase 3 ledgers/locks)** in order against that baseline. Configure isolated Stripe Price IDs and callbacks, reconcile legacy payment identities/receipts, then release the matching application and webhook routes together. New routes depend on these migrations and must not be deployed first against the current production schema. Run required remote CI and the managed integration matrix before any production release decision.

Implementation sources checked: [Stripe subscription webhooks](https://docs.stripe.com/billing/subscriptions/webhooks), [invoice object](https://docs.stripe.com/api/invoices/object), [invoice line item object](https://docs.stripe.com/api/invoice-line-item/object), [refund creation](https://docs.stripe.com/api/refunds/create), [refund states and failures](https://docs.stripe.com/refunds), and the installed Stripe 22.6.2 types. These establish API contracts; they do not verify this account's configuration.
