# Creator services

Implemented in the shared mobile/visual-preview `ServiceManager` and `ServiceForm`, reached from Creator Studio → Services & deposits. This beta uses one fixed AED price per service.

## Product behavior

- Glass service cards show available/hidden status, description, duration, fixed total, deposit to confirm, and balance at the appointment. No-deposit and full-deposit cases have explicit explanations. Counts and All/Available/Hidden filters help manage the menu.
- Add/edit focuses on the form and resets scrolling to its beginning. Name, optional description, duration (15–480 minutes), duration presets, total and deposit are editable. A live breakdown shows how the client pays. Monetary inputs reject more than two decimal places rather than rounding silently; deposit cannot exceed total.
- Saving returns to the menu with confirmation. Failed saves keep the draft for retry. Hidden-service edits preserve visibility. Cancel, web unload and native back actions protect unsaved drafts; pending writes disable edit and exit actions.
- Hide/show requires a confirmation sheet, discloses existing-booking behavior, and shows the saved terms before restoring. Errors remain in the sheet for retry. A desired visibility value is sent, rather than a server-side toggle.
- Working hours/time zone and service location remain linked from the menu. No extra bottom tab was added.

## Connected behavior

Authenticated creator/salon profiles can open the connected manager. Service reads and existing-record mutations filter by the current owner; reads receive an abort signal. Zero-row writes are errors. Account/epoch changes remount the editor, and late mutation responses cannot display another account’s success.

A new draft receives a UUID once. Its create uses an owner-bound upsert with that ID on every retry, so a lost successful response does not create another service. Editing sends only the service fields and retains visibility. Cache invalidation reconciles booking and creator-setup views after acknowledged writes.

Existing booking snapshots and payment/refund rules remain server-owned. Editing or hiding does not cancel an existing appointment or change its agreed price/deposit. Hidden services cannot receive new requests.

## Verification

Local verification on 7 October 2026: 440 mobile tests across 57 suites, TypeScript and Expo lint passed without warnings; 3 SQL role regressions passed; connected iOS/Android Hermes exports completed. Browser checks covered 393 × 852 and 320 × 800 viewports, with no horizontal overflow in service controls. Logs and screenshots are in `.backups/services-*`.

- Complete mobile sequence: TypeScript → Expo lint → Jest. Includes component/route regressions for monetary precision, balance arithmetic, no/full deposit, failed saves and stable retry IDs, owner filters, hidden editing, confirmation cancellation, visibility failure/retry, pending double taps, account changes, native navigation guard, and background profile-read errors retaining a draft.
- Local SQL role tests: owner create/retry/edit/hide/restore; denied other-account writes/upserts; public discovery before/after hide; preserved booking snapshots; hidden-service booking rejection; checkout using the original deposit. These use the repository’s PGlite fixture and migrations, simulated auth claims, and actual RLS roles. They do not verify hosted Supabase JWT/PostgREST behavior or concurrent PostgreSQL sessions.
- Browser visual preview: phone-size editor/payment cards, typing and saving an updated total/deposit, confirmation and hidden state. Preview records are synthetic. iOS/Android connected Hermes exports check bundling only.

### Hosted follow-up — 7 October 2026

The existing implementation already covers the requested cards, editor, fixed-price breakdowns, visibility states and confirmations; no additional UI rewrite was needed in this follow-up.

Using the existing synthetic creator and customer accounts against isolated project `atjwbdrvgljddedtwoqo`, verified actual JWT/PostgREST/RLS operations:

- Backend configuration identifies the beta project; both accounts authenticate and their role projection is readable.
- Creator create stores the expected AED price, deposit and duration. Retrying the same create ID leaves one record.
- Anonymous and customer reads see the active service. Customer update and upsert attempts cannot change another creator’s service; its stored price and visibility remain unchanged.
- Hiding removes the record from anonymous/customer discovery. Owner editing while hidden retains hidden status and stores the new total, deposit and duration. Restoring exposes those saved terms to the customer.
- The temporary synthetic service was deleted afterward; its absence was verified. No existing service or appointment was changed and no payment was made.

Evidence: `.backups/services-hosted-evidence.json`; reproducible local helper: `.backups/services-hosted-check.mjs` (reads ignored local credentials without logging them).

Reran mobile type-check → Expo lint → Jest: 58 suites / 450 tests passed. All 3 focused local SQL role regressions passed again, including booking snapshots and hidden-service booking rejection. Logs: `.backups/services-followup-mobile.log` and `.backups/services-followup-database.log`. No implementation changed, so earlier native exports and visual comparisons were not repeated. Full repository CI was not rerun for this verification-only follow-up.

Hosted booking snapshot/checkout and hidden-service request checks, concurrent PostgreSQL sessions, connected device journeys, physical iPhone/Android keyboard and large-text behavior, and VoiceOver/TalkBack remain unverified. The direct hosted service operations above do not verify the complete mobile journey or resolve the separate missing profile-banner schema. These gates remain open; this work does not close Phase 1.
