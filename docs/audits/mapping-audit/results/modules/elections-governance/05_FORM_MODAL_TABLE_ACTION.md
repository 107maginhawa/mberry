# Module 3: Elections/Governance — Form/Modal/Table Action Audit

**Date**: 2026-05-26

---

## 1. Form Registry

| Form | Route | Fields | API | Role | Validation | Tests | Status |
|------|-------|--------|-----|------|-----------|-------|--------|
| ElectionForm (create) | `/officer/elections/new` | title, type (officer/bylaw), votingMode, dates (nominations/voting open/close), positions, passageThreshold | POST create election | Officer | Zod schema in frontend (`ElectionForm`), backend uses raw SQL (no Zod) | `election-form.test.tsx` | [LIKELY BUG] — backend lacks input validation (raw `body.title` etc.) |
| ElectionForm (edit) | `/officer/elections/$id/edit` | Same as create + initialData | PATCH update | Officer | Same frontend Zod | `election-form.test.tsx` | Similar concern |
| VotingBallot | `/elections/$id/vote` | positionId, nomineeId (per position) | POST cast vote | Active member | `castVoteSchema` (Zod) in backend | `voting-ballot-confirm.test.tsx`, `castVote.test.ts` | Working — STRONG |
| SelfNominationDialog | `/elections/$id/` | positionId, personId | POST create nominee | Eligible member | `createNomineeSchema` (Zod) in backend | `createNominee.test.ts` | Working |

---

## 2. Modal Registry

| Modal | Trigger | Confirm | Cancel | Accessibility | Tests | Status |
|-------|---------|---------|--------|--------------|-------|--------|
| SelfNominationDialog | "Nominate Yourself" button | POST nominee | Close | [NEEDS MANUAL CONFIRMATION] — dialog component | NONE specific | Likely working |
| Vote Confirmation | Submit ballot | Confirm vote | Back | `voting-ballot-confirm.test.tsx` | YES | Working |

---

## 3. Table/List Action Registry

| Table | Action | Role | Handler | Tests | Status |
|-------|--------|------|---------|-------|--------|
| ElectionList (officer) | Create new | Officer | Navigate to /new | `election-list.test.tsx` | Working |
| ElectionList (member) | View detail | Member | Navigate to detail | NONE | Working |
| Officer election detail | Change status | President | POST update status | `updateElectionStatus.test.ts` | Working |
| Officer election detail | Certify | Officer | POST certify | `certifyElection.test.ts` | **Backend unguarded** |

---

## 4. Gap Report

| ID | Issue | Severity | Recommended Test |
|----|-------|----------|-----------------|
| ELEC-FMT-01 | `createElection` backend uses raw SQL with `body.title`, `body.type` etc. — no Zod validation, potential SQL injection risk via `JSON.stringify(body.positions)` | P1 | Security test: malformed positions array → verify safe handling |
| ELEC-FMT-02 | Frontend ElectionForm validates dates ordering but backend has DB-level CHECK constraints only — no handler-level validation | P2 | API: submit invalid date ordering → verify clean error |
| ELEC-FMT-03 | Vote confirmation exists (good), but no undo mechanism after voting | P3 — [NEEDS PRODUCT DECISION] | — |
| ELEC-FMT-04 | **ElectionType enum drift**: Frontend sends "officer"/"bylaw" (has mapping code for "general"/"special"), backend Drizzle enum stores "officer"/"bylaw", spec says "general"/"special" | P2 | Unit: verify enum alignment across layers |
| ELEC-FMT-05 | **Positions format mismatch**: Frontend sends `string[]` (titles only), backend stores JSONB `{id, title, sortOrder}[]`. Sort order lost on edit round-trip. | P2 | Integration: create → edit → verify position order preserved |
| ELEC-FMT-06 | VotingBallot casts votes PER POSITION as separate API calls — partial failure possible (some positions voted, others fail) | P2 | Integration: simulate partial ballot failure → verify state |

---

## Summary

- 4 forms, 2 modals, 4 table actions
- **P1**: 1 (raw SQL input handling in createElection)
- **P2**: 1 (date validation gap)
- **P3**: 1 (no vote undo)
- Frontend component tests: GOOD (3 test files cover core forms/components)
