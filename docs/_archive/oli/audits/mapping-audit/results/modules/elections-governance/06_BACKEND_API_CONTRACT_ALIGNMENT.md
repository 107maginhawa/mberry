# Module 3: Elections/Governance — Backend API Contract Alignment Audit

**Date**: 2026-05-26

---

## 1. API Catalogue

| Method | Path | Handler | Auth | Roles | Validation | Tests | TypeSpec |
|--------|------|---------|------|-------|-----------|-------|---------|
| POST | `/elections/:orgId` | `createElection` | GA+OC | **None enforced** [P0] | Raw SQL, no Zod | `createElection.test.ts` | **Hand-wired** |
| GET | `/elections/:id` | `getElection` | GA+OC | Any member | None needed (read) | `getElection.test.ts` | **Hand-wired** |
| GET | `/elections/:orgId` | `listElections` | GA+OC | Any member | None needed (read) | `listElections.test.ts` | **Hand-wired** |
| PATCH | `/elections/:id/status` | `updateElectionStatus` | GA+OC+`requirePosition(PRESIDENT)` | President only | State machine transitions + BR-33 | `updateElectionStatus.test.ts` | **Hand-wired** |
| POST | `/elections/:id/votes` | `castVote` | GA+OC | Active member | `castVoteSchema` (Zod) | `castVote.test.ts` | **Hand-wired** |
| POST | `/elections/:id/nominees` | `createNominee` | GA+OC | Eligible member | `createNomineeSchema` (Zod) | `createNominee.test.ts` | **Hand-wired** |
| POST | `/elections/:id/certify` | `certifyElection` | GA+OC | **None enforced** [P0] | State check only | `certifyElection.test.ts` | **Hand-wired** |

**Note**: ALL elections routes are hand-wired. The entire module has NO TypeSpec definition. No generated validators, no OpenAPI spec for elections.

---

## 2. Frontend/Backend Drift Report

| ID | Issue | Evidence | Severity |
|----|-------|---------|----------|
| ELEC-DRIFT-01 | Elections module is entirely hand-wired — no TypeSpec, no generated validators, no OpenAPI spec | All handlers use raw `ctx.req.json()` or custom Zod | P1 — inconsistent with API-first architecture |
| ELEC-DRIFT-02 | `createElection` uses raw SQL template literals — bypasses Drizzle ORM, no type safety | `createElection.ts` — `db.execute(sql\`INSERT INTO election...\`)` | P1 — maintenance risk, breaks pattern |
| ELEC-DRIFT-03 | Frontend `ElectionForm` has Zod validation but backend `createElection` has none — form fields not compared | Frontend validates, backend trusts raw JSON | P1 — validation mismatch |
| ELEC-DRIFT-04 | Vote tallies exposed in `getElection` response before certification — may not match product intent | `getElection.ts` returns tallies for awaitingConfirmation status | P2 — [NEEDS PRODUCT DECISION] |

---

## 3. API Test Gap Matrix

| API | Existing Tests | Missing | Priority |
|-----|---------------|---------|----------|
| createElection | `createElection.test.ts` | Auth denial (non-officer) + input validation | P0 |
| certifyElection | `certifyElection.test.ts` | Auth denial (non-president) | P0 |
| updateElectionStatus | `updateElectionStatus.test.ts` (STRONG) | — | — |
| castVote | `castVote.test.ts` (STRONG) | — | — |
| createNominee | `createNominee.test.ts` (STRONG) | — | — |
| Lifecycle | `elections-lifecycle.test.ts`, `flow-04.*.test.ts` (STRONG) | — | — |
| Schema | `elections-schema.test.ts` | — | — |

---

## Summary

- 7 API endpoints, ALL hand-wired (0% TypeSpec coverage)
- **P0**: 2 (createElection + certifyElection unguarded)
- **P1**: 3 (no TypeSpec, raw SQL, validation mismatch)
- **P2**: 1 (tally visibility)
- Backend test coverage: STRONG for business rules, MISSING for auth
