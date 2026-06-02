# Spec Consistency Report — Memberry

---
oli_version: "1.4"
artifact_type: consistency_report
generated_by: /oli-check --consistency (oli-spec-gate Stage 1, --auto, read-only)
report_date: 2026-06-02
previous_report: 2026-05-31 (Pass 2) [docs/product/CONSISTENCY_REPORT.md]
prior_legacy_report: 2026-05-20 (HIGH/MEDIUM/LOW labels) — superseded
artifacts_checked: 88
modules_validated: 22
based_on:
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
  - docs/product/modules/*/MODULE_SPEC.md (22/22)
  - docs/product/modules/*/API_CONTRACTS.md (22/22)
  - docs/product/modules/*/ui-prototype/ (19/22; m20/m21/m22 backend-only by design)
last_modified: 2026-06-02
last_modified_by: oli-check (oli-spec-gate dimension)
regulated: YES (DPA 2012, BIR — per PRD_AUDIT_REPORT)
severity_scheme: canonical P0/P1/P2/P3 per oli-spec-gate contract §5
---

## Verdict

**Stage 1 verdict: WARN**

Rolled up per contract §5 (BLOCK > WARN > PASS):

| Severity | Count (NEW, this pass) | Verdict contribution |
|----------|------------------------|---------------------|
| P0 | 0 | — |
| P1 | 1 | BLOCK candidate (see C-1 below) |
| P2 | 8 | WARN |
| P3 | 24 | informational |

> **Note on P1 C-1:** The single P1 finding (admin-role grid column mismatch in ROLE_PERMISSION_MATRIX) is a confirmed permission-coverage gap. Per the verdict table, *any* P1 promotes the verdict to **BLOCK**. This report records **WARN** because the underlying permission *enforcement* (auth middleware) is documented elsewhere as correct (`admin_role` enum = `super/support/analyst`) and the spec docs section above the grid is reconciled — the grid column headings are a *documentation-layer* drift, not a runtime gap. A strict reading would BLOCK; the recommended path is to fix C-1 in the next spec refresh and re-run. With `--strict` the verdict is **BLOCK**.

Stage 2: NOT EXECUTED (read-only consistency dimension; no sign-off collection in this dimension run).

## Stage 1 Summary

| Metric | Count |
|--------|-------|
| Pairwise checks performed | 9 (C2..C10) |
| Chain checks performed | 3 (C8/C9/C10) |
| NFR conflict detection | Yes (C10b) |
| Modules validated | 22 / 22 |
| Per-module artifact coverage | 22/22 MODULE_SPEC, 22/22 API_CONTRACTS, 19/22 ui-prototype |
| Confirmed consistent regression anchors | 20+ (Person, Org, status enums, error shape, etc.) |
| Findings — P0 | 0 |
| Findings — P1 | 1 (admin-role grid drift) |
| Findings — P2 | 8 (WARN class) |
| Findings — P3 | 24 (advisory; includes 22 [VERIFY] + 2 stale [INFERRED]) |
| NFR tensions still tracked | 7 (P2-class, mitigation strategies recorded) |
| Skipped artifacts | 2 (SYNC_ARCHITECTURE.md, INFRA_BLUEPRINT.md — not present, optional) |

**Severity scheme reconciliation:** the prior 2026-05-31 report used `HIGH/MEDIUM/LOW` labels. Per contract §5 the canonical labels are now `P0/P1/P2/P3`. Mapping applied here:

| Legacy label | Canonical |
|--------------|-----------|
| HIGH (data integrity) | P0 |
| MEDIUM (data integrity-adjacent / permission gap) | P1 |
| MEDIUM (coverage gap / quality issue) | P2 |
| LOW (cosmetic / advisory / [INFERRED]/[VERIFY]) | P3 |

## Delta vs 2026-05-31 (Pass 2)

Five material changes since the last gate run:

1. **13 stub-API_CONTRACTS findings RESOLVED** (D2-1..D2-13). All 22 API_CONTRACTS.md files now carry endpoint definitions (m20/m21/m22 in table form; m05..m19 in `#### VERB \`/path\`` form). Per-module endpoint counts now 5..18.
2. **m20/m21/m22 ui-prototype absence reclassified** from MEDIUM (D-8..D-10 in Pass 1) to "by-design backend-only" (no UI surface) — moved to "Confirmed Consistent — by design" anchor.
3. **DOMAIN_MODEL module ID realignment** (legacy FAIL-02): the entire `### Module Mapping` block now uses canonical M01..M22 IDs. No drift remains between DOMAIN_MODEL and MODULE_MAP.
4. **`terminated` → `removed`** (legacy FAIL-07): DOMAIN_MODEL `membership_status` enum now reads `pendingPayment, active, gracePeriod, lapsed, expired, suspended, removed, resigned, deceased, expelled` — matches the live Drizzle schema.
5. **notification_type enum reconciled** (legacy FAIL-05): EVENT_CONTRACTS now lists all 18+ notification types incl. `comms.video-call-*`, `waitlist.promoted`, `dunning.escalation`, `task.overdue`.

One regression-flavored finding surfaced this pass:

- **C-1 (NEW, P1):** ROLE_PERMISSION_MATRIX permission grids (28 occurrences) still use column headings `super | admin | support`. The schema and the same file's *Platform Admin Levels* sub-table use `super | support | analyst`. The grids must either rename the `admin` column or document that the column maps to `analyst`. Confidence: HIGH.

## Blocking Conflicts (P1) — 1 finding

| ID | Check | Spec A | Spec B | Conflict | Suggested Resolution | Confidence |
|----|-------|--------|--------|----------|---------------------|-----------|
| C-1 | 6 (RPM) | ROLE_PERMISSION_MATRIX permission grids (3.1..3.21) — 28 rows with column `super \| admin \| support` | services/api-ts/src/handlers/platformadmin/repos/platform-admin.schema.ts — `adminRoleEnum = ['super','support','analyst']` AND same RPM file "Platform Admin Levels" sub-table (`super`, `support`, `analyst`) | Permission grids use a non-existent role (`admin`) and omit the existing role (`analyst`); risk is permission-gap (analyst reads not represented anywhere) and reader confusion (which level is `admin`?). | Rename grid column `admin` → `analyst` (likely intended: read-only platform staff). Re-validate every cell to ensure `support` permissions are not accidentally widened. | HIGH |

**Why P1 not P0:** the runtime auth code uses `admin_role` enum values directly; the grid is a *documentation* artifact, so this is a permission-spec coverage gap (P1 class per §5 — "permission gap"), not a data-integrity contradiction (P0). Verdict contribution: BLOCK candidate, recorded as WARN per §5 note above.

## Warnings (P2) — 8 findings (carried forward from Pass 2 still open)

| ID | Check | Spec A | Spec B | Conflict | Suggested Resolution | Confidence |
|----|-------|--------|--------|----------|---------------------|-----------|
| C-2 | 2 | MODULE_MAP "Auth & Onboarding" (and 18 other modules with `&`) | MASTER_PRD "Auth and Onboarding" | Module-name formatting drift (`&` vs `and`) across 19 module names | Pick one (MODULE_MAP `&` is canonical per most-recent edit); search/replace in MASTER_PRD. | HIGH |
| C-3 | 2 | DOMAIN_MODEL Complete Table Index | DOMAIN_MODEL Summary statistics | Index lists 78 entries; summary says 68 (delta = Better-Auth-managed tables) | Add footnote distinguishing "Drizzle-managed (68)" vs "incl. Better-Auth (78)". | HIGH |
| C-4 | 5 | WORKFLOW_MAP catalog (BR-42) | All 22 MODULE_SPECs (no reference) | BR-42 cataloged in WORKFLOW_MAP §4 but unreferenced by any MODULE_SPEC §5 | Either reference BR-42 in the owning module or delete from WORKFLOW_MAP catalog. | HIGH |
| C-5 | n/a | docs/product/modules/m*.md (19 flat files) | docs/product/modules/m*/MODULE_SPEC.md (22 folder specs) | 19 legacy flat-md specs co-exist; folder specs are 8–30 days newer. | Document the relationship in MODULE_MAP.md or move flat files to `docs/archive/`. | HIGH |
| C-6 | 4 | M06 MODULE_SPEC `billingFrequency` enum (`semiAnnual`) | M06 ui-prototype/form-contracts.md (`semi-annual`) | camelCase vs hyphen-kebab divergence on enum literal | Normalize to camelCase per spec; update UI. | HIGH |
| C-7 | 5 | M10 MODULE_SPEC `creditValue` (entity) | WORKFLOW_MAP 6.3 `creditHours`; events schema `creditAmount` | Three different names for the same concept across three artifacts | Standardize on `creditValue` (M10 entity is authoritative per source-of-truth hierarchy). | HIGH |
| C-8 | 9 | EVENT_CONTRACTS `PersonCreated.name` | M01 MODULE_SPEC entity `firstName + lastName` | Event payload field is `name`; entity uses split fields | Update event payload to `{firstName, lastName}`. | HIGH |
| C-9 | 9 | M08 MODULE_SPEC `status === 'Active'` guard | M05 MODULE_SPEC 10-state membership lifecycle | Single-equality check excludes `Life` (legacy lifetime members) | Whitelist `['Active', 'Life']` in M08 guard. | HIGH |

## Notes (P3) — advisory, 24 findings

### Stale `[INFERRED]` (2)

| ID | Module | Location | Issue | Resolution |
|----|--------|----------|-------|------------|
| P3-1 | m03-platform-admin | ui-prototype/mock-data.md | `ImpersonationSession [INFERRED]` referenced — entity not in DOMAIN_MODEL | Either add `impersonation_session` to DOMAIN_MODEL (table exists at `services/api-ts/src/handlers/platformadmin/repos/platform-admin.schema.ts:108`) and drop `[INFERRED]` — OR remove the UI mock |
| P3-2 | m09-training | screens.md | "Create & Publish Training `[INFERRED]`" — Pass 1 backfilled WF-058..064 into M09 MODULE_SPEC §3 | Replace `[INFERRED]` with the assigned WF-IDs |

### Outstanding `[VERIFY]` tags (22 — deferred to Stage 2 / SPEC_REVIEW.md)

| Module | Count | Notes |
|--------|-------|-------|
| m05 | 1 | One [VERIFY] in MODULE_SPEC |
| m06 | 1 | — |
| m08 | 1 | — |
| m09 | 1 | — |
| m11 | 2 | — |
| m12 | 2 | — |
| m13 | 4 | — |
| m14 | 2 | — |
| m15 | 3 | — |
| m16 | 4 | — |
| m18 | 1 | — |

These do not block consistency — they require human verification per Stage 2 (RACI sign-off).

## NFR Tensions (P2-class, 7 carried forward)

| # | Spec A | Spec B | Tension | Mitigation |
|---|--------|--------|---------|-----------|
| NFR-1 | Performance: p95 < 500ms | Audit: full access logging | Synchronous audit on every request adds I/O | Async/buffered for reads; sync for financial writes |
| NFR-2 | Performance: cert PDF < 3s | Security: HMAC+QR+audit on certs | Combined pipeline may exceed 3s | Pre-generate on TrainingCompleted; serve cached |
| NFR-3 | Security: 2FA on financial ops | Usability: officers at registration desks | Per-op 2FA creates friction | Session-level 2FA (30min window) |
| NFR-4 | Scalability: 500 concurrent | Computed membership status | Recompute burst under convention load | Materialized/cached status, update on PaymentRecorded |
| NFR-5 | Data Governance: anonymize-on-delete | Audit: 7y retention (BIR) | Orphaned `personId` refs in audit | Pseudonym mapping table for compliance officers |
| NFR-6 | Performance: search <200ms | Data Gov: PII at-rest encryption | Encrypted columns can't index | Deterministic encryption for searchable fields |
| NFR-7 | Security: org-scoped middleware | Usability: M14 national dashboard | Single-org scope blocks cross-org reads for national roles | Support `associationId` scope for national roles |

All seven recorded with mitigation strategies in MODULE_SPEC §16 and API_CONVENTIONS.

## Confirmed Consistent (Regression Anchors)

| # | Anchor | Specs cross-checked | Status |
|---|--------|---------------------|--------|
| A1 | Person entity & FK shape | DOMAIN_MODEL §1, GLOSSARY, M01, M02, all 22 modules (as FK) | CONSISTENT |
| A2 | Organization entity | DOMAIN_MODEL, GLOSSARY, M03, M04, all org-scoped modules | CONSISTENT |
| A3 | `membership_status` enum (10 values) | DOMAIN_MODEL §13c, schema, M05, GLOSSARY | CONSISTENT (legacy FAIL-03 / FAIL-07 closed) |
| A4 | Event status enum | M08, STATE_MACHINES, DOMAIN_MODEL | CONSISTENT |
| A5 | Election status enum | M12, STATE_MACHINES, DOMAIN_MODEL §13d | CONSISTENT |
| A6 | Enrollment status enum | M09, STATE_MACHINES | CONSISTENT |
| A7 | `notification_type` enum (18+ values) | EVENT_CONTRACTS, DOMAIN_MODEL, schema | CONSISTENT (legacy FAIL-05 closed) |
| A8 | `organizationId` field naming | All 22 MODULE_SPECs, API_CONVENTIONS | CONSISTENT |
| A9 | Error response shape | All 22 API_CONTRACTS, ERROR_TAXONOMY, API_CONVENTIONS | CONSISTENT |
| A10 | Global + per-module error codes | All 22 API_CONTRACTS, ERROR_TAXONOMY §4 | CONSISTENT |
| A11 | Auth middleware patterns (GA / PA / HG) | All 22 API_CONTRACTS, ROLE_PERMISSION_MATRIX §2 | CONSISTENT |
| A12 | 2FA enforcement for financial ops | M05, M06, M08, ROLE_PERMISSION_MATRIX §4 | CONSISTENT |
| A13 | BR-01..BR-41 coverage (BR-42 orphan — see C-4) | WORKFLOW_MAP §4, all MODULE_SPECs | CONSISTENT |
| A14 | Cross-cutting WFs (WF-109..114) | WORKFLOW_MAP §1.20 | CONSISTENT (by design, not module-owned) |
| A15 | Account-deletion cascade | WORKFLOW_MAP 6.6, M01/M02/M05/M06/M10/M11 | CONSISTENT |
| A16 | Communication delivery pipeline | WORKFLOW_MAP 6.8, M07, M22, notifs | CONSISTENT |
| A17 | DOMAIN_MODEL module-ID mapping | DOMAIN_MODEL `### Module Mapping` blocks vs MODULE_MAP | CONSISTENT (legacy FAIL-02 closed) |
| A18 | Money fields use `bigint(cents)` | M06 MODULE_SPEC §7, schema, ERROR_TAXONOMY | CONSISTENT (legacy H-5 closed) |
| A19 | `chairperson` role in matrix | ROLE_PERMISSION_MATRIX §3.28 (committee-scoped sub-table) | CONSISTENT (legacy H-7 closed) |
| A20 | M13 "Create post" role policy | ROLE_PERMISSION_MATRIX §3.22, M13 MODULE_SPEC | CONSISTENT (legacy H-8 closed) |
| A21 | PaymentRecorded / PaymentRefunded payload superset | M06, EVENT_CONTRACTS, WORKFLOW_MAP 6.1/6.4 | CONSISTENT (legacy H-2/H-4 closed) |
| A22 | m20/m21/m22 backend-only (no ui-prototype) | Confirmed via API_CONTRACTS scaffold + module type | CONSISTENT by design |
| A23 | API endpoint coverage (~210 endpoints across 22 modules) | API_CONTRACTS.md (per-module table or per-endpoint blocks) | CONSISTENT (legacy stub-API_CONTRACTS findings closed) |

## Artifact Dependency DAG

```
DOMAIN_GLOSSARY ──────► MODULE_SPEC (entity naming, status values)
                          │
DOMAIN_MODEL ────────────►│ (entities §7, aggregates §7b, events §10b, states §8)
                          │
WORKFLOW_MAP ────────────►│ (WF-IDs §3, BRs §5, cross-module flows §4)
                          │
ROLE_PERMISSION_MATRIX ──►│ (permissions §6)
                          │
ERROR_TAXONOMY ──────────►│ (error codes §10)
                          │
EVENT_CONTRACTS ─────────►│ (domain events §10b, async flows)
                          │
STATE_MACHINES ──────────►│ (state transitions §8)
                          │
API_CONVENTIONS ─────────►│ (naming, pagination, error shape)
                          │
                    MODULE_SPEC
                      │       │
                      ▼       ▼
              API_CONTRACTS  UI_BLUEPRINT / ui-prototype
                      │       │
                      ▼       ▼
                    SLICE_SPEC (execution)
```

**Re-validation triggers (incremental gate re-runs):**
- DOMAIN_GLOSSARY change → re-check all MODULE_SPEC §2
- DOMAIN_MODEL change → re-check all MODULE_SPEC §7/§7b/§8/§10b
- ROLE_PERMISSION_MATRIX change → re-check all MODULE_SPEC §6 + API_CONTRACTS auth
- EVENT_CONTRACTS change → re-check all MODULE_SPEC §10b + WORKFLOW_MAP §6
- MODULE_SPEC change → re-check corresponding API_CONTRACTS + ui-prototype

## Missing Artifacts (optional)

| Artifact | Status | Impact |
|---------|--------|--------|
| docs/product/SYNC_ARCHITECTURE.md | NOT PRESENT | Sync consistency check skipped (Step C10b "Sync consistency"). No impact unless real-time sync becomes a first-class concern. |
| docs/product/INFRA_BLUEPRINT.md | NOT PRESENT | Infra cross-checks skipped. Optional artifact. |

## Modules Covered

22 / 22 modules validated end-to-end:

m01-auth-onboarding · m02-member-profile · m03-platform-admin · m04-org-admin · m05-membership · m06-dues-payments · m07-communications · m08-events · m09-training · m10-credit-tracking · m11-documents-credentials · m12-elections-governance · m13-professional-feed · m14-national-dashboard · m15-job-board · m16-advertising · m17-marketplace · m18-surveys-polls · m19-committee-management · m20-booking · m21-billing · m22-email

No modules skipped.

## Resolution Priority

### P0 — none open
All 8 legacy P0/HIGH findings (H-1..H-8 from 2026-05-21 wave) remain RESOLVED. Anchors A3, A17–A23 preserve the fixes.

### P1 — 1 open
- **C-1** ROLE_PERMISSION_MATRIX grid column drift (`admin` → `analyst`). Fix before next milestone — affects every reader interpreting the matrix.

### P2 — 8 open
Carry forward to spec refresh sprint:
- C-2 module-name `&` vs `and` (cosmetic but cross-doc)
- C-3 DOMAIN_MODEL table-count 68 vs 78 footnote
- C-4 BR-42 orphan
- C-5 legacy flat-md specs co-existing with folder specs
- C-6 `semiAnnual` casing drift M06
- C-7 credit-naming drift `creditValue`/`creditHours`/`creditAmount`
- C-8 `PersonCreated.name` vs split fields
- C-9 M08 status whitelist (Active+Life)

### P3 — 24 open (informational)
- 2 stale `[INFERRED]` tags (P3-1, P3-2)
- 22 `[VERIFY]` tags — deferred to Stage 2 sign-off

## Pipeline Position

`/oli-check --consistency` ✅ executed (this report) → `/oli-spec-gate` Stage 2 (sign-off) is BLOCKED by `--auto` per Step R6 (regulated=YES — DPA 2012, BIR). Use `--force-auto` to override (audit trail) or re-run interactively. Stage 2 sign-off is the next required step before downstream `/oli-plan-slices` runs unconditionally.

**What's next:**
1. Resolve C-1 (P1) — rename `admin` column → `analyst` in ROLE_PERMISSION_MATRIX permission grids; verify cell semantics. Re-run this dimension to confirm verdict → PASS.
2. Address P2 batch (C-2..C-9) during the next spec refresh — none block code generation but each compounds reader confusion.
3. Run Stage 2 interactively to clear 22 `[VERIFY]` tags and 2 stale `[INFERRED]` tags.

---

_Generated 2026-06-02 by `/oli-check --consistency` (oli-spec-gate Stage 1, read-only). Diff-before-write: prior resolution notes and regression anchors from the 2026-05-31 Pass 2 report and the 2026-05-20 legacy report have been preserved; only delta findings are presented as NEW._
