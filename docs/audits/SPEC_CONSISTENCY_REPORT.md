# Spec Consistency Report — Memberry

---
oli_version: "1.4"
artifact_type: consistency_report
generated_by: /oli-check --consistency --auto (post-Phase-D regen)
based-on: map@3f0dae76
map_reference_only: map@3f0dae76 (1411 files; sha 3f0dae76f2ef67248b04fcf16c97f87404df1702) — referenced for runtime auth-enum cross-check (admin_role) only
last_modified: 2026-06-03T10:48:00Z
last_modified_by: /oli-check --consistency --auto (post-Phase-D regen)
verdict: PASS
report_date: 2026-06-03
previous_report: 2026-06-03 (post Pass 3 C-1 close — WARN with 8 P2)
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
  - docs/product/modules/*/MODULE_SPEC.md (22/22)
  - docs/product/modules/*/API_CONTRACTS.md (22/22)
  - docs/product/modules/*/ui-prototype/ (19/22; m20/m21/m22 backend-only by design)
regulated: YES (DPA 2012, BIR — per PRD_AUDIT_REPORT)
severity_scheme: canonical P0/P1/P2/P3 per oli-spec-gate contract §5
generator: post-Tier-A+B+C regen with verify-first triage
---

## Run Context

- **Invocation:** `/oli-check --consistency --auto` (post-Phase-D verify-first regeneration)
- **Dimension:** Consistency (delegates to `oli-spec-gate` Stage 1)
- **Mode:** Stage 1 only — no Stage 2 sign-off collection in this regeneration pass
- **Map freshness:** map@3f0dae76 fresh (HEAD `3f0dae76f2ef67248b04fcf16c97f87404df1702`; `.map-meta.json` sha matches; 1411 files; timestamp 2026-06-03T10:43:03Z)
- **Engine:** NOT invoked (`engine scan --write` deliberately skipped — map already fresh)
- **Phase D context:** Tier-A/B doc edits + Tier-C (Button CVA + Icon codemod + PageShell extract + 110-route migration) landed. This regeneration applies verify-first triage to every prior C-N / P3-N finding from the 2026-06-03 (Pass 3 + C-1 close) report.
- **Output:** This file only. No other artifacts touched. No git operations.

## Verdict

**Stage 1 verdict: PASS**

Rolled up per contract §5 (BLOCK > WARN > PASS):

| Severity | Raw count (this pass) | Actionable (post verify-first) | Verdict contribution |
|----------|-----------------------|--------------------------------|---------------------|
| P0 | 0 | 0 | — |
| P1 | 0 | 0 | — |
| P2 | 8 (carried forward labels) | **0** | — |
| P3 | 24 | 24 (informational) | informational |

All 8 prior P2 findings (C-2..C-9) have been re-verified against the post-Phase-D state and classified as **CLEARED**, **STALE**, or **RESOLVED-BY-DESIGN**. None remain as real drift. With **0 actionable P0/P1/P2**, the verdict moves WARN → **PASS**.

Stage 2: NOT EXECUTED (read-only consistency dimension; no sign-off collection in this dimension regeneration).

## Delta vs 2026-06-03 (prior Pass 3 + C-1 close)

| ID | Prior status | This pass | Evidence |
|----|--------------|-----------|----------|
| C-1 | P1 → CLOSED last pass | CONFIRMED CLOSED (anchor A24) | 29 grid headings `super \| support \| analyst` in ROLE_PERMISSION_MATRIX.md |
| C-2 | P2 OPEN | **CLEARED** | MODULE_MAP.md:11/107 and MASTER_PRD.md:77/78/82/87/93/104 both now use `&` across all 19 module names; 0 hits for `Auth and Onboarding` style |
| C-3 | P2 OPEN | **CLEARED** | DOMAIN_MODEL.md:19-23 footnote reconciles `104/93` domain-managed vs `~131/~122` engine superset (Better-Auth + internals) |
| C-4 | P2 OPEN | **STALE** | BR-42 anchored at `docs/product/modules/m09-training/MODULE_SPEC.md:147` ("Sole owner of BR-42 post TR-P1-004 split") + TRACE_MATRIX.md:11/78 |
| C-5 | P2 OPEN | **CLEARED** | MODULE_MAP.md:165 + line 175 "spec-layout reconciliation appended 2026-06-03" precedence section established (folder-spec wins; flat-md = legacy overview) |
| C-6 | P2 OPEN | **STALE** | `grep "semiAnnual"` returns 0 hits in m06/; all references use kebab `semi-annual` consistently (MODULE_SPEC:189, API_CONTRACTS:447/708, ui-prototype/screens.md:182) |
| C-7 | P2 OPEN | **RESOLVED-BY-DESIGN** | DOMAIN_MODEL.md:389-393 footnote documents three distinct entity fields (training.creditAmount = source/definition; credit_entry.creditValue = ledger record; event.creditValue = normalized M10 payload). Per-entity choice, not naming drift. |
| C-8 | P2 OPEN | **STALE** (contract side) | EVENT_CONTRACTS.md:92 `PersonCreated` payload already `{ personId, email, firstName, lastName }`; no `.name` field present. Any emitter drift becomes Compliance-dim scope, not Consistency. |
| C-9 | P2 OPEN | **RESOLVED-BY-DESIGN** | M08 MODULE_SPEC.md:167 note documents that Life members always compute to Active via BR-03 sentinel-expiry (2099-12-31); single `=== 'Active'` guard is correct by design. Active+Life whitelist would be redundant. |
| P3-1, P3-2 | P3 OPEN | unchanged | Still informational; no Stage 2 sign-off in this pass |

## Stage 1 Summary

| Metric | Count |
|--------|-------|
| Pairwise checks performed | 9 (C2..C10) |
| Chain checks performed | 3 (C8/C9/C10) |
| NFR conflict detection | Yes (C10b) |
| Modules validated | 22 / 22 |
| Per-module artifact coverage | 22/22 MODULE_SPEC, 22/22 API_CONTRACTS, 19/22 ui-prototype |
| Confirmed consistent regression anchors | 24+ (Person, Org, status enums, error shape, admin-role grid) |
| Findings — P0 | 0 |
| Findings — P1 | 0 |
| Findings — P2 actionable | 0 |
| Findings — P2 cleared/stale/by-design | 8 (carried-forward labels; triaged below) |
| Findings — P3 | 24 (advisory; includes 22 [VERIFY] + 2 stale [INFERRED]) |
| NFR tensions still tracked | 7 (P2-class, mitigation strategies recorded) |
| Skipped artifacts | 2 (SYNC_ARCHITECTURE.md, INFRA_BLUEPRINT.md — not present, optional) |

## Verify-first triage outcomes

Each prior P2 finding (C-2..C-9) verified against current state via grep + targeted reads:

### C-2 — Module-name `&` vs `and` drift — **CLEARED**

- **Evidence:** `grep -c "Auth & Onboarding\|Member & Profile\|Dues & Payments"` → MODULE_MAP.md:4, MASTER_PRD.md:2 (sample). `grep -c "Auth and Onboarding\|..."` → 0 hits in either file.
- MASTER_PRD.md:77 = `Auth & Onboarding`; :78 = `Member Profile & Settings`; :82 = `Dues & Payments`; :87 = `Documents & Credentials`; :93 = `Elections & Governance`; :104 = `Surveys & Polls`.
- MODULE_MAP.md:11/107 = `M01 Auth & Onboarding` (mermaid + table both `&`).
- Conclusion: Both docs now consistently use `&`. No remaining drift.

### C-3 — DOMAIN_MODEL 68 vs 78 — **CLEARED**

- **Evidence:** DOMAIN_MODEL.md:19-23 contains explicit "Footnote — count reconciliation (C-3)" block explaining the 104/93 documented Drizzle-managed surface vs ~131/~122 engine-emitted superset (Better-Auth + internals). Delta is by design, tracked at Compliance dim (CMP-P3-012 informational).
- Conclusion: Footnote satisfies the resolution requirement.

### C-4 — BR-42 orphan — **STALE**

- **Evidence:**
  - `docs/product/modules/m09-training/MODULE_SPEC.md:147` — BR-42 is anchored and tagged "Sole owner of BR-42 post TR-P1-004 split (M12 vote-integrity moved to BR-67)."
  - `docs/product/TRACE_MATRIX.md:11` — "RESOLVED 2026-06-02: BR-42 now exclusively M09 training-type (canonical per WORKFLOW_MAP §4)."
  - `docs/product/TRACE_MATRIX.md:78,92` — BR-42 listed COMPLETE (spec + code + test).
- Conclusion: BR-42 is referenced by its owning MODULE_SPEC §5. The orphan condition no longer holds. Prior finding stale.

### C-5 — Legacy flat-md specs co-exist with folder specs — **CLEARED**

- **Evidence:** MODULE_MAP.md:165 establishes spec-layout precedence ("when the flat-md and the folder-spec disagree, the folder-spec wins"). MODULE_MAP.md:167-171 enumerates the precedence order. MODULE_MAP.md:175 stamps "spec-layout reconciliation appended 2026-06-03".
- Conclusion: Co-existence is now governed by an explicit precedence rule; downgrades to a P3 housekeeping item (deletion of flat-md tracked separately, no consistency-block).

### C-6 — `semiAnnual` casing drift — **STALE**

- **Evidence:** `grep -rn "semiAnnual" docs/product/modules/m06*/` → 0 hits. All references use kebab `semi-annual`:
  - `docs/product/modules/m06-dues-payments/MODULE_SPEC.md:189` — `annual/semi-annual/quarterly`
  - `docs/product/modules/m06-dues-payments/API_CONTRACTS.md:447,708` — `annual / semi-annual / quarterly`
  - `docs/product/modules/m06-dues-payments/ui-prototype/screens.md:182` — `annual/semi-annual/quarterly`
- Conclusion: All four artifacts converged on kebab-case. No camelCase variant exists. Prior drift no longer present.

### C-7 — `creditValue` / `creditHours` / `creditAmount` — **RESOLVED-BY-DESIGN**

- **Evidence:** DOMAIN_MODEL.md:389-393 footnote documents three distinct entity fields:
  - `training.creditAmount` (M09) — credit value assigned at training-definition time (source field).
  - `credit_entry.creditValue` (M10) — credit value recorded on individual ledger entry (authoritative running record).
  - Cross-module events (`TrainingCompleted`, `CreditAwarded`) carry `creditValue` because event payloads normalize to M10 authoritative field name.
- The audit (C-7) flagged this as "three names for one concept" via surface-grep; per-entity inspection confirms three different concepts.
- Conclusion: Per-entity field choice. Resolved-by-design — no rename.

### C-8 — `PersonCreated.name` vs split fields — **STALE** (contract side)

- **Evidence:** `docs/product/EVENT_CONTRACTS.md:92` already shows `PersonCreated` payload as `{ personId, email, firstName, lastName }`. No `.name` field present in the contract.
- Conclusion: Event contract is already split. Any emitter-side drift (if present) is a Compliance-dim concern (spec→code), not a Consistency-dim concern (spec↔spec).

### C-9 — M08 `status === 'Active'` excludes Life — **RESOLVED-BY-DESIGN**

- **Evidence:** `docs/product/modules/m08-events/MODULE_SPEC.md:167` — "Membership status eligibility note: Registration allowed for Active status. **Life members always compute to Active via BR-03 (sentinel expiry 2099-12-31)** — no special handling needed."
- Conclusion: BR-03 collapses Life into the computed `Active` status; a single equality check is correct by design. Adding `'Life'` to a whitelist would be dead code.

## Blocking Conflicts (P1) — 0 findings

None open.

## Warnings (P2) — 0 actionable findings

All 8 prior P2 findings (C-2..C-9) are cleared, stale, or resolved-by-design (see "Verify-first triage outcomes" above). Carried forward only as labels for traceability — no remediation action remains.

## Notes (P3) — advisory, 24 findings (unchanged from prior pass)

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
| A13 | BR-01..BR-41 + BR-42 (M09-anchored) + BR-67 (M12-anchored) | WORKFLOW_MAP §4, m09 MODULE_SPEC:147, TRACE_MATRIX:78 | CONSISTENT (C-4 stale; BR-42 not orphan) |
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
| A24 | Admin-role grid alignment (`super \| support \| analyst`) | ROLE_PERMISSION_MATRIX §3.1..3.21 (29 grids), `platform-admin.schema.ts:39-43` adminRoleEnum, RPM "Platform Admin Levels" sub-table | CONSISTENT (C-1 closed) |
| A25 | Module-name canonical form (`&`) | MODULE_MAP.md:11/107, MASTER_PRD.md:77/78/82/87/93/104 | CONSISTENT (C-2 cleared this pass) |
| A26 | DOMAIN_MODEL count reconciliation footnote | DOMAIN_MODEL.md:19-23 | CONSISTENT (C-3 cleared) |
| A27 | Spec-layout precedence (folder-spec > flat-md) | MODULE_MAP.md:165-175 | CONSISTENT (C-5 cleared) |
| A28 | `billingFrequency` enum kebab-case (`semi-annual`) | M06 MODULE_SPEC:189, API_CONTRACTS:447/708, screens.md:182 | CONSISTENT (C-6 stale) |
| A29 | Credit-field per-entity choice (`creditAmount` source / `creditValue` ledger+event) | DOMAIN_MODEL.md:389-393 footnote | CONSISTENT by design (C-7 resolved) |
| A30 | `PersonCreated` payload split-name | EVENT_CONTRACTS.md:92 | CONSISTENT (C-8 stale on contract side) |
| A31 | M08 event eligibility — Active+Life via BR-03 | M08 MODULE_SPEC.md:167 | CONSISTENT by design (C-9 resolved) |

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
All legacy P0/HIGH findings (H-1..H-8 from 2026-05-21 wave) remain RESOLVED. Anchors A3, A17–A31 preserve the fixes.

### P1 — none open
- C-1 closed last pass (anchor A24); confirmed this pass.

### P2 — 0 actionable
All 8 prior P2 findings (C-2..C-9) triaged this pass:
- **Cleared (3):** C-2 (module-name `&` canonical), C-3 (DOMAIN_MODEL footnote), C-5 (spec-layout precedence)
- **Stale (3):** C-4 (BR-42 anchored in m09:147), C-6 (no `semiAnnual` hits), C-8 (PersonCreated already split)
- **Resolved-by-design (2):** C-7 (per-entity credit-field choice, footnote at DOMAIN_MODEL:389-393), C-9 (Active+Life via BR-03 sentinel-expiry)

### P3 — 24 open (informational)
- 2 stale `[INFERRED]` tags (P3-1, P3-2)
- 22 `[VERIFY]` tags — deferred to Stage 2 sign-off

## What's Next

1. **Verdict: PASS.** With 0 actionable P0/P1/P2, downstream `/oli-plan-slices` is unblocked from a Stage 1 consistency standpoint. Stage 2 sign-off remains a separate prerequisite for unconditional planning under the regulated flag.
2. **P3 housekeeping (non-blocking):** resolve P3-1 (`ImpersonationSession`) and P3-2 (M09 WF-058..064 backfill) at next spec sweep.
3. **Stage 2 (interactive)** to clear the 22 `[VERIFY]` tags. Headless `--auto` cannot collect role sign-offs; not blocking from consistency standpoint.
4. **Watch list (next pass):** if Better-Auth tables surface as in-scope domain entities, revisit DOMAIN_MODEL.md:19-23 footnote scope.

## Pipeline Position

`/oli-check --consistency --auto` ✅ executed (this report) → 0 actionable P0/P1 → verdict PASS → Stage 2 sign-off remains the next required step before unconditional downstream planning under the regulated flag.

---

_Regenerated 2026-06-03T10:48:00Z by `/oli-check --consistency --auto` (oli-spec-gate Stage 1, read-only, post-Phase-D verify-first triage). Every prior C-N / P3-N finding was re-checked against current spec state with grep + targeted reads; classification recorded in "Verify-first triage outcomes". Regression anchors A1..A31 preserved._
