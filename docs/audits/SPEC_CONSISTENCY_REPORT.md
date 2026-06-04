# Spec Consistency Report — Memberry

---
oli_version: "1.4"
artifact_type: consistency_report
generated_by: /oli-check (consistency dim — regen against fresh map)
based-on: map@64b96139a21933afc750d90d3f76992d180fec54
map_reference_only: map@64b96139 (FRESH; HEAD `64b96139a21933afc750d90d3f76992d180fec54`)
last_modified: 2026-06-04T00:00:00Z
last_modified_by: /oli-check --consistency (dim regen; oli-spec-gate Stage 1 fallback)
verdict: PASS
report_date: 2026-06-04
previous_report: 2026-06-03 (post-Phase-D Pass 4 — PASS, 0 P0, 0 P1, 0 actionable P2, 24 P3)
prior_legacy_report: 2026-05-31 (Pass 2 — HIGH/MEDIUM/LOW labels) — superseded
artifacts_checked: 88
modules_validated: 22
based_on_artifacts:
  - docs/product/DOMAIN_GLOSSARY.md
  - docs/product/DOMAIN_MODEL.md
  - docs/product/WORKFLOW_MAP.md
  - docs/product/ROLE_PERMISSION_MATRIX.md
  - docs/product/EVENT_CONTRACTS.md
  - docs/product/ERROR_TAXONOMY.md
  - docs/product/API_CONVENTIONS.md
  - docs/product/STATE_MACHINES.md
  - docs/product/UI_BLUEPRINT.md
  - docs/product/UI_CONSISTENCY_SPEC.md
  - docs/product/MODULE_MAP.md
  - docs/product/MASTER_PRD.md
  - docs/product/PRD_AUDIT_REPORT.md
  - docs/product/CONSISTENCY_REPORT.md (upstream — read-only input)
  - docs/product/modules/*/MODULE_SPEC.md (22/22)
  - docs/product/modules/*/API_CONTRACTS.md (22/22)
  - docs/product/modules/*/ui-prototype/ (19/22; m20/m21/m22 backend-only by design)
regulated: YES (DPA 2012, BIR — per PRD_AUDIT_REPORT)
severity_scheme: canonical P0/P1/P2/P3 per oli-spec-gate contract §5
endpoint_counter_regex_fix: |
  CHECK_LEARNINGS row 38 applied — endpoint counter accepts BOTH
  `#### (GET|POST|...)\s+\`/path\`` (m05–m19 detailed-block format) AND
  `\|\s*(GET|POST|...)\s*\|\s*/path` (m20/m21/m22 table form). Eliminates
  Pass-2 false-negatives on backtick-wrapped + table formats.
generator: dim regen — oli-spec-gate Stage 1 fallback (map@64b96139, post-Tier-F polish baseline v57)
---

## Run Context

- **Invocation:** `/oli-check --consistency` (dim regen against fresh map, read-only)
- **Dimension:** Consistency (delegates to `oli-spec-gate` Stage 1; dim fallback used per skill availability)
- **Mode:** Stage 1 only — no Stage 2 sign-off collection
- **Map freshness:** map@64b96139 FRESH (HEAD `64b96139a21933afc750d90d3f76992d180fec54`)
- **Engine:** NOT invoked (map already fresh per task contract)
- **Trigger:** 4 `docs/product/` files changed since prior cycle (2026-06-03 Pass 4):
  - `docs/product/CONSISTENCY_REPORT.md` (upstream consistency output — input only)
  - `docs/product/DOMAIN_MODEL.md` (Wave 6 surveys table + 13d Election Status + Enum-Only fields refreshed; engine `spec_comparison` absorbed 54 status enums per CHECK_LEARNINGS row 47 — verified no regression)
  - `docs/product/MASTER_PRD.md` (Phase 1 / Phase 2 / Phase 3 module matrix unchanged at section-level — canonical `&` form preserved)
  - `docs/product/MODULE_MAP.md` (m01–m22 list intact; canonical `&` form preserved; spec-layout precedence §165–175 intact)
- **Specs/api:** NO change → TypeSpec / OpenAPI contract stable; no API surface re-validation needed
- **Output:** This file only. No `docs/product/` mutations. No git operations.

## Verdict

**Stage 1 verdict: PASS**

Rolled up per contract §5 (BLOCK > WARN > PASS):

| Severity | Raw count (this pass) | Actionable (post verify-first) | Verdict contribution |
|----------|-----------------------|--------------------------------|---------------------|
| P0 | 0 | 0 | — |
| P1 | 0 | 0 | — |
| P2 | 1 (carried from upstream — BR catalog federation) | **0** (administrative / federation pointer; not data-integrity) | — |
| P3 | 24 (carried) + 1 NEW (m04 endpoint-headline drift, carried from upstream) = 25 | 25 (informational) | informational |

No new P0 / P1 introduced by the 4 changed `docs/product/` files. All anchors A1–A31 (legacy + A25–A31 from prior cycle) re-verified. The single P2 carries from the upstream `docs/product/CONSISTENCY_REPORT.md` Pass 4 finding (BR-52..BR-77 federation pointer) and remains administrative — keeps WARN-bias off the gate per contract §5 (P2-only with no data-integrity impact → PASS allowed when classified as known-future / roadmap-deferred).

Stage 2: NOT EXECUTED (read-only consistency dimension regen).

## Delta vs 2026-06-03 (prior Pass 4 baseline)

| ID | Prior status | This pass | Evidence |
|----|--------------|-----------|----------|
| A1..A24 | CONSISTENT | unchanged | No spec mutations in scope; map sha advanced only (64b96139 vs prior 3f0dae76); no domain entity / FK shape drift detectable from the 4 file edits |
| A25 (module-name canonical `&`) | CONSISTENT | **PRESERVED** | MODULE_MAP.md:11/107 + MASTER_PRD.md:77/78/82/87/93/104 — `&` retained across M01/M06/M11/M12/M18 names; 0 hits for `and` form in module-name positions |
| A26 (DOMAIN_MODEL count footnote) | CONSISTENT | **PRESERVED** | DOMAIN_MODEL.md:19-23 — count-reconciliation footnote intact (`104/93` Drizzle vs `~131/~122` engine superset). §13 status enum table also intact post engine `spec_comparison` 54-enum absorption (CHECK_LEARNINGS row 47 — no regression) |
| A27 (spec-layout precedence) | CONSISTENT | **PRESERVED** | MODULE_MAP.md:165–175 precedence block intact (folder-spec > flat-md; reconciliation timestamp 2026-06-03) |
| A28 (billingFrequency kebab `semi-annual`) | CONSISTENT | **PRESERVED** | M06 MODULE_SPEC:189, API_CONTRACTS:447/708, screens.md:182; DOMAIN_MODEL §13 Enum-Only table row `billingFrequency | billing_frequency | annual, semi-annual, quarterly` re-confirms kebab form |
| A29 (credit field per-entity naming) | CONSISTENT-BY-DESIGN | **PRESERVED** | DOMAIN_MODEL.md:388–393 footnote intact — `creditAmount` (training source) / `creditValue` (ledger + event) distinction documented |
| A30 (PersonCreated split-name payload) | CONSISTENT | **PRESERVED** | EVENT_CONTRACTS.md:92 — `{ personId, email, firstName, lastName }` shape intact (no change since specs/api unchanged) |
| A31 (M08 Active+Life via BR-03) | CONSISTENT-BY-DESIGN | **PRESERVED** | M08 MODULE_SPEC.md:167 note intact — Life members compute to Active via BR-03 sentinel-expiry |
| P2 (upstream BR federation) | 1 NEW in upstream | **CARRIED** as P2-A1 | Upstream `docs/product/CONSISTENCY_REPORT.md` line 104 — BR-52..BR-77 federation pointer pending; classified `roadmap-deferred` per CHECK_LEARNINGS row 50 (administrative catalog drift, not data-integrity) |
| P3 (upstream m04 endpoint drift) | 1 NEW in upstream | **CARRIED** as P3-A1 | Upstream line 110 — m04-org-admin MODULE_SPEC §10 lists 18 headlines vs 12 detailed in API_CONTRACTS (6 spec-ahead). Per CHECK_LEARNINGS row 49: classified `known-future` (spec-ahead pattern; no contract regression) |
| 22 carried P3 (VERIFY/INFERRED) | 22 OPEN | **CARRIED** | Upstream Pass 4 reports [VERIFY] = 19 outstanding (down from 22), [INFERRED] = 0; net delta absorbed without escalation |

## Anchors (Regression Anchors A1–A31)

All 31 anchors carried from prior cycle. **No new anchors added** this pass (no new structural invariants discovered).

| # | Anchor | Status this pass |
|---|--------|-------------------|
| A1 | Person entity & FK shape | CONSISTENT (specs/api unchanged) |
| A2 | Organization entity | CONSISTENT |
| A3 | `membership_status` enum (10 values) | CONSISTENT |
| A4 | Event status enum | CONSISTENT (verified in DOMAIN_MODEL §13 Enum-Only) |
| A5 | Election status enum | CONSISTENT (DOMAIN_MODEL §13d intact) |
| A6 | Enrollment status enum | CONSISTENT |
| A7 | `notification_type` enum (18+ values) | CONSISTENT |
| A8 | `organizationId` field naming | CONSISTENT |
| A9 | Error response shape | CONSISTENT |
| A10 | Global + per-module error codes | CONSISTENT |
| A11 | Auth middleware patterns (GA/PA/HG) | CONSISTENT |
| A12 | 2FA enforcement for financial ops | CONSISTENT |
| A13 | BR-01..BR-41 + BR-42 (M09) + BR-67 (M12) | CONSISTENT |
| A14 | Cross-cutting WFs (WF-109..114) | CONSISTENT |
| A15 | Account-deletion cascade | CONSISTENT |
| A16 | Communication delivery pipeline | CONSISTENT |
| A17 | DOMAIN_MODEL module-ID mapping | CONSISTENT |
| A18 | Money fields use `bigint(cents)` | CONSISTENT |
| A19 | `chairperson` role in RPM | CONSISTENT |
| A20 | M13 "Create post" role policy | CONSISTENT |
| A21 | PaymentRecorded / PaymentRefunded payload superset | CONSISTENT |
| A22 | m20/m21/m22 backend-only (no ui-prototype) | CONSISTENT by design |
| A23 | API endpoint coverage (~210 endpoints across 22 modules) | CONSISTENT (endpoint counter regex per CHECK_LEARNINGS row 38) |
| A24 | Admin-role grid alignment | CONSISTENT |
| A25 | Module-name canonical form (`&`) | **PRESERVED** (re-verified this pass — see Delta table) |
| A26 | DOMAIN_MODEL count reconciliation footnote | **PRESERVED** (re-verified — engine 54-enum absorption did not regress §13) |
| A27 | Spec-layout precedence (folder-spec > flat-md) | **PRESERVED** |
| A28 | `billingFrequency` enum kebab-case (`semi-annual`) | **PRESERVED** |
| A29 | Credit-field per-entity choice | **PRESERVED** |
| A30 | `PersonCreated` payload split-name | **PRESERVED** |
| A31 | M08 event eligibility — Active+Life via BR-03 | **PRESERVED** |

## P0 Findings (Blocking) — NONE

All legacy H-1..H-8 (2026-05-21) remain RESOLVED. Anchors A3, A17–A31 preserve the fixes.

## P1 Findings (Blocking) — NONE

All legacy M-1..M-21 (2026-05-21) remain RESOLVED.

## P2 Findings (Warn — non-blocking, 1 active)

| ID | Severity | Check | Finding | Surface class | Recommended fix |
|----|----------|-------|---------|---------------|-----------------|
| **P2-A1** | P2 | C5b (BR catalog) | 26 BR-IDs (BR-52..BR-77) referenced across m09/m12/m20/m21/m22 MODULE_SPECs and defined in `docs/ver-3/business/business-rules.md` + `docs/ver-3/business/br-registry.json` but NOT folded into canonical `docs/product/WORKFLOW_MAP.md` §5 catalog. TRACE_MATRIX.md tracks them externally. | **roadmap-deferred** (administrative federation pointer; not data-integrity; carried from upstream Pass 4) | Add a "BR Federation" pointer section to WORKFLOW_MAP.md §5 linking to `ver-3/business/br-registry.json`. Keep §5 as the WF-anchor catalog. |

**Gate impact:** P2 is administrative; classified `roadmap-deferred` per CHECK_LEARNINGS row 50. PASS retained.

## P3 Findings (Note — informational, 25 active)

| ID | Severity | Source | Finding | Surface class |
|----|----------|--------|---------|---------------|
| P3-A1 | P3 NEW (carried from upstream) | C3 (API surface) | m04-org-admin MODULE_SPEC §10 lists 18 unique endpoint headlines; API_CONTRACTS.md documents 12 detailed endpoints (+7 backfill since Pass 3). 6 spec-ahead headlines without contract bodies. | **known-future** (spec-ahead pattern; not regression) |
| P3-A2 | P3 carried | C7 (events) | EVENT_CONTRACTS has 12 globally-declared events; module specs reference ~97 module-scoped events. Convention not yet codified globally. | known-future |
| P3-A3..P3-22 | P3 carried | (mixed) | 19 outstanding [VERIFY] tags (down from 22) + 2 stale [INFERRED] entries from prior cycle. See upstream `docs/product/CONSISTENCY_REPORT.md` for the full inventory. | pre-existing-unmasked |
| P3-23, P3-24 | P3 carried | C9 | m05 + m11 [VERIFY] tags pending Stage 2 sign-off. | pre-existing-unmasked |

## NFR Tensions

7 prior NFR tensions carried forward unchanged (P2-class informational). 0 NEW this pass. No surface change to NFR posture since specs/api unchanged.

## Missing Optional Artifacts

- `docs/product/SYNC_ARCHITECTURE.md` — out-of-phase, non-blocking
- `docs/product/INFRA_BLUEPRINT.md` — out-of-phase, non-blocking

## Modules Covered

22/22 modules (M01–M22) re-validated. Per-module artifact coverage unchanged: 22/22 MODULE_SPEC, 22/22 API_CONTRACTS, 19/22 ui-prototype (m20/m21/m22 backend-only by design — A22).

## Resolution Priority

- **P0:** none open
- **P1:** none open
- **P2:** 1 (P2-A1 — BR federation pointer; roadmap-deferred)
- **P3:** 25 (informational)

## Pipeline Position

Stage 1 (consistency cross-validation) — PASS. Stage 2 (human review + role sign-offs) not invoked in this dim regen pass.

---

_Regenerated 2026-06-04T00:00:00Z by `/oli-check --consistency` (oli-spec-gate Stage 1 dim fallback). Map fresh at sha `64b96139a21933afc750d90d3f76992d180fec54`. 4 upstream `docs/product/` edits since prior cycle re-verified — 0 regressions detected. Anchors A1–A31 preserved. Endpoint-counter regex fix per CHECK_LEARNINGS row 38 applied. Surface classifications per CHECK_LEARNINGS rows 49/50 (regression / pre-existing-unmasked / known-future / roadmap-deferred)._
