# Wave 0a — API Surface Audit

**Date:** 2026-05-23
**Scope:** All API endpoints touched, consumed, or introduced by Wave 0a (T1–T9 + quality audit)
**Method:** Cross-reference implementation code against OpenAPI spec, existing API_CONTRACTS.md, TypeSpec sources, and frontend consumers

---

## 1. API Endpoints Touched by Wave 0a

| # | Method | Path | Handler | TypeSpec | OpenAPI | API_CONTRACTS | Status |
|---|--------|------|---------|----------|---------|---------------|--------|
| 1 | GET | `/persons/me/memberships` | `person/getMyMemberships.ts` | ⚠️ Partial | ✅ Yes | ❌ Undocumented | **GAP** |
| 2 | GET | `/persons/me/officer-role/:organizationId` | `person/getMyOfficerRole.ts` | ✅ Yes | ✅ Yes | ❌ Undocumented | **GAP** |
| 3 | GET | `/public/org/:slug` | `platformadmin/getOrganizationBySlug.ts` | ❌ No | ❌ No | ❌ Undocumented | **GAP** |
| 4 | POST | `/invite/claim` | `invite/claimInvite.ts` | ❌ No | ❌ No | ❌ Undocumented | **GAP** |
| 5 | POST | `/invite` | `invite/createInvite.ts` | ❌ No | ❌ No | ❌ Undocumented | **GAP** |
| 6 | GET | `/invite/validate` | `invite/validateInvite.ts` | ❌ No | ❌ No | ❌ Undocumented | **GAP** |

### 1.1 Schema Changes (Migrations)

| Migration | Description | Impact |
|-----------|-------------|--------|
| `0038_rename_terminated_to_removed.sql` | Renames membership status enum value | Breaking for any consumer using `terminated` string |
| `0040_slug_backfill.sql` | Backfills slug column on organizations table | Non-breaking (additive) |
| `0041_slug_not_null.sql` | Makes slug NOT NULL on organizations | Breaking if any INSERT path omits slug |

---

## 2. Contract-Implementation Gaps

### 2.1 `GET /persons/me/memberships` — CRITICAL GAP

**Problem:** Wave 0a added `orgSlug` to the response, but this endpoint has no API_CONTRACTS.md entry and the TypeSpec definition may not reflect the enriched response.

**Implementation returns:**
```json
{
  "data": [{
    "id": "uuid",
    "organizationId": "uuid",
    "orgId": "uuid",
    "orgName": "string",
    "orgSlug": "string",
    "personId": "uuid",
    "tierId": "uuid | null",
    "categoryId": "uuid | null",
    "memberNumber": "string | null",
    "startDate": "string | null",
    "duesExpiryDate": "string | null",
    "gracePeriodDays": "number | null",
    "status": "string",
    "joinedAt": "string | null",
    "removedAt": "string | null",
    "removalReason": "string | null",
    "note": "string | null",
    "version": "number",
    "createdAt": "string",
    "updatedAt": "string",
    "createdBy": "uuid | null",
    "updatedBy": "uuid | null"
  }],
  "total": "number"
}
```

**Frontend consumer (`useMyOrgs.ts`) only reads:**
- `id`, `organizationId`, `orgName`, `orgSlug`, `memberNumber`, `status`, `tierId`, `startDate`, `duesExpiryDate`

**Issues:**
- Response leaks `createdBy`, `updatedBy`, `note`, `removalReason` — PII-adjacent fields exposed to member-tier users
- `orgId` is a duplicate alias of `organizationId` (added via `.map()` in handler) — convention violation
- No TypeSpec-generated response type — frontend uses hand-written `MembershipApiResponse` interface
- No pagination support despite being a list endpoint

### 2.2 `GET /persons/me/officer-role/:organizationId` — MODERATE GAP

**Problem:** Endpoint exists in OpenAPI (generated routes) but has no API_CONTRACTS.md entry. Frontend OrgProvider calls it via raw `api.get()` instead of SDK hook.

**Frontend consumer (`OrgProvider.tsx:58`):**
```typescript
api.get<{ data: { isOfficer: boolean; positions: OfficerPosition[] } }>(
  `/api/persons/me/officer-role/${orgId}`
)
```

**Issues:**
- Raw API call bypasses SDK type safety
- `orgId` interpolated into URL without UUID format validation (P2 security finding from frontend audit)
- Response shape defined inline in frontend, not from generated types
- No error handling for network failures in the query

### 2.3 `GET /public/org/:slug` — CRITICAL GAP

**Problem:** Hand-wired endpoint with no TypeSpec, no OpenAPI entry, no contract.

**Implementation returns:**
```json
{
  "id": "uuid",
  "name": "string",
  "slug": "string",
  "orgType": "string",
  "region": "string | null",
  "contactEmail": "string | null",
  "status": "string",
  "associationName": "string | null",
  "memberCount": "number"
}
```

**Issues:**
- Not in OpenAPI spec — invisible to SDK generation, contract tests, and API documentation
- `memberCount` uses raw SQL (`SELECT count(*)::int`) with `try/catch` swallowing errors — silent data corruption risk
- No rate limiting on public endpoint — abuse vector
- Returns `status` field publicly (should cancelled orgs return 404? Currently yes, but `suspended` orgs are still returned)

### 2.4 Invite Module (`/invite/*`) — TOTAL GAP

**Problem:** Three handlers exist (`createInvite`, `validateInvite`, `claimInvite`) with no TypeSpec, no OpenAPI, no contracts.

**Impact:** Wave 0b depends on `claimInvite` for join flow. Without contracts, frontend will build against undocumented API.

---

## 3. Frontend-Backend Contract Mismatches

| # | Frontend | Backend | Mismatch |
|---|----------|---------|----------|
| 1 | `useMyOrgs.ts` defines `OrgMembership` interface manually | `getMyMemberships.ts` returns 20+ fields | Frontend type is subset — safe but not generated |
| 2 | `OrgProvider.tsx` expects `{ data: { isOfficer, positions[] } }` | `getMyOfficerRole.ts` — response shape unverified | No shared type — drift risk |
| 3 | Frontend routes use `$orgSlug` in URL | Backend has no slug→orgId resolution middleware | OrgProvider does slug→orgId lookup via `useMyOrgs` match — fragile |
| 4 | `useMyOrgs` query key: `['my-memberships']` | No cache invalidation on membership changes | Stale data after join/leave org |

---

## 4. TypeSpec Coverage Gaps

| Module | Handler Count | TypeSpec Coverage | Gap |
|--------|--------------|-------------------|-----|
| `person` (Wave 0a-relevant) | 2 endpoints touched | Partial — `orgSlug` field likely not in TypeSpec | Add `orgSlug` to person membership response model |
| `platformadmin` (slug) | 1 new endpoint | ❌ None | Need TypeSpec for `GET /public/org/:slug` |
| `invite` | 3 handlers | ❌ None | Entire module needs TypeSpec before Wave 0b |

---

## 5. Security Surface

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | P2 | OrgId interpolated into URL path without UUID validation | `OrgProvider.tsx:58` |
| 2 | P2 | `/persons/me/memberships` leaks `note`, `removalReason`, `createdBy`, `updatedBy` to member-tier users | `getMyMemberships.ts` |
| 3 | P3 | `/public/org/:slug` has no rate limiting | `app.ts` hand-wired route |
| 4 | P3 | `memberCount` raw SQL with swallowed error | `getOrganizationBySlug.ts:38-45` |

---

## 6. Recommendations

### Pre-Wave 0b Blockers (must fix)

1. **Write TypeSpec for invite module** — Wave 0b join flow depends on `claimInvite`. Without TypeSpec → no OpenAPI → no SDK hooks → frontend builds against undocumented API.

2. **Write TypeSpec for `GET /public/org/:slug`** — Public discovery page needs this. Currently hand-wired and invisible to contract tests.

3. **Add `orgSlug` to person membership TypeSpec response** — Frontend already consumes it. TypeSpec must match reality.

4. **Trim `getMyMemberships` response** — Remove `createdBy`, `updatedBy`, `note`, `removalReason` from member-facing response. Or create separate admin vs. member response shapes.

### Should Fix (current wave)

5. **Replace raw `api.get()` in OrgProvider** with SDK-generated hook for officer-role endpoint.

6. **Add UUID validation** before interpolating `orgId` into API paths.

7. **Remove `orgId` alias** from `getMyMemberships` response — use only `organizationId` per existing conventions.

8. **Add `staleTime`** to `useMyOrgs` query (5min recommended for membership data).

### Track for Later

9. **Add API_CONTRACTS.md entries** for all 6 endpoints in this audit.

10. **Add pagination** to `getMyMemberships` (unlikely to hit limits now, but contract should define it).

---

## 7. Verdict

| Metric | Score |
|--------|-------|
| Endpoints with full contract coverage | 0 / 6 (0%) |
| Endpoints with TypeSpec | 1 / 6 (17%) |
| Endpoints in OpenAPI | 2 / 6 (33%) |
| Frontend consumers using SDK types | 0 / 2 (0%) |
| Security findings | 2 P2, 2 P3 |

**Wave 0a delivered working infrastructure** (slug migration, org switcher, account merge) but **skipped the spec-first workflow** for all new/modified endpoints. This creates contract debt that compounds in Wave 0b.

**Recommended action:** Run `/typespec` for invite + public-org modules, then `/oli-api-contracts --modules m04-org-admin,m05-membership` to update contracts before starting Wave 0b features.
