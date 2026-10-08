# Stories and Home Updates

Implemented 29 September 2026 using the current LaQue typography, burgundy/rose background, gradient actions and glass cards. These layouts extend the existing design system; they are not claimed to match a new Figma reference frame.

> **7 October follow-up:** The current story composer shares the Community photo/video, caption, hashtag and people controls, upload/retry presentation and native navigation guard. Viewer identity, access checks, live expiry and photo loading/retry are refined. Denied photo permission has an OS Settings action with retained drafts; in-flight access checks are invalidated on backgrounding. The full mobile suite now passes 649 tests in 81 suites, with both connected platform exports passing. See [Safety and stories UI](safety-stories-ui.md) for current evidence and the hosted missing-schema blocker. The following delivery notes retain the original 29 September snapshot.

## Delivered

- Full-screen story viewer: segmented position indicator, author/time, contained photo, caption, previous/next/finish, profile link and report-account sheet. Loading, unavailable/expired and image-failure retry states are distinct. Navigation is manual, with no forced timer.
- Story composer: native photo library, photo preview, caption with 500-character limit, preview-before-posting, public/24-hour disclosure, discard confirmation, disabled duplicate actions and upload/publishing/error feedback.
- Connected publishing retains its account-scoped upload checks, stable story ID and reconciliation after a lost insert response. Retrying a failed insert reuses the uploaded photo. No database migrations or new upload permissions were added.
- Home Updates: followed creators’ and the signed-in account’s existing text posts, author/time, expandable long text, profile and report-account links, refresh/load-more, and loading/error/empty states. Design category/sort controls are hidden in Updates because these posts are chronological text updates.
- Notifications is a linked `/notifications` screen, labelled Notifications. Home and Updates link to it. The six bottom tabs remain Home, Search, Lab, Messages, Saved and Profile.
- Expo visual preview supports local story creation, sample photos or the photo picker, preview, local posting/viewing and sample Updates. A new local post opens directly even when older stories exist. Preview drafts/posts disappear on reload and never write to Supabase. The linked preview Notifications screen is explicitly empty of live activity.

## Verification

- Mobile type-check and lint passed.
- Full mobile suite passed: 35 suites / 296 tests before the final initial-story selection refinement. The final relevant suites were rerun with a regression for opening a newly posted story among older stories.
- Tests cover viewer navigation/profile/report targets; expired/error recovery; composer preview without posting, draft preservation/discard, upload-state controls; local sample creation; Updates expansion, pagination, recovery and separate notification navigation. Existing tests cover duplicate/lost-response reconciliation and account switching while choosing a photo.
- Browser preview inspected at 393 × 852 and 320 × 740: viewer, composer, selected-photo/caption preview, local posting, author profile, Updates cards and the separate Notifications destination. The fixed Home controls and six-tab bottom navigation were preserved.

## Verification limits

No live story was uploaded and no hosted data was changed in this design pass. Physical iOS/Android photo permissions, keyboard/safe-area behavior, VoiceOver/TalkBack, app termination during an upload and actual hosted Storage/RLS behavior still require connected-device verification. Draft/retry state is in memory, not durable across app termination. Story images use the existing public Storage setup; disappearing from the story list does not revoke a previously shared image URL.

7 October follow-up: dedicated Updates publishing and refined author cards are now implemented locally; see [Home — Updates](home-updates.md). The hosted media-column migration and device acceptance remain open. Notification Activity / Preferences has also been implemented locally; see [Notifications UI](notifications-ui.md).
