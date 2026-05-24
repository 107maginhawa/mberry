---
slice: comms-analytics-dashboard
phase: wave4-comms-phase3
module: communications
---

# Slice: Enhanced Analytics Dashboard with Delivery Funnel

## Overview
Upgrade the officer communications analytics page with a delivery funnel visualization (sent → delivered → opened → clicked) and stat cards.

## Acceptance Criteria

- **AC-001**: Analytics page at `/officer/communications/analytics` renders delivery funnel with 4 stages (sent, delivered, opened, clicked)
- **AC-002**: Stat cards show total sent, open rate percentage, click rate percentage
- **AC-003**: Funnel bars are visually proportional to their values (percentage width)
- **AC-004**: Page uses GlassCard container and follows existing design system tokens
- **AC-005**: Loading skeleton shown while data fetches

## Business Rules

- **BR-001**: IF no analytics data exists, THEN show empty state with "No data yet" message
- **BR-002**: IF open rate > 50%, THEN display as success color; IF < 20%, display as warning color

## Files in Scope
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/communications/analytics.tsx`
- Test file: `apps/memberry/src/features/communications/__tests__/analytics-dashboard.test.tsx`

## Out of Scope
- Backend API changes (uses existing announcement stats endpoint)
- Timeline chart (deferred to future)
