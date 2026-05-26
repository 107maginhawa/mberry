# 02 — Role & Permission Map: SDK/API Layer

**Module**: SDK/API Layer (Module 12)  
**Scope**: `services/api-ts/src/middleware/auth.ts`, officer-auth, platform-admin-auth, `services/api-ts/src/utils/auth.ts`

---

## 1. Middleware Inventory

| Middleware | File | Trigger | DB Query |
|---|---|---|---|
| `authMiddleware()` | `middleware/auth.ts` | Per-route (explicit) | No |
| `officerAuthMiddleware()` | `middleware/officer-auth.ts` | Per-route (explicit) | Yes — `officer_terms` |
| `platformAdminAuthMiddleware()` | `middleware/platform-admin-auth.ts` | `app.use('/admin/*', ...)` | Yes — `platform_admin` |
| `requireOrgRole()` | `utils/org-auth.ts` | Inline in handlers | No (reads ctx) |

---

## 2. `authMiddleware` — Implementation Detail

**File**: `services/api-ts/src/middleware/auth.ts`

### Flow

```
1. Check X-Internal-Service-Token + X-Expand-Context headers
   → timing-safe compare against all stored tokens (rotation-aware)
   → if match: set ctx.isInternalExpand = true, call next(), RETURN (bypasses all user auth)
   → if mismatch: warn + fall through

2. ctx.get('auth') — throws plain Error if missing (NOT UnauthorizedError)

3. auth.api.getSession({ headers }) — Better-Auth session lookup via Bearer plugin

4. If session:
   - Reject banned users → ForbiddenError
   - Set ctx.user and ctx.session

5. If opts.required=true and no session → UnauthorizedError(401)

6. Role check (only if opts.roles.length > 0 AND session exists):
   - Separate standard roles vs :owner roles
   - Call userHasRole() — async, no DB (reads session.user.role string)
   - If hasStandardRole → next(), RETURN
   - Else if ownershipRoles exist → next(), RETURN (delegates to handler)
   - Else → ForbiddenError(403)
```

### Role Storage
Roles stored as comma-separated string in `session.user.role` (e.g. `"client,host"`).  
`userHasRole()` splits on comma, checks OR across provided roles.  
Special role `"user"` grants access to any authenticated user.

### Critical Observation — `:owner` Pattern Gap

When `roles: ['client:owner']` only and user role is `'user'`:
- `standardRoles` is empty → `hasStandardRole = true` (vacuously, per `standardRoleNames.length === 0`)
- Middleware calls `next()` unconditionally
- **Any authenticated user passes `:owner`-only routes** — ownership enforced only in handlers

This is by design (documented) but creates a systemic risk if any handler omits ownership validation.

---

## 3. `officerAuthMiddleware` — Implementation Detail

**File**: `services/api-ts/src/middleware/officer-auth.ts`

- Requires `ctx.user` already set (must follow `authMiddleware`)
- Requires `:organizationId` route param — throws `ValidationError(400)` if absent
- Queries `officer_terms` table for active terms: `findActiveByPersonAndOrg(user.id, orgId)`
- 2FA gate: `PRIVILEGED_POSITIONS = { president, treasurer, secretary }` — throws `ForbiddenError(403)` if 2FA disabled

---

## 4. `platformAdminAuthMiddleware` — Implementation Detail

**File**: `services/api-ts/src/middleware/platform-admin-auth.ts`

- Requires `ctx.user` already set
- Queries `platform_admin` table: `findByUserId(user.id)`
- Sets `ctx.platformAdmin` on success
- Applied at route-group level (`/admin/*`) in `app.ts`

---

## 5. `requireOrgRole()` — Inline Org-Role Check

**File**: `services/api-ts/src/utils/org-auth.ts`

Reads `ctx.orgMembership.role` (must be set by prior middleware) and checks against `allowedRoles` array. Returns `Response | null` pattern (not throw). Defined roles in hierarchy:

```
president > vice-president > secretary > treasurer > board-member > officer > staff > member
```

---

## 6. Role Taxonomy

| Role Class | Values | Source |
|---|---|---|
| System roles | `admin`, `support`, `user` | `session.user.role` (Better-Auth) |
| Context roles | `client`, `host` | `session.user.role` (comma-separated) |
| Org roles | `president`, `vice-president`, `secretary`, `treasurer`, `board-member`, `officer`, `staff`, `member` | `orgMembership.role` (DB via middleware) |
| Platform admin | checked via `platform_admin` table | `ctx.platformAdmin` |

---

## 7. Gaps & Risks

| ID | Severity | Finding |
|---|---|---|
| R-01 | P1 | **`:owner`-only routes admit any authenticated user** — `standardRoleNames.length === 0` → `hasStandardRole = true` vacuously. Every handler on such routes must validate ownership or the pattern is broken. |
| R-02 | P2 | `authMiddleware` with missing `auth` in context throws plain `Error`, not `UnauthorizedError`. Error handler may expose a 500 instead of 401. |
| R-03 | P2 | Role check block is skipped entirely when `required: false` and no session, even if roles are specified. An unauthenticated request to a `required: false, roles: ['admin']` route passes. |
| R-04 | P2 | `officerAuthMiddleware` must follow `authMiddleware` — no enforcement at registration. Misconfigured route ordering silently allows unauthenticated officer actions (would crash on `ctx.get('user')` being undefined). |
| R-05 | P3 | Access control statements in `utils/auth.ts` define `patient`, `provider`, `admin` permissions but these are never called from `authMiddleware` or any route — dead code. |
| R-06 | P3 | No middleware enforces `orgMembership` context; handlers calling `requireOrgRole()` must set it themselves. No shared middleware ensures it. |
