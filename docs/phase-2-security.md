# Phase 2 — authorization and input safety

Status: implemented and verified locally on top of `c50829a`. Not published, migrated, or deployed. Phase 1 staging/restore prerequisites are still open, so production closure is pending. No production RPCs, customer transactions, credentials, or Storage objects were modified.

**Combined review remediation:** all six subsequent findings are now fixed locally. Current verification is 172 automated tests and 10 browser checks passing, including 50 regression + 99 security checks on the same native PostgreSQL cluster in CI order. See [fixes, evidence and migration 003 rollout requirements](six-issue-fixes.md). The counts below record the earlier Phase 2 baseline.

**Later verification:** [Phase 3](phase-3-review.md) supersedes those counts and adds migrations 004/005, booking conflict protection, payment/refund ledgers, monthly credits and further deletion guards. The remainder of this document records the Phase 2 scope at that time.

## Scope and evidence

Reviewed the API authentication boundary, privileged Storage copies and uploads, and the captured public database functions, grants, triggers and policies. The earlier image dependency/credit RPC fix is retained, not counted as a new discovery. All 22 session-protected API routes reject anonymous requests before privileged database operations; the other two endpoints use Stripe signatures or the scheduler secret.

The first isolated SQL run applied the prior entitlement fix to a reconstruction of the September 26 catalog: 10 new checks failed and two existing protections passed. These were synthetic local reproductions, not production probes. Additional cases cover successful authorized behavior, concurrency, service-role generation, and UI handling of private images.

| Boundary | Correction |
|---|---|
| Credit RPCs and function privileges | Keep mutations service-only, reject nonpositive credit grants, pin search paths, remove API execution of trigger functions, and prevent browser creation of shadow objects. The earlier migration already protects `decrement_credits_by`. |
| Profile and generation ownership | Make profile writes API-only; retain the masking profile view. Existing direct profile mutation probes were already denied by deployed grants/RLS. Prevent browser inserts/updates to generation provenance, image paths and retry flags. |
| Privileged image copying | Verify the authenticated owner's canonical object prefix before downloading. Reject foreign, encoded and traversal paths. |
| Draft confidentiality | New AI drafts retain private references; explicit publication creates the public copy. Owner-facing cards resolve signed images at display time. Board covers persist stable references without signed tokens. |
| Messaging | Prevent participant replacement and message rewriting. Only recipients mark messages read. Enforce blocks and message permissions in the database. |
| Booking authorization | Protect participants, service, times, payment and reminder fields; restrict client/creator status transitions. New bookings must use the chosen creator's active service and duration. This does not yet prevent slot overlap. |
| Reviews and invitations | Require the actual board owner for invitations; require the client's confirmed past booking for a review; preserve review identity during edits. |
| Design visibility and moderation | Child metadata follows parent visibility. Inserts into reactions/saves/boards require a visible design. Enforce creator upload eligibility and protect curation, promotion, source and count fields. |
| Engagement and notifications | Update counters and create notifications in the underlying row transaction. Remove independent browser counter/notification writes and revoke their direct access. |
| Upload quota | Reserve the weekly slot during design insertion under a profile lock; remove browser resets and replayable finalize increments. |
| Scheduler and inputs | Missing `CRON_SECRET` returns 503 before any work; invalid credentials return 401. Challenge and design photos share byte validation, pixel/size limits and WebP re-encoding. Reject malformed privacy settings. Grant onboarding credits once with an atomic additive update preserving purchases. |

## Original Phase 2 verification (before combined-review remediation)

- Full Vitest suite: 135 tests passed, including the original 73 checks and 62 Phase 2 checks.
- Phase 2 suite: 62 passed on native PostgreSQL 17.10; 19 exercise database permissions/transactions using actual captured public definitions and synthetic rows.
- Production smoke build passed; all 10 Chromium/mobile WebKit browser smoke checks passed.
- ESLint passed with zero errors/warnings; `git diff --check` passed.
- CI's existing required `regressions` job now also runs `npm run test:security` against PostgreSQL 17. Remote CI has not run these unpushed changes.

`tests/fixtures/security-baseline.sql` contains the captured public schema definitions and policies, with simplified Supabase Auth and Storage stand-ins. It has no customer data. This gives stronger local RLS evidence than SDK doubles, but is not a complete managed Supabase restore or a live Storage/OAuth/payment test. The schema-only fixture is not a deployment baseline migration.

## Rollout and remaining evidence

1. Finish the isolated staging/restore work from Phase 1. Compare the current target schema against the captured definitions and rehearse all migrations in order: `202609260001_atomic_entitlements.sql`, `202609260002_authorization.sql`, then `202609260003_review_fixes.sql`. Reconcile historical Stripe identities before deploying the new subscription handler as described in the remediation report.
2. Rehearse a coordinated database/app cutover. Old browser counter/notification writes will be denied after the new migration, and the old server finalize handler can still double-count uploads until replaced. Quiesce writes during the cutover; do not deploy either side independently and call the release verified. Reconciliation locks design/engagement tables and must be timed on staging. Preserve ledgers and do not casually restore the old insecure grants on rollback.
3. Configure a distinct scheduler secret per environment. Verify scheduler requests and reminder delivery in staging. The repository includes the fail-closed behavior; the missing hosted secret has not been created.
4. Configure Storage bucket size/MIME restrictions through the Storage API/dashboard and verify them against synthetic uploads. The captured bucket configuration has no limits. Recheck avatar/story/admin upload formats before selecting the shared bucket allowlist. Signature validation currently covers server design/challenge uploads; a MIME allowlist alone does not validate bytes.
5. Audit legacy unpublished AI designs whose files were previously copied to the public `designs` bucket. Prepare an object/reference inventory, restore their private references, and remove only confirmed orphan public copies through the Storage API after recovery coverage is established. Public assets cannot be made private just by changing a database row. Existing signed cover tokens should also be removed from stored references. No legacy objects were deleted by this change.
6. Verify anonymous/owner/other-user/admin flows on managed staging, including Storage and authentication redirects. Confirm notification generation and no duplicate counting with a stale browser client. Then obtain the production release decision; this local phase is not a claim of deployed protection.

Remaining application phases still include slot-overlap prevention, payment/subscription lifecycle and reminder retry guarantees, shared-board behavior, broader pagination/privacy behavior, and abuse/rate-limit controls. These are not certified by the security tests above.

Implementation references: [PostgreSQL function security](https://www.postgresql.org/docs/17/sql-createfunction.html), [schema/search-path trust](https://www.postgresql.org/docs/17/ddl-schemas.html), [Supabase bucket access and limits](https://supabase.com/docs/guides/storage/buckets/fundamentals).
