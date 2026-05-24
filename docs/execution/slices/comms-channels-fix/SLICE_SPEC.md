---
slice: comms-channels-fix
phase: wave4-comms-fix
module: comms
---

# Slice: Fix Channels Page — Auth + Create Channel + Onboarding

## Overview
Fix the non-functional Channels page: resolve API 403, add officer "Create Channel" flow, improve empty states with actionable CTAs, and seed default channels.

## Acceptance Criteria

- **AC-001**: listChatRooms API returns 200 (not 403) for authenticated users
- **AC-002**: Officer messages page has "Create Channel" button that opens a dialog
- **AC-003**: Create Channel dialog has name field (required) and description field (optional)
- **AC-004**: Creating a channel adds it to the channel list without page refresh
- **AC-005**: Officer empty state shows "Set up your channels" with "Create Channel" CTA
- **AC-006**: Member empty state shows "No channels yet" without create CTA
- **AC-007**: Default channels (#general, #announcements) exist in seed data

## Business Rules

- **BR-001**: IF user is officer, THEN show "Create Channel" button; IF member, THEN hide it
- **BR-002**: IF channel name is empty or invalid, THEN disable submit and show validation error
- **BR-003**: IF channel creation succeeds, THEN auto-navigate to the new channel in the list

## Files in Scope
- `specs/api/src/modules/comms.tsp` (auth role fix)
- `services/api-ts/src/generated/openapi/routes.ts` (regenerated)
- `apps/memberry/src/features/comms/components/create-channel-dialog.tsx` (new)
- `apps/memberry/src/features/comms/components/channel-list.tsx` (empty state)
- `apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/messages/index.tsx` (create button)
- Test: `apps/memberry/src/features/comms/__tests__/create-channel-dialog.test.tsx`

## Out of Scope
- Channel permissions (public/private) — future
- Auto-add all members to channel — future
- Channel description display in list — future
