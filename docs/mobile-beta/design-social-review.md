# D36 designs, social posts and public IDs

Implementation review: 29 September 2026. Changes are local; this document does not record a hosted deployment or a completed private-beta acceptance gate.

## Product behavior

- Figma D36 (`345:6071`, file `VEodtjFruvXPaIwWW2BjMC`) is the common design detail surface. Home, Search, Saved, profiles, booking references, chat shares and Lab history use the same design record/view. Opening a Lab result creates or reuses its private design record; it does not publish it to Community.
- **Share with my nail tech** opens recipient selection. A private design is readable only by its owner and explicitly chosen recipients, in addition to existing permissions for published designs. Private designs cannot be forwarded by recipients. Blocking or account closure prevents further reads; already issued media URLs expire after their short signing lifetime.
- Customer and creator design editors collect cover/close-up photos, title, description, shape, length, techniques, style, occasion, colour names/hex values/product brands/shade codes and hashtags. Publishing requires description, shape, length and technique. Unknown product shades stay blank. Metadata and child records commit atomically; failed saves leave the form available. Existing deletion remains reachable.
- Community posts and 24-hour stories have a separate photo/video composer, caption, hashtags and tagged people. Posts support up to eight media items; stories one. Picker limits: images 8 MB; MP4/MOV videos 50 MB and 60 seconds. The database/storage bucket enforce supported media and ownership, but the 60-second duration and image-specific 8 MB checks are client-side (the bucket has a universal 50 MB cap).
- Video playback is manual, pauses on app backgrounding and releases the player when the view unmounts. It is not an AI generation or design-library upload.
- Onboarding/edit profile lets each user choose a unique, lowercase 3–30 character `@username` with letters, digits, periods and underscores. Search includes customer accounts as well as creators/salons. Tagging chooses a real account and stores its stable ID, so renamed handles do not redirect old tags to another person. Handles display on profiles and social content.
- Community caption/tag filtering applies to loaded posts. The separate People & Salons search queries the database with pagination.

## Backend rollout

1. Rehearse migrations through `202609290025_designs_social.sql` in the isolated beta database. Migration 025 depends on the existing calendar/account-closure migrations 023/024.
2. Apply 025 before deploying the updated mobile bundle. It adds the private `social-media` bucket, post/story fields, metadata save and private-share RPCs, recipient ACLs, account search, RLS rules and cleanup extensions. It creates no user posts or messages.
3. Deploy `/api/mobile/social-media`, the metadata portfolio handler, updated message/upload/profile routes, and the existing cleanup worker. Keep the Supabase service key on the server.
4. Verify account search, signed media upload/read, metadata save, recipient sharing, cleanup and deletion with synthetic customer/creator/stranger accounts. Repeat forbidden reads for private accounts, blocked users and closed accounts.
5. Build a fresh native development/beta app so `expo-video` and its config plugin are included. The visual preview uses session-only sample records and never uploads posts or sends messages to real users.

Rollback: stop the new clients from submitting social posts/design details, then roll back application code. Prefer leaving the additive columns/table/bucket in place while preserving new records and queued cleanup. Do not drop populated fields or the bucket as an application rollback. The previous cleanup and account-storage enumeration helpers are retained under `*_before_social`, but restoring those implementations would omit social-media cleanup; do not restore them while social data exists. Rehearse any schema rollback against a database copy first.

## Verification evidence

Executed with Node 24.20.0 and local PostgreSQL 17.10. The database sequence matches CI order; local macOS is not CI's Ubuntu runner.

| Check | Result |
| --- | --- |
| Root/mobile locked `npm ci` | Passed |
| Root lint; mobile typecheck + lint | Passed |
| Root unit | 62 passed |
| PostgreSQL regressions → security → Phase 3 → Phase 4 → Phase 5 → Phase 6 → mobile backend | 50 + 121 + 59 + 58 + 143 + 126 + 113 = 670 passed |
| Mobile Jest / React Native Testing Library | 371 passed in 45 suites |
| Chromium/WebKit installation → production smoke build → browser tests | 20 passed |
| Connected iOS, Android and web Expo exports | Passed; exports are JavaScript bundles, not signed native builds |
| In-app browser at 393×852 | D36 details/editor, recipient selection/demo-send confirmation, photo post + caption/hashtags/account tag and Community result inspected |

The new tests exercise atomic metadata rollback, quota-preserving retries/edits, competing design/username claims, customer posts, stable tag targets, forged media paths, missing MIME/type data, private-profile visibility, blocked messaging, expired stories and cleanup, route validation, and form errors. The upload-quota edit regression and missing-media-type regression were reproduced failing before their fixes.

Local evidence is in `.backups/d36-*` logs and screenshots and `.backups/secondary-native-*.json`; these are ignored artifacts. Total automated assertions reported by the runners: 1,123 tests, zero failures.

## Not verified / remaining gates

- Migration 025 and the new backend endpoints have not been applied to hosted services in this change. Live account/search/upload/share behavior must be verified after isolated staging rollout.
- Browser walkthroughs used the explicitly labelled demo. They are not evidence of a real message delivery or Storage upload. API tests mock the Supabase SDK boundary; PostgreSQL tests execute real SQL/RLS with synthetic auth claims and Storage rows, not Supabase Storage's HTTP service.
- Native video/picker playback, device permissions, backgrounding, VoiceOver/TalkBack, large text and physical iPhone/Android verification remain outstanding. Xcode is installed, but CocoaPods is not on PATH; the Android Java runtime/SDK were unavailable in this shell. Signed native builds and Maestro device journeys were not run.
- No public release, hosted deployment, push, live upload or real-user message was performed for this UI change.

## Verification update — 30 September 2026

After the profile-media and 18+ follow-up, the complete local sequence passes again: 62 root unit + 683 database/API + 377 mobile + 20 browser = **1,142 tests, zero failures**. Lint, types, production smoke build and connected iOS/Android/web exports pass. See [profile-media-age-review.md](profile-media-age-review.md). The hosted and native-device gates above remain open.
