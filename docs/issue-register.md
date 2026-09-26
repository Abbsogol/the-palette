# Release issue register

Baseline: main `22ec32f0959a529507c8bbf7302ef14d50b7015a`, checked September 26, 2026. These are known application defects. Tests assert correct behavior and remain red until fixed. IDs match the original inspection order.

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

Tests are in `tests/regressions/`. Each fix must pass the original failing scenario; database-dependent fixes also need isolated-database integration coverage. Update doubles when introducing transaction RPCs, without weakening behavioral assertions. Phase 1 does not fix these defects.

Other release checks:

| Item | Current evidence | Required closure |
|---|---|---|
| Authorization | Read-only production catalog captured; detailed authorization findings held privately | Remediate reviewed findings and test anonymous/cross-user/admin access in isolation |
| Booking conflicts | Browser checks availability before insertion; catalog has no slot uniqueness/exclusion constraint or booking trigger | Verify database conflict prevention under concurrency |
| Reminders | Cron authentication is conditional; CRON_SECRET absent from Vercel project/shared configuration | Fail closed and verify retryable notification/email delivery |
| Monthly credits | Benefits advertised; no invoice grant in checked-in handler | Verify deployed job or implement idempotent paid-period fulfillment |
| Board covers | Some paths pass signed URLs | Persist stable references and test after expiration |
| Filters/pagination | Case normalization and fixed limits need review | Test realistic datasets and older rows |
| Lint | Original baseline: 60 errors, 32 warnings | Correct violations without globally disabling rules |
| Dependencies | September 26 audit: Next critical; Sharp, PostCSS, js-yaml, and brace-expansion high | Upgrade affected direct/transitive dependencies in Phase 2 and verify runtime behavior |
| Recovery/staging | Daily backups verified; restore and isolated staging pending | Complete the environment-and-recovery runbook |
