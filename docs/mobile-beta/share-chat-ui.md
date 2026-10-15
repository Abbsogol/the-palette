# Share to Chat and Messages inbox — verified 7 October 2026

## Delivered behavior

Messages now opens an inbox with the latest text/photo/design summary, local timestamp and unread dot. **New message** opens the existing styled contact browser; **Inbox** returns to the conversation list. Search and role/unread filters apply to loaded contacts, with pagination preserved. **Find an artist or salon** opens Search in artist mode. Conversation, attachments, media/search views, safety options and the appointment pin continue to use the existing chat implementation.

Design detail offers **Share → Share to Chat** and **Share outside LaQue**. **Show my nail tech** also opens the recipient picker. The picker contains the actual design image/title, Recent chats, Artists & salons discovery, name search, role filters, a selected-recipient summary and an explicit Send action. Selecting a recipient never sends a message or creates a conversation.

The connected controller checks design publication/access again before sending. New conversations use the existing permission-checked API only after Send. A persisted account-scoped message ID survives failed requests and is reused on retry. Acknowledged delivery is shown before local cleanup; cleanup failures do not falsely invite resending a delivered message. Duplicate taps and late responses after an account change are guarded. Successful sharing offers **Open chat**, refreshes inbox queries and unhides that conversation only for the current participant.

The inbox query bounds both embedded latest-message and unread-message records to one per conversation, using the authenticated client and existing RLS. No migrations or backend permission changes were added. Blocked/revoked permission checks remain server decisions; a failed send retains the selected recipient and shows the error.

## Preview

The visual demo uses the same picker and sample contacts. It explicitly states that no real messages are sent. Demo shares survive navigation between design detail, Messages and the selected chat during the preview session; a full reload resets them. Discovery can also create a sample recipient row. Demo records never reach Supabase or the messaging API.

## Verification — 7 October 2026

Two synthetic customer/creator accounts authenticated against the isolated beta (`atjwbdrvgljddedtwoqo`, `https://laque-beta.vercel.app`). A third synthetic account exercised stranger access. These checks used real HTTP requests and authenticated RLS reads, independently of the browser demo and controller mocks.

| Gate | Result / evidence |
| --- | --- |
| Public-design delivery | Passed. Creator-owned synthetic design published; customer sent it into the permitted conversation; creator read the exact message ID, sender and design ID from the database. Response fields match the mobile acknowledgement contract. |
| Idempotent retry | Passed. Repeating the same message ID returned the same acknowledgement and left exactly one message. Reusing it with changed content was rejected. |
| Hosted conversation permissions | Passed. Self-recipient rejected; stranger cannot send into the real conversation; anonymous and authenticated strangers cannot read its message. Blocked customer/creator sends rejected in both directions and create no rows. |
| Unshared private design | Recipient cannot read it before sharing, as expected. |
| Private-design sharing | **Blocked.** `design_chat_shares` returns PGRST205; `send_design_message` returns PGRST202; actual private-design send returns HTTP 403. The matching migration/API must be deployed before re-verification. |
| Local private-design permissions | 48 actual PostgreSQL tests across authorization, design/social and safety passed, using all local migrations. Includes atomic/idempotent grants, recipient-only design and Storage access, stranger denial, forwarding denial and revocation by blocking. This does not prove hosted migration/Storage behavior. |
| Controller/component verification | TypeScript, lint and **658 mobile tests / 81 suites** passed; 14 backend API regressions also passed. Focused Share controller/view tests include empty or mismatched acknowledgements, denied creation, stable retries, double taps, cleanup failures and account switching during a pending response. |
| Browser preview | Recipient search filters with keyboard input; selection alone does not send; 320 × 740 layout keeps the Send footer visible with scrollable recipients; 393 × 852 demo success opens the matching Cathedral design card in Kim's chat. Demo creates no hosted records. |
| Connected bundles | iOS and Android Hermes exports succeeded with design preview disabled. These are bundles, not newly signed/device-tested builds. |
| Native keyboard / accessibility | **Open.** Physical iPhone/Android keyboard, VoiceOver/TalkBack and large-text focus/scroll verification still required. Browser input and mocked accessibility roles do not close this gate. |

### Fixes from this verification

The controller previously treated any HTTP success—including an empty response—as delivered. It now requires the returned message to match the pending ID, conversation, design, sender and content. Missing/mismatched acknowledgements retain the retry ID and selection and offer Retry sharing. A missing new-conversation ID also stops before saving/sending.

The controller is remounted for each account, auth epoch and design ID. Selected recipients, sending state and the Open chat confirmation cannot carry over to another account/session. Late responses remain guarded by the account ticket. Eight new regressions failed against the previous implementation before the fixes; a further pending-response account-switch check was added.

### Evidence and cleanup

Ignored local artifacts: `.backups/share-chat-hosted.json`, `.backups/share-chat-database.json`, `.backups/share-chat-verification.log`, `.backups/share-chat-api.log`, `.backups/share-chat-export.log`, `.backups/share-chat-narrow.png`, `.backups/share-chat-confirmation-7oct.png`. Hosted evidence contains outcomes rather than credentials or tokens.

Only disposable synthetic fixtures were created. The design and temporary block were removed with absence verified. Participant RLS correctly denies message deletion; the one synthetic message was removed by the isolated beta admin solely for cleanup, with database absence verified. Admin access was not used for any permission/delivery assertion. The existing synthetic conversation was preserved.

### Remaining acceptance

Deploy and rehearse the matching private-sharing schema and API, then repeat private-image delivery, signed-image access, revoked access and stranger tests in beta. Verify discovery/message settings and hidden-conversation refresh in the connected app. Complete physical-device keyboard, screen-reader and large-text checks. Sofia Pro remains unavailable; the existing body-font fallback is retained. This row and Phase 1 remain open.
