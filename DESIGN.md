# Memberry — Design System

The source of truth for how Memberry looks and feels. New screens adopt these
patterns instead of inventing their own. When a screen needs something not
covered here, extend this doc rather than one-off it.

## Reference languages

We don't design from scratch — we adopt proven patterns from best-in-class apps
and render them in Memberry's tokens.

- **Stripe Dashboard** — North Star for operational + financial surfaces (roster,
  dues, invoices, payments, applications). Their *Customers* list → our roster,
  *Customer detail* → our member detail.
- **Linear** — reference for list density and calm (compact rows, restraint).
- **Tailwind UI (Application UI) + shadcn blocks** — the implementation source.
  They productize the Stripe/Linear patterns and drop straight into our
  React + shadcn + Tailwind stack.

## Tokens (defined in `apps/memberry/src/styles/globals.css`)

- **Color** — CSS variables only. Primary `#554B68` (muted plum-grey), warm cream
  surfaces, semantic `--color-{success,warning,error,info}` with `-bg` pairs.
  Never use raw Tailwind colors (`bg-red-100`, `text-green-700`) in features.
- **Typography** — DM Sans (display/headings), Plus Jakarta Sans (body),
  JetBrains Mono (`text-mono`) for IDs, license numbers, money, and dates in tables.
  Use the `.text-h1…text-micro` utilities, not arbitrary `text-[13px]`.
- **Radius** — `--radius-sm/md/lg` (8/12/18px). **Spacing** — 4px base scale.

## Background & chrome — do not flatten

- The app background is the **existing four-radial cream gradient** on `body`
  (`globals.css`), `background-attachment: fixed`. Keep it. Do not replace it with
  a flat fill.
- The decorative `memberry-bg.png` on the officer dashboard
  (`officer.tsx`) is intentional — retain it.
- One shell per role (`_authenticated.tsx`, `officer.tsx`), sidebar + mobile
  drawer/bottom-nav, breadcrumbs via `PageShell`. Don't add per-page chrome.

## The list-item pattern (use this for every entity list)

Lists of people/records (members, applications, payments, events) render as a
**list item**, not a label/value grid. Shape (see `MemberCard` in
`features/membership/components/member-table.tsx`):

```
[ ☐ ] (avatar)  Name (link)              [ Status pill ]
                email / sub-id
                fact · fact · fact            ← one inline meta line
                [dues pill]  Training 0/60     ← pills only when relevant
```

Rules:
- **Identity left, status right.** Status is always a `StatusBadge` / badge, never color-only.
- **One meta line of facts that exist.** Build the line from present fields only —
  **never render `—` for missing data; omit it.**
- **Pills only when relevant.** No empty placeholder pills.
- **Reusable.** The same shape serves roster, applications, directory, payments,
  events. If you need a second copy, extract a shared component rather than fork it.

## Cards vs tables (responsive data views)

- Wide container (`≥ 960px` for dense tables): show the full table.
- Narrow container: reflow to the list-item **card** via container queries
  (`cq-roster-*` pattern in `globals.css` + `containerType: inline-size`).
  Never force a wide table to horizontal-scroll on narrow screens.
- Empty cells in a desktop table stay quiet (small muted text), not loud dashes.

## Status colors

Use the shared `StatusBadge` (`components/patterns/status-badge.tsx`) or a
per-domain badge map (e.g. `DuesStatusBadge`). Variants: `success | warning |
error | info | muted | accent`. Every status carries text + color (never color alone).

## UI states

Loading → `Skeleton` matching the layout. Empty → `EmptyState` (icon + headline +
description, optional action). Error → `role="alert"` + `ErrorState`/`Alert`.
Permission-denied → `EmptyState` with an honest message. Success → `sonner` toast.
Consequential one-click mutations (mark-paid, reinstate, bulk-approve) → `ConfirmDialog`.
