# Module 3: Elections/Governance — Frontend Interaction Integrity Audit

**Date**: 2026-05-26

---

## 1. Interaction Registry

| ID | Route | Component | Action | Role | Backend/API | Status | Test |
|----|-------|-----------|--------|------|------------|--------|------|
| ELEC-INT-01 | `/officer/elections/new` | `ElectionForm` | Create election | Officer | POST create election | Likely working — **backend unguarded** | `election-form.test.tsx` |
| ELEC-INT-02 | `/officer/elections/$id/edit` | `ElectionForm` (edit) | Update election | Officer | PATCH update election | Likely working | `election-form.test.tsx` |
| ELEC-INT-03 | `/officer/elections/$id` | Officer detail | Update status | President | POST update status | Working — `requirePosition(PRESIDENT)` | `updateElectionStatus.test.ts` |
| ELEC-INT-04 | `/officer/elections/$id` | Officer detail | Certify election | Officer | POST certify | **Backend unguarded — P0** | `certifyElection.test.ts` |
| ELEC-INT-05 | `/elections/$id/vote` | `VotingBallot` | Cast vote | Active member | POST cast vote | Working — membership + duplicate checks | `voting-ballot-confirm.test.tsx` |
| ELEC-INT-06 | `/elections/$id/` | `MemberElectionDetail` | Self-nominate | Eligible member | POST create nominee | Working — eligibility checks (BR-34) | `createNominee.test.ts` |
| ELEC-INT-07 | `/elections/$id/` | `SelfNominationDialog` | Self-nomination modal | Member | POST create nominee | Working | None specific |
| ELEC-INT-08 | `/elections/` | `MemberElectionList` | View elections | Member | GET list elections | Working | `election-list.test.tsx` |
| ELEC-INT-09 | `/officer/elections/` | `ElectionList` + "New Election" link | Navigate to create | Officer | N/A | Working | `election-list.test.tsx` |
| ELEC-INT-10 | `/governance` | Governance hub | View elections + documents | Member | GET elections, GET documents | Working | NONE |

---

## 2. Broken Interaction Report

| ID | Issue | Evidence | Severity | Recommended Test |
|----|-------|---------|----------|-----------------|
| ELEC-BINT-01 | Officer detail page likely has "Certify" button — backend has no auth, so any user hitting the API directly can certify | `certifyElection.ts` — no auth check | P0 | API: non-officer/non-president POST certify → 403 |
| ELEC-BINT-02 | Non-president officers may see status transition buttons but get 403 from backend (only president can transition) — UX mismatch | `updateElectionStatus` requires PRESIDENT but frontend shows all officers the same UI | P2 | E2E: non-president officer tries status change → verify helpful error |

---

## 3. Missing Test Matrix

| Interaction | Risk | Test Type | Priority |
|------------|------|-----------|----------|
| Create election auth denial | Non-officer creates election | API integration | P0 |
| Certify election auth denial | Non-president certifies | API integration | P0 |
| Full voting E2E flow | Vote doesn't register | E2E | P1 |
| Self-nomination E2E | Nomination fails silently | E2E | P2 |
| Election lifecycle (create → nominate → vote → certify) | End-to-end flow breaks | E2E | P1 |

---

## Summary

- 10 interactions, 4 with frontend component tests
- **P0**: 1 (certify button accessible, backend unguarded)
- **P2**: 1 (UX mismatch for non-president officers)
- Frontend test coverage: BETTER THAN MOST modules (4 component test files)
