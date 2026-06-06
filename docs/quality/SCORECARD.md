# Memberry Quality Scorecard

Baseline: 2026-06-06T00:00:00Z
HEAD: d39ba9401a6023babeaaa6d8609cd7f14a858ced
Plan: `~/.claude/plans/so-is-our-codebase-hidden-dream.md`

| Axis | Score | Target | Owner |
|---|---|---|---|
| Cleanliness | 8.5/10 (per audit) | 10/10 | W6 |
| Dead code | 3 confirmed orphans + module candidates pending SDK trace | 0 | W3.5 |
| Unit coverage | unmeasured (Bun has no native threshold; wrapper TBD W3) | ≥70% per module → 80% by W7 | W3 |
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

(Populated by Wave 3+ when characterization tests reveal behavior bugs. Empty at baseline.)

## Wave status

| Wave | Status |
|---|---|
| 0 | in progress |
| 1–7 | pending |
