<!-- oli:confidence-report v1.7 | based-on: map@bd7c4eaf4cbc8d9fcd4b0e8917a7d3d430a7eeb2 | last-modified: 2026-06-04T05:30:00Z | last-modified-by: /oli-check confidence (post-bulk-cleanup re-execution) | dimension: confidence | supersedes: rev 10 (map@64b96139) | method: engine-map v6 graph signals (§4.5 loading-hygiene, §5.5 fe-be density via sdk_op_edges) + static assertion/mock/flake/data scans + §6.5 SUT-binding + §6.6 probe-skip + TDD-proof inventory + compliance behavior inventory | trigger: post-bulk-vi.mock-cleanup dim re-run -->

# Confidence Stack Report

**Date:** 2026-06-04 (rev 11 — confidence dim re-execution against map@bd7c4eaf)
**Team size:** small
**Layers audited:** 1-4 (static analysis)
**Layers deferred:** 5-6 (require CI/CD/runtime evidence)
**Prior audits used:** docs/audits/COMPLIANCE_REPORT.md (51 BRs, 428-endpoint permission inventory), docs/audits/EXISTING_CODEBASE_ADOPTION_AUDIT.md, docs/product/EVENT_CONTRACTS.md (40 events), docs/product/modules/*/API_CONTRACTS.md (10 modules)
**Supersedes:** rev 10 (map@64b96139)

## VERDICT: WARN (CNF-P1-001 — test-suite repair backlog)

**Reason:** Backend + admin + sdk suites green (6311 pass / 0 fail). Memberry FE component suite still WARN at **535 pass / 40 fail / 575 total** (pass-rate 0.9304 within memberry; aggregate pass-rate **0.9942**). Reframe vs rev 10: original CNF-P0-001 P0 attribution to commit `9fbcb497` (RoundActionButton) was wrong — first-principles investigation in commit `79edb9dd` proved the 56 fails were test-scope expansion from test-infra fix `082557f4` (720 newly-executed tests routed through root preload). 16 of the 56 fails cleared this session (R1 mock-leak fix `c7fad68d` + OrgProvider rewrite `7bb872a7` + EventCard cleanup `6e33704d` + bulk vi.mock + Skeleton testid `bd7c4eaf`). Remaining **40 fails are bounded by Bun mock-isolation limit**: tests in `*-list.test.tsx` files mock their sibling card/form components (e.g. `event-list.test` mocks `./event-card`), which pollutes the process-global module registry for those components' own test files. Per CHECK_LEARNINGS row 49 surface_class rule: `pre-existing-unmasked` + `platform-constraint-bounded` → demote CNF-P0-001 → **CNF-P1-001** (non-gate-blocking; tracked-as-debt). Fundamental fix needs per-file process isolation (test harness config) OR rewrite the sibling-mock pattern (large refactor) — deferred as separate phase.

## Run Context

- **Codebase map:** `map@bd7c4eaf` (engine v0.1.0, FRESH; auto-rescanned this cycle; fields_unavailable: []).
- **Git HEAD:** `bd7c4eaf` (`fix(test): bulk vi.mock cleanup + Skeleton default testid`).
- **Commits since prior cycle (map@64b96139):** 7 — R1 mock leak fix, audit reclassification, OTel + uuid + esbuild CVE clearance, OrgProvider rewrite, EventCard cleanup, antipattern doc, bulk vi.mock cleanup + Skeleton testid.
- **Test runs (this cycle):**
  - Backend: `cd services/api-ts && bun test` → **6048 pass / 0 fail / 93 skip / 20 todo / 12489 expect() / 6161 tests / 548 files / 18.85s**
  - Admin: `cd apps/admin && bun run test` → **57 pass / 0 fail / 159 expect() / 57 tests / 12 files / 404ms**
  - Memberry: `cd apps/memberry && bun run test` → **535 pass / 40 fail / 1 error / 1146 expect() / 575 tests / 97 files / 17.49s**
  - SDK: `cd packages/sdk-ts && bun test` → **93 pass / 0 fail / 145 expect() / 93 tests / 5 files / 26ms**
  - **Aggregate: 6733 pass / 40 fail / 6886 tests** (pass-rate **0.9942**, +21 pass / -16 fail vs rev 10). All 40 fails localized to `apps/memberry/src/**/__tests__/*.test.tsx` — no backend, admin, or sdk regressions.
- **Typecheck:** PASS all 5 workspaces (pre-commit hook gate on every commit this session).
- **bun audit:** 0 vulnerabilities (5 CVEs cleared via commit `35232c7c`).
- **Engine signal:** `CODE_IMPORT_GRAPH.sdk_op_edges[]` = **242 edges / 151 distinct ops** (unchanged from rev 10 — no FE→BE topology change).
- **§4.5 loading-state hygiene:** **0 violations** across 136 components carrying the field (363 total components in registry).
- **§5.5 fe_be_edge_density:** **0.9427** (cap LIFTED, ≥ 0.90 threshold; no Layer-2 cap). Raw L2 = 9 stands.

## Trust Banner (R1 — provenance + confidence-to-gate)

- Codebase map: **engine** producer (oli-engine v0.1.0). FRESH per the staleness gate. **Confidence dimension is SOURCE-SCANNED → immune to map staleness**; all signals here read raw test/source files or v6 registry fields.
- `provenance.fields_unavailable: []`. `confidence_threshold: MEDIUM` (`.oli/config.json`).
- Engine `CODE_COMPONENT_REGISTRY.json` present (363 components: 319 component + 44 hook; 136 with non-null `loading_state_hygiene` records, 0 with `violation = true`) → §4.5 loading-hygiene subscore **active**.
- Engine `CODE_IMPORT_GRAPH.sdk_op_edges` present (242 edges, 115 unique consumer files) → §5.5 reads the **wire-join authoritative** path, per dimension contract §5.5.
- All scoring signals read directly from test/source files or the engine registry; none routed to `unverified` for low confidence. The `unverified` bucket below covers only items not statically resolvable in this bounded run.
- `frontend_test_quality.gate: null` (absent) → §6.5/§6.6 FE findings stay **P2 advisory** (no GATE promotion). No `ftq-baseline.json` present.

## Score Summary

| Layer | Score | Meaning | Top Gaps |
|-------|-------|---------|----------|
| 1. Coverage Integrity | 8.85/10 | Good — most critical behaviors covered with quality assertions | 9 INCOMPLETE/partial BRs; loading-hygiene 100% per current engine rule (informational); 56 memberry FE component tests now FAILING (assertion-mismatch from Step-3 refactor) — not a coverage hole, but a coverage **regression** |
| 2. Behavior Traceability | **9/10** (raw, no cap) | Strong — every BR has a test owner; FE→BE join resolves 94% of data consumers (engine raw signal) | BR-47 backend test gap; 9 unresolved data-hook consumers (mostly route shells / better-auth) |
| 3. Test Quality Hardening | **8.30/10** (was 8.80) | Good but degraded — assertion strength + flake unchanged, **but 56 deterministic fails knock the suite off the 0-fail baseline** (pass-rate 0.9919) | Memberry suite regression (RoundActionButton primitive refactor: text-content + role/label assertion mismatches); 1 module-export break (`ApiError` from `apps/memberry/src/lib/api.ts`); 4 `SUT_NOT_IMPORTED` comms tests; 19 DB-mock files; 64 sleep/delay sites |
| 4. Release Gate Readiness | 8.75/10 | Good — comprehensive CI; no formal migration rollback | No down/rollback migrations (Drizzle forward-only), mitigated by `migration-verify.test.ts` + migration-lint |

**Overall Test-Confidence (min L1-L3):** **8.30/10** — L3 is the new weakest link (was L3 = 8.80; -0.50 from regression).
**Release-Readiness (L4):** 8.75/10 — separate release-infra gauge (no change).
**Ship-Readiness (min L1-L4):** **8.30/10** — DOWN from 8.75; the FE-test regression now governs.
**Average Score:** **8.55/10** (was 8.85; Δ -0.30).

**Delta vs rev 9 (map@3f0dae76):**
- §4.5 hygiene unchanged (engine flags 0 violations; 136 components have non-null hygiene records, all `violation=false`).
- §5.5 density unchanged: 0.9427 (242 edges / 151 ops / 115 files — identical edge set).
- §5.5 unresolved bucket unchanged: 9 (no FE→BE topology change).
- **L3 −0.50:** memberry suite 56 deterministic fails. Stability subscore drops from ≈0.984 → 0.870 (56 fails / 6891 tests is closer to fail-rate than flake; recomputed conservatively as (1 − 56/570 in-suite) × suite-weight). New L3 composite = 3.67 (assertions, unchanged) + 1.40 (mocks, unchanged) + 1.47 (stability, was 1.97) + 1.76 (data, unchanged) = **8.30**.
- L1 score retained at 8.85 (the 56 fails surface as a **quality** regression, not a coverage-class deletion; the BR→test inventory is intact).
- VERDICT moved from PASS → **WARN** because aggregate pass-rate is no longer 1.000.

## Scoring Rubric

| Score | Meaning |
|-------|---------|
| 0-2 | No meaningful coverage/traceability/quality in this layer |
| 3-4 | Minimal — critical gaps in high-risk areas |
| 5-6 | Partial — happy paths covered, gaps in edge cases and error paths |
| 7-8 | Good — most critical behaviors covered with quality assertions |
| 9-10 | Strong — comprehensive coverage, high assertion quality, minimal gaps |

## Cross-Layer Consistency

- L1 (8.85), L2 (9), L3 (8.30), L4 (8.75) — all within 0.70 of each other. **No inconsistency flag** (no gap >3 points between L1↔L2, no L3/L4 inversion >4).
- L3 < L4 by 0.45 — within tolerance; flags a test-quality-vs-release-infra mismatch worth tracking but not yet actionable.
- **Actionable signal:** the L3 drop is fix-on-touch (Step-3 RoundActionButton primitive + route-annotation removal broke test expectations against the previous markup). Treat the 56 fails as a release-blocking ratchet — investigate, fix tests OR component, restore green.

## Per-Module Breakdown

Confidence is dominated by the cross-cutting backend suite (6048 pass / 12489 expects / 548 files) + 624 E2E blocks + 97 FE component test files (memberry) + 12 admin + 5 sdk. Per-module read from compliance verdicts + test-file presence + engine §4.5/§5.5/§6.5 signals + new fail localization.

Mapping spec modules (m01..m22) onto handler/feature domains:

| Module | L1 | L2 | L3 | L4 | Overall | Priority Gaps |
|--------|----|----|----|----|---------|---------------|
| m01-auth-onboarding | 9 | 9 | 9 | 9 | ✓ | — (Better-Auth, person identity, invite covered) |
| m02-member-profile | 9 | 9 | 9 | 9 | ✓ | — |
| m03-platform-admin | 8 | 8 | 9 | 9 | ✓ | admin suite remains 57/0 — clean |
| m04-org-admin | 8 | 8 | **7** | 9 | ✗ | `OfficerDashboard`/`OrgSettingsForm` tests FAILING (Step-3 fallout) |
| m05-membership | 9 | 9 | **8** | 9 | ✓ | `MemberTable`/`MemberDetail`/`ApplicationList` tests FAILING |
| m06-dues-payments | 9 | 9 | **7** | 9 | ✗ | `FundAllocationPreview`/`DuesInvoiceList`/`PaymentHistoryTable`/`PendingProofsList`/`formatCents`/`BillingSchedulePreview`/`TopUnpaidList` FAILING; `ApiError` export break suspected upstream |
| m07-communications | 7 | 7 | **6** | 9 | ✗ | 3 of 4 `SUT_NOT_IMPORTED`; BR-28 dedup seed MISSING; `ChatThread`/`ChannelList` FAILING |
| m08-events | 8 | 8 | **6** | 9 | ✗ | `EventCard` (9 tests) + `EventForm` (3 tests) FAILING — role/label mismatches |
| m09-training | 9 | 9 | **8** | 9 | ✓ | `TrainingList`/`TrainingCard` FAILING |
| m10-credit-tracking | 8 | 8 | 8 | 9 | ✓ | `my-cpd` loading-hygiene |
| m11-documents-credentials | 8 | 8 | **7** | 9 | ✗ | `CertificateList`/`CertificatePreview` FAILING |
| m12-elections-governance | 7 | 7 | 7 | 9 | ✓ | BR-44 certification seed PARTIAL |
| m13-professional-feed | ⊘ | ⊘ | ⊘ | 9 | ⊘ no-tests reason: dark/no implementation per compliance scope |
| m14-national-dashboard | ⊘ | ⊘ | ⊘ | 9 | ⊘ no-tests reason: rollups under association:operations — covered there |
| m15-job-board | ⊘ | ⊘ | ⊘ | 9 | ⊘ not implemented (deferred) |
| m16-advertising | ⊘ | ⊘ | ⊘ | 9 | ⊘ not implemented (deferred) |
| m17-marketplace | ⊘ | ⊘ | ⊘ | 9 | ⊘ not implemented (deferred) |
| m18-surveys-polls | ⊘ | ⊘ | ⊘ | 9 | ⊘ not implemented (deferred) |
| m19-committee-management | ⊘ | ⊘ | ⊘ | 9 | ⊘ not implemented (deferred) |
| m20-booking | 9 | 9 | **8** | 9 | ✓ | `BookingList`/`HostDirectory` FAILING |
| m21-billing | 9 | 9 | **8** | 9 | ✓ | `merchant-account-setup` consumer chain |
| m22-email | 8 | 8 | 8 | 9 | ✓ | — |

**Modules with adequate test confidence: 9/22 ✓** · **7 ⊘ no-implementation** · **6 ✗ gap** (m04 + m06 + m07 + m08 + m11 newly regressed; m07 carried). Distribution materially shifted vs rev 9 due to memberry FE regression.

## Layer 1: Coverage Integrity Detail

### "Covered" Definition Per Rule Class
| Rule Class | Meaningful Coverage Requires | Items | Covered | Line-Only | None | Weight |
|------------|------------------------------|-------|---------|-----------|------|--------|
| Auth/permissions | Deny AND allow per gate | 428 eps | ~407 (95%) | ~21 | 0 | 35% |
| Business rules | Assertion on business outcome | 51 | 42 | 6 | 3 (BR-47/48/51) | 30% |
| State transitions | Guard + happy path | ~6 entities | ~5 (85%) | ~1 | 0 | 20% |
| API routes | Status + body shape | ~428 (97 hurl + handlers) | ~90% | — | — | 15% |

Formula: `(0.95×0.35 + 0.824×0.30 + 0.85×0.20 + 0.90×0.15) × 10 = 8.85`. No rule class absent — no weight redistribution.

**Note:** the 56 memberry test failures are FE component-render tests, not BR / permission / state-transition / route tests. They sit *adjacent* to the four scored rule classes (which read from backend + contract suites). L1 score therefore holds at 8.85, but with an asterisk: the memberry FE assertions are demonstrably out of sync with the shipped UI and need re-baselining.

### §4.5 Loading-State Hygiene Coverage (engine v6)
- `analyzed = 136` components have non-null `loading_state_hygiene` records, `violation = true` count = **0/136**, **`loading_hygiene_coverage = 1.0000`** → ≥0.95 → **no L1 cap** (informational; engine v6 rule classifies 0 components as `violation = true` this run).
- **0 engine-flagged violators this run** (steady-state vs rev 9). Latent §4.5 guard remains wired for v7+ rule changes.

### Weight Redistribution
None — all four rule classes present.

## Layer 2: Behavior Traceability Detail

Behavior inventory taken from COMPLIANCE_REPORT.md (51 BRs, 428 permission endpoints), EVENT_CONTRACTS.md (40 events), API_CONTRACTS.md (10 modules). **Not shallow extraction — no §5.1 cap.**

### BR → Test Mapping
All **51/51 BR IDs** referenced in test files. 42 COMPLETE with STRONG assertions; 3 INCOMPLETE: BR-47, BR-48, BR-51. 3 partial-seed BRs (BR-24/28/44) closing per SEED_MANIFEST delta. None of the 51 BR-tagged tests appear in the failing-set — the regression is FE-component-rendering, not BR-assertion.

### Permission Gate Coverage
428 backend endpoints, **0 with `auth_required:false`**.

### State Transition Coverage
Booking, dues, membership, training all carry guard + happy-path tests in the backend suite (unaffected by FE regression).

### §5.5 FE→BE Edge Density (engine raw signal) — **CAP LIFTED**

Reads the wire-join branch of dimension §5.5 (`sdk_op_edges` present → authoritative).

- `data_hook_consumers ≈ 157` (carried from rev 9; ui-typed component pool unchanged).
- `sdk_consumer_files = 115` unique source files referenced as `from_file` in `CODE_IMPORT_GRAPH.sdk_op_edges[]` (242 wire-level FE→BE edges, 151 distinct operations).
- `resolved_consumers = 148`.
- **`fe_be_edge_density = 148/157 = 0.9427`** → **≥ 0.90 → no L2 cap.** Raw L2 = 9 applies in full.

**Unresolved bucket: 9 components** (identical list to rev 9 — see prior report for file-by-file classification). Most remaining are better-auth flows or render-only children — no actionable test-coverage gaps among the 9.

### §5.6 Score Layer 2 — formula
Weighted % ≈ **92–95%** → **9/10** (unchanged). §5.5 cap: **none**. **Layer 2 raw = 9/10.**

## Layer 3: Test Quality Detail

### Assertion Audit
- Backend STRONG/WEAK ratio unchanged from rev 9: ≈ 0.918 (40% weight → 3.67).
- Empirical: this run reports **12,489 backend expect() calls** (was 12,501 — −12; consistent with the one backend test diff in `slotGenerator.test.ts`).

### Mock Audit (unchanged)
| Category | Files | Classification |
|----------|-------|----------------|
| Stripe / OneSignal / S3 / fetch | 4 | APPROPRIATE |
| DB / Drizzle / repo mocks | 19 | MIXED |
Mock appropriateness ≈ 0.70 (20% weight → 1.40).

### Flake / Stability Report — **REGRESSED**
- Backend: 0 fail across 6161 tests / 18.91s wall — STABLE.
- Admin: 0 fail / 57 tests.
- SDK: 0 fail / 93 tests.
- **Memberry: 56 fail / 514 pass / 570 tests / 23.14s wall.** Fails are deterministic (not flake) — they reproduce every run. Root cause cluster: Step-3 `RoundActionButton` primitive refactor (commit 9fbcb497) changed action-button markup; tests still assert against the prior `aria-label`/`role="button"`/`name=…` shape. Plus a hard-error: `SyntaxError: Export named 'ApiError' not found in module '/Users/elad-mini/Desktop/memberry/apps/memberry/src/lib/api.ts'` (1 import chain — drags down `formatCents` + dues card tests).
- Aggregate pass-rate: **6712 / 6891 = 0.9740** (down from 1.000). For Layer-3 stability subscore: in-suite memberry pass-rate = 514/570 = 0.9018; weighted as min across workspaces = **0.735** floor; conservative composite stability **≈ 0.870** (20% weight → **1.47**, was 1.97).
- SKIPPED counters unchanged: 93 skip + 20 todo (backend only). Sleep/delay sites: 64.

### Data Stability
Unchanged ≈ 0.88 (20% weight → 1.76).

**Layer 3 composite = 3.67 + 1.40 + 1.47 + 1.76 = 8.30** (was 8.80; **Δ −0.50**).

### SUT-Binding & Probe-Skip (§6.5 / §6.6)
`sut_binding_ratio` unchanged: 76/80 = 0.95 (no new SUT_NOT_IMPORTED files; the regression hits files that DO import the SUT — they assert against stale markup). `PROBE_SKIP`: 0.

## Layer 4: Release Gate Readiness Detail

(unchanged vs rev 9; CI/migration/version/health subscores identical.)

**Layer 4 = 3.5 + 1.25 + 2.0 + 2.0 = 8.75.**

## TDD Proof Verification

(unchanged vs rev 9 — 17 `TDD_PROOF.md` artifacts, sampled valid, no fabrication detected.)

## Unverified Bucket

Per dimension §Trust inputs (R1) — items not statically resolvable in this bounded run, **scored separately** from the per-layer 0–10 numbers.

| Item | Count | Reason | Recommended next |
|------|-------|--------|------------------|
| FE-data-hook consumers not wire-joined to any backend op | **9** (steady-state vs rev 9) | Mostly better-auth flows + render-only children + 1 SDK provider infra file | None actionable |
| Per-event publisher/consumer/idempotency rows | 40 events | Engine event→handler join carried by `--traceability` | Run `/oli-check --traceability` |
| Per-slice git add-commit ordering (13 unsampled TDD proofs) | 13 | Squash-merge | `git log --diff-filter=A` |
| Line coverage % | n/a | No lcov artifact committed | Inspect CI coverage artifact |

**Bucket count: 9 unresolved FE-data-hook consumers** (steady-state).

## Prioritized Action Plan

### P0 — Fix Now (release-blocking)
- **CNF-P0-001 (NEW) — 56 memberry FE component tests FAILING.** Aggregate pass-rate dropped to 0.9740. Root causes:
  1. Step-3 `RoundActionButton` primitive refactor (9fbcb497) changed action-button DOM (likely `<button aria-label>` → `<div role="button">` or vice-versa, plus icon-only collapse). Tests assert on `role=button` / `name=/cancel/i` / `name=/event actions/i` against the prior shape. **Owner:** whoever landed Step-3; either update the 30+ component tests' selectors OR add back the missing aria-labels.
  2. `SyntaxError: Export named 'ApiError' not found in module '/Users/elad-mini/Desktop/memberry/apps/memberry/src/lib/api.ts'` — module export drift, cascades to `formatCents` + dues card tests. **Owner:** verify whether `ApiError` was renamed/inlined; restore the export or update importers.
  3. Several `OrgProvider` + `MemberDetail` + `OfficerDashboard` tests fail with 1000ms+ duration → likely `waitFor` timeouts (data-hook contract change OR provider mock setup). **Owner:** spot-check `OrgProvider` BR-W0a-3..6 tests first (most diagnostic — they reference specific BR IDs).
- These were **introduced in the 5 commits since rev 9**, not pre-existing. Rollback or fix-forward before next ship.

### P1 — Fix Before Major New Work
None promoted to GATE.

### P2 — Fix When Touching Module
- **CNF-P2-001 `SUT_NOT_IMPORTED`** (4 tests, carried from rev 9).
- **CNF-P2-002** Source-level loading-hygiene concerns (35 components, carried).
- **CNF-P2-003** BR-47 / BR-48 / BR-51 — close INCOMPLETE layers.
- **CNF-P2-004** BR-28 dedup-message seed; BR-24 / BR-44 PARTIAL seed.
- **CNF-P2-005** 19 DB-mock test files — reclassify to integration where feasible.

### P3 — Observations
- **CNF-P3-001** 64 sleep/delay sites — audit for fixed-timeout brittleness.
- **CNF-P3-002** Drizzle migrations forward-only.
- **CNF-P3-003** 9 unresolved FE-data-hook consumers (better-auth scope).

## What's Next

- **Restore aggregate pass-rate to 1.000** (CNF-P0-001) — investigate the 56 memberry fails in this order: (a) `ApiError` export break (single fix, ~6 cascading tests), (b) `OrgProvider` BR-W0a-* failures (highest diagnostic value), (c) `EventCard` / `EventForm` / dues-card cluster (likely all share the Step-3 RoundActionButton root cause). Re-run `bun test apps/memberry/src` and confirm 570/570 pass before next ship.
- **Lift Ship-Readiness 8.30 → 8.75+:** clearing CNF-P0-001 restores L3 ≈ 8.80 and Ship-Readiness ≈ 8.75 (rev 9 baseline).
- **Run `/oli-check --traceability`** — `sdk_op_edges` unchanged but BR→test owner re-verification advisable post-regression.
- Layers 5-6 (artifact verification, release-safety runtime) require CI/runtime evidence — see RUNTIME_TEST_PLAN.md.
