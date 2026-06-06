# Memberry Quality Scorecard

Updated: 2026-06-06
HEAD: 721919d48f5912d1f80696527a93010823c0af38
Plan: `~/.claude/plans/so-is-our-codebase-hidden-dream.md`

| Axis | Score | Target | Owner |
|---|---|---|---|
| Cleanliness (verb lint) | 0 violations | 0 | W6 |
| Dead code | 3 orphans deleted; module candidates kept-and-specced | 0 | W3.5 ✅ |
| Unit coverage | gate wrapper active; per-module thresholds set | ≥70%/80% | W3 / W7 |
| Contract coverage | 32% | ≥60% | W4 |
| E2E real-flow | 36/152 | 100% | W2 (handoff active) |
| MODULE_SPEC | 3 | full coverage | W5 |
| OLI map freshness | -1 days | < 7 days | W5 ✅ |
| TypeSpec | 59 .tsp files | 100% live routes | W6 ✅ |
| Hand-wired allowlist | YAML-gated | YAML-gated | W6 ✅ |
| Verb-convention | lint strict in CI | lint-gated | W7 ✅ |
| Workflow | superpowers-only | superpowers-only | W1 ✅ |
| Security P0 | 0 | 0 | W1.5 ✅ |
| DB migrations P0 | 0 | 0 | W2.5 ✅ |
| Observability full-field | 0% | ≥80% | W4.5 (handoff active) |
| ADRs | 11 | ≥10 | W6.5 ✅ |
| Mega-module decision | REBUILD plan handed off | rebuild planned | W5.5 ✅ |

## Defects discovered log

(Populated when characterization tests reveal behavior bugs.)

### Fixed

| ID | Handler | Severity | Description | Fixed in |
|---|---|---|---|---|
| D-01 | `platformadmin/getOrgHealthScores` | P1 (security) | No platformAdmin guard — any authenticated user could read PII analytics across all orgs | feature/codebase-hardening |
| D-02 | `platformadmin/getRevenueAnalytics` | P1 (security) | No platformAdmin guard — any authenticated user could read cross-org revenue analytics | feature/codebase-hardening |
| D-03 | `platformadmin` (observability) | P2 | PII fields logged in plain text in several handlers | W4.5 |

### Open

(none)

## Wave status

| Wave | Status |
|---|---|
| 0 | ✅ complete |
| 1 (GSD purge) | ✅ complete |
| 1.5 (security) | ✅ baseline, P1+ queued |
| 2 (E2E depth) | partial — auth + billing upgraded; 114-spec sweep handed off |
| 2.5 (migration safety) | ✅ baseline + checklist |
| 3 (coverage + char tests) | ✅ wrapper + 10 platformadmin tests |
| 3.5 (dead-code prune) | ✅ 3 orphans deleted; module candidates kept |
| 4 (contract coverage) | partial — gap tool + surveys scaffold; 87-scenario sweep handed off |
| 4.5 (observability) | partial — top 3 fixed + D-03 PII fix; 17-handler sweep handed off |
| 5 (maps) | ✅ complete — regen + 3 specs; 5-module backfill handed off; 283-file archive pruned (267 MD + 16 non-md) |
| 5.5 (mega-module decision) | ✅ rebuild plan handed off |
| 6 (lint + allowlist) | ✅ complete (elections already in TypeSpec) |
| 6.5 (ADRs) | ✅ 10 ADRs (2 with TBD rationale) |
| 7 (CI gates) | ✅ this commit |

## Open follow-on plans

- `~/.claude/plans/e2e-depth-completion.md` — 114 specs to upgrade or exempt
- `~/.claude/plans/contract-coverage-completion.md` — ~87 Hurl scenarios to reach 60%
- `docs/quality/OBSERVABILITY_HANDOFF.md` — 17 handlers to instrument
- `docs/quality/MODULE_SPEC_HANDOFF.md` — 5 specs to backfill
- `~/.claude/plans/mega-module-rebuild-association-member.md` — 60-80 day rebuild milestone
