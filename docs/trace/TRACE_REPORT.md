# Trace Report

---
oli-version: trace-v1
Report Date: 2026-05-31 (rev 5 — engine-anchored re-verify, HEAD `caf33141`)
Branch: `main`
Phase: D (all phases A–D evaluated; code + tests + specs all present)
Modules Traced: all (22 module specs: m01–m22)
Mode: standalone (full re-walk; auto)
Producer: **engine** (@oli/engine@0.1.0) — map v5, sha `7ba0b7e`, fields_unavailable=[], spec_trace_optin=true
Map Freshness: **FRESH-ENOUGH** — map@7ba0b7e vs HEAD@caf3314; HEAD moved but no in-scope source files changed. Staleness annotations from rev 4 DROPPED.
Data Sources: engine codebase-map v5 (CODE_SPEC_TRACE, CODE_API_SURFACE, CODE_COMPONENT_REGISTRY w/ populated api_calls), artifacts (WORKFLOW_MAP, 22 MODULE_SPECs, 22 API_CONTRACTS), compliance_report, confidence_report
Trace Status: COMPLETE-WITH-GAPS (114 WF + 49 BR + 116 AC traced; 0 IDs skipped; **m20/m21/m22 zero-anchor — see ZA-01..03**)
Supersedes: 2026-05-31 rev 4 (regex/stale-map trace)
Auto Mode: yes (deterministic defaults, no blocking prompts)
---

## Changes Since Last Run (rev 4 stale-map → rev 5 engine-anchored)

Rev 4 ran on the regex/stale map (sha 28c42566, 79 files behind, `api_calls: []` everywhere). Rev 5 re-consumes the engine map v5 (FRESH-ENOUGH, `CODE_SPEC_TRACE` + populated `api_calls`). Two rev-4 gaps were **map artifacts** and clear; two are **new engine-derived** real findings.

### RESOLVED on engine map (were map-quality artifacts, not project defects)

- **TR-MAP-STALE (P2) → CLEARED.** Map is FRESH-ENOUGH (no in-scope source files changed since map sha). All 21 `(map stale — verify)` annotations dropped.
- **TR-FIELD-PHANTOM-DISCOVERY (P1) → CLEARED at endpoint-binding layer.** Engine map populates `api_calls`: **100 components / 202 call sites / 135 endpoints with FE consumers**. `ACTION_TRIGGERS_API` + `FE_CONSUMES_FIELD` endpoint binding now real (was 0). Engine also ships native `is_phantom`. Residual narrowed — see engine-field-gap below.
- **76 unverified anchor cells (49 BR→code + 27 endpoint→handler) → VERIFIED.** Engine `CODE_SPEC_TRACE` resolves **448/448 spec ops → handlers, 0 spec-only, 0 auth-drift**. The staleness bucket empties.
- **TR-SPEC-CODE-PATH-DRIFT (P2) → mostly artifact.** Engine spec_trace shows 0 openapi↔code path drift (incl. Better-Auth-managed routes). The rev-4 "27 drift" was regex-map path-resolution failure. Residual is doc-level only (API_CONTRACTS.md prose vs openapi) — reclassified P3.

### NEW engine-derived (real, regex map could not produce — `api_calls` was empty)

- **TR-FE-PHANTOM ×2 (P1)** — FE call sites targeting endpoints with NO matching backend route (engine `is_phantom`, consumer_count=1): `POST /storage/files` (bare; spec only has `/storage/files/upload` + `/storage/files/:file/complete`) and `POST /association/member/credits/void-event` (absent from spec entirely). This is the D2/D4 bug class, now caught statically.
- **TR-CODEONLY-CSRF (P3)** — `GET /csrf-token` is code-only (added commit 878fcc34 for seed CSRF double-submit; not in openapi spec). Internal endpoint — document or add to spec.
- **Positive signal (engine-verified):** auth-drift = 0 across all 448 operations — RBAC role declarations on handlers match spec. Regex map could not assert this.

### Persist (real project findings — untouched by map quality)

- **ZA-01..03 (m20/m21/m22 zero-anchor)** — spec/api files contain zero BR/AC/WF/SM canonical IDs. m20-booking (18 EP + 19 handlers), m21-billing (16 EP + 16 handlers), m22-email (12 EP + 13 handlers) prose-only. **P1 ×3.** Engine map does not change this — purely a spec-authoring gap.
- **TR-OVERLOAD-BR-42 (P1)** — BR-42 used with two incompatible meanings: M09 "training type restriction" (WORKFLOW_MAP §4, canonical) vs M12 "one vote per person/position" (`election-integrity.spec.ts`, `seed/layer-3-modules.ts:69`). Rename M12 use or namespace as `M12:BR-42`.
- **TR-AC-ORPHAN ×12 (P2)** — AC with no test-file reference: AC-M06-004, AC-M09-001..006, AC-M10-002, AC-M10-005, AC-M18-004..006.

### Engine-field-gap (narrower residual unverified, not a project defect)

- **`response_shape` / `request_shape` emitted but EMPTY (`{}`) on all 454 endpoints** in engine v0.1.0. Algorithm 5g *field-level* phantom classification (comparing accessed `data.X.Y` field vs declared response shape) still routes to **unverified** — endpoint-binding works, field-shape comparison cannot. Far narrower than rev-4 (whole 5g unrunnable).
- **`/api`-prefix not normalized:** 3 of engine's 5 `is_phantom` flags are false-positives — `GET /api/admin/national-dashboard/:id`, `POST /api/admin/organizations/:id/transition`, `POST /api/association/member/applications/bulk-approve` all exist in spec WITHOUT the Vite `/api` proxy prefix. Engine flags them phantom because it doesn't strip the proxy prefix. Excluded from TR-FE-PHANTOM count above.

### Carried

- **WF-U1 (m13/m15 unbuilt roadmap)** — BR-35, BR-37 chains pending ROADMAP build. P1. Accepted/deferred.
- **3 INCOMPLETE BRs** (BR-47/48/51 layer-gap) — P2.

## Summary

| Metric | Count | Δ vs rev 4 (stale map) |
|--------|-------|-----------|
| Total nodes | 346 | unchanged (spec-side stable) |
| Total edges | 530+ | **+202 FE_CONSUMES_FIELD/ACTION_TRIGGERS_API bindings** (api_calls now populated) |
| CRITICAL gaps (P0) | **0** | unchanged |
| HIGH gaps (P1) | **6** (was 5) | **−1 TR-DISC-CALLS (resolved), +2 TR-FE-PHANTOM (new, real)** → net +1 |
| MEDIUM gaps (P2) | **~17** (was 20) | **−1 TR-MAP-STALE, −1 path-drift→P3, +1 csrf→P3** |
| Chain coverage (WF→test) | **100%** (46/46 with linked BRs) | unchanged |
| BR full chain (spec+code+test) | **48/49** (98%) | unchanged (BR-42 excluded) |
| AC test coverage | **104/116** (90%) | unchanged |
| spec↔code op match (engine) | **448/448 (100%), 0 auth-drift, 1 code-only** | NEW — engine CODE_SPEC_TRACE |
| Modules with zero trace anchors | **3 / 22** (m20, m21, m22) | unchanged |
| Confidence routing: unverified | **field-level phantom only** (response_shape hollow) | **76 anchor cells CLEARED** |

**Chain coverage** = of 46 workflows with ≥1 linked BR (M01–M19 only — M20/M21/M22 have no WF IDs), 46 have ALL linked BRs reaching a test. Prior rev's "5 unbuilt-roadmap workflows" no longer counted as broken because BR-35/37 *do* have test files; they only lack production usage. Effective gap surfaces as **module-level zero-anchor** for m20/m21/m22 instead.

## Per-Phase Health Contribution

| Phase | Score | Metric | Notes |
|-------|-------|--------|-------|
| A | 9/10 | Artifact completeness | 49 BRs + 114 WFs in WORKFLOW_MAP; 22 MODULE_SPECs present, but **m20–m22 have no spec IDs** (-1) |
| B | 8/10 | Spec coverage | 48/49 BRs have `BR_DEFINED_IN_SPEC` edge; **BR-42 overload deducts 1**; m20–m22 contribute 0 BRs |
| C | 7/10 | Slice coverage | 7/49 BRs literally in SLICE_SPEC; brownfield test-as-impl proxy = 49/49 |
| D | 9/10 | Test coverage | 49/49 BRs have `BR_TESTED_BY` edge; 104/116 AC tested; chain coverage 100% on M01–M19 |

> Phase A drop: m20–m22 spec files exist but lack canonical IDs — graph cannot ingest them.
> No P0 → Phase C 3/10 cap N/A.

## Coverage Matrix (per workflow with BRs)

100% of the 46 attributed workflows (M01–M19) have all linked BRs reaching a test. Sample slice:

| WF-ID | Module | BRs Linked | BRs Tested | Chain % |
|-------|--------|-----------|-----------|---------|
| WF-001 | M01 | BR-21, BR-23, BR-25 | 3/3 | 100% |
| WF-032 | M05 | BR-01, BR-02, BR-03 | 3/3 | 100% |
| WF-038 | M06 | BR-06, BR-07, BR-30, BR-32 | 4/4 | 100% |
| WF-058 | M09 | BR-15, BR-16, BR-42, BR-43 | 4/4 | 100% (BR-42 ambiguous) |
| WF-077 | M12 | BR-33, BR-44 | 2/2 | 100% |
| WF-090 | M15 | BR-37 | 1/1 | 100% (unbuilt-roadmap) |
| WF-093 | M16 | BR-45, BR-46, BR-49 | 3/3 | 100% |
| WF-101 | M18 | BR-40 | 1/1 | 100% |
| WF-108 | M19 | BR-39 | 1/1 | 100% |
| WF-109..114 | (cross-cutting) | 0 | — | N/A |

Full per-WF table omitted (46 rows, all 100%). See `/tmp/trace_full.json` for raw graph dump.

## Per-Module Trace Anchor Coverage (22 modules)

| Module | WFs | BRs | BR-test | BR-code | BR-slice | ACs | AC-test | EPs | spec/api/ic | Status |
|--------|-----|-----|---------|---------|----------|-----|---------|-----|-------------|--------|
| m01-auth-onboarding | 9 | 6 | 6 | 6 | 2 | 7 | 7 | 6 | Y/Y/Y | OK |
| m02-member-profile | 5 | 2 | 2 | 2 | 0 | 8 | 8 | 3 | Y/Y/N | OK |
| m03-platform-admin | 9 | 1 | 1 | 1 | 0 | 7 | 7 | 7 | Y/Y/N | OK |
| m04-org-admin | 5 | 3 | 3 | 3 | 1 | 7 | 7 | 5 | Y/Y/N | OK |
| m05-membership | 9 | 5 | 5 | 5 | 0 | 7 | 7 | 0 | Y/Y/N | OK (no spec EPs) |
| m06-dues-payments | 8 | 7 | 7 | 7 | 0 | 7 | 6 | 0 | Y/Y/Y | 1 AC orphan |
| m07-communications | 5 | 1 | 1 | 1 | 0 | 6 | 6 | 0 | Y/Y/Y | OK |
| m08-events | 7 | 5 | 5 | 5 | 0 | 6 | 6 | 0 | Y/Y/N | OK |
| m09-training | 7 | 8 | 8 | 8 | 2 | 6 | 0 | 0 | Y/Y/N | **6 AC orphans** |
| m10-credit-tracking | 6 | 4 | 4 | 4 | 0 | 5 | 3 | 2 | Y/Y/N | 2 AC orphans |
| m11-documents-credentials | 5 | 2 | 2 | 2 | 0 | 6 | 6 | 4 | Y/Y/Y | OK |
| m12-elections-governance | 4 | 3 | 3 | 3 | 2 | 6 | 6 | 0 | Y/Y/N | OK (BR-42 conflict) |
| m13-professional-feed | 4 | 1 | 1 | 1 | 0 | 5 | 5 | 0 | Y/Y/N | unbuilt-roadmap |
| m14-national-dashboard | 3 | 1 | 1 | 1 | 0 | 5 | 5 | 0 | Y/Y/N | OK |
| m15-job-board | 5 | 1 | 1 | 1 | 0 | 5 | 5 | 0 | Y/Y/N | unbuilt-roadmap |
| m16-advertising | 5 | 5 | 5 | 5 | 0 | 6 | 6 | 0 | Y/Y/N | OK |
| m17-marketplace | 3 | 1 | 1 | 1 | 0 | 5 | 5 | 0 | Y/Y/N | OK |
| m18-surveys-polls | 4 | 1 | 1 | 1 | 0 | 6 | 3 | 0 | Y/Y/N | 3 AC orphans |
| m19-committee-management | 5 | 1 | 1 | 1 | 0 | 6 | 6 | 0 | Y/Y/N | OK |
| **m20-booking** | **0** | **0** | 0 | 0 | 0 | **0** | 0 | **0** | Y/Y/N | **✗ ZERO-ANCHOR (ZA-01)** |
| **m21-billing** | **0** | **0** | 0 | 0 | 0 | **0** | 0 | **0** | Y/Y/N | **✗ ZERO-ANCHOR (ZA-02)** |
| **m22-email** | **0** | **0** | 0 | 0 | 0 | **0** | 0 | **0** | Y/Y/N | **✗ ZERO-ANCHOR (ZA-03)** |

EPs = endpoints declared in API_CONTRACTS.md as `METHOD /path` rows. ic = INTEGRATION_CONTRACTS.md presence.

## Gap List by Severity

### CRITICAL (P0) — Blocks Phase Progression

| Gap ID | Algorithm | Description | Source | Suggested Fix |
|--------|-----------|-------------|--------|---------------|
| — | — | None | — | — |

### HIGH (P1) — Warns at Phase Boundary

| Gap ID | Algorithm | Description | Source | Suggested Fix |
|--------|-----------|-------------|--------|---------------|
| ZA-01 | 5a Orphan | m20-booking has 0 BR/AC/WF/SM IDs in spec/api files despite 18 endpoints + 4 entities + 19 handlers in code | `docs/product/modules/m20-booking/MODULE_SPEC.md`, `services/api-ts/src/handlers/booking/` | `/oli-spec-modules --module m20-booking` to mint BR/AC IDs |
| ZA-02 | 5a Orphan | m21-billing has 0 BR/AC/WF/SM IDs in spec/api files despite 16 endpoints + 4 entities + 16 handlers | `docs/product/modules/m21-billing/MODULE_SPEC.md`, `services/api-ts/src/handlers/billing/` | `/oli-spec-modules --module m21-billing` |
| ZA-03 | 5a Orphan | m22-email has 0 BR/AC/WF/SM IDs in spec/api files despite 12 endpoints + 3 entities + 13 handlers | `docs/product/modules/m22-email/MODULE_SPEC.md`, `services/api-ts/src/handlers/email/` | `/oli-spec-modules --module m22-email` |
| TR-OVERLOAD-BR-42 | 5e Dangling | BR-42 used with two incompatible meanings: M09 "training type restriction" (canonical, WORKFLOW_MAP §4) vs M12 "one vote per person/position" (election-integrity.spec.ts) | `docs/product/WORKFLOW_MAP.md:45`, `apps/memberry/tests/e2e/officer/election-integrity.spec.ts:2`, `services/api-ts/src/seed/layer-3-modules.ts:69` | Rename M12 use to a new BR (e.g., BR-50/51) or namespace as `M12:BR-42` per Step 3 BR namespace rule |
| TR-FE-PHANTOM-01 | 5g phantom (engine) | FE calls `POST /storage/files` (bare) — no matching backend route (spec has `/storage/files/upload` + `/storage/files/:file/complete` only); engine `is_phantom`, consumer_count=1 | `CODE_API_SURFACE.json` (engine), consuming component | Fix FE call to real endpoint OR add backend route |
| TR-FE-PHANTOM-02 | 5g phantom (engine) | FE calls `POST /association/member/credits/void-event` — endpoint absent from spec entirely; engine `is_phantom`, consumer_count=1 | `CODE_API_SURFACE.json` (engine), consuming component | Fix FE call OR add `void-event` handler+spec |
| WF-U1 (carried) | 5c | m13/m15 BR-35, BR-37 chains pending ROADMAP build | `ROADMAP.md` | Accepted/deferred |

### MEDIUM (P2) — Report Only

| Gap ID | Algorithm | Description | Source | Suggested Fix |
|--------|-----------|-------------|--------|---------------|
| AC-ORPHAN-M09-001..006 | 5c | 6 m09-training acceptance criteria with no test-file reference | `docs/product/modules/m09-training/MODULE_SPEC.md` §11 | Add `[AC-M09-NNN]` tags to existing training e2e tests |
| AC-ORPHAN-M10-002,005 | 5c | 2 m10-credit-tracking AC orphans (AUTO credit dedup + cross-org aggregation) | `m10-credit-tracking/MODULE_SPEC.md` §11 | Tag `services/api-ts/src/handlers/association:operations/aggregateCredits.test.ts` |
| AC-ORPHAN-M18-004,005,006 | 5c | 3 m18-surveys-polls AC orphans (re-edit, aggregation, anonymity-violation) | `m18-surveys-polls/MODULE_SPEC.md` §11 | Tag survey e2e tests |
| AC-ORPHAN-M06-004 | 5c | concurrent-payment-warning AC has no test | `m06-dues-payments/MODULE_SPEC.md` §11 | Add concurrency test in `services/api-ts/src/handlers/dues/` |
| ~~TR-MAP-STALE~~ | discovery | **RESOLVED rev 5** — engine map FRESH-ENOUGH, no in-scope source drift | — | — |
| TR-CODEONLY-CSRF (P3) | spec-trace | `GET /csrf-token` code-only (seed CSRF, commit 878fcc34) — not in openapi spec | `CODE_SPEC_TRACE` code_only | Document internal endpoint or add to spec |
| TR-API-CONTRACTS-DOC-DRIFT (P3, was P2) | 5b | API_CONTRACTS.md prose paths in M01–M04/M10/M11 vs openapi — engine spec_trace shows **0 openapi↔code drift**; residual is doc-maintenance only (Better-Auth-managed paths) | `docs/product/modules/m{01..04,10,11}/API_CONTRACTS.md` | Reconcile doc prose; not a code defect |
| BR-47/48/51 layer-gap (carried) | 5b | 3 BRs incomplete at contract layer | `docs/audits/COMPLIANCE_REPORT.md` | per-BR contract test backfill |
| AC-SLICE ×114 | 5c | 114/116 ACs have no SLICE_SPEC reference (brownfield norm) | various | report-only |
| BR-SLICE ×42 | 5c | 42/49 BRs have no SLICE_SPEC reference (brownfield norm) | various | report-only |

## Suggested Actions

| Priority | Action | Gaps Fixed | Command |
|----------|--------|-----------|---------|
| 1 | Mint BR/AC IDs for m20/m21/m22 specs | 3 P1 (ZA-01..03) | `/oli-spec-modules --module m20-booking,m21-billing,m22-email` |
| 2 | Resolve BR-42 ID collision (rename M12 use) | 1 P1 (TR-OVERLOAD-BR-42) | manual edit + seed/test re-tag |
| 3 | Fix 2 FE-phantom call sites (wrong/missing endpoint) | 2 P1 (TR-FE-PHANTOM-01/02) | fix FE call OR add backend route+spec |
| 4 | Tag 12 untested ACs onto existing tests | 12 P2 AC orphans | grep existing e2e for AC keywords, prepend `[AC-MXX-NNN]` |
| 5 | Document `GET /csrf-token` + reconcile API_CONTRACTS doc prose | 2 P3 | spec add + doc edit |

## Graph Statistics

### Nodes by Type

| Type | Count |
|------|-------|
| workflow | 114 |
| business_rule | 49 |
| acceptance_criteria | 116 |
| api_endpoint (spec, openapi) | 448 (engine CODE_SPEC_TRACE) |
| api_endpoint (code, surface) | 454 (engine CODE_API_SURFACE) |
| module | 22 |
| slice | 18 |
| **TOTAL (active types)** | **346** |

(test_file, role, ui_action, state_machine, domain_event nodes counted in producer fragments but not aggregated here to keep apples-to-apples with delta-trace.)

### Edges by Type (5 measured edge types)

| Type | Count | Avg Confidence |
|------|-------|----------------|
| WF_ENFORCES_BR | 69 | high (table-anchored) |
| BR_DEFINED_IN_SPEC | 48 | high (BR-42 ambiguous) |
| BR_TESTED_BY | 49 | high (49/49) |
| BR_IMPLEMENTED_IN_SLICE | 7 | medium (sparse — brownfield) |
| BR_ENFORCED_BY_CODE | 49 | high (engine-verified, map fresh) |
| AC_TESTED_BY | 104 | high (104/116) |
| AC_IMPLEMENTED_IN_SLICE | 2 | low (brownfield norm) |
| ACTION_TRIGGERS_API / FE_CONSUMES_FIELD | 202 | high (engine api_calls; 135 endpoints consumed) |
| WF_EXPOSED_VIA_API (spec↔code) | 448 | high (engine CODE_SPEC_TRACE, 0 drift) |
| **TOTAL** | **~978** | — |

### Connected Components

| Metric | Count |
|--------|-------|
| Connected components | ≥4 (main M01–M19 graph + m20 island + m21 island + m22 island) |
| Largest component | 311 nodes (M01–M19 + endpoints + slices + tests) |
| Islands (single-node-cluster modules) | 3 (m20, m21, m22) |

## Confidence Routing

| Bucket | Count | Reason |
|--------|-------|--------|
| `verified` | 49 BR-test, 104 AC-test, 69 WF→BR, **448 spec-op→handler (engine), 135 endpoint→FE-consumer** | direct ID match + engine CODE_SPEC_TRACE/api_calls |
| ~~`unverified` (map staleness)~~ | ~~76 anchor cells~~ → **0** | **CLEARED** — engine map FRESH-ENOUGH, CODE_SPEC_TRACE resolves 448/448 ops, 0 drift |
| `unverified` (engine-field-gap) | 5g *field-level* phantom classification | `response_shape`/`request_shape` emitted EMPTY on all 454 endpoints in engine v0.1.0 — endpoint binding verified, field-shape comparison cannot run |

## Ratchet Status

| Severity | Baseline (rev-3 effective) | Current | Status |
|----------|---------------------------|---------|--------|
| CRITICAL | 0 | 0 | PASS |
| HIGH | 5 (rev 4) | 6 | +1 net (−1 TR-DISC-CALLS resolved, +2 TR-FE-PHANTOM real) |
| MEDIUM | 20 (rev 4) | ~17 | −3 (map-stale + path-drift→P3 + reclass) |

Note: HIGH count rose by 1 not because the project got worse but because the engine map can finally SEE the 2 FE-phantom call sites the regex map was blind to. The −1 (TR-DISC-CALLS) was a checker-blindness artifact, not a project fix. Per Auto Mode contract: report regression, exit non-zero, do not modify baseline.

## Trace Manifest

- Spec IDs collected: WF=114, BR=49, AC=116, SM=0 explicit (state machines defined in DOMAIN_MODEL §10), events=present (EVENT_CONTRACTS.md, not enumerated this run), endpoints (spec)=27, endpoints (code)=116, roles=defined (ROLE_PERMISSION_MATRIX.md, not enumerated this run)
- Nodes in graph: 346 (active types)
- Edges in graph: 328 (5 measured types)
- Chains traced: 46/46 attributed WFs (100%)
- BRs with coverage: 49/49 (100% test+code anchors; BR-42 overloaded)
- Orphan modules: 3 (m20/m21/m22)
- Orphan ACs (no test): 12
- Broken chains: 1 (BR-42 namespace collision)

## What's Next

- **HIGH gaps (P1) present** → Address before next milestone:
  1. Run `/oli-spec-modules` for m20/m21/m22 to mint BR/AC IDs (closes ZA-01..03).
  2. Resolve BR-42 namespace collision via rename or scope-qualification (closes TR-OVERLOAD-BR-42).
  3. Fix 2 FE-phantom call sites — `POST /storage/files`, `POST /association/member/credits/void-event` (closes TR-FE-PHANTOM-01/02).
- **Engine-anchored:** 76 staleness-unverified cells CLEARED; spec↔code trace 448/448, 0 auth-drift. Residual unverified = field-level phantom only (engine v0.1.0 emits empty response_shape).

**Pipeline position:** Phase D → `/oli-check --traceability` ← YOU ARE HERE → feeds `/oli-magic` Wave G classification.
