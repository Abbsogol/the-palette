# Pinterest Standard access: application and recording

Prepared 8 October 2026 (Dubai). App 1616792, LaQue. Upgrade form draft updated in the owner's existing sidebar tab; not submitted and no video uploaded. Treat the form edits as unsaved until Pinterest confirms submission. A copy of the application text is below so a reload cannot lose the work.

## Readiness

The upgrade form requires a video showing Pinterest authentication and the main Pinterest features. Pinterest's access-tier guide requires an approved OAuth flow and live API integration; a dashboard-generated temporary test token is not a substitute for the demonstrated authorization flow. The connected beta now includes an Owner-only Pinterest OAuth connection/refresh flow at `/admin`. Its exact callback is registered, and server credentials are configured. Real Owner authenticator setup, consent, callback and public-board verification remain pending. Complete and verify that flow before recording the final review video. Do not portray LaQue email/Google login as Pinterest authorization.

The curated shared-board use case also needs Pinterest's review. The submitted description must disclose whose account authorizes the boards and who sees the results. Do not substitute a per-user personal-board demonstration for the shared-board product being requested.

The existing form had https://www.laque.app/privacy, which returned HTTP 404 during this check. Draft review links now point to the public beta app and privacy page, both HTTP 200 without deployment authentication:

- https://laque-beta.vercel.app/
- https://laque-beta.vercel.app/privacy — includes WeActivate and the actual Pinterest disclosure.

Use case: Pinner app. Existing audiences: Pinners and Creators. No Pin publishing, ads, reporting or ecommerce features are represented in the Pinterest integration.

## What to record once authorization works

Recommended recording length: 2–3 minutes. Use an MP4 at 30 fps. The current form recommends MP4 under 2 GB and accepts 20–60 fps. Optional voiceover is allowed; this length and 30 fps are our recommendation, not an additional Pinterest requirement.

1. Open the connected LaQue beta. Briefly identify the nail-inspiration use case and the LaQue-managed public boards. Show LaQue sign-in without exposing passwords.
2. Open the desktop beta dashboard as the Owner, with an already verified authenticator session. Open Pinterest → Connect Pinterest. Show the actual Pinterest connection entry, Pinterest's OAuth consent screen for LaQue, the read permissions being requested, authorization by the relevant Pinterest account, and a successful return to LaQue. Show the callback completion screen and click its manual Return to dashboard action. Record the real verified flow; do not show authenticator keys, developer secrets or token generation.
3. Open Home → Explore. Show live Pinterest nail images, the “From Pinterest” attribution, and vertical browsing.
4. Open Search → Designs → Pinterest. Enter a term known to match the loaded selection; demonstrate a category/Length filter if matching metadata is available, then clear it. Explain that these filters search the loaded selection rather than every Pin on Pinterest.
5. Open Halloween to demonstrate the second configured board. Allow it to finish loading before the next action. Avoid repeatedly switching topics during recording because the beta has a shared request cap.
6. Press Load more once. Show new cards and the added-page confirmation. A minute cooldown, if encountered, requires waiting and manually retrying rather than restarting or fabricating the result.
7. Open one Pin's detail, show its Pinterest source, and press View on Pinterest. Show that the original Pin opens on Pinterest.
8. Briefly show the public LaQue privacy link. End without presenting Pinterest Pins as Lab inputs, LaQue uploads or locally saved designs, which are not supported by this integration.

Suggested opening voiceover: “LaQue helps adults discover nail inspiration. This Pinterest integration displays a limited selection from our curated public boards, clearly identifies Pinterest as the source, and links each design to its original Pin.” Describe the actual authorization model in the OAuth segment. Do not claim Pinterest-wide search, permanent imports or approval that has not been granted.

Before recording, use an existing pilot account with sufficient unused allowance and valid authorized credentials. Plan page/detail calls so the recording does not run into LaQue's local limit. Do not reset counters or raise limits just for the video. The temporary token currently expires conservatively at 9 October, 10:13 AM Dubai; the final recording should use the completed OAuth connection instead.

## Application purpose draft

LaQue is an 18+ nail-design discovery and booking app operated by WeActivate Project Management Services LLC in Dubai, UAE. We request Standard access and review of a read-only nail inspiration experience: displaying image Pins from LaQue-curated public Pinterest business-account boards in Home and Search. Our isolated Trial pilot currently reads board details, lists Pins on the configured boards, and rechecks an individual Pin before opening its details. Users can browse the loaded selection and apply local text/category filters, including nail length. Every result is clearly labelled as Pinterest content and links to its original Pinterest Pin. We do not permanently store Pin data or images, repost Pinterest content, or use it for AI generation or model training. No Pinterest write, advertising or analytics features are requested. The current pilot uses a temporary test token; a working Pinterest OAuth authorization flow must be completed and included in the review video before submission. Please confirm that displaying these curated public-board selections to LaQue users is permitted for this use case. Pinterest-wide partner search is not active and is not represented as included in Standard access; any such endpoint would require separate approval.

After the connection and final video are verified, revise the temporary-token sentence to describe the implemented authorization model accurately, upload the owner's actual recording, recheck all fields and complete submission. No completed OAuth connection is currently claimed.

## What the upgrade does not change by itself

Standard generally offers higher provider rate limits, but LaQue's configured request ceilings are separate and stay unchanged until explicitly reviewed. Standard does not waive Pinterest's restrictions on storing API content or automatically prove permission for partner search. The desired permanent imported catalogue requires a separate permitted approach, not merely an access-tier upgrade.

Sources: [access tiers and upgrade requirements](https://developers.pinterest.com/docs/key-concepts/access-tiers/), [OAuth](https://developers.pinterest.com/docs/getting-started/set-up-authentication-and-authorization/), [developer guidelines](https://policy.pinterest.com/en/developer-guidelines). Evidence: `.backups/pinterest-upgrade-draft.png`.
