# Complete Profile — 7 October 2026

The post-sign-in flow uses the shared burgundy background, Anola headings, translucent cards and gradient buttons.

- Step 1: customer or creator choice; Step 2: profile appearance and details.
- Required: display name, unique @ID and city/area; creators also enter a studio/service area. Bio, photo and banner are optional. City is capped at the backend's 100-character limit.
- Explicit 18+ and Privacy Policy confirmations are required before completion. Saved drafts never restore these confirmations.
- Text, account choice, media references and current step save through the existing encrypted, account-scoped pending store. A saved-status label and retry action expose storage failures. Signing out clears pending drafts; another account cannot read or overwrite them.
- Restored draft images receive fresh private links. An unavailable draft image is reported without preventing recovery of text fields; it can be selected again or removed before finishing.
- Completion waits for account-type, profile and onboarding server writes. Partial failures keep the form editable. A confirmed completed account resumes at the completion screen instead of resubmitting setup after restart.
- Continue clears the local draft and authentication intent and returns to the original protected action. Creators without another destination continue to Creator Studio.

Verification: mobile type-check and lint passed; 392 tests passed across 50 suites, including draft isolation/clearing, required fields, interrupted setup, failed persistence, partial API failure/retry, completion navigation and late responses after account changes. The phone-size browser demo completed creator setup. iOS and Android JavaScript bundle exports passed. One later Jest run terminated with a process segmentation fault; an immediate full-suite rerun passed all 392 tests. API and secure-storage tests use mocks; actual hosted writes, physical iOS/Android process termination, keyboard and screen-reader checks remain open. No hosted migration or deployment is required by these UI changes, and none was performed.
