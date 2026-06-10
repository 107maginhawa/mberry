---
slice: w1-t2-ux-polish
phase: wave1-financial
priority: P1
---

# T2: Phase 1 UX Polish — Billing Clarity

## Goal
Fix ambiguous labels and missing data in officer dues config and payment views. Frontend-only changes. Zero backend changes.

## Acceptance Criteria

- **AC-T2-001**: "Default Amount" label renamed to "Annual Dues Amount" with helper text showing per-period breakdown (e.g., "PHP 1,200/year = PHP 300/quarter")
- **AC-T2-002**: Billing schedule preview card renders in dues config form, showing next 6 billing dates computed from frequency + dueDateMonth + dueDateDay
- **AC-T2-003**: Due date input is a single numeric field (1-28) with inline helper text showing computed dates
- **AC-T2-004**: Payment records table shows member first + last name in a "Member" column
- **AC-T2-005**: Stats bar labels present: "Collection Rate: X%", "Collected: PHP Y", "Outstanding: PHP Z", "Members: N"
- **AC-T2-006**: Category overrides table shows per-period breakdown column

## Business Rules

- **BR-T2-001**: IF billing frequency is "quarterly" AND annual amount is 1200 THEN per-period display shows "PHP 300/quarter"
- **BR-T2-002**: IF dueDateDay is 29-31 THEN input rejects with validation message "Day must be 1-28"
- **BR-T2-003**: IF billing schedule preview renders THEN it uses dueDateMonth as cycle start month (existing field, no schema change per D7)

## Files in Scope
- `apps/memberry/src/features/dues/components/dues-config-form.tsx` — label renames, preview wire-up
- `apps/memberry/src/features/dues/components/financial-dashboard.tsx` — stats bar labels
- `apps/memberry/src/features/dues/components/payment-history-table.tsx` — member names column
- `apps/memberry/src/features/dues/components/billing-schedule-preview.tsx` — already built (uncommitted)
- `apps/memberry/src/features/dues/lib/billing-dates.ts` — already built (uncommitted)

## Out of Scope
- Backend endpoint changes
- Schema migrations
- New routes
