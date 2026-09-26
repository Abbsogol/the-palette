# Phase 1 status — September 26, 2026

**Local foundation implemented; production identity and database inventory verified. Restore, isolated staging, and remote CI remain pending. Phase 1 is not complete and the app is not release-ready.**

## Release baseline

- Repository: `Abbsogol/the-palette`.
- Baseline: `main`, commit `22ec32f0959a529507c8bbf7302ef14d50b7015a`; clean checkout and remote main matched when verified.
- Vercel production is Ready at the same commit, created August 15; domains `laque.app` and `www.laque.app` are mapped to this deployment.
- The user explicitly selected main. The separate redesign branch was 145 commits ahead and is excluded from this work.
- Work branch: `codex/phase-1-foundation`.

## Implemented locally

- Vitest and React Testing Library, including JSX-in-JavaScript support for existing components.
- 23 passing tests for verified auth, admin/owner guards, allowed profile fields, and environment validation.
- 10 failing regression cases asserting desired behavior for the known defects, plus three passing control cases in that suite.
- Playwright production-build smoke tests in Chromium and mobile WebKit; all six passed.
- GitHub Actions definition for independent lint, unit, regression, and production-build/browser checks. No production secrets are required. Published in [draft PR #1](https://github.com/Abbsogol/the-palette/pull/1); use its Checks tab for current remote results.
- Blank environment template, configuration checker, pinned local/CI Node version, and fake-service smoke-build launcher.
- Issue register, read-only database catalogue queries, and staging/backup/restore runbook.

## Verification evidence

| Check | Observed result |
|---|---|
| `npm run test:unit` | 23 passed |
| `npm run test:regressions` | 10 known-defect cases failed; 3 controls passed |
| `npm run build:smoke` | Passed with fake service values; no service connectivity claim |
| `npm run test:e2e` | 6 passed: help interaction, login/recovery navigation, bottom navigation, each on Chromium and mobile WebKit |
| ESLint | Existing 60 errors and 32 warnings; no new-file findings |
| `npm ci` | Clean install passed; direct application dependency versions unchanged |
| `npm audit` | 5 affected package entries: 1 critical and 4 high; dependency remediation remains open |
| Application source | No changes under app/, components/, or lib/ |

The regression failures are real release blockers, not skipped or expected-failure tests. A green unit/build job does not override failing lint or regressions. The image fixture is benign; no exploit payload is used.

## Infrastructure status

| Requirement | Status / missing evidence |
|---|---|
| GitHub repository access | Browser access works as repository owner Abbsogol. Terminal Git is unauthenticated; the connected integration previously rejected tree creation. All 27 foundation files were published through the owner session to codex/phase-1-foundation and verified byte-for-byte against the local commit. Draft PR #1 is open against main. |
| Vercel project access | Verified `sogol-s-projects1/the-palette`, production deployment `3jsKyXyJ8K6HGzo9cPbaPNkTegar`, main `22ec32f`. Nine secret variables apply to Production and Preview; none are linked from Shared. |
| Supabase organization | Verified Abbsogol's Org, Pro, `znhsllocognxwjtcowky` |
| Production Supabase identity | Verified `the-palette`, `faunikvhoommbebsmevg`, Ireland eu-west-1, PostgreSQL 17.6. The live frontend bundle references this project. |
| Database schema, policies, RPCs | Read-only catalog captured: 39 public tables, one public view, 20 public functions, 97 public/storage policies, 121 public constraints, 56 public indexes, 15 custom triggers. Raw metadata stays private in ignored .backups/. No registered migration history; complete replayable baseline remains pending. |
| Isolated staging | Not provisioned or verified. Preview must not be assumed isolated from production. |
| Backup and restore | Daily physical backups completed September 19–26; latest September 26, 07:08:04 UTC. PITR off; Storage objects excluded. Separate recovery clone quoted $9.68/month compute plus usage; approval pending, restore not started. |
| Stripe, OpenAI, Resend access | Not verified; no local service credentials configured |
| Database integration tests | Await real schema and an isolated test target |
| Required GitHub checks | Workflow configuration alone does not enable branch protection; repository admin configuration remains necessary |

The former browser policy-verification error is resolved. Read-only database inspection found additional release-blocking authorization concerns; detailed evidence remains private until remediation. The generation test double now matches the deployed void debit RPC's zero-row behavior. Local doubles still do not certify RLS or transaction safety.

No production database changes, payments, schema pushes, paid resource purchases, or production deployments were performed by this Phase 1 work.

## Resume

Verify remote CI on [draft PR #1](https://github.com/Abbsogol/the-palette/pull/1). Keep lint and known-regression failures visible. Complete the isolated restore after approval, establish a synthetic staging target, export/replay a complete schema baseline, and run database integration tests. Track Storage recovery separately from database backup coverage.
