# Nail Lab subscription and design tokens — 8 October 2026

This supersedes the prior credit-only mobile plan. The app uses Apple App Store in-app purchases and Google Play Billing everywhere. Stripe is not a fallback in this release. Existing payment/refund recovery records and appointment deposits remain separate.

## Product contract

- $5 USD monthly subscription, 15 new designs per verified billing period. Store-localized prices and taxes appear before confirmation. Auto-renews until cancelled through the originating store.
- Monthly allowance does not roll over. Purchased extra tokens remain on the account across renewals/expiry, and are usable only while subscribed. Monthly allowance is consumed first.
- Extra consumable packs: 30 designs/$10 USD and 100/$25 USD. A subscriber must exhaust the monthly allowance before buying packs.
- Each new generation reserves one unit atomically. Retrying the same accepted request does not charge twice. A failed attempt that produces no output releases its hold into the same monthly period, or the extra balance it came from. Accepted processing requests remain recoverable after expiry.
- Generated images are final. No free variation, image replacement or generated close-up editing is offered. Editing publishing details, visibility, saving and sharing are allowed without another charge. Trusted private/public storage copies retain the unchanged output.
- Subscription cancellation retains access until the verified period ends. Revocation/refund blocks new generation without reclaiming independently purchased extras. Store-owned pack refund handling remains intact. Deleting a LaQue account does not cancel a store subscription; the app must direct customers to store management first.

## Implementation

Migration 035 separates monthly allowances from the existing extra-token ledger, with profile locks, period-bound reservations and idempotent reconciliation. Latest-period selection cannot fall back to an older allowance after refund. Ordinary clients cannot access the allowance ledger or internal pre-subscription functions. The server enforces membership, account suspension/deletion and new pack eligibility.

Migration 036 uses Google's modern RevenueCat identity `product:base-plan`; Apple retains its separate product identifier. The server and native package selector require exact configured identities/types. See [RevenueCat Google product setup](https://www.revenuecat.com/docs/getting-started/entitlements/android-products).

Lab refreshes membership on focus/foreground. Billing shows subscribe, active allowance, persistent extra tokens, localized pack prices, managed cancellation, pending approval/verification, check/restore and error/unavailable states. Account changes cannot submit an old account's native purchase. Server checks run before opening payment, including a fresh eligibility read and durable reservation.

Admin Overview promotes Subscribers to a top metric and moves Designs to a separate library panel. Subscriptions & Tokens shows membership, allowance, period end, extras and store purchase status. Owner corrections affect only the extra balance; they never create an entitlement or refill the monthly allowance.

## Store setup — required before activation

| Store | Product identifier used by app/backend | Type | Price / units |
|---|---|---|---|
| Apple | `laque_lab_monthly_5` | Auto-renewable, one month | $5 / 15 each period |
| Google | `laque_lab_monthly_5:monthly` | Subscription `laque_lab_monthly_5`, auto-renewing base plan `monthly`, one month | $5 / 15 each period |
| Both | `laque_lab_tokens_30` | Consumable | $10 / 30 |
| Both | `laque_lab_tokens_100` | Consumable | $25 / 100 |

Create the products in App Store Connect/Play Console and import the exact identifiers into the current RevenueCat offering. Do not configure free trials, alternate base plans, legacy 5/15/40 packs or creator subscription offers. Configure the SDK keys separately for Apple and Google. Configure only service-side `REVENUECAT_SECRET_KEY`, `REVENUECAT_WEBHOOK_SECRET`, app-ID allowlist and environment; never put service secrets in Expo configuration.

Beta has no configured RevenueCat server keys/app-ID allowlist. New catalog entries intentionally remain inactive. Set only the three correct product rows per store active after receipt/ownership, webhook, refund, renewal, restore and pending-payment sandbox checks pass. Real payments require native connected builds/store testing; Expo Go and design previews cannot purchase or unlock membership. Terms/privacy links use the connected API environment.

`LAB_APP_ONLY_BILLING=1` is configured in beta. It retires new website Lab subscription/token checkout requests while preserving historical recovery/webhooks. Production has not been activated.

## Beta installation and verification status

The Owner ran the reviewed beta installer and reported `beta Lab subscription ready (035 + 036)`. Both migrations are therefore confirmed by the operator. Browser security checks still block independent UI verification. Vercel deployed the updated beta as `laque-beta-a72wa34vh-sogol-s-projects1.vercel.app`, reported READY, and assigned `https://laque-beta.vercel.app`. Production remains untouched.

Use [the reviewed beta installer](../../supabase/beta-install-lab-subscription.sql) only in `atjwbdrvgljddedtwoqo`. It requires migration 034, skips recorded versions and stops if 035's schema exists without its record. It applies both unrecorded versions atomically and returns `beta Lab subscription ready (035 + 036)`. Do not run it in production.

Local automated checks cover subscription enforcement, exact Apple/Google identities, allowance use/reset/retry/refund, retained extras, suspension/permissions, pending reservations, stale eligibility, cancellation and account changes. Full root suite: 93 files, 915 passed, 2 skipped. Full mobile suite: 85 suites, 698 passed; the final token-wording retest passed all 13 affected tests. Root/mobile lint, mobile typecheck and the web build passed. Installer rerun tests preserve spent allowances, and image tests enforce output immutability while allowing publishing metadata. Results are retained privately in `.backups/lab-subscription-*`. The Owner confirmed beta migration installation and Vercel confirmed deployment/alias readiness. Live receipt acceptance, dashboard/mobile visual verification and connected iOS/Android accessibility journeys remain release gates; browser security currently prevents the visual checks.
