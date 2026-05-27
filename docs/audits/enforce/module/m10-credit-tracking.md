# Module Enforcement: m10-credit-tracking

**Score:** 5.8/10 — NON-COMPLIANT (capped by P1 findings)
**Previous Score:** 4.8/10
**Source:** `services/api-ts/src/handlers/person/getMyCredits.ts`, `person/getMyCreditSummary.ts`, `association:member/awardManualCredit.ts`, `association:member/getCreditTranscript.ts`, `training/markComplete.ts`, `association:operations/completeTrainingEnrollment.ts`, `association:member/repos/credits.repo.ts`, `association:member/repos/credits.schema.ts`, `association:member/utils/credit-cycle.ts`

## Dimension Scores

| Dimension | Score | P0 | P1 | P2 | P3 |
|-----------|-------|-----|-----|-----|-----|
| 1. Public API Completeness | 5/10 | 0 | 2 | 1 | 0 |
| 2. Workflow Implementation | 5/10 | 0 | 2 | 1 | 0 |
| 3. Domain Term Consistency | 7/10 | 0 | 0 | 2 | 0 |
| 4. State Machine Enforcement | 6/10 | 0 | 0 | 2 | 0 |
| 5. Event Publishing | 3/10 | 0 | 2 | 0 | 0 |
| 6. Auth/Permission Enforcement | 7/10 | 0 | 1 | 0 | 0 |

**Raw average:** 5.5 | **Capped at 6.0** (P1 findings present) | **Final: 5.8**

## Summary

M10 Credit Tracking improved from 4.8 to 5.8 since last audit. Three of 5 spec endpoints now have working handlers (up from 1 partial):

- **GET /credits/my** — `getMyCredits.ts` hand-wired at `/persons/me/credits`. Returns credit totals, category breakdown (General/Major/Self-Directed), SDL cap, compliance percent, and full history. Functional but URL path differs from spec and lacks cycle-based filtering.
- **GET /credit-summary** — `getMyCreditSummary.ts` provides cross-org aggregated summary with cycle computation. This endpoint exists beyond spec but serves WF-065 intent.
- **POST /credits/manual** — `awardManualCredit.ts` hand-wired at `/association/member/credits/manual`. Officer-gated (requirePosition), validates required fields, idempotency key, negative amounts, SDL cap warnings. Missing: future date rejection (M10-R5), supporting doc validation (PDF/image, 5MB), cycle-closed check (M10-004).
- **GET /credits/transcript** — `getCreditTranscript.ts` returns cross-org JSON transcript with carryover. Missing: PDF/CSV format export as spec requires. Behind feature flag.

Two spec endpoints remain completely unimplemented:
- **POST /credits/adjust** — Officer credit adjustment (WF-067). No handler, no route.
- **GET /orgs/:orgId/credits/compliance** — Org-wide compliance dashboard (WF-068). No handler, no route.

The data layer is strong: `CreditEntryRepository` has `findByTrainingAndPerson` (duplicate guard), `sumCreditsForCycle`, `sumCreditsByCategoryBatch`, `sumCreditsByOrg`, `listForPerson`. Schema includes proper enums and indexes. `credit-cycle.ts` correctly implements BR-11 (configurable cycle start) and BR-12 (carryover capped at 50%). Auto-credit pipeline (BR-13) works via both `markComplete.ts` and `completeTrainingEnrollment.ts`.

Test coverage is decent: `ac-m10.credit-tracking.test.ts` (AC-M10-003/004/005 domain logic), `credits.test.ts` (cycle calculation, cross-org aggregation, handler auth guards), `br-14.cross-org-credits.test.ts` (pure domain), `awardManualCredit.test.ts` (handler-level). No integration tests for missing endpoints.

## Findings

| ID | Sev | Dimension | Finding | File | Confidence |
|----|-----|-----------|---------|------|------------|
| EM-M10-c4a91e2f | P1 | API Completeness | Spec declares `POST /credits/adjust` for officer credit adjustment with mandatory reason and immutable audit log. No handler exists. `CreditEntryRepository.createOne()` could support it but no handler provides the officer adjustment workflow (WF-067). | (missing handler) | HIGH |
| EM-M10-b7d03f1a | P1 | API Completeness | Spec declares `GET /orgs/:orgId/credits/compliance` for org-wide compliance dashboard showing member credit status across a cycle. No handler exists. `CreditEntryRepository.sumCreditsByCategoryBatch()` provides the underlying data method but is unwired. | (missing handler) | HIGH |
| EM-M10-a2e8c5d0 | P2 | API Completeness | All 3 implemented handlers use hand-wired routes (`/persons/me/credits`, `/association/member/credits/manual`, `/credit-summary`) instead of TypeSpec-generated routes. Spec paths (`/credits/my`, `/credits/manual`, `/credits/transcript`) differ. Not blocking functionality but creates API surface drift. | `app.ts:337,340` | MEDIUM |
| EM-M10-d9f14b3e | P1 | Workflow | WF-066 (Add Manual Credit): `awardManualCredit.ts` validates required fields and idempotency but omits future-date rejection, supporting document validation (PDF/image, max 5MB per M10-R5), and cycle-closed check (M10-004 "Cannot modify credits in closed compliance cycle"). | `association:member/awardManualCredit.ts` | HIGH |
| EM-M10-e5c72a8d | P1 | Workflow | WF-067 (Officer Credit Adjustment) entirely missing. Spec requires: mandatory reason (M10-R4), immutable audit log (M10-R3), `CreditAdjusted` domain event, and `adjusted` entry type. No handler implements any of this. | (missing handler) | HIGH |
| EM-M10-f1b86d4c | P2 | Workflow | WF-070 (Credit Transcript Export): `getCreditTranscript.ts` returns JSON-only cross-org summary. Spec requires format selection (PDF/CSV), downloadable file output, and admin access for other members' transcripts. Behind `credit_transcript_export` feature flag. | `association:member/getCreditTranscript.ts` | HIGH |
| EM-M10-71c9e0a3 | P2 | Domain Terms | Spec uses `creditValue` for credit amounts; schema and all handlers use `creditAmount`. `CreditEntryRepository` uses `creditAmount` throughout. `markComplete.ts` passes `creditAmount: training.creditAmount`. Naming mismatch between spec and implementation. | `credits.schema.ts`, `credits.repo.ts` | MEDIUM |
| EM-M10-82da1f5b | P2 | Domain Terms | Spec defines `type` values as uppercase `MANUAL`, `AUTO`, `ADJUSTED`. Schema `creditEntryTypeEnum` uses lowercase `auto`, `manual` only. No `adjusted` type in the enum, blocking officer adjustment feature. | `credits.schema.ts` | HIGH |
| EM-M10-93eb20c6 | P2 | State Machine | Credit cycle lifecycle (open/closed) is spec-declared but not enforced. Spec M10-004 says "Cannot modify credits in closed compliance cycle". No code checks cycle open/closed status before credit creation in `awardManualCredit` or `markComplete`. | `awardManualCredit.ts`, `markComplete.ts` | MEDIUM |
| EM-M10-04fc31d7 | P2 | State Machine | `verificationStatusEnum` (pending/verified/rejected) exists in credit schema but no handler workflow uses it. Manual credits default to `null` verification status. Spec implies manual entries should go through verification but no approval/rejection flow exists. | `credits.schema.ts` | MEDIUM |
| EM-M10-15ad42e8 | P1 | Event Publishing | Spec declares `CreditAwarded` domain event (triggered when credits issued). `markComplete.ts` triggers a `credit.issue` pg-boss job (different mechanism/payload). No domain event emitted via the event bus. `getMyCredits` and `awardManualCredit` emit no events at all. | `training/markComplete.ts`, `association:member/awardManualCredit.ts` | HIGH |
| EM-M10-26be53f9 | P1 | Event Publishing | Spec declares `CreditAdjusted` event (triggered by `POST /credits/adjust`). No handler exists, so event is impossible to emit. When `POST /credits/adjust` is built, must include this event. | (missing handler) | HIGH |
| EM-M10-37cf640a | P1 | Auth/Permission | `POST /credits/adjust` and `GET /orgs/:orgId/credits/compliance` both require officer/admin auth (GA+HG). No handlers exist, so no auth enforcement. When implemented, must match ROLE_PERMISSION_MATRIX patterns. | (missing handlers) | HIGH |
| EM-M10-48d0751b | P3 | Positive | `CreditEntryRepository` is comprehensive: `createOne`, `findByTrainingAndPerson` (AC-M10-002 duplicate guard), `sumCreditsForCycle`, `sumCreditsByCategoryBatch`, `sumCreditsByOrg`, `listForPerson`. Data layer fully ready for remaining handler implementation. | `association:member/repos/credits.repo.ts` | HIGH |
| EM-M10-59e1862c | P3 | Positive | `credit-cycle.ts` correctly implements BR-11 (configurable cycle start with fixed annual anchor and registration-based fallback) and BR-12 (carryover capped at 50% of required). `getCycleForDateWithConfig` handles both modes. Well-tested. | `association:member/utils/credit-cycle.ts` | HIGH |
| EM-M10-6af2973d | P3 | Positive | Test coverage: `ac-m10.credit-tracking.test.ts` (AC-M10-003/004/005 domain logic), `credits.test.ts` (cycle calculation, cross-org aggregation, handler auth guards, getCreditTranscript handler), `br-14.cross-org-credits.test.ts` (pure domain), `awardManualCredit.test.ts` (handler validation, idempotency, SDL cap). ~40+ test cases. | `training/`, `association:member/` | HIGH |
| EM-M10-7b039a4e | P3 | Positive | Auto-credit pipeline (BR-13) works via two paths: `markComplete.ts` (training module hand-wired) and `completeTrainingEnrollment.ts` (association:operations TypeSpec). Both check for duplicates via `findByTrainingAndPerson` (AC-M10-002). Cycle computation uses association config. | `training/markComplete.ts`, `association:operations/completeTrainingEnrollment.ts` | HIGH |
| EM-M10-8c14ab5f | P3 | Positive | `getMyCredits.ts` returns category breakdown (General/Major/Self-Directed), SDL cap tracking with exceeded flag, compliance percentage, and full history — exceeds minimal spec requirements for credit visibility. | `person/getMyCredits.ts` | HIGH |
