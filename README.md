# Laque / The Palette

Next.js App Router application for nail-design discovery, AI creation, collections, messaging, and appointments. Supabase supplies auth, database, storage, and realtime; Stripe handles payments; OpenAI handles generation/recommendations; Resend optionally sends reminders.

The October 2 release baseline is **main**, not the separate `redesign` branch.

## Local setup

Use Node **24.20.0** (`.nvmrc`) and npm. Dependencies are recorded in `package-lock.json`.

```sh
npm ci
cp .env.example .env.local
```

Fill `.env.local` with isolated development/staging configuration, then run:

```sh
npm run env:check
npm run dev
```

Open http://localhost:3000. The environment check validates presence and basic formatting only; it does not verify credentials, policies, or services. Browser authentication is in `/profile`.

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase project endpoint |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public/anon client key; access depends on RLS |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL for links and redirects |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only privileged database/storage operations |
| `OPENAI_API_KEY` | Server-only generation and recommendations |
| `STRIPE_SECRET_KEY` | Server-only Stripe API access |
| `STRIPE_WEBHOOK_SECRET` | Webhook signature verification |
| `CRON_SECRET` | Scheduled reminder authentication; required by the release configuration check |
| `RESEND_API_KEY` | Optional reminder email delivery |

Never expose server credentials through `NEXT_PUBLIC_*` variables. Real environment files and backups are ignored by Git; only the blank `.env.example` is committed. Subscription price IDs and some app URLs are currently hardcoded; staging payment validation remains blocked until they are separated during the payment phase.

## Verification

```sh
npm run test:unit           # Existing safeguards and environment validation
npm run test:regressions    # Desired behavior for documented defects
npm test                   # Both suites, once (not watch mode)
npm run lint
npm run build:smoke         # Compile with fake, loopback-only service values
npx playwright install chromium webkit
npm run test:e2e            # Uses the production build from build:smoke
```

**The baseline is intentionally not green.** Ten known-defect tests assert desired behavior and fail until the corresponding fix is implemented. They are not skipped, inverted, or marked as expected failures. Existing application lint failures are retained. See [the issue register](docs/issue-register.md).

API/component tests import application code with mocked services. Unexpected `fetch` calls fail. The smoke-build launcher overrides inherited provider credentials with fake values. Browser smoke tests permit only their local app origin and cover public navigation/auth UI. None of these checks certifies deployed RLS or live fulfillment.

`npm run build` uses real configuration; `build:smoke` explicitly does not. `npm run env:check:build` checks only variables needed for compilation. Both environment-check commands reject the offline placeholders.

## CI and release status

GitHub Actions runs independent lint, unit, known-regression, and production-build/browser jobs without production secrets. Browser reports are retained for seven days. Failures block readiness; there is no `continue-on-error` bypass. Repository administrators still need to configure required PR checks separately.

- [Phase 1 evidence and remaining blockers](docs/phase-1-status.md)
- [Issue register and regression mapping](docs/issue-register.md)
- [Staging, schema, and recovery runbook](docs/environment-and-recovery.md)
- [Database inspection boundary](supabase/README.md)

Read `AGENTS.md` and the installed Next.js documentation before framework-specific edits. Keep fixes focused; broader refactoring follows regression coverage.
