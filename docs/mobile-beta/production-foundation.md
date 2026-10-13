# F01 — production mobile foundation

13 October 2026. **Implementation tested locally; release acceptance blocked.** Owner confirms Apple membership remains under review and registered production identifiers are not available. No production deployment, database changes, OAuth grant, signing certificate or store submission was performed.

## Implemented

- Shared `mobile/environment-contract.json`: approved public site origins and production database, existing beta identity, distinct schemes. Public production frontend scripts were read on 13 October and still reference `faunikvhoommbebsmevg`; no production database connection was made.
- Mobile production configuration accepts only the pinned production binding. Development/beta refuse the production project **and** API independently. Supabase URLs, public-key roles/project bindings and credential-bearing/path/query URLs are checked.
- Production scheme `laque-app`; beta remains `laque`, development `laque-dev`. Existing beta callbacks and sessions are not migrated in this task.
- Backend `/api/mobile/config` stays public/no-store and contains no private credentials. Production additionally binds the configured API origin and app scheme. A preview request cannot claim the production identity. Contract version 1 remains backward compatible for older beta builds.
- EAS `production` and `production-release-candidate` build profiles use the production environment, store distribution, incrementing build numbers and disabled visual preview. Release candidate Android submission targets internal testing; public production submission is a separate explicit action. No paid build plan or auto-submission was enabled.
- Production build worker requires approved services/public key and syntactically valid production identifiers distinct from current beta/development IDs. It does not invent registered identifiers. EAS project discovery still works before environment variables are downloaded.
- Deposit, Calendar and competition return links use the backend's environment scheme. Production refuses beta schemes and foreign return origins even if accidentally added to an allowlist. Payment return URLs never grant purchase access.
- `mobile/.env.production.example` is a public-only template. Server credentials remain out of the app. Existing sandbox Stripe gates and store/competition feature gates are unchanged.

## Configure after the release base is ready

Keep production deployment separate from beta. Complete F05 schema/contract rehearsal and the applicable security/release gates before making the new backend public.

1. Register production iOS bundle ID and Android package, then set `MOBILE_PRODUCTION_IOS_BUNDLE_ID` and `MOBILE_PRODUCTION_ANDROID_PACKAGE` in the **production** EAS environment. They must differ from beta's current `app.laque.mobile` identifiers. Add actual store signing credentials after enrollment; no guessed IDs are submitted.
2. Set the production **public** Supabase client key in EAS. Never place service-role, payment or OAuth secrets in `EXPO_PUBLIC_*`. Existing fixed production origins/ref are in the profile; an approved change requires reviewing the contract as well.
3. On the matching production backend set `MOBILE_ENVIRONMENT=production`, `MOBILE_API_ORIGIN=https://www.laque.app`, matching `MOBILE_SUPABASE_PROJECT_REF` / Supabase URL and `NEXT_PUBLIC_APP_URL=https://www.laque.app`. Review server secret/account isolation separately; this configuration does not enable live Lab Stripe.
4. Register exact production Auth verification/recovery callbacks `laque-app://auth/callback` (including the existing permitted recovery parameters), plus `laque-app://calendar-connect` in Calendar's exact server allowlist when that feature is approved. Set `MOBILE_RETURN_SCHEMES=laque-app`. Production Supabase must not allow beta/development returns. Beta retains its existing allowed returns; do not replace them with production links.
5. After credentials and backend acceptance, build using `npx eas-cli@latest build --platform ios --profile production-release-candidate` and the corresponding Android command. Use production EAS variables, not a local beta `.env` or tunnel. Submit the reviewed artifacts to TestFlight/Play internal testing with the matching submission profile and actual app registration.
6. Record build/commit IDs and install both candidates. Verify `/api/mobile/config` identity, email/Google/Apple callbacks, relaunch and checkout return to the intended app. Deliberately mismatched origin/project/scheme builds must fail before mounting authenticated routes. Confirm beta still opens only beta and refuses production bindings.

## Acceptance still open

- Apple membership approval, registered production identifiers/signing and store app IDs.
- Production EAS/server variable setup, exact Auth/Calendar return registration, production schema/contract acceptance and controlled backend deployment.
- Real signed iOS/Android release-candidate installations and the intended-service/return journeys above.

Local negative tests and bundle exports are not substitutes for these checks. F01 must not be marked Done yet. No public key or fixture identifier from an offline export is suitable for a real signed release.

## Verification, 13 October

- Targeted backend: 72 tests across 5 suites passed (production bindings, existing billing/return contracts, Calendar, payment recovery and Rewards API).
- Targeted mobile: 60 tests across 4 suites passed (runtime/build identity, wrong origins/projects/keys/schemes, old beta compatibility, OAuth/security and EAS profiles).
- Root/mobile lint, mobile typecheck and Next smoke build passed.
- Expo CLI initially reproduced an unsupported TypeScript dependency import from app.config; validation was moved to one shared CommonJS module with TypeScript declarations. Actual SDK 57 CLI now resolves it successfully, beyond Jest's compiler.
- Final production iOS/Android Hermes exports passed with **offline fixture public key and fixture identifiers**. iOS `index-e80ad20cbefc484087a5de5fa60138a4.hbc`; Android `index-46a1ba2b92b15cfd7416a03acc243cc7.hbc`. These are unsigned bundles, not installable release candidates and not a real production Auth check.
- Existing live production `/api/mobile/config` returned 404 during read-only inspection. No production/backend configuration was activated. Previously identified unrelated full-suite failures remain F02; this focused result does not claim complete CI acceptance.

References: [Expo EAS profiles](https://docs.expo.dev/build/eas-json/), [EAS environment variables](https://docs.expo.dev/eas/environment-variables/), [SDK 57 Linking](https://docs.expo.dev/versions/v57.0.0/sdk/linking/).
