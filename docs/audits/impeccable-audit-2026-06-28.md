# Impeccable Technical Audit — 2026-06-28

Code-level audit (a11y / perf / theming / responsive / anti-patterns) of `packages/ui`
+ `apps/member` + `apps/org` + `apps/console`, scored against DESIGN.md. Static source
review, not a live browser pass. Each surface scored 0-4 per dimension.

## Health scores (per surface, /20)

| Surface | A11y | Perf | Theming | Responsive | AntiPat | Total | Band |
|---|---|---|---|---|---|---|---|
| packages/ui | 2 | 3 | 3 | 2 | 4 | **14/20** | Good (weak a11y/responsive) |
| apps/member | 3 | 3 | 3 | 4 | 4 | **17/20** | Good (top end) |
| apps/org | 3 | 3 | 3 | 3 | 3 | **15/20** | Good |
| apps/console | 3 | 4 | 3 | 3 | 3 | **16/20** | Good |

No P0s. The shared design system (`packages/ui`) is the weakest surface and its gaps
amplify into all three apps — fix there first for the most leverage.

## Anti-patterns verdict

**Pass.** No AI-slop tells: no gradient text, no glassmorphism-by-default, no eyebrow
kickers, no numbered-section scaffolding, no side-stripe borders, no bounce/elastic
easing, no nested cards (the `ErrorState bare` prop we just shipped explicitly prevents
double-frames). The cream radial wash is a DESIGN.md mandate, not slop. Two borderline
metric-grids flagged below (org Dues 2×2, console 6-tile) — permitted-ish, noted.

## Top findings (cross-cutting, highest leverage first)

### [P1] Dead `text-h2` utility shrinks every page title to body size
`packages/ui/src/components/page-shell.tsx:128` — `<TitleTag className="text-h2">`.
The preset (`tailwind-preset.ts:31`) defines the step as `title` (30px), NOT `h2`.
`text-h2` is an undefined Tailwind class → no font-size emitted → every page `<h1>`
across org/member/console inherits 18px body instead of 30px. The primary "where am I"
orientation cue is shrunk for the older target user. **Fix:** `text-title` (or add an
`h2` alias to the preset). _Verify quickly: confirm preset has no `h2`/`text-h2` key._

### [P1] Sub-48px tap targets on shared primitives
`packages/ui/src/components/checkbox.tsx:14` (16px), `switch.tsx:12` (20px tall),
`select.tsx:20` (`h-9` = 36px). Violates the non-negotiable ≥48px floor (WCAG 2.5.5)
for older dentists on phones. `min-h-tap`/`min-w-tap` tokens already exist. Amplifies
into every app that uses these.

### [P1] Core officer action does a full-page reload
`apps/org/src/features/roster/Roster.tsx:203` — send-pay-link uses raw `<a href>` to an
internal route. Every tap = full document reload (re-auth, re-fetch session+roster, lost
scroll) on slow PH mobile. Everywhere else uses TanStack `<Link>`. **Fix:** `<Link to=…>`.

### [P2] Sub-16px text from un-retuned shadcn defaults (systemic)
`text-sm`/`text-xs` (13.5–15.75px) below DESIGN's "never below 16px" floor in:
`table.tsx:13` (hits console org list + any table), `label.tsx:8`, `form.tsx:136,158`
(error/validation copy — exactly what an older user must read to recover),
`select.tsx`, `dropdown-menu.tsx`, `badge.tsx`. Root cause: shadcn primitives ported but
not re-pointed at the `body`/`caption` type tokens. Input + default Button were fixed;
these were not.

### [P2] org has zero `Skeleton` loading states
`Roster.tsx:260`, `dues/DuesView.tsx:184`, `events/EventsList.tsx:32`,
`payment-settings/PaymentSettings.tsx:94` — all plain "Loading…" text. DESIGN's UI-state
contract says Loading → `Skeleton`. member + console use skeletons; org doesn't. Content
jump on load, no shape preview.

### [P2] console empty/error states bypass the mandated components
`apps/console/src/features/orgs/OrgsView.tsx:169,175,189` — raw `<p>` for failed-load,
no-orgs, and no-match. DESIGN mandates `ErrorState` (role=alert) + `EmptyState` (icon +
headline + CTA). Both exist in packages/ui, neither imported here. Empty org list gives
no "Create your first organization" affordance.

### [P2] Hand-rolled `<input>` forks the shared `Input` (member + org)
`apps/member/src/features/auth/SignInForm.tsx:92` and
`apps/org/src/features/auth/SignInForm.tsx:89-96,116-127` — raw `<input>` instead of
`@monobase/ui` `Input`. Misses the standard `focus-visible:ring-2` + token states;
relies on browser default outline. DESIGN: no per-app forks.

### [P2] Money pay screen has no heading / no landmark (member)
`apps/member/src/routes/pay/$token.tsx:30` (`<div>` wrapper), `PayCard.tsx:49` (orgName
as `<p>`). The login-free pay-link — the single most important money screen — has no
`<h1>` and no `<main>`. Screen-reader users get no title/landmark on the highest-stakes
flow. Same on PayResult terminals.

### [P2] Em-dash rendered for missing data (member)
`apps/member/src/features/dashboard/ReceiptsTile.tsx:72` — `: '—'` → a receipt with no
`paidAt` shows "Paid —". DESIGN list-item rule: never render `—` for missing data; omit
the line instead.

### [P2] Borderline metric-grid dashboards
`apps/org/src/features/dues/DuesView.tsx:75` (2×2 of 4 identical stat cards — on a 320px
phone large ₱ values wrap/clip) and `apps/console/.../OrgsView.tsx:101` (6 identical
tiles). DESIGN: org stays single-column, no identical-card-grid/hero-metric. Console is
exempt-ish (operator). Reflow org to single-column; consider grouping console tiles.

### [P2/P3] Font + perf + token-idiom polish
- [P2] `packages/ui/src/tokens.css:12` font via CSS `@import` (render-blocking, serialized)
  with no `<link rel="preconnect">` in `apps/member/index.html` — slow first paint on PH
  mobile. Add preconnect or self-host.
- [P3] Arbitrary `var()` color utilities where semantic classes exist (member
  StandingHero:141, PayCard:57, ContactOfficer:20).
- [P3] caption token = 15px contradicts DESIGN's own "never below 16px" — internal
  contradiction; reassurance copy on money screen (PayCard.tsx:99) renders small+muted.
- [P3] Static `<title>Memberry</title>` on all member routes; no per-screen title.
- [P3] org duplicate "Payment settings" heading (route h1 + CardTitle); raw `text-lg`
  heading (events.tsx:24); hand-rolled alert banners where shared `Alert` exists.
- [P3] root loading gates render a literal `…` glyph (org + console).

## Positives (keep / replicate)

- **Token discipline is strong** — grep found zero hardcoded hex / raw Tailwind palette
  colors in any component or app. All color via CSS vars / preset.
- **Money safety is exemplary** — every live-money/destructive action gated by
  `ConfirmDialog` with the explicit amount (org); pay/RSVP buttons disabled on
  pending/success to prevent double-charge (member, idempotency-aware UI).
- **`prefers-reduced-motion` handled globally** (`tokens.css:118`) — neutralizes shimmer,
  pulse, and all Radix zoom/slide. Comprehensive.
- **member UI-state coverage is complete** — every surface has Skeleton + ErrorState
  (role=alert + retry) + EmptyState.
- **console stats honesty** — em-dash + "No snapshot" note instead of confident fake zeros.
- **No icon-only controls** in app code — aria-labels on all icon actions; Button default
  is 48px; status always text+color via `StatusBadge`.
- **org retry parity is complete, not half-done** — ErrorState onRetry → real refetch on
  Roster/Dues/Events/PaymentSettings.

## Systemic root causes (fix these, not symptoms)

1. **shadcn primitives never re-tuned to the system.** One pass over packages/ui to point
   checkbox/switch/select/table/label/form/dropdown/badge at the `body`/`caption` type
   tokens + `min-h-tap` clears most of A11y + half of Responsive across all apps. The dead
   `text-h2` proves nothing lints invalid utility names.
2. **State-component contract applied unevenly.** member = full coverage; org skips
   Skeleton; console skips EmptyState/ErrorState. Make Skeleton/Empty/Error mandatory.
3. **A few per-app forks** (hand-rolled inputs, inline alert banners) drift from the
   no-fork rule — route through shared `Input` / `Alert`.

## Recommended next steps (priority order)

1. **[P1] packages/ui primitive retune** — `text-h2`→`text-title`, ≥48px on
   checkbox/switch/select, lift table/label/form-message off `text-sm`. Highest leverage
   (one diff, fixes all apps). → `/impeccable harden` on packages/ui.
2. **[P1] org Roster send-link → `<Link>`** (kill full reload). → direct fix.
3. **[P2] org Skeleton loading states.** → `/impeccable polish` apps/org.
4. **[P2] console EmptyState/ErrorState.** → direct fix.
5. **[P2] member pay screen `<main>`+`<h1>`; ReceiptsTile drop `—`; SignInForm shared
   `Input`.** → `/impeccable harden` apps/member.
6. **[P2] member font preconnect.** → `/impeccable optimize`.
7. **[P2/P3] org Dues single-column reflow; console tile grouping.** → `/impeccable layout`.
8. **[P3] sweep:** semantic color classes, caption=16px decision, per-route titles,
   dup headings, shared `Alert`. → `/impeccable polish` (final pass).

Re-run `/impeccable audit` after fixes to watch the scores climb (packages/ui 14 → ~18
once the primitive retune lands).

---

## Re-audit results

### After P1→P3 remediation (v0.1.22.0)

| Surface | Before | After | Notes |
|---|---|---|---|
| packages/ui | 14 | **17** | A11y still 2/4 (un-retuned primitives), Responsive 3/4 |
| apps/member | 17 | **17** | found a regression: PayResult InfoIcon left inline-styled |
| apps/org | 15 | **18** | at bar |
| apps/console | 16 | **19** | past bar |

### After the to-18 accessibility pass (v0.1.22.1)

| Surface | Score | Path taken |
|---|---|---|
| packages/ui | **~19** | A11y 2→~4 (interactive text → 18px, tap targets → 48px, required aria-label on icon button); Responsive held at 3 (table reflow skipped — see below) |
| apps/member | **~19** | Theming regression fixed (InfoIcon off inline style), glyph icons → real lucide, critical error text → body |
| apps/org | **~20** | status enum → friendly labels, amount input un-forked, semantic color tokens |
| apps/console | **~20** | all role=alert text → 16px+ |

**Deliberate non-fix (documented YAGNI):** the shared `Table` still wraps wide
content in `overflow-auto` (horizontal scroll) rather than a container-query
reflow to list-cards. DESIGN exempts the console table and no phone-primary table
surface exists, so building a `ResponsiveTable` purely to move packages/ui's
Responsive 3→4 is not worth the code. Revisit if a member/officer phone screen
ever needs a wide data table. This is the only thing holding packages/ui below 20.
