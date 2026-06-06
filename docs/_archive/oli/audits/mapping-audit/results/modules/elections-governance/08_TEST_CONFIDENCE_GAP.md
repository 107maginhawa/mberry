# Module 3: Elections/Governance — Test Confidence Gap Audit (v2 — gap-filled)

**Scope**: All elections test files (per-file quality), frontend components, module spec BRs, form↔backend comparison
**Date**: 2026-05-26 (revised)
**Coverage Target**: 90%+

---

## 1. Test Structure Summary

### Backend Tests (Per-File Quality)

| Test File | Tests | Quality | Details |
|-----------|-------|---------|---------|
| `createElection.test.ts` | ~1 | **MINIMAL** | Only export check. Handler uses raw SQL — old repo-mocked tests deleted. |
| `certifyElection.test.ts` | Present | [NEEDS FULL REVIEW] | Certification logic tests — auth denial NOT tested |
| `ac-m12.elections.test.ts` | Present | [NEEDS FULL REVIEW] | Acceptance criteria tests |
| `elections-lifecycle.test.ts` | Comprehensive | **STRONG** | Full lifecycle chain (draft→published), vote uniqueness, anonymity, tallies hidden, nominee transitions |
| `castVote.test.ts` | Present | **STRONG** (inferred from BR-33 coverage) | Membership check, duplicate prevention |
| `createNominee.test.ts` | Present | **STRONG** (inferred from BR-34 coverage) | Eligibility: active membership, tenure, suspension |
| `updateElectionStatus.test.ts` | Present | **STRONG** | State transitions + BR-33 min candidates |
| `br-33.election-integrity.test.ts` | Dedicated BR test | **STRONG** | Voter eligibility |
| `br-34.nomination-eligibility.test.ts` | Dedicated BR test | **STRONG** | Nominee eligibility (3 conditions) |
| `flow-04.election-vote-tally.test.ts` | Dedicated flow | **STRONG** | Vote counting |
| `elections-schema.test.ts` | Schema validation | STRONG | DB schema checks |
| `getElection.test.ts` | Present | [NEEDS QUALITY CLASSIFICATION] | — |
| `listElections.test.ts` | Present | [NEEDS QUALITY CLASSIFICATION] | — |
| `nomination-eligibility-e2e.test.ts` | E2E-like | STRONG | Nomination eligibility E2E |
| `repos/elections.repo.test.ts` | Repo layer | STRONG | Repository operations |
| `repos/elections.repo.nominees.test.ts` | Repo layer | STRONG | Nominee repository |

### Frontend Tests (Per-File Quality — Gap-Filled)

| Test File | Tests | Assertions | Quality | What It Tests | What It Misses |
|-----------|-------|-----------|---------|--------------|---------------|
| `election-detail.test.tsx` | 8 | 17 (all STRONG) | **STRONG (UI-only)** | Loading, error, title, status, data tables | No action/transition button testing, no form submission |
| `election-form.test.tsx` | 9 | 15 (all STRONG) | **STRONG (UI-only)** | Step navigation, field enable/disable, type-specific fields | No submit, no validation, no API mocking, no date handling |
| `election-list.test.tsx` | 5 | 16 (all STRONG) | **STRONG (UI-only)** | Loading, error, empty, items, stats | No query/filter/tabs/pagination testing |
| `voting-ballot-confirm.test.tsx` | 4 | 11 (all STRONG) | **STRONG (UI-only)** | Dialog presence, candidate display, actions | No selection validation, no error paths, no actual vote recording |

**Frontend test pattern**: ALL use strong assertions (`toBeInTheDocument`, `toHaveLength`, `.not`) but ONLY verify UI presence — **zero tests for form submission, API integration, state transitions, or business logic**.

**Total**: 17 backend test files, 4 frontend test files, 0 E2E tests

---

## 2. Module Spec Business Rule Coverage (M12 — 8 rules)

| Rule | Description | Test Status | Severity |
|------|------------|-------------|----------|
| BR-33 | Voter must be active member of org | `br-33.election-integrity.test.ts` (STRONG) | — |
| BR-34 | Nominee: active member + 6-month tenure + not suspended | `br-34.nomination-eligibility.test.ts` (STRONG) | — |
| M12-R1 | One vote per position per member per election | `elections-lifecycle.test.ts` mentions uniqueness, `castVote` has unique constraint | PARTIAL — no explicit duplicate rejection test |
| M12-R2 | Published results immutable | **NONE** | P1 |
| M12-R3 | Election cancelled → all votes voided | **NONE** — handler not visible | P1 |
| M12-R4 | Nominations close → no new nominees | Implicit via status check in `createNominee` | PARTIAL |
| M12-R5 | Hybrid voting: online + in-person counted together | **NONE** — no implementation visible | P2 |
| M12-R6 | Each position needs ≥2 candidates before voting | `updateElectionStatus.ts` enforces, `elections-lifecycle.test.ts` covers | STRONG |

**Spec Permission Requirements:**
| Action | Spec Says | Implementation | Gap |
|--------|-----------|---------------|-----|
| Create election | **President** | NO guard | **P0** — spec explicitly requires President |
| Manage election | Election creator OR President | `updateElectionStatus` checks President | Partial |
| Certify/publish | **President or creator** | NO guard | **P0** |
| Nominate | Active member (during nominations) | `createNominee` checks eligibility | Working |
| Vote | Active member (during voting) | `castVote` checks membership | Working |

---

## 3. Form ↔ Backend Mismatches (Gap-Filled)

| Issue | Frontend | Backend | Severity |
|-------|----------|---------|----------|
| ElectionType enum drift | Form sends "officer"/"bylaw" (with mapping code for "general"/"special") | Backend Drizzle enum: "officer"/"bylaw". Spec says "general"/"special" | P2 — works but confusing |
| Field name mapping | Expects `nominationStart/End`, `votingStart/End` | Returns `nominationsOpenAt/CloseAt`, `votingOpenAt/CloseAt` | P3 — `getElection` remaps, works |
| Positions format | Frontend sends `string[]` (titles only) | Backend stores JSONB `{id, title, sortOrder}[]` | P2 — position sort order lost on edit round-trip |
| `createElection` input handling | Frontend has React Hook Form + Zod | Backend uses raw `ctx.req.json()` + `JSON.stringify(body.positions)` — NO Zod | **P1** — no backend validation, SQL injection risk via positions |

---

## 4. Behavior-to-Test Matrix (Updated)

| Behavior | Test | Quality (Revised) | Missing | Severity |
|----------|------|-------------------|---------|----------|
| Voter eligibility (BR-33) | STRONG | STRONG | — | — |
| Nominee eligibility (BR-34) | STRONG | STRONG | — | — |
| State transitions | `updateElectionStatus.test.ts` | STRONG | — | — |
| Min 2 candidates (M12-R6) | `elections-lifecycle.test.ts` | STRONG | — | — |
| Vote counting | `flow-04.test.ts` | STRONG | — | — |
| **createElection auth** | **MINIMAL** (export only) | **MINIMAL** | Non-officer/non-president denial | **P0** |
| **certifyElection auth** | Present but no auth denial | **PARTIAL** | Non-president denial | **P0** |
| Published results immutability (M12-R2) | **NONE** | **NONE** | Cannot modify published election | P1 |
| Cancellation cascade (M12-R3) | **NONE** | **NONE** | Cancel → void all votes | P1 |
| Vote uniqueness explicit test (M12-R1) | Lifecycle mentions | PARTIAL | Explicit duplicate rejection test | P1 |
| Tallies hidden during voting | Implemented in `getElection.ts` | **NONE** — no test | P2 |
| Hybrid voting (M12-R5) | **NONE** | **NONE** | Online + in-person merge | P2 |
| Frontend form submission | **NONE** | **NONE** | Form submit → API → refresh | P1 |
| Frontend vote flow | UI-only test | **PARTIAL** | Selection → submit → confirmation → API | P1 |

---

## 5. Weak Test Report (Updated)

| File/Area | Pattern | Why Weak | Severity |
|-----------|---------|---------|----------|
| `createElection.test.ts` | Only export check | Handler uses raw SQL, old tests deleted. No auth, no validation, no error paths. | P0 |
| `certifyElection.test.ts` | Present but no auth denial | Tests certification logic but not that non-president is blocked | P0 |
| All 4 frontend test files | UI-presence only | Strong assertions but zero form submission, API, or state testing | P1 |
| No E2E tests | Module has none | Critical lifecycle (create→vote→certify→transition) untested end-to-end | P1 |

---

## 6. Missing Test Report

### P0 — Critical

| Item | Risk | Test Type |
|------|------|-----------|
| createElection non-president denial | Any user creates elections | API integration |
| certifyElection non-president denial | Any user replaces officers | API integration |
| createElection input validation | Raw SQL injection via positions | Security |

### P1 — Major

| Item | Risk | Test Type |
|------|------|-----------|
| Published results immutability (M12-R2) | Results tampered | API integration |
| Cancellation cascade (M12-R3) | Orphaned votes | API integration |
| Vote uniqueness explicit test (M12-R1) | Double voting | API integration |
| Frontend form submission integration | Forms don't actually work | Integration |
| Frontend vote flow integration | Votes don't register | Integration |
| E2E: full election lifecycle | End-to-end broken | E2E |

### P2 — Important

| Item | Risk | Test Type |
|------|------|-----------|
| Tallies hidden during voting | Premature result leak | API integration |
| Hybrid voting merge (M12-R5) | Votes miscounted | API integration |
| ElectionType enum alignment | Confusion, potential bugs | Unit |
| Positions sort order preservation | Position order lost on edit | Integration |

---

## 7. Confidence Score (Revised)

| Layer | Score / 10 | Main Gap |
|-------|-----------|----------|
| Coverage Integrity | 7/10 | 17 backend + 4 frontend files. BR-33/34 excellent. createElection MINIMAL. |
| Behavior Traceability | 7/10 | BR-33, BR-34, M12-R6 well-traced. M12-R1/R2/R3/R5 untested. Spec permissions violated. |
| Test Quality | 6/10 | Backend BR tests STRONG. createElection MINIMAL. Frontend tests STRONG but UI-only (no integration). |
| Release Gate Readiness | 3/10 | P0: 2 unguarded handlers + 1 raw SQL handler. No E2E. Frontend tests don't test actual functionality. |

**Overall Module Confidence: 5.75/10** (revised down from 7.0)

---

## Summary (Revised)

- **17 backend + 4 frontend test files** — BR coverage EXCELLENT, auth coverage MISSING
- **Frontend tests are STRONG assertions but UI-only** — zero form submission or API integration
- **`createElection.test.ts` is MINIMAL** — only export check, no real tests
- **Module spec M12**: 8 BRs — 3 STRONG, 2 PARTIAL, 3 NONE
- **Spec explicitly requires President** for create + certify — implementation has NO guard (P0 confirmed by spec)
- **Form↔backend mismatches**: enum drift, positions format, field naming
- **Raw SQL in createElection**: `JSON.stringify(body.positions)` — potential SQL injection risk (P1)
- **Recommended first slice**: Add `requirePosition(PRESIDENT)` to createElection + certifyElection + Zod validation + auth denial tests
