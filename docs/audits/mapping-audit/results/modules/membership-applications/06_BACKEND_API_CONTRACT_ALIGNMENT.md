# 06 — Backend/API Contract Alignment Audit: Membership/Applications (Module 4)

**Module Scope:** Membership roster, applications, categories, org profile, invite, CSV import
**Date:** 2026-05-26
**Status:** COMPLETE

---

## API Catalogue

### Live TypeSpec Routes (association:member)

| Method | Path | Handler | Auth | Roles | Request Validation | Response | Tests |
|--------|------|---------|------|-------|--------------------|----------|-------|
| GET | `/association/member/roster` | listRosterMembers | authMiddleware | association:admin | query: zValidator | `{data: MemberSummary[], pagination}` | Backend: listOrgMembers.test.ts (dead handler test); E2E: membership-actions |
| POST | `/association/member/roster` | addRosterMember | authMiddleware | association:admin | body: zValidator | `{data: Membership}` | Backend: addMember.test.ts (dead handler test) |
| POST | `/association/member/roster/import` | importRosterMembers | authMiddleware | association:admin | body: zValidator | `{data: {matched, created, flagged, imported}}` | Backend: importMembers.test.ts, csvImport.test.ts |
| GET | `/association/member/roster/:memberId` | getRosterMember | authMiddleware | association:admin | param+query: zValidator | `{data: RosterMemberDetail}` | Backend: getMember.test.ts (dead handler test) |
| PUT | `/association/member/roster/:memberId` | updateRosterMember | authMiddleware | association:admin | param+body: zValidator | `{data: Membership}` | Backend: updateMember.test.ts (dead handler test) |
| POST | `/association/member/applications` | createMembershipApplication | authMiddleware | user | body: zValidator | `{data: MembershipApplication}` | Backend: approveMembershipApplication.test.ts |
| GET | `/association/member/applications` | listMembershipApplications | authMiddleware | association:admin | query: zValidator | `{data: MembershipApplicationSummary[]}` | Backend: listApplications.test.ts (dead handler test) |
| POST | `/association/member/applications/bulk-approve` | bulkApproveMembershipApplications | authMiddleware | association:admin | body: zValidator | `{succeeded: string[], failed: {id, reason}[]}` | Backend: bulkApproveMembershipApplications.test.ts |
| POST | `/association/member/applications/:id/approve` | approveMembershipApplication | authMiddleware | association:admin | param: zValidator | `{data: MembershipApplication}` | Backend: approveMembershipApplication.test.ts |
| POST | `/association/member/applications/:id/deny` | denyMembershipApplication | authMiddleware | association:admin | param+body: zValidator | `{data: MembershipApplication}` | Backend: denyMembershipApplication.test.ts |
| GET | `/association/member/membership-categories` | listMembershipCategories | authMiddleware | `[NEEDS MANUAL CONFIRMATION]` | query: zValidator | `{data: MembershipCategory[]}` | Backend: listCategories.test.ts (dead handler test) |
| PUT | `/association/member/membership-categories/:orgId` | upsertMembershipCategory | authMiddleware | `[NEEDS MANUAL CONFIRMATION]` | param+body: zValidator | `{data: MembershipCategory}` | Backend: upsertCategory.test.ts (dead handler test) |

### Live TypeSpec Routes (membership-custom)

| Method | Path | Handler | Auth | Roles | Request Validation | Response | Tests |
|--------|------|---------|------|-------|--------------------|----------|-------|
| GET | `/membership/org-profile/:organizationId` | getOrgProfile | authMiddleware | user | param: zValidator | `{data: OrgProfile}` | Backend: getOrgProfile.test.ts |
| PUT | `/membership/org-profile/:organizationId` | updateOrgProfile | authMiddleware | association:admin | param+body: zValidator | `{data: OrgProfile}` | Backend: updateOrgProfile.test.ts |

### Invite Routes

| Method | Path | Handler | Auth | Roles | Request Validation | Response | Tests |
|--------|------|---------|------|-------|--------------------|----------|-------|
| POST | `/invite` | createInvite | authMiddleware + orgContext | officer | Handler-level validation | `{id, token, email, type, expiresAt, status}` | Backend: createInvite.test.ts, invite.test.ts |
| GET | `/invite/validate/:token` | validateInvite | NONE (public) | — | Handler-level | `{valid, email, orgId, type, metadata, expiresAt}` | Backend: validateInvite.test.ts |
| POST | `/invite/claim/:token` | claimInvite | authMiddleware | user | — | `[NEEDS MANUAL CONFIRMATION]` | Backend: claimInvite.test.ts |

---

## Frontend API Usage Matrix

| Frontend Source | Action | API Called | Payload | Expected Response | Error Handling | Test Coverage |
|----------------|--------|-----------|---------|------------------|---------------|---------------|
| MemberTable | Load roster | `GET /association/member/roster` | query: orgId, status, categoryId, search, limit, offset, duesStatus, trainingCompliant | `{data: [...], pagination: {totalCount}}` | Error card in UI | E2E: implied |
| MemberTable | Load categories | `GET /association/member/membership-categories` | query: orgId | `{data: [...]}` | Silent fail | None |
| MemberDetail | Load member | `GET /association/member/roster/:memberId` | param: memberId; query: orgId | `{data: {id, personId, firstName, ...}}` | ProfileSkeleton then error | E2E: STRONG |
| MemberDetail | Update member | `PUT /association/member/roster/:memberId` | body: {status, note} | `{data: Membership}` | Toast error | E2E: suspend |
| ApplicationList | Load apps | `GET /association/member/applications` | query: orgId, status | `{data: [...]}` | Error card | E2E: empty state |
| ApplicationList | Approve | `POST /.../applications/:id/approve` | param: applicationId | `{data: MembershipApplication}` | Toast error | None |
| ApplicationList | Deny | `POST /.../applications/:id/deny` | param: applicationId; body: {denialReason} | `{data: MembershipApplication}` | Toast error | None |
| ApplicationList | Bulk approve | `POST /.../applications/bulk-approve` (direct fetch) | body: {applicationIds: string[]} | `{succeeded: [...], failed: [...]}` | Toast error | None |
| CategoryEditor | Load categories | `GET /association/member/membership-categories` | query: orgId | `{data: [...]}` | Error alert | None |
| CategoryEditor | Save category | `PUT /.../membership-categories/:orgId` | body: {name, description, duesAmount, billingCycle, sortOrder, active, id?} | `{data: MembershipCategory}` | Toast error | None |
| Import page | Import members | `POST /association/member/roster/import` | body: {organizationId, members: [...]} | `{imported: number}` | Toast error | E2E: render only |
| ProfessionalLicenses | Verify license | `PATCH /association/member/licenses/:licenseId` (direct api.patch) | body: {verifiedAt, verifiedBy} | `[NEEDS MANUAL CONFIRMATION]` | Toast error | None |

---

## Frontend/Backend Drift Report

| ID | Issue | Frontend File | Backend File/API | Evidence | Severity | Recommended Test |
|----|-------|-------------|-----------------|---------|----------|-----------------|
| DR-M4-01 | Category form sends `duesAmount`, `billingCycle`, `sortOrder`, `active`, `id` — none in TypeSpec `UpsertCategoryBody` | `category-editor.tsx` | TypeSpec `membership-custom.tsp` line: `UpsertCategoryRequest` only has `name`, `description`, `applicableTiers` | Double type-cast: `as UpsertCategoryBody as Parameters<...>` | P1 | Integration test: POST with extra fields → verify acceptance/rejection |
| DR-M4-02 | MemberTable sends `duesStatus` and `trainingCompliant` query params not in generated SDK types | `member-table.tsx` | `ListRosterMembersQuery` validator | Comment: "not yet reflected in generated SDK type" | P2 | API test: verify backend handles extended params |
| DR-M4-03 | Bulk approve uses raw `fetch('/api/...')` instead of SDK mutation — bypasses type safety, auth refresh, error interceptors | `application-list.tsx` | `POST /association/member/applications/bulk-approve` | `const response = await fetch(...)` with manual error handling | P2 | Integration test |
| DR-M4-04 | License verify uses raw `api.patch()` with hand-constructed payload — no TypeSpec contract | `roster/$memberId.tsx` | `PATCH /association/member/licenses/:licenseId` | `api.patch(\`/api/association/member/licenses/${licenseId}\`, {...})` | P2 | API test |
| DR-M4-05 | `getOrgProfile` response shape includes placeholder empty strings for fields not in schema (`description`, `logoUrl`, `phone`, `address`, `website`, `foundingDate`) | `membership/getOrgProfile.ts` | TypeSpec `OrgProfile` model does include some but not all | Handler hardcodes `description: ''`, `logoUrl: ''` etc. | P3 | API contract test |
| DR-M4-06 | Dead handler tests test old `membership/` handlers, not live `association:member/` handlers — test coverage may be misleading | Multiple `membership/*.test.ts` | Tests import from `./reviewApplication`, `./addMember` etc. (dead handlers) | Tests pass against dead handlers, not live ones | P1 | Verify live handler test coverage separately |

---

## API Test Gap Matrix

| API | Existing Tests | Missing Tests | Recommended Test Type | Priority |
|-----|---------------|-------------|---------------------|----------|
| `POST /association/member/applications/:id/approve` | `approveMembershipApplication.test.ts` | Role denial test (user calls approve) | API/integration | P1 |
| `POST /association/member/applications/:id/deny` | `denyMembershipApplication.test.ts` | Role denial test; missing denialReason validation | API/integration | P1 |
| `POST /association/member/applications/bulk-approve` | `bulkApproveMembershipApplications.test.ts` | Partial failure handling; empty array; duplicate IDs | API/integration | P1 |
| `PUT /association/member/roster/:memberId` | `[NEEDS MANUAL CONFIRMATION]` — dead handler test exists | Suspend→status change; reinstate flow; invalid status transition | API/integration | P1 |
| `PUT /association/member/membership-categories/:orgId` | Dead handler `upsertCategory.test.ts` | Live handler test with extra fields (duesAmount etc.) | API/integration | P1 |
| `POST /association/member/roster/import` | `importMembers.test.ts` (tests dead handler `requirePosition`) | Live handler test with CSV data; conflict handling; batch size | API/integration | P1 |
| `GET /membership/org-profile/:orgId` | `getOrgProfile.test.ts` | Cross-org access test (user from org A reads org B) | API/integration | P2 |
| `PUT /membership/org-profile/:orgId` | `updateOrgProfile.test.ts` | Non-president officer denied; input validation for fields | API/integration | P1 |
| `POST /invite` | `createInvite.test.ts` | Duplicate invite; expired invite; invalid email | API/integration | P2 |
| `GET /invite/validate/:token` | `validateInvite.test.ts` | Expired token; invalid token; used token | API/integration | P2 |

---

## Gate 6 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|------|------------|--------|----------|---------------|
| Gate 6 | Membership/Applications | **PASS** | API catalogue complete, frontend usage mapped, 6 drift items identified, test gaps documented | DR-M4-01 (category schema drift) and DR-M4-06 (dead handler test coverage) are P1 |
