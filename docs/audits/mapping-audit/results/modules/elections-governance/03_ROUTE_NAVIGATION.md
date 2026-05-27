# Module 3: Elections/Governance — Route Navigation Audit

**Date**: 2026-05-26

---

## 1. Route Registry

### Frontend Routes

| Route | Type | Component | Auth | Roles | Source |
|-------|------|-----------|------|-------|--------|
| `/org/$orgSlug/elections/` | Member list | `MemberElectionList` | requireAuth | Member | `elections/index.tsx` |
| `/org/$orgSlug/elections/$electionId/` | Member detail | `MemberElectionDetail` | requireAuth | Member | `elections/$electionId/index.tsx` |
| `/org/$orgSlug/elections/$electionId/vote` | Voting ballot | `VotingBallot` | requireAuth | Active member | `elections/$electionId/vote.tsx` |
| `/org/$orgSlug/governance` | Governance hub | Lists elections + documents | requireAuth | Member | `governance/*.tsx` |
| `/org/$orgSlug/officer/elections/` | Officer list | `ElectionList` | requireOrgOfficer | Officer | `officer/elections/index.tsx` |
| `/org/$orgSlug/officer/elections/new` | Create election | `ElectionForm` | requireOrgOfficer | Officer | `officer/elections/new.tsx` |
| `/org/$orgSlug/officer/elections/$electionId` | Officer detail | `ElectionDetailLayout` | requireOrgOfficer | Officer | `officer/elections/$electionId.tsx` |
| `/org/$orgSlug/officer/elections/$electionId/edit` | Edit election | `ElectionForm` (edit mode) | requireOrgOfficer | Officer | `officer/elections/$electionId/edit.tsx` |

### Backend API Routes (Hand-wired — elections module is NOT in TypeSpec)

| Method | Path | Handler | Auth | Notes |
|--------|------|---------|------|-------|
| POST | `/elections/:orgId` | `createElection` | Auth + org context | **No officer guard** |
| GET | `/elections/:id` | `getElection` | Auth + org context | Read-only |
| GET | `/elections/:orgId` | `listElections` | Auth + org context | Read-only |
| PATCH | `/elections/:id/status` | `updateElectionStatus` | Auth + `requirePosition(PRESIDENT)` | STRONG |
| POST | `/elections/:id/votes` | `castVote` | Auth + membership check | STRONG (BR-33) |
| POST | `/elections/:id/nominees` | `createNominee` | Auth + eligibility check | STRONG (BR-34) |
| POST | `/elections/:id/certify` | `certifyElection` | Auth only | **No officer guard — P0** |

---

## 2. Broken Navigation Report

| ID | Issue | Severity | Recommended Test |
|----|-------|----------|-----------------|
| ELEC-NAV-01 | No broken navigation found — all routes exist and link correctly | — | — |

---

## 3. Route Test Gap Matrix

| Route | Existing Tests | Missing | Priority |
|-------|---------------|---------|----------|
| Member election list | `election-list.test.tsx` | E2E: member sees elections | P2 |
| Member vote page | `voting-ballot-confirm.test.tsx` | E2E: full voting flow | P1 |
| Officer election management | `election-form.test.tsx` | E2E: create → manage → certify | P1 |
| Backend election CRUD | Multiple test files (STRONG) | Auth denial for createElection + certifyElection | P0 |

---

## Summary

- 8 frontend routes (3 member, 1 governance, 4 officer)
- 7 backend API routes (all hand-wired, not TypeSpec)
- No navigation breakage found
- Key gap: backend auth for create + certify
