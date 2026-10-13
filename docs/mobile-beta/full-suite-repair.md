# Full-suite repair (F02)

Checked 13 October 2026. Stripe webhook authentication remains provider-signature based. The session-auth inventory excludes exact provider/job endpoint paths, including the Lab webhook. Real Stripe signature tests reject missing, forged, altered and expired signatures before privileged reads or reconciliation. Valid events still reconcile the bound customer, ignoring metadata account claims.

Store-purchase route tests mock only the native payment boundary. That boundary throws if called, and every store test asserts it was never invoked. This avoids loading a native TurboModule in Jest without making a fake Stripe payment succeed. Native sandbox payment behavior has separate coverage.

Appointment route tests control `Date` while leaving asynchronous timers real. They cover future requests and elapsed requests opening historical appointment details. Production categorization is unchanged.

Android's previous resource compilation failure was caused by JPEG bytes named `.png`. All 21 affected assets now use `.jpg`, with byte-identical images and updated references/manifests. A format-signature test checks native raster assets to prevent recurrence.

The shared PostgreSQL CI runner also repeatedly hit the five-second unit-test deadline in the multi-query private-media RLS integration. That single test now has a bounded 30-second integration deadline. Its public, draft, private, hidden, restored and malformed-path assertions, migrations and database policies are unchanged. Other tests retain their existing deadlines.

The universal Android APK passed in the branch workflow but exhausted the generated two-GiB Java heap while packaging in the duplicate pull-request workflow. CI now explicitly budgets a four-GiB heap and one-GiB metaspace, with two workers and cross-project parallelism disabled. All four Android ABIs and Release build checks remain enabled.

## Verification

- Full backend suite: 109 files, 1,004 passed, two skipped with PGlite.
- The two skipped checks require separate concurrent PostgreSQL connections: account closure racing a booking, and account deletion racing a subscription claim. Both execute in the native PostgreSQL suite sequence used by CI. No unconditional skips were added.
- Full mobile verify: lint, typecheck, 92 suites and 743 tests passed.
- Smoke web build and all 20 Chromium/WebKit browser checks passed.
- iOS and Android JavaScript bundle exports passed.
- Native PostgreSQL 17 sequence: regressions, security, phases 3–6 and mobile backend all passed (912 tests), with no skipped tests.

Final CI is green at `3ca36d77e3f4fc88b469ff736a247d4bb3164ceb`: [Verify](https://github.com/Abbsogol/the-palette/actions/runs/38367110139) and [Mobile verification](https://github.com/Abbsogol/the-palette/actions/runs/38367110075). All jobs passed, including Android universal Release APK packaging and iOS Release simulator compilation. The duplicate branch workflows also passed. Backend CI executes 1,006 tests without skips (94 unit plus 912 in the native PostgreSQL sequence).

F02 is marked complete in the Excel/CSV tracker. Production activation and signed release-candidate acceptance remain separate tasks.
