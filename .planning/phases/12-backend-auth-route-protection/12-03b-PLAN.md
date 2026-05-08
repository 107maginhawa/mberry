---
phase: 12-backend-auth-route-protection
plan: "03b"
type: execute
wave: 3
depends_on: ["12-03"]
files_modified:
  - services/api-ts/src/handlers/association:operations/createEvent.ts
  - services/api-ts/src/handlers/association:operations/updateEvent.ts
  - services/api-ts/src/handlers/association:operations/deleteEvent.ts
  - services/api-ts/src/handlers/association:operations/cancelEvent.ts
  - services/api-ts/src/handlers/association:operations/publishEvent.ts
  - services/api-ts/src/handlers/association:operations/createCheckIn.ts
  - services/api-ts/src/handlers/association:operations/createTraining.ts
  - services/api-ts/src/handlers/association:operations/updateTraining.ts
  - services/api-ts/src/handlers/association:operations/deleteTraining.ts
  - services/api-ts/src/handlers/association:operations/publishTraining.ts
  - services/api-ts/src/handlers/association:operations/createCourse.ts
  - services/api-ts/src/handlers/association:operations/updateCourse.ts
  - services/api-ts/src/handlers/association:operations/deleteCourse.ts
autonomous: true
requirements:
  - D-06
  - D-07
  - D-09
must_haves:
  truths:
    - "Member gets 403 on all association:operations mutation handlers"
    - "Officer gets 200 on all association:operations mutation handlers"
    - "GET/search/list handlers remain accessible to members"
  artifacts:
    - path: "services/api-ts/src/handlers/association:operations/createEvent.ts"
      provides: "Officer-protected event creation"
      contains: "requireOfficerTerm"
    - path: "services/api-ts/src/handlers/association:operations/createTraining.ts"
      provides: "Officer-protected training creation"
      contains: "requireOfficerTerm"
  key_links:
    - from: "handlers/association:operations/*.ts"
      to: "requireOfficerTerm"
      via: "handler-level guard call"
      pattern: "requireOfficerTerm"
---

<objective>
GREEN phase (part 2): Add requireOfficerTerm guard to all association:operations mutation handlers.

Purpose: Close the authorization gap on generated event, training, and course mutation routes. Uses the `requireOfficerTerm` utility created in Plan 03 to query `officer_term` directly (bypassing Pitfall 2 where `orgContextMiddleware` always sets `role='member'`).

Output: All association:operations mutation handlers check officer status. Members get 403 on create/update/delete operations.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/12-backend-auth-route-protection/12-RESEARCH.md
@.planning/phases/12-backend-auth-route-protection/12-03-SUMMARY.md

<interfaces>
From services/api-ts/src/utils/officer-check.ts (created in Plan 03):
```typescript
export async function requireOfficerTerm(ctx: BaseContext): Promise<Response | null>
// Returns null if allowed, Response(403) if denied
```

From services/api-ts/src/handlers/association:operations/createEvent.ts (typical handler):
```typescript
export async function createEvent(ctx: BaseContext) {
  // ... handler body (no auth check currently)
}
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add requireOfficerTerm to event and check-in handlers</name>
  <files>
    services/api-ts/src/handlers/association:operations/createEvent.ts
    services/api-ts/src/handlers/association:operations/updateEvent.ts
    services/api-ts/src/handlers/association:operations/deleteEvent.ts
    services/api-ts/src/handlers/association:operations/cancelEvent.ts
    services/api-ts/src/handlers/association:operations/publishEvent.ts
    services/api-ts/src/handlers/association:operations/createCheckIn.ts
  </files>
  <read_first>
    - services/api-ts/src/handlers/association:operations/createEvent.ts (handler signature, ctx usage)
    - services/api-ts/src/handlers/association:operations/updateEvent.ts (handler signature)
    - services/api-ts/src/utils/officer-check.ts (confirm export -- from Plan 03)
  </read_first>
  <action>
For each of the 6 handler files, add the `requireOfficerTerm` guard at the TOP of the function body (before any business logic):

```typescript
import { requireOfficerTerm } from '@/utils/officer-check';

export async function createEvent(ctx: BaseContext) {
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;
  
  // ... existing handler logic unchanged
}
```

Apply to: createEvent, updateEvent, deleteEvent, cancelEvent, publishEvent, createCheckIn.

Per D-07: do NOT add officer checks to GET/list/search handlers (searchEvents, getEvent, listCustomEventRegistrations, etc.) -- members should access these.

Per D-09: do NOT refactor any existing `requireOrgRole()` calls -- only ADD `requireOfficerTerm` where no officer check exists.
  </action>
  <verify>
    <automated>cd /Users/elad-mini/Desktop/memberry && grep -l 'requireOfficerTerm' services/api-ts/src/handlers/association:operations/createEvent.ts services/api-ts/src/handlers/association:operations/updateEvent.ts services/api-ts/src/handlers/association:operations/deleteEvent.ts services/api-ts/src/handlers/association:operations/cancelEvent.ts services/api-ts/src/handlers/association:operations/publishEvent.ts services/api-ts/src/handlers/association:operations/createCheckIn.ts | wc -l</automated>
  </verify>
  <done>All 6 event/check-in mutation handlers have requireOfficerTerm guard. Members get 403 on event mutations.</done>
</task>

<task type="auto">
  <name>Task 2: Add requireOfficerTerm to training and course handlers</name>
  <files>
    services/api-ts/src/handlers/association:operations/createTraining.ts
    services/api-ts/src/handlers/association:operations/updateTraining.ts
    services/api-ts/src/handlers/association:operations/deleteTraining.ts
    services/api-ts/src/handlers/association:operations/publishTraining.ts
    services/api-ts/src/handlers/association:operations/createCourse.ts
    services/api-ts/src/handlers/association:operations/updateCourse.ts
    services/api-ts/src/handlers/association:operations/deleteCourse.ts
  </files>
  <action>
Same pattern as Task 1. For each of the 7 handler files, add `requireOfficerTerm` guard:

```typescript
import { requireOfficerTerm } from '@/utils/officer-check';

export async function createTraining(ctx: BaseContext) {
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;
  
  // ... existing handler logic unchanged
}
```

Apply to: createTraining, updateTraining, deleteTraining, publishTraining, createCourse, updateCourse, deleteCourse.

Per D-07: do NOT add to searchTrainings, getTraining, searchCourses, getCourse, etc.
  </action>
  <verify>
    <automated>cd /Users/elad-mini/Desktop/memberry && grep -rl 'requireOfficerTerm' services/api-ts/src/handlers/association:operations/ | wc -l</automated>
  </verify>
  <done>All 13 association:operations mutation handlers have requireOfficerTerm guard. Verify count is 13 (6 from Task 1 + 7 from Task 2).</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client -> API (generated /association/events/* mutations) | Handler-level requireOfficerTerm check |
| client -> API (generated /association/training/* mutations) | Handler-level requireOfficerTerm check |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-12-08 | Elevation of Privilege | /association/events mutation handlers | mitigate | requireOfficerTerm() queries officer_term at handler level |
| T-12-09 | Elevation of Privilege | /association/training mutation handlers | mitigate | requireOfficerTerm() queries officer_term at handler level |
| T-12-10 | Denial of Service | OfficerTermRepository query on every mutation | accept | Single indexed query per request; negligible overhead |
</threat_model>

<verification>
- `grep -rl 'requireOfficerTerm' services/api-ts/src/handlers/association:operations/ | wc -l` = 13
- No GET/search/list handlers contain `requireOfficerTerm`
</verification>

<success_criteria>
- 13 association:operations mutation handlers protected by requireOfficerTerm
- GET/search/list handlers remain unprotected (member-accessible per D-07)
- No existing requireOrgRole calls modified (per D-09)
</success_criteria>

<output>
After completion, create `.planning/phases/12-backend-auth-route-protection/12-03b-SUMMARY.md`
</output>
