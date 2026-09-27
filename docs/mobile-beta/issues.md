# Open beta issues

All items are open. Owner below identifies the next dependency, not a claim that work has been assigned externally.

| ID | Priority | Issue | Owner/dependency | Closure evidence |
|---|---|---|---|---|
| MB-001 | Critical | Apple/Google/RevenueCat accounts and signing unverified; Expo project linked | Account owner | Registered IDs, EAS signing, installable TestFlight and Play internal builds |
| MB-002 | Critical | Beta backend/schema/Auth/Storage verified; email/OAuth and full hosted acceptance remain open | Infrastructure access | Project IDs, schema-only baseline, all migrations, JWT/Auth/Storage/email checks using synthetic users |
| MB-003 | Critical | Refund reversal, historical-period subscription refund and transfer/legacy ownership coverage incomplete | Implementation + provider sandbox | Verified provider transaction identity; regression and real sandbox before/after ledger evidence for duplicate/out-of-order refund/reversal |
| MB-004 | Critical | Interrupted unpaid native purchase intent needs verified terminal reconciliation policy | Implementation + provider sandbox | Retry/restore/pending/expired intent cases resolve without duplicate subscriptions or consumed-credit grants |
| MB-005 | High | Smoke binaries compiled; connected native E2E and physical-device acceptance remain open | Working native toolchain + devices | iOS/Android compile, native journeys, VoiceOver/TalkBack, large text and keyboard results |
| MB-006 | High | Minutely scheduler verified; real push/provider delivery not configured | Isolated hosting + push credentials | Durable refund and notification retry evidence including provider outage, invalid token and account switch |
| MB-007 | High | Complete Figma implementation/comparisons and licensed fonts/assets outstanding | UI implementation + licensed source assets | Every included screen compared to canonical Home direction; no clipping/contrast/safety-control failures |
| MB-008 | High | Real two-account cross-feature journeys incomplete | Staging synthetic accounts | Publish→save/share→message→book→deposit→cancel/refund→delete, permitted and forbidden operations |
| MB-009 | Medium | Profile avatar editing and some onboarding/profile polish remain | UI/storage implementation | Owned avatar upload/replacement/deletion, cleanup and privacy proof on both platforms |
| MB-010 | High | CI native workflows and Maestro definitions have not executed | CI/Expo project linkage | Successful workflow logs at the release commit; unconfigured smoke cannot substitute for staging acceptance |

Do not close Phase 1 merely because the local suites pass. MB-003 and MB-004 are implementation work in addition to missing account access.
