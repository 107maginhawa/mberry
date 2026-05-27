# Audit 03 — Route and Navigation: Admin/Platform Module

**Module:** Admin/Platform (admin app — `apps/admin`)
**Date:** 2026-05-26
**Status:** COMPLETE

---

## 1. Route Registry

| Route | Type | Component/Page | Layout | Auth Required | Roles | Params | Query Params | Source File | API/Data Dependency | Test Coverage | E2E Coverage |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `/` | Index | `DashboardPage` | Root (sidebar+header) | Yes (root auth) | super, support, analyst | None | None | `routes/index.tsx` | `listAssociations`, `listOrganizations`, `listAdmins`, `listFeatureFlags`, `searchEvents`, `listAuditLogs` | NONE | WEAK (smoke) |
| `/associations` | Index | `AssociationsPage` | Root | Yes | super, support, analyst | None | None | `routes/associations/index.tsx` | `listAssociations` | NONE | Unknown (`associations.spec.ts`) |
| `/associations/$associationId` | Dynamic | `AssociationDetailPage` | Root | Yes | super, support, analyst | `associationId` | None | `routes/associations/$associationId.tsx` | `getAssociation`, `updateAssociation`, `deleteAssociation`, `listOrganizations` | NONE | NONE |
| `/organizations` | Index | `OrganizationsPage` | Root | Yes | super, support, analyst | None | None | `routes/organizations/index.tsx` | `listOrganizations`, `listAssociations`, `createOrganization` | NONE | Unknown (`organizations.spec.ts`) |
| `/organizations/$organizationId` | Dynamic | `OrganizationDetailPage` | Root | Yes | super, support, analyst | `organizationId` | None | `routes/organizations/$organizationId.tsx` | `getOrganization`, `updateOrganization`, `transitionOrgStatus` | NONE | NONE |
| `/members` | Index | `MembersPage` | Root | Yes | super, support, analyst | None | `search`, `orgId` | `routes/members/index.tsx` | `listOrganizations` + custom member search | NONE | Unknown (`members.spec.ts`) |
| `/members/$personId` | Dynamic | `MemberDetailPage` | Root | Yes | super, support, analyst | `personId` | None | `routes/members/$personId.tsx` | Person API endpoints | NONE | NONE |
| `/operators` | Index | `OperatorsPage` | Root | Yes | super (RequireRole) | None | None | `routes/operators/index.tsx` | `listAdmins`, `inviteAdmin`, `revokeAdmin` | NONE | WEAK (page-load) |
| `/impersonate` | Index | `ImpersonatePage` | Root | Yes | super (RequireRole) | None | None | `routes/impersonate/index.tsx` | `listOrganizations`, `startImpersonation`, `endImpersonation` | NONE | WEAK (page-load) |
| `/feature-flags` | Index | `FeatureFlagsPage` | Root | Yes | super (RequireRole) | None | None | `routes/feature-flags/index.tsx` | `listFeatureFlags`, `setFeatureFlag`, `deleteFeatureFlag` | NONE | WEAK (page-load) |
| `/national-dashboard` | Index | `NationalDashboardPage` | Root | Yes | super, support, analyst (RequireRole) | None | `associationId`, `snapshotMonth` | `routes/national-dashboard/index.tsx` | `getNationalDashboard`, `listAssociations` | NONE | MODERATE (`wave7-routes.spec.ts`) |
| `/committees` | Index | `CommitteesPage` | Root | Yes | super, support (RequireRole) | None | None | `routes/committees/index.tsx` | `listAllCommittees` | NONE | MODERATE (`wave7-routes.spec.ts`) |
| `/training` | Index | `TrainingPage` | Root | Yes | super, support, analyst (RequireRole) | None | None | `routes/training/index.tsx` | Training/CPD API endpoints | NONE | NONE |
| `/events` | Index | `EventsPage` | Root | Yes | super, support (RequireRole) | None | `search`, `status` | `routes/events/index.tsx` | `searchEvents` | NONE | NONE |
| `/verifications` | Index | `VerificationsPage` | Root | Yes | super, support (RequireRole) | None | None | `routes/verifications/index.tsx` | Verification API endpoints | NONE | NONE |
| `/compliance` | Index | `CompliancePage` | Root | Yes | super, support, analyst (RequireRole) | None | None | `routes/compliance/index.tsx` | Compliance data endpoints | NONE | NONE |
| `/audit` | Index | `AuditPage` | Root | Yes | super, support (RequireRole) | None | `action`, `resourceType`, `startDate`, `endDate`, `userId` | `routes/audit/index.tsx` | `listAuditLogs` | NONE | Unknown (`audit.spec.ts`) |
| `/surveys` | Index | `SurveysPage` | Root | Yes | super, support, analyst (RequireRole) | None | None | `routes/surveys/index.tsx` | Survey admin endpoints | NONE | NONE |
| `/communications` | Index | `CommunicationsPage` | Root | Yes | super, support (RequireRole) | None | None | `routes/communications/index.tsx` | Communications API endpoints | NONE | NONE |
| `/communications/templates` | Nested | `TemplatesPage` | Root | Yes | super (RequireRole) | None | None | `routes/communications/templates.tsx` | Template CRUD endpoints | NONE | NONE |
| `/communications/email` | Nested | `EmailPage` | Root | Yes | super, support, analyst (RequireRole) | None | None | `routes/communications/email.tsx` | Email queue endpoints | NONE | NONE |
| `/communications/moderation` | Nested | `ModerationPage` | Root | Yes | super, support (RequireRole) | None | None | `routes/communications/moderation.tsx` | Moderation endpoints | NONE | NONE |

**Total: 23 routes** (1 index, 16 section indexes, 3 detail pages, 3 comms sub-routes)

---

## 2. Navigation Registry

| Source | Label | Source Route | Target Route | Role Visibility | Params | Query Params | Target Exists? | Test Coverage | E2E Coverage | Evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| Root sidebar | Dashboard | ANY | `/` | ALL | None | None | Yes | NONE | WEAK | `__root.tsx` sidebar nav |
| Root sidebar | Associations | ANY | `/associations` | ALL | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | Organizations | ANY | `/organizations` | ALL | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | Members | ANY | `/members` | ALL | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | Verifications | ANY | `/verifications` | super, support | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | Compliance | ANY | `/compliance` | ALL | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | Events | ANY | `/events` | super, support | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | Training | ANY | `/training` | ALL | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | National Dashboard | ANY | `/national-dashboard` | ALL | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | Committees | ANY | `/committees` | super, support | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | Operators | ANY | `/operators` | super | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | Feature Flags | ANY | `/feature-flags` | super | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | Impersonate | ANY | `/impersonate` | super | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | Audit | ANY | `/audit` | super, support | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | Surveys | ANY | `/surveys` | ALL | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Root sidebar | Communications | ANY | `/communications` | super, support | None | None | Yes | NONE | NONE | `__root.tsx` sidebar nav |
| Dashboard quick action | Manage Operators | `/` | `/operators` | ALL (visible) | None | None | Yes | NONE | NONE | `routes/index.tsx` quickActions |
| Dashboard quick action | Feature Flags | `/` | `/feature-flags` | ALL (visible) | None | None | Yes | NONE | NONE | `routes/index.tsx` quickActions |
| Dashboard quick action | Impersonate User | `/` | `/impersonate` | ALL (visible) | None | None | Yes | NONE | NONE | `routes/index.tsx` quickActions — **quick actions visible to all roles but page restricted** [P2] |
| Dashboard quick action | Member Lookup | `/` | `/members` | ALL (visible) | None | None | Yes | NONE | NONE | `routes/index.tsx` quickActions |
| Association row | Detail link | `/associations` | `/associations/$associationId` | ALL | `associationId` | None | Yes | NONE | NONE | `associations/index.tsx` Link |
| Organization row | Detail link | `/organizations` | `/organizations/$organizationId` | ALL | `organizationId` | None | Yes | NONE | NONE | `organizations/index.tsx` Link |
| Member row | Detail link | `/members` | `/members/$personId` | ALL | `personId` | None | Yes | NONE | NONE | `members/index.tsx` Link |
| Comms page | Templates tab | `/communications` | `/communications/templates` | super, support (from comms page) | None | None | Yes | NONE | NONE | `communications/index.tsx` Link |
| Comms page | Email tab | `/communications` | `/communications/email` | super, support (from comms page) | None | None | Yes | NONE | NONE | `communications/index.tsx` Link |
| Comms page | Moderation tab | `/communications` | `/communications/moderation` | super, support (from comms page) | None | None | Yes | NONE | NONE | `communications/index.tsx` Link |

---

## 3. Route Target Validation

| Source File | Source Route | Target Route | Validation Result | Issue | Severity | Evidence |
|---|---|---|---|---|---|---|
| `routes/index.tsx` | `/` (quick actions) | `/operators` | VALID | Quick action visible to ALL roles but page requires `super` — click leads to "Access Denied" for non-super | P2 | `quickActions` array has no role filtering |
| `routes/index.tsx` | `/` (quick actions) | `/feature-flags` | VALID | Same issue — visible to all, restricted to super | P2 | `quickActions` array has no role filtering |
| `routes/index.tsx` | `/` (quick actions) | `/impersonate` | VALID | Same issue — visible to all, restricted to super | P2 | `quickActions` array has no role filtering |
| All sidebar links | ANY | All 23 routes | VALID | Sidebar correctly filters by `ROUTE_ROLES` | N/A | `__root.tsx` uses ROUTE_ROLES to filter |
| `associations/index.tsx` | `/associations` | `/associations/$associationId` | VALID | Params from row data | N/A | Link uses `association.id` |
| `organizations/index.tsx` | `/organizations` | `/organizations/$organizationId` | VALID | Params from row data | N/A | Link uses `org.id` |
| `members/index.tsx` | `/members` | `/members/$personId` | VALID | Params from row data | N/A | Link uses `person.id` |

---

## 4. Role-Aware Navigation Matrix

| Route/Nav Item | Role | Should See? | Should Access? | Frontend Enforcement | Backend/API Enforcement | Existing Test | Existing E2E | Gap | Severity |
|---|---|---|---|---|---|---|---|---|---|
| Sidebar: Operators | super | Yes | Yes | ROUTE_ROLES filters sidebar | Wildcard middleware (no sub-role) | NONE | NONE | No sidebar filtering E2E | P2 |
| Sidebar: Operators | support | No | No | ROUTE_ROLES hides from sidebar | **Backend ALLOWS** | NONE | NONE | Backend sub-role gap | **P1** |
| Sidebar: Operators | analyst | No | No | ROUTE_ROLES hides from sidebar | **Backend ALLOWS** | NONE | NONE | Backend sub-role gap | **P1** |
| Quick Action: Manage Operators | support/analyst | **Yes (visible)** | No | **Quick actions NOT role-filtered** [LIKELY BUG] | Backend allows | NONE | NONE | Dashboard quick actions visible to wrong role | **P1** |
| Quick Action: Feature Flags | support/analyst | **Yes (visible)** | No | **Quick actions NOT role-filtered** | Backend allows | NONE | NONE | Dashboard quick actions visible to wrong role | **P1** |
| Quick Action: Impersonate | support/analyst | **Yes (visible)** | No | **Quick actions NOT role-filtered** | Backend allows | NONE | NONE | Dashboard quick actions visible to wrong role | **P1** |

---

## 5. Route-Level State Matrix

| Route | State | Implemented? | Source File | Trigger | Existing Test | E2E Needed? | Gap | Severity |
|---|---|---|---|---|---|---|---|---|
| `/` | Loading | Yes | `routes/index.tsx` | Initial data fetch | NONE | No | N/A | P3 |
| `/` | Error | Yes | `routes/index.tsx` | API failure (stat cards show "—") | NONE | No | N/A | P3 |
| `/` | Empty | Partial | `routes/index.tsx` | No data | NONE | No | Stat cards show 0, no explicit empty state | P3 |
| `/associations` | Loading | Yes | `routes/associations/index.tsx` | Initial fetch | NONE | No | N/A | P3 |
| `/associations` | Empty | Yes | `routes/associations/index.tsx` | No associations | NONE | No | N/A | P3 |
| `/associations` | Error | Yes | `routes/associations/index.tsx` | API failure | NONE | No | N/A | P3 |
| `/operators` | Loading | Yes | `routes/operators/index.tsx` | Initial fetch | NONE | No | N/A | P3 |
| `/operators` | Empty | Yes | `routes/operators/index.tsx` | No operators | NONE | No | N/A | P3 |
| `/operators` | Error | Yes | `routes/operators/index.tsx` | API failure | NONE | No | N/A | P3 |
| All routes | Unauthorized | Yes | `routes/__root.tsx` | No session | `admin-smoke.spec.ts` | Yes | Only smoke test exists | P2 |
| Role-restricted routes | Forbidden (sub-role) | Yes | `lib/role-gate.tsx` RequireRole | Wrong admin sub-role | NONE | Yes | No E2E for sub-role denial | **P1** |

---

## 6. Broken Navigation Report

| ID | Issue | Source File | Target | Affected Role | Severity | Recommended Fix | Recommended Test |
|---|---|---|---|---|---|---|---|
| NAV-01 | Dashboard quick actions visible to ALL admin roles but link to super-only pages | `routes/index.tsx` | `/operators`, `/feature-flags`, `/impersonate` | support, analyst | **P1** [LIKELY BUG] | Filter `quickActions` by role using `useAdminUser()` | Component test: verify quickActions filtered by role |

---

## 7. Broken Link / Mapping Report

No broken links found. All navigation targets exist. All dynamic params sourced from data.

---

## 8. E2E Navigation Smoke Coverage Matrix

| Nav Path | Role | Source Route | Target Route | Dynamic Params? | Existing E2E | E2E Quality | Needs E2E? | Severity |
|---|---|---|---|---|---|---|---|---|
| Sidebar → Dashboard | super | ANY | `/` | No | `admin-smoke.spec.ts` | WEAK (text check) | Yes | P2 |
| Sidebar → Associations | super | ANY | `/associations` | No | `associations.spec.ts` | Unknown | Yes | P2 |
| Sidebar → Organizations | super | ANY | `/organizations` | No | `organizations.spec.ts` | Unknown | Yes | P2 |
| Sidebar → Operators | super | ANY | `/operators` | No | `admin-routes.spec.ts` | WEAK (page-load) | Yes | P1 |
| Sidebar → Feature Flags | super | ANY | `/feature-flags` | No | `admin-routes.spec.ts` | WEAK (page-load) | Yes | P1 |
| Sidebar → Impersonate | super | ANY | `/impersonate` | No | `admin-routes.spec.ts` | WEAK (page-load) | Yes | P1 |
| Sidebar → National Dashboard | super | ANY | `/national-dashboard` | No | `wave7-routes.spec.ts` | MODERATE | Yes | P2 |
| Sidebar → Committees | super | ANY | `/committees` | No | `wave7-routes.spec.ts` | MODERATE | Yes | P2 |
| Association row → detail | super | `/associations` | `/associations/$id` | Yes | NONE | NONE | Yes | P1 |
| Organization row → detail | super | `/organizations` | `/organizations/$id` | Yes | NONE | NONE | Yes | P1 |
| Member row → detail | super | `/members` | `/members/$id` | Yes | NONE | NONE | Yes | P1 |

---

## 9. Route Test Gap Matrix

| Route/Nav Path | Existing Test | Test Type | Coverage Quality | Missing Assertion | Recommended Test Type | Priority |
|---|---|---|---|---|---|---|
| `/` dashboard | `admin-smoke.spec.ts` | E2E | WEAK | Stats loaded, quick actions rendered, sidebar nav works | E2E: verify dashboard stats + nav | P2 |
| `/operators` | `admin-routes.spec.ts` | E2E | WEAK (page-load) | Table loads with data, invite form opens | E2E: full operator management journey | P1 |
| `/feature-flags` | `admin-routes.spec.ts` | E2E | WEAK (page-load) | Flag table loads, create form works | E2E: CRUD journey | P1 |
| `/impersonate` | `admin-routes.spec.ts` | E2E | WEAK (page-load) | User search works, session management | E2E: impersonation journey | P1 |
| `/associations/$associationId` | NONE | N/A | NONE | Detail page loads, edit form works, delete confirm | E2E: detail + edit journey | P1 |
| `/organizations/$organizationId` | NONE | N/A | NONE | Detail page loads, status transition | E2E: detail + lifecycle journey | P1 |
| `/members/$personId` | NONE | N/A | NONE | Member detail loads with person data | E2E: member lookup → detail | P1 |
| Sub-role denial (analyst → operators) | NONE | N/A | NONE | "Access Denied" shown | E2E: role-denial journey | **P1** |
| All comms sub-routes | NONE | N/A | NONE | Pages load, tabs navigate correctly | E2E: comms navigation | P2 |

---

## 10. Product Decisions Needed

| Question | Route/Nav Path | Affected Role | Why Needed |
|---|---|---|---|
| Should dashboard quick actions be role-filtered? | `/` → `/operators`, `/feature-flags`, `/impersonate` | support, analyst | Quick actions currently visible to all roles, leading to "Access Denied" when clicked by non-super |

---

## 11. Gate 3 Evaluation

| Gate | Module/Area | Result | Evidence | Missing Items |
|---|---|---|---|---|
| Gate 3 | Admin/Platform | **PASS** (with P1 findings) | 23 routes catalogued, 26 nav sources checked, all targets validated, role-aware navigation checked, route states reviewed, E2E gaps listed, 1 broken nav pattern found | None — all sections completed |
