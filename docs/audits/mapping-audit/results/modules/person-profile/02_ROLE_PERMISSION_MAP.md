# 02 — Role/Permission Map: Person/Profile Module

**Audit Date**: 2026-05-26  
**Module**: Person/Profile (Central PII Hub)  
**Handler Directory**: `services/api-ts/src/handlers/person/`

---

## Roles in System

| Role | Description |
|------|-------------|
| `user` | Authenticated end-user (member) |
| `admin` | Platform administrator |
| `support` | Support staff |
| `user:owner` | User accessing their own resource |

---

## Backend Route Permission Matrix

All routes verified against `services/api-ts/src/generated/openapi/routes.ts`.

| Route | Method | Auth Middleware Roles | Handler | Status |
|-------|--------|-----------------------|---------|--------|
| `POST /persons` | Create person | `["user"]` | `createPerson` | OK |
| `GET /persons` | List all persons | `["admin", "support"]` | `listPersons` | OK |
| `PATCH /persons/me` | Update own profile | `["user"]` | `updateMyProfile` | OK |
| `POST /persons/me/cancel-delete` | Cancel own deletion | `["user"]` | `cancelMyAccountDeletion` | OK |
| `POST /persons/me/credit-entries` | Add credit entry | `["user"]` | `createMyCreditEntry` | OK |
| `GET /persons/me/credit-entries` | List credit entries | `["user"]` | `listMyCreditEntries` | OK |
| `GET /persons/me/credit-summary` | Get credit summary | `["user"]` | `getMyCreditSummary` | OK |
| `GET /persons/me/credits` | Get credits | **NO authMiddleware** | `getMyCredits` | **P0 FINDING** |
| `POST /persons/me/delete` | Request deletion | `["user"]` | `requestMyAccountDeletion` | OK |
| `GET /persons/me/export` | Export own data | `["user"]` | `exportMyData` | OK |
| `GET /persons/me/memberships` | Get memberships | `["user"]` | `getMyMemberships` | OK |
| `GET /persons/me/notification-preferences` | Get notif prefs | `["user"]` | `getMyNotificationPreferences` | OK |
| `PATCH /persons/me/notification-preferences` | Update notif prefs | `["user"]` | `updateMyNotificationPreferences` | OK |
| `GET /persons/me/officer-role/:organizationId` | Get officer role | `["user"]` | `getMyOfficerRole` | OK |
| `GET /persons/me/privacy` | Get privacy settings | `["user"]` | `getMyPrivacySettings` | OK |
| `PATCH /persons/me/privacy` | Update privacy settings | `["user"]` | `updateMyPrivacySettings` | OK |
| `GET /persons/:person` | Get person by ID | `["admin", "support", "user:owner"]` | `getPerson` | OK |
| `PATCH /persons/:person` | Update person by ID | `["user:owner"]` | `updatePerson` | OK |

---

## Handler-Level Auth Checks

Even with route-level middleware, handlers implement secondary checks:

| Handler | Secondary Auth Check | Pattern |
|---------|---------------------|---------|
| `updateMyProfile` | `session` null check → `UnauthorizedError` | `ctx.get('session')` |
| `deleteMyAccount` | `session` null check → `UnauthorizedError` | `ctx.get('session')` |
| `cancelMyAccountDeletion` | `session` null check → `UnauthorizedError` | `ctx.get('session')` |
| `exportMyData` | `session` null check → `UnauthorizedError` | `ctx.get('session')` |
| `requestAccountDeletion` | `user` null check → 401 raw JSON | `ctx.get('user')` |
| `cancelAccountDeletion` | `user` null check → 401 raw JSON | `ctx.get('user')` |
| `getPrivacySettings` | `user` null check → 401 raw JSON | `ctx.get('user')` |
| `updatePrivacySettings` | `user` null check → 401 raw JSON | `ctx.get('user')` |
| `getNotificationPreferences` | `user` null check → 401 raw JSON | `ctx.get('user')` |
| `updateNotificationPreferences` | `user` null check → 401 raw JSON | `ctx.get('user')` |
| `getPerson` | Owner check: `user.id === personId` → `ForbiddenError` | Logic gate |
| `updatePerson` | Owner check: `user.id !== personId` → `ForbiddenError` | Logic gate |
| `executeAccountDeletion` | **NO auth check at all** | **P0 FINDING** |

---

## P0 FINDINGS — PII Exposure Risks

### FINDING-PP-P0-001: `GET /persons/me/credits` — Missing authMiddleware

**File**: `services/api-ts/src/generated/openapi/routes.ts` line 2679  
**Evidence**:
```typescript
app.get('/persons/me/credits',
  zValidator('query', validators.GetMyCreditsQuery, validationErrorHandler),
  registry.getMyCredits as unknown as Handler
);
```
No `authMiddleware(...)` call. Handler has `if (!session) throw new UnauthorizedError()` as secondary check only. The route middleware is missing — the request hits the handler without role enforcement at the gateway layer. Secondary check relies on `session` context being set by upstream middleware (Better-Auth session middleware must run globally). This is a defense-in-depth gap, not necessarily a full bypass, but it is inconsistent and **should be treated as P0** given this is a PII endpoint.

### FINDING-PP-P0-002: `executeAccountDeletion` — No auth check in handler

**File**: `services/api-ts/src/handlers/person/executeAccountDeletion.ts`  
**Evidence**: Handler reads `ctx.req.param('personId')` directly with no `user`/`session` check. No auth check at handler level.  
**Compounding factor**: `executeAccountDeletion` does **NOT appear in `routes.ts`** — it is not registered as a route. The handler exists but is unreachable via HTTP. It may be called only from scheduled jobs or internal code. This needs manual confirmation: is there a job runner calling it? Is there an admin route elsewhere?  
**Status**: [NEEDS MANUAL CONFIRMATION] — handler exists, no HTTP registration found. If called from job context without auth, acceptable. If exposed via admin route outside the generated routes, P0.

---

## Duplicate Handler Pairs

Two pairs of handlers serve the same logical purpose — old vs. new generation:

| Old Handler | New Handler | Registered Route |
|-------------|-------------|-----------------|
| `getNotificationPreferences` | `getMyNotificationPreferences` | `getMyNotificationPreferences` is wired |
| `updateNotificationPreferences` | `updateMyNotificationPreferences` | `updateMyNotificationPreferences` is wired |
| `getPrivacySettings` | `getMyPrivacySettings` | `getMyPrivacySettings` is wired |
| `updatePrivacySettings` | `updateMyPrivacySettings` | `updateMyPrivacySettings` is wired |
| `cancelAccountDeletion` | `cancelMyAccountDeletion` | `cancelMyAccountDeletion` is wired |
| `requestAccountDeletion` | N/A | `requestMyAccountDeletion` is wired (file not found — check registry) |

Old handlers use `ctx.get('user')` + raw JSON 401. New handlers use `ctx.get('session')` + `UnauthorizedError`. Old handlers are dead code but present a maintenance hazard if accidentally wired.

---

## Frontend Role Restrictions

Frontend restricts all person/profile pages to `_authenticated` layout:

- `apps/memberry/src/routes/_authenticated.tsx` — guards the entire `/my/*` tree
- No additional role checks in frontend beyond authentication gate
- No frontend-only admin restriction that bypasses backend

**Assessment**: Frontend-backend auth alignment is acceptable for self-service routes. No case where frontend restricts more than backend (which would mask backend gaps).
