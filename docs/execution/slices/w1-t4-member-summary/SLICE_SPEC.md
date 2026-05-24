---
slice: w1-t4-member-summary
phase: wave1-financial
priority: P1
agent_skills: [oli-execution-gate]
---

# T4: getDuesMemberSummary Endpoint

## Goal
New endpoint providing per-member financial detail: all invoices, payments, balance, status timeline. Powers the member drill-down page.

## Acceptance Criteria

- **AC-T4-001**: `GET /association/member/dues-member-summary/{orgId}/{personId}` returns 200 with all invoices for the member
- **AC-T4-002**: Response includes all payments with method, status, date, amount
- **AC-T4-003**: Response includes computed balance (total outstanding across all unpaid invoices)
- **AC-T4-004**: Response includes membership status timeline from status history
- **AC-T4-005**: Endpoint requires officer authentication (returns 401/403 for unauthorized)
- **AC-T4-006**: Member with no invoices returns valid empty response (invoices: [], payments: [], balance: 0)

## Business Rules

- **BR-T4-001**: IF balance is computed THEN it equals sum of unpaid invoice amounts (status != 'paid')
- **BR-T4-002**: IF member has refunded payments THEN balance reflects refund (payment amount subtracted from collected, not from outstanding)

## Files in Scope
- `services/api-ts/src/handlers/association:member/getDuesMemberSummary.ts` — NEW handler
- `services/api-ts/src/handlers/association:member/getDuesMemberSummary.test.ts` — NEW test
- `services/api-ts/src/handlers/association:member/repos/dues-payments.repo.ts` — ADD getMemberFinancialSummary()

## Out of Scope
- Frontend member detail page (T6)
- Chart components (T5)
