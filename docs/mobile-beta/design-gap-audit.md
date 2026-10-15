# LaQue mobile design and wiring audit

Audited 29 September 2026 against the working tree based on commit `0d4aa1b`, including its uncommitted mobile UI work, and [the current Figma file](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-2).

**All six required bottom tabs have custom UI. No additional bottom tab is needed for the agreed beta.** Most remaining design work is in screens opened from those tabs. A missing Figma frame does not mean the feature is absent: Favorites, the payment page and several real-world states were already designed in code.

This is a screen/flow inventory and source-level wiring audit. It is not a new runtime, security, payment, database or physical-device certification. No app code, database, deployment or Figma canvas was changed for this audit.

> **Implementation follow-up — 29 September:** The Stories viewer/composer and Home Updates layouts listed in this audit are now implemented. See [Stories and Home Updates](stories-updates-ui.md) for the delivered flows, test evidence and connected-device limits. Notifications remains a separate linked screen; its Activity / Preferences redesign was implemented locally on 7 October. See [Notifications UI](notifications-ui.md) for tests and remaining deployment/device gates. The audit tables below preserve the original inspection snapshot.

> **Safety / stories follow-up — 7 October:** Finished local privacy, named blocked accounts, reporting confirmation and deletion consequences/actions, plus story upload stages, native draft guards and live expiry/access handling. See [Safety and stories UI](safety-stories-ui.md). Hosted stories are blocked by the missing `stories.media_path` schema column; physical-device and real-service acceptance remain open.

> **Hosted schema recovery — 8 October:** Missing migrations 023–026 were rehearsed and applied atomically to the isolated beta. Profile identity reads, including `banner_url`, and Stories reads now pass for all three synthetic accounts. Sensitive profile fields remain masked and direct profile writes remain denied. Real image uploads/propagation, story publishing, Calendar grants, deletion journeys and physical-device acceptance remain open. See [Edit Profile](profile-edit.md).

## 1. Main tabs and existing design coverage

| Bottom tab | Existing design and implementation | What remains around it |
| --- | --- | --- |
| **Home** | Home main + Main V2 - Filter; hero, Explore/Community/Following/Updates selector, stories row, search, categories/sort, Trending, New This Week, community and library. Connected Community/Following reuse the design grid. | Finish the story viewer/composer and Updates content layouts. Notifications are a separate linked screen, not another bottom tab. |
| **Search** | Search main, Search - Filter main, Search - Artists & Salons main. Designs / Artists & Salons, filters including the requested Length extension, design details and public profiles. | No missing main Search screen. Pinterest attribution/source states are needed only when that integration is enabled. |
| **Lab** | Lab - Redesigned, Lab - My Generations; current dark background, collapsible Essentials/Personalize, colour sheet, generation result and history actions. | 29 September follow-up: credits-only product UI is implemented; subscription offers removed and existing progress/recovery refined. The inert reference picker was removed; image-reference generation remains unsupported. Real-store and device acceptance remain open. See credits-ui.md. |
| **Messages** | Inbox with last-message/time/unread rows; New message preserves Home main - Message 1 contact browsing. Chat 1— Redesigned, More Options, Upcoming Appointment, attachments, media/search views and safety menu remain. | 29 September follow-up: Share to Chat recipient selection is implemented with preview, discovery, explicit send and recovery. Hosted/device acceptance remains open. See [share-chat-ui.md](share-chat-ui.md). |
| **Saved / Favorites** | Implemented in code using the existing visual system: **Saved Designs / Saved Profiles**, folder grid/detail, create/rename/delete and add/remove designs. | No new base design required. Validate persistence, unavailable content and account changes in the connected app. The lack of a dedicated Figma frame is documentation debt, not a missing screen. |
| **Profile** | Artist Profile 1 — Public, Profile 2 — Redesigned, Profile — Setting 1. Owner shortcuts, public user/artist variants, designs/services/reviews/about, settings and profile collections. | Edit profile, onboarding, creator business tools, appointment history, privacy/safety and deletion need finished secondary-screen designs. |

Canonical references:

- Home: [Home main](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-3621), [Main V2 - Filter](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-3470).
- Search: [Search main](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-4066), [Filter](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-3160), [Artists & Salons](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-4257).
- Lab: [Redesigned](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-4513), [My Generations](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-4669).
- Messages: [Home main - Message 1](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=422-4253), [New Chat](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-4763), [Chat](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-4856), [More Options](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-4923).
- Profiles: [Artist Profile 1 — Public](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=415-2087), [Profile 2 — Redesigned](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=419-3185), [Settings](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=421-3669).
- Other complete base designs: [design detail 36](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-6071), Onboarding 1–4 and 0, and Booking Select Service → Date → Time → Review → Request Sent → Confirmed.

The app-page inventory and the other three Figma pages are preserved in [design-audit-figma.json](design-audit-figma.json). Unnamed legacy screens were inspected by their text, not just their names: these are mostly design details, introductions and marketing variants, rather than hidden billing or creator-management screens.

## 2. Required secondary designs, in recommended order

“Basic UI” below means a real route built with the generic `Screen/Card/Field/Button` components. It is not a blank page and may already have API calls. “Design” work should preserve those behaviors.

| Priority | Screen group / suggested design name | Present implementation | Design work still needed |
| --- | --- | --- | --- |
| 1 | **Onboarding — Complete Profile** | Two-step role/details flow; required name, unique ID and city, plus creator service area. Encrypted account-scoped draft restoration, visible persistence errors, completion and return to the intended action. | Local UI implemented and tested on 7 October 2026. Hosted post-sign-in writes and physical-device interruption/accessibility checks remain open. See `onboarding-complete-profile.md`. |
| 1 | **Creator — Get Ready to Take Bookings** | Profile → Settings → Creator Studio: explicit activation, four saved-state checklist steps, progress, Continue setup, ready state and appointment/calendar links. Refetches on return; failed checks suppress readiness. | Local UI and synthetic journey implemented and tested on 7 October 2026. Hosted database evidence and native-device/accessibility checks remain open. See `creator-setup.md`. |
| 1 | **Profile — Edit** | Avatar/banner previews and add/change/remove; public interests/specialties, identity and creator service location; save confirmation, retained drafts on error, unsaved-change confirmation and connected navigation guard. Personal `banner_url` is selected and rendered by the connected identity. Uploads reject account changes during preparation; local refresh/render tests cover photo replacement/removal in profiles, Messages and Chat. | 8 October: missing schema and prerequisites deployed to isolated beta; exact owner/creator profile and Stories reads pass for all three synthetic accounts, with sensitive fields masked and direct profile writes denied. Eight focused backend suites passed (83 tests, one skipped). Real uploads/propagation and physical-device/accessibility verification remain open. Earlier mobile type-check/lint, 450 tests and both Hermes exports remain the UI evidence. See `profile-edit.md`. |
| 1 | **Creator — My Services / Add or Edit Service** | Shared service cards/editor implemented: fixed AED total/deposit/balance, duration presets, filters/counts, guarded drafts, save feedback and hide/show confirmations; connected owner checks and stable create retry IDs. | 7 October: type-check/lint, 450 mobile tests and 3 SQL regressions passed. Real isolated-beta creator/customer checks verified create/retry/edit/hide/restore, public visibility and denied customer mutations; temporary record removed. Hosted booking/concurrency and physical-device keyboard, large-text and accessibility checks remain open. See `services-management.md`. |
| 1 | **Creator — Working Hours & Time Zone** | Mobile hour/minute sheets, seven open/closed day cards, remembered times, IANA search/explanation, per-day validation, save/retry/conflict feedback and account-scoped unsaved-change guards. Existing bookings keep agreed times/zones. | 7 October: type-check/lint, 468 mobile tests, 16 focused backend tests and both Hermes exports passed. Real beta seven-day save/retry, invalid-zone rollback and denied customer writes verified; original synthetic schedule restored. Physical-device/accessibility, Calendar synchronization and hosted concurrency remain open. Holiday overrides/complex schedules stay outside beta. See `working-hours.md`. |
| 1 | **My Designs — Manage / Publish / Edit** | Branded All/Published/Drafts manager; customer/creator upload entry; owner-scoped pagination and allowance; cover/close-ups, D36 specifications, choosing/uploading/retry, saved feedback and navigation, retained drafts, unsaved guards and confirmed delete. Saved canonical photo URLs are reused for later edits. | 7 October: local type-check/lint, 485 mobile tests, 14 focused API tests, 20 actual PostgreSQL regressions and both Hermes exports passed. Hosted customer upload is still rejected (403), the new allowance GET is absent (405) and the old save contract rejects the metadata payload (400). Matching beta deployment, real Storage/cleanup and device/accessibility verification remain open. See `my-designs.md`. |
| 1 | **Appointments — Requests / Upcoming / History** | Finished My bookings / Client bookings lists with Requests, Upcoming, Past and Cancelled; participant identity/avatar, creator-zone snapshots, verified deposit/refund badges, pagination and recovery. Opens the existing appointment detail; account changes discard late reads. | 7 October: type-check/lint, 521 mobile tests, 3 API tests, 19 actual PostgreSQL checks and both Hermes exports passed. Existing cancelled/refunded records verified through isolated hosted participant reads. New populated lifecycle, concurrency and physical-device/accessibility journeys remain open. See `appointments-list.md`. |
| 1 | **Billing — Lab Credits** | One-time 5/15/40-credit packs, localized store prices, verified balance, store ownership, pending approval, cancellation/retry, restore results and bounded owner-only receipt history with grant/refund/revocation badges. Subscriptions stay removed per the owner’s decision. | Local implementation and checks updated 7 October. Beta has no store products configured and lacks the new receipt-history response. Actual sandbox purchases/refunds/restores, MB-003/004 and physical-device/accessibility acceptance remain open. See `credits-ui.md`. |
| 1 | **Auth — Verification / New Password / Link Expired** | Shared branded checking/verified/recovery/completed/expired/invalid/retry layouts; confirmed-owner password mutation, draft clearing on account changes, consumed-callback guard, correct fresh-email forms and safe return destinations. Provider screens stay provider-owned. | 7 October: local UI, full mobile checks, SDK-contract regressions and both Hermes exports pass. Isolated beta rejects invalid codes without a session. Real email success/recovery, physical-device cold starts, keyboard, large text and accessibility remain open. See `auth-recovery-ui.md`. |
| 1 | **Notifications — Activity & Preferences** | Owner-scoped activity with current actor profiles/photos, typed rows, grouped dates, read/unread filters and confirmed marking, pagination and protected navigation; separate device Preferences with enabled/quiet/off/denied/unavailable/unknown states. | Local implementation and checks updated 7 October. Device-status API deployment, hosted writes, actual push delivery and physical-device/accessibility acceptance remain open. See `notifications-ui.md`. |
| 1 | **Safety — Privacy / Blocked Accounts / Report / Delete Account** | 7 October: confirmed privacy writes, searchable blocked identities/photos, report reason/receipt, deletion consequences and appointment/refund/credit/support links; existing server safeguards retained. | Matching API deployment, populated hosted block/report/closure journeys, retention approval and device/accessibility evidence remain open. See [safety-stories-ui.md](safety-stories-ui.md). |
| 2 | **Stories — Viewer / Create** | 7 October: full viewer/composer with photo/video, captions/tags, profile/report links, loading/retry/upload stages, native draft guard, focus/foreground checks and live expiry. | Hosted social schema is missing; real Storage, video/permissions, termination and physical accessibility remain open. See [safety-stories-ui.md](safety-stories-ui.md). |
| 2 | **Design — Share to Chat** | `share-design.tsx` → `ShareDesignScreen`: designed recipient picker, design preview, permitted discovery, explicit send/retry, delivery confirmation and Open chat. | 7 October: real beta public-design delivery, duplicate retry and stranger/block denial verified; acknowledgement and account-change defects fixed. Private sharing blocked by missing hosted migration/RPC; physical keyboard/accessibility remain open. See [share-chat-ui.md](share-chat-ui.md). |
| 2 | **Home — Updates** | Home reads followed creators’ posts and renders generic cards. Community/Following already reuse the design feed. | 7 October: dedicated text-note cards and Create update → preview/edit → publish/retry → confirmation implemented locally. Author photos/handles, own-note styling and draft/account/navigation guards added; Community/Following retained. Hosted `salon_posts.media` missing and physical accessibility remain open. See [home-updates.md](home-updates.md). |

These are **14 screen groups**, not 14 new bottom tabs or necessarily 14 separate pages. Several can use sheets or shared forms.

Also finish a common set of visual states across the groups: loading, empty, offline/retry, unavailable/private content, permission denied, validation, destructive confirmation, and session expired. Many handlers already exist; the gap is consistency and complete visual coverage, not the absence of every error path.

## 3. Existing designs that still need wiring or a product decision

These should not be mislabeled as “design missing.”

| Finding | Current evidence | Required next step |
| --- | --- | --- |
| **Image-guided Lab generation deferred** | 7 October: mobile has no reference picker, sheet or library-selection entry. Web’s remaining Reference designs section removed. Both use supported text details and state that image references are unavailable in this beta. | Deferred from this beta; no promised picker or image-guided generation. A future implementation needs permitted source/media checks, provider image input, credit/recovery contracts and real integration verification. The existing API rejects non-empty `referenceImageUrls` before credits or provider calls. See `lab-ui.md`. |
| **Payment Methods opens a different feature** | Resolved in the credits-only update: Settings now reads Lab Credits and opens `/billing`. | Rename it to match the destination, or separately design and implement appointment payment-method management if genuinely required. A saved-card wallet is not required merely because Stripe Checkout is used. |
| **Regular-user upload entry implemented locally** | Owner My Designs exposes Upload a design for customers and creators, including empty profiles; it opens the shared D36 editor. | Hosted beta still rejects customer uploads with Creator account required. Deploy the matching API and verify actual Storage/metadata/share behavior. See `my-designs.md`. |
| **Design detail can offer booking for a regular user’s design** | `app/design/[id].tsx` unconditionally adds “Book this design” targeting its author. | Role/service-aware gating or a clear “find an artist for this design” destination; do not imply every author accepts appointments. This is a source-level finding, not a newly reproduced runtime test. |
| **Messaging contact search scope** | Inbox and New message search loaded existing contacts. Find an artist or salon opens Search in artist mode; Share to Chat separately offers server-backed creator discovery. | Distinction implemented. Arbitrary new customer-to-customer conversations remain subject to existing server policy. |
| **Follower/following counts do not open account lists** | Profile stats are non-pressable cards; follow/unfollow works elsewhere in the profile. No follower-list route exists. | Add list sheets and pagination/privacy behavior if tappable follower lists are part of the desired social experience. Counts and follow functionality do not depend on this extra screen. |
| **Reviews are display-only in mobile** | Public profile reads/displays reviews; no review composer is present among mobile routes or feature actions. | Design an eligible post-appointment review flow if mobile review creation is required. Existing rating display does not prove users can write reviews. Review authoring was not explicitly a Phase 1 beta gate. |
| **Creator date/time changes are chat proposals** | `booking/appointment-screen.tsx` and the booking notes implement a proposed date/time draft; original booking stays unchanged. Client rescheduling cancels and rebooks. | Current behavior follows the agreed cancel-and-rebook rule. A formal request → accept/reject reschedule object would be additional workflow/backend work, not a missing Manage button. |
| **Pinterest limited beta pilot** | 8 October: two public boards have 500 saved Pins each; the approved temporary token, shared budgets and live page/detail endpoint are deployed to the isolated beta for three synthetic accounts. Home/Search UI is implemented. | Connected-device/accessibility and visual filter checks, renewable OAuth credentials and wider-audience provider approval remain open. Expo Go's visual preview remains disconnected. See [Pinterest implementation](pinterest-inspiration.md) and [activation guide](pinterest-activation.md). |

Public Services, Reviews and About content already renders inside the public-profile shell, but the supplied canonical profile frame mainly specifies the Designs state. Their detailed layouts can receive a design pass; they are not absent routes.

Native share sheets, the photo picker, Google/Apple consent and Stripe/store payment UI do not need to be recreated in Figma. Design LaQue’s entry, explanation, cancellation, return and error states around them.

## 4. Navigation map to finish wiring

| Role / entry | Current journey | Design gap or follow-up |
| --- | --- | --- |
| First-time guest | Intro 1–4 → welcome 0 → Google/Apple/email or guest Home | Post-auth setup and callback polish. Protected tab taps prompt sign-in and retain an intended destination. |
| Guest with shared public profile | Public profile deep link → read public content → sign-in for protected actions | Source now explicitly allows public-profile links without sign-in; this is an exception to “guest Home only” and should be retained only if intended by the public-profile requirement. |
| Customer discovering a look | Home/Search → design 36 → save/folder, share, author profile or booking | Share-to-chat polish; conditional booking for user-authored designs; optional Pinterest source states. |
| Customer organising inspiration | Saved → Designs/Profiles → folder → detail/profile | Base UI exists. Validate real persistence and account isolation; no new navigation level needed. |
| Customer creating a look | Lab → generate/recover → result → private save/public publish → My Generations | Billing design; reference-image functionality if retained; expose ordinary photo upload separately. |
| Customer booking | Artist profile/service → date → time → review → request → creator decision → confirmed → deposit → appointment/chat manage | Appointment lists implemented; existing detail retained. Hosted populated lifecycle and device verification still needed. |
| Creator operating the business | Profile → Settings → More → creator setup, portfolio, services, working hours; appointment list → request detail → accept/decline/manage | Make the setup/business entry easier to find and finish these basic screens. Keep inside Profile. |
| Either participant messaging | Messages inbox → New message/contact search or conversation → profile/media/search/options → appointment or report/block/hide | Share recipient UI and inbox/contact distinction implemented. Hosted/device verification remains. No extra Chat bottom tab. |
| Account owner | Profile → Settings → edit, notifications, privacy, billing, support, deletion | Finish secondary layouts and correct Payment Methods label/destination. Help currently opens the web help page, so an extra native support page is optional. |

## 5. Things that are not missing design

- Favorites folders and Saved Designs / Saved Profiles were just implemented; do not redesign them from scratch.
- Appointment payment, pending/refund/error states and the manage/cancel UI were already added in code. See [booking-ui.md](booking-ui.md).
- Email sign-in/sign-up/reset-request forms, password visibility, resend/error states and Google/Apple buttons already exist in `welcome-view.tsx`.
- Lab result, private/public publishing, generation recovery and history detail sheets already exist.
- Public customer profiles, artist Book Appointment / Message actions and chat profile navigation already exist.
- Help is linked to the web help page. A native support inbox would add scope.
- Live Google/Apple callbacks, RevenueCat/store catalog and purchase events, Stripe returns/refunds, email delivery, push delivery, real Storage/database permissions, physical-device accessibility and production release checks cannot be solved by extra Figma screens. Their current hosted status was not reverified in this audit.
- Anola is bundled. The typography module still records Sofia Pro as unavailable and uses platform body-font fallbacks; exact cross-platform typography acceptance remains separate from screen completeness.

AR try-on, shop, challenges, promotions, salon staff/team management and advanced analytics remain outside the agreed beta. No bottom tabs are proposed for them.

## 6. Route coverage

38 route-module files were inventoried: two layouts, one development-only preview route, and **35 production route modules**. Several modules intentionally point to the same visual screen.

| Route(s) | Source / implementation | Audit disposition |
| --- | --- | --- |
| `/` | `app/(tabs)/index.tsx` → `features/home` | Custom; secondary stories/updates work above. |
| `/search` | `app/(tabs)/search.tsx` → `features/search` | Custom designs and profiles search/filter. |
| `/lab` | `app/(tabs)/lab.tsx` → `features/lab.tsx` | Custom; text-only inspiration, image references explicitly deferred; billing/device acceptance remains open. |
| `/messages` | `app/(tabs)/messages.tsx` → `features/inbox.tsx` | Custom inbox with latest-message/time/unread rows and separate New message contact browsing. |
| `/saved` | `app/(tabs)/saved.tsx` → `features/favorites` | Custom Designs/Profiles/folders. |
| `/profile` | `app/(tabs)/profile.tsx` → `features/profiles` | Custom owner profile. |
| `/auth` | `app/auth/index.tsx`, `features/welcome` | Custom intro/entry/email forms. |
| `/auth/callback` | `app/auth/callback.tsx` | Branded verification/recovery/link-error layouts and owner guards; hosted/device success acceptance remains open. |
| `/onboarding` | `app/onboarding.tsx` | Basic role/profile setup. |
| `/creator-onboarding` | `app/creator-onboarding.tsx` | Basic account conversion/setup. |
| `/creator/[id]` | `features/profiles/profile-screen.tsx` | Custom public artist/salon/user variant. |
| `/design/[id]` | `features/design-detail` | Custom detail 36; role-aware booking follow-up. |
| `/profile-settings` | `app/profile-settings.tsx` | Custom menu; basic destinations below. |
| `/profile-edit` | `app/profile-edit.tsx` | Basic text editor; missing image editor. |
| `/profile-favorites`, `/collections`, `/collection/[id]` | `features/favorites` | Three aliases/entry routes using the custom Favorites UI. |
| `/portfolio`, `/portfolio-edit` | Corresponding `app/*.tsx` plus shared portfolio manager and D36 editor | Branded management/editor implemented locally; hosted API rollout and native verification remain. |
| `/services`, `/availability` | Corresponding `app/*.tsx` | Basic creator service/schedule tools. |
| `/appointments` | `app/appointments.tsx` | Basic role-switched list. |
| `/book/[id]` | `features/booking/booking-screen.tsx` | Custom service/date/time/review/request flow. |
| `/booking/[id]` | `features/booking/appointment-screen.tsx` | Custom status/payment/manage/cancel/proposal UI. |
| `/checkout-return` | `app/checkout-return.tsx` | Redirect to verified booking status; basic invalid-link message. |
| `/billing` | `app/billing.tsx` | One-time 5/15/40 packs, provider labels, verification/restore/pending-approval states and owner-only receipt history; hosted/native store acceptance remains open. |
| `/generation-history` | `features/lab-ui/history-view.tsx` | Custom history and result-action sheet. |
| `/conversation/[id]` | `features/chat` | Custom chat/options/appointment pin. |
| `/share-design` | `app/share-design.tsx` → `features/messages-ui/share-screen.tsx` | Custom design preview, recipient discovery/selection, explicit send/retry and acknowledgement. |
| `/notifications` | `app/notifications.tsx` | Basic activity/device settings. |
| `/privacy`, `/report`, `/delete-account` | Corresponding `app/*.tsx` | Basic safety/account forms. |
| `/story/[id]`, `/story/new` | `app/story` | Basic viewer/composer. |

Recommended next design batch: **complete-profile setup, Edit Profile, creator services/hours/portfolio, appointment lists, and billing**. Then finish the secondary communication/safety states using the same typography, burgundy/rose palette and shared components.
