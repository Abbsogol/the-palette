# Release issue register

Baseline: main `22ec32f0959a529507c8bbf7302ef14d50b7015a`, checked September 26, 2026. The original ten test cases pass in the published review branch; migration and deployment remain pending. A subsequent combined review reproduced six additional application/test defects. All six, including the REG-04 pending-checkout path, are now fixed locally with 172 automated checks passing. See [remediation and remaining rollout prerequisites](six-issue-fixes.md). See [fixes and verification](regression-fixes.md). IDs match the original inspection order.

| ID | Priority | Required behavior | Test file | Fix phase |
|---|---|---|---|---|
| REG-01 | P1 | Reject mismatched unsupported image bytes; remove affected direct and nested decoders. The benign AVIF test covers the upload boundary, not exploitability. | persistence.test.js | 2 |
| REG-02 | P1 | Reserve a credit before OpenAI; concurrent requests cannot spend one credit twice. | generation.test.js | 3 |
| REG-03 | P1 | Successive partial refunds apply only the additional reversal. | payments.test.js | 3 |
| REG-04 | P1 | An active subscriber cannot create another subscription checkout; reuse customer identity and provide billing management. | payments.test.js | 3 |
| REG-05 | P2 | Reject unsupported reference-image mode without incurring cost; hide the picker for launch. | generation.test.js | 4 |
| REG-06 | P2 | Restore a free regeneration when an upstream exception prevents delivery. | generation.test.js | 3 |
| REG-07 | P2 | Load existing boards when a parent opens Save to Board, including after authentication resolves. | collections.test.jsx | 4 |
| REG-08 | P2 | Reusing a published generation for a board save preserves publication state. | persistence.test.js | 4 |
| REG-09 | P2 | A stable old balance cannot acknowledge fulfillment of a pending checkout. | collections.test.jsx | 3 |
| REG-10 | P2 | Referral claim and both rewards succeed together or remain retryable. | persistence.test.js | 3 |

Original regression tests are in `tests/regressions/`, with additional isolated PostgreSQL integration coverage. The desired outcomes remain enforced as contracts change. In Phase 5, REG-03's route test checks cumulative successful refund totals passed to the transaction; `tests/phase5/payment-interactions.test.js` verifies the resulting credit balance against real SQL, replacing the former simulated subtraction. SDK doubles are not treated as evidence of database effects.

Phase 2 security fixes are included in [draft PR #1](https://github.com/Abbsogol/the-palette/pull/1); see [scope, evidence, and rollout requirements](phase-2-security.md). They are not applied to production.

Phase 3 subsequently reproduced 18 failing checks across 15 further defect categories and corrected them locally. The user also selected automatic refunds for deposits settling after cancellation/decline; implementation and regression coverage are included. See [the current risk map, verification results, and unresolved service/recovery gaps](phase-3-review.md). Phase 3 remains open.

Phase 4 reproduced nine failing checks across eight additional application defects, corrected them locally, and fixed two fixture/setup issues exposed by expanded testing. Final local verification: 294 automated tests plus 16 browser checks, all passing. See [the Phase 4 flow/role/state map, individual corrections and remaining completion gates](phase-4-review.md). Phase 4 changes are included on the review branch in draft PR #1; commit `4fcfa34` also passed [its Ubuntu CI run](https://github.com/Abbsogol/the-palette/actions/runs/36305381069). Managed staging, recovery and provider operations remain pending.

Phase 5 findings and corrections are grouped into 11 categories: terminal subscription recovery, unpaid entitlements, truthful checkout outcomes, account-state isolation, account-bound actions, onboarding referral recovery, paid/free regeneration, cumulative refund settlement, refund/deletion races, reminder cancellation, and booking availability. Final local verification: **438 unit/component/database tests plus 16 browser checks passed, with 0 failed or skipped**. See [the Phase 5 report](phase-5-review.md) for reproduced cases, final verification and the full flow/role/state map. Phase 5 remains open: exact booking time-zone policy, isolated managed services, historical reconciliation, operational recovery and CI for the new changes are still required.

Other release checks:

| Item | Current evidence | Required closure |
|---|---|---|
| Authorization | Local hardening and catalog-based RLS tests added in Phase 2 | Rehearse on managed staging and roll out the migration/app together |
| Booking conflicts/availability | Phase 3 adds serialization and private busy slots; Phase 5 enforces configured days, working hours and slot alignment on direct authenticated inserts | Resolve appointment time-zone policy and elapsed slots; rehearse migrations and real booking journeys on managed staging |
| Reminders | Phase 4 adds an atomic outbox and per-recipient retries; Phase 5 rechecks cancellation before payload preparation | Configure the secret/provider and supported retry worker cadence; verify real delivery and review alerts |
| Monthly credits | Phase 3 adds atomic once-per-period paid-invoice grants; initial/renewal/duplicate/delayed/failure cases pass locally | Reconcile historic periods and verify Stripe sandbox delivery before rollout |
| Refunds/late deposits | Automatic late-deposit refunds follow the user's policy; Phase 5 separates cumulative successful money from pending/failed refunds and prevents unsafe deletion | Verify real sandbox refunds, endpoint subscriptions, historical state and failed-refund review operations |
| Board covers | Some paths pass signed URLs | Persist stable references and test after expiration |
| Filters/pagination | Case normalization and fixed limits need review | Test realistic datasets and older rows |
| Lint | Fixed locally: zero errors and warnings (was 60/32) | Phase 1 PR checks passed; Phase 2 lint passes locally |
| Dependencies | Upgraded locally: zero audit findings; build and browser checks pass | Verify staging runtime before deployment |
| Recovery/staging | Daily backups verified; restore and isolated staging pending | Complete the environment-and-recovery runbook |
