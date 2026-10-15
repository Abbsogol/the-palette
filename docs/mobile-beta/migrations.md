# Additive migrations and rollback

The new migration files are 016–022. On 27 September 2026, the schema-only baseline and all 22 migrations passed a local rehearsal using actual managed Auth/Storage schemas, then were applied atomically to the empty isolated beta project `atjwbdrvgljddedtwoqo`. No live application rows were copied. All 66 public tables have RLS enabled. The local SQL test fixture is a separate, deliberately smaller catalog.

`supabase/bootstrap/20260927_legacy_schema.sql` is only for an empty isolated project. It captures the legacy public schema and application-owned Auth trigger, Storage policies/buckets and realtime publication. Apply it with all migrations in the same controlled bootstrap transaction before allowing client traffic; its legacy grants are hardened by the migrations. Never apply it over an existing application schema.

| Migration | Changes |
|---|---|
| 016 | Booking price/deposit/location snapshots, atomic cancellation and refund obligation, immutable checkout return context, deletion guards |
| 017 | Account-owned push registrations, leased notification outbox, participant-only hidden conversations, authenticated reports |
| 018 | Private message image/design references, private Storage policies and account byte-cleanup discovery |
| 019 | Unique collection/design associations and cascade cleanup; identical duplicate associations are consolidated |
| 020 | Provider-aware catalog, immutable store owners/transactions, event reconciliation leases, server entitlements, purchase intents, cross-channel/deletion guards, live expiry quota enforcement |
| 021 | Staged media cleanup, exclusive delete claims and reference-adoption locks for messages and portfolio images |
| 022 | Remove client administrative table privileges, including TRUNCATE which bypasses RLS; harden future grants while retaining policy-controlled CRUD |

Each file is transactional. A failure rolls back that file, not previously committed migration files. Capture the full schema, grants, policies, functions and migration history before the staging rehearsal. Save a staging-only database snapshot. Verify permissions under anon/authenticated/server roles, not only the service key.

## Rollback before any beta transactions

Stop workers and new mobile traffic. Restore the staging snapshot and original migration history, or recreate the disposable staging project from the verified baseline. Revert the application release to the matching commit. Repeat Auth/Storage/RLS smoke checks. Do not run an invented generic DROP script against an existing Supabase project; migration019 consolidation and financial history need a real snapshot to reverse accurately.

## Rollback after beta financial activity

Do not drop the new ledgers or restore an old snapshot over payments that actually occurred. Disable new purchases, generation/booking mutations and new push registrations. Continue processing verified provider events and existing refund obligations. Export immutable receipts/events and reconcile all pending work. Keep the additive tables, RLS, cancellation/deletion safeguards and permanent purchase ownership bindings.

Deploy a reviewed forward repair, preserving transaction identities. An old web-only application can coexist with the additive schema, but only after testing it against the retained guards. Never remove the wrappers just to make deletion succeed: unresolved deposits and purchases must settle or be reconciled first. Restore schema/data from a snapshot only for a disposable environment with no external financial activity.

Storage cleanup is external to SQL transactions. Retain the durable cleanup queue and retry failed deletions. A rollback must reconcile actual object existence; reverting a database row cannot restore already-deleted bytes.
