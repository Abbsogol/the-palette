# Home — Updates, 7 October 2026

## Delivered locally

Updates has a dedicated **Create update** action and branded text-note cards, with author photo (initial fallback), name, searchable handle, time, own-note badge, expandable text, profile navigation and reporting for other accounts. Cards use the existing burgundy/rose surfaces and shared typography. Latest-first ordering, loading/empty/error/retry, refresh and pagination remain. Notifications opens its linked screen; the six bottom tabs and Community/Following remain in place.

The authenticated feed reads notes with an empty `media` array from self and followed accounts, rather than discarding media from Community posts and showing their captions as updates. RLS remains authoritative for private-account and blocked-account access. Author queries use visible profiles; inaccessible authors are omitted. Private avatar URLs use the existing resolver, with a fallback if signing/loading fails; late account responses are discarded.

The composer supports a 2,200-character text note, preview using the same card presentation, editing the preserved draft, explicit publishing, busy/error/retry, confirmed publication and Back to Updates. Keyboard is dismissed for preview and scroll position resets for preview/edit/success. Photos/videos continue to use Community's existing composer.

Publishing checks for a matching existing owned note before inserting. It retains one publication ID and submitted body throughout retries in the mounted composer, checks returned identity, and cannot turn a changed body/media/owner into success. Cache-refresh failure after confirmed publication does not misreport publication failure. Dirty/busy drafts guard native navigation and browser unload; explicit back/discard uses the existing confirmation. Account/session changes remount the controller, while account tickets reject late work. Drafts are not advertised as recoverable after app termination; a user leaving after an uncertain response is told to check Updates before creating another copy.

The demo uses the same cards/composer. Publishing inserts a local note first in Updates with a **Your update** label; it never writes to Supabase. Reloading resets demo content.

## Verification

- TypeScript, lint and **672 mobile tests in 83 suites** pass. New coverage includes preview without publishing, preserved drafts, retry/acknowledgement checks, media/owner mismatch, account changes, connected navigation guard, text-only feed construction, author identity and self-report suppression.
- **50 actual PostgreSQL 17.10 checks** pass across authorization, design/social and safety. New scenarios verify text-only chronological notes excluding media, private-follow visibility, stranger denial, blocked-author revocation, owned publishing and stable-ID uniqueness. These use all local migrations; they do not establish hosted deployment.
- Connected iOS/Android Hermes exports succeed with design preview disabled. Exports are not signed device builds.
- Browser demo at 393 × 852 and 320 × 740 verifies protected entry, Create update, native keyboard-event text input, preview/edit, explicit demo publishing, confirmation, returning to Updates and the new note appearing first. Author photos/handles and the preserved six-tab navigation are visible. Browser text input is not native software-keyboard acceptance.
- Evidence in ignored `.backups/updates-verification-final.log`, `updates-database.json`, `updates-export.log`, `updates-hosted-read.json`, `home-updates-7oct.png` and `update-composer-preview-7oct.png`.

## Hosted and device gates remain open

Read-only beta checks authenticated both synthetic customer/creator accounts, verified the isolated backend identity and read each author profile. Both text-only feed queries fail with PostgreSQL **42703: column `salon_posts.media` does not exist**. No live posts or account changes were created during this check.

Deploy and rehearse the matching migration `202609290025_designs_social.sql` and matching app/API before hosted acceptance. Then verify real publication, lost-response reconciliation, author/avatar propagation, follow/private/block permissions and two-account consumption. Physical iPhone/Android keyboard, large text and VoiceOver/TalkBack remain unverified. This implementation does not close Phase 1 or its hosted/device gates.
