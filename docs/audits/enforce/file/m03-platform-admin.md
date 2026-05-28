# Per-File Spec Traceability Report: M03 Platform Admin

**Module:** `services/api-ts/src/handlers/platformadmin/`
**Generated:** 2026-05-28
**Spec Version:** MODULE_SPEC v2.0 (2026-05-21)
**Total Files:** 78 (37 controllers, 28 tests, 2 entities, 2 repositories, 1 utility, 4 jobs, 1 job index, 1 util test, 2 cross-module)
**Previous Audit:** 2026-05-27 (59 files)

---

## Summary

| Metric | Value |
|--------|-------|
| Total files analyzed | 78 |
| Blockers | 3 |
| Warnings | 35 |
| Info | 4 |
| Total findings | 42 |
| Files with findings | 30 |
| Files clean | 48 |
| Test coverage (controllers with paired .test.ts) | 20/37 (54%) |
| New files since last audit | 19 |

**Delta from 2026-05-27 audit:**
- +19 files (59 -> 78): 11 new controllers, 4 new jobs, 2 repo updates, 1 test, 1 job index
- +6 findings (36 -> 42): 3 new blockers (spec gaps), 2 new warnings, 1 new info
- Test coverage dropped 77% -> 54% (11 new controllers, 0 new test files)
- getCommittee blocker from prior audit UNCHANGED (still a re-export stub)

**Key patterns:**
- 30 of 35 warnings are inline error responses (`ctx.json({ error: ... })`) instead of a typed error taxonomy -- systemic, not per-file
- 3 blockers: 2 spec-declared endpoints missing handlers + 1 stub file
- 11 new controllers added May 28 with NO test files (tickets, subscriptions, pricing, breach, dashboard export)
- 5 ticket handlers, 3 pricing handlers, 3 subscription handlers, 3 breach handlers lack spec API endpoints in Section 10
- 4 background jobs implement spec business rules (M3-R11, M3-R12, WF-017, WF-023) but are not referenced in spec Section 10

---

## File Classification Table

| # | File | Classification | Has Test | Findings | New |
|---|------|---------------|----------|----------|-----|
| 1 | `ac-m03.platform-admin.test.ts` | test | -- | 0 | |
| 2 | `ac-m14.national-dashboard.test.ts` | test | -- | 0 | |
| 3 | `addTicketComment.ts` | controller | N | 1 | NEW |
| 4 | `br-36.national-dashboard.test.ts` | test | -- | 0 | |
| 5 | `cancelSubscription.ts` | controller | N | 1 | NEW |
| 6 | `createAssociation.test.ts` | test | -- | 0 | |
| 7 | `createAssociation.ts` | controller | Y | 1 | |
| 8 | `createOrganization.test.ts` | test | -- | 0 | |
| 9 | `createOrganization.ts` | controller | Y | 1 | |
| 10 | `createPricingTier.ts` | controller | N | 1 | NEW |
| 11 | `createTicket.ts` | controller | N | 1 | NEW |
| 12 | `deleteAssociation.test.ts` | test | -- | 0 | |
| 13 | `deleteAssociation.ts` | controller | Y | 1 | |
| 14 | `deleteFeatureFlag.test.ts` | test | -- | 0 | |
| 15 | `deleteFeatureFlag.ts` | controller | Y | 1 | |
| 16 | `endImpersonation.test.ts` | test | -- | 0 | |
| 17 | `endImpersonation.ts` | controller | Y | 1 | |
| 18 | `exportDashboardReport.ts` | controller | N | 7 | NEW |
| 19 | `getAdminRole.test.ts` | test | -- | 0 | |
| 20 | `getAdminRole.ts` | controller | Y | 0 | |
| 21 | `getAssociation.test.ts` | test | -- | 0 | |
| 22 | `getAssociation.ts` | controller | Y | 1 | |
| 23 | `getCommittee.ts` | controller | N | 1 | |
| 24 | `getNationalDashboard.ts` | controller | N* | 4 | |
| 25 | `getOrganization.test.ts` | test | -- | 0 | |
| 26 | `getOrganization.ts` | controller | Y | 1 | |
| 27 | `getOrganizationBySlug.test.ts` | test | -- | 0 | |
| 28 | `getOrganizationBySlug.ts` | controller | Y | 0 | |
| 29 | `getSubscription.ts` | controller | N | 1 | NEW |
| 30 | `getTicket.ts` | controller | N | 1 | NEW |
| 31 | `inviteAdmin.test.ts` | test | -- | 0 | |
| 32 | `inviteAdmin.ts` | controller | Y | 1 | |
| 33 | `listAdmins.test.ts` | test | -- | 0 | |
| 34 | `listAdmins.ts` | controller | Y | 1 | |
| 35 | `listAllCommittees.test.ts` | test | -- | 0 | |
| 36 | `listAllCommittees.ts` | controller | Y | 2 | |
| 37 | `listAssociations.test.ts` | test | -- | 0 | |
| 38 | `listAssociations.ts` | controller | Y | 1 | |
| 39 | `listBreaches.ts` | controller | N | 1 | NEW |
| 40 | `listFeatureFlags.test.ts` | test | -- | 0 | |
| 41 | `listFeatureFlags.ts` | controller | Y | 1 | |
| 42 | `listOrganizations.test.ts` | test | -- | 0 | |
| 43 | `listOrganizations.ts` | controller | Y | 1 | |
| 44 | `listPricingTiers.ts` | controller | N | 1 | NEW |
| 45 | `listPublicOrgs.test.ts` | test | -- | 0 | |
| 46 | `listPublicOrgs.ts` | controller | Y | 0 | |
| 47 | `listSubscriptions.ts` | controller | N | 1 | NEW |
| 48 | `listTickets.ts` | controller | N | 1 | NEW |
| 49 | `platformadmin.test.ts` | test | -- | 0 | |
| 50 | `reportBreach.ts` | controller | N | 1 | NEW |
| 51 | `revokeAdmin.test.ts` | test | -- | 0 | |
| 52 | `revokeAdmin.ts` | controller | Y | 2 | |
| 53 | `setFeatureFlag.test.ts` | test | -- | 0 | |
| 54 | `setFeatureFlag.ts` | controller | Y | 1 | |
| 55 | `startImpersonation.test.ts` | test | -- | 0 | |
| 56 | `startImpersonation.ts` | controller | Y | 1 | |
| 57 | `transitionOrgStatus.test.ts` | test | -- | 0 | |
| 58 | `transitionOrgStatus.ts` | controller | Y | 1 | |
| 59 | `updateAdmin.test.ts` | test | -- | 0 | |
| 60 | `updateAdmin.ts` | controller | Y | 1 | |
| 61 | `updateAssociation.test.ts` | test | -- | 0 | |
| 62 | `updateAssociation.ts` | controller | Y | 1 | |
| 63 | `updateBreachStatus.ts` | controller | N | 1 | NEW |
| 64 | `updateOrganization.test.ts` | test | -- | 0 | |
| 65 | `updateOrganization.ts` | controller | Y | 1 | |
| 66 | `updatePricingTier.ts` | controller | N | 1 | NEW |
| 67 | `updateTicketStatus.ts` | controller | N | 1 | NEW |
| 68 | `repos/dashboard-snapshot.schema.ts` | entity | -- | 0 | |
| 69 | `repos/dashboard.repo.ts` | repository | -- | 0 | UPD |
| 70 | `repos/platform-admin.repo.ts` | repository | -- | 0 | UPD |
| 71 | `repos/platform-admin.schema.ts` | entity | -- | 0 | UPD |
| 72 | `utils/slug.test.ts` | test | -- | 0 | |
| 73 | `utils/slug.ts` | utility | Y | 0 | |
| 74 | `jobs/breachDeadlineMonitor.ts` | job | -- | 0 | NEW |
| 75 | `jobs/index.ts` | barrel | -- | 0 | NEW |
| 76 | `jobs/pastDueMonitor.ts` | job | -- | 0 | NEW |
| 77 | `jobs/ticketSlaMonitor.ts` | job | -- | 0 | NEW |
| 78 | `jobs/trialExpiryMonitor.ts` | job | -- | 0 | NEW |

*N\* = indirect coverage via acceptance test files (`ac-m14`, `br-36`)

---

## File-to-Spec Traceability Matrix

### Handlers -- Traced to Spec Section 10 (API Expectations)

| File | Spec Endpoint | Slice | Status |
|------|--------------|-------|--------|
| `createAssociation.ts` | `POST /admin/associations` | M03-S1 | TRACED |
| `listAssociations.ts` | `GET /admin/associations` | M03-S1 | TRACED |
| `getAssociation.ts` | (implicit GET /:id) | M03-S1 | TRACED |
| `updateAssociation.ts` | `PUT /admin/associations/:id` | M03-S1 | TRACED |
| `deleteAssociation.ts` | `DELETE /admin/associations/:id` | M03-S1 | TRACED |
| `createOrganization.ts` | `POST /admin/associations/:id/orgs` | M03-S2 | TRACED |
| `getOrganization.ts` | (implicit GET) | M03-S2 | TRACED |
| `updateOrganization.ts` | (implicit PUT) | M03-S2 | TRACED |
| `listOrganizations.ts` | (implicit list) | M03-S2 | TRACED |
| `transitionOrgStatus.ts` | `PUT /admin/orgs/:id/status` | M03-S9 | TRACED |
| `setFeatureFlag.ts` | `PUT /admin/feature-flags` | M03-S3 | TRACED |
| `listFeatureFlags.ts` | `GET /admin/feature-flags` | M03-S3 | TRACED |
| `deleteFeatureFlag.ts` | (implicit DELETE) | M03-S3 | TRACED |
| `startImpersonation.ts` | `POST /admin/impersonate` | M03-S5 | TRACED |
| `endImpersonation.ts` | `DELETE /admin/impersonate` | M03-S5 | TRACED |
| `inviteAdmin.ts` | `POST /admin/team/invite` | M03-S8 | TRACED |
| `listAdmins.ts` | (implicit list) | M03-S8 | TRACED |
| `getAdminRole.ts` | (implicit GET role) | M03-S8 | TRACED |
| `updateAdmin.ts` | `PUT /admin/team/:id/role` | M03-S8 | TRACED |
| `revokeAdmin.ts` | `DELETE /admin/team/:id` | M03-S8 | TRACED |

### Handlers -- Traced to Spec Workflows/Business Rules (no Section 10 endpoint)

| File | Spec Reference | Slice | Status |
|------|---------------|-------|--------|
| `getOrganizationBySlug.ts` | WF-016 (slug provisioning) | M03-S2 | TRACED |
| `getNationalDashboard.ts` | WF-021 (analytics) | M03-S4/S7 | TRACED |

### NEW Handlers -- Traced to Spec Scope/BRs but NO Section 10 Endpoint

| File | Spec Reference | Slice | Status |
|------|---------------|-------|--------|
| `cancelSubscription.ts` | WF-017 (subscription mgmt), WF-023 (cancellation) | M03-S10 | SPEC-GAP |
| `getSubscription.ts` | WF-017 | M03-S10 | SPEC-GAP |
| `listSubscriptions.ts` | WF-017 | M03-S10 | SPEC-GAP |
| `createTicket.ts` | WF-020 (support tickets) | M03-S6 | SPEC-GAP |
| `getTicket.ts` | WF-020 | M03-S6 | SPEC-GAP |
| `listTickets.ts` | WF-020 | M03-S6 | SPEC-GAP |
| `addTicketComment.ts` | WF-020 | M03-S6 | SPEC-GAP |
| `updateTicketStatus.ts` | WF-020 | M03-S6 | SPEC-GAP |
| `createPricingTier.ts` | In-Scope "Pricing and plan management", M3-R8 | -- | SPEC-GAP |
| `listPricingTiers.ts` | In-Scope "Pricing and plan management", M3-R8 | -- | SPEC-GAP |
| `updatePricingTier.ts` | In-Scope "Pricing and plan management", M3-R8 | -- | SPEC-GAP |
| `reportBreach.ts` | M3-R11 (DPA compliance) | -- | SPEC-GAP |
| `listBreaches.ts` | M3-R11 | -- | SPEC-GAP |
| `updateBreachStatus.ts` | M3-R11 | -- | SPEC-GAP |
| `exportDashboardReport.ts` | M03-S4 (dashboard) | M03-S4 | SPEC-GAP |
| `listPublicOrgs.ts` | WF-016 (convenience) | M03-S2 | SPEC-GAP |

### Cross-Module Files

| File | Origin | Status |
|------|--------|--------|
| `getCommittee.ts` | Re-export from `association:operations` | RE-EXPORT |
| `listAllCommittees.ts` | Imports `CommitteeRepository` from `association:operations` | CROSS-MODULE |

### Spec Section 10 Endpoints -- NOT Implemented

| Spec Endpoint | Purpose | Finding ID | Status |
|--------------|---------|-----------|--------|
| `GET /admin/analytics/revenue` | MRR, ARR, churn data | EF-M03-b4c5d6e7 | MISSING-HANDLER |
| `GET /admin/analytics/health` | Org health scores | EF-M03-c5d6e7f8 | MISSING-HANDLER |

### Jobs -- Traced to Business Rules

| File | Spec Reference | Status |
|------|---------------|--------|
| `jobs/breachDeadlineMonitor.ts` | M3-R11 (72h breach notification) | TRACED |
| `jobs/pastDueMonitor.ts` | WF-023 (org suspension) | TRACED |
| `jobs/ticketSlaMonitor.ts` | M3-R12 (SLA enforcement) | TRACED |
| `jobs/trialExpiryMonitor.ts` | WF-017 (subscription mgmt) | TRACED |
| `jobs/index.ts` | (barrel export) | INFRA |

### Repos -- Traced to Data Requirements

| File | Spec Reference | Status |
|------|---------------|--------|
| `repos/platform-admin.schema.ts` | Section 7 (Data Requirements) | TRACED |
| `repos/platform-admin.repo.ts` | Section 7 (Data Requirements) | TRACED |
| `repos/dashboard-snapshot.schema.ts` | WF-021 (dashboard) | TRACED |
| `repos/dashboard.repo.ts` | WF-021 (dashboard) | TRACED |

### Utils -- Traced

| File | Spec Reference | Status |
|------|---------------|--------|
| `utils/slug.ts` | WF-016 (org slug provisioning) | TRACED |
| `utils/slug.test.ts` | WF-016 | TRACED |

---

## Findings Table

| ID | File | Severity | Check | Description |
|----|------|----------|-------|-------------|
| EF-M03-7c3f01a2 | `getCommittee.ts` | **blocker** | data-shape | Stub/re-export file (1 line). Re-exports from `association:operations`. No local implementation, no test. Not in MODULE_SPEC. |
| EF-M03-b4c5d6e7 | (missing) | **blocker** | spec-impl-gap | `GET /admin/analytics/revenue` declared in spec Section 10 but no handler exists. `getNationalDashboard` may partially cover but is not 1:1. |
| EF-M03-c5d6e7f8 | (missing) | **blocker** | spec-impl-gap | `GET /admin/analytics/health` declared in spec Section 10 but no handler exists. |
| EF-M03-a1b2c3d4 | `addTicketComment.ts` | **warning** | spec-gap | Handler exists, no Section 10 endpoint. Traced to WF-020 (M03-S6). |
| EF-M03-b2c3d4e5 | `createTicket.ts` | **warning** | spec-gap | Handler exists, no Section 10 endpoint. Traced to WF-020. |
| EF-M03-c3d4e5f6 | `getTicket.ts` | **warning** | spec-gap | Handler exists, no Section 10 endpoint. |
| EF-M03-d4e5f6a7 | `listTickets.ts` | **warning** | spec-gap | Handler exists, no Section 10 endpoint. |
| EF-M03-e5f6a7b8 | `updateTicketStatus.ts` | **warning** | spec-gap | Handler exists, no Section 10 endpoint. |
| EF-M03-f6a7b8c9 | `createPricingTier.ts` | **warning** | spec-gap | Pricing tier CRUD has no Section 10 endpoints. In-scope, M3-R8 applies. |
| EF-M03-a7b8c9d0 | `listPricingTiers.ts` | **warning** | spec-gap | Same as above. |
| EF-M03-b8c9d0e1 | `updatePricingTier.ts` | **warning** | spec-gap | Same as above. |
| EF-M03-c9d0e1f2 | `cancelSubscription.ts` | **warning** | spec-gap | Subscription CRUD has no Section 10 endpoints. WF-017/WF-023 apply. |
| EF-M03-d0e1f2a3 | `getSubscription.ts` | **warning** | spec-gap | Same as above. |
| EF-M03-e1f2a3b4 | `listSubscriptions.ts` | **warning** | spec-gap | Same as above. |
| EF-M03-f2a3b4c5 | `reportBreach.ts` | **warning** | spec-gap | Breach CRUD has no Section 10 endpoints. M3-R11 applies. |
| EF-M03-a3b4c5d6 | `listBreaches.ts` | **warning** | spec-gap | Same as above. |
| EF-M03-b4c5d6e8 | `updateBreachStatus.ts` | **warning** | spec-gap | Same as above. |
| EF-M03-c5d6e7f9 | `exportDashboardReport.ts` | **warning** | spec-gap | Dashboard export has no Section 10 endpoint. 7 error paths, complex auth. |
| EF-M03-d6e7f8a0 | `listPublicOrgs.ts` | **warning** | spec-gap | Public org listing has no Section 10 endpoint. Convenience route. |
| EF-M03-a1e80b31 | `createAssociation.ts` | warning | error-taxonomy | Inline `ctx.json({ error: '...' })` instead of typed error codes. |
| EF-M03-b2f90c42 | `createOrganization.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-c3a01d53 | `deleteAssociation.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-d4b12e64 | `deleteFeatureFlag.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-e5c23f75 | `endImpersonation.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-f6d34086 | `exportDashboardReport.ts` | warning | error-taxonomy | 7 inline error responses -- highest density in module. |
| EF-M03-07e45197 | `getAssociation.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-18f562a8 | `getNationalDashboard.ts` | warning | error-taxonomy | 4 inline error responses. |
| EF-M03-29067319 | `getOrganization.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-3a17842a | `inviteAdmin.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-4b28953b | `listAdmins.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-5c39a64c | `listAllCommittees.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-6d4ab75d | `listAssociations.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-7e5bc86e | `listFeatureFlags.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-8f6cd97f | `listOrganizations.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-907dea80 | `revokeAdmin.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-a18efb91 | `setFeatureFlag.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-b290cca2 | `startImpersonation.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-c3a1ddb3 | `transitionOrgStatus.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-d4b2eec4 | `updateAdmin.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-e5c3ffd5 | `updateAssociation.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-f6d400e6 | `updateOrganization.ts` | warning | error-taxonomy | Same systemic pattern. |
| EF-M03-5c39a64d | `listAllCommittees.ts` | info | import-boundary | Cross-module import from `association:operations`. |
| EF-M03-907dea81 | `revokeAdmin.ts` | info | naming | `revoke` not standard verb-first. Domain-appropriate but inconsistent. |
| EF-M03-e1f2a3c6 | `getCommittee.ts` | info | import-boundary | Re-export from `association:operations`. Not in spec Section 14 dependencies. |
| EF-M03-f2a3b4d7 | `jobs/*` | info | spec-gap | 4 jobs implement spec BRs but are not referenced in Section 10 API Expectations. Consider adding a "Background Jobs" subsection to spec. |

---

## Severity Summary

| Severity | Count | Description |
|----------|-------|-------------|
| **blocker** | 3 | 2 spec endpoints missing handlers, 1 stub file |
| **warning** | 35 | 16 spec-gap (handlers without Section 10 endpoints), 19 error-taxonomy (systemic) |
| **info** | 4 | 2 cross-module imports, 1 naming, 1 jobs not in spec |
| **Total** | **42** | |

---

## Test Coverage by Vertical Slice

| Slice | Handlers | With Tests | Coverage | Risk |
|-------|----------|-----------|----------|------|
| M03-S1 (Association CRUD) | 5 | 5 | 100% | LOW |
| M03-S2 (Org Provisioning) | 5 | 4 | 80% | LOW |
| M03-S3 (Feature Flags) | 3 | 3 | 100% | LOW |
| M03-S4 (Dashboard) | 2 | 0* | 0% | HIGH |
| M03-S5 (Impersonation) | 2 | 2 | 100% | LOW |
| M03-S6 (Tickets) | 5 | 0 | **0%** | **CRITICAL** |
| M03-S7 (Revenue) | 0 | 0 | N/A | BLOCKED |
| M03-S8 (Admin Team) | 5 | 5 | 100% | LOW |
| M03-S9 (Org Lifecycle) | 1 | 1 | 100% | LOW |
| M03-S10 (Subscriptions) | 3 | 0 | **0%** | **CRITICAL** |
| Unsliced (breach) | 3 | 0 | **0%** | HIGH |
| Unsliced (pricing) | 3 | 0 | **0%** | HIGH |

*Dashboard has indirect coverage via `ac-m14` and `br-36` acceptance tests.

**Controllers without ANY test coverage (17):**
`addTicketComment`, `cancelSubscription`, `createPricingTier`, `createTicket`, `exportDashboardReport`, `getCommittee`, `getSubscription`, `getTicket`, `listBreaches`, `listPricingTiers`, `listSubscriptions`, `listTickets`, `reportBreach`, `updateBreachStatus`, `updatePricingTier`, `updateTicketStatus`, `getNationalDashboard`*

---

## Review Required

### Blockers (3)

**EF-M03-7c3f01a2 -- `getCommittee.ts` is a re-export stub.** Single line re-exporting from `association:operations/getCommittee`. No local logic. MODULE_SPEC does not declare a `getCommittee` endpoint. Action: remove file or document cross-module dependency in spec Section 14.

**EF-M03-b4c5d6e7 -- `GET /admin/analytics/revenue` missing handler.** Spec Section 10 declares this endpoint (MRR, ARR, churn data). No dedicated handler. `getNationalDashboard` may partially cover. Action: implement `getRevenueAnalytics.ts` or update spec to map to `getNationalDashboard`.

**EF-M03-c5d6e7f8 -- `GET /admin/analytics/health` missing handler.** Spec Section 10 declares this endpoint (orgHealthScores[]). No dedicated handler. Action: implement `getOrgHealthScores.ts` or update spec.

### Systemic Warning: 16 Handlers Without Spec API Endpoints (NEW)

16 controllers implement in-scope features (tickets, subscriptions, pricing, breach, dashboard export, public orgs) but have NO corresponding endpoints in MODULE_SPEC Section 10. All are traceable to workflows or business rules elsewhere in the spec, confirming they are intentional implementations.

**Impact:** Implementation is ahead of spec. Section 10 is no longer the single source of truth for this module's API surface.

**Recommended fix:** Add the following endpoint groups to MODULE_SPEC Section 10:
1. **Ticket CRUD** (5 endpoints): `POST/GET/PUT /admin/tickets`, `POST /admin/tickets/:id/comments`
2. **Subscription CRUD** (3 endpoints): `GET /admin/subscriptions`, `GET/DELETE /admin/subscriptions/:id`
3. **Pricing Tier CRUD** (3 endpoints): `POST/GET/PUT /admin/pricing-tiers`
4. **Breach Management** (3 endpoints): `POST/GET/PUT /admin/breaches`
5. **Dashboard Export** (1 endpoint): `POST /admin/dashboard/export`
6. **Public Orgs** (1 endpoint): `GET /admin/orgs/public`

### Systemic Warning: Inline Error Taxonomy (19 findings, carried forward)

All controllers use `ctx.json({ error: '...' }, statusCode)` instead of typed error responses. Module-wide pattern, not individual bugs. See prior audit for recommended `utils/errors.ts` helper.

### Test Gap: 17 Controllers Untested (NEW priority)

11 newly-added controllers have no test files. Combined with 6 from prior audit, 17/37 controllers (46%) lack any test coverage. Highest risk: ticket handlers (5 files, complex SLA logic) and subscription handlers (3 files, billing-adjacent).

---

## Checks Performed Per File

| # | Check | Description | Spec Source |
|---|-------|-------------|------------|
| 1 | Spec traceability | Mapped each file to MODULE_SPEC Section 10 endpoints, workflows (WF-015-023), business rules (M3-R1-R13), and vertical slices (M03-S1-S10). | MODULE_SPEC |
| 2 | Error taxonomy | Scanned for `ctx.json({ error: ... })` without structured error codes. | API_CONTRACTS |
| 3 | Domain terms | Checked for forbidden synonyms. **None found.** | MODULE_SPEC s2 |
| 4 | Data shape | Validated for stub files, `any` types in production code, raw SQL. `any` only in tests. | MODULE_SPEC, DOMAIN_MODEL |
| 5 | Naming conventions | Verified handler filenames follow verb-first pattern. | MODULE_SPEC s20 |
| 6 | Import boundaries | Cross-referenced `@/handlers/` imports against module boundary. | MODULE_MAP |
| 7 | Test pairing | Checked each controller for matching `.test.ts` file. | VERTICAL_TDD |
| 8 | Job traceability | Mapped each job to business rules/workflows. | MODULE_SPEC s5 |

---

## Spec Artifacts Used

| Artifact | Path | Used For |
|----------|------|----------|
| MODULE_SPEC | `docs/product/modules/m03-platform-admin/MODULE_SPEC.md` | Entity definitions, workflows, business rules, naming, acceptance criteria, domain terms, API endpoints, vertical slices |
| API_CONTRACTS | `docs/product/modules/m03-platform-admin/API_CONTRACTS.md` | Error response shapes, status codes |
| DOMAIN_MODEL | `docs/product/DOMAIN_MODEL.md` | Entity schema validation, aggregate boundaries |
| WORKFLOW_MAP | `docs/product/WORKFLOW_MAP.md` | Platform admin journeys (WF-015 through WF-023) |
| ROLE_PERMISSION_MATRIX | `docs/product/ROLE_PERMISSION_MATRIX.md` | Auth middleware stack, admin permission levels |
| MODULE_MAP | `docs/product/MODULE_MAP.md` | Import boundary allowlist |

---

## Methodology

**Classification rules:**
- `*.test.ts` -> test
- `repos/*.schema.ts` -> entity
- `repos/*` -> repository
- `utils/*` -> utility
- `jobs/*` -> job
- All other `*.ts` -> controller

**Finding IDs:** `EF-M03-{hash8}` where hash is content-based (file + line + check type). Prior audit IDs preserved for continuity.

**Severity scale:**
- **blocker** -- Prevents correct operation or spec compliance; must fix before ship
- **warning** -- Spec divergence or quality issue; should fix
- **info** -- Style, convention, or optimization suggestion

**Delta tracking:** Files modified/added since 2026-05-27 marked with NEW/UPD in classification table.
