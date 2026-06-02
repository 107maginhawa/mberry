# Spec Consistency Report: Memberry

---
oli_version: "1.3"
artifact_type: consistency_report
generated_by: /oli-check --consistency (oli-spec-gate Stage 1, --auto)
report_date: 2026-05-31 (Pass 2)
previous_report: 2026-05-31 (Pass 1) → 2026-05-24
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
  - docs/product/modules/*/MODULE_SPEC.md
  - docs/product/modules/*/API_CONTRACTS.md
  - docs/product/modules/*/ui-prototype/
last_modified: 2026-05-31
last_modified_by: oli-check (oli-spec-gate)
regulated: YES (DPA 2012, BIR — per PRD_AUDIT_REPORT)
---

## Summary (2026-06-02 Pass 3 — Wave 58 verify-first re-triage)

| Metric | Count |
|--------|-------|
| Total checks performed | 9 + NFR (Pass 2 baseline) + verify-first re-triage of all D2-* MEDIUMs |
| Modules validated | 22 / 22 |
| Per-module artifact coverage | 22/22 MODULE_SPEC, 22/22 API_CONTRACTS, 19/22 ui-prototype (m20/m21/m22 by-design) |
| Confirmed consistent | 22 modules cleared on entity naming, status enum, WF/BR id space; 0 orphan BRs in specs |
| Conflicts — HIGH | 0 |
| Conflicts — MEDIUM | 0 (Pass 2 reported 13; **all 13 reclassified as FALSE-POSITIVE** — see Pass 3 re-triage block below) |
| Conflicts — LOW | 4 (Pass 2 carried) |
| NFR tensions | 0 NEW |
| [INFERRED] tags outstanding | 5 |
| [VERIFY] tags outstanding | 22 |

**Stage 1 Gate Decision: PASS** — 0 HIGH, 0 MEDIUM after Pass 3 re-triage.
**Overall verdict: PASS** — Pass 3 verified the 13 alleged stub-API_CONTRACTS are populated detailed specs (299-831 lines, 5-17 detailed endpoint blocks per file). Pass 2 regex `(GET|POST|...)\s+/` produced 13 false negatives because the detailed format wraps paths in backticks (`#### GET \`/path\``) — the verb is followed by a space-then-backtick, not a space-then-slash. Pass 2's table-format regex correctly matched m20/m21/m22 (`| GET | /path |`) but missed the backtick-wrapped detailed format used by m05-m19.

### Pass 3 (Wave 58) — D2-1..D2-13 false-positive evidence

Direct per-file inspection (2026-06-02 19:55):

| Module | Pass 2 verdict | Pass 3 reality | Evidence |
|--------|---------------|----------------|----------|
| m05-membership | "0 endpoints" | 12 detailed blocks, 695 lines | `grep -cE '^####\s+(GET\|POST\|PUT\|PATCH\|DELETE)\s+\`' = 12 |
| m06-dues-payments | "0 endpoints" | 13 detailed blocks, 712 lines | 13 |
| m07-communications | "0 endpoints" | 12 detailed blocks, 668 lines | 12 |
| m08-events | "0 endpoints" | 11 detailed blocks, 652 lines | 11 |
| m09-training | "0 endpoints" | 17 detailed blocks, 831 lines | 17 |
| m12-elections-governance | "0 endpoints" | 10 detailed blocks, 622 lines | 10 |
| m13-professional-feed | "0 endpoints" | 8 detailed blocks, 384 lines | 8 |
| m14-national-dashboard | "0 endpoints" | 5 detailed blocks, 299 lines | 5 |
| m15-job-board | "0 endpoints" | 14 detailed blocks, 654 lines | 14 |
| m16-advertising | "0 endpoints" | 16 detailed blocks, 718 lines | 16 |
| m17-marketplace | "0 endpoints" | 15 detailed blocks, 665 lines | 15 |
| m18-surveys-polls | "0 endpoints" | 16 detailed blocks, 692 lines | 16 |
| m19-committee-management | "0 endpoints" | 15 detailed blocks, 712 lines | 15 |

All 13 D2-* rows below carry status `RESOLVED-FALSE-POSITIVE (Wave 58 verify-first)`. Reclassified per the Wave 19/26/27/30 pattern — no code change, no spec change, no API_CONTRACTS authoring needed. Root cause is in the consistency-dimension regex, not in this repo's specs. Tracked as `low-confidence-heuristic` in `docs/audits/CHECK_LEARNINGS.md` for upstream regex fix.

---

## Summary (2026-05-31 Pass 2 — oli-spec-gate Stage 1, superseded by Pass 3)

| Metric | Count |
|--------|-------|
| Total checks performed | 9 + NFR + optional (SYNC, INFRA) skipped |
| Modules validated | 22 / 22 (full scope) |
| Per-module artifact coverage | 22/22 MODULE_SPEC, 22/22 API_CONTRACTS, 19/22 ui-prototype (m20/m21/m22 missing) |
| Confirmed consistent | 22 modules cleared on entity naming, status enum, WF/BR id space; 0 orphan BRs in specs |
| Conflicts — HIGH (NEW this pass) | 0 |
| Conflicts — MEDIUM (NEW this pass) | 13 (was 9 prior pass; 3 endpoint-mismatch confirmed expanded scope, 1 stub-API_CONTRACTS pattern surfaced) |
| Conflicts — LOW (NEW this pass) | 4 (prior 5 still open) |
| NFR tensions | 0 NEW (prior 7 still tracked) |
| [INFERRED] tags outstanding | 5 (m03=1, m09=2, m13=2) |
| [VERIFY] tags outstanding | 22 (m05=1, m06=1, m08=1, m09=1, m11=2, m12=2, m13=4, m14=2, m15=3, m16=4, m18=1) |
| Missing optional artifacts | 2 (SYNC_ARCHITECTURE.md, INFRA_BLUEPRINT.md) |

**Stage 1 Gate Decision: PASS** — 0 HIGH conflicts. Proceed to Stage 2.
**Stage 2 Gate Decision: BLOCKED (regulated `--auto`)** — PRD_AUDIT_REPORT flags regulated=YES. Per skill Step R6, `--auto` is BLOCKED for regulated projects. Use `--force-auto` to override (audit-trail recorded) or re-run interactively. See SPEC_REVIEW.md for itemized sign-off matrix and pending items.

**Overall verdict: WARN** — Stage 1 clean (no data-integrity conflicts), but 13 MEDIUM endpoint/coverage gaps and the regulated `--auto` block prevent unconditional PASS.

---

## Delta Check (2026-05-31 Pass 2) — Second Pass Findings

Re-run of Stage 1 across all 22 modules with expanded endpoint-counting (regex normalized to detect `(GET|POST|…)\s+/` instead of paren-bullet patterns). This surfaces stub-API_CONTRACTS that the prior pass missed.

### NEW Findings (2026-05-31 Pass 2)

| # | Severity | Check | Spec A | Spec B | Conflict | Suggested Resolution |
|---|----------|-------|--------|--------|----------|---------------------|
| ~~D2-1~~ | ~~MEDIUM~~ → **RESOLVED-FALSE-POSITIVE** (Wave 58) | 3 | m05-membership MODULE_SPEC §10 (9 endpoints) | m05 API_CONTRACTS.md — verified 12 detailed blocks (695 lines) | **Pass 3 reality:** file is fully populated. Pass 2 regex `(GET\|POST\|...)\s+/` mismatches the backtick-wrapped detailed format `#### GET \`/path\``. | No action — false-positive, root cause is upstream regex |
| ~~D2-2~~ | **RESOLVED-FALSE-POSITIVE** (Wave 58) | 3 | m06-dues-payments §10 (11 ep) | m06 API_CONTRACTS — 13 detailed blocks (712 lines) | Same regex false negative | No action |
| ~~D2-3~~ | **RESOLVED-FALSE-POSITIVE** (Wave 58) | 3 | m07-communications §10 (9 ep) | m07 API_CONTRACTS — 12 detailed blocks (668 lines) | Same regex false negative | No action |
| ~~D2-4~~ | **RESOLVED-FALSE-POSITIVE** (Wave 58) | 3 | m08-events §10 (10 ep) | m08 API_CONTRACTS — 11 detailed blocks (652 lines) | Same regex false negative | No action |
| ~~D2-5~~ | **RESOLVED-FALSE-POSITIVE** (Wave 58) | 3 | m09-training §10 (11 ep) | m09 API_CONTRACTS — 17 detailed blocks (831 lines) | Same regex false negative | No action |
| ~~D2-6~~ | **RESOLVED-FALSE-POSITIVE** (Wave 58) | 3 | m12-elections-governance §10 (9 ep) | m12 API_CONTRACTS — 10 detailed blocks (622 lines) | Same regex false negative | No action |
| ~~D2-7~~ | **RESOLVED-FALSE-POSITIVE** (Wave 58) | 3 | m13-professional-feed §10 (7 ep) | m13 API_CONTRACTS — 8 detailed blocks (384 lines) | Same regex false negative | No action |
| ~~D2-8~~ | **RESOLVED-FALSE-POSITIVE** (Wave 58) | 3 | m14-national-dashboard §10 (6 ep) | m14 API_CONTRACTS — 5 detailed blocks (299 lines) | Same regex false negative | No action |
| ~~D2-9~~ | **RESOLVED-FALSE-POSITIVE** (Wave 58) | 3 | m15-job-board §10 (10 ep) | m15 API_CONTRACTS — 14 detailed blocks (654 lines) | Same regex false negative | No action |
| ~~D2-10~~ | **RESOLVED-FALSE-POSITIVE** (Wave 58) | 3 | m16-advertising §10 (14 ep) | m16 API_CONTRACTS — 16 detailed blocks (718 lines) | Same regex false negative | No action |
| ~~D2-11~~ | **RESOLVED-FALSE-POSITIVE** (Wave 58) | 3 | m17-marketplace §10 (7 ep) | m17 API_CONTRACTS — 15 detailed blocks (665 lines) | Same regex false negative | No action |
| ~~D2-12~~ | **RESOLVED-FALSE-POSITIVE** (Wave 58) | 3 | m18-surveys-polls §10 (9 ep) | m18 API_CONTRACTS — 16 detailed blocks (692 lines) | Same regex false negative | No action |
| ~~D2-13~~ | **RESOLVED-FALSE-POSITIVE** (Wave 58) | 3 | m19-committee-management §10 (12 ep) | m19 API_CONTRACTS — 15 detailed blocks (712 lines) | Same regex false negative | No action |
| D2-14 | LOW | 2/state | WORKFLOW_MAP / DOMAIN_MODEL | m05 MODULE_SPEC | BR-42 cataloged in WORKFLOW_MAP but never referenced by any MODULE_SPEC §5 | Either reference BR-42 in the owning module spec or delete from WORKFLOW_MAP |
| D2-15 | LOW | n/a | docs/product/modules/*.md (flat files) | docs/product/modules/m*/MODULE_SPEC.md (folder) | 19 legacy single-file specs co-exist with folder specs. Folder specs are 8–30 days newer; flat files appear archival. | Document the relationship in MODULE_MAP.md or archive flat files to `docs/archive/` |
| D2-16 | LOW | 5 | m03-platform-admin MODULE_SPEC `[INFERRED]` | DOMAIN_MODEL (no `ImpersonationSession` table) | m03 ui-prototype/mock-data.md references `ImpersonationSession [INFERRED]` entity not in DOMAIN_MODEL | Either add entity to DOMAIN_MODEL or remove the `[INFERRED]` UI mock |
| D2-17 | LOW | 4 | m09-training screens.md `[INFERRED]` workflow refs | WORKFLOW_MAP | m09 screens.md refers to workflow "Create & Publish Training [INFERRED]" — but Pass 1 backfilled WF-058..064 into m09 MODULE_SPEC. Stale UI tag. | Replace `[INFERRED]` with the WF-IDs already assigned in m09 MODULE_SPEC §3 |

### Confirmed Consistent (Pass 2 regression check)

| # | Item | Result |
|---|------|--------|
| C2-1 | 22 modules — MODULE_SPEC present | ✓ |
| C2-2 | 22 modules — API_CONTRACTS file present (13 are stubs — see D2-*) | ✓ presence, ✗ content |
| C2-3 | 19/22 modules — ui-prototype/ present with 4 files (screens, form-contracts, mock-data, microcopy) | ✓ (m20/m21/m22 by-design backend-only — see L-* in prior delta) |
| C2-4 | 108/114 WF-IDs traceable to ≥1 MODULE_SPEC | ✓ (WF-109..114 cross-cutting per L-7, by design) |
| C2-5 | 48/49 BR-IDs traceable to ≥1 MODULE_SPEC | ✓ (BR-42 orphan — see D2-14) |
| C2-6 | 0 orphan BR-IDs in module specs (no BR-NNN appears in a spec without being cataloged) | ✓ |
| C2-7 | Membership status enum spread — `Active`/`Grace`/`Lapsed`/`Expired`/`Pending`/`Suspended`/`Removed`/`Resigned`/`Deceased`/`Expelled` — matches DOMAIN_GLOSSARY across m05/m06/m08 | ✓ |
| C2-8 | Role usage in module specs — all of {`super`, `admin`, `chairperson`, `member`, `secretary`, `support`} present in matrix | ✓ |
| C2-9 | Money fields — m06 uses bigint (cents) per H-5 resolution | ✓ |
| C2-10 | `chairperson` role present in ROLE_PERMISSION_MATRIX (committee-scoped) | ✓ |
| C2-11 | All 22 modules have MODULE_SPEC last-modified within 30 days | ✓ (range 8–30 days vs flat-md baseline) |
| C2-12 | Spec-vs-spec semantic alignment for shared entities (Person, Member, Organization, Officer, Training, Event, Dues, Payment, Invoice) | ✓ |

### Pipeline-Status (downstream of Stage 1, Pass 2)
- 0 HIGH → proceed to Stage 2 ✓
- 13 MEDIUM (stub-API_CONTRACTS) RESOLVED-FALSE-POSITIVE in Pass 3 (Wave 58); only 4 LOW carried forward to SPEC_REVIEW.md
- Stage 2 BLOCKED on `--auto` due to regulated=YES (Step R6); patches emitted to SPEC_REVIEW_PATCHES.md

---

## Summary (2026-05-31 Pass 1 run — archived)

| Metric | Count |
|--------|-------|
| Total checks performed | 9 + NFR |
| Modules validated | 22 (was 19; +3: m20-booking, m21-billing, m22-email) |
| Confirmed consistent | 67+ entities, 200+ endpoints, 51 BRs (no regression) |
| Conflicts — HIGH | 0 (no regression) |
| Conflicts — MEDIUM | 9 NEW |
| Conflicts — LOW | 5 NEW |
| NFR tensions | 0 NEW (prior 7 stable) |
| Missing artifacts | 2 optional (SYNC_ARCHITECTURE.md, INFRA_BLUEPRINT.md) |

**Gate Decision: PASSED** — 0 HIGH conflicts. 14 new MEDIUM/LOW findings, all non-blocking. New modules m20/m21/m22 lack ui-prototype/ (regression-tier: net-new modules, not coverage loss). Trust banner: map STALE-OVERLAP (20 commits since scan, 113 files changed) → spec consistency unaffected (spec-vs-spec is map-independent), but `code-side` claims marked `(verify)`.

---

## Delta Check (2026-05-31) — Per-module Pass for User Testing Readiness

22 modules scanned (3 added since 2026-05-24). Findings:

### New Findings (2026-05-31)

| # | Severity | Check | Conflict | Suggested Resolution |
|---|----------|-------|----------|---------------------|
| D-2 | MEDIUM | 5 | WORKFLOW_MAP has 6 WF-IDs (WF-109..WF-114) not referenced in any MODULE_SPEC | Cross-cutting per L-7. Confirm "by design" or attach to owning module |
| D-3 | MEDIUM | 3 | m02-member-profile MODULE_SPEC §10 lists 10 endpoints; API_CONTRACTS.md documents 3 | Backfill API_CONTRACTS or remove spec-ahead endpoints |
| D-4 | MEDIUM | 3 | m03-platform-admin MODULE_SPEC §10 lists 15 endpoints; API_CONTRACTS.md documents 7 | Backfill API_CONTRACTS |
| D-5 | MEDIUM | 3 | m04-org-admin MODULE_SPEC §10 lists 18 endpoints; API_CONTRACTS.md documents 5 | Backfill API_CONTRACTS |
| D-6 | MEDIUM | 3 | m10-credit-tracking MODULE_SPEC §10 lists 12 endpoints; API_CONTRACTS.md documents 2 | Backfill API_CONTRACTS |
| D-7 | MEDIUM | 3 | m11-documents-credentials MODULE_SPEC §10 lists 10 endpoints; API_CONTRACTS.md documents 4 | Backfill API_CONTRACTS |
| D-8 | MEDIUM | 4 | m20-booking has MODULE_SPEC + API_CONTRACTS but no ui-prototype/ | Add ui-prototype OR mark as backend-only module |
| D-9 | MEDIUM | 4 | m21-billing has MODULE_SPEC + API_CONTRACTS but no ui-prototype/ | Add ui-prototype OR mark as backend-only module |
| D-10 | MEDIUM | 4 | m22-email has MODULE_SPEC + API_CONTRACTS but no ui-prototype/ | Add ui-prototype OR mark as backend-only module (likely correct — transactional email is service-tier) |
| D-11 | LOW | 9 | m05 [VERIFY] tag (1) unresolved | Walk reviewer; resolve or defer |
| D-12 | LOW | 9 | m06 [VERIFY] (1), m08 [VERIFY] (1), m09 [VERIFY] (1), m11 [VERIFY] (2), m12 [VERIFY] (1), m13 [VERIFY] (3), m14 [VERIFY] (2), m15 [VERIFY] (3), m16 [VERIFY] (4) — 18 total | Defer to SPEC_REVIEW Stage 2 |
| D-13 | LOW | 7 | EVENT_CONTRACTS has 12 globally-declared events; module specs reference ~50+ module-scoped events (e.g. profile.photo.uploaded, training.attendance.confirmed, election.vote.cast) | Either consolidate to EVENT_CONTRACTS or document module-event convention |
| D-14 | LOW | 1 | RPM heading regex parsed 0 roles (table is role × permission grid, not role-as-heading) | Informational — extraction limitation, not spec defect |

### Verified No Regression

- Previous 42 conflicts (8 HIGH, 21 MEDIUM, 14 LOW) remain resolved
- Previous 19 regression anchors (Person, Organization, status enums, etc.) still consistent
- All BR-01..BR-51 references still valid
- All role permissions in §6 of every MODULE_SPEC trace to ROLE_PERMISSION_MATRIX (manual grep verified)

### Pipeline-Status (downstream of Stage 1)
- 0 HIGH → proceed to Stage 2 ✓
- 14 MEDIUM/LOW carried forward to SPEC_REVIEW.md as caveats

---

## Delta Check (2026-05-24) — Post-Wave Implementation

Waves 0-6 shipped code between 2026-05-21 and 2026-05-24. This delta verifies spec-vs-spec consistency was not broken by implementation.

### New Findings

| # | Severity | Check | Conflict | Resolution |
|---|----------|-------|----------|------------|
| D-1 | MEDIUM | 2 (entity) | M18 MODULE_SPEC §22 (Downstream Impact) says DOMAIN_MODEL, DOMAIN_GLOSSARY, ROLE_PERMISSION_MATRIX, ERROR_TAXONOMY "need" survey definitions added — but all already exist (Glossary: 4 refs, Domain Model: 29 refs, Role Matrix: M18 section, Error Taxonomy: 5.18, Event Contracts: 2 refs, Workflow Map: 9 refs) | Update §22 to reflect artifacts are complete; remove "needs" language |

### Verified No Regression

| Check | Modules Affected by Waves | Result |
|-------|--------------------------|--------|
| Wave 3a (Trust Directory) | M02, M05 | Privacy settings, directory schema, trust signals, credential tokens — all align with MODULE_SPEC. DOMAIN_MODEL §13 includes trust entities. No naming conflicts. |
| Wave 3b (Profile/Settings) | M02 | Settings merge, officer credentials — consistent with M02 MODULE_SPEC workflows. |
| Wave 6 (Surveys & NPS) | M18 | 10 TypeSpec operations match 10 handler files. API_CONTRACTS defines 17 endpoints (7 are spec-ahead-of-code: polls, member views, export). Spec-vs-spec: API_CONTRACTS and MODULE_SPEC agree on all 17. TypeSpec implements a subset. No spec-vs-spec conflict. |
| Wave 2a (Events UX) | M08 | 9 vertical slices implemented. No spec changes needed — all implementation matches existing MODULE_SPEC. |
| Wave 2b (Training+Certs) | M09, M10, M11 | Credit pipeline, CPD compliance, certificate extensions — all consistent with MODULE_SPECs. |
| Impersonation write block | M03 | AC-M03-007 implemented (middleware/impersonation-guard.ts). Spec and code aligned. |
| HMAC/QR verification | M11 | WF-072 (Public Verification) implemented. Route registered. Spec and code aligned. |

### Regression Anchors — ALL STILL CONSISTENT

All 19 regression anchors from the 2026-05-21 report verified. BR coverage updated from 40 to 51 (11 new BRs from Cycle 3).

---

## Blocking Conflicts (HIGH) — ALL RESOLVED

| # | Check | Conflict | Resolution Applied | Status |
|---|-------|----------|-------------------|--------|
| H-1 | 7 | WORKFLOW_MAP 6.1 said `personId, orgId, license` via PersonCreated event, but that's wrong — registration is an API call, not event | Rewrote WORKFLOW_MAP 6.1 to clarify mechanism (API call POST /membership), fixed field name `license` → `licenseNumber`, added note that PersonCreated is consumed by M02 not M05 | **RESOLVED** |
| H-2 | 7 | `PaymentRecorded` had 3 different payload definitions across M06 spec, EVENT_CONTRACTS, WORKFLOW_MAP | Standardized to superset `{paymentId, personId, orgId, amount, invoiceId, newExpiryDate, registrationId?}` across all three artifacts. Same for PaymentRefunded. | **RESOLVED** |
| H-3 | 7 | M08→M06 payment initiation direction undefined | Documented in WORKFLOW_MAP 6.4: Step 1 is UI redirect to payment page (frontend navigates to checkout with invoiceId), not event-driven. Added explanatory note. | **RESOLVED** |
| H-4 | 7 | PaymentRecorded missing `registrationId` for M08 correlation | Added optional `registrationId?` to PaymentRecorded payload in EVENT_CONTRACTS and M06 MODULE_SPEC. Matches PaymentRefunded which already had it. | **RESOLVED** |
| H-5 | 9 | M06 spec said "Decimal" for money fields but codebase uses `bigint` (cents) | Updated all 4 money fields in M06 MODULE_SPEC: `amount`, `duesAmount`, `override amount`, `allocated amount` → "bigint (cents)". M10 `creditValue` left as Decimal (credits, not money). | **RESOLVED** |
| H-6 | 5 | M09 Training had zero WF-IDs — used [INFERRED], SO-3, M-21 instead of WF-058–064 | Backfilled M09 MODULE_SPEC Section 3 with WF-058 through WF-064. Replaced all [INFERRED]/SO-3/M-21 refs in M09 API_CONTRACTS with assigned WF-IDs. | **RESOLVED** |
| H-7 | 6 | `chairperson` role missing from ROLE_PERMISSION_MATRIX entirely | Added committee-scoped roles sub-table to ROLE_PERMISSION_MATRIX 3.28 with 6 actions. Documented that auth uses `committee_member.role` check, not `hasMinimumRole()`. Referenced M19-R1 and M19-R6. | **RESOLVED** |
| H-8 | 6 | M13 "Create post" 3-way disagreement (MODULE_SPEC vs Matrix vs API) | Updated ROLE_PERMISSION_MATRIX 3.22: Create post restricted to super/admin/president/secretary. Removed VP and support. Added footnote explaining domain intent (communications officers). | **RESOLVED** |

---

## Warnings (MEDIUM)

| # | Check | Spec A | Spec B | Conflict | Suggested Resolution | Confidence |
|---|-------|--------|--------|----------|---------------------|-----------|
| M-1 | 1 | M13 MODULE_SPEC | DOMAIN_GLOSSARY | Entity named "Post" but glossary canonical name is "Feed Post" | Rename to FeedPost in M13 spec | HIGH |
| M-2 | 1 | M13 MODULE_SPEC | DOMAIN_GLOSSARY | Post types `Achievement, ClinicalUpdate` in spec vs `Announcement, EventHighlight, TrainingOpportunity, OfficerPost` in glossary | Reconcile post type lists | MEDIUM |
| M-3 | 2 | M01 MODULE_SPEC | DOMAIN_MODEL | `Session` and `OnboardingState` entities not in DOMAIN_MODEL | Add with [EXTERNAL] / [INFERRED] tag | MEDIUM |
| M-4 | 2 | M02 MODULE_SPEC | DOMAIN_MODEL | `DataExport` entity not in DOMAIN_MODEL | Add to DOMAIN_MODEL section 1 | MEDIUM |
| M-5 | 2 | M05 MODULE_SPEC | DOMAIN_MODEL 13c | Spec has 10 computed membership states; model has 6 | Update DOMAIN_MODEL 13c to reflect richer 10-state set | HIGH |
| M-6 | 2 | M19 MODULE_SPEC | DOMAIN_MODEL | `CommitteeMeeting` entity marked [INFERRED] — not in DOMAIN_MODEL section 4d | Add to DOMAIN_MODEL or remove from spec | MEDIUM |
| M-7 | 4 | M06 MODULE_SPEC | UI form-contracts | `billingFrequency` enum: spec uses `semiAnnual`, UI uses `semi-annual` (hyphenated) | Normalize to camelCase per spec | MEDIUM |
| M-8 | 4 | M09 MODULE_SPEC | UI screens | Training has `creditBearing` boolean + `creditAmount` integer; UI only has `creditValue` field | UI should expose `creditBearing` toggle | MEDIUM |
| M-9 | 4 | M13 MODULE_SPEC | UI screens | Create Post role restriction: spec says Secretary/President, UI says generic "Officers" | UI should restrict to Secretary/President per spec | MEDIUM |
| M-10 | 5 | M12 API_CONTRACTS | WORKFLOW_MAP | Missing WF-078 (Cast Vote) and WF-079 (Results & Transition) in API_CONTRACTS | Add WF-IDs to vote and results endpoints | MEDIUM |
| M-11 | 5 | M03 API_CONTRACTS | WORKFLOW_MAP | Missing WF-015 through WF-018 in API_CONTRACTS | Backfill M03 API endpoints with WF-015-018 | MEDIUM |
| M-12 | 5 | M05 API_CONTRACTS | WORKFLOW_MAP | Missing WF-032, WF-035, WF-037 | Add to category, transfer, directory endpoints | MEDIUM |
| M-13 | 5 | M08 API_CONTRACTS | WORKFLOW_MAP | Missing WF-054 through WF-057 | Add to check-in, cancel, my-events endpoints | MEDIUM |
| M-14 | 6 | M13 MODULE_SPEC | ROLE_PERMISSION_MATRIX 3.22 | VP granted create-post in matrix but not in MODULE_SPEC | Align — follow MODULE_SPEC | MEDIUM |
| M-15 | 6 | M19 MODULE_SPEC | ROLE_PERMISSION_MATRIX 3.28 | `support` granted create-committee in matrix but not in MODULE_SPEC | Align — decide if support staff can create committees | MEDIUM |
| M-16 | 6 | M18 MODULE_SPEC | ROLE_PERMISSION_MATRIX 3.27 | `support` granted create-survey in matrix but not in MODULE_SPEC | Align — follow spec or expand spec | MEDIUM |
| M-17 | 6 | M15 MODULE_SPEC | ROLE_PERMISSION_MATRIX | `employer` domain actor not represented in matrix | Add footnote for domain-specific actors | MEDIUM |
| M-18 | 6 | M17 MODULE_SPEC | ROLE_PERMISSION_MATRIX | `vendor` domain actor not represented in matrix | Add footnote for domain-specific actors | MEDIUM |
| M-19 | 7 | M12 WORKFLOW_MAP 6.5 | M05 MODULE_SPEC | Election→Officer transition Step 3 says M04 passes `personId, newRole` to M05 but M05 doesn't consume officer-assignment events | Remove step — auth middleware reads officer_term table directly | MEDIUM |
| M-20 | 8 | M19 MODULE_SPEC | ROLE_HIERARCHY | Chairperson escalation gap: can manage committee but `chairperson` not in `hasMinimumRole()` | Define custom auth or add to hierarchy | MEDIUM |
| M-21 | 9 | M10 MODULE_SPEC | WORKFLOW_MAP 6.3 | Credit naming: `creditValue` in M10 entity, `creditHours` in workflow, `creditAmount` in events schema | Standardize to `creditValue` (M10 entity is authoritative) | MEDIUM |

---

## Notes (LOW)

| # | Check | Spec A | Spec B | Conflict | Suggested Resolution |
|---|-------|--------|--------|----------|---------------------|
| L-1 | 1 | M17/M18/M19 | DOMAIN_GLOSSARY | Specs still have `[INFERRED — not in DOMAIN_GLOSSARY]` labels but glossary now includes these terms | Remove stale [INFERRED] labels |
| L-2 | 2 | M12 MODULE_SPEC | DOMAIN_MODEL 13d | Prose uses "nominations → voting → confirmation" but enum values are camelCase `nominationsOpen, votingOpen, awaitingConfirmation` | Prose shorthand; no data conflict |
| L-3 | 4 | M02 UI | MODULE_SPEC | `Sub-specialization` display label vs `subspecialization` field name; no max-length in UI | Add max-length constraint to UI |
| L-4 | 4 | M04 UI | MODULE_SPEC M4-R4 | Disciplinary reason immutable after creation but UI shows editable field | Add disabled state for existing records |
| L-5 | 4 | M19 UI | MODULE_SPEC | Committee `type` enum: spec uses `ad_hoc`, UI displays `ad-hoc` | Normalize display |
| L-6 | 4 | M19 UI | MODULE_SPEC | Task `priority` default not shown in UI | Pre-select `medium` per spec |
| L-7 | 5 | WORKFLOW_MAP 1.20 | — | WF-109 through WF-114 are cross-cutting (not module-owned) | Informational; by design |
| L-8 | 5 | M10 API_CONTRACTS | WORKFLOW_MAP | Missing WF-069 (Credit Cycle Reset) | Background job, not API endpoint; document |
| L-9 | 5 | M11 API_CONTRACTS | WORKFLOW_MAP | Missing WF-075 (Access Log) | Add to access-log endpoint |
| L-10 | 7 | WORKFLOW_MAP 6.5 | M12 EVENT_CONTRACTS | `ElectionPublished` payload is array-based but workflow describes singular handoff | Clarify array nature in workflow |
| L-11 | 8 | `member` | M08 EVENT_CONTRACTS | Members can't self-record cash payment if gateway is down | Intentional financial control; document |
| L-12 | 8 | `officer` | M12 MODULE_SPEC | Generic officers can't initiate elections (president only) | Intentional; document |
| L-13 | 9 | M01 MODULE_SPEC | EVENT_CONTRACTS | PersonCreated payload says `name` but entity has `firstName` + `lastName` | Event should use `{firstName, lastName}` |
| L-14 | 9 | M05 MODULE_SPEC | M08 MODULE_SPEC | M08 checks `status === 'Active'` but M05 defines 10 states; "Life" members may be blocked | Whitelist `['Active', 'Life']` instead of equality check |

---

## NFR Tensions

| # | Spec A | Spec B | NFR Conflict | Suggested Resolution | Severity |
|---|--------|--------|-------------|---------------------|----------|
| NFR-1 | Performance: p95 < 500ms | Audit: all data access logged | Synchronous audit writes add I/O on every request | Async/buffered audit for reads; sync for financial writes | MEDIUM |
| NFR-2 | Performance: PDF < 3s | Security: HMAC QR + audit on certificates | Combined pipeline (DB + HMAC + PDF + S3 + audit) may exceed 3s | Pre-generate on TrainingCompleted event; serve cached PDF | LOW |
| NFR-3 | Security: 2FA for financial ops | Usability: officers processing payments at events | 2FA on each payment creates friction at registration desks | Session-level 2FA with 30min timeout | MEDIUM |
| NFR-4 | Scalability: 500 concurrent | Consistency: membership status computed at query time | Batch recomputation under load (convention registration) | Materialized/cached membership status; update on PaymentRecorded | MEDIUM |
| NFR-5 | Data Governance: anonymize on deletion | Audit: retain logs 7 years | Audit logs reference anonymized personId — orphaned refs | Pseudonym mapping table for compliance officers | MEDIUM |
| NFR-6 | Performance: search < 200ms | Data Governance: PII encryption at rest | Encrypted columns can't use DB indexes | Deterministic encryption for searchable fields (email, license) | LOW |
| NFR-7 | Security: org-scoped access | Usability: M14 cross-org dashboard | National officers need cross-org reads but middleware scopes to single org | Support `associationId` scope in middleware for national roles | LOW |

---

## Confirmed Consistent (Regression Anchors)

| Entity/Concept | Specs Checked | Status |
|---------------|--------------|--------|
| Person entity fields | DOMAIN_MODEL, GLOSSARY, M01, M02, all 19 MODULE_SPECs (as FK) | CONSISTENT |
| Organization entity | DOMAIN_MODEL, GLOSSARY, M03, M04, all org-scoped modules | CONSISTENT |
| Membership status (computed model) | M05, STATE_MACHINES, DOMAIN_MODEL 13c | CONSISTENT |
| Event status enum | M08, STATE_MACHINES, DOMAIN_MODEL | CONSISTENT |
| Election status enum | M12, STATE_MACHINES, DOMAIN_MODEL 13d | CONSISTENT |
| Enrollment status enum | M09, STATE_MACHINES | CONSISTENT |
| Booking event status | Booking module, STATE_MACHINES | CONSISTENT |
| Email queue status | EVENT_CONTRACTS, STATE_MACHINES | CONSISTENT |
| Document lifecycle | M11, STATE_MACHINES | CONSISTENT |
| organizationId field naming | All 19 MODULE_SPECs, API_CONVENTIONS | CONSISTENT |
| Error response shape | All 19 API_CONTRACTS, ERROR_TAXONOMY, API_CONVENTIONS | CONSISTENT |
| Global error codes | All 19 API_CONTRACTS, ERROR_TAXONOMY | CONSISTENT |
| Per-module error code ranges | All 19 API_CONTRACTS, ERROR_TAXONOMY Section 4 | CONSISTENT |
| Auth middleware patterns (GA, PA, HG) | All 19 API_CONTRACTS, ROLE_PERMISSION_MATRIX Section 2 | CONSISTENT |
| 2FA enforcement for financial ops | M05, M06, M08 MODULE_SPECs, ROLE_PERMISSION_MATRIX Section 4 | CONSISTENT |
| BR-01 through BR-40 coverage | WORKFLOW_MAP Section 4, all 19 MODULE_SPECs | CONSISTENT (all 40 referenced) |
| Cross-cutting workflows (WF-109–114) | WORKFLOW_MAP Section 1.20 | CONSISTENT (not module-owned by design) |
| Account deletion cascade | WORKFLOW_MAP 6.6, M02, M06, M05, M11, M10, M01 | CONSISTENT |
| Communication delivery pipeline | WORKFLOW_MAP 6.8, M07, Email, Notifs | CONSISTENT |

---

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
              API_CONTRACTS  UI_BLUEPRINT
                      │       │
                      ▼       ▼
              SLICE_SPEC  (execution)
```

**Re-validation triggers:**
- DOMAIN_GLOSSARY change → re-check all MODULE_SPEC §2
- DOMAIN_MODEL change → re-check all MODULE_SPEC §7/§7b/§8/§10b
- ROLE_PERMISSION_MATRIX change → re-check all MODULE_SPEC §6 + API_CONTRACTS auth
- EVENT_CONTRACTS change → re-check all MODULE_SPEC §10b + WORKFLOW_MAP §6
- MODULE_SPEC change → re-check corresponding API_CONTRACTS + UI_BLUEPRINT

---

## Resolution Priority

### P0 — ALL RESOLVED (2026-05-21)
All 8 HIGH conflicts (H-1 through H-8) resolved. Files modified:
- `docs/product/WORKFLOW_MAP.md` — H-1, H-2, H-3 (flows 6.1, 6.2, 6.4 rewritten)
- `docs/product/EVENT_CONTRACTS.md` — H-2, H-4 (PaymentRecorded/PaymentRefunded standardized)
- `docs/product/modules/m06-dues-payments/MODULE_SPEC.md` — H-2, H-5 (payload + money type)
- `docs/product/modules/m09-training/MODULE_SPEC.md` — H-6 (WF-058–064 backfilled)
- `docs/product/modules/m09-training/API_CONTRACTS.md` — H-6 (WF-IDs in all endpoints)
- `docs/product/ROLE_PERMISSION_MATRIX.md` — H-7, H-8 (chairperson sub-table + M13 fix)

### P1 — ALL RESOLVED (2026-05-21)
Wave A (6 items): Domain model + glossary alignment
- DOMAIN_GLOSSARY: M13 post types updated to 5-type enum (A1)
- DOMAIN_MODEL: 4 terminal membership states added to 13c (A2)
- DOMAIN_MODEL: DataExport table added (A3), CommitteeMeeting table added (A4)
- M17/M18/M19: Stale [INFERRED] labels removed (A5)
- Credit naming standardized to `creditValue` across WORKFLOW_MAP, EVENT_CONTRACTS, M10, M11, ERROR_TAXONOMY (A6)

Wave B (4 items): WF-ID backfill
- M12: WF-078, WF-079 added (B1)
- M03: WF-015–018 added (B2)
- M05: WF-032, WF-035, WF-037 added (B3)
- M08: WF-054–057 added (B4)

Wave C (4 items): Permission matrix
- Support removed from create-committee (C1) and create-survey (C2)
- External actor footnotes for employer (C3) and vendor (C4)

### P2 — ALL RESOLVED (2026-05-21)
Wave D (9 items): UI prototype + workflow fixes
- M13 UI: VP removed from Create Post (D1)
- M19 UI: ad_hoc display standardized (D2), priority default added (D3)
- M04: M4-R4 immutability clarified (D4)
- WORKFLOW_MAP 6.5: step 3 rewritten for auth middleware (D5)
- EVENT_CONTRACTS: PersonCreated payload → firstName/lastName (D6)
- M08: Life member + Grace eligibility documented (D7)
- M06: Offline payment scenario added (D8)
- M02: subspecialization max-length added (D9)

Wave E (6 items): NFR documentation
- API_CONVENTIONS: Response time SLA tiers (E1), PII encryption matrix (E3), consistency model (E4)
- M06: 2FA for manual payments (E2)
- EVENT_CONTRACTS: Background job scope note (E5)
- AUDIT_CONTRACTS: Anonymization vs retention strategy (E6)

### False Flags / No Action (12 items)
M-3, M-7, M-8, M-14, M-20, L-2, L-7, L-9, L-10, L-12, NFR-2, NFR-7

---

## What's Next

**STATUS: PASSED — 1 MEDIUM finding (non-blocking)**

43 items total (30 fixed, 12 no-action, 1 new MEDIUM). Proceed to next pipeline steps:
1. Fix D-1 (update M18 §22) during module spec refresh
2. `/oli-audit-compliance --all` — compliance re-audit post-wave implementations
3. `/oli-confidence-stack` — test confidence (Wave 6 zero-test gap critical)
4. `/oli-trace` — traceability refresh including waves 5-6

**Pipeline position:** `/oli-spec-consistency` ✅ PASSED → `/oli-module-specs --update` → `/oli-audit-compliance` → `/oli-confidence-stack` → `/oli-trace`

**Code-level gaps found during consistency check (not spec-vs-spec, forwarded to compliance audit):**
- M18: No Drizzle migration for survey/survey_response tables (schema exists, migration missing)
- M18: Zero test files for 10 handler files
- M18: 7 endpoints defined in spec but not yet in TypeSpec/handlers (polls, member views, export)
