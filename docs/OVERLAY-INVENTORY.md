# Overlay inventory

**Last verified against commit `91bd1d3` on 2026-09-18.** Re-verify (and update this line) after adding/removing/restyling any overlay.

Every sheet / modal / dialog / popover / lightbox / confirm in the app. **Overlays have no route**, so `ROUTE-INVENTORY.md` can't see them — that blind spot produced two wrong "we're done" claims (first the design-detail sheets, then CommentSheet/CropModal). This is the companion list. **"New" = wine + Prata/Jost + `--lq-*` tokens; "Old" = DM Sans + `--bg-*`/`#2C0A1E`/`#D4A0C0`.**

**Status: 0 old overlays.** 13 go through the shared `Sheet` primitive; 4 are their own implementation (each justified); `confirm()` prompts are OS-native (see known inconsistency).

## A. Shared `Sheet` primitive (13) — inherit drag-to-close, keyboard-offset lift, focus/Escape, scroll-lock, grab handle
| Overlay | Opens from | Design |
|---|---|---|
| Attach a reference design | `/book/[creatorId]` booking wizard | New |
| Submit your entry | `/challenges/[id]` Enter button | New |
| More options | `/creator/[id]` More button | New |
| Conversation options | `/messages/[id]` header | New |
| Shared designs & photos | `/messages/[id]` options sheet | New |
| Manage board | `/moodboards/[id]` Manage button | New |
| Saved designs / Collections / Favourite artists / Settings (×4) | `/profile` tiles + gear | New |
| New board | `/saved` create-board button | New |
| Filter panel + Sort (×2, `fullScreen`) | `/search` filter/sort icons | New |
| Add / Edit service | `/services` + Add / edit | New |
| Boost this design (`BoostButton`) | `/design/[id]` Boost CTA | New |
| Send to chat (`SendDesignSheet`) | `/design/[id]` utility row | New |
| Show My Nail Tech (`NailTechCard`) | `/design/[id]` CTA | New |
| Comments (`CommentSheet`) | community posts (`CommunityCard`) | New |

## B. Own implementation (4) — NOT the shared Sheet, each for a real reason
| Overlay | Opens from | Design | Why its own |
|---|---|---|---|
| `CropModal` — avatar crop editor | `/profile` avatar, story creation | New | Whole screen is a pan/pinch-zoom crop surface (`touchAction:none`); the Sheet's swipe-down-to-close would fight the crop drag. A11y contract added BY HAND (aria-modal, Escape, focus in/return, scroll-lock). Deliberate second implementation. |
| `StoryViewer` — full-screen story viewer | feed story rings | New | Full-screen media viewer with its own gesture set (tap fwd/back, hold-to-pause, swipe-down close, auto-advance). Not a sheet. |
| `ImageCarousel` lightbox — full-screen image zoom | `/design/[id]` carousel | New | Full-screen media lightbox (prev/next), not a sheet. |
| `SaveToBoard` — board picker | `/design/[id]`, `/saved` | New | **MIGRATION CANDIDATE (logged, not now):** own fixed-overlay sheet, NOT the shared primitive — it has a create-board text input that would benefit from the Sheet's keyboard-lift + drag-to-close. Now new-styled. Recommend folding onto the shared Sheet in a future pass. |

## C. Native browser `confirm()` dialogs — OS-rendered
Block user (`/messages/[id]`) · Decline booking (`/bookings/[id]`) · Delete update / Switch to Creator / Delete account / Remove profile photo (`/profile`) · Delete story (`StoryViewer`) · [admin: delete design/product/challenge — scoped out].

**KNOWN INCONSISTENCY (logged, not a problem today):** these are rendered by the OS/browser and **cannot be styled** — they will always look foreign next to the rest of the app. Candidate for a future styled-confirm component; recorded so it isn't mistaken for an oversight.

## D. Full-screen flows (own screens, not overlays over content) — all New
Onboarding walkthrough (`/onboarding`) · Landing/onboarding carousel (`/`) · Story creation (`/story/new`).

## Scoped out
`/admin`, `/admin/batch` — internal ops tooling, not user-facing product surface.

## How to re-verify (run these three greps before any "no old overlays" claim)
```
grep -rn "<Sheet" app/ components/                      # A. shared-primitive call sites
grep -rlnE "position: ?'fixed'" app/ components/         # B/C/D. custom overlays + full-screen (filter out sticky headers/nav)
grep -rnE "(^|[^.])confirm\(|window\.confirm\(" app/ components/   # native confirm() dialogs
```
Then classify each hit by token vocabulary (New vs Old above). The route inventory counts routes; this one is the only guard against old overlays, which have no route.
