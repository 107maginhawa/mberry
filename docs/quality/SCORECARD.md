# Memberry Quality Scorecard

Baseline: 2026-06-06T00:00:00Z
HEAD: d39ba9401a6023babeaaa6d8609cd7f14a858ced
Plan: `~/.claude/plans/so-is-our-codebase-hidden-dream.md`

| Axis | Score | Target | Owner |
|---|---|---|---|
| Cleanliness | 8.5/10 (per audit) | 10/10 | W6 |
| Dead code | 3 orphans deleted; module investigation complete — all 3 candidates KEEP (2 KEEP-AND-SPEC, 1 KEEP-AS-IS) | 0 | W3.5 |
| Unit coverage | coverage-gate.ts wrapper live; per-module thresholds set (platformadmin 40%, others 60–75%); 10 characterization tests added | ≥70% per module → 80% by W7 | W7 (tighten) |
| Contract coverage | 32% (99 Hurl vs 312 OpenAPI paths) | ≥60% | W4 |
| E2E real-flow depth | ~33% (auth + billing selector-only) of 144 specs | 100% | W2 |
| MODULE_SPEC coverage | 22/26 | 26/26 minus deleted | W5 |
| OLI map freshness | stale (59 commits behind HEAD) | < 7 days | W5 |
| TypeSpec coverage | 59 .tsp files; per-handler coverage % unmeasured | 100% of live routes | W6 |
| Hand-wired allowlist | 54 routes, informal | YAML-gated | W6 |
| Verb-convention | doc-only (0 current violations) | lint-gated (warn→strict) | W6 |
| Workflow | GSD residue (12 refs CLAUDE.md, 2 keys .planning/config.json) | superpowers-only | W1 |
| Security | unaudited | grep-clean + queue documented | W1.5 |
| DB migrations | unaudited | expand-contract verified | W2.5 |
| Observability | unaudited | consistent fields per Pino + correlation | W4.5 |
| ADRs | none | ≥10 core decisions documented | W6.5 |
| Mega-module | association:member 267 handlers, 27.7% test ratio | rebuild plan handed off | W5.5 |

## Defects discovered log

| # | Handler | Defect | Severity | Wave |
|---|---|---|---|---|
| D-01 | `getOrgHealthScores` | No explicit platformAdmin guard — any authenticated user can access org health scores (PII analytics) | P2 access-control gap | W1.5 queue |
| D-02 | `getRevenueAnalytics` | No explicit platformAdmin guard — any authenticated user can access revenue analytics | P2 access-control gap | W1.5 queue |

## Wave status

| Wave | Status |
|---|---|
| 0 | complete |
| 1 | complete |
| 1.5 | complete |
| 2 | complete |
| 2.5 | complete |
| 3 | complete (coverage gate wrapper + 10 characterization tests) |
| 3.5 | in progress — orphans deleted, module candidates investigated (all 3 KEEP), awaiting user sign-off |
| 4–7 | pending |
