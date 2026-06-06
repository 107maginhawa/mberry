# Module 3: Elections/Governance — Role Permission Map Audit

**Scope**: handlers/elections/, frontend elections + governance routes
**Date**: 2026-05-26
**Coverage Target**: 90%+

---

## 1. Role Inventory (Module-Scoped)

| Role | Backend Usage | Frontend Usage | Notes |
|------|-------------|---------------|-------|
| Member (active) | Can view elections, cast votes, be nominated | `/org/$orgSlug/elections/*` | Must be active member for voting (BR-33) |
| Officer (any) | Can view officer election management | `/org/$orgSlug/officer/elections/*` | `requireOrgOfficer` frontend guard |
| President | Can update election status transitions | `requirePosition(ctx, [PRESIDENT])` in `updateElectionStatus` | Only role with explicit backend guard |
| Any authenticated | Can create elections, certify elections, create nominees [LIKELY BUG] | N/A (frontend restricts to officer pages) | Backend lacks officer checks |

---

## 2. Permission Access Matrix

| Role | Action | Route/API | Frontend Enforcement | Backend Enforcement | Status | Severity |
|------|--------|-----------|---------------------|--------------------|---------|----|
| Member | List elections | `GET elections/:orgId` | `/elections/` page | Auth + org context (generated) | Working | — |
| Member | View election detail | `GET elections/:id` | `/elections/$electionId/` | Auth (no ownership check needed — read-only) | Working | — |
| Member (active) | Cast vote | `POST elections/:id/votes` | `/elections/$electionId/vote` | Checks active membership + not already voted + election in votingOpen | Working — STRONG (BR-33) | — |
| Member (eligible) | Be nominated | `POST elections/:id/nominees` | Self-nomination dialog | Checks active membership, 6-month tenure, no suspensions | Working — STRONG (BR-34) | — |
| **Any authenticated** | **Create election** | `POST elections/:orgId` | Officer page only (`/officer/elections/new`) | **NO officer/position check — only uses `session.user.id`** | **[LIKELY BUG] — any member can create elections via API** | **P0** |
| President | Update election status | `POST elections/:id/status` | Officer page | `requirePosition(ctx, [PRESIDENT])` — STRONG | Working | — |
| **Any authenticated** | **Certify election (officer transition)** | `POST elections/:id/certify` | Officer page | **NO auth/officer check — any user can trigger officer transitions** | **[LIKELY BUG] — critical: replaces officers without authorization** | **P0** |
| Officer | Manage elections | Officer election pages | `requireOrgOfficer` layout guard | Mixed — `updateElectionStatus` guarded, others NOT | Partial | — |

---

## 3. Permission Gap Report

| ID | Gap | Role | Route/API | Evidence | Risk | Severity | Recommended Test |
|----|-----|------|-----------|---------|------|----------|----|
| ELEC-GAP-01 | `createElection` has NO officer guard | Any authenticated | `createElection.ts` — no `requirePosition()`, `requireOfficerTerm()`, or role check | Uses `session.user.id` as `created_by` but never checks officer status | Any member can create elections for any org | **P0** | API: non-officer POST create election → expect 403 |
| ELEC-GAP-02 | `certifyElection` has NO auth guard | Any authenticated | `certifyElection.ts` — no session/officer/position check | Directly ends officer terms, creates new ones, generates checklists | **Any user can replace org officers** — governance integrity risk | **P0** | API: non-president POST certify → expect 403 |
| ELEC-GAP-03 | `createNominee` has no officer guard for nominating others | Any member | `createNominee.ts` — validates nominee eligibility but not nominator authority | Any member could nominate any other member (self-nomination is expected, but nominating others should require officer role) | P1 — [NEEDS PRODUCT DECISION] should only officers nominate others? | P1 |
| ELEC-GAP-04 | `getElection` returns vote tallies to any user when status is awaitingConfirmation | Any authenticated | `getElection.ts` — returns tallies when status is awaitingConfirmation or published | Pre-certification vote tallies visible to all members, not just officers | P2 — [NEEDS PRODUCT DECISION] should tallies be officer-only until published? | P2 |

---

## 4. Test Coverage Assessment

| Permission Rule | Existing Test | Quality | Missing | Recommended |
|----------------|--------------|---------|---------|-------------|
| Voter must be active member (BR-33) | `br-33.election-integrity.test.ts`, `castVote.test.ts` | STRONG | — | — |
| Nominee eligibility (BR-34) | `br-34.nomination-eligibility.test.ts`, `createNominee.test.ts` | STRONG | — | — |
| President-only status transition | `updateElectionStatus.test.ts` | STRONG | — | — |
| Access control (module) | `ac-m12.elections.test.ts` | STRONG | Missing: createElection + certifyElection auth denial | API integration |
| Lifecycle | `elections-lifecycle.test.ts`, `flow-04.election-vote-tally.test.ts` | STRONG | — | — |
| Frontend component | `election-detail.test.tsx`, `election-form.test.tsx`, `election-list.test.tsx`, `voting-ballot-confirm.test.tsx` | EXISTS (quality TBD) | — | — |
| createElection officer guard | **NONE** | **NONE** | Non-officer cannot create elections | API integration |
| certifyElection auth guard | **NONE** | **NONE** | Non-president cannot certify | API integration |

---

## Summary

- **P0 findings**: 2 (ELEC-GAP-01 createElection unguarded, ELEC-GAP-02 certifyElection unguarded)
- **P1 findings**: 1 (ELEC-GAP-03 nomination authority)
- **P2 findings**: 1 (ELEC-GAP-04 tally visibility)
- **CRITICAL RISK**: `certifyElection` with no auth can end existing officer terms and create new ones — governance integrity completely compromised via API
- **Backend test quality**: STRONG for business rules (BR-33, BR-34), lifecycle, voting — but auth gaps untested
- **Frontend component tests**: 4 files exist (election module has better frontend test coverage than most)
