# Trace Report

---
oli-version: trace-v1
Report Date: 2026-05-30 (rev 3 — cycle 4 post Wave G4 merge, HEAD `28c42566`)
Branch: `oli-magic/wave-g1` (cycle-4 integration)
Phase: D (all phases A–D evaluated; code + tests + specs all present)
Modules Traced: all (22 module specs: m01–m22)
Mode: standalone (delta re-trace against rev 2 baseline + G1/G2/G3/G4 chain re-walk)
Data Sources: artifacts, compliance_report (rev 2.2), confidence_report (rev 3)
Partial Staleness: none (codebase-map regen 2026-05-29 acceptable; G1-G4 deltas verified at source-file level)
Trace Status: COMPLETE (all 114 WF, 51 BR, 116 AC traced; no IDs skipped)
Supersedes: 2026-05-30 rev 2 (pre-G1)
---

## Changes Since Last Run (rev 2 → rev 3)

Cycle-4 post-merge re-trace covering Wave G1 (state-guard wire-ups), G2 (perf/arch), G3 (TypeSpec coverage), and G4 (CSRF + OTel + DATA_GOVERNANCE + as-any tighten + docs archive).

### Resolved P1 / P2 chains

- **G-State / IC-02..05 (state-guard wire cluster)** — pre-G1: 7 state machines defined-but-unused in handler mutators (membership / booking / invoice / training-enrollment / marketplace-vendor / email-queue). **Post-G1: all 7 wired** with test-first proofs:
  - `MEMBERSHIP_VALID_TRANSITIONS` → `terminate + update` (S-G1-01)
  - `BOOKING_VALID_TRANSITIONS` → `confirm/cancel/reject/markAsNoShow` (S-G1-02)
  - `INVOICE_VALID_TRANSITIONS` → `markPaid/delete/cascade` (S-G1-03)
  - `TRAINING_ENROLLMENT_VALID_TRANSITIONS` → `complete + update` (S-G1-04)
  - Marketplace vendor mutator guards (S-G1-05)
  - `EMAIL_QUEUE_VALID_TRANSITIONS` → all queue mutators (S-G1-06)
- **G-Phantom / IC-01 (phantom FE endpoints)** — pre-G1: 9 FE-issued calls without matching BE route. **Post-G1: 0 phantom endpoints** (implemented, removed, or redirected per S-G1-07).
- **G-TypeSpec / M16+M17+jobs backend coverage** — pre-G3: advertising / marketplace / jobs not exposed via .tsp. **Post-G3: TypeSpec coverage 58% → 96%** (S-C4-020/025/026). M16/M17 *backend* P1s closed (FE routes still P1).
- **G-Sql / M05 cross-module SQL leakage** — pre-G2: 1 site in membership repo. **Post-G2: 0** (routed through canonical Drizzle schemas, S-C4-015).
- **G-Perf / N+1 + unbounded findMany** — pre-G2: 3 N+1 + ~70 unbounded. **Post-G2: 0 known live N+1 + <10 unbounded** (lock-in regression tests in S-C4-011/012, pagination convention S-C4-010).
- **G-Sec / CSRF (OWASP A04)** — pre-G4: SameSite-only (P3). **Post-G4: double-submit token middleware** present (S-C4-041, +139 unit tests).
- **G-Obs / OpenTelemetry** — pre-G4: absent (P3). **Post-G4: tracing wired** (S-C4-040).
- **G-Type / handler `as any` density** — pre-G4: 32 handler-level casts. **Post-G4: 3** (boundary-only, S-C4-042).
- **G-Gov / DATA_GOVERNANCE** — pre-G4: DRAFT only. **Post-G4: promoted to canonical** (S-C4-044), activates compliance Step 9e.
- **BR-43 + BR-50 contract layer** — pre-G1: BR-43 INCOMPLETE (backend+E2E, no contract), BR-50 INCOMPLETE (backend, no contract). **Post-G1: both COMPLETE** (contract Hurl tests added in `3064179a` + `c111958b`).

### Remaining gaps

- **G-U1 (m13 professional-feed BR-35, m15 job-board BR-37)** — unbuilt-roadmap modules; ROADMAP.md-tracked; P1; accepted/deferred.
- **3 INCOMPLETE BRs:** BR-47 (banned-users, FE-only), BR-48 (bulk batch — backend boundary test added, contract pending), BR-51 (internal-service-token, backend-only). P2 layer-gap (not absent-test).

## Summary

| Metric | Count | Δ vs rev 2 |
|--------|-------|-----------|
| Total nodes | 1108 | +7 (state-guard test nodes) |
| Total edges | 332 | +31 (guard→handler wire-ups + contract test edges) |
| CRITICAL gaps (P0) | **0** | unchanged |
| HIGH gaps (P1) | **1** (was 1) | unchanged (only m13/m15 unbuilt-roadmap remain) |
| MEDIUM gaps (P2) | **17** (was 24) | **-7** (G1 wire cluster + BR-43/50 contract + phantom IC-01 + N+1 lock-in resolved) |
| Chain coverage (WF→test) | **89%** (41/46) (was 87%) | +2pp |

**Chain coverage** = of 46 workflows with ≥1 linked BR, 41 have ALL linked BRs reaching a test. Remaining 5 = unbuilt-roadmap workflows (m13/m15 BR chains).

## Per-Phase Health Contribution

| Phase | Score | Metric | Notes |
|-------|-------|--------|-------|
| A | 10/10 | Artifact completeness | All 51 BRs + 114 WFs defined in WORKFLOW_MAP; 22 MODULE_SPECs present |
| B | 9/10 | Spec coverage | 43/51 BRs have BR_DEFINED_IN_SPEC edge (+5 from G1/G2 cleanup); 8 missing = unbuilt roadmap (5) + WORKFLOW_MAP-only (3 carried) |
| C | 7/10 | Slice coverage | 24 BRs referenced in SLICE_SPEC/TDD_PROOF (was 16); brownfield test-as-impl proxy = 47/51 |
| D | 9/10 | Test coverage | 47/51 BRs have BR_TESTED_BY edge × 89% chain coverage weight |

> Phase C: no CRITICAL gap → 3/10 cap N/A. Literal SLICE_SPEC ratio (24/51) is materially better post-G1 (7 new G1 TDD proofs). Test-as-implementation evidence remains the brownfield norm; score reflects both.

## Coverage Matrix (delta highlights)

(Showing only post-G1 changes; full matrix preserved in archive.)

| WF-ID | BRs Linked | BRs in Spec | BRs in Slice | BRs Tested | Chain % | Δ |
|-------|-----------|-------------|-------------|-----------|---------|---|
| WF-005 | 1 (BR-03 membership) | 1 | 1 (S-G1-01) | 1 | **100%** | +slice link |
| WF-058 (training) | 5 | 4 | 1 (S-G1-04) | 5 | **100%** | +slice link + BR-43 contract |
| WF-062 (training enrol) | 1 (BR-41) | 1 | 1 (S-G1-04) | 1 | 100% | +slice link |
| WF-068 (booking) | 4 | 4 | 1 (S-G1-02) | 4 | **100%** | +slice link |
| WF-076 (invoice) | 1 | 1 | 1 (S-G1-03) | 1 | 100% | +slice link |
| WF-090 (election cert) | 2 (BR-43/BR-50) | 2 | 0 | 2 | **100%** | +contract test edges |
| WF-093 / WF-094 / WF-095 (M16) | 4 | 4 | 0 | 0 | spec-linked (unbuilt-FE roadmap, no test yet) | unchanged |

## Gap List by Severity

### CRITICAL (P0) — Blocks Phase Progression

_None._

### HIGH (P1) — Warns at Phase Boundary

| Gap ID | Algorithm | Description | Source | Suggested Fix |
|--------|-----------|-------------|--------|---------------|
| G-U1 | 5b broken-chain | m13 BR-35, m15 BR-37 — unbuilt-roadmap modules; spec + WORKFLOW_MAP only | ROADMAP.md (lines 87/89) | Accept (roadmap-deferred) OR build modules |

### MEDIUM (P2) — Report Only

| Gap ID | Algorithm | Description | Suggested Fix |
|--------|-----------|-------------|---------------|
| G-S1 (residual) | 5c coverage | 3 WORKFLOW_MAP-only BRs (BR-24 invite expiry, BR-28 comms dedup, BR-44 idempotent attendance credit) lack MODULE_SPEC §5 entry | Update affected MODULE_SPECs |
| G-S2 | 5c coverage | BR-47/BR-48/BR-51 — 3 INCOMPLETE: layer gap (backend or E2E only; contract pending) | Add missing contract/E2E layers |
| G-S3 | 5c coverage | M16/M17 advertising+marketplace FE not yet built | Frontend wave (out of cycle-4 scope) |
| G-S4 | 5c coverage | m18 polls sub-feature, m19 committee-management backend | Build or formally defer |
| G-S5 | 5a orphan | ~5 event consumer test nodes WEAK assertion quality | Strengthen assertions |
| G-S6 | 5b broken-chain | 4 unseeded internal tables (billingConfigs, documentVersions, dunningTemplates, emailSuppressions) | Add seeds when first feature touches |
| G-S7 (-spec-doc) | 5c coverage | m20-m22 missing per-module API_CONTRACTS.md | Run `/oli-spec-api` for those modules |

## Suggested Actions

| Priority | Action | Gaps Fixed | Command |
|----------|--------|-----------|---------|
| 1 | Build or formally defer m13/m15 | 1 P1 (G-U1) | ROADMAP commit |
| 2 | Add contract layer for BR-47/BR-48/BR-51 | 1 P2 (G-S2) | `/test-contract` per BR |
| 3 | Generate per-module API_CONTRACTS for m20-m22 | 1 P2 (G-S7) | `/oli-spec-api --module m20,m21,m22` |
| 4 | Frontend routes for advertising + marketplace | 1 P2 (G-S3) | next frontend wave |

## Graph Statistics

### Nodes by Type
| Type | Count |
|------|-------|
| workflow | 114 |
| business_rule | 51 |
| acceptance_criteria | 116 |
| state_machine | 12 (was 10) |
| domain_event | 65 |
| error_code | 18 |
| role | 8 |
| api_endpoint | 428 (was 419 + 9 phantom; now 428 real) |
| ui_screen | ~97 (memberry) + ~31 (admin) |
| slice | 31 (Cycle 4 plan) + 7 cycle-3 = 38 |
| test_file | 544 backend + 127 E2E + 97 FE-component + 12 admin-component + 99 Hurl + 5 SDK |
| ui_action | per JOURNEY_COVERAGE_REPORT.md (unchanged) |

### Connected Components

| Metric | Count |
|--------|-------|
| Connected components | 4 (was 5 — m16/m17 backend joined main component via TypeSpec edges) |
| Largest component | ~960 nodes |
| Islands (single-node) | 0 |

## Ratchet Status

Baseline at `docs/trace/.trace-baseline.json` (created cycle 3).

| Severity | Baseline | rev 2 | rev 3 (current) | Status |
|----------|----------|-------|------------------|--------|
| CRITICAL | 0 | 0 | **0** | PASS |
| HIGH | 1 | 1 | **1** | PASS |
| MEDIUM | 24 | 24 | **17** | PASS |

**Baseline auto-update on this run:** MEDIUM 24 → 17 (counts reduced, ratchet tightens).

## Trace Manifest

- Spec IDs collected: WF=114, BR=51, AC=116, SM=12, events=65, endpoints=428, roles=8
- Nodes in graph: 1108
- Edges in graph: 332
- Chains traced: 46/46 workflows with BR links (100%)
- BRs with coverage: 47/51 (92%)
- Orphan nodes: 0 (post-G1 — phantom FE artifacts reconciled)
- Broken chains: 5 (all unbuilt-roadmap)

## Headline Coverage Score

**Trace Coverage: 89% chain coverage (WF→test) — exceeds 60% graduation threshold by +29pp.**

## What's Next

- **All clear** — full traceability chain intact for shipped modules.
- 1 P1 + 17 P2 remaining, all categorized as deferred-roadmap or layer-completeness gaps (no broken business-critical chain).
- Recommend `/oli-magic --update` to refresh BROWNFIELD_STATUS.md graduation table.

**Pipeline position:** Phase D → `/oli-check --traceability` ← YOU ARE HERE → feeds into `/oli-magic --update`
