# Production schema rehearsal (F05)

15 October 2026. **Rehearsal complete against the production schema inventory captured today.** No hosted database was changed.

## What was actually rehearsed

The runner starts from `supabase/bootstrap/20260927_legacy_schema.sql`, the schema-only **original production** export from 27 September. Auth and Storage definitions come from the separately captured empty managed beta schema in `tests/fixtures/supabase-managed-schema.sql`. This is deliberately different from the smaller `security-baseline.sql` unit-test fixture. The original production project was inspected directly through its SQL editor on 15 October. All 77 relations and 43 functions were compared, including owners, view options, column order/types, constraints, indexes, RLS, policy/trigger/function hashes, ACLs, default privileges and publication tables. A disposable-only alignment script reproduces six relation privilege differences, three missing managed-role default ACL entries and removes one beta-only unregistered helper. The runner fails before migrations if any baseline metadata differs. It ignores ACL/catalog row ordering, never privilege contents or column order. The fixture headers record provenance and original checksums; the report hashes every input and migration.

Native PostgreSQL **17.10** (production is **17.6**), real independent connections, `uuid-ossp`, `pgcrypto`, actual Auth/Storage catalog definitions and RLS were used locally. There are no real user rows, tokens or payment credentials. Supabase's Auth, Storage HTTP, PostgREST, object bytes, installed phones and payment networks are outside this SQL rehearsal. Managed-role superuser privileges are local scaffolding, not deployment grants. Hosted `pg_stat_statements` and `supabase_vault` are not installed locally; none of the 42 application migrations uses them. This is a schema and SQL contract rehearsal, not managed-service emulation.

`npm run release:rehearse-db` requires an explicitly supplied loopback `DATABASE_TEST_URL` naming `/palette_test`, PostgreSQL 17 and matching `pg_dump`/`pg_restore`. Remote hosts, other databases and connection query overrides are rejected. It creates randomly named databases and always drops its own databases. It never bootstraps or migrates the control database. Output is private, ignored `scripts/output/migration-rehearsal-*/`; do not commit database archives. `REHEARSAL_PG_DUMP` and `REHEARSAL_PG_RESTORE` can select the installed PG17 tool paths.

The CI `migration-rehearsal` job uses a disposable PG17 service and tools inside that same image. Its artifact contains only the report, never database archives. The migration journal is `release_ops.migrations`, unavailable to ordinary app roles. It records filename, SHA-256, application time and duration. Each DDL file and journal insertion commit in one transaction. A session advisory lock serializes runners. Unchanged reruns skip completed migrations; missing, reordered or changed history fails closed. Files 032, 033 and 039 are wrapped transactionally by the runner even though they have no transaction envelope. Historical SQL files are unchanged.

## Checks

1. Restore the historical public schema and managed catalog. Create three synthetic verified accounts with **37, 0 and 19** existing credits. Preserve identities, names, onboarding completion and all three balances through migrations 001–026.
2. Add a real ledger-backed synthetic 30-credit purchase. Close one account irreversibly and retain its pending financial checkout. Back up checkpoint 026.
3. Race two migration connections through 027–042. Exactly one applies each file. Check balances, the existing payment receipt, closed account and financial obligation remain unchanged. Upgrade the restored checkpoint and compare its resulting schema.
4. Rerun all 42 migrations without reapplying any. Reject changed checksums and missing journal history.
5. Inject an intentionally failing synthetic 043 that changes a balance and creates a table. Verify rollback removes both changes and leaves no journal row. Correct that **unapplied** test file, then demonstrate an additive synthetic 044 forward repair. These two probe migrations exist only in the disposable database; they are not release migrations.
6. Verify anonymous access denied, authenticated profile/banner contract available, raw email/balance and staff/journal tables inaccessible, closed users hidden, stale closed-user reads empty and pending-payment deletion blocked.
7. Replay the pre-upgrade purchase concurrently without another credit grant. Race duplicate generation reservations/releases and duplicate reasoned credit corrections. Verify one reservation debit, one release and one correction row.
8. Execute complete-profile/age/privacy RPC and replay it. Verify the existing one-time legacy three-credit behavior and privately stored health notes. Do not silently change that legacy entitlement behavior as part of a schema rehearsal. All public tables retain RLS.
9. Create and restore **three custom-format backups**: legacy, checkpoint 026 and final. Compare restored final profile rows, closure, checkout, receipt, health, allowance, reservation, correction and journal records exactly. Compare catalog/view/RLS definitions. Restore preserves owners and grants. A successful archive command alone is not restore proof.

Backup restoration follows [PostgreSQL's custom archive workflow](https://www.postgresql.org/docs/17/app-pgdump.html). Migration serialization uses [session advisory locks](https://www.postgresql.org/docs/17/explicit-locking.html#ADVISORY-LOCKS). SQL backups include Storage metadata, **not uploaded object bytes or external provider state**. These local synthetic archives are not a certified production disaster-recovery backup or a cluster-role backup.

## Production baseline verified and rollout conditions

The current original production metadata was read successfully at **09:23 UTC on 15 October 2026** from project `faunikvhoommbebsmevg`, not isolated beta `atjwbdrvgljddedtwoqo`. No application rows or credentials were retrieved. The captured inventory has no Supabase migration history table and matches the reconstructed pre-001 catalog, including routine definitions. It is checked in as `supabase/bootstrap/20261015_production_inventory.json`, with its checksum in the report. No production DDL, balance changes, account actions or migrations were executed.

Production activation is a separate operation. At rollout:

- Repeat `supabase/operations/production-schema-inventory.sql` read-only to detect drift since the verified capture. It returns no user records or function bodies. If a migration history table has appeared, inspect its recorded versions rather than assuming the old starting point.
- Resolve every unexpected difference and establish the exact existing migration prefix. If the schema has drifted since 27 September, obtain a new **schema-only** export, review it privately, rehearse the remaining sequence on a disposable copy and repeat these checks. Never run the empty-project bootstrap over production. Never bulk-mark migration history as applied just to bypass a failure.
- Operations must take an encrypted production backup with a verified recovery point and authorized retention/access controls, and prove restoration into an isolated target. Include Auth, Storage metadata, roles/configuration and a separate object-byte recovery plan. No real data dump belongs in Git or public CI artifacts.
- Tie migration report, app/backend commit and deployed contract/version handshake together. Validate hosted PostgREST schema reload, service-role RPC permissions, RLS, scheduled financial/media workers and connected app reads before allowing new writes. Existing full API/native suites are additional evidence, not proof of the production database's current state.

## Forward repair and deployment stop rules

1. Fence **new** purchases, generation and bookings during a schema incident. Keep verified provider events, cancellation and refund reconciliation running with their compatible existing schema. Record exact last committed migration and matching app revision.
2. Let a failed migration roll back. Prior successful files remain committed; do not edit their bytes, delete their journal rows or replay destructive bootstrap SQL. Diagnose SQLSTATE and actual schema under controlled access.
3. If an unapplied migration failed, correct the proposed unapplied file after review and rehearse from the backup. If a previously committed migration needs changing, append a new forward repair instead. Include catalog/data assertions and replay/concurrency coverage before resuming.
4. Never restore an old snapshot over financial activity that occurred after it. Preserve receipts, purchase ownership, refunds, closure tombstones and leased cleanup jobs. Reconcile any separately executed Storage deletion; a restored SQL pointer cannot recreate deleted bytes.
5. Resume compatible reads first, then background recovery, then new actions after invariants pass. Preserve users' closure state. This process does not add restoration of deleted accounts or enable payments/prizes/integrations.

The runner is intentionally restricted to disposable local rehearsal. Production activation remains a separate reviewed operation, not a command-line override.

## Additional validation

All **1,036 backend tests** passed on native PostgreSQL with no skips. The first highly parallel full-suite run exposed a shared-role fixture setup race; the entitlement helper now uses the same control-database advisory lock as security fixtures. The successful full-suite rerun used four test workers with original assertions and timeouts unchanged. Lint has zero errors (10 existing warnings), and the Next smoke build passes. The repeatable CI job independently rechecks the captured production baseline, migration sequence and backup restores. No mobile runtime code was changed by F05.
