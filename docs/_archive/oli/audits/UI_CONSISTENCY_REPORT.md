<!-- oli-version: 1.1 -->
<!-- based-on: map@64b96139 -->
<!-- based-on-detail: docs/product/UI_CONSISTENCY_SPEC.md (Phase C-curated 2026-05-31, pinned in .baseline.json v58), docs/audits/PATTERNS.lock.md (oli-version 1.1, baseline-pin v57 — unchanged this cycle), apps/memberry/tailwind config, apps/admin/tailwind config, CODE_COMPONENT_REGISTRY.json (engine map FRESH @ 64b96139), packages/ui/src/components/round-action-button.tsx (NEW @ 9fbcb497) -->
<!-- generated: 2026-06-04T03:00:00Z -->
<!-- last-modified: 2026-06-04T03:00:00Z -->
<!-- last-modified-by: /oli-check --ui-consistency --auto (Phase-D rebaseline-007 verification / no-regression cycle) -->
<!-- mode: ACTIVE -->
<!-- baseline-pin: docs/audits/enforce/.baseline.json v58 ui_consistency.history[6] (run_id phase-d-rebaseline-007, pinned 2026-06-04T02:30:00Z) -->
<!-- verdict: PASS (P0=0, P1=0 — no regression, ratchet HARDENED via .husky/pre-commit) -->
<!-- code-map-sha: 64b96139a21933afc750d90d3f76992d180fec54 -->
<!-- map freshness: FRESH (HEAD 64b96139; aggregator-rescanned at cycle start; covers all 5 post-rebaseline-006 commits) -->

# UI Consistency Report — 2026-06-04 (Phase-D rebaseline-007 verification)

**VERDICT: PASS — NO REGRESSION.** Detector run across full `apps/**` + `packages/**` `.tsx` corpus exits 0. **P0=0, P1=0.** All 15 ui-c-exempt annotations from rebaseline-007 (annotations 22→15 after Step-1 redundant-route removal) are stable. RoundActionButton primitive (commit 9fbcb497) cleanly adopted at 8 call sites across 3 files (call-controls×4, video-lobby×2, personal-info-form×2). Ratchet stays HARDENED via `.husky/pre-commit` → `scripts/ui-consistency-check.sh --staged`. **No new debt. No code change this cycle.**

---

## Run Context

| Field | Value |
|-------|-------|
| Sub-check | `~/.claude/skills/oli-check/dimensions/enforcement/ui-consistency.md` |
| Mode | **ACTIVE** — verification cycle (no rebaseline) |
| Cycle | `/oli-check --ui-consistency` (aggregator dispatch, map FRESH) |
| HEAD | `64b96139` |
| Map SHA | `64b96139a21933afc750d90d3f76992d180fec54` (FRESH; engine rescan at cycle start) |
| Baseline pin (prior) | `v57` `ui_consistency.history[5]` (`phase-d-rebaseline-006`, 2026-06-04T01:30:00Z) — P0:0, P1:0, annotations 34 |
| Baseline pin (current) | `v58` `ui_consistency.history[6]` (`phase-d-rebaseline-007`, 2026-06-04T02:30:00Z) — P0:0, P1:0, annotations 15 |
| Pattern lock | `docs/audits/PATTERNS.lock.md` (oli-version 1.1, baseline-pin v57) — **unchanged** this cycle |
| Pre-commit hook | `.husky/pre-commit` → `bun run typecheck && bunx lint-staged && ./scripts/ui-consistency-check.sh --staged` — **ACTIVE** |
| Detector run | `find apps packages -name '*.tsx' … \| bun run scripts/ui-consistency-detect.ts --stdin` → **exit 0** |
| Annotations (live grep) | **15** (matches v58 baseline notes exactly) |
| Exemption rate | 15 annotated / 15 detector matches = **100%** annotated (0% unannotated) |

---

## Commits Since Prior Cycle (rebaseline-007)

| SHA | Subject | UI-C impact |
|-----|---------|-------------|
| `64b96139` | chore(audit): rebaseline-007 — post-Tier-F polish (annotations 22→15; test-infra fixed) | audit-only (baseline doc + .baseline.json v58 entry) — no source change |
| `9fbcb497` | refactor(ui): Step-3 — RoundActionButton primitive codifies 32/48/56px round controls | NEW primitive `packages/ui/src/components/round-action-button.tsx`; migrates 8 sites; removes `h-8/12/14 w-8/12/14 rounded-full` className overrides → variant prop |
| `082557f4` | fix(test-infra): route apps/{admin,memberry} test scripts through root bun:test preload | no .tsx churn; package.json scripts only |
| `87c7b57d` | refactor(ui-c): Step-1 — remove 12 redundant route inline annotations | removes 12 `ui-c-exempt` annotations on routes already covered by central `INTENTIONAL_EXEMPT_ROUTES` Set in `scripts/ui-consistency-detect.ts` (annotations 34→22) |
| `0c83eb8f` | chore(audit): Phase-D Tier-F rebaseline-006 — backlog clearance + baseline v57 | rebaseline-006 baseline entry (annotations 93→34) |

**Net source diff vs rebaseline-006 baseline:** 272 files touched in `apps/memberry/`, 40 in `apps/admin/`, plus the new `RoundActionButton` primitive — all detector-clean.

---

## Trigger Evaluation

| Trigger | Pinned (rebaseline-007 v58) | Current (HEAD 64b96139) | Drift? | Action |
|---------|------------------------------|--------------------------|--------|--------|
| `UI_CONSISTENCY_SPEC.md` SHA | `sha256:793019fb…f43f` | unchanged | NO | hold |
| `apps/{memberry,admin}/tailwind.config.ts` | pinned 2026-05-31 | unchanged | NO | hold |
| `packages/ui/src/components/button.tsx` | Tier-C +3 variants +3 sizes | **same** | NO | hold |
| `packages/ui/src/components/page-shell.tsx` | Tier-C | **same** | NO | hold |
| `packages/ui/src/components/nav-icon.tsx` | Tier-F (rebaseline-006) | **same** | NO | hold |
| `packages/ui/src/components/menu-item.tsx` | Tier-F (rebaseline-006) | **same** | NO | hold |
| `packages/ui/src/components/round-action-button.tsx` | **NEW** post-Tier-F (rebaseline-007 @ 9fbcb497) | **same** | NO | hold |
| `docs/audits/PATTERNS.lock.md` (v1.1) | baseline-pin v57 | **unchanged** | NO | hold |
| `.husky/pre-commit` UI-C line | active | **active** | NO | hold |
| Route adoption breadth | 124 routes + 27 INTENTIONAL-EXEMPT | **same** (no new routes added) | NO | hold |

**Net trigger verdict:** No new primitives, no detector spec change, no INTENTIONAL-EXEMPT list growth. This cycle is a **pure verification pass** against the v58 floor. Zero rebaseline needed.

---

## Adherence (vs prior floor + 5-run max)

| Category              | Now    | rebaseline-007 | rebaseline-006 | 5-run max | Δ vs floor | Status   |
|-----------------------|--------|----------------|----------------|-----------|------------|----------|
| Component contracts (Button) | **1.00** | 1.00 | 1.00 | 1.00 | —          | hold (HARDENED via RoundActionButton primitive) |
| Spacing scale         | 0.88   | 0.88 | 0.88 | 0.88 | —          | hold     |
| Color tokens (hex leak) | **1.00** | 1.00 | 1.00 | 1.00 | —          | hold (admin chrome now token-backed, single-source) |
| z-index scale         | 1.00   | 1.00 | 1.00 | 1.00 | —          | hold     |
| Icon size lock        | **1.00** | 1.00 | 1.00 | 1.00 | —          | hold (NavIcon `size="sm"|"lg"` + canonical 32/40/48 EmptyState scale) |
| Contrast pairs        | 1.00   | 1.00 | 1.00 | 1.00 | —          | hold     |
| Page-shell coverage   | **0.83 + 27 INTENTIONAL-EXEMPT = 1.00 effective** | same | same | same | —          | hold     |
| Typography (advisory) | 0.13   | 0.13 | 0.13 | 0.13 | —          | hold     |
| Focus order           | null   | null | null | —    | —          | n/a (Playwright unavailable; static-fallback) |

> Convergence definition (carry from v56): a detector match is COVERED if it is either (a) absent from the codebase, or (b) annotated with `// ui-c-exempt: <category> — <reason>` (or inside an INTENTIONAL-EXEMPT route per PATTERNS.lock.md). At this cycle, 15/15 = 100% COVERED.

---

## Pre/Post Cycle Delta Table

| Bucket | rebaseline-007 (prior floor v58) | This cycle (HEAD 64b96139) | Cleared | Regression | New |
|--------|----------------------------------|-----------------------------|---------|------------|-----|
| **P0** Contrast | 0 | **0** | 0 | 0 | 0 |
| **P1** Button override (unannotated) | 0 | **0** | 0 | 0 | 0 |
| **P1** PageShell missing (unannotated) | 0 | **0** | 0 | 0 | 0 |
| **P1** Icon size (unannotated) | 0 | **0** | 0 | 0 | 0 |
| **P1** Hex leakage (unannotated) | 0 | **0** | 0 | 0 | 0 |
| **P1** Aggregate metric (low-adherence) | 2 | 2 | 0 | 0 | 0 |
| **TOTAL ACTIONABLE P1** | **0** | **0** | 0 | 0 | 0 |
| **P2** drift / token concentration | 1376 | 1376 | 0 | 0 | 0 |
| **P3** typography advisories etc. | 1709 | 1709 | 0 | 0 | 0 |

---

## Annotation Counts by Category

Live grep across `apps/**` + `packages/**` `.tsx` files at HEAD 64b96139:

| Category | Count | Notes |
|---|---:|---|
| `methodology-carry` | 10 | pre-existing patterns surfaced by stricter detector (soft-success outlines, approve buttons, badge-as-button, end-call brand-red override) |
| `skeleton-placeholder` | 2 | `skeleton-loader.tsx` Bone shapes |
| `interactive-emphasis` | 2 | non-button interactive emphasis (rating stars / survey spinner) — round-button sites migrated to RoundActionButton, no longer counted here |
| `custom-component-prop` | 1 | `CreditRing size={44}` — component scalar prop, not Icon size |
| **TOTAL** | **15** | exact match to v58 baseline notes (`annotations 93→15, 84% reduction`) |

**Cumulative Phase-D annotation reduction:** 93 (rebaseline-005) → 34 (rebaseline-006 / Tier-F primitive extraction) → 22 (rebaseline-007 Step-1 redundant-route cleanup) → **15** (rebaseline-007 Step-3 RoundActionButton migration) = **84% total reduction**.

---

## RoundActionButton Adoption Audit (commit 9fbcb497)

| Site | Lines | Sizes used | Status |
|------|------:|------------|--------|
| `packages/ui/src/components/round-action-button.tsx` | NEW — 27 LOC | sm=32px (h-8 w-8), md=48px (h-12 w-12), lg=56px (h-14 w-14) | primitive landed, exported via package barrel (verified via `import { Button, RoundActionButton } from '@monobase/ui'` in 3 consumer files) |
| `apps/memberry/src/features/comms/components/call-controls.tsx` | 36, 50, 64, 79 | 4× call control buttons (md/lg mix) | adopted ✓ — replaced inline `h-12 w-12 rounded-full` className stacks |
| `apps/memberry/src/features/comms/components/video-lobby.tsx` | 55, 63 | 2× lobby toggles (md) | adopted ✓ |
| `apps/memberry/src/features/person/components/personal-info-form.tsx` | 223, 237 | 2× avatar-edit/cancel (sm) | adopted ✓ |
| **Total** | **8 call sites across 3 files** | sm + md + lg variants all exercised | clean migration, no regression |

End-call site retains an `interactive-emphasis` / `methodology-carry` annotation for its brand-red override (per rebaseline-007 notes) — counted under `methodology-carry` above.

---

## Residual P1 Classification

| Bucket | Count | Classification | Disposition |
|--------|-------|----------------|-------------|
| Button overrides (unannotated) | **0** | — | **HOLDING** |
| PageShell missing (unannotated) | **0** | — | **HOLDING** |
| Icon arbitrary-size (unannotated) | **0** | — | **HOLDING** |
| Hex leakage (unannotated) | **0** | — | **HOLDING** |
| Aggregate metric carries | 2 | typography 0.13 + spacing 0.88 advisories | INFORMATIONAL (kept for trending only) |
| **NEW-DEBT** | **0** | — | — |
| **REGRESSION** | **0** | — | — |

**Ratchet verdict:** **HARDENED + STABLE**. Zero NEW-DEBT, zero REGRESSION across the 5-commit window since rebaseline-006. P1 floor 0 → 0 → PASS. Pre-commit hook (`.husky/pre-commit` line 3) actively blocks any NEW unannotated detector match in staged files.

---

## Verdict

`UI-C: PASS — NO REGRESSION` — P0=0, P1=0, regression-free, 0 NEW-DEBT, 15 / 15 detector matches annotated (100%). Ratchet HARDENED via pre-commit hook. **Baseline v58 (`phase-d-rebaseline-007`) holds — no rebaseline required.** Phase-D UI-refresh program continues to track at the post-polish floor.

---

## Notes — What Changed Since rebaseline-007 Baseline (v58)

1. **No detector change.** `docs/audits/PATTERNS.lock.md` unchanged at oli-version 1.1; detector regex unchanged from rebaseline-006.
2. **No INTENTIONAL-EXEMPT list change.** Still 27 routes (auth×2 + landing×1 + onboarding×3 + public-verify×6 + full-height-layout×15).
3. **No new primitives this verification cycle.** RoundActionButton (the only post-rebaseline-006 primitive) already landed at v58 capture (commit 9fbcb497, included in rebaseline-007 notes).
4. **No annotation count change.** 15 at v58 capture → 15 now. Composition unchanged (methodology-carry×10 + skeleton-placeholder×2 + interactive-emphasis×2 + custom-component-prop×1).
5. **Detector run clean.** `bun run scripts/ui-consistency-detect.ts --stdin` over all `apps/**` + `packages/**` `.tsx` files exits 0. Zero unannotated matches.
6. **Pre-commit hook live.** `.husky/pre-commit` runs `./scripts/ui-consistency-check.sh --staged` on every commit — ratchet enforced at staging time, not just at audit time.
7. **Test-infra fix (commit 082557f4) is invisible to UI-C.** package.json `test`/`test:watch` rerouting is non-source; detector ignores .json files.
8. **Map freshness CONFIRMED.** Aggregator rescanned at cycle start (per dispatcher note); map@64b96139 covers all 5 commits since rebaseline-006. No engine rescan needed during this dimension run.
9. **Report age: current** — generated against fresh map @ HEAD 64b96139, no staleness gap.
