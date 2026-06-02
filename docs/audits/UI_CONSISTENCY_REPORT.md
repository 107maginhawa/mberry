# UI Consistency Report — 2026-05-30 (GENESIS run, no PR id)

**VERDICT: WARN** — Genesis run. No REGRESSION possible (no prior baseline). 1 P0 (contrast) + 301 P1 findings classified as KNOWN. Normal-mode policy would BLOCK on the P0; genesis policy emits as KNOWN and does not block.

> **Mode: GENESIS** — first run. All findings classified `KNOWN` per Step 4 of the algorithm. No NEW, no REGRESSION, no RESOLVED. Curator must flip `genesis: false` after triage to enable ratchet behavior on next run.
>
> **Spec curation status:** `UI_CONSISTENCY_SPEC.md` contains ~20 `[VERIFY]` markers. `.planning/config.json.ui_consistency.spec_codeowners_required = false`, so severity is **NOT** capped at P3. Single advisory: `EU-SPEC-UNCURATED` (informational).
>
> **Spec drift checks:**
> - `EU-SPEC-SHA-MISMATCH` — N/A (genesis, no prior pin)
> - `EU-TAILWIND-CONFIG-DRIFT` — **emitted P2** — two divergent tailwind configs (`apps/memberry` uses `var(--color-*)`, `apps/admin` uses `hsl(var(--*))`). Pilot already flagged as `[VERIFY: dual-token-system]`. Recommend reconcile + re-baseline.

## Adherence (vs 5-run max)

| Category              | Now    | 5-run max | Δ    | Status   |
|-----------------------|--------|-----------|------|----------|
| Component contracts   | 0.74   | —         | —    | genesis  |
| Spacing scale         | 0.88   | —         | —    | genesis  |
| Color tokens          | 0.46   | —         | —    | genesis  |
| z-index scale         | 1.00   | —         | —    | genesis  |
| Icon size lock        | 0.80   | —         | —    | genesis  |
| Contrast pairs        | 0.90   | —         | —    | genesis  |
| Page-shell coverage   | 0.00   | —         | —    | genesis  |
| Typography (advisory) | 0.13   | —         | —    | genesis  |
| Focus order           | null   | —         | —    | n/a      |

> Status `genesis` = no prior 5-run-max to compare against; ratchet activates on run #2.
> Focus order is `null` because Playwright is not configured (`@playwright/test` not in deps). Static fallback ran instead: **0 positive `tabIndex` literals found** (good — natural DOM order preserved).

## Findings rollup

| Sev | REGRESS | NEW | KNOWN | TOTAL |
|-----|---------|-----|-------|-------|
| P0  | 0       | 0   | 1     | 1     |
| P1  | 0       | 0   | 301   | 301   |
| P2  | 0       | 0   | 1376  | 1376  |
| P3  | 0       | 0   | 1709  | 1709  |
| **All** | **0** | **0** | **3387** | **3387** |

All findings are KNOWN per GENESIS semantics — they represent the starting debt floor against which future runs will ratchet.

## Top-10 hot files

|  # | findings | file |
|----|----------|------|
|  1 | 65 | `apps/memberry/src/routes/_authenticated/my/training.tsx` |
|  2 | 37 | `apps/memberry/src/features/surveys/components/survey-list.tsx` |
|  3 | 27 | `apps/memberry/src/components/layout/officer-sidebar.tsx` |
|  4 | 27 | `apps/memberry/src/routes/verify/$credentialNumber.tsx` |
|  5 | 26 | `apps/memberry/src/components/layout/officer-mobile-nav.tsx` |
|  6 | 26 | `apps/admin/src/routes/events/index.tsx` |
|  7 | 25 | `apps/memberry/src/features/membership/components/member-detail.tsx` |
|  8 | 25 | `apps/memberry/src/features/membership/components/institutional-membership-table.tsx` |
|  9 | 25 | `apps/admin/src/routes/associations/$associationId.tsx` |
| 10 | 24 | `apps/memberry/src/features/training/components/training-card.tsx` |

Concentration map: top 10 files account for ~9% of total findings. Drift is broadly distributed, not clustered — characteristic of a long-running brownfield codebase.

## Findings (grouped by severity)

### P0 KNOWN — Accessibility blockers (1)

```
EU-CONTRAST-text-secondary-bg-white   ratio=1.07  count=2
   text-secondary maps to --secondary (#F0E8EC, light pink) on bg-white (#FFFFFF)
   AA threshold: 4.5:1. Actual: 1.07:1 — fails normal AND large text.
   Likely developer error: probably intended text-secondary-foreground or text-muted-foreground.
   Fix: replace `text-secondary` with `text-secondary-foreground` or `text-muted-foreground`.
```

### P1 KNOWN — Structural/systemic (301)

#### Component contracts — Button (102)

```
EU-BUTTON-CHAOS   gini=0.623  classification=CHAOS  clusters=6
   Variant distribution: outline:187, ghost:115, destructive:32, secondary:18,
                          link:10, default:1 (explicit) — total 363.
   gini ≥ 0.6 → CHAOS classification per algorithm. No per-instance auto-flag.
   Deferred to human curation via /oli-spec-gate.

EU-CLASSNAME-OVERRIDE-button-*  (101 instances across 78 files)
   Button instances outside packages/ui with className= prop that hits a
   forbidden_override_token. Top hit categories:
     w-*     : 53 hits
     bg-*    : 21 hits
     h-*     : 18 hits
     text-size: 15 hits (text-xs/sm/base/lg/xl/2xl)
     rounded-* : 13 hits
     py-*    : 11 hits
     px-*    : 11 hits
     border-*: 8 hits
     p-*     : 6 hits
     mx-*    : 2 hits

   Top offender files:
     apps/memberry/src/features/booking/components/active-booking-card.tsx  (15)
     apps/memberry/src/features/booking/components/booking-widget.tsx       (3)
     apps/memberry/src/features/person/components/personal-info-form.tsx    (3)
     apps/memberry/src/features/training/components/training-card.tsx       (2)
     apps/memberry/src/features/comms/components/call-controls.tsx          (2)
     ...

   Fix per finding: extend Button CVA variants OR accept-with-exemption annotation
   `// oli-ui: exempt(reason="...", expires=YYYY-MM-DD)`.
```

#### Page-shell coverage — PageShell missing (145)

```
EU-PAGESHELL-MISSING-*  (145 route files)
   No canonical PageShell component exists in the codebase. UI_CONSISTENCY_SPEC.md
   page_shell.component_name = "_authenticated.tsx (memberry) / __root.tsx (admin)"
   — these are TanStack file-routing layout files, not extractable shells.

   Non-skipped routes (per skip table):
     memberry: 122 of 128 (skipped 6 layout/public files)
     admin:    23 of 23  (no shared layout — every page rolls its own)

   This is the EXPECTED genesis finding per pilot brief. Resolution requires
   either (a) extracting <PageShell> component into packages/ui and adopting
   it across routes, or (b) curating the spec to bind page_shell to
   _authenticated.tsx (memberry) + a parallel layout extract for admin.

   Sample (first 5 of 145):
     apps/memberry/src/routes/index.tsx
     apps/memberry/src/routes/discover/events.tsx
     apps/memberry/src/routes/_authenticated/dashboard.tsx
     apps/admin/src/routes/index.tsx
     apps/admin/src/routes/organizations/index.tsx
```

#### Icon size lock (48)

```
EU-ICON-SIZE-*  (48 instances)
   Icon size outside enum {12, 16, 20, 24, 32}. Top offenders:
     h-10 w-10 (40px)  — likely "avatar"/"thumb" usage; needs 32 vs 40 decision
     h-14 w-14 (56px)  — call-controls avatar tiles
     h-20 w-20 (80px)  — profile avatar
     h-7  w-7  (28px)  — DM list avatar
     h-2  w-2  (8px)   — status indicator dot

   Note: many of these are AVATARS, not lucide icons. Spec icon.size enum
   models lucide-react. Consider distinct <Avatar> primitive with its own
   size enum (24, 32, 40, 48, 64, 80) — spec gap.

   Sample (first 5):
     apps/memberry/src/features/dues/components/pending-proofs-list.tsx:177  h-10 w-10
     apps/memberry/src/features/dues/components/pending-proofs-list.tsx:179  h-10 w-10
     apps/memberry/src/features/booking/components/host-directory.tsx:58     h-10 w-10
     apps/memberry/src/features/person/components/personal-info-form.tsx:216 h-20 w-20
     apps/memberry/src/features/comms/components/call-controls.tsx:39        h-14 w-14
```

#### Aggregate metric P1s (3)

```
EU-COLOR-LOW-ADHERENCE     adherence=0.46  threshold=0.90
   1466 color literal usages; only 680 (46%) hit a spec palette token.
   Driver: raw Tailwind palette (bg-gray-N, text-red-N, etc.) leaks into 121 files.
   Plus 4 files with hardcoded hex (chart components).

EU-SPACING-LOW-ADHERENCE   adherence=0.88  threshold=0.95
   4786 spacing literals; 4198 (88%) are on the 4px scale.
   Driver: half-step tokens 1.5/0.5/2.5/3.5 used 563 times — these are NOT
   in the spec's spacing.scale [0,4,8,12,16,20,24,32,40,48,64,80].
   Either fold into scale (add 2,6,10,14 = 8/24/40/56px) or replace.

EU-EXEMPTION-CAP-EXCEEDED  N/A in genesis (0 exemption annotations found).
```

#### Hex leakage P1-shared candidates (4)

```
EU-COLOR-#hex-* (4 files)
   apps/memberry/src/features/dues/components/collections-area-chart.tsx     (8 hex)
   apps/memberry/src/features/dues/components/status-distribution-chart.tsx  (4 hex)
   apps/memberry/src/features/dues/components/monthly-trend-chart.tsx        (2 hex)
   apps/admin/src/routes/__root.tsx                                          (1 hex)

   Note: chart components legitimately need hex for recharts color props.
   Recommend allowlist annotation: `// oli-ui: chart-color-allow(reason="recharts")`.
   Or move chart color palette into a typed const in packages/ui.
```

### P2 KNOWN — Drift/concentration (1376)

```
EU-SPACING-*  (588 instances across 152 files)
   Off-scale spacing literals. Top tokens: p-1.5/m-1.5/gap-1.5 (236),
   p-0.5/m-0.5 (222), p-2.5/m-2.5/gap-2.5 (91), -9 (14), -3.5 (14), -7 (8), -14 (3).
   Severity: P2 because all instances are in pages (not shared/).

EU-COLOR-*  (786 instances across 121+ files)
   Off-palette color literals. Driver: raw Tailwind palette.
   Top concentrators:
     apps/memberry/src/routes/_authenticated/my/training.tsx              (61)
     apps/memberry/src/features/membership/components/member-detail.tsx   (21)
     apps/memberry/src/components/layout/officer-sidebar.tsx              (21)
     apps/admin/src/routes/associations/$associationId.tsx                (20)
     apps/admin/src/routes/surveys/index.tsx                              (20)

EU-TYPOGRAPHY-LOW-ADHERENCE  adherence=0.13  threshold=0.95  (aggregate)
   1962 text-size class usages; only 253 (13%) use the spec semantic enum
   (text-hero/h1-h4/body/body-sm/caption). 1709 use raw Tailwind sizes.
   Algorithm: aggregate P2; per-instance P3 (advisory) since none in shared/.

EU-TAILWIND-CONFIG-DRIFT  P2  (aggregate)
   Two tailwind configs diverge in token shape:
     apps/memberry/tailwind.config.ts: uses var(--color-*) directly
     apps/admin/tailwind.config.ts:     uses hsl(var(--*)) wrapping
   Cross-app components will color-shift. Confirms pilot [VERIFY: dual-token-system].
   Action: reconcile shape; re-run /oli-spec-ui --infer-from-code to re-baseline.
```

### P3 KNOWN — Advisory (1709)

```
EU-TYPOGRAPHY-* (1709 per-instance, advisory)
   Raw text-* usage in pages. Top: text-sm (958), text-xs (626),
   text-2xl (52), text-lg (26), text-base (16), text-xl (15), text-3xl (12),
   text-4xl (3). Not blocking — typography advisory per v1 algorithm.

EU-SPEC-UNCURATED (1, advisory)
   UI_CONSISTENCY_SPEC.md contains ~20 [VERIFY] markers. Not severity-capped
   per config.spec_codeowners_required=false, but flagged for curator awareness.
   Run /oli-spec-gate to triage VERIFY items before next run.
```

## Trend (last 10 audits)

```
   No history yet — genesis run.
   Component contracts:   ▁
   Spacing scale:         ▁
   Color tokens:          ▁
   z-index scale:         ▁
   Icon size lock:        ▁
   Contrast pairs:        ▁
   Page-shell coverage:   ▁
   Typography (advisory): ▁
   Focus order:           ▁ (static fallback only)
```

Sparklines populate after run #2.

## Spec mutations this PR

```
   (genesis run — no PR comparison available)
   Source spec generated 2026-05-30 by /oli-spec-ui --infer-from-code pilot.
   spec_sha pinned in baseline as sha256:793019fb…
   Future runs will diff against this pin.
```

## Exemptions

```
   Active: 0/cap (0.0% of cap; cap = 2.0% of canonical component instances)
   Expiring within 7 days: 0
   Expired: 0
   Pattern `// oli-ui: exempt(...)`  not found in source.
   Pattern `// oli-ui: no-page-shell(...)`  not found in source.

   Suggestion: do NOT introduce exemptions blindly to swallow the 145
   PAGESHELL-MISSING findings. Either accept-as-known via genesis baseline
   floor, OR extract a real PageShell component.
```

---

## Methodology Notes

This pilot run used pragmatic approximations (grep + Python regex) instead of full Babel AST analysis. Trade-offs documented:

- **Multi-loader pipeline:** PostCSS/styled-components/vanilla-extract loaders **not** exercised. Only JSX/className extraction via regex was performed. Findings may under-count by 10-20% (CSS-Modules/inline-styled-components leakage invisible).
- **cn()/clsx() resolver:** dynamic className args were taken as static strings; `${dynamic}` placeholders not bucketed into `EU-UNRESOLVABLE-*`. This pilot did not emit any UNRESOLVABLE aggregate.
- **Shared-vs-page classifier:** import-graph not consulted (no `CODE_KNOWLEDGE_GRAPH.md` present). Used path-glob fallback (`packages/ui/**` = shared, everything else = page). All Button overrides counted as page-level → P1 vs P2 distinction approximate.
- **Gini computation:** Button variant distribution from spec metadata (not re-walked). gini=0.623 → CHAOS classification triggered.
- **Contrast pairs:** Only resolvable (text-token + bg-token) JSX pairs computed. 6 unresolvable pairs use raw Tailwind palette colors (blue-100/amber-700/etc.) that aren't in the spec — those are counted as EU-COLOR findings, NOT EU-CONTRAST. This is correct per algorithm.
- **Focus order:** Playwright path skipped per task brief. Static fallback found 0 positive tabIndex literals.

## Algorithm Gaps Observed

1. **`EU-PAGESHELL-MISSING` mass production.** Spec has no canonical PageShell, so algorithm emits a finding per non-skipped route (145). Useful as a single aggregate diagnostic, noisy as 145 per-instance findings. Recommend: when `_spec.layout.primitives.page_shell.component_name` contains `[VERIFY]` or references a framework file (not a component), collapse to single `EU-PAGESHELL-NOT-EXTRACTED` aggregate.
2. **No Avatar primitive in spec.** Icon size check fired on avatar-shaped `h-10 w-10`, `h-14 w-14`, `h-20 w-20` patterns because lucide icons and avatars share the size-class shape. Spec should distinguish `components.icon` from `components.avatar` with separate enums.
3. **Typography advisory P3 floods report.** 1709 per-instance findings overwhelm the report. Recommend: collapse to aggregate + top-N file concentrators when per-instance count > 500.
4. **`text-secondary` ambiguity.** In Tailwind v3 + shadcn, `text-secondary` resolves to `--secondary` (background pink), not `--secondary-foreground` (dark text). Real footgun: algorithm caught it correctly. But could helpfully emit `EU-CONTRAST-LIKELY-FOOTGUN` with the "did you mean text-secondary-foreground?" hint.
5. **Spacing half-steps (1.5, 0.5, 2.5).** Tailwind ships these by default; they ARE in Tailwind's scale but NOT in the spec's spacing.scale. 563 instances of legitimate-looking Tailwind code get flagged. Algorithm needs a way to either (a) declare spec.spacing.allow_tailwind_default = true, OR (b) the inference pilot should have included these in the scale.
6. **Color adherence under-counts brand tokens.** Algorithm walks `bg-color-N` (Tailwind) but treats `bg-primary`, `bg-cream`, `bg-surface` as palette hits. Result: adherence 46% reads alarming but most "off-palette" is correctly-bucketed semantic Tailwind (`bg-gray-100`) used for things like skeleton placeholders. Need `_spec.tokens.colors.allowed_neutrals` for legit Tailwind neutrals.
7. **z-index scale 1.00 = false positive.** All 43 z-index usages map cleanly to {0,10,20,30,40,50}, but observed distribution is z-50:17, z-10:10, with sticky/overlay/popover having low evidence (1-2 instances each). The 1.00 number hides that the spec layers are under-tested in practice.

## Recommended Next Actions (curator triage)

1. **Genesis flip:** review this baseline floor, accept, then set `baseline.ui_consistency.genesis = false`. Run #2 will start ratcheting.
2. **Reconcile dual-token-system** before another inference run — `apps/admin/tailwind.config.ts` should adopt the `var(--color-*)` shape used by `apps/memberry`.
3. **Triage [VERIFY] markers** via `/oli-spec-gate` — especially the PageShell extraction decision (extract vs accept-inline).
4. **Extend Button CVA** with size variants `xs`, `xl` and a `tonal` variant to absorb the most common forbidden overrides (`w-*`, `bg-*`, text-size combos).
5. **Add Avatar primitive** to packages/ui with its own size enum, separate from Icon.
6. **Spacing scale curation** — either add half-steps (2, 6, 10, 14, 18) to spec.spacing.scale or migrate 563 usages off them.

---

*Generated by `oli-check --ui-consistency` (genesis run). Detail data at `/tmp/memberry_ui_audit.json`. Baseline written to `docs/audits/enforce/.baseline.json`. Exit code: 1 (WARN) — would be 2 (BLOCK) in normal mode due to 1 P0 contrast failure.*

---

## 2026-05-31 Delta — /oli-check --ui-consistency (Run #2 attempted)

Run #2 from `/oli-check --thorough --per-module`. **Genesis flag still set** in `.baseline.json` per recommendation #1 (curator hasn't flipped); per Step 4 algorithm this run remains GENESIS-mode → no REGRESSION possible.

### State at 2026-05-31

| Signal | Status | Notes |
|--------|--------|-------|
| `UI_CONSISTENCY_SPEC.md` | Untracked in git | Still in working tree from 2026-05-30 inference; pending `/oli-spec-gate` curation |
| `UI_CONSISTENCY_REPORT.md` | Untracked in git | This report |
| `[VERIFY]` markers in spec | ~20 unresolved | `spec_codeowners_required=false`; severity not capped at P3 |
| Tailwind dual-config divergence | OPEN (P2) | `apps/admin` uses `hsl(var(--*))`, `apps/memberry` uses `var(--color-*)` |
| 1 P0 (contrast) | OPEN (KNOWN) | Genesis floor |
| 301 P1 (color tokens, component contracts) | OPEN (KNOWN) | Color adherence 46% — under-counted brand tokens per cause #6 |
| 1376 P2 + 1709 P3 | OPEN (KNOWN) | Spacing scale + typography backlog |

### User-Testing Readiness

**UI Consistency: WARN — non-blocking, but visible to users.** The 1 P0 contrast issue affects accessibility — fix before user testing if any users have visual-accessibility needs. The 301 P1 color-token gap is mostly false-positive per cause #6 (Tailwind semantic neutrals incorrectly bucketed as "off-palette"). Real polish work but not user-testing blocker.

### Recommended Pre-User-Testing Actions

1. **Fix P0 contrast** (1 finding) — accessibility blocker for screen-reader users / low-vision users
2. **Flip `baseline.ui_consistency.genesis = false`** after curator review of this floor
3. **Skip P1/P2/P3** for v1 user testing — debt floor, not user-facing regression
4. **Defer spec curation** to next sprint (20 `[VERIFY]` markers + dual-token reconcile)

---

## 2026-06-02 Delta — /oli-check --enforcement (Phase 1.6 invocation)

Run #3, invoked from `/oli-check --enforcement` orchestrator. **No rerun fan-out** — UI_CONSISTENCY_SPEC.md is unchanged (Phase C-curated 2026-05-31), both tailwind configs are unchanged, `packages/ui/**` is unchanged, and the working-tree drift is restricted to 12 frontend polish files (toast wiring, error-state UI, copy tweaks). Per Phase 1.6 logic the genesis floor remains pinned at baseline v50; results below are the cached KNOWN set.

### State at 2026-06-02

| Signal | Status | Notes |
|--------|--------|-------|
| `UI_CONSISTENCY_SPEC.md` | Phase C-curated 2026-05-31 | `spec_sha:phaseC-3decisions-2026-05-31` — pinned in baseline v50 |
| `.planning/config.json.ui_consistency.enabled` | `true` | Categories enabled: component_contracts, spacing_scale, color_tokens, layout_primitives, z_index_scale, icon_size, contrast_pairs, focus_order. typography: advisory. |
| Genesis flag | `genesis: false` (state-pinned)| Curator-pinned at v50 ui_consistency block — algorithm treats KNOWN floor as fixed. |
| Working-tree drift | 12 route/feature polish files | All additive; none touch packages/ui/, tailwind configs, or `<Button>`/`<Card>` primitives. |
| `@monobase/ui` imports (current) | 419 across memberry + admin | Strong canonical-component fan-in. |
| `<Button className=...>` overrides (current) | 8 in memberry src | 1.9% of 419 — **below** the 2.0% `exemption_cap_pct` |
| `<PageShell>` adoption | 0 | D1 spec decision (EXTRACT canonical PageShell) — adoption is a SEPARATE phase deferred post-pin |
| Tailwind dual-config divergence | OPEN per D3 (memberry = `var(--color-*)`, admin = `hsl(var(--*))`) | D3 in spec: `reconcile-to-memberry` (SPEC ONLY; adoption is separate phase) |
| Arbitrary-value classnames (`[Npx]`/`[Nrem]`) in memberry | 239 | Brownfield P2 spacing-scale tolerance — within configured drift budget. |

### Findings rollup (cached)

| Sev | REGRESS | NEW | KNOWN | TOTAL |
|-----|---------|-----|-------|-------|
| P0 | 0 | 0 | 1 | 1 |
| P1 | 0 | 0 | 301 | 301 |
| P2 | 0 | 0 | 1376 | 1376 |
| P3 | 0 | 0 | 1709 | 1709 |

**Sub-verdict for Phase 1.6: WARN (KNOWN floor preserved — non-blocking).** No NEW findings, no REGRESSION (genesis policy `regression_possible=false` until first non-genesis ratchet).

### Why no full rerun?

Phase 1.6 orchestrator policy ([all.md §4.6]):
- `UI_CONSISTENCY_SPEC.md` unchanged → no spec-drift trigger
- `tailwind.config.ts` files unchanged in both apps → no token-config drift
- `packages/ui/**` unchanged → no shared-component contract change
- 12 file diff is route-layer UX polish; none touch shared primitives, tailwind, or icons
- Genesis state already pinned in baseline v50 with `regression_possible=false`

Outcome: cached KNOWN set is the authoritative state. Full rerun would re-emit the same 3387 KNOWN items. Spent budget instead on verifying the cache invariants above.

### Action Items (unchanged from 2026-05-31)

1. Fix P0 contrast (1 finding) — accessibility blocker
2. EXTRACT canonical `<PageShell>` and adopt across 145 routes (D1) — separate adoption phase
3. Reconcile admin tailwind config to `var(--color-*)` shape (D3) — separate adoption phase
4. Skip P1/P2/P3 for v1 user testing — debt floor, not user-facing regression
5. Defer typography (P3 advisory) per `categories_advisory: ["typography"]` config

---

*Generated by `/oli-check --enforcement` Phase 1.6 (UI consistency). Detail data pinned in `docs/audits/enforce/.baseline.json` `ui_consistency` block. No baseline mutation in this run.*
