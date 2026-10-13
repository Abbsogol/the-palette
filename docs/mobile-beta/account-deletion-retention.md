# Permanent account closure and limited retention

Local implementation, 29 September 2026. Operator confirmed Dubai DET registration (Dubai mainland), WeActivate Project Management Services LLC; privacy contact contact@laque.app. This is implementation documentation and a policy draft, not a legal compliance certification.

## Legal basis for the policy change

No verified blanket rule requires preserving every user's account for two years merely in case a future request arrives. The UAE federal PDPL's purpose/retention requirements and erasure exceptions require a necessary, specific basis. Applicable corporate-tax records must be retained for at least seven years after the end of the relevant tax period; that rule is not a seven-year archive of all messages, photos, medical preferences or profile content.

Primary references checked:

- [Federal Decree-Law 45 of 2021, Personal Data Protection](https://www.uaelegislation.gov.ae/en/legislations/1972/download): Article 5(7), retention after the processing purpose; Article 15, erasure and exceptions including legal claims / other legal requirements. Official indexed text was available; direct PDF retrieval was blocked by the site during review.
- [UAE government privacy overview](https://u.ae/en/about-the-uae/digital-uae/data/data-protection-laws).
- [Federal Tax Authority, 28 August 2025](https://tax.gov.ae/en/media.centre/news/pr.28082025.aspx): corporate-tax documents for at least seven years after the end of the relevant tax period.

A UAE lawyer/accountant must approve the applicable record categories, fiscal-period end dates, further obligations and actual retention schedule before this policy is treated as operational. The code does not guess the company's tax year. The source privacy policy is updated but this version is not deployed.

## Closure versus physical erasure

1. Authenticated owner posts `/api/delete-account`. No target ID supplied by the client is accepted.
2. `close_account` locks the owner profile. In one transaction it commits a permanent tombstone, masks personal profile fields, hides published designs and booking services, cancels pending/future bookings, creates existing durable refund obligations, and disconnects push/calendar registrations. Retry is idempotent. Closed participants cannot create or confirm appointments.
3. Closed-account table policies deny stale access JWTs. Closed profiles and content are excluded from the public views/reads. API authentication already rejects `deletion_started_at`. Service-role settlement retains access. Previously shared/public cached bytes cannot be recalled instantly.
4. Response is `202`, `closed: true`, `restorable: false`, `cleanup: pending`. The immediate Auth ban is best effort after commit. User-visible closure does not wait for Stripe or Storage.
5. The existing authenticated mobile-jobs worker leases up to three cleanup jobs. It bans Auth, removes owned bytes through Storage, performs irreversible Supabase Auth soft deletion (retains the UUID for financial relationships), and erases ordinary relational content. Auth/Storage errors retry. The old guarded physical purge remains responsible for final financial safety and final deletion.
6. Payment checkouts, active generation, unsettled refunds, historical subscriptions and record holds can defer physical removal; they do not permit reopening. Once all obligations and documented retention checks finish, final deletion removes the remaining account/financial rows. Legal evidence has no cascading account foreign key and expires independently.

The worker retains the prior refund/calendar/push processing order, then performs cleanup. `CRON_SECRET` protects `/api/mobile/process-jobs`. Every retry update is scoped to the leased claim token; a crashed lease becomes claimable after five minutes. No new hosting service is introduced. Deployment/scheduler behavior for this change is not yet verified.

## Restricted records and operational decisions

- `account_retention_holds`: service-only, financial category, specific basis, `retain_until`, and `review_at`. Access is denied to owner, stranger and anonymous roles.
- If an account has credit/store/subscription grants or appointment/boost payment records, hard deletion requires a documented financial retention decision. Creators' paid appointments count even though the client owns the payment row. Undated decisions are deliberately not invented; absence of a decision blocks hard purge for operator review.
- An active hold blocks hard deletion. A documented expired financial hold allows re-evaluation of the existing billing/settlement guards. The authorized operator must update holds for any later transaction or obligation. Review outstanding queue records and due review dates through controlled administration; no new support/admin retention dashboard is included.
- `account_legal_records`: service-only selected evidence, case reference, basis, explicit scope, expiry and review date. It is not populated by normal account deletion. Before erasing specific material subject to a genuine preservation duty, an authorized operator must preserve only that material here (and, for any required external evidence, in an approved restricted evidence store). No blanket message/photo archive is created.
- The worker purges up to 1,000 expired legal-record entries per invocation. A valid renewed obligation must be documented before expiry; `review_at` is a review deadline, not permission to retain forever. Evidence table access requires service credentials; least-privilege admin tooling, operational access logging and the business review process remain deployment responsibilities.
- Provider backups, independent recipient copies and payment-provider records have separate lifecycles. None supplies an account restoration feature.

## Staging rollout and rollback

Rehearse migration `202609290024_account_closure.sql` against a copy of the approved baseline after migration 023. Take a recovery backup and verify the `profiles` masked view contract, all RLS policies, trigger and function grants. Apply schema before deploying the API/worker and mobile version. Publish the updated policy before enabling the new behavior for users.

Use synthetic customer and creator accounts: close with no obligations; close with a paid future appointment; settle a deposit after closure; interrupt Storage/Auth cleanup; retry after the lease; verify stranger, old JWT and service-role access; inspect actual object bytes and financial records before/after; exercise retention review/expiry and selected legal evidence. Confirm closure cannot be reversed through any product action.

Rollback is a forward repair after any closure: keep tombstones, masking, access-denial policies, refund obligations and retention rows. Roll back affected UI/worker code if needed, pause only the failing cleanup execution, and continue refund processing. Do not roll back to the old blocking deletion endpoint or drop the guards/retention tables on a populated database. Restore backups only for controlled investigation/repair with closure tombstones reapplied before serving traffic, never to restore deleted user accounts. Only a disposable staging rehearsal database may be discarded and recreated from the previous baseline; there is no general destructive production down-migration.

## Evidence and limits

Locked installs, lint, mobile type-check, 62 unit tests, 361 mobile tests, 645 native PostgreSQL/backend checks, 20 Chromium/WebKit tests, production smoke build and connected iOS/Android/web bundle exports passed (1,088 automated tests total). See `secondary-screens.md` for the breakdown. Logs and screenshots are local under `.backups/secondary-*`. Regression data used local PostgreSQL 17.10 and synthetic fixtures; provider boundaries use mocks. No real account, payment, refund or calendar was modified. Real Supabase Auth soft-erasure/refresh invalidation, Storage bytes, provider backups, hosted policy publication, worker scheduling, retention operations and physical devices remain integration gates. Phase 1 remains open.
