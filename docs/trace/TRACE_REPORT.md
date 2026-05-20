# Intent Traceability Report

Artifact: TRACE_REPORT
Version: 1.0
Generated: 2026-05-20
Pipeline Stage: oli-trace
Based On: WORKFLOW_MAP.md, br-registry.json, TRACE_MATRIX.md, VERTICAL_SLICE_PLAN.md, 19 MODULE_SPECs
Previous Report: None (initial baseline)

---

## Graph Statistics

| Metric | Count |
|--------|-------|
| **BR nodes** | 51 (BR-01 through BR-51) |
| **WF nodes** | 114 (WF-001 through WF-114) |
| **Module nodes** | 19 (M01 through M19) |
| **MODULE_SPEC nodes** | 19 |
| **Total nodes** | 203 |
| **WF_ENFORCES_BR edges** | 57 |
| **BR_DEFINED_IN_SPEC edges** | 51 |
| **BR_TESTED_BY edges** | 49 |
| **Total edges** | 157 |

---

## Coverage Summary

| Status | Count | Percentage | BRs |
|--------|-------|------------|-----|
| COMPLETE | 36 | 70.6% | BR-01, BR-02, BR-03, BR-05, BR-06, BR-07, BR-08, BR-09, BR-11, BR-12, BR-13, BR-16, BR-17, BR-19, BR-20, BR-21, BR-22, BR-23, BR-25, BR-27, BR-28, BR-29, BR-30, BR-32, BR-33, BR-34, BR-37, BR-38, BR-41, BR-42, BR-43, BR-44, BR-45, BR-46, BR-48, BR-50 |
| PARTIAL | 12 | 23.5% | BR-10, BR-14, BR-15, BR-18, BR-24, BR-26, BR-31, BR-35, BR-36, BR-39, BR-40, BR-47 |
| ORPHAN | 1 | 2.0% | BR-04 |
| GAP (no test) | 2 | 3.9% | BR-49, BR-51 |

**Health Score: 70.6% COMPLETE, 94.1% have at least one test**

---

## Per-BR Traceability Matrix

| BR-ID | Rule | Module | Class | WF Link | Spec | Code | Test (Backend) | Test (Contract) | Test (E2E) | Chain Status |
|-------|------|--------|-------|---------|------|------|----------------|-----------------|------------|--------------|
| BR-01 | Membership Status Computation | M05 | p0-data | WF-032 | Y | Y | Y | Y | Y | COMPLETE |
| BR-02 | Grace Period Default | M05 | p1-business | WF-032 | Y | Y | Y | Y | Y | COMPLETE |
| BR-03 | Membership Transitions | M05 | p0-data | WF-032, WF-029, WF-026, WF-035 | Y | Y | Y | Y | Y | COMPLETE |
| BR-04 | Dues Amount per Org | M06 | p1-business | WF-040 | Y | -- | Y | Y | Y | ORPHAN (no production code) |
| BR-05 | Fund Allocation | M06 | p1-business | WF-039 | Y | Y | Y | Y | Y | COMPLETE |
| BR-06 | Payment Recording | M06 | p0-data | WF-044, WF-038 | Y | Y | Y | Y | -- | COMPLETE |
| BR-07 | Dues Expiry Extension | M06 | p0-data | WF-038, WF-044 | Y | Y | Y | Y | Y | COMPLETE |
| BR-08 | Refund Policy | M06 | p0-data | WF-041 | Y | Y | Y | Y | Y | COMPLETE |
| BR-09 | Officer Role Assignment | M04 | p0-data | WF-025 | Y | Y | Y | Y | Y | COMPLETE |
| BR-10 | Platform Admin Impersonation | M03 | p0-auth | WF-019 | Y | -- | Y | -- | -- | PARTIAL (test only) |
| BR-11 | Credit Cycle Start | M10 | p1-business | WF-069 | Y | Y | Y | Y | -- | COMPLETE |
| BR-12 | Credit Carry-Over | M10 | p1-business | WF-069 | Y | Y | Y | Y | -- | COMPLETE |
| BR-13 | Auto vs Manual Credits | M10 | p1-business | WF-060 | Y | Y | Y | Y | -- | COMPLETE |
| BR-14 | Cross-Org Credit Aggregation | M10 | p1-business | WF-065 | Y | -- | Y | Y | -- | PARTIAL (test only) |
| BR-15 | Training vs Event Distinction | M08 | p1-business | WF-051, WF-058 | Y | -- | Y | -- | -- | PARTIAL (test only) |
| BR-16 | Activity Visibility | M08 | p1-business | WF-051, WF-058 | Y | Y | Y | -- | Y | COMPLETE |
| BR-17 | Attendance Confirmation | M08 | p1-business | WF-053, WF-060 | Y | Y | Y | -- | Y | COMPLETE |
| BR-18 | QR Check-In Auth | M08 | p0-data | WF-053 | Y | -- | Y | -- | -- | PARTIAL (test only) |
| BR-19 | ID Card Generation | M11 | p1-business | WF-071 | Y | Y | Y | -- | -- | COMPLETE |
| BR-20 | Certificate Generation | M11 | p1-business | WF-061 | Y | Y | Y | -- | -- | COMPLETE |
| BR-21 | Multi-Org Member Account | M01 | p0-data | WF-001, WF-037 | Y | Y | Y | -- | Y | COMPLETE |
| BR-22 | Member Matching on Import | M01 | p0-data | WF-009, WF-031 | Y | Y | Y | -- | -- | COMPLETE |
| BR-23 | License Number Normalization | M01 | p0-data | WF-001, WF-031 | Y | Y | Y | -- | -- | COMPLETE |
| BR-24 | Invitation Expiry | M01 | p1-business | WF-008, WF-002 | Y | -- | Y | -- | -- | PARTIAL (test only) |
| BR-25 | OTP Registration Requirements | M01 | p0-auth | WF-001 | Y | Y | Y | -- | -- | COMPLETE |
| BR-26 | Session Management | M01 | p0-auth | WF-003 | Y | -- | Y | -- | -- | PARTIAL (test only) |
| BR-27 | Event Capacity + Waitlist | M08 | p1-business | WF-052, WF-057 | Y | Y | Y | -- | Y | COMPLETE |
| BR-28 | Communication Deduplication | M07 | p1-business | WF-046 | Y | Y | Y | -- | -- | COMPLETE |
| BR-29 | Org Public Page Requirements | M04 | p1-business | WF-028 | Y | Y | Y | -- | -- | COMPLETE |
| BR-30 | Payment Gateway Isolation | M06 | p0-data | WF-038, WF-040 | Y | Y | Y | -- | -- | COMPLETE |
| BR-31 | SVG Upload Sanitization | M02 | p0-security | WF-010, WF-024 | Y | -- | Y | -- | -- | PARTIAL (test only) |
| BR-32 | Financial Records 7yr Retention | M06 | p0-data | WF-011, WF-038 | Y | Y | Y | -- | -- | COMPLETE |
| BR-33 | Election Integrity | M12 | p0-data | WF-077 | Y | Y | Y | -- | -- | COMPLETE |
| BR-34 | Nomination Eligibility | M12 | p0-data | WF-076 | Y | Y | Y | -- | -- | COMPLETE |
| BR-35 | Feed Content Moderation | M13 | p1-business | WF-082 | Y | -- | Y | -- | -- | PARTIAL (test only, Future module) |
| BR-36 | National Dashboard Scoping | M14 | p1-business | WF-084 | Y | -- | Y | -- | -- | PARTIAL (test only) |
| BR-37 | Job Posting Expiry | M15 | p1-business | WF-090 | Y | Y | Y | -- | -- | COMPLETE |
| BR-38 | Marketplace Referral Disclosure | M17 | p1-business | WF-098 | Y | Y | Y | -- | -- | COMPLETE |
| BR-39 | Committee Dissolution Cascade | M19 | p1-business | WF-108 | Y | -- | Y | -- | -- | PARTIAL (test only, Future module) |
| BR-40 | Survey Anonymity Guarantee | M18 | p1-business | WF-101, WF-102 | Y | -- | Y | -- | -- | PARTIAL (test only, Future module) |
| BR-41 | Election State Machine Transitions | M12 | p0-data | -- | Y | Y | Y | Y | Y | COMPLETE (no WF link) |
| BR-42 | One Vote Per Person Per Position | M12 | p0-data | -- | Y | Y | Y | Y | -- | COMPLETE (no WF link) |
| BR-43 | Voting Only When votingOpen | M12 | p0-data | -- | Y | Y | Y | -- | Y | COMPLETE (no WF link) |
| BR-44 | Election Certification Effects | M12 | p1-business | -- | Y | Y | Y | -- | -- | COMPLETE (no WF link) |
| BR-45 | Credit Entry Validation | M10 | p1-business | -- | Y | Y | Y | -- | -- | COMPLETE (no WF link) |
| BR-46 | Credit Cycle Auto-Computed | M10 | p1-business | -- | Y | Y | Y | -- | -- | COMPLETE (no WF link) |
| BR-47 | Banned Users Rejected at Auth | M01 | p0-auth | -- | Y | Y | -- | -- | Y | PARTIAL (e2e only, no backend test) |
| BR-48 | Bulk Payment Batch Size Limit | M06 | p1-business | -- | Y | Y | Y | -- | -- | COMPLETE (no WF link) |
| BR-49 | Active Status Includes Grace | M01 | p1-business | -- | Y | Y | -- | -- | -- | GAP (no test at all) |
| BR-50 | Election Date Ordering Constraints | M12 | p0-data | -- | Y | Y | Y | -- | -- | COMPLETE (no WF link) |
| BR-51 | Service Token Timing-Safe Compare | M01 | p0-security | -- | Y | Y | -- | -- | -- | GAP (no test at all) |

---

## Gap List (sorted by severity)

### P0 -- Security/Auth Gaps

| # | BR | Gap Type | Description | Remediation |
|---|-----|----------|-------------|-------------|
| 1 | BR-51 | No test | Internal service token timing-safe comparison has zero tests | Add backend unit test for `timingSafeEqual` in `middleware/auth.ts` |
| 2 | BR-31 | Test-only | SVG upload sanitization -- no production code referencing BR | Add `// BR-31` annotation + verify sanitization logic exists in `uploadFile.ts` |
| 3 | BR-10 | Test-only | Platform admin impersonation guards -- no production code referencing BR | Add `// BR-10` annotation in `startImpersonation.ts` |

### P1 -- Data Integrity Gaps

| # | BR | Gap Type | Description | Remediation |
|---|-----|----------|-------------|-------------|
| 4 | BR-04 | ORPHAN | Dues amount per org -- no production code AND no test assertions for the actual business logic | Implement dues amount lookup + validation in `recordDuesPayment.ts` |
| 5 | BR-49 | No test | Active status includes grace period -- `requireActiveStatus()` allows both 'active' and 'grace' but no dedicated test | Add backend test for `requireActiveStatus()` edge cases |
| 6 | BR-18 | Test-only | QR check-in auth validation -- no production code referencing BR | Add `// BR-18` annotation in `checkIn.ts` |
| 7 | BR-14 | Test-only | Cross-org credit aggregation -- no production code referencing BR | Add `// BR-14` annotation in credit aggregation handler |
| 8 | BR-15 | Test-only | Training vs event distinction -- no production code referencing BR | Add `// BR-15` annotation in `createEvent.ts` + `createTraining.ts` |

### P2 -- Business Logic Gaps

| # | BR | Gap Type | Description | Remediation |
|---|-----|----------|-------------|-------------|
| 9 | BR-24 | Test-only | Invitation expiry -- no handler code references BR | Add `// BR-24` annotation in invite handlers |
| 10 | BR-26 | Test-only | Session management -- handled by Better-Auth, no explicit annotation | Add `// BR-26` annotation in auth middleware |
| 11 | BR-36 | Test-only | National dashboard access scoping -- handlers exist but lack annotation | Add `// BR-36` annotation in dashboard handlers |
| 12 | BR-47 | E2E only | Banned users rejected at auth -- no backend unit test | Add backend test for banned user middleware check |

### P3 -- Future Module Gaps (Deferred)

| # | BR | Gap Type | Description | Remediation |
|---|-----|----------|-------------|-------------|
| 13 | BR-35 | Test-only | Feed content moderation (M13 Future) | Implement when M13 is built |
| 14 | BR-39 | Test-only | Committee dissolution cascade (M19 Future) | Implement when M19 is built |
| 15 | BR-40 | Test-only | Survey anonymity guarantee (M18 Future) | Implement when M18 is built |

### Structural Gaps

| # | Gap Type | Description | Impact |
|---|----------|-------------|--------|
| 16 | WF orphan | All 114 WF IDs (WF-001 through WF-114) have zero code/test references | By design -- WFs are spec-layer artifacts, not code-traced |
| 17 | MODULE_SPEC BR gap | None of the 19 MODULE_SPECs reference BR-XX IDs | BRs defined in MASTER_PRD/WORKFLOW_MAP only; MODULE_SPECs lack explicit BR cross-references |
| 18 | WF mapping gap | BR-41 through BR-51 (Wave 4 discoveries) have no WF mapping in WORKFLOW_MAP section 4 | Update WORKFLOW_MAP to add WF links for 11 new BRs |
| 19 | EVENT_CONTRACTS BR gap | EVENT_CONTRACTS.md contains zero BR-XX references | Domain events not traced to business rules |
| 20 | DOMAIN_MODEL BR gap | DOMAIN_MODEL.md contains zero BR-XX references | Entity/aggregate definitions not traced to business rules |

---

## Broken Chains

A "complete chain" is: WF -> BR -> Spec -> Code -> Test

| BR | Missing Links | Chain Completeness |
|----|---------------|-------------------|
| BR-04 | Code, Test | 3/5 (WF + Spec + WF_LINK) |
| BR-49 | WF, Test | 2/5 (Spec + Code) |
| BR-51 | WF, Test | 2/5 (Spec + Code) |
| BR-10 | Code | 4/5 |
| BR-14 | Code | 4/5 |
| BR-15 | Code | 4/5 |
| BR-18 | Code | 4/5 |
| BR-24 | Code | 4/5 |
| BR-26 | Code | 4/5 |
| BR-31 | Code | 4/5 |
| BR-35 | Code | 4/5 |
| BR-36 | Code | 4/5 |
| BR-39 | Code | 4/5 |
| BR-40 | Code | 4/5 |
| BR-47 | WF, Backend test | 3/5 |
| BR-41 | WF | 4/5 |
| BR-42 | WF | 4/5 |
| BR-43 | WF | 4/5 |
| BR-44 | WF | 4/5 |
| BR-45 | WF | 4/5 |
| BR-46 | WF | 4/5 |
| BR-48 | WF | 4/5 |
| BR-50 | WF | 4/5 |

**Full chain (5/5):** 28 BRs (BR-01 through BR-40 COMPLETE set)
**4/5 chain:** 17 BRs (missing WF or Code annotation)
**3/5 chain:** 3 BRs (BR-04, BR-47, BR-49/BR-51 partially)
**2/5 chain:** 2 BRs (BR-49, BR-51)

---

## Module Coverage Heat Map

| Module | BRs | COMPLETE | PARTIAL | ORPHAN | GAP | Coverage |
|--------|-----|----------|---------|--------|-----|----------|
| M01 | 8 | 4 | 3 | 0 | 1 | 50.0% |
| M02 | 1 | 0 | 1 | 0 | 0 | 0.0% |
| M03 | 1 | 0 | 1 | 0 | 0 | 0.0% |
| M04 | 3 | 2 | 0 | 0 | 0 | 66.7% |
| M05 | 3 | 3 | 0 | 0 | 0 | 100.0% |
| M06 | 8 | 7 | 0 | 1 | 0 | 87.5% |
| M07 | 1 | 1 | 0 | 0 | 0 | 100.0% |
| M08 | 4 | 2 | 2 | 0 | 0 | 50.0% |
| M10 | 6 | 5 | 1 | 0 | 0 | 83.3% |
| M11 | 3 | 3 | 0 | 0 | 0 | 100.0% |
| M12 | 7 | 7 | 0 | 0 | 0 | 100.0% |
| M13 | 1 | 0 | 1 | 0 | 0 | 0.0% (Future) |
| M14 | 1 | 0 | 1 | 0 | 0 | 0.0% |
| M15 | 1 | 1 | 0 | 0 | 0 | 100.0% |
| M17 | 1 | 1 | 0 | 0 | 0 | 100.0% |
| M18 | 1 | 0 | 1 | 0 | 0 | 0.0% (Future) |
| M19 | 1 | 0 | 1 | 0 | 0 | 0.0% (Future) |

**Note:** M09 and M16 have zero BRs in the registry (no dedicated business rules).

---

## Workflow Coverage

All 114 WF IDs are **spec-only artifacts** -- zero code/test references exist. This is by design: the implementation traces via BR IDs and AC IDs, not WF IDs.

**WF-to-BR coverage:** 40/51 BRs have WF links (78.4%). The 11 Wave 4 discoveries (BR-41 through BR-51) need WF mapping added to WORKFLOW_MAP.md section 4.

**Unique WFs referenced by BRs:** 37 of 114 WFs are referenced by at least one BR (32.5%). The remaining 77 WFs define user journeys without explicit business rule enforcement.

---

## Acceptance Criteria Coverage

From TRACE_MATRIX.md, 46 orphan ACs exist across modules:

| Module | Orphan ACs | Status |
|--------|-----------|--------|
| M01 | AC-M01-003 | 1 orphan |
| M03 | AC-M03-001, AC-M03-003 | 2 orphans |
| M04 | AC-M04-001..005 | 5 orphans |
| M05 | AC-M05-001..002 | 2 orphans |
| M06 | AC-M06-001..005 | 5 orphans |
| M07 | AC-M07-001..004 | 4 orphans |
| M08 | AC-M08-003 | 1 orphan |
| M09 | AC-M09-002..003 | 2 orphans |
| M12 | AC-M12-001..003 | 3 orphans |
| M13 | AC-M13-001..003 | 3 orphans (Future) |
| M14 | AC-M14-001..003 | 3 orphans |
| M15 | AC-M15-001..003 | 3 orphans |
| M17 | AC-M17-001..002 | 2 orphans |
| M18 | AC-M18-001..003 | 3 orphans (Future) |
| M19 | AC-M19-001..004 | 4 orphans (Future) |

**AC coverage: ~60% implemented.** Addressed in VERTICAL_SLICE_PLAN Waves 3-6.

---

## Delta from Previous Report

No previous TRACE_REPORT.md existed. This is the **initial baseline**.

**Baseline metrics:**
- 51 BRs tracked (up from 40 in TRACE_MATRIX.md -- 11 Wave 4 additions)
- 36 COMPLETE (70.6%)
- 12 PARTIAL (23.5%)
- 1 ORPHAN (2.0%)
- 2 GAP (3.9%)
- 114 WFs defined (all spec-only)
- 46 orphan ACs across 15 modules
- 19 MODULE_SPECs exist, none cross-reference BR IDs

---

## Recommendations

1. **Immediate (P0):** Add backend test for BR-51 (timing-safe token comparison) -- security-critical with zero coverage
2. **Immediate (P0):** Add BR annotation + verify production logic for BR-31 (SVG sanitization)
3. **Short-term (P1):** Implement BR-04 (dues amount per org) -- only true ORPHAN BR
4. **Short-term (P1):** Add test for BR-49 (active status includes grace)
5. **Medium-term:** Update WORKFLOW_MAP section 4 to add WF mappings for BR-41 through BR-51
6. **Medium-term:** Add BR-XX cross-references to MODULE_SPECs for full chain traceability
7. **Long-term:** Consider adding `// WF-NNN` annotations to handlers for workflow traceability (currently spec-only)
