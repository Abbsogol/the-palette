# Route inventory

**Last verified against commit `91bd1d3` on 2026-09-18.** Re-verify (and update this line) after any page add/remove or restyle — a stale inventory is worse than none.

Every `app/**/page.js` route, classified by its design system. **"New" = wine ground (`lq-bg-wine`) + Prata/Jost (`--lq-font-*`) + `--lq-*` tokens + `BackButton`; "Old" = DM Sans + `--bg-primary`/`--bg-card`/`--bg-chip`.** Overlays have no route — see `OVERLAY-INVENTORY.md` for those.

## Totals: 45 routes = **42 New · 2 Old · 1 Redirect**
User-facing OLD = **0**. The 2 Old routes are internal admin tooling, deliberately scoped out (below).

## New (42)
`/` · `/feed` · `/search` · `/saved` · `/profile` · `/creator/[id]` · `/design/[id]` · `/messages` · `/messages/[id]` · `/messages/new` · `/nail-lab` · `/nail-lab/history` · `/book/[creatorId]` · `/appointments` · `/appointments/[id]` · `/appointments/deposit-success` · `/bookings` · `/bookings/[id]` · `/buy-credits` · `/buy-credits/success` · `/upgrade` · `/upgrade/success` · `/followers` · `/following` · `/notifications` · `/settings/privacy` · `/help` · `/invite` · `/rewards` · `/services` · `/availability` · `/analytics` · `/planner` · `/upload` · `/pick-my-set` · `/shop` · `/challenges` · `/challenges/[id]` · `/nail-card/[id]` · `/onboarding` · `/story/new` · `/moodboards/[id]`

## Redirect (1)
`/moodboards` → `/saved` (no UI).

## Old (2) — scoped out, not user-facing product
`/admin`, `/admin/batch` — internal ops tooling; the bottom nav already hides on `/admin`. Not part of the redesign's product surface. (Their `confirm()` dialogs are internal too.)

## Known parked/orphaned (intentional — do NOT delete or surface)
- **`/shop`** — orphaned *on purpose*: Sogol built it, parked the affiliate-links idea, wants it hidden not deleted. Restyled so it matches if ever un-parked; must stay unlinked.
- **`/challenges`** (the list) — currently only `/challenges/[id]` is reachable (feed challenge banner); the list has no entry point. On the fix list (give challenges a real way in).

## How to re-verify
Classify by token vocabulary in each `app/**/page.js`: presence of `lq-bg-wine` / `--lq-font-*` / `ui/BackButton` (New) vs `DM Sans` / `var(--bg-primary|card|chip)` (Old). A script walking `app/` for those markers reproduces the counts above.
