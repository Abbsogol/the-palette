# Mobile service contracts

All private requests use `Authorization: Bearer <Supabase access token>`. The server calls Supabase Auth to verify it and refuses accounts marked for deletion. No client request may supply the authenticated user identity, credit amount, subscription tier or payment outcome. Public discovery uses the public Supabase key and RLS. Direct writes to services/availability/collections/messages retain their real authenticated role.

| Operation | Contract | Authority and retry behavior |
|---|---|---|
| Environment | `GET /api/mobile/config` | Public, returns only environment, project ref and contract version 1; rejects recorded production and live Stripe keys |
| Authentication | Supabase PKCE; registered `laque[-dev]://auth/callback` | SecureStore verifier/session; callback code exchange; no implicit bearer-token fragments |
| Profile/onboarding | Existing set-account-type, complete-onboarding, update-profile | Existing server guards; mobile clears account-specific state when identity changes |
| Discovery/saves/collections | Supabase designs/profiles/saved_designs/collections/collection_designs | RLS and unique association identities; inserts are idempotent |
| Upload | `POST /api/mobile/upload`, multipart kind/file/conversationId | Authenticated owner; decoded/re-encoded WebP, maximum 8 MB; private mobile-uploads; staged cleanup record |
| Portfolio | `POST/DELETE /api/mobile/portfolio` | Owner UUID and validated owned Storage path; existing quota/RLS; generated Lab designs use their existing publishing API |
| Conversation | `POST /api/mobile/conversation` with creatorId | Actor must be the customer participant; creators open existing incoming conversations |
| Message | `POST /api/mobile/message` with id/conversationId/content/designId/imagePath | Client-generated durable UUID. Duplicate must match sender and content; RLS checks blocks, participation and attachment ownership |
| Report | `POST /api/mobile/report` with targetType/targetId/reason | Target visibility verified using the actor's JWT; reporter identity assigned on server |
| Admin reports | `GET/PATCH /api/mobile/admin-reports` | Auth verified AND server isAdmin; paginated queue, bounded state changes |
| Hide/block | RLS hidden_conversations/blocks | Own participant state only; next incoming message unhides the recipient's conversation |
| Push | `POST/DELETE /api/mobile/push` | Account-owned installation ID/token; registration expires in 24 hours and renews on foreground; transfer discards old queued deliveries |
| Availability | Existing update-availability and booking_available_slots RPC | Explicit creator IANA zone; server slot availability determines validity |
| Request booking | `POST /api/mobile/request-booking` | UUID + reviewed price/deposit/location/timezone. Database freezes terms and rejects stale service values; duplicate requests recover the original booking |
| Decision/cancellation | `POST /api/mobile/booking-action` | Actor's JWT; atomic pre-start cancellation and full-refund obligation; creator accept/decline also enforced by database |
| Deposit | Existing create-deposit-payment with allowlisted returnContext | Stripe Checkout; frozen server amount; web/mobile retries bind one return context before the provider call |
| Return/status | HTTPS mobile-return → app; `GET /api/mobile/deposit-status` | Both booking participants can read status; no financial identifiers returned. Browser/app return never fulfils payment |
| Generation | Existing generate-nail-design/generation-status/publish APIs | Durable request ID, server credit reservation and terminal-state recovery; no offline credit changes |
| Billing status | `GET /api/mobile/billing` | Verified credits, derived tier, active sources, store SKU catalog, unresolved work |
| Purchase intent | `POST /api/mobile/billing`, action purchase/cancel | UUID + store/SKU; profile lock serializes native/web subscription checkout. Cancel records only local store-sheet cancellation, never a provider refund |
| Reconcile/restore | `POST /api/mobile/billing` | Fresh server RevenueCat fetch, original UUID ownership and environment checks; restore alone cannot grant credits |
| Store events | `POST /api/revenuecat-webhook` | Secret bearer authorization, configured app IDs/environment; minimal durable event; store/environment/transaction and original-owner uniqueness |
| Background jobs | `GET /api/mobile/process-jobs` | CRON_SECRET only; bounded batches, provider timeout, leases, durable retries; generic lock-screen text |
| Deletion | Existing delete-account + new database wrappers | Upcoming appointments, outstanding refunds, active native subscriptions and unresolved store work prevent destructive deletion |

Money remains AED where existing backend services use AED. Native store prices come from RevenueCat products in the user's storefront; pack quantities and subscription grants are mapped only on the server. Existing Stripe billing stays the origin for its subscriptions; native UI links management to Apple/Google/Stripe accordingly.

No generated full database type package is claimed: mobile DTOs are deliberately narrow adapters over the reviewed backend. Contract version changes must be coordinated before releasing a binary.
