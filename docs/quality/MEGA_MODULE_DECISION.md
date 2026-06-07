# association:member — Rebuild Decision

Decision: **REBUILD** (not split, not keep-as-is)
Date: 2026-06-06T00:00:00Z
Owner: future milestone after Waves 0–7 land

## Inputs (from Wave 0 RECON + triage)

| Metric | Value |
|---|---|
| Handler files (post-W3.5 prune) | 264 |
| Handler:test ratio | 27.7% (target ≥80%) |
| Sub-domain count | 9 |
| Sub-domain sizes | Membership 54, Dues 52, Credentials 28, Credits 19, Officers 17, Elections 16, Directory 13, Governance 10, Chapters 2, Utilities 56 |
| 3-month commit count | 71 (highest among modules) |
| Confirmed dead files (deleted W3.5) | 3 |
| Top LOC contributors | webhookRetryProcessor 390, membership-lifecycle 344, credits.repo 296 |

## Decision rationale

Three thresholds for rebuild over split, ALL met:
1. **Test coverage <40%** — currently 27.7%
2. **Defect density high** — 71 commits/3mo signals churn
3. **Sub-concepts share mutable state in non-obvious ways** — membership-lifecycle (344 LOC) couples membership, dues, credits, and credentials state in one file

Split would preserve test debt + entanglement. Rebuild forces test-first architecture and clean aggregate boundaries.

## Rebuild shape

9 new modules under `services/api-ts/src/handlers/member/`:
- `member/membership` (54 handlers)
- `member/dues` (52)
- `member/credentials` (28)
- `member/credits` (19)
- `member/officers` (17)
- `member/elections` (16)
- `member/directory` (13)
- `member/governance` (10)
- `member/chapters` (2 — mark experimental)
- shared utilities → `core/member-shared/` (56 utilities)

Each new module:
- TypeSpec-first contracts (`specs/api/src/modules/member/<sub>.tsp`)
- Characterization tests of OLD behavior captured before deletion
- Dual-run validation phase (old + new running side-by-side, contract suite green on both)
- Single cutover commit per sub-module
- ≥80% handler:test ratio at cutover
- ≥5 Hurl scenarios per sub-module
- Each step reversible via `git tag pre-rebuild-<sub-module>`

## Sequencing

Order sub-modules by inbound dependency (least-depended-on first):
1. chapters (2 files; verify still in scope)
2. governance (10)
3. directory (13)
4. elections (16)
5. officers (17)
6. credits (19)
7. credentials (28)
8. dues (52)
9. membership (54 — most coupling, last)
10. shared utilities migration after all sub-modules cut over

## Acceptance criteria (rebuild done)

- Each new sub-module has MODULE_SPEC + TypeSpec + ≥80% test + ≥5 Hurl scenarios
- Old `services/api-ts/src/handlers/association/member/` tree empty (each handler cut over)
- Zero contract suite regressions across the rebuild
- `bun typecheck` passes throughout
- App SDK consumers unchanged (path-level compatibility maintained or single migration commit)

## Risk

6–10 dev-weeks. Highest risk: SDK consumer compatibility — old SDK exports (e.g. `useListMemberships`) must map to new module paths transparently. Mitigation: keep operation IDs stable across rebuild; only handler internal location changes.

## Out of scope here

EXECUTION. This document + the rebuild plan at `~/.claude/plans/mega-module-rebuild-association-member.md` are deliverables. Execution is a separate milestone.

## Status

| Step | State |
|---|---|
| Decision doc | DONE (this file) |
| Rebuild plan skeleton | DONE (linked) |
| Execution | DEFERRED to future milestone |
