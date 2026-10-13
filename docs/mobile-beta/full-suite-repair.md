# Full-suite repair (F02)

Checked 13 October 2026. Stripe webhook authentication remains provider-signature based. The session-auth inventory excludes exact provider/job endpoint paths, including the Lab webhook. Real Stripe signature tests reject missing, forged, altered and expired signatures before privileged reads or reconciliation. Valid events still reconcile the bound customer, ignoring metadata account claims.

Store-purchase route tests mock only the native payment boundary. That boundary throws if called, and every store test asserts it was never invoked. This avoids loading a native TurboModule in Jest without making a fake Stripe payment succeed. Native sandbox payment behavior has separate coverage.

Appointment route tests control `Date` while leaving asynchronous timers real. They cover future requests and elapsed requests opening historical appointment details. Production categorization is unchanged.

Android's previous resource compilation failure was caused by JPEG bytes named `.png`. All 21 affected assets now use `.jpg`, with byte-identical images and updated references/manifests. A format-signature test checks native raster assets to prevent recurrence.

The shared PostgreSQL CI runner also repeatedly hit the five-second unit-test deadline in the multi-query private-media RLS integration. That single test now has a bounded 30-second integration deadline. Its public, draft, private, hidden, restored and malformed-path assertions, migrations and database policies are unchanged. Other tests retain their existing deadlines.

## Verification

- Full backend suite: 109 files, 1,004 passed, two skipped with PGlite.
- The two skipped checks require separate concurrent PostgreSQL connections: account closure racing a booking, and account deletion racing a subscription claim. Both execute in the native PostgreSQL suite sequence used by CI. No unconditional skips were added.
- Full mobile verify: lint, typecheck, 92 suites and 743 tests passed.
- Smoke web build and all 20 Chromium/WebKit browser checks passed.
- iOS and Android JavaScript bundle exports passed.
- Native PostgreSQL 17 sequence: regressions, security, phases 3–6 and mobile backend all passed (912 tests), with no skipped tests.

GitHub's Verify and Mobile verification workflows must pass for the pushed source before F02 is marked complete in the launch tracker. Production activation and signed release-candidate acceptance remain separate tasks.
