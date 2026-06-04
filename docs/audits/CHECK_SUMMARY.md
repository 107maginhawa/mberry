# Check Summary

---
oli-version: "1.0"
based-on:
  - docs/audits/codebase-map/.map-meta.json (v6, sha 64b96139, FRESH, 1420 files, fields_unavailable [])
  - docs/audits/SPEC_CONSISTENCY_REPORT.md (regen this cycle, PASS)
  - docs/trace/TRACE_REPORT.md (rev 10, carry — spec+route inputs unchanged)
  - docs/audits/codebase-map/CODE_MODULE_MAP.md (engine-rewritten this scan)
  - docs/audits/COMPLIANCE_REPORT.md (rev 3.3, carry — api_surface + spec_trace unchanged)
  - docs/audits/CONFIDENCE_REPORT.md (regen this cycle, WARN — new P0 CNF-P0-001)
  - docs/audits/ENFORCEMENT_REPORT.md (regen this cycle, PASS, baseline v58)
  - docs/audits/ENFORCEMENT_COVERAGE.md (regen)
  - docs/audits/JOURNEY_COVERAGE_REPORT.md (carry — CODE_ROUTE_MAP unchanged)
  - docs/audits/RUNTIME_EXEC_REPORT.md (carry — Tier-3 promoted, no app-runtime change)
  - docs/audits/SEED_COHERENCE_REPORT.md (carry — manifest + scripts unchanged)
  - docs/audits/UI_CONSISTENCY_REPORT.md (regen this cycle, PASS, v58 holds)
  - docs/audits/PATTERNS.lock.md (oli-version 1.1)
  - docs/audits/enforce/.baseline.json (v58, phase-d-rebaseline-007)
last-modified: 2026-06-04T03:30:00Z
last-modified-by: /oli-check --auto fresh (regen 4 dims, carry 6)
---

## TRUST STATUS

| Field | Value |
|---|---|
| Producer | engine (@oli/engine, `~/Desktop/oli-engine/dist/cli.js`) |
| MAP-FRESHNESS | **FRESH** — map@64b96139 == HEAD@64b96139 (5 commits absorbed via auto-rescan) |
| fields_unavailable | [] |
| unverified bucket | 9 (FE-data-hook, unchanged from prior cycle) |
| engine_resolved_via | config (`.oli/config.json engine.binary_path`) |
| auto_rescan_branch | TRIGGERED — prior map@3f0dae76 detected STALE-OVERLAP at preamble; `node $ENGINE scan . --write` cleared to FRESH (closes row 11 cycle 14) |

**THESIS IN FORCE.** R1-strict floor does not bind. Static signal trusted.

## GATE VERDICT

`GATE: WARN-WITH-REAL-FINDINGS` (reclassified 2026-06-04T04:00 after first-principles investigation)

**Driver:** **CNF-P0-001** (Confidence dim, **pre-existing-unmasked** class — NOT regression). 53 memberry FE component-test failures (was 56; R1 fix `c7fad68d` cleared 3 formatCents tests).

**Reclassification rationale:** Initial Confidence subagent attributed CNF-P0-001 to commit `9fbcb497` (RoundActionButton primitive refactor). Investigation proves false:
- Prior cycle (sha `3f0dae76`) ran 6048 tests / 0 fail
- Current cycle runs 6768 tests (6712 pass + 56 fail)
- **Δ = 720 newly-executed tests** added by test-infra fix `082557f4` (root-preload routing)
- Failing tests were never invoked pre-`082557f4`; their breakage predates the RoundActionButton commit
- Subagent diagnoses verified incorrect: ApiError export ALREADY present at `apps/memberry/src/lib/api.ts:76` (identical to prior cycle); OrgProvider 1005ms timeouts caused by missing test-internal mock plumbing, not refactor drift

Per CHECK_LEARNINGS row 49 `surface_class` rule: `pre-existing-unmasked` → WARN-WITH-REAL-FINDINGS (project state STABLE; fix required but does not gate-block the cycle that surfaces them). EM-M19-future01 P1 stays `known-future` carried, does NOT contribute to verdict.

R1 fix committed `c7fad68d` (formatCents global mock-leak — real regression, fixed). R2 (~15 router/query-wrapper tests) and R3 (~38 component-assertion tests) re-scoped to per-module vertical-TDD slices, NOT a single bundled fix. See backlog in §Triage.

`--strict` not passed → no hard exit on WARN.

## Triage — Fix-First Ranking (revised)

**R1 — DONE (commit `c7fad68d`)** — `arrears-breakdown.test.tsx` `vi.mock('@/features/dues/lib/money', ...)` leaked globally via Bun's process-wide `mock.module` + shim's no-op `v.unmock`. Mock's simplified impl polluted `money.test.ts` formatCents assertions + dues-card render tests. Removed mock; real `formatCents` produces identical output for arrears amounts (all ≤ ₱750.00). 3 tests restored.

**R2 — DEFERRED to per-module vertical slice** — ~15 tests (OrgProvider×8, OfficerDashboard×5, OrgSettingsForm×2, MemberDashboard, MemberDetail, CertificateList, CertificatePreview) hit ~1005ms `waitFor` exhaustion. Root cause cluster:
- TanStack Query data never arrives in test renders despite mock.module of SDK options
- Suspected: Bun mock.module caching collision with root-preload's pre-mocked `@tanstack/react-router` + `@monobase/sdk-ts/generated/react-query`
- Per-test `mock.module` calls don't override an already-loaded module's cached imports
- Fix path: invert wrapper pattern (real provider + global state injection) OR migrate to per-test mock that pre-empts cache
- **Owning module:** infrastructure (`apps/memberry/src/test/utils.tsx`, `apps/memberry/src/providers/`) — needs vertical-TDD slice scoped to OrgProvider + auth-state-shape

**R3 — DEFERRED to per-module vertical slices** — ~38 tests across 19 component files (EventCard×9, EventForm×3, FundAllocationPreview×4, dues-table cluster, ChatThread×2, BookingList×2, HostDirectory×2, TrainingList, TrainingCard, ApplicationList, MemberTable, ChannelList, TopUnpaidList, NotificationDrawer/Inbox). Sub-10ms assertion failures (some carry the `Received \`false\` for non-boolean attribute \`loading\`` warning).
- Likely shadcn Button refactor pass-through OR test-fixture/mock-contract drift per module
- **Owning modules:** m06 (dues), m07 (comms), m08 (events), m09 (training), m11 (certificates), m12 (membership table) — each needs own slice
- Each slice ≤ 1hr; total ≈ 6-8hr work distributed across module owners

**EM-M19-future01** — P1 known-future (committee m19, MASTER_PRD v3.0 Add-on Phase 3) — unchanged, excluded from gate.

Pipeline UNBLOCKED for ship of non-test changes. Test-suite repair tracked as 6 per-module slices (one per affected module).

## Run Context

- Detected state: specs ✓, source code ✓, tests ✓, UI ✓, runtime ✓, seed-manifest ✓
- Flags parsed: `--auto fresh` (positional `fresh` → force re-scan + regen-dims intent)
- Engine binary: `/Users/elad-mini/Desktop/oli-engine/dist/cli.js` (via `.oli/config.json`)
- Auto-rescan branch: PRIOR sha `3f0dae76` → STALE-OVERLAP (5 stale modules: admin, memberry, booking, sdk-ts, ui + 4 unmapped code changes) → `oli-engine scan . --write` → FRESH at `64b96139` (1420 files, 40 import edges, 242 sdk-op edges, 12 engine findings)
- Change scope since prior cycle: 272 apps/memberry + 40 apps/admin + 6 packages/ui + 4 docs/product + 3 services/api-ts + 26 docs/audits files (UI refactor + test-infra preload + audit chores; specs/api unchanged, route map unchanged, api-surface unchanged)
- 4 dims regenerated (Consistency, Confidence, Enforcement, UI Consistency); 6 dims carry-forward (Discovery via engine MD rewrite; Traceability/Compliance/Journeys/Runtime/SeedCoherence — inputs unchanged since `3f0dae76`)
- Tier-1/2 runtime skipped per `.oli/config.json auto_run_tier_1_2` default `false` (CHECK_LEARNINGS row 18, expected)
- Tier-3 live not re-executed; carried 2026-06-03 promoted snapshot (RUNTIME_EXEC_REPORT.md)

## Dimension Results

| Dimension | Verdict | Report | report_age | Key findings | unverified |
|---|---|---|---|---|---|
| Consistency | PASS | `docs/audits/SPEC_CONSISTENCY_REPORT.md` | current (map@64b96139) | 0 P0 / 0 P1 / 0 actionable P2; anchors A1-A31 preserved; 25 P3 (1 new informational) | 0 |
| Traceability | PASS | `docs/trace/TRACE_REPORT.md` (rev 10) | hours-old (carry, inputs unchanged) | 0/0/0/9 P3 terminal (no spec or route delta to invalidate) | 0 |
| Discovery | PASS | `docs/audits/codebase-map/CODE_MODULE_MAP.md` | current (map@64b96139) | 1420 files (+9), 32 modules, frameworks [generic, hono, react] | 0 |
| Compliance | PASS (9.5/10) | `docs/audits/COMPLIANCE_REPORT.md` + `.json` | hours-old (carry, api_surface + spec_trace unchanged) | 0 P0, 0 P1; spec-trace 455/455; auth_drift=[]; code_only=[]; spec_only=[] | 3 |
| Confidence | **WARN (8.55/10)** | `docs/audits/CONFIDENCE_REPORT.md` | current (map@64b96139) | **CNF-P0-001 NEW** (56 memberry test failures, REGRESSION); 6712 pass / 56 fail / 6891 total; §4.5 0/136; §5.5 0.9427 | 9 |
| Enforcement | PASS | `docs/audits/ENFORCEMENT_REPORT.md` + `.json` + COVERAGE | current (map@64b96139) | 0 P0, 1 P1 EM-M19-future01 KNOWN-future CARRIED; baseline v58 holds; 52 P2 / 51 P3 actionable | 0 |
| Journeys | PASS | `docs/audits/JOURNEY_COVERAGE_REPORT.md` | hours-old (carry, route map unchanged) | 151 routes; 0/0/0/4 P3 KNOWN-DEFERRED | 0 |
| Runtime | PASS (Tier-3 promoted, 2026-06-03 snapshot) | `docs/audits/RUNTIME_EXEC_REPORT.md` | days-old (Tier-3 evidence carry per row 18 remediation b) | 0 ER-P0 / 0 ER-P1; 1 P2 informational | 0 |
| Seed Coherence | PASS | `docs/audits/SEED_COHERENCE_REPORT.md` | hours-old (carry, manifest + scripts unchanged) | STATIC; 117/122 manifest match | 0 |
| **UI Consistency** | **PASS** (v58 holds) | `docs/audits/UI_CONSISTENCY_REPORT.md` | current (map@64b96139) | mode=ACTIVE; pin v58 `phase-d-rebaseline-007`; **P0 0 / P1 0**; annotations 15 (exact v58 match); RoundActionButton clean adoption (8 sites/3 files); ratchet HARDENED | 0 |

**Stale dim reports footer:** 4 dims at `hours-old` (Traceability, Compliance, Journeys, Seed Coherence) + 1 at `days-old` (Runtime — Tier-3 evidence). Inputs verified unchanged since prior cycle for the 4 hours-old; Runtime carried per row 18 remediation (b). Run `/oli-check --regenerate-dim-reports` to refresh all bodies in lockstep.

## Coverage Matrix

22 modules × 10 applicable dimensions. Cell legend: ✓ checked / ⊘ skipped (legitimate) / ✗ gap.

| Module | Cons | Trace | Disc | Comp | Conf | Enf | Jrn | Runt | Seed | UI-C |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| m01-auth-onboarding | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| m02-member-profile | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| m03-platform-admin | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| m04-org-admin | ✓ | ✓ | ✓ | ✓ | ✗ (CNF-P0-001) | ✓ | ✓ | ✓ | ✓ | ✓ |
| m05-membership | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| m06-dues-payments | ✓ | ✓ | ✓ | ✓ | ✗ (CNF-P0-001) | ✓ | ✓ | ✓ | ✓ | ✓ |
| m07-communications | ✓ | ✓ | ✓ | ✓ | ✗ (carried CNF) | ✓ | ✓ | ✓ | ✓ | ✓ |
| m08-events | ✓ | ✓ | ✓ | ✓ | ✗ (CNF-P0-001) | ✓ | ✓ | ✓ | ✓ | ✓ |
| m09-training | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| m10-credit-tracking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| m11-documents-credentials | ✓ | ✓ | ✓ | ✓ | ✗ (CNF-P0-001) | ✓ | ✓ | ✓ | ✓ | ✓ |
| m12-elections-governance | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| m13-professional-feed | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (deferred) | ✓ | ⊘ no-ui | ✓ | ✓ |
| m14-national-dashboard | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| m15-job-board | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (deferred) | ✓ | ⊘ no-ui | ✓ | ✓ |
| m16-nps-reviews | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (deferred) | ✓ | ⊘ no-ui | ✓ | ✓ |
| m17-content-library | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (deferred) | ✓ | ⊘ no-ui | ✓ | ✓ |
| m18-surveys-polls | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| m19-committee-management | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (P1 KNOWN-future) | ✓ | ⊘ no-ui | ✓ | ✓ |
| m20-booking | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (backend-only) | ⊘ backend | ✓ | ✓ | ⊘ backend |
| m21-billing | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (backend-only) | ⊘ backend | ✓ | ✓ | ⊘ backend |
| m22-email | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ (backend-only) | ⊘ backend | ✓ | ✓ | ⊘ backend |

**Uncovered modules:** none structurally. 5 `✗ gap` cells in Confidence column — all driven by single regression CNF-P0-001 (m04/m06/m07/m08/m11 FE component suites fail). Fix the regression → 5 gaps clear in one pass.

## Overall

**Worst-dim verdict:** **WARN** (Confidence; 1 NEW P0 regression).
**Gate:** **FAIL**. Sole driver: CNF-P0-001 (regression-class P0).
**Floor:** P0=1 (actionable, regression). P1=1 KNOWN-future m19 (excluded from gate roll-up).

**Outcome:**
- 10/10 dims structurally checked, all 22 modules covered
- 9/10 dims PASS; 1/10 dim (Confidence) WARN
- **Regression:** RoundActionButton primitive (commit 9fbcb497) landed without test-fixture sync — exact class of defect the UI-C dim is BLIND to (UI-C checks design tokens + detector regex, not test-time DOM contracts). Confidence dim caught it.
- **Next:** fix CNF-P0-001 per Triage step 1, re-run `/oli-check --auto fresh`, expect PASS.
