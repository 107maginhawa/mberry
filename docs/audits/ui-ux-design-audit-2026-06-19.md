# UI/UX Design Audit — Memberry (apps/memberry)

**Date:** 2026-06-19
**Scope:** `apps/memberry` (product app) source-level audit; `apps/admin` noted for comparison.
**Stack:** React + Vite + TanStack Router + shadcn/ui (`@monobase/ui`) + Tailwind, TanStack Query, react-hook-form, sonner.
**Method:** Source read across shell/nav, component system + tokens, forms/tables/states, accessibility, PWA. Findings carry `file:line` evidence. Items marked _(unverified)_ were flagged by readers but not individually opened — confirm before fixing.

---

## Headline

This is a **well-built** codebase, not a generic/AI-slop UI. It already has:

- A real token system: ~30 CSS variables for color/typography/spacing/radius/shadow, light + dark, in `src/styles/globals.css`, wired through `tailwind.config.ts`.
- A shared primitive library (`packages/ui`, ~34 shadcn components) consumed by both apps.
- One centralized app shell per role (`routes/_authenticated.tsx`, `.../officer.tsx`) with sidebar + mobile bottom-nav/drawer, active states via TanStack `activeProps`, breadcrumbs via `PageShell`.
- A shared `DataTable` (`components/patterns/data-table.tsx`) with `renderMobileCard` fallback, `role="grid"`, `aria-sort`, empty state.
- Radix dialogs everywhere (focus trap + aria for free), semantic landmarks (`<main>`, `<header>`, `<nav aria-label>`), a skip-to-content link, zoom-allowed viewport.

So the work is **targeted hardening**, not a redesign. Gaps are specific and individually small.

---

## Top UX problems (high impact)

1. **One-click financial mutation, no confirm.** `features/dues/components/dues-invoice-list.tsx:106-120` — "Mark Paid" fires `markDuesInvoicePaidMutation` on a single click. An accidental click writes a manual payment record. Directly hits the brief's "avoid accidental updates to healthcare/financial records." **Verified.**
2. **One-click "Reinstate Membership."** `features/membership/components/member-detail.tsx:307` — consequential membership state change, no confirm (Suspend / Mark Deceased / Change Category are correctly guarded). **Verified via reader, confirm the line before fixing.**
3. **Bulk "Approve Applications" with no confirmation count.** `features/membership/components/application-list.tsx` — could approve many in one click. _(unverified — confirm scope.)_
4. **Silent 403 / permission handling.** `src/providers/OrgProvider.tsx` swallows 403/404 (no `isError` surface, `retry:false`); no dedicated "access denied" UI state. Users hit blank sections with no explanation. (Note: the credit-compliance 403 was already addressed separately.) _(partially known.)_
5. **PWA: not installable + broken favicon.** `index.html:5` links `/favicon.svg` which **does not exist** (404). No manifest, no `theme-color`, no app-icon set, no service worker, no `vite-plugin-pwa`. **Verified.**

## High impact (mobile / a11y)

6. **`MemberTable` has 8 columns and no `renderMobileCard`** (`features/membership/components/member-table.tsx`) despite `DataTable` supporting it — horizontal scroll on the key officer view on phones. **Verified component lacks the prop.**
7. **Card-link focus rings missing.** `features/booking/components/host-directory.tsx:81` and `features/booking/components/booking-list.tsx:31` — `block focus:outline-none` with no `focus-visible` replacement. Keyboard users get no focus indicator. **Verified.**
8. **Cramped multi-column form on mobile.** `routes/_authenticated/org/$orgSlug/officer/roster/index.tsx:134` — `grid grid-cols-2` for name fields, no mobile breakpoint. **Verified.** Similar pattern likely in `features/person/components/personal-info-form.tsx` _(unverified)_.

## Medium / polish

9. **Status-color duplication.** Centralized `StatusBadge` + `DuesStatusBadge` exist, but ad-hoc colored spans persist (`features/chapters/.../affiliation-list.tsx`, `features/booking/components/booking-list.tsx:19-22` `STATUS_COLOR` map, officer finance member page). ~80 status renders, only a minority via the shared component.
10. **~117 arbitrary Tailwind classes** (`text-[13px]`, `rounded-[8px]`, `px-[13px]`) bypassing the token scale, concentrated in `features/dues` and `features/person`. Typography utilities (`.text-h1`…`.text-micro`) exist but ~60-70% adoption.
11. **Inline inputs/buttons bypass primitives** in a few profile/settings/dues spots (custom focus rings, hand-rolled "button" divs).
12. **A few icon-only buttons may lack `aria-label`** (special-assessments, fund-allocation, training-card, message-composer). _(unverified — sweep needed.)_
13. **Admin app doesn't share memberry patterns** (`status-badge`, `data-table`, `form-field`) — duplication risk as admin grows. Candidate: promote patterns into `packages/ui`.

---

## Quick wins (<30 min each, low risk)

- Add `favicon.svg` (fixes the 404) + `manifest.json` + `theme-color` → installable on Chrome/Edge/Android. No service worker (avoids caching sensitive data). **[done this PR]**
- Confirm dialog on "Mark Paid" using the existing `ConfirmDialog`. **[done this PR]**
- `focus-visible` ring on the two booking card-links. **[done this PR]**
- `grid-cols-1 sm:grid-cols-2` on the add-member form. **[done this PR]**
- Give `MemberTable` a `renderMobileCard`. **[follow-up]**

## Components that should be standardized

- **Status badges** → one `StatusBadge` with a status→variant map; retire ad-hoc spans and the `STATUS_COLOR` map.
- **Confirmation guards** → route all consequential one-click mutations through `ConfirmDialog`.
- **Mobile data views** → `renderMobileCard` on every wide table (`MemberTable` first).
- **Promote shared patterns to `packages/ui`** so admin reuses them.

## PWA / mobile gaps

| Item | Status |
|---|---|
| Web app manifest | **Absent** → adding (this PR) |
| `theme-color` meta | **Absent** → adding (this PR) |
| `favicon.svg` | **Broken (404)** → adding (this PR) |
| SVG app icon (Chrome/Android installable) | **Absent** → adding (this PR) |
| Raster icon set (180/192/512 PNG, apple-touch-icon) | **Absent** → follow-up (needs raster export from design; logo is a 1221×358 wordmark, not square) |
| Service worker / offline | **Absent** → **intentionally deferred** (healthcare data; cache only static shell if ever added) |
| Viewport allows zoom | **Good** |
| Touch targets (mobile bottom nav 44px) | **Good** |

## Accessibility gaps

- Focus rings missing on the two booking card-links (#7). Otherwise shadcn defaults provide rings.
- Confirm dialogs already use Radix `AlertDialog` (good).
- Icon-only button `aria-label` sweep needed (#12).
- Color-only status encoding: mostly OK (badges carry text + icon), but the ad-hoc spans (#9) should be checked.

---

## Files most affected

- `index.html`, `public/` (PWA assets)
- `src/features/dues/components/dues-invoice-list.tsx` (confirm guard)
- `src/features/membership/components/member-detail.tsx`, `.../application-list.tsx` (confirm guards)
- `src/features/booking/components/{host-directory,booking-list}.tsx` (focus)
- `src/routes/_authenticated/org/$orgSlug/officer/roster/index.tsx` (responsive form)
- `src/features/membership/components/member-table.tsx` (mobile cards)
- `src/providers/OrgProvider.tsx` (permission-denied surface)
- `src/components/patterns/status-badge.tsx` + ad-hoc-span sites (consolidation)

## Recommended implementation order

1. **Safety + PWA (this PR):** Mark-Paid confirm, PWA install assets, focus rings, responsive add-member form.
2. **Confirmation sweep:** Reinstate + bulk-approve guards.
3. **Mobile data views:** `renderMobileCard` for `MemberTable` and other wide tables.
4. **Permission-denied UX:** surface 403 as an "access denied" state instead of swallowing.
5. **Consistency:** consolidate status badges; replace arbitrary classes with token scale; sweep icon-button `aria-label`s.
6. **Architecture:** promote shared patterns to `packages/ui`; raster icon set; (optional) static-shell service worker.

## Implementation status — 2026-06-19

Shipped on `design/ui-ux-audit` (typecheck + lint + UI-consistency ratchet green per commit; production build passes):

| # | Change | Area |
|---|---|---|
| 1 | PWA: `manifest.json` + `theme-color` + `favicon.svg` (fixes 404); no service worker | PWA |
| 2 | Confirm guard on "Mark Paid" (financial mutation) | Safety |
| 3 | Confirm guard on "Reinstate Membership" | Safety |
| 4 | Confirm guard on bulk "Approve Applications" (states the count) | Safety |
| 5 | Roster reflows to cards below 960px container (kills the reported h-scroll) | Mobile |
| 6 | Add-member name fields stack on mobile | Mobile |
| 7 | Focus-visible rings on booking card-links | A11y |
| 8 | `aria-label` on remove-fund icon button | A11y |
| 9 | Status colors consolidated onto `StatusBadge` (booking-list, affiliation-list, special-assessments-list) | Consistency |

Each fix preserves business logic, routes, API calls, permissions, and data behavior.

Deferred (with rationale):

- **Silent 403 → access-denied UI.** Surfacing it properly requires changing the `useOrg()` / `OrgProvider` hook contract to expose error state (a Wave-2 change touching every consumer), and the draft fix was incomplete + type-unsafe (`error.status` on `unknown`). Higher blast radius than a safe drop-in. Needs its own slice.
- **`completion-table` status badge.** Its `waitlisted` branch references a status that isn't in `TrainingEnrollmentStatus` (dead branch). "Fixing" it changes which rows show which color — a behavior change, not cosmetic. Needs product confirmation of intended training statuses.
- **Raster PWA icon set (apple-touch-icon, 192/512 PNG).** No SVG→PNG tool available without a new dependency; would need `sharp` as a devDep + a codegen step, or a one-time export from design. SVG icon already gives Chrome/Edge/Android installability.
- **Arbitrary-class cleanup (~117), admin pattern sharing.** Lower-value churn; left as-is.

> Live-browser visual pass (first-impression, responsive screenshots, interaction feel) was **not** run — it needs the app booted with auth + seed data. Offered as a follow-up.
