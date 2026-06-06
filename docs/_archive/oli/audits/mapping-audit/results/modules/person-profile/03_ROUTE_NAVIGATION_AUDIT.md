# 03 — Route/Navigation Audit: Person/Profile Module

**Audit Date**: 2026-05-26  
**Module**: Person/Profile

---

## Frontend Routes (apps/memberry)

All routes live under `_authenticated` layout (auth-gated).

| Frontend Route | File | Description |
|---------------|------|-------------|
| `/my/profile` | `src/routes/_authenticated/my/profile.tsx` | View/edit personal profile |
| `/my/settings` | `src/routes/_authenticated/my/settings.tsx` | Account settings (security, privacy, notifications) |
| `/my/data-export` | `src/routes/_authenticated/my/data-export.tsx` | GDPR data export |
| `/my/credits` | `src/routes/_authenticated/my/credits/index.tsx` | CPD credits overview |
| `/my/credits/log` | `src/routes/_authenticated/my/credits/log.tsx` | Credits activity log |
| `/my/notifications` | `src/routes/_authenticated/my/notifications.tsx` | In-app notifications |
| `/my/organizations` | `src/routes/_authenticated/my/organizations.tsx` | Org memberships list |
| `/my/id-card` | `src/routes/_authenticated/my/id-card.tsx` | Digital membership ID |
| `/org/$orgSlug/directory` | `src/routes/_authenticated/org/$orgSlug/directory.tsx` | Member directory |
| `/org/$orgSlug/directory/$personId` | `src/routes/_authenticated/org/$orgSlug/directory/$personId.tsx` | View another member's profile |

---

## Backend API Routes

| Backend Route | Method | Handler | Auth |
|--------------|--------|---------|------|
| `PATCH /persons/me` | PATCH | `updateMyProfile` | user |
| `GET /persons/me/credits` | GET | `getMyCredits` | MISSING (P0) |
| `GET /persons/me/credit-entries` | GET | `listMyCreditEntries` | user |
| `GET /persons/me/credit-summary` | GET | `getMyCreditSummary` | user |
| `POST /persons/me/credit-entries` | POST | `createMyCreditEntry` | user |
| `POST /persons/me/delete` | POST | `requestMyAccountDeletion` | user |
| `POST /persons/me/cancel-delete` | POST | `cancelMyAccountDeletion` | user |
| `GET /persons/me/export` | GET | `exportMyData` | user |
| `GET /persons/me/memberships` | GET | `getMyMemberships` | user |
| `GET /persons/me/notification-preferences` | GET | `getMyNotificationPreferences` | user |
| `PATCH /persons/me/notification-preferences` | PATCH | `updateMyNotificationPreferences` | user |
| `GET /persons/me/officer-role/:organizationId` | GET | `getMyOfficerRole` | user |
| `GET /persons/me/privacy` | GET | `getMyPrivacySettings` | user |
| `PATCH /persons/me/privacy` | PATCH | `updateMyPrivacySettings` | user |
| `POST /persons` | POST | `createPerson` | user |
| `GET /persons` | GET | `listPersons` | admin, support |
| `GET /persons/:person` | GET | `getPerson` | admin, support, user:owner |
| `PATCH /persons/:person` | PATCH | `updatePerson` | user:owner |

---

## Frontend → Backend Route Alignment

| Frontend Route | API Call(s) Made | Backend Route | Aligned? |
|---------------|-----------------|---------------|----------|
| `/my/profile` (view) | `GET /api/persons/:person` via SDK `getPersonOptions` | `GET /persons/:person` | YES |
| `/my/profile` (edit save) | `PATCH /api/persons/:person` via SDK `updatePersonMutation` | `PATCH /persons/:person` | YES — uses `:person` not `/me` |
| `/my/profile` (memberships) | `GET /api/persons/me/memberships` | `GET /persons/me/memberships` | YES |
| `/my/profile` (directory pub) | `PATCH /api/association/member/directory/profiles/:id` | directory module | Out of scope |
| `/my/settings` (general) | `GET /api/persons/me` | NOT a registered route | **P1 FINDING** |
| `/my/settings` (delete acct) | `POST /api/persons/me/delete` | `POST /persons/me/delete` | YES |
| `/my/settings` (cancel delete) | `POST /api/persons/me/cancel-delete` | `POST /persons/me/cancel-delete` | YES |
| `/my/settings` (notif prefs) | `GET/PATCH /api/persons/me/notification-preferences` | matching routes | YES |
| `/my/settings` (privacy) | `GET/PATCH /api/persons/me/privacy` | `GET/PATCH /persons/me/privacy` | YES |
| `/my/data-export` | Delegated to `DataExport` component | `GET /persons/me/export` | [NEEDS MANUAL CONFIRMATION] |
| `/my/credits` | `GET /api/persons/me/credits` | `GET /persons/me/credits` | YES (but missing auth) |

---

## P1 FINDING: Settings page calls `GET /persons/me` — unregistered route

**File**: `apps/memberry/src/routes/_authenticated/my/settings.tsx` line 73  
**Evidence**:
```typescript
const data = await api.get<any>('/api/persons/me')
```
**Backend**: There is no `GET /persons/me` registered in `routes.ts`. The `GET /persons/:person` route exists, and `me` is handled as a special case in the `getPerson` handler — but the route regex for `/persons/:person` would capture `me` as the param only if registered before `/persons/me/...` sub-routes. Because sub-routes (`/persons/me/credits`, etc.) are registered, the Hono router likely does NOT fall through `/persons/:person` for `me`. This call likely returns 404 in production.

**Impact**: Settings general tab cannot load profile data → broken UX.

---

## Navigation Links

| Link | Location | Target Route | Works? |
|------|----------|-------------|--------|
| Profile nav item | Sidebar | `/my/profile` | YES |
| Settings nav item | Sidebar | `/my/settings` | YES |
| Data Export link | Settings page | `/my/data-export` | YES (link in profile page) |
| Organizations | Sidebar | `/my/organizations` | YES |
| Credits | Sidebar | `/my/credits` | YES |

---

## Orphan Pages / Dead Routes

No completely dead frontend routes detected. All route files have components rendering content.

## Missing Frontend Routes for Backend Endpoints

- `GET /persons/me/credit-entries` — no dedicated frontend route. Covered indirectly in credits log page.
- `GET /persons/me/officer-role/:organizationId` — no dedicated frontend route (used internally by other features).
- `POST /persons` (createPerson) — used during onboarding flow, no dedicated route page.
