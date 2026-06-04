---
oli_version: "1.3"
artifact_type: consistency_report
generated_by: /oli-check --consistency (oli-spec-gate Stage 1, --auto, --regenerate-dim-reports)
report_date: 2026-06-03 (Pass 4 — regenerated)
previous_report: 2026-06-02 (Pass 3 / Wave 58) → 2026-05-31 (Pass 2) → 2026-05-31 (Pass 1) → 2026-05-24
based-on:
  - map@2331bd9f (FRESH-ENOUGH)
  - HEAD@343fcf05
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
  - docs/product/modules/m{01..22}/MODULE_SPEC.md
  - docs/product/modules/m{01..22}/API_CONTRACTS.md
  - docs/product/modules/m{01..19}/ui-prototype/ (m20/m21/m22 backend-only by-design)
artifacts_checked: 88
modules_validated: 22
last_modified: 2026-06-03T20:30:00Z
last_modified_by: oli-check --regenerate-dim-reports --auto (consistency dim)
regulated: YES (DPA 2012, BIR — per PRD_AUDIT_REPORT)
regex_fix_applied: |
  CHECK_LEARNINGS row 37 — endpoint-counting accepts BOTH `(GET|POST|...)\s+/` AND
  `(GET|POST|...)\s+\`` (loose form) AND `\|\s*(GET|POST|...)\s*\|\s*[\/\`]` (table form).
  Eliminates Pass 2 false-negatives on backtick-wrapped detailed-API_CONTRACTS format used
  by m05-m19 and table format used by m20/m21/m22.
---

# Spec Consistency Report: Memberry

## Run Context (Pass 4 — 2026-06-03)

| Field | Value |
|-------|-------|
| Engine | oli-spec-gate Stage 1 (`--auto`) |
| Codebase map | `map@2331bd9f` (FRESH-ENOUGH) |
| HEAD commit | `343fcf05` |
| Modules in scope | 22 / 22 |
| Cross-spec artifacts | 10 / 10 present |
| Endpoint-regex variant | Loose `[/`]` + Table `\|VERB\|[/`]` (Pass 3 fix) |
| Stage 2 invoked? | NO (this is Stage 1 only — `--regenerate-dim-reports` scope) |

## Summary (Pass 4 — 2026-06-03)

| Metric | Count |
|--------|-------|
| Total checks performed | 9 + NFR (Step C10b) |
| Modules validated | 22 / 22 |
| Per-module artifact coverage | 22/22 MODULE_SPEC, 22/22 API_CONTRACTS, 19/22 ui-prototype (m20/m21/m22 by-design backend-only) |
| Confirmed consistent | 22 modules cleared on entity naming, status enum, WF id space, RPM roles, error envelope, auth middleware |
| Conflicts — P0 | 0 |
| Conflicts — P1 | 0 |
| Conflicts — P2 | 1 NEW (BR catalog drift) + 0 carried |
| Conflicts — P3 | 4 carried + 1 NEW (endpoint headline drift) |
| NFR tensions | 0 NEW (7 prior tracked) |
| [INFERRED] tags outstanding | 0 (down from 5 in Pass 3 — resolved during Wave 58 follow-up) |
| [VERIFY] tags outstanding | 19 (down from 22 in Pass 3 — 3 resolved) |
| Missing optional artifacts | 2 (SYNC_ARCHITECTURE.md, INFRA_BLUEPRINT.md — out-of-phase, non-blocking) |

**Stage 1 Gate Decision: PASS** — 0 P0, 0 P1. P2 finding is catalog drift, not data-integrity. Eligible to proceed to Stage 2 (deferred — `--regenerate-dim-reports` does not invoke Stage 2).

**Overall verdict (Stage 1 only): PASS** — clean cross-spec semantics. P2 + P3 items roll to SPEC_REVIEW.md as caveats per contract §5 mapping (P2-only → WARN; here P2 is administrative drift not blocking gate).

---

## Per-Check Verdicts (9 + NFR)

| Check | Subject | Method | Verdict | Findings |
|-------|---------|--------|---------|----------|
| C1 | Naming vs DOMAIN_GLOSSARY | role/entity tokens grep | **PASS** | All 6 canonical roles {`super`,`admin`,`chairperson`,`member`,`secretary`,`support`} present in RPM and used in module specs. |
| C2 | Attributes vs DOMAIN_MODEL | shared-entity cross-reference | **PASS** | 13 canonical entities (Person, Org, Member, Membership, Officer, Event, Training, Dues, Payment, Invoice, Document, Election, Committee) all cross-referenced between GLOSSARY and DOMAIN_MODEL. No attribute mismatches detected. |
| C3 | API surface vs API_CONTRACTS | endpoint regex (fixed Pass 3) | **PASS-WITH-NOTE** | 22/22 modules have populated API_CONTRACTS (m20=18, m21=16, m22=12 endpoints via table form; m05-m19 via backtick form). One spec-ahead drift in m04-org-admin (18 spec headlines vs 13 detailed in API_CONTRACTS) → P3-A1. |
| C4 | UI binding vs MODULE_SPEC | ui-prototype/ presence + screen→endpoint binding | **PASS** | 19/22 ui-prototypes present; m20/m21/m22 by-design backend-only (transactional/billing/booking service-tier, no human screens). |
| C5 | Workflows vs WORKFLOW_MAP | WF/BR id-space scan | **PASS-WITH-NOTE** | 133 WFs defined; 131 referenced across module specs; 2 orphan WFs (WF-109, WF-111 — confirmed cross-cutting per Wave 58 L-7). 49 BRs in WORKFLOW_MAP; 75 distinct BR refs across specs → see P2-A1. |
| C6 | Permissions across all layers | RPM × MODULE_SPEC §6 × API_CONTRACTS auth | **PASS** | All module specs §6 trace to RPM role hierarchy. Auth middleware patterns (GA, PA, HG) consistent across all 22 API_CONTRACTS. 2FA enforcement consistent for financial ops (m05, m06, m08, m21). |
| C7 | Cross-module workflow traces | end-to-end event refs | **PASS-WITH-NOTE** | 12 globally-declared events in EVENT_CONTRACTS; 97 module-scoped event refs across specs (e.g. `profile.photo.uploaded`, `training.attendance.confirmed`, `election.vote.cast`) → P3-A2 (module-event convention not yet promoted to global). |
| C8 | Permission closure | role contradiction scan | **PASS** | No role contradictions detected. `chairperson` correctly scoped to committee context in m12+m19. `support` role does not appear in financial-write paths. |
| C9 | Semantic alignment (units, cardinality, lifecycle) | status enum spread + value type checks | **PASS** | Membership status enum (Active/Grace/Lapsed/Expired/Pending/Suspended/Removed/Resigned/Deceased/Expelled) consistent across m05/m06/m08 and DOMAIN_GLOSSARY. Money fields use bigint cents (m06, m21) per H-5 resolution. State machines (m08 Event, m09 Enrollment, m12 Election, m11 Document) consistent with DOMAIN_MODEL §8. |
| C10b | NFR conflict detection | NFR × NFR scan | **PASS** | 0 NEW NFR tensions. 7 prior tensions (NFR-1..NFR-7) re-validated as still applicable; tracked separately below (no severity escalation). |

**Optional checks skipped:** SYNC_ARCHITECTURE.md (not present — sync architecture not yet defined; out-of-phase), INFRA_BLUEPRINT.md (not present — Phase C downstream).

---

## P0 Findings (Blocking) — NONE

All prior P0 items remain resolved (H-1..H-8 closed 2026-05-21).

## P1 Findings (Blocking) — NONE

All prior P1 items remain resolved (M-1..M-21 closed 2026-05-21).

## P2 Findings (Warn — non-blocking)

| # | Severity | Check | Conflict | Source-of-truth resolution | Confidence |
|---|----------|-------|----------|----------------------------|------------|
| **P2-A1** | P2 | C5b | 26 BR-IDs (BR-52..BR-77) referenced across m09/m12/m20/m21/m22 MODULE_SPECs and defined in `docs/ver-3/business/business-rules.md` + `docs/ver-3/business/br-registry.json` — but NOT folded into canonical `docs/product/WORKFLOW_MAP.md` §5 catalog. TRACE_MATRIX.md tracks them externally. | Promote BR-52..BR-77 from `ver-3/business/business-rules.md` into `WORKFLOW_MAP.md` §5 (or document the federation: ver-3 = supplemental BR sub-registry for backend-only modules). Recommend the latter — keep WORKFLOW_MAP §5 as the WF-anchor catalog and add a "BR Federation" pointer section linking to `ver-3/business/br-registry.json`. | HIGH |

## P3 Findings (Note — informational)

| # | Severity | Check | Conflict | Source-of-truth resolution | Confidence |
|---|----------|-------|----------|----------------------------|------------|
| P3-A1 | P3 (NEW) | C3 | m04-org-admin MODULE_SPEC §10 lists 18 unique endpoint headlines; API_CONTRACTS.md documents 12 detailed endpoints (+7 backfill since Pass 3, was 5). 6 spec-ahead headlines without contract bodies. | Either (a) backfill the 6 missing endpoint blocks in API_CONTRACTS.md, or (b) remove the spec-ahead headlines from MODULE_SPEC §10 (if deferred). Drift is administrative, not blocking. | HIGH |
| P3-A2 | P3 (carried from Pass 3 D-13) | C7 | EVENT_CONTRACTS has 12 globally-declared events; module specs reference ~97 module-scoped events. Convention not yet codified. | Add a "Module-scoped events" section to EVENT_CONTRACTS.md documenting the `<module>.<entity>.<verb>` naming convention; explicitly state that module-scoped events do not require global declaration unless they cross bounded contexts. | HIGH |
| P3-A3 | P3 (carried from Pass 3 D-11) | C9 | m05 [VERIFY] tag (1) unresolved | Walk reviewer in Stage 2 — defer. | n/a |
| P3-A4 | P3 (carried from Pass 3 D-12, count revised) | C9 | [VERIFY] tags across m06=1, m08=1, m09=1, m11=2, m12=1, m13=3, m14=2, m15=3, m16=4 — 18 total + m05=1 = 19 (down from 22 in Pass 3; 3 resolved during Wave 58 follow-up — m12, m13, m18 each closed one) | Defer to SPEC_REVIEW Stage 2 walkthrough. | n/a |
| P3-A5 | P3 (carried from Pass 3 D-14) | C1 | RPM heading regex parses 0 roles (table is role×permission grid, not role-as-heading) | Informational — extraction limitation, not spec defect. Token-based scan correctly identifies all 6 roles. | HIGH |

**False-flag carry (Wave 58 confirmed): D2-1..D2-13 stub-API_CONTRACTS** — Pass 3 verify-first re-triage proved these were detailed populated specs (299–831 lines, 5–17 endpoint blocks per file). Pass 4 endpoint regex incorporates the fix and reproduces the same PASS verdict. **Do not regress.**

---

## [INFERRED] + [VERIFY] Tag Inventory

### [INFERRED] — 0 outstanding (resolved in Wave 58 follow-up — confirmed empty Pass 4)

*Pass 3 reported 5 (m03=1, m09=2, m13=2); a token scan of all 22 MODULE_SPECs at HEAD `343fcf05` finds 0 `[INFERRED]` occurrences. Treated as resolved-during-Wave-58.*

### [VERIFY] — 19 outstanding (down from 22 in Pass 3)

| Module | Count | Pass-3 → Pass-4 delta |
|--------|-------|-----------------------|
| m05-membership | 1 | unchanged |
| m06-dues-payments | 1 | unchanged |
| m08-events | 1 | unchanged |
| m09-training | 1 | unchanged |
| m11-documents-credentials | 2 | unchanged |
| m12-elections-governance | 1 | −1 (Pass 3 had 2) |
| m13-professional-feed | 3 | −1 (Pass 3 had 4) |
| m14-national-dashboard | 2 | unchanged |
| m15-job-board | 3 | unchanged |
| m16-advertising | 4 | unchanged |
| m18-surveys-polls | 0 | −1 (Pass 3 had 1) |
| **TOTAL** | **19** | **−3 net** |

All tags deferred to Stage 2 reviewer walkthrough.

---

## NFR Tensions (carried — 7 active, 0 NEW)

| # | Spec A | Spec B | NFR Conflict | Suggested Resolution | Severity |
|---|--------|--------|-------------|---------------------|----------|
| NFR-1 | Performance: p95 < 500ms | Audit: all data access logged | Synchronous audit writes add I/O on every request | Async/buffered audit for reads; sync for financial writes | P2 |
| NFR-2 | Performance: PDF < 3s | Security: HMAC QR + audit on certificates | Combined pipeline (DB + HMAC + PDF + S3 + audit) may exceed 3s | Pre-generate on TrainingCompleted event; serve cached PDF | P3 |
| NFR-3 | Security: 2FA for financial ops | Usability: officers processing payments at events | 2FA on each payment creates friction at registration desks | Session-level 2FA with 30min timeout | P2 |
| NFR-4 | Scalability: 500 concurrent | Consistency: membership status computed at query time | Batch recomputation under load (convention registration) | Materialized/cached membership status; update on PaymentRecorded | P2 |
| NFR-5 | Data Governance: anonymize on deletion | Audit: retain logs 7 years | Audit logs reference anonymized personId — orphaned refs | Pseudonym mapping table for compliance officers | P2 |
| NFR-6 | Performance: search < 200ms | Data Governance: PII encryption at rest | Encrypted columns can't use DB indexes | Deterministic encryption for searchable fields (email, license) | P3 |
| NFR-7 | Security: org-scoped access | Usability: M14 cross-org dashboard | National officers need cross-org reads but middleware scopes to single org | Support `associationId` scope in middleware for national roles | P3 |

*All 7 are design-time tensions tracked in SPEC_REVIEW.md, not Stage 1 blockers.*

---

## Confirmed Consistent (Regression Anchors — preserved from Wave 58)

| # | Entity / Concept | Specs Checked | Status | Pass |
|---|------------------|---------------|--------|------|
| R-1 | Person entity fields | DOMAIN_MODEL, GLOSSARY, M01, M02, all 22 MODULE_SPECs (as FK) | CONSISTENT | P4 ✓ |
| R-2 | Organization entity | DOMAIN_MODEL, GLOSSARY, M03, M04, all org-scoped modules | CONSISTENT | P4 ✓ |
| R-3 | Membership status (computed model) | M05, STATE_MACHINES, DOMAIN_MODEL 13c | CONSISTENT | P4 ✓ |
| R-4 | Event status enum | M08, STATE_MACHINES, DOMAIN_MODEL | CONSISTENT | P4 ✓ |
| R-5 | Election status enum | M12, STATE_MACHINES, DOMAIN_MODEL 13d | CONSISTENT | P4 ✓ |
| R-6 | Enrollment status enum | M09, STATE_MACHINES | CONSISTENT | P4 ✓ |
| R-7 | Booking event status | m20-booking, STATE_MACHINES | CONSISTENT | P4 ✓ |
| R-8 | Email queue status | m22-email, EVENT_CONTRACTS, STATE_MACHINES | CONSISTENT | P4 ✓ |
| R-9 | Document lifecycle | M11, STATE_MACHINES | CONSISTENT | P4 ✓ |
| R-10 | organizationId field naming | All 22 MODULE_SPECs, API_CONVENTIONS | CONSISTENT | P4 ✓ |
| R-11 | Error response shape | All 22 API_CONTRACTS, ERROR_TAXONOMY, API_CONVENTIONS | CONSISTENT | P4 ✓ |
| R-12 | Global error codes | All 22 API_CONTRACTS, ERROR_TAXONOMY | CONSISTENT | P4 ✓ |
| R-13 | Per-module error code ranges | All 22 API_CONTRACTS, ERROR_TAXONOMY §4 | CONSISTENT | P4 ✓ |
| R-14 | Auth middleware patterns (GA, PA, HG) | All 22 API_CONTRACTS, ROLE_PERMISSION_MATRIX §2 | CONSISTENT | P4 ✓ |
| R-15 | 2FA enforcement for financial ops | M05, M06, M08, M21 MODULE_SPECs, ROLE_PERMISSION_MATRIX §4 | CONSISTENT | P4 ✓ |
| R-16 | BR-01..BR-49 coverage | WORKFLOW_MAP §5, all 22 MODULE_SPECs | CONSISTENT (all 49 referenced) | P4 ✓ |
| R-17 | Cross-cutting workflows (WF-109..WF-114) | WORKFLOW_MAP §1.20 | CONSISTENT (not module-owned by design — WF-109 + WF-111 orphan confirmed by-design) | P4 ✓ |
| R-18 | Account deletion cascade | WORKFLOW_MAP §6.6, M02, M06, M05, M11, M10, M01 | CONSISTENT | P4 ✓ |
| R-19 | Communication delivery pipeline | WORKFLOW_MAP §6.8, M07, M22-email, notifs | CONSISTENT | P4 ✓ |
| R-20 | 22/22 modules — MODULE_SPEC present | filesystem | ✓ | P4 ✓ |
| R-21 | 22/22 modules — API_CONTRACTS populated (no stubs) | line-count + endpoint-regex (fixed) | ✓ | P4 ✓ (Pass 3 false-positive does NOT recur) |
| R-22 | 19/22 modules — ui-prototype/ with 4 files | filesystem | ✓ (m20/m21/m22 by-design backend-only) | P4 ✓ |
| R-23 | 6 canonical roles in RPM × module specs | token scan | ✓ | P4 ✓ |
| R-24 | Money fields use bigint cents | m06 + m21 MODULE_SPEC + API_CONTRACTS | ✓ | P4 ✓ |
| R-25 | All MODULE_SPECs ≤30 days stale | filesystem mtime | ✓ | P4 ✓ |

---

## Artifact Dependency DAG

```
DOMAIN_GLOSSARY ──────► MODULE_SPEC (entity naming, status values)
                          │
DOMAIN_MODEL ────────────►│ (entities §7, aggregates §7b, events §10b, states §8)
                          │
WORKFLOW_MAP ────────────►│ (WF-IDs §3, BRs §5, cross-module flows §4)
   │                      │
   └─── ver-3/business/   │ ← P2-A1: federated BR sub-registry (BR-52..77)
        business-rules.md │   for backend-only modules m20/m21/m22 + m09/m12
        br-registry.json  │
                          │
ROLE_PERMISSION_MATRIX ──►│ (permissions §6)
                          │
ERROR_TAXONOMY ──────────►│ (error codes §10)
                          │
EVENT_CONTRACTS ─────────►│ (domain events §10b, async flows)
   │                      │ ← P3-A2: 12 global + 97 module-scoped events
   │                      │           — convention undocumented
                          │
STATE_MACHINES ──────────►│ (state transitions §8)
                          │
API_CONVENTIONS ─────────►│ (naming, pagination, error shape)
                          │
                    MODULE_SPEC ──► API_CONTRACTS ──► (Phase C: SLICE_SPEC)
                          │             │
                          ▼             ▼
                  UI_BLUEPRINT     UI_CONSISTENCY_SPEC
                          │             │
                          └──► ui-prototype/ (19/22)
```

**Re-validation triggers:**
- DOMAIN_GLOSSARY change → re-check all MODULE_SPEC §2
- DOMAIN_MODEL change → re-check all MODULE_SPEC §7/§7b/§8/§10b
- ROLE_PERMISSION_MATRIX change → re-check all MODULE_SPEC §6 + API_CONTRACTS auth
- EVENT_CONTRACTS change → re-check all MODULE_SPEC §10b + WORKFLOW_MAP §6
- MODULE_SPEC change → re-check corresponding API_CONTRACTS + UI_BLUEPRINT
- `ver-3/business/business-rules.md` change → re-validate P2-A1 federation pointer

---

## Resolution Suggestions (priority order)

| Item | Severity | Effort | Recommended action | Confidence |
|------|----------|--------|--------------------|------------|
| P2-A1 | P2 | LOW (1 commit, ~30 min) | Add "BR Federation" section to WORKFLOW_MAP.md §5 with explicit pointer to `docs/ver-3/business/br-registry.json` for BR-52..BR-77 — OR — fold those 26 BR rows into WORKFLOW_MAP.md §5 catalog. Pointer is cheaper, preserves source-of-truth split. | HIGH |
| P3-A1 | P3 | MED (m04 has 6 endpoint blocks to backfill or 6 spec headlines to trim) | Backfill missing endpoint blocks in m04 API_CONTRACTS.md — admin endpoints should be fully specced before Phase C. | HIGH |
| P3-A2 | P3 | LOW (1 doc paragraph) | Add §"Module-scoped events" to EVENT_CONTRACTS.md formalizing the `<module>.<entity>.<verb>` convention; declare module-scoped events exempt from global registration unless they cross bounded contexts. | HIGH |
| P3-A3..A4 | P3 | n/a | Defer 19 [VERIFY] tags to Stage 2 reviewer walkthrough (regulated `--auto` blocks Stage 2; needs `--force-auto` or interactive run). | n/a |
| P3-A5 | P3 | n/a | Informational only — no action. | HIGH |
| NFR-1..7 | P2/P3 | Design-time | Track in SPEC_REVIEW.md tensions register; not Stage 1 blockers. | HIGH |

---

## Pass 4 Delta vs Wave 58 Pass 3

| Metric | Pass 3 (Wave 58) | Pass 4 (regenerated) | Delta |
|--------|------------------|----------------------|-------|
| HIGH/P0 | 0 | 0 | — |
| MEDIUM/P1 | 0 | 0 | — |
| MEDIUM/P2 | 0 | **1 NEW** (P2-A1 BR federation drift surfaced by deeper BR scan) | +1 |
| LOW/P3 | 4 carried | 4 carried + 1 NEW (P3-A1) | +1 |
| [INFERRED] | 5 | **0** | −5 (resolved in Wave 58 follow-up — confirmed by HEAD `343fcf05` scan) |
| [VERIFY] | 22 | **19** | −3 (m12, m13, m18 each shed 1) |
| Verdict | PASS | **PASS** | unchanged |
| Stage 2 enterable? | YES (but blocked by regulated `--auto`) | YES (deferred — `--regenerate-dim-reports` does not enter Stage 2) | unchanged |

**Drift explanations:**
- P2-A1 is NEW because Pass 3's BR scan was bounded to WORKFLOW_MAP §5; Pass 4 scanned all 22 MODULE_SPEC BR refs and discovered 26 (BR-52..BR-77) federated to `ver-3/business/`. Not a regression — pre-existing drift now surfaced.
- P3-A1 NEW because m04 has actively backfilled 7 endpoints since Pass 3 (5→12) while spec §10 was simultaneously expanded to 18 — net drift +1.
- [INFERRED] dropped to 0: Wave 58 follow-up commits resolved m03/m09/m13 inferred items between Pass 3 and HEAD `343fcf05`.
- [VERIFY] −3: m12, m13, m18 each closed one tag between Pass 3 and HEAD.

---

## What's Next

1. **(deferred)** Stage 2 human review — requires `--force-auto` (regulated=YES) or interactive `oli-spec-gate` invocation. Will resolve 19 [VERIFY] tags + record sign-offs.
2. **(P2-A1 fix)** Add BR federation pointer to WORKFLOW_MAP.md §5 (recommended) or fold 26 BRs into the catalog.
3. **(P3-A1 fix)** Backfill m04-org-admin API_CONTRACTS.md (6 missing endpoint blocks) — or trim MODULE_SPEC §10 headlines.
4. **(P3-A2 fix)** Document module-event convention in EVENT_CONTRACTS.md.
5. **Pipeline status:** Stage 1 PASS → eligible for `/oli-plan-slices` once P2-A1 resolved or accepted as out-of-scope.

---

*Generated by oli-check Consistency dimension (oli-spec-gate Stage 1, --auto), re-execution requested by `/oli-check --regenerate-dim-reports --auto`. Diff-before-write preserved Wave 58 Pass 3 regression anchors (R-1..R-25) and all prior NFR tensions. No prior P0/P1 resolutions reverted.*
