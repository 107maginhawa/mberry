# Phase 13: Position-Based RBAC - Pattern Map

**Mapped:** 2026-05-08
**Files analyzed:** 34 (1 new utility, 1 new constants, 1 new test, 1 new config, 29 handler modifications, 1 app.ts modification, 1 sidebar modification)
**Analogs found:** 34 / 34

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `services/api-ts/src/utils/officer-check.ts` (ADD requirePosition) | utility | request-response | `services/api-ts/src/utils/officer-check.ts` (self — extend) | exact |
| `services/api-ts/src/utils/position-titles.ts` (NEW) | config | static | `services/api-ts/src/utils/officer-check.ts` | role-match |
| `services/api-ts/src/tests/position-rbac.test.ts` (NEW) | test | request-response | `services/api-ts/src/tests/route-protection-association.test.ts` | exact |
| `apps/memberry/src/config/position-nav.ts` (NEW) | config | static | `apps/memberry/src/components/layout/officer-sidebar.tsx` (sections array) | role-match |
| `services/api-ts/src/handlers/association:member/recordDuesPayment.ts` | handler | CRUD | self (upgrade requireOfficerTerm -> requirePosition) | exact |
| `services/api-ts/src/handlers/association:member/refundDuesPayment.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/association:member/createDuesConfig.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/association:member/generateDuesInvoicesForOrg.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/association:member/addRosterMember.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/association:member/importRosterMembers.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/association:member/approveMembershipApplication.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/association:member/denyMembershipApplication.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/association:member/createMembership.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/association:member/updateMembership.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/association:member/createElection.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/association:member/createOfficerTerm.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/association:member/createPosition.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/association:member/updateOrganizationProfile.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/communications/createAnnouncement.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/communications/publishAnnouncement.ts` | handler | CRUD | `recordDuesPayment.ts` | exact |
| `services/api-ts/src/handlers/association:operations/createEvent.ts` | handler | CRUD | self | exact |
| `services/api-ts/src/handlers/association:operations/updateEvent.ts` | handler | CRUD | `createEvent.ts` | exact |
| `services/api-ts/src/handlers/association:operations/deleteEvent.ts` | handler | CRUD | `createEvent.ts` | exact |
| `services/api-ts/src/handlers/association:operations/publishEvent.ts` | handler | CRUD | `createEvent.ts` | exact |
| `services/api-ts/src/handlers/association:operations/cancelEvent.ts` | handler | CRUD | `createEvent.ts` | exact |
| `services/api-ts/src/handlers/association:operations/createCheckIn.ts` | handler | CRUD | `createEvent.ts` | exact |
| `services/api-ts/src/handlers/association:operations/createTraining.ts` | handler | CRUD | `createEvent.ts` | exact |
| `services/api-ts/src/handlers/association:operations/updateTraining.ts` | handler | CRUD | `createEvent.ts` | exact |
| `services/api-ts/src/handlers/association:operations/deleteTraining.ts` | handler | CRUD | `createEvent.ts` | exact |
| `services/api-ts/src/handlers/association:operations/publishTraining.ts` | handler | CRUD | `createEvent.ts` | exact |
| `services/api-ts/src/handlers/association:operations/createCourse.ts` | handler | CRUD | `createEvent.ts` | exact |
| `services/api-ts/src/handlers/association:operations/updateCourse.ts` | handler | CRUD | `createEvent.ts` | exact |
| `services/api-ts/src/handlers/association:operations/deleteCourse.ts` | handler | CRUD | `createEvent.ts` | exact |
| `services/api-ts/src/app.ts` | route-config | request-response | self (add inline requirePosition calls) | exact |
| `apps/memberry/src/components/layout/officer-sidebar.tsx` | component | static | self (add positions prop + filtering) | exact |
| `apps/memberry/src/routes/_authenticated/org/$orgId/officer.tsx` | component | request-response | self (pass positions to sidebar) | exact |

## Pattern Assignments

### `services/api-ts/src/utils/officer-check.ts` — ADD requirePosition() (utility, request-response)

**Analog:** Self — extend existing file with new function alongside `requireOfficerTerm`.

**Imports pattern** (lines 1-2):
```typescript
import type { BaseContext } from '@/types/app';
import { OfficerTermRepository } from '@/handlers/association:member/repos/governance.repo';
```

**Core pattern — requireOfficerTerm** (lines 13-33, clone and extend):
```typescript
export async function requireOfficerTerm(ctx: BaseContext): Promise<Response | null> {
  const user = ctx.get('user');
  if (!user) {
    return ctx.json({ error: 'Authentication required' }, 401);
  }

  const orgId = ctx.get('orgId');
  if (!orgId) {
    return ctx.json({ error: 'Organization context required' }, 403);
  }

  const db = ctx.get('database');
  const repo = new OfficerTermRepository(db);
  const terms = await repo.findActiveByPersonAndOrg(user.id, orgId);

  if (terms.length === 0) {
    return ctx.json({ error: 'Officer access required for this organization' }, 403);
  }

  return null; // allowed
}
```

**Key extension point:** After `terms.length === 0` check, add position title matching. The `terms` array items already have `positionTitle` from the JOIN in `findActiveByPersonAndOrg()`. Add case-insensitive comparison per D-08.

---

### `services/api-ts/src/utils/position-titles.ts` — NEW (config, static)

**Analog:** No direct analog. Simple constants file.

**Pattern:** Follow project convention of co-locating utils. Export constants used by both `requirePosition()` and handler files.

```typescript
// Derived pattern — simple string constants
export const POSITION_TITLES = {
  PRESIDENT: 'President',
  TREASURER: 'Treasurer',
  SECRETARY: 'Secretary',
  SOCIETY_OFFICER: 'Society Officer',
} as const;
```

---

### `services/api-ts/src/tests/position-rbac.test.ts` — NEW (test, request-response)

**Analog:** `services/api-ts/src/tests/route-protection-association.test.ts`

**Imports pattern** (lines 25-26):
```typescript
import { describe, test, expect, beforeAll } from 'bun:test';
import { apiAs, type ApiClient } from '@/tests/helpers/api-as';
```

**Test setup pattern** (lines 28, 53-58):
```typescript
const ORG_ID = 'ed8e3a96-8126-4341-be42-e6eb7940c562'; // pda-metro-manila from seed

describe('Association mutation routes - officer protection (RED phase)', () => {
  let memberClient: ApiClient;

  beforeAll(async () => {
    memberClient = await apiAs('member@memberry.ph');
  });
```

**Test assertion pattern** (lines 62-70):
```typescript
  test('member blocked: create event (POST /association/events) returns 403', async () => {
    const res = await memberClient.post('/association/events', {
      title: 'Test Event',
      organizationId: ORG_ID,
      startDate: '2026-06-01T09:00:00Z',
      endDate: '2026-06-01T17:00:00Z',
    });
    expect(res.status).toBe(403);
  });
```

**Extension for Phase 13:** Create multiple `beforeAll` clients (`treasurerClient`, `secretaryClient`, `societyClient`, `presidentClient`) using seeded emails. Test cross-position denials (e.g., treasurer blocked from events) and same-position access (e.g., treasurer allowed on dues).

**Seeded test users** (from seed.ts):
| Email | Position |
|-------|----------|
| `test@memberry.ph` | President |
| `treasurer@memberry.ph` | Treasurer |
| `secretary@memberry.ph` | Secretary |
| `society@memberry.ph` | Society Officer |
| `member@memberry.ph` | (none) |

**Test helper** (`services/api-ts/src/tests/helpers/api-as.ts`):
```typescript
export async function apiAs(email: string, password = DEFAULT_PASSWORD): Promise<ApiClient>
// Returns { get, post, put, patch, delete, cookie } with session auto-attached
```

---

### Handler files — 29 files (handler, CRUD)

**Analog:** `services/api-ts/src/handlers/association:member/recordDuesPayment.ts` (representative)

**Current import** (line 7):
```typescript
import { requireOfficerTerm } from '@/utils/officer-check';
```

**Current guard call** (lines 18-19):
```typescript
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;
```

**Upgrade pattern — change import and call:**
```typescript
// BEFORE:
import { requireOfficerTerm } from '@/utils/officer-check';
// ...
const denied = await requireOfficerTerm(ctx);

// AFTER:
import { requirePosition } from '@/utils/officer-check';
// ...
const denied = await requirePosition(ctx, ['Treasurer', 'President']);
```

**Second handler variant** (`createEvent.ts`, lines 6, 23-24):
```typescript
import { requireOfficerTerm } from '@/utils/officer-check';
// ...
  const denied = await requireOfficerTerm(ctx);
  if (denied) return denied;
```
Same upgrade pattern applies. Change to `requirePosition(ctx, ['Society Officer', 'President'])`.

**Handler-to-position mapping (complete):**

| Position(s) | Handler Files |
|-------------|--------------|
| Treasurer, President | `recordDuesPayment`, `refundDuesPayment`, `createDuesConfig`, `generateDuesInvoicesForOrg` |
| Secretary, President | `addRosterMember`, `importRosterMembers`, `approveMembershipApplication`, `denyMembershipApplication`, `createMembership`, `updateMembership`, `createAnnouncement`, `publishAnnouncement` |
| Society Officer, President | `createEvent`, `updateEvent`, `deleteEvent`, `publishEvent`, `cancelEvent`, `createCheckIn`, `createTraining`, `updateTraining`, `deleteTraining`, `publishTraining`, `createCourse`, `updateCourse`, `deleteCourse` |
| President only | `createElection`, `createOfficerTerm`, `createPosition`, `updateOrganizationProfile` |

---

### `services/api-ts/src/app.ts` — MODIFY inline officer routes (route-config, request-response)

**Analog:** Self — existing hand-wired routes with `officerAuthMiddleware()`.

**Current pattern** (line 134):
```typescript
app.get('/officer-terms/:orgId', authMiddleware(), officerAuthMiddleware(), async (ctx) => {
```

**Routes needing inline `requirePosition()` calls:**

| Route | Current (line) | Position Restriction |
|-------|----------------|---------------------|
| `GET /officer-terms/:orgId` (line 134) | `officerAuthMiddleware()` | Any officer (KEEP as-is) |
| `GET /credit-compliance/:orgId` (line 272) | `officerAuthMiddleware()` | Society Officer, President |
| `GET /membership/org-profile/:orgId` (line ~318) | `officerAuthMiddleware()` | Any officer read (KEEP as-is) |
| `PUT /membership/org-profile/:orgId` (line 322) | `officerAuthMiddleware()` | President only |
| `GET /membership/members/:orgId` (line 334) | `officerAuthMiddleware()` | Any officer read (KEEP as-is) |
| `GET /membership/applications/:orgId` (line 360) | `officerAuthMiddleware()` | Any officer read (KEEP as-is) |
| `GET /dues/dashboard/:orgId` (line 381) | `officerAuthMiddleware()` | Treasurer, President |

**Upgrade pattern for position-restricted inline handlers:**
```typescript
// BEFORE:
app.get('/dues/dashboard/:orgId', authMiddleware(), officerAuthMiddleware(), async (ctx) => {
  // ... handler body
});

// AFTER:
app.get('/dues/dashboard/:orgId', authMiddleware(), officerAuthMiddleware(), async (ctx) => {
  const denied = await requirePosition(ctx, ['Treasurer', 'President']);
  if (denied) return denied;
  // ... handler body
});
```

**Shared read routes** (`/officer-terms/:orgId`, `/membership/org-profile/:orgId` GET, `/membership/members/:orgId`, `/membership/applications/:orgId`): Keep `officerAuthMiddleware()` only, no `requirePosition`. Per D-01, any officer has shared read access.

---

### `apps/memberry/src/config/position-nav.ts` — NEW (config, static)

**Analog:** `apps/memberry/src/components/layout/officer-sidebar.tsx` sections array (lines 42-99).

**Current nav sections defined in sidebar** (labels):
```typescript
// Unlabeled (Dashboard)
// "MEMBERS"
// "FINANCES"
// "ACTIVITIES"
// "COMMUNICATIONS"
// "GOVERNANCE"
// "DOCUMENTS"
// "SETTINGS"
```

**Config pattern:** Map position titles (lowercase) to allowed section labels.

---

### `apps/memberry/src/components/layout/officer-sidebar.tsx` — MODIFY (component, static)

**Analog:** Self.

**Current interface** (lines 31-36):
```typescript
interface OfficerSidebarProps {
  orgName?: string
  userEmail?: string
  userName?: string
  role?: string
}
```

**Extension:** Add `positions?: Array<{ title: string }>` prop. Filter `sections` array based on allowed section labels from `POSITION_NAV_CONFIG`.

**Current sections usage** (lines 42, 120):
```typescript
const sections: NavSection[] = [...]

{sections.map((section, si) => (
```

**Upgrade:** Filter sections before rendering based on positions prop.

---

### `apps/memberry/src/routes/_authenticated/org/$orgId/officer.tsx` — MODIFY (component, request-response)

**Analog:** Self.

**Current positions usage** (lines 16-17):
```typescript
const positions = routeContext.officerPositions || []
const primaryRole = positions[0]?.title || "Officer"
```

**Current sidebar invocation** (lines 33-37):
```typescript
<OfficerSidebar
  userEmail={user?.email}
  userName={user?.name}
  role={primaryRole}
/>
```

**Extension:** Pass `positions` array to `OfficerSidebar` so it can filter nav sections.

---

### Frontend guard — `apps/memberry/src/utils/guards.ts` (NO CHANGES NEEDED)

**Verified:** `requireOrgOfficer` (lines 45-69) already returns `officerPositions` array to route context. No modifications needed.

```typescript
return { officerPositions: data.positions, orgId }
```

## Shared Patterns

### Handler-Level Guard (Response | null)
**Source:** `services/api-ts/src/utils/officer-check.ts` lines 13-33
**Apply to:** All handler files + app.ts inline handlers that need position restriction

The pattern is: call guard function, check for truthy response, return it if denied. This is the **only** guard pattern used in this project for handler-level auth.
```typescript
const denied = await requirePosition(ctx, ['Treasurer', 'President']);
if (denied) return denied;
```

### Route-Level Middleware (throws ForbiddenError)
**Source:** `services/api-ts/src/middleware/officer-auth.ts` lines 14-35
**Apply to:** app.ts hand-wired routes (KEEP existing, add handler-level position check inside)

Route middleware runs before handler. Position check runs inside handler after middleware passes.
```typescript
// Middleware layer (stays the same):
app.get('/dues/dashboard/:orgId', authMiddleware(), officerAuthMiddleware(), async (ctx) => {
  // Handler-level position check (new):
  const denied = await requirePosition(ctx, ['Treasurer', 'President']);
  if (denied) return denied;
  // ... rest of handler
});
```

### Test Pattern (apiAs + role-based assertions)
**Source:** `services/api-ts/src/tests/route-protection-association.test.ts` lines 25-70
**Apply to:** New `position-rbac.test.ts`

Create clients per position, assert 403 for wrong position, non-403 for correct position.
```typescript
import { apiAs, type ApiClient } from '@/tests/helpers/api-as';

let treasurerClient: ApiClient;
beforeAll(async () => {
  treasurerClient = await apiAs('treasurer@memberry.ph');
});

test('Treasurer blocked from events', async () => {
  const res = await treasurerClient.post('/association/events', { ... });
  expect(res.status).toBe(403);
});
```

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/memberry/src/config/position-nav.ts` | config | static | No standalone nav config files exist yet; derive from sidebar sections array in `officer-sidebar.tsx` lines 42-99 |
| `services/api-ts/src/utils/position-titles.ts` | config | static | No constants files for domain values exist yet; simple export pattern |

Both are trivial config files. No codebase analog needed — use RESEARCH.md patterns.

## Metadata

**Analog search scope:** `services/api-ts/src/`, `apps/memberry/src/`
**Files scanned:** ~40 (29 handlers + utilities + middleware + tests + frontend components)
**Pattern extraction date:** 2026-05-08
