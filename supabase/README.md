# Database inventory captured; replayable baseline pending

On September 26, 2026, the verified production project's catalog was captured through a read-only SQL transaction. It contains 39 public tables, one public view, policies, constraints, functions, grants, triggers, and extension metadata. Raw evidence is kept in ignored `.backups/`; no application rows were exported. A complete replayable schema export and isolated restore are still pending. This directory contains no fabricated baseline migration.

`inspection/catalog.sql` reads PostgreSQL metadata into one JSON result. Run through an authorized connection to the verified project. Its result is an inventory, not a backup, complete schema export, or runtime permission test. Inspect function bodies for secrets before sharing or committing output; keep security findings private until remediated.

See `docs/environment-and-recovery.md` for project identification, isolated integration tests, and restore requirements. Production rows must not become ordinary CI fixtures.

`migrations/202609260001_atomic_entitlements.sql` is an additive fix against the inspected schema, not a fabricated baseline. Apply it before deploying the matching generation/referral/payment routes, after isolated staging rehearsal. `tests/fixtures/entitlement-schema.sql` supplies only the dependency tables for synthetic transaction tests. See `docs/regression-fixes.md` for rollout and reconciliation notes.

`npm run test:regressions` uses an in-memory PostgreSQL engine locally. To exercise native concurrent connections, supply `DATABASE_TEST_URL` for a fresh local PostgreSQL database named `palette_test`; only loopback hosts are accepted. Tests create their own schema and truncate their synthetic data. GitHub Actions provisions this disposable database automatically.

Phase 4 adds migrations 006–008 for signup defaults, membership reads, generation leases/intent claims, reminder outbox delivery, refunded credit holds and terminal payment checkouts. Rehearse all migrations 001–008 in order against a complete managed baseline before deploying the matching application. Historical holds/refunds require reconciliation; do not infer them from new ledger defaults. See [the Phase 4 report](../docs/phase-4-review.md) for coordination and outstanding recovery gates.
