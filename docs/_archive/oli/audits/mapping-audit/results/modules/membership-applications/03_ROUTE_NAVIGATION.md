# 03 — Route & Navigation Audit: Membership/Applications (Module 4)

**Module Scope:** Membership roster, applications, categories, org profile, invite, CSV import
**Date:** 2026-05-26
**Status:** COMPLETE

---

## Route Registry

### Frontend Routes (TanStack Router)

| Route | Type | Component/Page | Auth Required | Roles | Params | Source File | Test Coverage |
|-------|------|---------------|--------------|-------|--------|------------|---------------|
| `/org/$orgSlug/officer/roster` | Layout | `<Outlet />` | Yes | officer | `orgSlug` | `routes/.../officer/roster.tsx` | E2E: membership-actions |
| `/org/$orgSlug/officer/roster/` | Static | `RosterPage` → `MemberTable` | Yes | officer | `orgSlug` | `routes/.../officer/roster/index.tsx` | E2E: STRONG |
| `/org/$orgSlug/officer/roster/$memberId` | Dynamic | `MemberDetailPage` → `MemberDetail` | Yes | officer | `orgSlug`, `memberId` | `routes/.../officer/roster/$memberId.tsx` | E2E: STRONG |
| `/org/$orgSlug/officer/roster/import` | Static | CSV Import page | Yes | officer | `orgSlug` | `routes/.../officer/roster/import.tsx` | E2E: WEAK (render only) |
| `/org/$orgSlug/officer/applications` | Static | `ApplicationList` | Yes | officer | `orgSlug` | `routes/.../officer/applications.tsx` | E2E: WEAK (empty state only) |
| `/org/$orgSlug/officer/settings/membership-categories` | Static | `CategoryEditor` | Yes | officer | `orgSlug` | `routes/.../officer/settings/membership-categories.tsx` | E2E: WEAK (render check) |
| `/org/$orgSlug/members` | Static | Org member directory | Yes | member | `orgSlug` | `routes/.../org/$orgSlug/members.tsx` | None found |
| `/org/$orgSlug/directory` | Static | Directory page | Yes | member | `orgSlug` | `routes/.../org/$orgSlug/directory.tsx` | E2E: directory-onboarding |
| `/org/$orgSlug/directory/$personId` | Dynamic | Person detail | Yes | member | `orgSlug`, `personId` | `routes/.../org/$orgSlug/directory/$personId.tsx` | None found |

### Backend API Routes (Live)

| Route | Method | Handler Source | Auth | Params Validated |
|-------|--------|--------------|------|-----------------|
| `/association/member/roster` | GET | `association:member/listRosterMembers` | roles: ["association:admin"] | query: zValidator |
| `/association/member/roster` | POST | `association:member/addRosterMember` | roles: ["association:admin"] | body: zValidator |
| `/association/member/roster/import` | POST | `association:member/importRosterMembers` | roles: ["association:admin"] | body: zValidator |
| `/association/member/roster/:memberId` | GET | `association:member/getRosterMember` | roles: ["association:admin"] | param+query: zValidator |
| `/association/member/roster/:memberId` | PUT | `association:member/updateRosterMember` | roles: ["association:admin"] | param+body: zValidator |
| `/association/member/applications` | POST | `association:member/createMembershipApplication` | roles: ["user"] | body: zValidator |
| `/association/member/applications` | GET | `association:member/listMembershipApplications` | roles: ["association:admin"] | query: zValidator |
| `/association/member/applications/bulk-approve` | POST | `association:member/bulkApproveMembershipApplications` | roles: ["association:admin"] | body: zValidator |
| `/association/member/applications/:applicationId/approve` | POST | `association:member/approveMembershipApplication` | roles: ["association:admin"] | param: zValidator |
| `/association/member/applications/:applicationId/deny` | POST | `association:member/denyMembershipApplication` | roles: ["association:admin"] | param+body: zValidator |
| `/association/member/membership-categories` | GET | `association:member/listMembershipCategories` | `[NEEDS MANUAL CONFIRMATION]` | query: zValidator |
| `/association/member/membership-categories/:organizationId` | PUT | `association:member/upsertMembershipCategory` | `[NEEDS MANUAL CONFIRMATION]` | param+body: zValidator |
| `/membership/org-profile/:organizationId` | GET | `membership/getOrgProfile` | roles: ["user"] | param: zValidator |
| `/membership/org-profile/:organizationId` | PUT | `membership/updateOrgProfile` | roles: ["association:admin"] | param+body: zValidator |
| `/invite` | POST | `invite/createInvite` | authMiddleware + orgContext | — |
| `/invite/validate/:token` | GET | `invite/validateInvite` | NONE (public) | — |
| `/invite/claim/:token` | POST | `invite/claimInvite` | authMiddleware | — |

---

## Navigation Registry

| Source | Label | Target Route | Role Visibility | Route Exists? | Risk | Evidence |
|--------|-------|-------------|----------------|--------------|------|---------|
| Officer sidebar | "Roster" / "Members" | `/org/$orgSlug/officer/roster` | officer | Yes | — | Sidebar component |
| Officer sidebar | "Applications" | `/org/$orgSlug/officer/applications` | officer | Yes | — | Sidebar component |
| Officer settings page | "Membership Categories" | `/org/$orgSlug/officer/settings/membership-categories` | officer | Yes | — | Settings page links |
| Roster page header | "Add Member" button | Opens inline dialog | officer | Yes | — | `roster/index.tsx` |
| Roster page | "Import" link | `/org/$orgSlug/officer/roster/import` | officer | Yes | — | `[NEEDS MANUAL CONFIRMATION]` |
| Member table row | Member name link | `/org/$orgSlug/officer/roster/$memberId` | officer | Yes | — | `member-table.tsx` |
| Member detail | Back breadcrumb | `/org/$orgSlug/officer/roster` | officer | Yes | — | `member-detail.tsx` |
| Member sidebar | "Directory" | `/org/$orgSlug/directory` | member | Yes | — | Sidebar component |
| Member sidebar | "Members" | `/org/$orgSlug/members` | member | Yes | — | Sidebar component |

---

## Broken Navigation Report

| ID | Issue | Source File | Target | Affected Role | Severity | Recommended Fix | Recommended Test |
|----|-------|-----------|--------|--------------|----------|----------------|-----------------|
| BN-M4-01 | MembershipList component shows `personId` UUID instead of person name in Person column | `membership-list.tsx` | N/A | officer | P2 | Join person data or use roster endpoint instead | Component test |
| BN-M4-02 | MembershipList "Renew" button has no handler — `<Button variant="link">Renew</Button>` with no onClick | `membership-list.tsx` | N/A | officer | P2 | Wire to renewal flow or remove | Component test |

---

## Route Test Gap Matrix

| Route | Existing Tests | Missing Tests | Recommended Test Type | Priority |
|-------|---------------|-------------|---------------------|----------|
| `/org/$orgSlug/officer/roster/` | E2E: member data, computed status, pagination | Role denial (non-officer access) | API + E2E | P1 |
| `/org/$orgSlug/officer/roster/$memberId` | E2E: detail page, suspend action, status-appropriate actions | Role denial, reinstate flow, category change | API + E2E | P1 |
| `/org/$orgSlug/officer/roster/import` | E2E: render check only | Full import journey: upload → preview → confirm → verify roster updated | E2E | P1 |
| `/org/$orgSlug/officer/applications` | E2E: empty state check | Approve/deny journey with data, bulk approve, status filter changes | E2E | P1 |
| `/org/$orgSlug/officer/settings/membership-categories` | E2E: render + "Add Category" visible | Add category form submission, deactivate category, validation | E2E + Component | P2 |
| `/org/$orgSlug/members` | None | Basic render, member directory with search/filter | E2E | P2 |
| `/org/$orgSlug/directory/$personId` | None | Profile detail page loads, shows correct data | E2E | P2 |

---

## Route State Coverage

| Route | Loading | Empty | Error | Unauthorized | Not Found | Success |
|-------|---------|-------|-------|-------------|-----------|---------|
| Roster | `ListSkeleton` | "No members" EmptyState | Error card | `[CURRENT BEHAVIOR]` relies on auth redirect | N/A | Member table |
| Member Detail | `ProfileSkeleton` | — | Error fallback | Auth redirect | `[NEEDS MANUAL CONFIRMATION]` invalid memberId | Full profile |
| Applications | `ListSkeleton` | "No applications found" EmptyState | Error card | Auth redirect | N/A | Application cards |
| CSV Import | — | Upload area | Toast error | Auth redirect | N/A | Success banner |
| Categories | `Skeleton` rows | "No categories yet" empty | Error alert | Auth redirect | N/A | Category table |

---

## Gate 3 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|------|------------|--------|----------|---------------|
| Gate 3 | Membership/Applications | **PASS** | Routes mapped, navigation registry built, broken nav identified, test gaps documented | category-management route auth needs confirmation |
