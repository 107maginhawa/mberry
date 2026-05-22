# Spec Consistency Report

**Date:** 2026-05-20
**Auditor:** Claude (oli-spec-consistency)
**Artifacts Checked:** 9 (MODULE_MAP, MASTER_PRD, WORKFLOW_MAP, ROLE_PERMISSION_MATRIX, DOMAIN_GLOSSARY, EVENT_CONTRACTS, DOMAIN_MODEL, business-rules.md, 19 MODULE_SPECs)

## Summary

| Metric | Count |
|--------|-------|
| Artifacts checked | 9 |
| PASS | 10 |
| FAIL | 8 |
| WARN | 5 |

**Gate Status: BLOCK** -- 8 FAIL findings must be fixed before declaring pipeline complete.

---

## Naming

| # | Check | Status | Details |
|---|-------|--------|---------|
| N1 | Module IDs M01-M19 present in MODULE_MAP | PASS | All 19 IDs present with consistent names |
| N2 | Module names match MODULE_MAP vs MASTER_PRD | WARN | Minor wording differences: MODULE_MAP uses "&" (e.g., "Auth & Onboarding"), MASTER_PRD uses "and" (e.g., "Auth and Onboarding"). Semantically identical but inconsistent formatting. |
| N3 | BR numbering gaps (BR-01 through BR-40) | PASS | All 40 BRs present, no gaps, no duplicates in business-rules.md |
| N4 | WF numbering gaps (WF-001 through WF-114) | PASS | All 114 WFs present, no gaps, no duplicates in WORKFLOW_MAP |
| N5 | BR-NNN in MODULE_SPECs reuse same IDs for different rules | FAIL | See FAIL-01 below |

---

## Structural

| # | Check | Status | Details |
|---|-------|--------|---------|
| S1 | All 19 MODULE_SPECs have same section structure | PASS | All 19 specs have identical 22-section structure (verified via md5 hash) |
| S2 | WORKFLOW_MAP references valid module IDs | PASS | All WF entries reference M01-M19 or cross-cutting modules |
| S3 | ROLE_PERMISSION_MATRIX references valid module IDs | PASS | Uses handler directory names, not module IDs. Cross-referenced correctly. |
| S4 | MODULE_SPEC directories match MODULE_MAP entries | PASS | All 19 directories (m01 through m19) exist with MODULE_SPEC.md files |
| S5 | Orphan BRs (in business-rules.md but not in any MODULE_SPEC) | WARN | BR-03 (Membership Transitions) is in business-rules.md for M05 but is NOT referenced in M05's MODULE_SPEC. BR-06 (Payment Recording) is in business-rules.md for M06 but not referenced in M06's MODULE_SPEC. |

---

## Semantic

| # | Check | Status | Details |
|---|-------|--------|---------|
| SE1 | DOMAIN_MODEL module IDs match MODULE_MAP module IDs | FAIL | See FAIL-02 below |
| SE2 | Membership status enum consistent across docs | FAIL | See FAIL-03 below |
| SE3 | Admin role enum consistent across docs and schema | FAIL | See FAIL-04 below |
| SE4 | notification_type enum consistent across docs | FAIL | See FAIL-05 below |
| SE5 | BR rule definitions in MODULE_SPECs match business-rules.md | FAIL | See FAIL-06 below |
| SE6 | DOMAIN_GLOSSARY terms consistent with MODULE_SPECs | PASS | Core terms (Association, Organization, Person, Member, Officer) used consistently |
| SE7 | DOMAIN_MODEL table count matches schema reality | WARN | DOMAIN_MODEL lists 78 tables but summary says 68. Table index includes Better-Auth tables. Minor. |
| SE8 | DOMAIN_MODEL says `terminated` but actual schema says `removed` | FAIL | See FAIL-07 below |
| SE9 | EVENT_CONTRACTS notification_type missing newer enum values | FAIL | See FAIL-08 below |

---

## Blocking Issues (FAIL -- must fix before shipping)

### FAIL-01: BR IDs in MODULE_SPECs are LOCAL numbering, not canonical IDs

**Severity:** FAIL
**Files:** All 19 MODULE_SPEC.md files, `docs/ver-3/business/business-rules.md`

The MODULE_SPECs use BR-NNN IDs that appear to be locally assigned per module, NOT matching the canonical numbering in `business-rules.md`. Example:

- **M05 MODULE_SPEC** defines `BR-04` as: "IF category configured THEN cannot delete with assigned members (deactivate only)"
- **business-rules.md** defines `BR-04` as: "Dues Amount per Org" (assigned to M06, completely different rule)
- **M05 MODULE_SPEC** references BR-01, BR-02, BR-04, BR-21, BR-22
- **business-rules.md** assigns BR-01, BR-02, BR-03, BR-22 to M05

This means the same BR-04 identifier refers to two entirely different rules depending on which document you read. This is a semantic collision that will cause implementation errors.

**Fix:** Align MODULE_SPEC BR numbering to match the canonical business-rules.md. Either:
1. Replace local BR-NNN IDs in MODULE_SPECs with the canonical IDs from business-rules.md, OR
2. Use module-prefixed IDs (e.g., M5-BR-04) to avoid collision with global IDs

---

### FAIL-02: DOMAIN_MODEL uses a completely different module ID numbering scheme

**Severity:** FAIL
**File:** `docs/product/DOMAIN_MODEL.md`

DOMAIN_MODEL assigns tables to module IDs that do NOT match the canonical MODULE_MAP (M01-M19). It appears to use an internal/schema-centric numbering:

| Concept | DOMAIN_MODEL ID | MODULE_MAP ID | Mismatch? |
|---------|-----------------|---------------|-----------|
| Membership tables | M03 | M05 | YES |
| Credentials | M05 | M11 | YES |
| Directory | M06 | M02/M05 | YES |
| Governance/Elections | M07 | M12 | YES |
| Dues | M08 | M06 | YES |
| Dunning | M09 | (sub-module of M06) | YES |
| Credit entry | M10 | M10 | Match |
| Events | M12 | M08 | YES |
| Training | M13 | M09 | YES |
| Communication | M14 | M07 | YES |
| Comms/Chat | M15 | (sub-module of M07) | YES |
| Billing | M16 | (sub-module of M06) | YES |
| Booking | M17 | (sub-module of M08) | YES |
| Email | M18 | (sub-module of M07) | YES |
| Storage | M19 | M11 | YES |
| Audit | M19 | cross-cutting | YES |

Only 3 out of ~19 mappings are correct (M01 Platform Admin, M04 Chapters, M10 Credits). The rest are wrong.

**Fix:** Rewrite DOMAIN_MODEL module mapping section and Table Index to use the canonical M01-M19 IDs from MODULE_MAP.md. The DOMAIN_MODEL appears to have its own internal numbering system from when it was auto-generated from schema files -- it was never reconciled with the product module IDs.

---

### FAIL-03: Membership status enum diverges between spec docs and actual schema

**Severity:** FAIL
**Files:** `docs/product/DOMAIN_GLOSSARY.md`, `docs/product/DOMAIN_MODEL.md`, `docs/ver-3/business/business-rules.md`, `services/api-ts/src/handlers/association:member/repos/membership.schema.ts`

| Source | Statuses Defined |
|--------|-----------------|
| DOMAIN_GLOSSARY | `Pending, Active, Grace, Lapsed, Suspended, Removed` (6 statuses) |
| business-rules.md (BR-03) | `PENDING, ACTIVE, GRACE, LAPSED, SUSPENDED, REMOVED` (6 statuses) |
| WORKFLOW_MAP state machine | `Pending, Active, Grace, Lapsed, Suspended, Removed` (6 statuses) |
| DOMAIN_MODEL | `pendingPayment, active, gracePeriod, lapsed, expired, suspended, terminated, resigned, deceased, expelled` (10 statuses) |
| Actual DB schema | `pendingPayment, active, gracePeriod, lapsed, expired, suspended, removed, resigned, deceased, expelled` (10 statuses) |

Issues:
1. Glossary/BR docs define 6 statuses; schema has 10. Four statuses (`expired, resigned, deceased, expelled`) exist in the DB but are NOT documented in the Glossary or BR-03 transition rules.
2. Glossary says `Pending`; schema says `pendingPayment` -- different names for same concept.
3. Glossary says `Grace`; schema says `gracePeriod` -- different names for same concept.
4. `expired` exists in schema but not in any spec doc. Unclear how it differs from `lapsed`.
5. BR-03 transition rules don't cover `resigned`, `deceased`, or `expelled` -- no transitions defined for these terminal states.

**Fix:** Update DOMAIN_GLOSSARY and BR-03 to document all 10 statuses and their transitions. Add the missing 4 statuses to the state machine. Use the schema enum values as the canonical names.

---

### FAIL-04: Admin role enum mismatch between ROLE_PERMISSION_MATRIX and actual schema

**Severity:** FAIL
**Files:** `docs/product/ROLE_PERMISSION_MATRIX.md`, `services/api-ts/src/handlers/platformadmin/repos/platform-admin.schema.ts`

| Source | Values |
|--------|--------|
| ROLE_PERMISSION_MATRIX | `super, admin, support` |
| Actual DB schema | `super, support, analyst` |
| DOMAIN_MODEL | `super, support, analyst` |

The ROLE_PERMISSION_MATRIX references an `admin` platform admin level that does not exist in the database. The actual schema uses `analyst` instead of `admin`. The entire permission matrix (sections 3.1-3.21) has columns for `super | admin | support` but should be `super | support | analyst` (or the matrix column labeled "admin" is actually the "support" role and "support" is actually "analyst").

**Fix:** Reconcile the ROLE_PERMISSION_MATRIX columns with the actual `admin_role` enum in the schema. Determine whether the matrix columns map to `super/support/analyst` or whether the schema needs updating.

---

### FAIL-05: notification_type enum missing values in EVENT_CONTRACTS

**Severity:** FAIL
**Files:** `docs/product/EVENT_CONTRACTS.md`, `services/api-ts/src/handlers/notifs/repos/notification.schema.ts`

EVENT_CONTRACTS lists 9 notification types. The actual schema has 21:

Missing from EVENT_CONTRACTS:
- `comms.video-call-started`
- `comms.video-call-joined`
- `comms.video-call-left`
- `comms.video-call-ended`
- `comms.chat-message`
- `waitlist.promoted` (GAP-003)
- `event.late-cancellation` (GAP-006)
- `dunning.escalation` (GAP-012)
- `task.overdue` (GAP-017)

DOMAIN_MODEL lists 14 types (missing the 4 GAP-closure types: `waitlist.promoted`, `event.late-cancellation`, `dunning.escalation`, `task.overdue`).

**Fix:** Update EVENT_CONTRACTS Section 3 notification_type enum to include all 21 values from the actual schema. Update DOMAIN_MODEL enum index to include the 4 GAP-closure notification types.

---

### FAIL-06: MODULE_SPEC BR rules are not traceable to canonical business-rules.md

**Severity:** FAIL
**Files:** All 19 MODULE_SPEC.md files

Several MODULE_SPECs reference BRs that are assigned to other modules in business-rules.md, and miss BRs that ARE assigned to them:

| Module | MODULE_SPEC BRs | business-rules.md BRs | Missing | Extra |
|--------|----------------|----------------------|---------|-------|
| M05 | BR-01,02,04,21,22 | BR-01,02,03,22 | BR-03 | BR-04 (belongs to M06), BR-21 (belongs to M01) |
| M06 | BR-05,07,08,30,32 | BR-04,05,06,07,08,30,32 | BR-04, BR-06 | -- |
| M01 | BR-22,25,26 | BR-21,22,24,25,26 | BR-21, BR-24 | -- |
| M08 | BR-18 | BR-15,16,17,18,27 | BR-15,16,17,27 | -- |

MODULE_SPECs appear to only include a subset of their canonical BRs. This means implementers reading only the MODULE_SPEC will miss business rules they need to enforce.

**Fix:** For each MODULE_SPEC, ensure the Business Rules section (Section 5) includes ALL BRs assigned to that module in business-rules.md. Remove any BR references that belong to other modules.

---

### FAIL-07: DOMAIN_MODEL says `terminated` but actual schema says `removed`

**Severity:** FAIL
**File:** `docs/product/DOMAIN_MODEL.md`

The DOMAIN_MODEL lists membership_status enum value as `terminated`, but the actual Drizzle schema defines it as `removed`:

```
DOMAIN_MODEL: pendingPayment, active, gracePeriod, lapsed, expired, suspended, terminated, resigned, deceased, expelled
Schema:       pendingPayment, active, gracePeriod, lapsed, expired, suspended, removed, resigned, deceased, expelled
```

`terminated` vs `removed` is a semantic difference that would cause query failures if code references the wrong value.

**Fix:** Update DOMAIN_MODEL to use `removed` (matching the actual schema).

---

### FAIL-08: EVENT_CONTRACTS notification_type stale -- 12 missing values vs actual schema

**Severity:** FAIL (duplicate of FAIL-05 but emphasizing the scope)
**File:** `docs/product/EVENT_CONTRACTS.md`

See FAIL-05. EVENT_CONTRACTS is missing 12 notification type values that exist in the production schema. Any developer referencing EVENT_CONTRACTS for notification type values will have an incomplete picture.

---

## Warnings (FLAG -- fix when convenient)

### WARN-01: Module name formatting inconsistency ("&" vs "and")

**Files:** `docs/product/MODULE_MAP.md`, `docs/product/MASTER_PRD.md`
**Details:** MODULE_MAP uses ampersand ("Auth & Onboarding"), MASTER_PRD uses "and" ("Auth and Onboarding"). Not a semantic issue but creates ambiguity when searching across docs.

### WARN-02: BR-03 (Membership Transitions) absent from M05 MODULE_SPEC

**File:** `docs/product/modules/m05-membership/MODULE_SPEC.md`
**Details:** BR-03 is the most critical membership rule (valid state transitions). It is not referenced in the M05 MODULE_SPEC business rules table, though M5-R1 partially covers it with a local rule.

### WARN-03: DOMAIN_MODEL table count discrepancy (78 in index vs 68 in summary)

**File:** `docs/product/DOMAIN_MODEL.md`
**Details:** Summary statistics say 68 tables, but the Complete Table Index lists 78 entries (1-78). This includes Better-Auth managed tables not in the Drizzle schema.

### WARN-04: MASTER_PRD references `docs/ver-3/business/` paths that are outside `docs/product/`

**File:** `docs/product/MASTER_PRD.md`
**Details:** Source Documents table references `docs/ver-3/business/business-rules.md`, `docs/ver-3/business/context.md`, etc. These live outside the `docs/product/` pipeline. Not a bug, but creates a split source-of-truth.

### WARN-05: MODULE_MAP canonical source link is broken

**File:** `docs/product/MODULE_MAP.md` line 4
**Details:** References `ver-3/business/modules/README.md` but the actual link text says `docs/product/modules/README.md`. Path `docs/product/modules/README.md` does not exist as a standalone file.

---

## Summary of Required Fixes

| Priority | Count | Description |
|----------|-------|-------------|
| BLOCK (FAIL) | 8 | Module ID mismatches (DOMAIN_MODEL), enum divergences (membership status, admin role, notification type), BR numbering collisions, missing BR coverage in MODULE_SPECs |
| FLAG (WARN) | 5 | Formatting inconsistency, orphan BRs, table count mismatch, cross-directory references, broken link |

The most impactful fixes are FAIL-02 (DOMAIN_MODEL module ID numbering) and FAIL-03 (membership status enum divergence), as they affect any developer or AI agent trying to trace requirements to implementation.

---

_Audited: 2026-05-20T00:00:00Z_
_Auditor: Claude (oli-spec-consistency)_
