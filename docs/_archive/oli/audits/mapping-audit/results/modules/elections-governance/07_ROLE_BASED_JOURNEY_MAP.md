# Module 3: Elections/Governance — Role-Based Journey Map Audit

**Date**: 2026-05-26

---

## 1. Journey Registry

| Journey | Role | Start | End State | APIs | Tests | Criticality |
|---------|------|-------|-----------|------|-------|-------------|
| J-ELEC-01: Member views elections | Member | `/elections/` | Elections list displayed | GET list elections | Backend STRONG | Important |
| J-ELEC-02: Member casts vote | Active member | `/elections/$id/vote` | Vote recorded, cannot re-vote | POST cast vote | STRONG (BR-33 + duplicate check) | Critical/core |
| J-ELEC-03: Member self-nominates | Eligible member | `/elections/$id/` → dialog | Nominee created | POST create nominee | STRONG (BR-34) | Important |
| J-ELEC-04: Officer creates election | Officer | `/officer/elections/new` | Draft election created | POST create election | Backend test exists (no auth check) | Critical/core |
| J-ELEC-05: President manages election lifecycle | President | `/officer/elections/$id` | Status transitions: draft → nominations → voting → awaiting → published | POST update status | STRONG | Critical/core |
| J-ELEC-06: Officer certifies election results | President [INTENDED] | `/officer/elections/$id` | Officers transitioned, terms created/ended | POST certify | Test exists (no auth check) | Critical/core |
| J-ELEC-07: Full election lifecycle | All roles | Create → nominate → vote → tally → certify | New officers installed | All | `elections-lifecycle.test.ts`, `flow-04.test.ts` | Critical/core |
| J-ELEC-08: Member views governance hub | Member | `/governance` | Elections + documents displayed | GET elections, GET documents | NONE | Secondary |

---

## 2. Broken Journey Report

| ID | Journey | Broken Step | Evidence | Severity | Recommended Test |
|----|---------|------------|---------|----------|-----------------|
| ELEC-BJ-01 | J-ELEC-04: Create election | Backend authorization | `createElection.ts` — no officer guard | P0 | API: non-officer creates election → 403 |
| ELEC-BJ-02 | J-ELEC-06: Certify election | Backend authorization | `certifyElection.ts` — no auth guard at all | P0 | API: non-president certifies → 403 |
| ELEC-BJ-03 | J-ELEC-05: Status transition | UX mismatch | Only president can transition but all officers see the buttons | P2 | E2E: non-president tries transition → helpful error |

---

## 3. Journey Test Matrix

| Journey | Backend Tests | E2E Needed | Priority |
|---------|-------------|-----------|----------|
| J-ELEC-02: Cast vote | STRONG | Full voting flow (view → select → confirm → success) | P1 |
| J-ELEC-04: Create election | Exists (no auth) | Create + verify auth denial | P0 |
| J-ELEC-06: Certify | Exists (no auth) | Certify + verify auth denial | P0 |
| J-ELEC-07: Full lifecycle | STRONG (lifecycle + flow-04) | E2E: complete cycle | P1 |
| J-ELEC-03: Self-nominate | STRONG (BR-34) | Nomination dialog flow | P2 |

---

## Summary

- 8 journeys: 4 critical, 2 important, 1 secondary
- **P0 broken**: 2 (create + certify unguarded)
- **P2 broken**: 1 (UX mismatch)
- Business rule coverage: EXCELLENT (BR-33, BR-34 thoroughly tested)
- Auth coverage: MISSING for 2 critical operations
