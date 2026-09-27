# Environment, schema, and recovery runbook

## Establish project identity

The source repository is `Abbsogol/the-palette`; the chosen release base is `main`. Vercel's production dashboard confirms Ready deployment `3jsKyXyJ8K6HGzo9cPbaPNkTegar`, main commit `22ec32f`, in `sogol-s-projects1/the-palette`, serving `laque.app` and `www.laque.app`.

The production frontend bundle references Supabase project `faunikvhoommbebsmevg`, matching **the-palette** in **Abbsogol's Org**, Ireland (`eu-west-1`), PostgreSQL 17.6. Vercel's nine project variables are secret and assigned to both Production and Preview; there are no linked shared variables. Therefore preview isolation has not been established. Variable values were not retrieved. Stripe mode remains unverified.

Record project references, regions, deployed commit, domains, Stripe mode, configuration names, backup coverage/retention, migration baseline, and restore results in the Phase 1 status document. Do not record secret values. Current project-variable names: `RESEND_API_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL`, `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`. `CRON_SECRET` is absent from project and linked shared variables.

## Capture the database baseline

1. Export schema through an authorized connection to the verified project. Do not reset, recreate, or push migrations into production during discovery.
2. Inventory tables/views, constraints, RLS, custom functions/grants, triggers, storage policies, and database jobs. `supabase/inspection/catalog.sql` captured the current inventory, not a full dump. No migration history is registered in the dashboard. Installed extensions do not include pg_cron, pg_net, or dblink; external schedulers still need separate inspection.
3. Store raw exports in ignored `.backups/`. Inspect function bodies and connection details for secrets before committing a sanitized schema baseline.
4. Compare actual definitions with the code's tables and ten RPCs. Do not invent policies or mark inferred definitions as deployed truth.
5. Rehearse baseline application on an isolated database before marking a baseline migration as already applied to an existing database.

## Isolated staging

Use a separate Supabase project/database, synthetic users/assets, Stripe test-mode products/customers/webhooks, a staging app URL, and test-only email recipients. Keep privileged credentials server-side; configure OAuth and password-recovery redirects for the staging origin.

Record the selected project/plan and any cost before provisioning hosted resources. No paid or staging resource has been provisioned. The dashboard quotes an additional $9.68/month compute plus usage for a separate recovery clone; approval is pending. A recovery clone copies production records and must not be treated as synthetic staging. A preview URL is not proof of isolation: inspect its configuration and database target.

Import the sanitized schema and seed synthetic user, creator, salon, and admin accounts. Add integration scenarios for credit concurrency, referral transactions, overlapping bookings, private boards/drafts, messages, and storage ownership. Run only against an explicitly verified staging target. The local test doubles do not validate RLS.

## Backup and restore rehearsal

Observed September 26: scheduled physical backups completed daily September 19–26; the latest is September 26 at 07:08:04 UTC. PITR is not enabled. Supabase database backups exclude uploaded Storage objects. A restore-to-new-project confirmation was inspected but not submitted. No restore or recovery time has been verified. See [Supabase backup coverage](https://supabase.com/docs/guides/platform/backups) and [clone limitations](https://supabase.com/docs/guides/platform/clone-project).

1. Verify actual backup capabilities, latest usable backup, retention, and whether point-in-time recovery is enabled. Do not assume these are available.
2. Account separately for database contents, authentication configuration/data, uploaded storage objects, and external payment records. A schema export is not a data backup.
3. Restore into an isolated target, never over running production. Restrict access to copied production records; keep them out of Git and ordinary CI fixtures.
4. Verify counts, ownership, balances, subscription IDs, bookings, and required assets without exposing private rows in reports.
5. Record measured recovery time, excluded assets, target, and result. A planned restore is not a verified restore.

## Release/recovery order

Apply compatible additive database changes before dependent app changes. Retain financial ledgers and webhook fulfillment during recovery. Disable affected purchase/generation entry points if integrity fails. Do not overwrite new customer transactions with an old snapshot as a routine app rollback.

Phase 1 is complete only when both local setup and infrastructure checks have evidence. If access remains blocked, continue independent work and keep infrastructure explicitly unverified.
