# Nail Lab and My Generations

Implemented from Figma file `VEodtjFruvXPaIwWW2BjMC`, inspected 2026-09-28:

- [Lab - Redesigned, 345:4513](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-4513)
- [Lab - My Generations, 345:4669](https://www.figma.com/design/VEodtjFruvXPaIwWW2BjMC/laque.app?node-id=345-4669)

The native screens share the current Search 4K-upscaled background (`1792 × 3840`), as requested. The original Figma background was intentionally replaced. The History/credit controls, three translucent form sections, rose selections, colour swatches, sticky generation action, history header and two-column gallery follow the inspected frames. Per the 2026-09-29 update, the Lab header now reads “Nail Lab” and the duplicate large title is removed. Essentials and Personalize are expandable sections; Essentials starts open and Personalize starts closed. Headers respect device safe areas; no simulated clock or battery graphics are added. The existing six-tab navigation remains.

The 18 new static assets (three sample images and fifteen SVGs) are original Figma assets. Their node IDs, dimensions and hashes are recorded in `mobile/assets/figma/lab/manifest.json`. Swatches render at 36 points and icons at their original 16-point dimensions. Gallery images use a 4:3 cover slot with 12-point corners. Examples are confined to the preview; real history displays account-owned generation images through signed URLs without disk caching.

## Controls and integration

- Essentials supports multiple vibes, one shape and one length; defaults match Bridal / Almond / Medium in Figma.
- Personalize allows up to four colours, including validated custom hex colours, and multiple occasions. All selections and the 500-character details field are sent to the existing generation API.
- Closing either dropdown keeps its selections. Each header exposes its expanded state to assistive technology; collapsing sections does not trigger generation or billing.
- Generation retains durable request identity, interrupted-request recovery, server-owned credit charging and the existing free variation/save/publish operations. Duplicate taps are suppressed. Starting a new request waits until pending storage has been read; failed reads are retryable. Late responses after an account change are discarded.
- The credit badge and zero-credit action open existing billing. Figma's static “packs coming soon” copy is replaced with credit-options copy, reflecting the real account rather than a hard-coded balance. Unknown balances cannot start new paid generations, and a zero balance does not block recovery of an existing request.
- History shows a real count, loading/error/empty states, older designs and a selected-generation sheet with Save privately / Publish actions. At compact widths or large text settings, the grid becomes a single column.
- The inert Reference designs control was removed in the credits-only update. Inspiration uses the supported Additional details field. The backend explicitly rejects non-empty `referenceImageUrls`; image references remain outside the supported generation contract.

## Preview

Reload Expo Go on the existing port 8084 preview. Choose **Explore demo account → Lab**. Tap **History** to open the three original Figma examples; Back returns to the Lab with its form selections preserved. Generation, purchases and persistent publishing remain connected-app operations. No real AI call, credit charge or purchase is triggered by the preview.

## Header and dropdown verification — 2026-09-29

- `npm --prefix mobile run verify`: typecheck, lint and all **236 tests across 26 suites** passed. The regression covers retaining selections across collapse/reopen without generation or billing calls; existing generation-payload tests open Personalize before selecting its fields.
- Browser preview checked the single Nail Lab header, both dropdowns, and a colour selection retained after closing and reopening Personalize. Evidence: `.backups/lab-dropdown-preview.jpg` and `.backups/lab-dropdown-verification.log`.
- Physical iOS/Android and screen-reader checks were not performed for this update.

## Initial implementation verification and remaining gaps

Follow-up on 2026-09-29: the requested History frame was re-inspected, its back-header spacing and card geometry refined, and the Lab → History → Back path verified in the browser. See [Messages and Lab History verification](messages-ui.md) for current results: 243 passing mobile tests and successful iOS, Android and web exports. The older browser-access limitation below describes the initial pass; browser inspection now works. Device and exact-font acceptance remain open.

- `npm --prefix mobile run verify`: typecheck and lint passed; **213 tests passed across 22 suites**, including 12 new Lab tests.
- Tests cover selections, custom hex validation, the colour cap, missing essentials, zero/unknown credits, pending recovery, request payloads, duplicate taps, late account responses, failed secure-storage reads, gallery actions, errors/empty states and the demo navigation path.
- Expo exports for **iOS, Android and web** passed after the final code changes. These are bundle exports, not signed or installed native builds.
- Evidence: `.backups/lab-verification.log` and `.backups/lab-export.log`.
- The browser tool was denied access to localhost because its admin-policy check was unavailable. No workaround was used. Final rendered geometry, device screenshots, keyboard behaviour and VoiceOver/TalkBack remain unverified in this pass.
- Anola is bundled. Sofia Pro is still missing; the existing platform body-font fallbacks remain. Exact typography/pixel acceptance is open.
- Tests use mocked service responses and local fixtures. No live generation, payment, publishing or database mutation was performed for this UI change.

## Credits-only product update — 2026-09-29

See [Lab credits](credits-ui.md) for the new 5/15/40-credit purchase screen, removal of mobile subscription offers, refined recovery states, verified checks and remaining real-store acceptance requirements.

## Reference-image promise removed — 7 October 2026

The reference picker had already been removed from mobile; the audit row describing it as present was stale. This follow-up removes the remaining web **Reference designs** section and adds matching mobile/web copy: inspiration is entered in words, and image references are unavailable in this beta. There is no disabled picker, placeholder library selector or promise of an imminent release. Booking reference designs and Share to Chat are separate supported workflows and are unaffected.

Image-guided Lab generation is explicitly deferred. The generation contract remains text-only (`vibe`, `shape`, `length`, `colors`, `occasion`, `customText`). The existing server returns 422 for non-empty or invalid `referenceImageUrls` before reserving credit or invoking OpenAI. No image-guided backend or visual-only selector was added. Future work requires permitted-source selection, owner/visibility/Storage checks at generation time, actual image input to the provider, and corresponding credit/recovery/permission acceptance.

Verification for this follow-up: mobile typecheck/lint and **672 tests across 83 suites** passed; **10 generation regressions** passed, including rejection of reference images without charging credit or calling the AI provider. Root lint and the production smoke build passed. The browser preview shows the explicit deferral beside Additional details, with no reference picker or library entry. Evidence: `.backups/lab-reference-deferral-mobile.log`, `.backups/lab-reference-deferral-api.log`, `.backups/lab-reference-deferral-root-lint.log`, `.backups/lab-reference-deferral-smoke.log` and `.backups/lab-text-only-7oct.png`. No live AI calls, hosted mutations, deployment or physical-device/accessibility verification were performed in this follow-up.
