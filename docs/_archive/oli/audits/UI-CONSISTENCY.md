---
oli-version: "1.0"
based-on:
  - apps/memberry/src/**
  - apps/admin/src/**
  - packages/ui/src/**
  - apps/memberry/tailwind.config.ts
  - apps/memberry/src/styles/globals.css
  - docs/product/UI_CONSISTENCY_SPEC.md
  - docs/audits/UI_CONSISTENCY_REPORT.md
last-modified: 2026-06-02T11:28:51Z
last-modified-by: visual-consistency-auditor
---

# UI Consistency Audit — Memberry

## 1. VERDICT

**MIXED — leaning DIALECT-PER-MODULE.** Overall consistency score: **5.5 / 10**.

The product has the *infrastructure* of a unified system (well-defined `--color-*` tokens in `apps/memberry/src/styles/globals.css:18-71`, shadcn primitives in `packages/ui/src/components/`, custom typography utilities `text-h1..h5`, an `EmptyState`/`PageHeader`/`StatusBadge`/`Skeleton` pattern library at `apps/memberry/src/components/patterns/`) but adoption is uneven and several modules speak their own dialect on top of it. Dues uses a bespoke "glass surface" aesthetic, Training/Elections/Booking hand-roll raw Tailwind palette pills, Admin app rolls its own headers and skeletons, and three parallel typography systems coexist in the codebase. The pieces are there; the discipline is not.

## 2. DIMENSION SCORECARD

| # | Dimension | Score | Worst offenders | Unified fix |
|---|-----------|-------|-----------------|-------------|
| 1 | Spacing scale adoption | **8/10** | `gap-[3px]`, `py-[11px]` in `apps/memberry/src/features/comms`, `dues`, `surveys` (~30 instances). 58 files total with arbitrary spacing values. | Lint-rule blocking `[Npx]` spacing values; replace with token (`p-1`/`p-2`/`p-3`). Most violations are pixel-perfect ports that should round to scale. |
| 2 | Border-radius tokens | **7/10** | 5 radii in use: `rounded-lg` (258), `rounded-full` (223), `rounded` (195, no scale), `rounded-md` (62), `rounded-xl` (41). The bare `rounded` (= 4px shadcn default) leaks into 195 sites despite the DESIGN.md radii being `sm:8/md:12/lg:18/full`. | Strip bare `rounded` and `rounded-md` (62) — DESIGN.md only defines `sm/md/lg/full` (`tailwind.config.ts:90-95`). Add an `oli` rule to flag any radius outside that set. |
| 3 | Typography scale | **3/10** | Three parallel systems: (a) custom utilities `text-h1` (28), `text-h2` (34), `text-h3` (34), `text-h4` (74), `text-body` (55), `text-caption` (26) defined in `apps/memberry/src/styles/globals.css:80-92`; (b) raw Tailwind `text-2xl font-bold` (50), `text-3xl font-bold` (12); (c) arbitrary `text-[10px]` (28), `text-[14px]` (21), `text-[12px]` (17), `text-[26px]` (15), `text-[13px]` (12). Admin app uses `text-h1 text-foreground` exclusively. 4 files mix the two systems. | Pick one. Recommend: keep `text-h1..h5`/`text-body*` utilities as canonical; ban raw `text-2xl/3xl font-bold` and arbitrary sizes via ESLint rule. Memberry/Admin should converge on the custom scale. |
| 4 | Color application | **4/10** | Massive raw-palette drift. 396 instances of `(bg\|text\|border)-(green\|red\|yellow\|blue\|amber\|orange\|emerald)-{50..900}` across 14 modules. Hotspots: `dues` (49), `elections` (22), `training` (19), `booking` (10). `apps/memberry/src/routes/_authenticated/my/training.tsx:21-33` is the worst single file (13 raw uses for status maps). 132 hand-rolled status pills (`bg-X-100 text-X-700` pattern) vs 22 files using the canonical `StatusBadge`. 402 `text-muted-foreground` (canonical) + 72 raw `text-gray-{700,600,500,800,400,300}` (drift). | Stage 1: codemod `bg-green-100 text-green-700` → `success` semantic token; same for red→error, yellow/amber→warning, blue→info. Stage 2: ban raw palette in ESLint; only `success/warning/error/info/primary/muted/secondary/accent` semantic tokens. Stage 3: replace all `text-gray-*` → `text-muted-foreground` or `text-text-secondary`. |
| 5 | Component primitive reuse | **5/10** | See §3 inventory. `<Table>` is mostly fine (single primitive). `<Card>` widely reused but 22 hand-rolled `rounded border bg-card` divs exist. `EmptyState` exists but only 60 files use it; 13 modules still ship hand-rolled "No X yet" divs. `Skeleton` infra: `apps/memberry/src/components/patterns/skeleton-loader.tsx` (Memberry) and `apps/admin/src/components/skeletons.tsx` (Admin, divergent impl) coexist. `Sonner` toast is 100% adopted (76 files, 0 `useToast`). | Promote one skeleton system (Memberry's) to `packages/ui`. Mandate `EmptyState` for all "no data" branches (ESLint rule: empty-render checks). |
| 6 | Button hierarchy | **4/10** | 9 variants exist (`outline:189, ghost:116, destructive:32, secondary:18, link:11, default:1, warning:1, irreversible:1, info:1`). Prior audit (`UI_CONSISTENCY_REPORT.md`) classified this as `CHAOS` (gini=0.623). 101 instances of Button `className` override (forbidden token override) across 78 files. Top abuser: `apps/memberry/src/features/booking/components/active-booking-card.tsx` (15 override hits). `default` is conspicuously almost-absent — implies primary CTAs are inconsistent. | Define a Button decision tree in UI_CONSISTENCY_SPEC.md: primary CTA→`default`, secondary→`outline`, tertiary→`ghost`, destructive→`destructive`. Codemod current usage. Forbid `className` override on Button for `w/h/bg/text-size/rounded/p/m`. |
| 7 | Icon usage | **9/10** | 198/198 files use `lucide-react` — single library. Icon sizes: `h-4 w-4` (110), `h-5 w-5` (19), `h-3 w-3` (16), `h-6 w-6` (15), `h-10 w-10` (15) — broadly consistent. Some `h-4 w-1`/`h-5 w-3` (off-square) probably indicate misuse. | Lock to `h-4 w-4` for inline/sidebar, `h-5 w-5` for section headers, `h-3 w-3` for badges. Off-square sizes (8 instances of `h-4 w-1`, 5 of `h-5 w-3`) flag for review. |
| 8 | Layout primitives | **3/10** | No shared `<Container>` / `<PageContainer>` / `<Stack>` / `<Grid>`. 35 instances of `max-w-3xl` (presumed forms), 21 hand-rolled `max-w-* mx-auto`. `max-w-content` token (defined `tailwind.config.ts:133-135`) is **never used** — 0 references. Responsive padding patterns: `px-0 lg:px-6`, `px-5 md:px-7`, `px-5 md:px-6`, `px-4 sm:px-6`, `px-4 md:px-6`, `px-3 lg:px-4`, `px-2 lg:px-6`, `px-2 lg:px-4` (8 different patterns, each used 1-2x). | Build `<PageContainer>` primitive in `packages/ui` codifying the canonical `max-w-content mx-auto px-4 sm:px-6 lg:px-8`. Mandate via lint rule. |
| 9 | Modal/dialog/sheet | **6/10** | `<Dialog>` (20) and `<AlertDialog>` (3) for confirm/edit/create flows. `<Sheet>` only used for mobile nav drawers (4 places) — appropriate scope. `<Drawer>` is unused. No clear rule when to use Dialog vs full route. Some "edit X" flows route, others modal. | Document in spec: confirm→`AlertDialog`, quick edit (<5 fields)→`Dialog`, complex create/edit→full route. `ConfirmDialog` primitive exists (11 uses) but underadopted. |
| 10 | Form patterns | **5/10** | 19 files use `useForm`/`react-hook-form`. Only 4 import `Form`/`FormField` from `@monobase/ui` — most hand-wire labels/inputs/errors. 21 raw `<form>` tags (likely auth/search flows). Label-on-top is dominant but no enforcement. Required asterisk inconsistent. | Mandate `react-hook-form` + `<Form>`/`<FormField>` primitive for any form with validation. Add `FormPrimitives` example in `packages/ui` docs. |
| 11 | Error/success messaging | **7/10** | Toast (`sonner`) for transient feedback — 100% adoption. `Alert` primitive used for inline. But banner styles inconsistent (e.g., `dues-gate-banner.tsx` rolls custom). 27 `<Alert>` uses. | Codify the four channels: toast=transient, inline-error=field-level (`<FormMessage>`), alert=page-banner (`<Alert>`), AlertDialog=blocking confirm. |
| 12 | Microcopy/tone | **4/10** | 17 "Cancel", 3 "Confirm", 1 "Close" — modest variation, OK. **Title Case dominates (57:1)** in PageHeader titles. Date formats: **15 different `toLocaleDateString` invocations** across 136 sites — `'en-PH'` mostly but variants `'en-US'`, `'undefined'`, and `()` no-args. No central `formatDate` helper. | Build `formatDate(date, 'compact'|'long'|'month'|'datetime')` helper in `@monobase/ui/lib` or `packages/sdk-ts/utils`. Codemod 136 call sites. Decide title-case-vs-sentence-case in spec. |
| 13 | Page header pattern | **5/10** | 95 of 128 routes use `<PageHeader>` (74%), but only 6 *feature components* (across 4 modules: admin/communications/membership). 39 routes hand-roll `<h1 className="text-h1">` etc. Admin app uses `<h1 className="text-h1 text-foreground">` exclusively — no `PageHeader` (0 references in `apps/admin/src`). Inconsistent breadcrumb adoption. | Mandate `PageHeader` for every route-level title. Port `PageHeader` to `packages/ui` so Admin can adopt. Add lint rule: route file must export a `<PageHeader>` or have an annotation. |
| 14 | Tab pattern | **9/10** | `Tabs` from `@monobase/ui` used 9 times, only 1 hand-rolled `role="tab"`. Consistent. | Status quo. Document tab-vs-segmented-control rule. |
| 15 | Status badge pattern | **3/10** | Three coexisting systems: (a) `StatusBadge` primitive (`apps/memberry/src/components/patterns/status-badge.tsx`) — handles 5 states, used in 22 files; (b) shadcn `<Badge variant="secondary"\|"outline">` (56 uses); (c) **132 hand-rolled `bg-{color}-100 text-{color}-700` pills** scattered across 14 modules. Color mapping is inconsistent — green=active in one module is amber=active in another. | Build `<StatusBadge tone="success\|warning\|error\|info\|neutral">` (extend current primitive) as the canonical status indicator. Codemod the 132 hand-rolls. Define one color→state map in `UI_CONSISTENCY_SPEC.md`. |

## 3. PRIMITIVE INVENTORY

| Data shape | Primitive used | Modules using it | Notes |
|---|---|---|---|
| **Table** | `@monobase/ui Table` | 17 files in 8 modules (dues, training, membership, admin, account, chapters, surveys, communications) + 5 admin routes | Custom subclasses: `DataTable` (1 caller), `MemberTable`, `PaymentHistoryTable`, `CompletionTable`. 10 hand-rolled `<table>` mostly in test/survey-results. Mostly healthy. |
| **Card** | `@monobase/ui Card` | 21 imports across most modules | 22 hand-rolled `rounded-{md,lg,xl} border bg-card p-X` divs persist. Dues module uniquely uses `bg-surface-elevated` + `backdrop-blur` glass cards (15+ files) — a module-specific dialect. |
| **EmptyState** | `apps/memberry/src/components/patterns/empty-state.tsx` | 60 files across 11 modules | Heavy adopters: dues (6), comms (3), dashboard (3), directory (3). **Zero** in profile, training, surveys, billing, chapters, documents, events, elections, onboarding, invite. 13 confirmed hand-rolled. |
| **Loading state** | `Skeleton`, `ListSkeleton`, `CardSkeleton`, `TableSkeleton`, `ProfileSkeleton` | 120 files use a Skeleton variant. 29 files use spinner (`Loader2 animate-spin`). 16 use raw `"Loading..."` text. | **Two parallel skeleton systems**: `apps/memberry/src/components/patterns/skeleton-loader.tsx` (rich, custom shimmer animation) vs `apps/admin/src/components/skeletons.tsx` (basic `animate-pulse`). Divergent shimmer animations between apps. |
| **Form** | `react-hook-form` + shadcn `<Form>/<FormField>` | 4 files import `Form` from `@monobase/ui`; 19 use `useForm` | Most forms hand-wire `<Label>`+`<Input>` outside the Form context — bypassing the accessibility/error-rendering wiring. 21 raw `<form>` tags. |
| **Toast** | `sonner` | 76 files, 0 `useToast` | Single source. Healthy. |
| **Status badge** | Mixed: `StatusBadge` (22 files), `<Badge variant=*>` (56), hand-rolled pills (132) | All 14 active modules ship at least one variant | The most fragmented primitive in the codebase. |
| **PageHeader** | `apps/memberry/src/components/patterns/page-header.tsx` | 95 routes in memberry, 0 in admin, 6 feature components | Admin app does not use it — rolls its own `<h1 className="text-h1 text-foreground">`. |
| **Dialog/Sheet** | `@monobase/ui Dialog/Sheet/AlertDialog` | Dialog 20, Sheet 4, AlertDialog 3 | Sheet correctly scoped to mobile nav. Dialog rule unwritten (Dialog vs route). |
| **Tabs** | `@monobase/ui Tabs` | 9 files | Healthy. |

## 4. TOP 10 CONSISTENCY WINS

1. **Codemod 132 hand-rolled status pills → `<StatusBadge>` primitive.** Extend `StatusBadge` to accept `tone="success\|warning\|error\|info\|neutral"`. Eliminates the single biggest visual-dialect signal across modules. **Effort: M (1 day) · Impact: HIGH (visible everywhere).**
2. **Build `<PageContainer>` + adopt in every route.** Replaces 21 hand-rolled `max-w-* mx-auto`. Activates the unused `max-w-content` token. **Effort: S (2h) · Impact: HIGH (page-shell coverage jumps from 0% to ~100%).**
3. **Build `formatDate()` helper, codemod 136 `toLocaleDateString` call sites.** End the date-format zoo (15 variants). **Effort: M (4h) · Impact: HIGH (user-facing).**
4. **Eliminate raw Tailwind palette colors.** ESLint rule banning `(bg\|text\|border)-{green,red,yellow,blue,amber,orange,emerald}-{N}`; force `success/warning/error/info` semantic tokens. **Effort: M (1 day) · Impact: HIGH (396 instances → 0).**
5. **Adopt `PageHeader` in apps/admin (port to `packages/ui`).** Admin currently rolls its own — 10+ routes inconsistent. **Effort: S (3h) · Impact: MEDIUM (Admin reads like a different product today).**
6. **Pick one typography scale: `text-h1..h5` OR raw Tailwind.** Codemod 62 sites currently using `text-2xl/3xl font-bold` to `text-h2/h1`. Ban arbitrary `text-[Npx]` (94 instances). **Effort: M (1 day) · Impact: HIGH (typographic hierarchy currently incoherent).**
7. **Unify skeleton systems.** Promote `apps/memberry/src/components/patterns/skeleton-loader.tsx` to `packages/ui`. Delete `apps/admin/src/components/skeletons.tsx`. **Effort: S (2h) · Impact: MEDIUM.**
8. **Mandate `EmptyState` for "no data" branches.** 13 modules ship hand-rolled empty states. Add a lint rule that flags `>No [a-z]+ (yet\|found\|available)<` outside `EmptyState`. **Effort: S (2h) · Impact: MEDIUM.**
9. **Forbid Button `className` overrides for layout tokens.** Existing audit (`UI_CONSISTENCY_REPORT.md`) flags 101 instances across 78 files. Add lint rule on `w-*/h-*/bg-*/text-{size}/rounded-*/p-*` against `<Button>`. **Effort: M (1 day) · Impact: MEDIUM.**
10. **Decide Title-Case vs Sentence-case for headings; codemod.** 57 Title-Case, 1 Sentence-case currently. Pick one in spec (Sentence-case is modern default). **Effort: S (1h) · Impact: LOW–MEDIUM (tonal cohesion).**

## 5. DIALECT MAP

Per-module dialect score (1-10, **lower = more dialect-y**). Signals: raw palette, arbitrary spacing, primitive bypass, custom aesthetic.

| Module | Files | Raw palette | Arbitrary spacing | Hand pills | StatusBadge use | EmptyState use | Score | Dialect notes |
|---|---|---|---|---|---|---|---|---|
| dues | 52 | 49 | 5 | 6 | 5 | 6 | **4/10** | Bespoke "glass surface" aesthetic (`bg-surface-elevated`, `backdrop-blur`, `shadow-soft/medium/deep`) — only module using it. Heavy `text-[26px]`, `font-mono`, custom metric cards. |
| training | 8 | 19 | 1 | 9 | 0 | 0 | **3/10** | `my/training.tsx` is the worst single file in the codebase (65 findings per prior audit). 13 raw palette pills for status. Zero primitive reuse for empty/status. |
| elections | 13 | 22 | 0 | 6 | 1 | 0 | **4/10** | Status-pill colors hand-mapped per-component (different greens for "active"/"won"). Detail screens diverge from list aesthetic. |
| admin (app) | 9 routes/9 features | 0+5 | 1 | 0 | 0 | 2 | **5/10** | Uses tokens correctly but does not use `PageHeader`, has its own `skeletons.tsx`, hand-rolls all `<h1>`. Reads like a different product. |
| booking | 8 | 10 | 0 | 6 | 0 | 1 | **5/10** | `active-booking-card.tsx` is the top Button `className` override file (15 violations). Hand-rolled status pills. |
| surveys | 16 | 7 | 3 | 4 | 1 | 0 | **5/10** | 37 findings in `survey-list.tsx`. Hand-rolled cards & status. Mixes `text-2xl font-bold` with `text-h2`. |
| membership | 14 | 5 | 6 | 9 | 1 | 2 | **5/10** | Mostly canonical, but `member-detail.tsx` is a hotspot (25 findings). Hand-rolled institutional status pills. |
| comms | 20 | 6 | 4 | 1 | 0 | 3 | **6/10** | Mostly token-aligned but chat-view has `text-[14px]`, custom dimensions (`w-[280px]`). Real-time UX justifies some custom sizing. |
| events | 11 | 8 | 4 | 1 | 0 | 0 | **6/10** | Calendar component uses raw colors for date states. |
| communications | 18 | 5 | 2 | 4 | 0 | 1 | **6/10** | Analytics screen drifts (custom percentage cards). |
| dashboard | 12 | 1 | 2 | 0 | 2 | 3 | **8/10** | Healthy. Action widgets use canonical tokens. |
| profile | 4 | 6 | 0 | 0 | 0 | 0 | **6/10** | Few files; profile page hand-rolls form layout. |
| documents | 5 | 1 | 1 | 1 | 0 | 0 | **7/10** | Low surface, mostly clean. |
| certificates | 4 | 0 | 0 | 0 | 0 | 2 | **9/10** | Clean. |
| chapters | 2 | 0 | 0 | 1 | 0 | 0 | **7/10** | Minimal surface. |
| directory | 6 | 0 | 1 | 0 | 1 | 3 | **8/10** | Good primitive reuse. |
| notifications | 2 | 0 | 0 | 0 | 0 | 2 | **9/10** | Clean. |
| account | 2 | 0 | 0 | 0 | 0 | 2 | **9/10** | Clean. |
| billing | 1 | 9 | 0 | 0 | 0 | 0 | **5/10** | Single file but 9 raw color uses. |

**Top 3 dialect-y modules:** training, dues, elections. **Cleanest 3:** notifications, account, certificates.

## 6. SHIPPED PRIMITIVE GAPS

Primitives that EXIST but are **not** used at expected rate (BI-3 pattern):

| Primitive | Path | Expected callers | Actual callers | Gap |
|---|---|---|---|---|
| `StatusBadge` | `apps/memberry/src/components/patterns/status-badge.tsx` | Every status indicator across 14 modules (~150+ sites) | 22 files | **132 hand-rolls bypass it.** Primitive only supports `MembershipStatus` enum — needs generalization. |
| `PageHeader` | `apps/memberry/src/components/patterns/page-header.tsx` | All 128 routes + section headers in feature components | 95 routes + 6 features (0 in admin) | **33 routes hand-roll `<h1>`; admin app does not use it.** |
| `EmptyState` | `apps/memberry/src/components/patterns/empty-state.tsx` | Every list/table with possible empty state (~80+ places) | 60 files in 11 modules | **13 hand-rolled empty messages; 8 modules ship zero `EmptyState` despite having empty states (training, elections, events, profile, surveys, billing, documents, onboarding).** |
| `ConfirmDialog` | `apps/memberry/src/components/patterns/confirm-dialog.tsx` | All destructive confirmations | 11 files | **Several modules call `<AlertDialog>` directly instead.** |
| `StatCard` | `apps/memberry/src/components/patterns/stat-card.tsx` | Dashboard/finance metric cards | (low) | Dues builds its own glass `metric-card.tsx` instead. |
| `DataTable` | `apps/memberry/src/components/patterns/data-table.tsx` | List screens with sorting/pagination | 1 caller | Defined but practically dead code. Modules use raw `<Table>` instead. |
| `<Form>/<FormField>` from `@monobase/ui` | `packages/ui/src/components/form.tsx` | All `react-hook-form` forms (19) | 4 imports | **15 forms hand-wire labels/inputs/errors instead.** |
| `max-w-content` token | `apps/memberry/tailwind.config.ts:133` | All page wrappers | **0 uses** | Token defined but never referenced. 21 hand-rolled `max-w-{3xl,4xl,6xl,7xl}` instead. |
| `font-display`/`font-body`/`font-mono` | tailwind config | Headings/body/numeric | 55/1/72 | Custom typography utilities (`text-h*`) already include the family — explicit font classes mostly redundant; `font-body` (1 use) implies confusion about defaults. |

## 7. TOKEN HYGIENE

**Defined and well-used** (`globals.css:18-71`):
- `--color-primary` (246 uses), `--color-muted` (869), `--color-error` (234), `--color-success` (117), `--color-warning` (84), `--color-info` (45), `--color-surface-warm` (167), `--color-border-light` (113) — solid.

**Defined but underused / over-narrowly used:**
- `--color-cream`, `--color-cream-light`, `--color-cream-dark` — brand accents; usage not surfaced via grep, probably <10 sites. Brand identity not asserted.
- `--color-primary-bg` (11 uses) — exists but barely applied.
- `--color-primary-mid`, `--color-primary-light`, `--color-primary-lighter` — gradients across the primary scale; almost no usage. Hierarchy via shade is unrealized.

**Defined and effectively dead:**
- `max-w-content: 1200px` (`tailwind.config.ts:133-135`) — **0 uses**. Should be the page-width contract.
- `--shadow-soft/medium/deep` — only 17 `shadow-soft` uses, all in `dues`. Other modules use shadcn default shadows or none.
- `font-body` (1 use). The `font-display`/`font-mono` are baked into custom utilities anyway.

**One-off arbitrary values that should become tokens:**
- `w-[200px]` (10), `w-[160px]` (7), `w-[280px]` (5) — recurring panel/sidebar widths. Candidate for `--width-panel-sm/md/lg`.
- `h-[34px]`, `w-[34px]` (5 each) — recurring small-avatar dimension. Should join the avatar size scale.
- `text-[26px]` (15) — used in metric/stat values. Should be a `text-stat` utility (alongside `text-h*`).
- `text-[10px]` (28), `text-[11px]` (6), `text-[12px]` (17), `text-[13px]` (12), `text-[14px]` (21) — should map to `text-caption`/`text-body-sm`.

**Drift signal from `UI_CONSISTENCY_REPORT.md` (corroborated):** `EU-TAILWIND-CONFIG-DRIFT` — `apps/memberry` uses `var(--color-*)`, `apps/admin` uses `hsl(var(--*))`. Two parallel token formats in one monorepo.

---

## Summary line

Memberry has the bones of a unified design system (canonical tokens, custom typography scale, a respectable pattern library at `components/patterns/`, single icon library, single toast library) but the *muscle* is uneven — three typography systems coexist, 132 hand-rolled status pills bypass the `StatusBadge` primitive, 396 raw-Tailwind-palette colors leak past semantic tokens, no shared `<PageContainer>` exists, and the Admin app reads like a fork of Memberry rather than a sibling. The Dues module has invented its own "glass surface" aesthetic distinct from the rest; Training/Elections/Booking each speak their own status-color dialect. Fixing the top 5 wins (StatusBadge codemod, PageContainer, formatDate helper, raw-palette ban, Admin PageHeader adoption) would lift the verdict from MIXED → ONE PRODUCT without rewriting a single feature.
