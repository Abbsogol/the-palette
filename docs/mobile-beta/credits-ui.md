> Superseded on 8 October 2026 by [Lab subscription and design tokens](lab-subscription.md). The credit-only and 5/15/40 catalog below is historical.

# Lab credits — 29 September 2026

The owner changed the mobile product to one-time Lab credits. There are no subscription offers, plan upgrades, recurring-price cards or subscription-management flows in the mobile billing screen. This update targets the mobile app being designed; the separate website checkout has not been changed. Historical payment processing, entitlement records, refunds and account-deletion safeguards remain intact.

## Delivered

- A dedicated Lab credits screen using the current dark burgundy/rose background, shared typography, rounded cards and gradient purchase button. Reach it from the Lab credit badge, the zero-credit generation action, the profile's credit action or Settings → Lab Credits.
- Account balance and selectable 5-, 15- and 40-credit packs. Connected builds display localized store prices; the local design preview displays “Store price” and never charges or adds credits.
- Loading, missing configuration, unavailable catalog, offline/error, cancellation and pending-verification states. New purchases remain disabled while verification is unresolved. Check purchases and Restore purchase history reconcile server state rather than granting credits locally.
- Both catalog and native offer filters exclude subscriptions. Mobile purchase requests for subscription, retired or unsupported products are rejected before reserving a purchase. Consumable store product identity must match an active server catalog record; supported pack amounts are unchanged.
- The existing generation flow is preserved. Progress and recovery now use a status card without invented percentages. An empty design form no longer blocks a zero-credit user from opening billing; recovery still works at zero credits and reuses the existing request.
- The inert reference-image picker was removed. Inspiration remains an editable text field. Image-based generation is still unsupported by the existing backend and was not added in this update.

## Verification

- Mobile typecheck and lint passed.
- All 312 mobile tests passed across 37 suites, including purchase reservation, double-tap prevention, cancellation, uncertain responses, delayed verification, restore and account changes.
- All 53 mobile-backend tests passed across 8 suites. These include PostgreSQL billing regressions as well as route tests for the new credit-only policy. Backend route lint passed.
- Browser checks at 393 × 852 and 320 × 740 covered Lab → credits, selection of the 40-credit pack, preview confirmation and dismissal. The fixed buy action stays above the bottom edge; the screen scrolls independently without the bottom tabs covering it.
- iOS, Android and web bundle exports passed. These are compilation checks, not signed native builds. A final settings-label regression and profile/credits retest passed all 21 tests; typecheck and lint also passed after the preview-balance consistency fix.
- No live or sandbox store purchase, provider product mutation, signed native build, physical-device or screen-reader test was performed for this change. No deployment was made. The preview is not evidence of real billing acceptance.
- Screenshot: `.backups/lab-credits.png`.

## Store setup still needed

Configure the three products as Apple consumable in-app purchases / Google one-time consumable products, add them to the RevenueCat offering and the server catalog as `kind=credits` with quantities 5/15/40, and verify account-owned grants/refunds in development builds. Retired subscription products must not be added to the new offering. Do not delete historical billing records or webhook handlers. Existing unresolved native transaction cases remain tracked in `issues.md`.


## Finished credits product UI — 7 October 2026

The mobile product remains one-time Lab credit packs. The outdated “Credits & Subscriptions” checklist does not reinstate subscriptions. No plan cards, recurring offers or subscription-management flow was added. Existing website and historical entitlement processing remain intact.

### Implementation

- Keep 5/15/40 packs and native localized prices. Identify Apple App Store or Google Play on the connected purchase screen. Never borrow a website price or infer a payment from returning to the app. The preview still shows “Store price,” confirms no charge and cannot grant credits.
- A fixed header and purchase footer surround an independently scrolling body. Explain what credits provide, account ownership, store-owned refund requests and the separate appointment deposit/remaining balance. Missing or failed balance reads display an unknown balance and disable new purchases.
- Show working, loading, empty-catalog, unavailable-build, failed/retry, cancellation, pending store approval and pending server-verification states. Pending approval preserves the reservation, does not cancel it, grant credits or automatically buy again. Restore reports the server's remaining balance and explains that consumed credits stay spent.
- Add `history` to the existing authenticated billing GET. A service-role read filters the session owner and `kind=credits`, orders by purchase time/store/environment/transaction and fetches 21 records to display the latest 20 plus a bounded-list notice. Only store, sandbox/production label, product, original pack size, date and display status leave the server. No transaction IDs, original transaction IDs or other account IDs are returned.
- Recent purchases show Credits added, Verifying, or Refunded / revoked. Refund state wins over a prior grant. Pack quantity is historical and is never added to the current balance in the client. The refund badge describes the credit adjustment; it does not claim that money has reached a bank account. A missing older-server contract or partial history-read failure gets a separate reload state, never a fabricated empty history.
- Returning from the background re-reads server billing data while the screen is focused, without repeating a charge. Explicit Check purchases still performs provider reconciliation. Financial grants, deduplication, ownership and reversal rules remain in the existing server ledger.
- Reproduced the old-account reservation leaving the next account busy: the new regression failed before the fix. Billing now remounts on account ID and session epoch, clearing old busy/error/notice/selection state; account tickets still reject late results and prevent the old reservation from reaching the store after account switching.

### Verification for this follow-up

- Mobile verification sequence passed: TypeScript → Expo lint → all **528 tests in 67 suites**. The first type-check caught a new test callback's overly broad `string` type; it was corrected to `AppStateStatus`, then the full sequence passed.
- Credit-only billing route **11 tests** and changed backend-file lint passed. Coverage includes authenticated ownership, ignored foreign-owner query parameters, bounded/safe projections, refund precedence, unavailable dates and partial history failure.
- **21 tests across 3 suites passed on actual PostgreSQL 17.10**: new history queries under service/anonymous/authenticated roles, receipt write denial, deterministic sentinel ordering, duplicate/late financial events, spent-credit restore protection, ownership races and existing table-privilege checks. A ledger-to-history journey verifies a 5-credit grant, one completed generation consuming a credit, replay leaving the balance at 4, refund reducing it to 0 and a delayed purchase preserving both zero balance and the refunded badge. The PostgREST transport is a minimal test adapter; these are actual SQL/role checks, not a real store or hosted Supabase transport test.
- Production smoke build passed. Connected iOS and Android Hermes bundle exports passed with preview mode disabled. These are compilation checks, not signed/installable binaries or store transactions.
- Browser preview at **393 × 852 and 320 × 800**: Lab badge → credits, select 40, no-charge confirmation/dismissal, fixed purchase action, scroll to deposit explanation/history. At 320 pixels the document had no horizontal overflow and the purchase action remained within the viewport. Screenshots: `.backups/credits-finished.png` and `.backups/credits-details.png`.
- Hosted isolated beta identity verified for `atjwbdrvgljddedtwoqo` / `https://laque-beta.vercel.app`. Both synthetic accounts authenticated and received billing HTTP 200 with valid balances. Direct receipt/ownership table reads were denied (42501); signed-out billing returned 401. Hosted evidence: `.backups/credits-hosted-check.json`.

### Still open

The hosted beta has **zero active credit packs**, reports **store billing unconfigured**, and has **not deployed the new receipt-history contract**. Deploy the matching API and configure the three consumables, RevenueCat offering, trusted keys/webhook and native build credentials in the isolated environment. No new migration is required for this history projection; it uses existing migration 020 tables and does not grant client table access.

No native SDK purchase, real sandbox charge/grant, provider purchase restore, refund/revocation event, physical-device journey, large-text or VoiceOver/TalkBack check was performed. The complete unchanged CI sequence was not rerun for this UI follow-up. The preview uses synthetic data; route tests mock session/PostgREST/provider calls; component tests mock the store bridge. MB-003 and MB-004 remain implementation and real-provider acceptance work, not merely missing account access. No push, deployment, product creation or production payment mutation was performed. Phase 1 remains open.
