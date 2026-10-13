# Public privacy policy

Prepared on 28 September 2026 at `/privacy`.

Published at [https://www.laque.app/privacy](https://www.laque.app/privacy). Production deployment `dpl_9hn9P9gtuXsu4jS59B1bZtUc4j5v`, source `a6909af44aef65d2b6d9fb534576befb4c8708b9`, built successfully and was promoted after checking the previous deployment had not changed. Anonymous HTTP verification returned 200 for the policy, Help, Profile and homepage. The live policy displays the confirmed operator/contact, correct canonical URL and no app navigation.

[PR #4](https://github.com/Abbsogol/the-palette/pull/4) preserves the isolated production changes and remains unmerged. Merge it before a subsequent deployment from `main` to avoid losing the policy. The Pinterest draft now contains the live policy URL and confirmed operator name; CAPTCHA and submission remain outstanding.

The owner confirmed the public operator as **WeActivate Project Management Services LLC, Dubai, United Arab Emirates**, and the privacy/deletion contact as **contact@laque.app**. Inbox delivery and request handling by the business have not been tested.

The notice covers accounts, optional profile fields, uploads, social activity, messages, bookings, billing records, AI prompts, service providers, storage/analytics, retention, deletion, rights and international processing. It describes Pinterest as planned and unapproved, and native billing as conditional on availability. It does not claim Pinterest is connected, promise zero provider retention, or invent fixed retention periods or contractual transfer safeguards.

Implementation evidence reviewed: Supabase reads and storage operations; onboarding/profile fields; generation request and history handling; mobile purchase normalization; account-deletion safeguards; global Vercel Analytics and external font loading; beta service-connection records. The notice applies across versions; feature availability differs between the website and beta.

Reference guidance:

- [Pinterest developer guidelines](https://policy.pinterest.com/en/developer-guidelines)
- [ICO privacy-information checklist](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/)
- [Vercel Web Analytics privacy](https://vercel.com/docs/analytics/privacy-policy)

This implementation is not a certification of legal compliance. The operator remains responsible for its retention schedule, provider agreements and international-transfer arrangements, handling requests at the published address, and updating the notice when features or data flows change.

## Release isolation and verification

The live website was verified through Vercel deployment metadata as commit `21a366a111f02fee727ecbf9e3d739b235cd0efc`. A separate `codex/privacy-policy` branch based on that exact commit contains only the policy, styling, profile/help links and suppression of the app navigation on the policy page. The managed-worktree tool could not create a checkout because the task root is above the Git repository; the checkout was therefore created with `git worktree` at the sibling `the-palette-privacy` directory.

The mobile beta working tree retains its own policy and links. No unrelated beta, database, billing or UI changes are included in the privacy release.

- Beta branch: targeted ESLint and production smoke build passed.
- Policy, help and navigation files on the isolated production branch: zero lint errors or warnings.
- Production profile baseline: 8 errors and 2 warnings, with exactly the same findings after adding the two policy links. These pre-existing findings were not changed by this release.
- Browser: the policy renders without authentication; all 14 contents links resolve; the retention anchor navigates correctly; the 393-pixel viewport has no horizontal overflow.

The Pinterest connection form is a draft. Its CAPTCHA and final submission are separate from publishing this notice. Publishing a privacy URL does not grant Pinterest API approval or access to the restricted partner search endpoint.


## Optional Google Calendar update — 29 September 2026

The public policy source in `app/privacy/page.js` now discloses separate opt-in Calendar access, selected calendar names/IDs, transient free/busy checks, encrypted server-side grants, private LaQue appointment copies, disconnect/revocation and pending-sync deletion handling. No personal event titles, guests, descriptions or attachments are requested, and Calendar data is not sent to Nail Lab or advertising. This source change has not been deployed; publish it before enabling Calendar OAuth for users.

## Permanent closure / retention update — 29 September 2026

Owner confirmed **Dubai DET**, so the source policy now identifies the mainland operator and applicable federal UAE framework. The new deletion design promises immediate irreversible account closure, with asynchronous content removal and separately restricted outstanding financial/legal records. It does not promise that all underlying bytes disappear immediately or retain all user data for a speculative two years. Applicable corporate-tax documents have the FTA's minimum seven-year period measured from the relevant tax-period end. Specific legal claims require scoped, documented preservation, review and expiry.

This revision and the preceding Calendar revision remain local and have **not** replaced the published September 28 policy. The old deployment description above is historical evidence only. Publish after the matching isolated backend rollout is verified; obtain UAE legal/accounting review of the operational record schedule. See `mobile-beta/account-deletion-retention.md` for sources, data handling, rollout and non-restorative rollback instructions.


## 18+ eligibility and profile media — 29 September 2026

The policy source now limits LaQue accounts to people aged 18 and over, explains self-declaration and the stored confirmation/policy version, and includes profile banners. This is a product eligibility rule, not a claim that UAE law mandates this exact age or that LaQue verifies identity. The policy revision remains local until published with the matching signup/onboarding changes.
