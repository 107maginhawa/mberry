# Loading-State Hygiene Audit (Wave G5 W6.2)

Brownfield audit produced by `scripts/gates/loading-state-hygiene.ts` on top of `CODE_COMPONENT_REGISTRY.json` after Wave G5 W2 component-flow backfill.

## Headline

- **54 components** render a skeleton/spinner under `isPending` / `isLoading` but have **no `isError` branch** and no exemption marker.
- 0 of these are introduced by Wave G5 changes — all are pre-existing brownfield surface area.
- The `pre-commit` gate runs `--changed-only` so the backlog stays informational; new PRs cannot add to it.
- Original `apps/memberry/src/routes/_authenticated/my/billing.tsx` was on this list before Wave G5 W1; it is now exempt via the `// oli-execute: error-handled-inline` marker.

## Severity Cohort

| Surface | Count | Notes |
|---|---|---|
| `apps/admin/src/routes/**` pages | 7 | Admin app — internal users, lower exposure. |
| `apps/memberry/src/routes/**` pages | 19 | Member/officer pages. Highest priority. |
| `apps/memberry/src/features/*/components/**` | 27 | Feature components consumed by pages; many delegate `isLoading` via props. Some may be false positives — the parent page owns `isError`. |
| `apps/memberry/src/{main,providers,components}.tsx` | 3 | Shells & providers. |

## Heuristic Caveat

The detector fires when a file contains BOTH `(Loader2|Skeleton|animate-spin|animate-pulse)` AND `(isPending|isLoading)` but no `(isError|onError|catch)`. Feature components that receive `isLoading` as a prop AND render a skeleton internally show as violations even when the parent page already owns the `isError` branch.

To clear those, add `// oli-execute: error-handled-inline` to the feature component when the parent guarantees error handling, or add the error branch to the feature itself.

## Full List (53 — billing.tsx fixed in this wave)

```
apps/admin/src/routes/committees/index.tsx
apps/admin/src/routes/events/index.tsx
apps/admin/src/routes/national-dashboard/index.tsx
apps/admin/src/routes/organizations/$organizationId.tsx
apps/admin/src/routes/organizations/index.tsx
apps/admin/src/routes/surveys/index.tsx
apps/admin/src/routes/training/index.tsx
apps/memberry/src/components/notification-drawer.tsx
apps/memberry/src/features/admin/components/org-settings-form.tsx
apps/memberry/src/features/billing/components/merchant-account-setup.tsx
apps/memberry/src/features/booking/components/booking-list.tsx
apps/memberry/src/features/booking/components/host-directory.tsx
apps/memberry/src/features/comms/components/channel-list.tsx
apps/memberry/src/features/comms/components/chat-thread.tsx
apps/memberry/src/features/comms/components/chat-view.tsx
apps/memberry/src/features/comms/components/dm-list.tsx
apps/memberry/src/features/comms/components/message-search.tsx
apps/memberry/src/features/comms/components/thread-panel.tsx
apps/memberry/src/features/communications/components/announcement-list.tsx
apps/memberry/src/features/documents/components/document-browser.tsx
apps/memberry/src/features/dues/components/collections-area-chart.tsx
apps/memberry/src/features/dues/components/financial-dashboard.tsx
apps/memberry/src/features/dues/components/payment-history-table.tsx
apps/memberry/src/features/dues/components/recent-activity-feed.tsx
apps/memberry/src/features/dues/components/report-results.tsx
apps/memberry/src/features/elections/components/election-list.tsx
apps/memberry/src/features/elections/components/member-election-detail.tsx
apps/memberry/src/features/elections/components/member-election-list.tsx
apps/memberry/src/features/membership/components/credential-list.tsx
apps/memberry/src/features/membership/components/institutional-membership-table.tsx
apps/memberry/src/features/membership/components/member-table.tsx
apps/memberry/src/features/surveys/components/nps-trend-chart.tsx
apps/memberry/src/features/surveys/components/survey-results.tsx
apps/memberry/src/main.tsx
apps/memberry/src/providers/OrgProvider.tsx
apps/memberry/src/routes/_authenticated/my/bookings/$bookingId.tsx
apps/memberry/src/routes/_authenticated/my/bookings/host.$personId.$slotId.tsx
apps/memberry/src/routes/_authenticated/my/bookings/host.$personId.tsx
apps/memberry/src/routes/_authenticated/my/schedule.tsx
apps/memberry/src/routes/_authenticated/my/surveys/$surveyId.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/announcements/index.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/documents/$documentId.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/dues.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/compliance.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/elections/$electionId/edit.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/members/$memberId.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/finances/members.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/reviews/index.tsx
apps/memberry/src/routes/_authenticated/org/$orgSlug/officer/training/$trainingId.tsx
apps/memberry/src/routes/invite/$token.tsx
apps/memberry/src/routes/join.tsx
apps/memberry/src/routes/pay/$token.tsx
apps/memberry/src/routes/verify/$certificateNumber.tsx
apps/memberry/src/routes/verify/$credentialNumber.tsx
```

## Suggested Roadmap

1. **Wave G6 (suggested)**: clean the route-level surface (19 memberry pages + 7 admin pages = 26 items). Highest user-visible value.
2. **Wave G7 (suggested)**: feature components (27 items). Many should resolve via exemption markers once the parent route is hardened.
3. **Long term**: ratchet the gate from `--changed-only` to fail-closed on full tree, then enforce a hard cap of 0.

Tracked in `BROWNFIELD_STATUS.md` as carry-over from Wave G5.
