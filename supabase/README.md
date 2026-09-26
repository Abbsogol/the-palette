# Database inventory captured; replayable baseline pending

On September 26, 2026, the verified production project's catalog was captured through a read-only SQL transaction. It contains 39 public tables, one public view, policies, constraints, functions, grants, triggers, and extension metadata. Raw evidence is kept in ignored `.backups/`; no application rows were exported. A complete replayable schema export and isolated restore are still pending. This directory contains no fabricated baseline migration.

`inspection/catalog.sql` reads PostgreSQL metadata into one JSON result. Run through an authorized connection to the verified project. Its result is an inventory, not a backup, complete schema export, or runtime permission test. Inspect function bodies for secrets before sharing or committing output; keep security findings private until remediated.

See `docs/environment-and-recovery.md` for project identification, isolated integration tests, and restore requirements. Production rows must not become ordinary CI fixtures.
