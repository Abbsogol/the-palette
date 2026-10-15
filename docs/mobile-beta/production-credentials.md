# Production credentials and deployment operations (F06)

Checked 15 October 2026. **F06 remains Blocked.** The Owner explicitly deferred live Stripe setup and asked for a return-later note. Return to that setup before enabling production payments. No production release, live charge, new provider key or token backfill was performed. The release branch remains fenced from automatic Vercel deployments.

## Verified changes

- Vercel team `sogol-s-projects1` is accessible with the operator's existing CLI session. Project `the-palette` serves production; `laque-beta` serves the isolated beta. No CLI token is checked into Git or copied into CI.
- On production, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `OPENAI_API_KEY` and `RESEND_API_KEY` now target **Production only**. On beta, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `CRON_SECRET` and `RESEND_API_KEY` now target its **Production target only**. Beta's Production target still means the isolated beta service. Fresh provider metadata confirmed these ten changes. Separate development-only records were preserved.
- Those scope changes affect **future deployments only**. Existing previews can retain previously injected secrets. They require deployment retirement and/or credential rotation with provider evidence; this work does not certify old artifacts or hosted logs.
- Server startup checks the explicit environment, database/origin and hosting project when provided. Production services fail closed on Preview/Development targets. Public environment variables use a name allowlist and reject server credential prefixes and service-role JWTs.
- Stripe consumers verify the configured account, live/test mode and configured Price IDs before provider mutations or financial reconciliation. Signed webhooks additionally reject wrong-mode and Connect-account events. The beta Lab adapter retains its separate pinned account/product/amount checks; it is **not** a production Lab payment implementation.
- Provider/SDK/database errors are logged using fixed diagnostic labels. They no longer log returned error objects, messages, response bodies or signed upload data in the changed paths. Tests inject a credential-bearing provider exception and verify it does not appear in logs.
- Web and iOS/Android export checks inject synthetic service credentials during real builds, then scan client bytes, Expo public configuration and build logs for raw/base64/URI-encoded values, service JWTs and recognizable private-key prefixes. CI runs these checks without real provider credentials. See the [sanitized evidence](production-credentials-evidence.json).

## Production configuration gate

Use `.env.production.example` as a **names-only** checklist; do not fill and commit it. Store values as Sensitive variables scoped to the intended project and target. Never use `NEXT_PUBLIC_` or `EXPO_PUBLIC_` for service credentials. Build/test/CI fixtures must not receive hosted keys.

Fresh metadata shows production still lacks `MOBILE_ENVIRONMENT`, `MOBILE_API_ORIGIN`, `MOBILE_SUPABASE_PROJECT_REF`, `CRON_SECRET`, `STRIPE_ACCOUNT_ID` and `STRIPE_MODE`. Optional Calendar/Pinterest/RevenueCat production setup is also unverified. Presence of the other Sensitive variables does not verify their value, provider scope, mode or rotation date.

From the trusted release environment, run `npm run env:check`; errors name settings without printing their values. It validates exact production database/origin, a restricted `rk_live_` Stripe key, account identity syntax, signing-secret/cron formats and enabled OAuth callback URLs. Then verify provider access with the actual restricted credential and known catalog. Store neither downloaded secret files nor credentials in an Excel export, source archive, screenshot or support case.

Access checklist before release:

1. Verify the Owner's Vercel/GitHub access and MFA; review actual team members and remove obsolete access. CLI authentication alone does not establish least privilege for the team.
2. Keep `codex/release-foundation` and `codex/native-mobile-beta` fenced in `vercel.json`; previews must use isolated services. CI uses `contents: read` and synthetic credentials.
3. Confirm production environment, provider account and database together. The original production DB is `faunikvhoommbebsmevg`; beta is `atjwbdrvgljddedtwoqo`. Do not retarget beta or copy beta credentials into production.
4. Create/roll provider keys in the correct business, verify the replacement, redeploy only at accepted release activation, retire exposed previews/old keys and record dates/key identifiers privately. Never record key values in action history.
5. Validate client artifacts and hosted redacted logs after deployment, then complete signed iOS/Android acceptance under F01. Offline exports do not prove signed store artifacts.

## Restricted provider scopes and exact endpoints

**Live Stripe setup is deferred by the Owner.** The connector exposed only WEACTIVATE sandbox `acct_1UOYhj2MrQDGVNuk`. Browser access opened a different business, so no credential action was taken. Reopen the correct WEACTIVATE live business before configuring live keys. Do not assume the historical live account ID is verified by this work.

For the existing platform Stripe adapter, grant only the resources exercised by retained flows: account identity read; Prices/Products read; Checkout Sessions write/read; Customers read; Subscriptions read; Billing Portal Sessions write; Payment Intents read; Invoices read; Refunds write/read. Refund writes remain necessary for the existing automatic late-deposit recovery path. Do not grant payouts, transfers, key management or unrestricted account administration. Confirm the exact permission labels and denial behavior in Stripe before storing the new restricted credential. Do not grant native Lab subscription/payment-intent write scopes to this legacy key or assume it enables production Lab checkout. Retired web-offer decisions remain F07.

| Provider / purpose | Exact production endpoint | Authentication / release gate |
|---|---|---|
| Stripe retained payment and refund recovery | `https://www.laque.app/api/stripe-webhook` | Stripe raw-body signature with this endpoint's live secret; explicit live account/catalog binding. No session-auth bypass is introduced. |
| Store billing through RevenueCat | `https://www.laque.app/api/revenuecat-webhook` | Provider Authorization secret; production project/app IDs and environment must match. Configure real store products separately. |
| Google Calendar consent | `https://www.laque.app/api/calendar/google/callback` | Exact OAuth web-client redirect; bounded state/PKCE and permitted native returns. Disabled until production consent/refresh/revocation checks pass. |
| Pinterest business authorization | `https://www.laque.app/api/pinterest/oauth/callback` | Exact redirect, initiating Owner/browser state, encrypted tokens. Disabled until correct app/board/source approval and consent checks pass. |

The beta Lab endpoint stays **only** `https://laque-beta.vercel.app/api/stripe-lab-webhook`, with the separate restricted test key, test signing secret and sandbox catalog. Do not register this beta-only implementation as production Lab billing. Do not send live events into beta.

The retained Stripe endpoint handles: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, `refund.created`, `refund.updated`, `refund.failed`, `charge.refunded`, `invoice.paid`, `invoice.payment_failed`, `customer.subscription.deleted`, `customer.subscription.updated`, `customer.subscription.paused`, `customer.subscription.resumed`. Register only the retained event families needed at launch; rehearse replay, retry and final provider state before activation. Changes to an endpoint or its subscribed events need a matching signed test; a 2xx HTTP health check is insufficient.

Stripe endpoint-secret rotation supports `STRIPE_WEBHOOK_PREVIOUS_SECRET` and the beta equivalent `LAB_STRIPE_WEBHOOK_PREVIOUS_SECRET` only during the provider's configured overlap window. Keep current/new and retiring values server-only. SDK verification retains raw-body integrity and timestamp tolerance for both secrets. Remove the retiring secret after provider retirement and retry verification; never accept an unsigned body as a fallback. See [Stripe key security](https://docs.stripe.com/keys-best-practices) and [signed webhooks](https://docs.stripe.com/webhooks).

## Token encryption and rotation procedure

Calendar and Pinterest use separate canonical base64 32-byte AES-256-GCM keys. Do not reuse keys between environments or providers. Set `<PROVIDER>_TOKEN_KEY_ID` to enable `v2.<key-id>.<ciphertext>` writes. Authenticated data binds provider, environment and user/connection scope. Unsupported key IDs, tampering and cross-environment/cross-user decryption fail closed. Existing legacy ciphertext is still readable during migration.

For each provider independently:

1. Keep the existing key securely backed up. Generate a fresh key in the trusted secrets workflow. Store the new current key and unique ID, and retain prior versioned keys in `<PROVIDER>_TOKEN_PREVIOUS_KEYS` (JSON map, at most four). When rotating an unversioned installation, explicitly retain its original key in `<PROVIDER>_TOKEN_LEGACY_KEY`. Do not regenerate keys on every deploy.
2. Deploy the reader/keyring before retiring anything; verify both a legacy grant and a new connection. Pending OAuth cookies/state can depend on the old key too.
3. From the trusted environment containing the service credential and keyring, run the maintenance utility in its default **dry-run** mode. Example arguments contain identifiers only:

   `node scripts/rotate-provider-tokens.mjs --provider PINTEREST --environment beta --project atjwbdrvgljddedtwoqo --offset 0 --limit 100`

4. Review the counters privately. To reseal the reviewed page, use the same command plus `--apply --reason "Scheduled token key rotation"`. Production requires explicit production identifiers/configuration. There is no public rotation HTTP endpoint. The report contains counts, environment and provider only, never token values or account identities. Preserve the operator/change reference in the restricted operations record.
5. Page through until `more=false`, incrementing offset by limit. The utility covers Pinterest access/refresh tokens, Calendar connections and pending Calendar OAuth grants. Updates compare both row identity and old ciphertext: a concurrent refresh/disconnect wins rather than being overwritten. Failures or conflicts cause a nonzero exit and leave the original data intact.
6. Rescan from offset zero, retry conflicts and verify **zero old tokens, zero failures and zero conflicts**, including after concurrent deletion. Wait until pending OAuth attempts/cookies expire. Only then retire old keyring entries/legacy key and test reconnect, refresh and revocation again. Never retire a key based on a partial scan. Preserve rotation evidence without plaintext credentials.

No actual hosted token/key rotation has been performed in F06. Hosted logs, provider dashboard scopes, endpoint registrations and old preview copies still require connected verification. Vercel target controls are described in [Sensitive environment variables](https://vercel.com/docs/environment-variables/sensitive-environment-variables).
