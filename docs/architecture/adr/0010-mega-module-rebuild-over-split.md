# ADR-0010: Mega-module rebuild over split

- Status: Accepted
- Date: 2026-06-06
- Deciders: Memberry team

## Context

The `association:member` handler directory has grown to ~193 handler files covering membership lifecycle, dues, credits, credentials, elections, committees, officer governance, and directory management. CLAUDE.md originally documented a deferred "P1-11 mega-module split" (split plan at `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md`).

Wave 5.5 (codebase hardening) re-examined the split plan against current codebase state and found three thresholds that together indicate split is insufficient:

1. **Test coverage 27.7%** — below the 40% minimum threshold. A split would carry the same test debt into each new sub-module.
2. **Defect density high** — 71 commits in 3 months in this module signals structural churn, not feature velocity.
3. **Non-obvious mutable state coupling** — `membership-lifecycle.ts` (344 LOC) couples membership, dues, credits, and credentials state in a single file. A mechanical split of this file preserves the entanglement; it just moves it across a directory boundary.

The conclusion: a file-level split would preserve test debt and entanglement. A rebuild forces test-first architecture (VERTICAL_TDD.md protocol) and clean aggregate boundaries from scratch.

The alternative "keep as-is" was rejected because the module is on the critical path for all member-facing features; continued churn degrades every downstream wave.

Source: `docs/quality/MEGA_MODULE_DECISION.md`, CLAUDE.md §"Deferred Work", ROADMAP §"Domain Module Decomposition", commit `76d3c32e`.

## Decision

`association:member` will be rebuilt from scratch under VERTICAL_TDD.md protocol, not split into sub-directories from the existing codebase. Rebuild is scoped to a future milestone after Waves 0–7 land. The existing module remains in production until the rebuild milestone is complete. The rebuild plan is at `~/.claude/plans/mega-module-rebuild-association-member.md`.

## Consequences

### Positive
- Rebuild enforces test-first architecture — each sub-module starts with ≥80% coverage.
- Clean aggregate boundaries eliminate the `membership-lifecycle.ts` coupling problem.
- Reduced defect density: structured rebuild produces a stable baseline rather than incremental patches on top of shaky ground.

### Negative / tradeoffs
- Rebuild is a larger investment than split — it requires re-implementing and re-testing ~193 handlers.
- The existing module remains in production during the rebuild; two versions coexist temporarily, requiring a cutover plan.
- Rebuild must be sequenced after Waves 0–7 complete — teams cannot execute it in parallel with current hardening work.

### Neutral
- The deferred SPLIT-PLAN.md at `.planning/deferred/14-mega-module-split/` is superseded by this ADR and the rebuild plan. It is retained for historical reference.
- Acceptance criteria for "rebuild done" are defined in `docs/quality/MEGA_MODULE_DECISION.md` §"Acceptance criteria".

## Alternatives considered

- **Mechanical file split (original P1-11 plan)** — rejected because it preserves test debt and cross-concept coupling at 27.7% coverage and 71-commit churn density.
- **Keep as-is** — rejected because the module is on the critical path for member-facing features and continued churn is not sustainable.
- **Incremental refactor** — not evaluated as a formal option; implicitly subsumed by the rebuild approach (rebuild can be executed in vertical slices).

## References

- `docs/quality/MEGA_MODULE_DECISION.md` — full decision record with inputs and acceptance criteria
- `CLAUDE.md` §"Deferred Work" and §"Association (mega-module domain)"
- `ROADMAP.md` §"Structural Refactors > Domain Module Decomposition"
- `.planning/deferred/14-mega-module-split/SPLIT-PLAN.md` — superseded split plan
- `VERTICAL_TDD.md` — protocol for the rebuild execution
- Commit `76d3c32e` — "docs(architecture): mega-module rebuild decision + plan handoff"
