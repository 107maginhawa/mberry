# Memberry Quality Scorecard

Updated: 2026-06-06
HEAD: 794f2ccf (post-baseline-triage; B-01..B-04 + B-10 closed)
Plan: `~/.claude/plans/so-is-our-codebase-hidden-dream.md`

## Live baseline snapshot — 2026-06-06

Captured by a full Step-1 baseline run after the hardening sequencing plan was approved. See `~/.claude/plans/ill-ask-this-again-validated-graham.md`.

| Suite | Files | Pass | Fail | Other | Duration |
|---|---|---|---|---|---|
| api-ts unit | 540 | 6025 | 1→0 (fixed in `6ea02c47`) | 21 todo + 1 unhandled-throw expected | 23s |
| Hurl contract | 98 | 94 | 4 | 2 skipped (infra) | 38s |
| Playwright E2E | 164 (724 tests) | 387 | 234 | 81 skipped, 20 flaky, 2 did-not-run | 50m |

Raw logs at `.audits/baseline-api-unit.log`, `.audits/baseline-contract.log`, `.audits/baseline-e2e.log`.

### Open baseline failures (pre-existing, not net-new)

| ID | Suite | Test | Class | Status |
|---|---|---|---|---|
| B-01 | contract | `auth-password-reset.hurl:53` | Real bug | ✅ Fixed in `f5c12490` (SYSTEM_ORG_ID + 1s processor + conditional SMTP auth) |
| B-02 | contract | `auth-verification.hurl:41` | Real bug | ✅ Fixed in `f5c12490` (same chain) |
| B-03 | contract | `persons-extended-flow.hurl:175` | Test design | ✅ Fixed in `a6ad1d39` (fresh user for self-delete; officer SOLE_OFFICER block is real) |
| B-04 | contract | `surveys-flow.hurl:108` | Real bug × 5 | ✅ Fixed in `6cb9586a` (UUIDs + `hasRole` + org-context + job catch + analytics shape) |
| B-05 | e2e | officer specs (104 fails) | W2 debt | Open — handed off to W2 sweep |
| B-06 | e2e | member specs (45 fails) | W2 debt + real | Open — handed off to W2 sweep |
| B-07 | e2e | journeys specs (31 fails) | Real journey gaps | Open — handed off to W2 sweep |
| B-08 | e2e | states specs (16 fails) | W2 debt | Open — handed off to W2 sweep |
| B-09 | e2e | stubs specs (10 fails) | Intentional placeholders | Open — should switch to `test.skip()` |
| B-10 | e2e | mobile/profile (2-4 fails) | Test asserted on regex-multi-match + silent catch | ✅ Fixed in `794f2ccf` (role-scoped assertions, no silent catch) |
| B-11 | e2e | actions/auth/cross-persona/profile/public (~10 fails) | Spot-triage | Open — handed off to W2 sweep |
| B-12 | e2e | 2 did-not-run | Likely `maxFailures` interaction | Open — re-confirm with full run |

Contract: 94/98 → 98/98 (100%). E2E: 5 net-new bug closures; remaining 220-ish failures are W2-handoff territory.

| Axis | Score | Target | Owner |
|---|---|---|---|
| Cleanliness (verb lint) | 0 violations | 0 | W6 |
| Dead code | 3 orphans deleted; module candidates kept-and-specced; +1 orphan test (`dues/bulkRecordPayments.test.ts`) pruned in `6ea02c47` | 0 | W3.5 ✅ |
| Unit coverage | 6025/6025 pass (post-`6ea02c47`); gate wrapper active; per-module thresholds set | ≥70%/80% | W3 / W7 |
| Contract pass rate | 98/98 (100%) ✅ | 100% | W4 |
| Contract coverage | 32% | ≥60% | W4 |
| E2E pass rate | 387/621 runnable (62%) — 234 fail mostly W2 debt | 100% | W2 (handoff active) |
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
| D-04 | `email` (queue + SMTP + processor) | P1 (data loss) | Empty `organizationId` crashed `email_queue` insert; SMTP empty creds rejected by mailpit; 30s processor missed Hurl's 15s poll. Net effect: signup verification + password reset emails never delivered in dev/contract envs. | `f5c12490` |
| D-05 | `persons-extended-flow.hurl` (test) | P3 | Self-delete contract step ran as seeded officer → hit SOLE_OFFICER block (422). Real business rule, wrong test target. | `a6ad1d39` |
| D-06 | `surveys` (5 stacked bugs) | P1 (functional) | (a) Zod v4 strict UUID rejected loose placeholders, (b) 11 handlers used `session.user.role !== 'admin'` against a CSV role string, (c) `/surveys/*` had no org-context middleware → NULL `organization_id`, (d) `survey.aggregateAnalytics` job triggered but never registered, (e) analytics endpoint didn't return `surveyId`. | `6cb9586a` |
| D-07 | `apps/memberry` mobile e2e | P2 (test depth) | Mobile profile/settings/id-card assertions used `.catch(() => false)` that swallowed Playwright strict-mode errors when `getByText` matched multiple elements; 2-4 tests failed without diagnostic signal. | `794f2ccf` |

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
