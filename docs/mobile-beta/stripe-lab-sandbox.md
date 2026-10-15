# WEACTIVATE Stripe Lab sandbox — 9 October 2026

The user requested sandbox packages and Visa/Mastercard, Apple Pay and Google Pay support. After reconnection, the connector independently identified the separate WEACTIVATE sandbox `acct_1UOYhj2MrQDGVNuk` (`livemode=false`). Its catalog was empty; the three packages below were created and retrieved in that sandbox. The earlier shared-test account `acct_1UOYhQRxQmGXfS9a` remains separate and its IDs must not be reused here. No real payment or customer subscription was created.

## Created catalog

| Package | USD price | Type | Product | Price |
| --- | --- | --- | --- | --- |
| LaQue Lab — Monthly | $5 | Monthly recurring, no trial | `prod_laque_lab_monthly_beta_v1` | `price_1UOcXm2MrQDGVNukehimtNus` |
| LaQue Lab — 30 Design Tokens | $10 | One-time | `prod_laque_lab_tokens30_beta_v1` | `price_1UOcXy2MrQDGVNukhRkOnIcB` |
| LaQue Lab — 100 Design Tokens | $25 | One-time | `prod_laque_lab_tokens100_beta_v1` | `price_1UOcY02MrQDGVNuksYQl6X39` |

Descriptions retain the agreed contract: 15 designs per billing month, monthly reset, persistent purchased extras usable while subscribed, no generated-image editing, one successful new generation per unit. Packs require an active subscription and an exhausted monthly allowance. These are catalog descriptions; Stripe does not itself enforce LaQue eligibility or grant balances.

All three are categorized as cloud-based AI for personal use (`txcd_10105001`). This is provisional sandbox configuration, not a tax determination. Automatic tax was not activated; active registrations and tax treatment must be checked before collecting tax/live payments.

## Wallets and cards

The connected sandbox default payment configuration `pmc_1UOYiG2MrQDGVNukvudFhRte` confirms **Cards on/available** and **Apple Pay on/available**. **Google Pay was initially off/unavailable** and has now been enabled through the sandbox dashboard; the resulting table shows all three requested methods Enabled. Device-specific checkout still requires testing.

The beta domain `laque-beta.vercel.app` was registered through the connector with enabled=true and active Apple Pay/Google Pay domain status, domain ID `pmd_1UOcY12MrQDGVNukKh4hH8cP`. Wallet display still depends on eligible devices, browsers, cards and countries. No wallet charge has been verified. Use dynamic Checkout payment methods, not a hardcoded `payment_method_types` list.

## Connection boundary

The existing beta `STRIPE_SECRET_KEY` belongs to a different test account (`acct_1TvxxEGpyT5aBYxx`). Do not overwrite it: existing appointment payment/recovery records depend on that provider account. The Stripe connector now authenticates to the separate WEACTIVATE sandbox and can manage its catalog. Connector reconnection does not provision a backend API key or webhook secret.

`lib/lab-stripe-sandbox.mjs` records only non-secret catalog IDs. `scripts/check-lab-stripe-sandbox.mjs` accepts a separate server-only `LAB_STRIPE_SANDBOX_KEY`, rejects live/public keys, verifies the exact account and expanded active prices, currency, amounts and intervals. It reads only and never creates checkout sessions, grants tokens or changes store billing. Run with the key supplied securely in the server environment:

```sh
node scripts/check-lab-stripe-sandbox.mjs
```

Prefer a restricted test key with read access to the account, Products and Prices for this verifier. Never put keys in chat, Git, browser responses or Expo configuration. After explicit user approval, a restricted test key named “LaQue beta Lab catalog verifier” was created with exactly three read permissions: Accounts, Products and Prices. It was stored as a Secret named `LAB_STRIPE_SANDBOX_KEY` only in the canonical beta Vercel project `prj_SoMqxE3wuWJ2mN2oK5aFdkL0M7Lj` (Vercel calls its canonical target Production; this is the isolated beta project, not LaQue production). The read-only Node verifier succeeded against the exact sandbox account and all three active USD prices. No secret was committed or put in mobile configuration. Existing deposit credentials were not replaced. This key has no checkout/payment write permission; storing it does not activate checkout. New deployments inherit the new secret; the existing deployment was not rebuilt solely for this read-only catalog setup.

## Payment activation remains separate

Sandbox catalog setup does not constitute a working Lab payment integration. New Stripe Lab checkout needs its own verified, account-bound customer/receipt records, signature-checked webhooks, atomic idempotent monthly allowance and token reconciliation, renewal/cancellation/refund/retry testing, and sandbox device journeys before activation. The legacy website subscription webhook grants a different allowance; do not point these new Prices at it or relabel them as legacy premium/pro_creator products.

The existing native App Store/Google Play billing and `LAB_APP_ONLY_BILLING=1` remain enforced. Stripe wallet support does not exempt digital Lab subscriptions/tokens from store billing rules. Regional alternative-billing eligibility/enrollment and review must be established before enabling Stripe purchase links or native checkout in store-distributed apps. Appointment deposits for physical services remain separate.

Sources: [Stripe Checkout](https://docs.stripe.com/payments/checkout), [payment method configurations](https://docs.stripe.com/payments/payment-method-configurations), [cards](https://docs.stripe.com/payments/cards), [Apple App Review 3.1](https://developer.apple.com/app-store/review/guidelines/#in-app-purchase), [Google Play Payments](https://support.google.com/googleplay/android-developer/answer/9858738).

Screenshots of the reconnected sandbox catalog and payment settings are saved locally under `/tmp/laque-stripe-proof/connected-sandbox-catalog.png` and `/tmp/laque-stripe-proof/connected-sandbox-payment-methods.png`. No production keys, settings, purchases, balances or account review submissions were changed.

Validation: direct Stripe API reads confirmed the created catalog and enabled card/Apple Pay/Google Pay configuration; restricted-key SDK verification passed; 8 targeted unit tests passed; targeted lint and diff checks passed. Temporary local key material was removed after hosting storage and verification.

## Checkout implementation — 9 October 2026

Implemented and deployed to isolated beta with activation disabled until runtime credentials and hosted payment verification:

- `lib/lab-stripe.js` uses separate sandbox-only runtime credentials, the exact beta Supabase project and canonical origin, verified-account UUID pilot enrolment, and account/catalog verification before provider calls.
- `/api/mobile/billing/stripe` offers authenticated checkout, check and confirmed renewal cancellation. Prices, amounts, quantities, customers and ownership come from server-controlled records. Session creation uses a durable UUID and Stripe idempotency key. An uncertain checkout can be resumed with the same intent; a paid return page grants nothing.
- `/api/stripe-lab-webhook` checks the raw request signature and sandbox environment. Events trigger a fresh provider snapshot under a shared account lease. First-class customer/session/subscription/invoice/payment ownership and exact USD prices are verified. Monthly grants require a paid invoice with its verified billing period and successful payment. Tokens require a paid session and verified successful charge. Partial refunds revoke proportional token units rounded up; refunded monthly invoices revoke that period. Disputes and unsettled refund debt block new generation pending review.
- Migration 040 adds service-only customer, checkout, subscription and invoice records. It retains existing generation reservations, profile-first locking, monthly-first use, atomic purchased-token balances and idempotent receipts. Duplicate snapshots preserve monthly usage. Terminal cancellation and refund revocation remain monotonic.
- Immediate account closure remains immediate. The cleanup worker cancels Stripe renewal, expires unfinished sessions and verifies settlement before physical financial-record erasure; it never executes dashboard refunds. An unfulfilled payment arriving after closure grants no allowance and remains under review until refunded. Previously fulfilled payments do not create a new deletion blocker merely because the account closes.
- Expo Go/development billing can expose the allowlisted sandbox flow, test label, same-checkout resume, check/retry, cancellation confirmation and purchase history. `__DEV__` is required for the payment UI. Store release builds continue App Store/Google Play purchases; this pilot is not approval for live alternative billing.
- Admin Studio shows sanitized sandbox checkout/verification status in Lab & Credits and integration readiness. Owner corrections remain logged integer deltas and never grant a subscription or execute refunds. Existing deposit credentials/routes remain separate.

The guarded, repeatable beta installer is `supabase/beta-install-lab-stripe.sql`. It requires the verified beta Owner and existing Lab schema, records migration 040 once, preserves balances and creates no customers or purchases. After local rehearsal, it was applied to beta project `atjwbdrvgljddedtwoqo`; the SQL editor returned **beta Lab Stripe sandbox ready (040)**. Do not apply to production.

Runtime deployment needs `LAB_STRIPE_CHECKOUT_KEY` (restricted test key), `LAB_STRIPE_WEBHOOK_SECRET`, `LAB_STRIPE_SANDBOX_CHECKOUT_ENABLED=1`, and explicit UUIDs in `LAB_STRIPE_SANDBOX_USERS`. Credentials are server-only Vercel Secrets. Keep the flag off until migration, webhook registration and verification are complete. The read-only catalog verifier key cannot replace the runtime key.

Proposed runtime permissions: Customers/Checkout Sessions/Subscriptions write; Accounts/Products/Prices/Invoices/Payment Intents/Charges and Refunds read. No payouts, transfers, refund execution, payment-intent confirmation, tax-settings changes, or runtime webhook administration. Register the webhook separately at `https://laque-beta.vercel.app/api/stripe-lab-webhook`, stable API `2026-08-26.dahlia`, only the event types listed in the route. Permission creation and storage require action-time browser confirmation because they expand access beyond the previously approved read-only verifier.

Local checks: database tests cover ownership, subscription eligibility, allowance usage/release, duplicate grants, cumulative/refund-before-fulfillment behavior, stale leases, renewals, terminal cancellation and late payment after account closure. Route tests cover session ownership/IDOR and sanitized errors; signed webhook tests cover forged signatures, sandbox/live separation, bound customer identity, retry and unknown events. Hosted checkout/webhook/device results must be recorded separately; local test success is not a connected payment verification.

### Beta deployment and remaining activation

Deployment `dpl_DGECaJpmt7AE7e7b7FboimY4uQH2` is READY and aliased to `https://laque-beta.vercel.app`. This includes the checkout API, signed webhook, mobile development flow, admin diagnostics and return screen. Runtime checkout remains disabled: the broader restricted key is prepared in Stripe for user approval, but was not created or stored, and the payment webhook was not registered. The existing read-only verifier remains separate.

Checks completed: 55 targeted backend/unit tests in 10 files, 14 mobile credit UI tests, mobile typecheck, root smoke build, targeted lint and diff checks. Mobile lint has one existing test mock warning and no errors. The final UUID canonicalization check also passes. On the deployed beta, signed-out checkout returns 401, an unsigned webhook returns 400, the return page loads without app navigation, and the verified Owner's Integrations screen reports Stripe Lab sandbox checkout as Needs Configuration.

Still required after approval: securely store `LAB_STRIPE_CHECKOUT_KEY` and `LAB_STRIPE_WEBHOOK_SECRET`, register the exact sandbox webhook, enable only the verified beta Owner UUID, redeploy, and verify actual test payment/renewal/refund/cancellation and eligible-device wallet journeys. No real payment or connected sandbox fulfillment is claimed. Store release billing remains unchanged.

Visual proof: `/tmp/laque-stripe-proof/beta-payment-schema.jpg` shows the successful beta installer result; `/tmp/laque-stripe-proof/beta-payment-return.jpg` shows the deployed return screen. `/tmp/laque-stripe-proof/checkout-permissions.jpg` is the unsubmitted restricted-key permission review.

## Connected sandbox activation — 12 October 2026

The user authorized proceeding with the prepared sandbox connection. Created **LaQue beta Lab sandbox checkout**, restricted to the same nine reviewed permissions (six read, three write), and stored it as sensitive `LAB_STRIPE_CHECKOUT_KEY` in the isolated beta Vercel project. Registered sandbox webhook `we_1UPgtr2MrQDGVNukjLdtgJH5` at the exact beta route with stable API `2026-08-26.dahlia` and the 13 event types accepted by the handler. Its signing secret is sensitive `LAB_STRIPE_WEBHOOK_SECRET`; the existing catalog verifier and appointment credentials were preserved. Enabled the sandbox pilot only for verified beta Owner UUID `a92d4175-0da7-463a-a58e-7f067d5057e9`. Temporary local secret files were removed after storage and verification.

Beta deployment `dpl_8N74FbYVSnJgMoMhaacsdVBemFxA` is READY and aliased to the canonical beta URL. Admin Studio now shows **Stripe Lab sandbox checkout: Configured**. The runtime restricted key independently verified the correct sandbox account and all three prices. A genuine, account-bound $5 monthly Checkout Session was created and opened: Sandbox label, 15-design terms, card input, Apple Pay and Google Pay were visible. This proves checkout creation and presentation, not a completed wallet payment.

An explicitly signed preflight notification reached the deployed webhook (200) and fresh verification granted no allowance for the unpaid checkout; the pre-existing three purchased tokens stayed unchanged. The unpaid preflight session was then expired using the runtime Checkout permission. **Stripe's actual expiry webhook automatically updated the beta checkout to expired**, with a fresh verification timestamp and needs_review=false, without a manual reconciliation call. Thus the user's first app purchase can create a fresh checkout. No test payment, paid invoice, monthly allowance or real charge was created during preflight.

The connected mobile development server runs with design preview disabled on port 8083. An Expo Go tunnel is available while this Mac/server stays running: `exp://z6hykli-kiimiia-8083.exp.direct`; QR `/tmp/laque-stripe-proof/laque-sandbox-expo-go.png`. The tunnel helper and QR utility were installed under `/tmp/laque-expo-tools`, outside repository dependencies. Store-distributed release builds still cannot expose this Stripe pilot.

User acceptance next: scan the QR, sign in as the verified beta Owner, open Profile → Settings → Lab Subscription & Tokens, subscribe using Stripe's test Visa `4242 4242 4242 4242`, future expiry and three-digit CVC, close the payment browser and Check purchases. Expect an active subscription with 15 monthly designs and the existing purchased balance preserved. Repeat Check purchases to verify no duplicate refill. Test decline, renewal cancellation and eligible-device wallets subsequently. Purchased packs require an active subscription and exhausted monthly allowance; do not spend 15 real AI generations merely to test pack eligibility. Real payment/renewal/refund/device results remain unverified until completed and recorded.

Current proof: `/tmp/laque-stripe-proof/sandbox-checkout-oct12.jpg`, `/tmp/laque-stripe-proof/beta-stripe-ready-oct12.jpg`, `/tmp/laque-stripe-proof/sandbox-catalog-oct12.jpg`.

### Connected phone sign-in handoff — 12 October 2026

The owner reported a demo-account sign-in message. Device Hub inspection found Expo Go's recent connected LaQue session had a persisted synthetic **Beta Stranger** identity; this account is not the Stripe sandbox pilot Owner. Opened that session, verified its profile, signed it out through Settings → More → Sign out, and opened the real email/password form. No credentials were entered or changed, no preview identity was granted payment access, and no Owner session or paid fulfillment is claimed. Public beta Auth settings confirm email and Google enabled; the verified Owner currently has an email identity. The phone is ready for the user to enter the Owner email and existing dashboard password. Expo Go's custom-scheme Google return remains unverified; email sign-in is the immediate test path.

Phone proof: `/tmp/laque-stripe-proof/connected-phone-sign-in-oct12.png`. The connected tunnel remains running with preview disabled. Next: user signs in, confirms Stripe sandbox on Billing, and completes the first test payment.

### Fixed sandbox loading and opened native Checkout — 12 October 2026

After the user signed in as Owner, Stripe packages rendered but Subscribe stayed disabled. The billing route incorrectly included the disabled native store query's `isPending` in the sandbox loading state. Changed the loading condition to wait on native products only when `storeEnabled`. A route regression uses real React Query: the disabled store query remains pending/idle while sandbox Subscribe becomes enabled and pressing it calls the sandbox checkout API/browser, without fetching native products. It failed against the old condition and passes with the fix. Both targeted suites passed (15 tests); mobile typecheck, lint and diff checks passed.

The running Expo Go app received the fix. Device Hub confirmed Owner profile **Kim**, enabled Subscribe, and a genuine iPhone Safari checkout showing Sandbox, US$5/month, 15-design monthly terms, Apple Pay and card fields. No payment was submitted. The user now has the first account-bound sandbox payment form open; paid fulfillment and wallet transactions remain unverified. Proof: `/tmp/laque-stripe-proof/phone-sandbox-checkout-oct12.png`. No backend deployment or permission changes were needed for this mobile-only fix.

### Phone keyboard restored — 12 October 2026

The focused Stripe card input showed a compact hardware-keyboard accessory bar in Device Hub. Used Device → Keyboard → Toggle Software Keyboard and changed Simulate Hardware Keyboard, then refocused the number input. The user explicitly confirmed **iPhone keyboard is visible** and test-card digits were visible in the focused input. Device Hub's streamed screenshot does not independently show the full physical keyboard. No payment details were entered by the agent, no payment was submitted, and no app/Stripe checkout code change was needed. The user can continue the existing sandbox checkout.

## Native PaymentSheet sandbox — 12 October 2026

Native Stripe card checkout is implemented in the connected iOS/Android app, using Expo 57's bundled `@stripe/stripe-react-native` 0.64.0. New native payments do not launch hosted Checkout. Existing unpaid hosted checkouts retain their original recovery path instead of being converted into a second payment. Expo Go supports the card sheet; native Apple Pay/Google Pay require a configured development build and remain disabled in the config plugin.

Beta migration `041` (`supabase/beta-install-lab-native.sql`) was applied and returned **beta native Lab ready (041)**. Native purchases use the existing account lock, reservations, receipt ledger, invoice/charge verification, refund handling and signed webhook. A first-class subscription/PaymentIntent ID is bound before returning its scoped client secret. Recovery retains the same purchase UUID/provider resource. Dismissing the sheet does not grant access or create another purchase. The legacy `session_id` receipt-reference column stores `native:<purchase UUID>` for native rows, distinguished by the new `surface` column.

The existing restricted sandbox key's Payment Intents permission was upgraded from Read to Write after explicit human approval; other eight permissions are unchanged. It retains no payout/transfer/refund execution privileges. The webhook now receives PaymentIntent success/failure/cancellation as well as the existing invoice, subscription, checkout and refund/dispute events. The publishable **test** key and native feature gate are configured on beta hosting; private keys never enter mobile config.

A separate synthetic verified beta account was used on **LaQue Native Sandbox**, an iOS 27 simulator running Expo Go. The Owner's physical iPhone session was left intact. Connected checks passed:

- Native $5 subscription: payment sheet → successful return → exactly 15 monthly designs.
- Native $10 / 30 tokens: declined test card → no grant → dismiss → resume the same purchase → successful payment → exactly 30 added tokens.
- Native $25 / 100 tokens: 3D Secure mock authentication → successful return → exactly 100 added tokens.
- Repeated/concurrent checks: only three purchase records, no duplicate grants.
- Synthetic subscription renewal cancelled at period end; allowance and purchased tokens remain governed by the original rules.
- Owner remains subscribed with **15 monthly designs**, unaffected by the native test.

The synthetic account began with 3 legacy tokens. Its monthly allowance was explicitly seeded to exhausted **only as a test fixture**, allowing pack testing without buying AI generations. Its resulting purchased balance is 133 (3 + 30 + 100); no real funds or generated images were involved. Its temporary payment-pilot access is removed after verification; synthetic billing records remain for audit. Temporary credential files are removed.

Evidence: `/tmp/laque-stripe-proof/native-payment-sheet-oct12.png`, `native-subscription-success-oct12.png`, `native-card-declined-oct12.png`, `native-3ds-challenge-oct12.png`, and `native-payment-ledger-oct12.json`.

Local checks: 33 selected backend/admin tests and 20 mobile billing/routing tests pass; backend/mobile lint, mobile typecheck, Next build and iOS/Android production bundle exports pass. Android interactive and Apple/Google store sandbox purchase journeys have **not** been verified.

### Regional release status — still disabled

`mobile/src/lib/lab-billing-route.ts` contains the reviewed region/program decision rules, including the required provider-choice outcomes. Country alone, profile country, missing/stale eligibility, unavailable disclosures/reporting or missing enrollment all fall back to store billing. Sandbox override is restricted to development builds and the authenticated backend pilot. Existing Stripe subscriptions retain Stripe verification and cancellation even when new checkout falls back to store billing.

**This is the sandbox-first delivery, not a live regional billing release.** Native StoreKit/Play Billing eligibility/disclosure APIs, provider-choice UI, secure transaction reporting and enrollment configuration still need connecting before any release region is enabled. `enabledPrograms` is deliberately empty and store evidence absent until those adapters exist. There is no active production Stripe path or signed store-eligibility permit endpoint. Store product/provider setup and connected store test builds remain required for fallback purchase testing. Admin Integrations clearly labels this remaining enrollment/integration work; Lab purchase diagnostics show native vs hosted surfaces.

Sources reviewed: [Expo 57 Stripe](https://docs.expo.dev/versions/v57.0.0/sdk/stripe/), [Stripe native subscription integration](https://docs.stripe.com/billing/subscriptions/build-subscriptions?payment-ui=mobile), [Apple regional external purchases](https://developer.apple.com/documentation/storekit/external-purchase), [Google alternative billing APIs](https://developer.android.com/google/play/billing/alternative).
