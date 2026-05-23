---
slice: w1-t7-member-hub
phase: wave1-financial
priority: P2
agent_skills: [oli-execution-gate]
---

# T7: Member Financial Hub

## Goal
Enhance member dues page with unified "What do I owe?" view: status card, arrears breakdown using existing agingBuckets table, payment schedule timeline.

## Acceptance Criteria

- **AC-T7-001**: `dues.tsx` route shows DuesStatusCard at top with total outstanding, next payment date, membership valid until
- **AC-T7-002**: `arrears-breakdown.tsx` groups unpaid invoices by year, shows days overdue per invoice, shows aging bucket totals (current/30/60/90/90+)
- **AC-T7-003**: ArrearsBreakdown consumes data from existing `agingBuckets` table (not computed client-side)
- **AC-T7-004**: `payment-schedule-timeline.tsx` shows horizontal timeline with past (paid/overdue markers) and future (upcoming) periods
- **AC-T7-005**: Member with zero unpaid invoices sees "All caught up!" message, not empty table
- **AC-T7-006**: Payment history section has CSV export button

## Business Rules

- **BR-T7-001**: IF member has unpaid invoices THEN arrears breakdown shows total per aging bucket (current, 30d, 60d, 90d, 90d+)
- **BR-T7-002**: IF invoice is overdue THEN timeline marker is red; IF paid THEN green; IF upcoming THEN gray

## Files in Scope
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/dues.tsx` — ENHANCE layout
- `apps/memberry/src/features/dues/components/arrears-breakdown.tsx` — NEW
- `apps/memberry/src/features/dues/components/payment-schedule-timeline.tsx` — NEW
- Tests for each component

## Out of Scope
- Backend endpoint changes
- Special assessments (T8)
