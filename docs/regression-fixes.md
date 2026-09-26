# Regression fixes — September 26, 2026

The ten failures recorded against main are fixed in the local review branch. The original behavioral assertions remain enabled. No production database migration or deployment has been performed.

| Case | Cause and correction |
|---|---|
| REG-01 | The upload trusted the browser MIME label. Check file signatures before decoding, enforce format agreement and a 40 MP limit, and resize accepted JPEG/PNG/WebP/GIF to WebP. Update direct and nested image dependencies. |
| REG-02 | The debit happened after generation and could silently affect zero rows. Reserve the credit atomically before OpenAI. Commit the image record and reservation completion together. |
| REG-03 | Each partial refund debited the entire cumulative amount again. A locked payment ledger applies only the additional reversal and handles duplicate, older, concurrent, and pre-fulfillment refunds. |
| REG-04 | Checkout did not check existing subscriptions. Check the profile and known Stripe customer's subscriptions, reuse that customer, and offer billing management in the upgrade page. |
| REG-05 | Reference URLs were advertised but never sent to the image model. Reject this mode before reservation and remove the picker; text generation remains available. |
| REG-06 | The outer exception handler missed free-retry compensation. A finally block releases reservations, including network, malformed response, storage, and persistence failures; release is idempotent. |
| REG-07 | Only the component's own button loaded boards. Load when either opening mechanism becomes active and authentication resolves; cancel stale loads. Derive the saved indicator from saved boards. |
| REG-08 | A board-save request could unpublish an existing design. Draft requests preserve its state; explicit publication only promotes it. Concurrent insert recovery returns the actual winning design. |
| REG-09 | Two equal balances were mistaken for payment confirmation. Poll an authenticated endpoint that checks session ownership and the durable fulfillment receipt. Pending/outage states never announce success. |
| REG-10 | A referral claim committed before the reward inserts. Commit the claim and both awards in one transaction, with repeat-safe repair of historical incomplete claims. |

Lint fixes include stable hook dependencies, callbacks declared before use, derived state, relative-time updates driven by browser clock events, initial search parameters, image alternatives, internal routing, and JSX escaping. No lint rules were disabled.

## Verification

- `npm test`: 73 passed (23 unit and 50 regression/integration/component checks), including all ten original failing scenarios.
- Native PostgreSQL run: all 50 regression checks passed, including 13 SQL transaction/permission cases.
- Playwright: 10 passed across Chromium and mobile WebKit. `npm ci`, production smoke build, and `git diff --check` passed.
- Vitest includes route/component tests and executable PostgreSQL transaction tests. Local default uses PGlite; the GitHub regression job uses a disposable PostgreSQL 17 service and a connection pool for concurrency.
- Native PostgreSQL 17.10 was also run locally against synthetic data. The last-credit test deliberately delays writes to expose overlapping requests.
- The transaction tests cover rollback of a second referral award, payment receipt rollback, duplicate/reordered refunds, refund-before-checkout, completed-reservation protection, and service-only RPC permissions.
- Production smoke build and Chromium/mobile WebKit checks use fake service settings; these do not prove live payment or storage connectivity.
- `npm run lint -- --max-warnings=0` passes. The dependency audit reports zero vulnerabilities at verification time.

## Deployment order and remaining operational work

1. Rehearse `supabase/migrations/202609260001_atomic_entitlements.sql` on the verified isolated staging schema, then apply it before the dependent application deployment. It adds reservation/payment ledgers and transaction RPCs; it is not a replacement production schema baseline.
2. Confirm the Stripe endpoint receives both `checkout.session.completed` and `checkout.session.async_payment_succeeded`, plus existing subscription/refund events. Checkout now uses the dashboard's payment methods. Rehearse payment, delayed payment, refund, and subscription management in Stripe test mode.
3. Deploy the application only after migration and staging verification. Preserve the new financial ledgers on rollback. Do not replay historical successful purchases to manufacture receipts: legacy processed event IDs remain deduplicated. An older checkout without a new receipt stays unconfirmed in the UI until separately reconciled.
4. Monitor `generation_reservations` left in `reserved` status after a terminated request. The route's finally block covers thrown failures, but cannot execute after a killed process or total database outage. An operator must inspect stale requests, then use the idempotent `release_generation` RPC where appropriate. Completed reservations cannot be released. Orphaned storage uploads may also require cleanup.

The fixture schema contains only the inspected dependencies and synthetic identities, not all production RLS policies or a production restore. Full staging/restore verification and the other release issues remain open. GitHub publication is pending authenticated Git or restored integration write access; remote CI has not run these local changes.

Implementation references: [Stripe webhook behavior](https://docs.stripe.com/webhooks), [Stripe Checkout fulfillment](https://docs.stripe.com/checkout/fulfillment), [Sharp input limits](https://sharp.pixelplumbing.com/api-constructor/), and [PGlite API](https://pglite.dev/docs/api).
