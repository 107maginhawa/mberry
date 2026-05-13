# Phase 15: Domain Design Remediation — Context

## Source

Audit: `~/.claude/plans/flickering-sauteeing-liskov.md` (Codex-verified domain design audit)
Codex branch review: 5 P1 + 1 P2 findings (gpt-5.4, 2026-05-13)

## Completed (pre-GSD)

| Item | What | Tests |
|------|------|-------|
| 0a | computeMembershipStatus pure function | 11 tests |
| 0b | Schema: duesExpiryDate nullable, suspendedAt added | migration 0023 |
| 0c | createMembership + approveMembershipApplication: duesExpiryDate=null for pendingPayment | 4 tests |
| 1.1 | settle-payment.ts + markDuesInvoicePaid.ts: BR-03 status-aware reactivation | 9 tests |
| 1.2 | db.transaction() in settlePayment + markDuesInvoicePaid | 5 tests |

Total: 2123 tests pass, 0 fail (as of Wave 1.2 completion)

## Key Business Rules

- BR-01: Membership status computed from duesExpiryDate
- BR-03: Valid status transitions only (suspended/terminated NOT reactivatable by payment)
- BR-05: Fund allocation rounding (last fund absorbs remainder)
- BR-07: Expiry extension uses computeNewExpiry (billing-cycle aware)
- BR-08: Refund must reverse expiry + fund allocations
- BR-33: 2+ candidates per position before opening election voting
- BR-34: Nomination eligibility requirements

## Key Files

| File | Role |
|------|------|
| `services/api-ts/src/handlers/dues/utils/settle-payment.ts` | Payment settlement (transactional) |
| `services/api-ts/src/handlers/association:member/markDuesInvoicePaid.ts` | Invoice payment (transactional) |
| `services/api-ts/src/handlers/association:member/refundDuesPayment.ts` | Live refund — incomplete |
| `services/api-ts/src/handlers/dues/refundPayment.ts` | Dead code — has better refund logic |
| `services/api-ts/src/handlers/association:member/utils/compute-membership-status.ts` | Pure status computation |
| `services/api-ts/src/handlers/association:member/repos/membership.schema.ts` | Schema |
| `services/api-ts/src/handlers/association:member/createMembership.ts` | Missing cross-org tier validation |
| `services/api-ts/src/handlers/association:member/approveMembershipApplication.ts` | Missing transaction |
| `services/api-ts/src/handlers/association:member/recordDuesPayment.ts` | Missing outer transaction |
| `services/api-ts/src/test-utils/make-ctx.ts` | Test infra |
| `apps/memberry/src/features/dues/components/dues-config-form.tsx` | Dues config UI — broken save |
