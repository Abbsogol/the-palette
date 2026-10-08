# Safety and stories UI — 7 October 2026

Implemented locally in the existing LaQue design system: Anola headings, shared body fonts, burgundy backgrounds, glass cards and rose gradient actions. No new bottom tab, subscription offers or Figma frame claim.

## Delivered

| Flow | Behavior |
| --- | --- |
| Settings → Privacy & Safety | Private-profile, saved-content and permitted-message controls; loading/error/retry and refresh. A change appears saved only after the server returns matching persisted values. Basic public identity remains visible, as enforced by the existing profile view. |
| Blocked accounts | Name, avatar/initial and searchable @username, with an unavailable-account fallback instead of a UUID fragment. Explicit review/unblock confirmation; owner-scoped deletion must return the actual removed block. Failure stays visible inside the sheet. Unblocking does not override privacy or message permissions. |
| Profile/design/message → Report | Reason choices, additional details, validation, retained drafts on error, duplicate-submit protection, confirmed receipt and a Privacy & Blocked Accounts link. Story options report the author's account: the existing server does not accept a story report target. Own-story reporting is hidden. |
| Settings / Privacy → Delete Account | Consequences, restricted retention explanation, appointment/refund and credit-purchase links, policy and support, exact DELETE entry, acknowledgement, submitting/retry and irreversible closure. Refund obligations and cleanup continue separately. No fabricated refund/subscription block or recovery period was introduced. |
| Home → Stories | Author avatar/initial, manual previous/next/finish, caption, hashtags/tagged identities, profile link and reporting. Loading/error checks hide both stale media and identity. Connected stories expire in an open viewer at their actual 24-hour boundary. |
| Home → Create story | Photo/video picker and preview, caption, hashtags and people tagging, audience/expiry disclosure, photo/video loading and retry states, truthful upload stages, failed-attempt retry, duplicate-submit protection and draft-exit confirmation. Native navigation is guarded while a draft/upload is active. The preview discard prompt scrolls into view. |

Story-only refinement on 7 October adds a photo loading indicator that clears on load completion and resets on retry, a denied-photo-access panel with an OS Settings shortcut and retained draft, and invalidation of in-flight access checks when the app backgrounds. Three targeted regressions failed before these changes and now pass; two SDK-contract checks also cover denied and limited iOS photo access plus picker cancellation.

Connected publishing retains the same publication ID and upload map across retries and checks for a prior commit after a lost response. No new upload rules or financial logic were added. Account changes discard late picker, posting, privacy, unblock and report responses. The native composer clears its navigation guard before leaving after confirmed publication.

The connected viewer rechecks access on focus and foreground before displaying cached content, and refreshes every minute while focused and active. Backgrounding invalidates older pending checks, so their late completion cannot reveal cached content. Database audience, block and expiry rules remain authoritative. A previously downloaded image cannot be recalled; existing signed social-media links are short-lived. Drafts and retry maps remain in memory and are not durable across app termination.

Account closure still uses the existing transactional server operation: immediate access closure, upcoming-booking cancellation and durable full-refund obligations. Cleanup and restricted legal/financial retention remain separate server work. Historical recurring purchases must be cancelled with their original provider; no subscription purchase flow has been restored.

## Verification

- `npm run verify --prefix mobile`: type-check, lint and **649 tests / 81 suites passed**, no skips.
- Relevant API/security tests: **31 tests / 4 suites passed**. The original privacy route was temporarily restored for a controlled reproduction: both zero-row and mismatching-write cases incorrectly returned HTTP 200. Both regressions pass with the fix returning 503; the current source was restored before final checks.
- **60 checks / 4 suites passed on actual PostgreSQL 17.10**, including authenticated/stranger/anonymous access, blocked identity reads, owner-only unblocking, private social audiences, expiry, immediate closure, stale tokens, concurrent closure/booking and durable refund obligations. These are local database checks, not hosted-provider evidence.
- Root lint and production smoke build passed. Connected iOS and Android Hermes exports passed with design-preview mode disabled. Exports are not signed installable binaries.
- Browser preview checked at **393 × 852** and **320 × 800**: privacy settings, named unblock review, deletion consequences, story safety/report confirmation, sample photo selection, real caption/tag input, retained draft confirmation and local posting into the viewer. Screenshots are in `.backups/safety-privacy.png`, `.backups/safety-report.png`, `.backups/story-viewer.png` and the refined `.backups/story-refined-viewer.png`. Manual previous/next/finish and image-loading completion were rechecked in this refinement. Demo publication/reporting never writes to Supabase.
- Isolated beta identity and synthetic customer/creator authentication verified. Both accounts read their own privacy settings and block lists; signed-out block reads exposed no rows. Both block lists were empty, so populated hosted identities were not verified.

## Open gates

The beta story projection **fails for both accounts because `stories.media_path` is missing**. Deploy/rehearse the social migration prerequisites and matching API/mobile versions before accepting hosted story uploads, playback or expiry. The new confirmed privacy-save response contract is also not deployed by this task; clients intentionally reject an unconfirmed legacy response.

No hosted privacy change, unblock, report, deletion or media upload was performed. Hosted policy publication, retention approval, actual Auth/Storage erasure, Stripe sandbox refunds/late settlement, report arrival in support, two-account blocked/revoked access, signed native builds, physical video playback/permissions, background/termination, native keyboard/large-text and VoiceOver/TalkBack remain unverified. Existing account/store/provider dependencies remain open. No push or deployment was made in this task; Phase 1 remains open.
