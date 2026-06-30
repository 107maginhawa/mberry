# 011 — Membership Nav Shell (Slice 1)

> Slice 1 of the `apps/org` membership-management build.
> Design source of truth: [`docs/product/MEMBERSHIP_MANAGEMENT_UI.md`](../docs/product/MEMBERSHIP_MANAGEMENT_UI.md)
> §"Information architecture" + Build sequence step 1.
> Protocol + scope locks: [`plans/000-execution-standards.md`](./000-execution-standards.md).
> **Classification: FRONTEND-ONLY** (no endpoint, no engine touch, no money/data move).

## Goal

Collapse the flat 6-link `apps/org` nav into a **people-first 3-tab shell** so the app
*feels like a membership app*: `[ 👥 Members ] [ 📅 Events ] [ ⚙ More ]`, bottom bar,
icon **+ text** label, ≥48px taps. Existing routes move under it; sign-out stays in the
header (already wired). No screen content changes — this is the shell only.

## Persona audit (done)

Dr. Olive (officer, older dentist, low tech, mobile, ~1×/year). Single role. All existing
routes remain reachable: Members=`/`, Events=`/events`, More hub=`/import`+`/dues`+
`/announcements`+`/payment-settings`; `/members/$id/send` is a deep link (Members active);
`/sign-in` public/bare. No dead ends, no unreachable routes, no role confusion.

## Design facts (grounded)

- Router: TanStack **file-based**; routes in `apps/org/src/routes/`, tree `routeTree.gen.ts`.
- `__root.tsx` already: `RootGate` auth guard + `AppHeader` (title + `OfficerNav` flat links +
  `onSignOut`). Bare `/sign-in`, spinner while resolving, redirect effect.
- `packages/ui` exports `AppHeader`; **no bottom-tab-bar component** (the one gap to fill).
  Has `nav-icon`, `menu-item`, `Card`, `Button`, etc.
- Money lives on the member (design), so `/dues` is not a top tab; parked in More until
  Slice 3 folds it into member detail.

## Tasks

1. **`BottomTabBar` component → `packages/ui`** (the only net-new UI primitive; design doc
   lists it as a gap; goes in shared ui — no per-app fork). Minimal:
   - Props: `items: { label, icon, active }[]` rendered as a fixed-bottom `<nav>` with one
     `<a>`/slot per item; label **always shown under the icon** (no icon-only). ≥48px tap
     targets, `aria-current` on active, safe-area padding bottom.
   - Router-agnostic: render children/slot for each item so `apps/org` passes TanStack
     `<Link>`s in (ui stays router-free). Icon = lucide (already a ui dep) passed by caller.
   - Tokens only (DESIGN.md): plum/cream, `min-h-tap`, `text-body`. Match `AppHeader` style.
2. **`/more` hub route → `apps/org/src/routes/more.tsx`**: a simple list (reuse `menu-item`
   or `Card` rows, ≥48px) linking Import / Dues / Announcements / Payment settings. One
   primary task per screen = "pick a low-frequency tool." No sign-out here (header has it).
3. **Rewire `__root.tsx`**: keep `AppHeader` (title + sign-out) but **drop the flat
   `OfficerNav` link row**; render `BottomTabBar` (Members/Events/More) for authed users.
   Add bottom padding to the outlet so the fixed bar never covers content. Active-tab logic:
   Members active when pathname `/` or starts `/members`; Events when starts `/events`; More
   when starts `/more|/import|/dues|/announcements|/payment-settings`.
4. **Tests:** ui component test for `BottomTabBar` (renders labels+icons, marks active,
   tap-target class present); `apps/org` E2E real-flow — authed officer sees 3 tabs, tap
   Events → `/events`, tap More → `/more` shows the 4 tools, tap a tool → its route, tap
   Members → `/`. Anchor to rendered DOM/flow, not internal selectors.

## Out of scope (locked)

Directory content, member detail, any endpoint, `/dues` redesign, paid events — later slices.
No engine touch. No new dependency (lucide + TanStack already present).

## Verification (step d)

`cd apps/org && bun dev`; sign in; confirm 3-tab bottom bar, every existing screen reachable,
active tab correct on deep routes, sign-out from header still works, nothing covered by the
bar on mobile width. ui + org typecheck/tests green; `/impeccable` per new surface (shell,
More page). Engine untouched → `services/api-ts` unaffected (no files changed there).
