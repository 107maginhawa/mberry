# Module Specification: Platform Administration (M03)

---
oli_version: "Phase B -- Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Give the platform operations team full control over the multi-tenant platform: association provisioning, subscription billing, pricing, feature flags, analytics, impersonation, support tickets, and admin team management. Desktop only.

### Users
- Platform Administrator (Super, Admin, Support)

### Related Modules
- M01 Auth & Onboarding (admin authentication, MFA)
- M04 Org Admin (orgs created here, managed there)
- M05 Membership (member data visible via impersonation)
- M06 Dues & Payments (platform billing separate from org billing)
- M14 National Dashboard (cross-org analytics overlap)

### In Scope
- Association and organization provisioning
- Subscription billing management
- Pricing and plan management
- Feature flag management (module x tier matrix + per-org overrides)
- Platform dashboard (actionable items, not vanity metrics)
- Revenue dashboard and operator analytics
- Org health scoring
- User impersonation (read-only, 30-min, logged)
- Support ticket workflow with SLA
- Multi-admin role management (super, support, analyst)
- Platform-wide announcements
- Org lifecycle management (Trial -> Active -> Suspended -> Cancelled)
- Member account merge
- Data breach notification (DPA 2012)
- Data export/deletion processing

### Out of Scope
- Org-level settings (M04)
- Member dues collection (M06)
- Mobile layouts (desktop only)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Association | Top-level tenant organization. Has its own locale, currency, credit cycle config. |
| Organization | Operational unit within an association. Has org_type: chapter, society, national, clinic. |
| Platform Administrator | A Memberry employee or super-admin who manages the platform itself. Not affiliated with any association. |
| Feature Flag | Module-level toggle per tier or per org. |
| Monetization Tier | Subscription level: Free, Standard, Premium, Add-on. |
| Impersonation | Admin views platform as a specific user. Read-only, logged, 30-min limit. |
| Health Score | Automated 0-100 composite score measuring org activity, member engagement, payment health. |
| SLA | Service Level Agreement. First response within 4h, resolution within 24h (high) / 72h (standard). |

## 3. Workflows

| Workflow | WF-ID | Actor | Description | Priority |
|----------|-------|-------|-------------|----------|
| Onboard Association | WF-015 | Super Admin | Create association tenant with locale, license regex, credit config | P0 |
| Provision Organization | WF-016 | Super Admin | Create org within association, assign initial officer | P0 |
| Manage Subscriptions | WF-017 | Super Admin | Trial-to-paid conversion, payment management | P0 |
| Feature Flag Management | WF-018 | Super Admin | Module x tier matrix + per-org overrides | P0 |
| User Impersonation | WF-019 | Super/Support | View as user, read-only, 30-min | P0 |
| Support Ticket Resolution | WF-020 | Super/Support | Ticket inbox, SLA tracking, escalation | P0 |
| Revenue Dashboard | WF-021 | Super/Admin | MRR, ARR, churn, growth metrics | P0 |
| Admin Team Management | WF-022 | Super Admin | Invite/modify/remove platform admins | P0 |
| Org Suspension/Cancellation | WF-023 | Super/Admin | Admin suspends or cancels org | P0 |

## 4. Workflow Details

### Workflow: Onboard Association (WF-015)

Actor: Super Admin
Preconditions: Admin authenticated with MFA
Steps:
1. Admin opens /admin/associations/new.
2. Enters: name, country (ISO 3166-1), default currency (ISO 4217), locale settings.
3. Configures license format regex for member validation.
4. Sets credit cycle: period (1/2/3 years), required credits, carryover toggle.
5. Saves. Association created. Ready for org provisioning.

Exception Flows:
- Duplicate name: "Association with this name already exists."
- Invalid regex: "Invalid regular expression syntax."

Postconditions: Association tenant created. Organizations can be provisioned within it.

### Workflow: Provision Organization (WF-016)

Actor: Super Admin
Preconditions: Association exists, admin authenticated
Steps:
1. Admin selects association, clicks "Add Organization."
2. Enters: name, slug, org_type (chapter/society/national/clinic).
3. Assigns initial officer by email (existing member or invite sent).
4. Org created in Trial status. Onboarding wizard available for officer.

Exception Flows:
- Duplicate name within association: "Organization name already exists in this association."
- Duplicate slug globally: "This URL slug is already taken."
- Officer email not found: invitation sent automatically.

Postconditions: Org provisioned in Trial. OrganizationCreated event published. M01 onboarding state initialized.

### Workflow: User Impersonation (WF-019)

Actor: Platform Admin (Super or Support)
Preconditions: Admin authenticated with MFA
Steps:
1. Admin searches for member by name, email, or license number.
2. Clicks "View as [user name]."
3. Confirmation dialog: read-only, logged, 30-min limit.
4. Platform shows user's view with persistent orange banner.
5. Admin navigates. All pages logged with admin ID.
6. Admin clicks "Exit" or session auto-terminates at 30 minutes.

Exception Flows:
- User not found: "No user found."
- Impersonating another admin: blocked (M3-R5).
- Write attempt during impersonation: blocked at API level (M3-R4).
- 30-min timeout: auto-redirect to /admin.

Postconditions: Full navigation log in audit trail.

### Workflow: Feature Flag Management (WF-018)

Actor: Platform Admin (Super)
Preconditions: Admin authenticated
Steps:
1. Opens /admin/feature-flags. Matrix: modules (rows) x tiers (columns).
2. Toggles module for tier. Change immediate.
3. Per-org overrides section: search org, toggle modules.
4. Warning when disabling module with active data.

Exception Flows:
- Disabling M01 (Auth): blocked, always on.
- Override conflicts with tier: override takes precedence.

Postconditions: Feature flags updated. Affected orgs see/hide modules immediately.

### Workflow: Admin Team Management (WF-022)

Actor: Super Admin
Preconditions: Admin authenticated with MFA
Steps:
1. Opens /admin/team. List of all platform admins with roles.
2. Invite new admin: email, role (super/support/analyst).
3. Modify existing admin: change role, deactivate.
4. Remove admin: confirmation required.

Exception Flows:
- Removing last Super Admin: blocked (M3-R6).
- Downgrading last Super Admin: blocked (M3-R6).

Postconditions: Admin team updated. New admins receive email invitation.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| M3-R1 | IF impersonating THEN display orange banner on every page | Impersonation | Banner cannot be dismissed |
| M3-R2 | IF action during impersonation THEN log with admin ID and user ID | Impersonation | Dual-identity audit |
| M3-R3 | IF impersonation session > 30 min THEN auto-terminate | Impersonation | No extension without re-initiation |
| M3-R4 | IF write attempted during impersonation THEN block at API level | Impersonation | Not just UI -- API enforcement |
| M3-R5 | IF target is another admin THEN block impersonation | Impersonation | API-level block |
| M3-R6 | IF removing or downgrading last Super Admin THEN block | Admin team | System must always have >= 1 Super Admin |
| M3-R7 | IF platform admin THEN MFA mandatory | Admin accounts | Cannot disable MFA |
| M3-R8 | IF pricing changed THEN apply to new subscriptions only | Pricing | Existing subs keep current tier until renewal |
| M3-R9 | IF feature flag disabled THEN hide UI, preserve data | Feature flags | Re-enabling restores access |
| M3-R10 | IF org lifecycle transition THEN follow state machine | Org lifecycle | Only valid transitions allowed |
| M3-R11 | IF data breach THEN initiate notification within 72 hours | DPA compliance | Track timeline, alert on approaching deadline |
| M3-R12 | IF support ticket THEN first response within 4h, resolution within 24h (high) / 72h (standard) | Support | Auto-escalation on SLA breach |
| M3-R13 | IF admin action THEN log to immutable audit trail | All admin actions | Comprehensive audit |
| BR-10 | IF impersonation THEN read-only, logged, time-constrained | Impersonation | Global rule |
| BR-30 | IF platform billing THEN separate gateway from org member payments | Billing | No cross-contamination |

## 6. Permissions

> **Role taxonomy (Q1, AHA FIX-005/FIX-008):** the canonical admin tiers are the
> code enum `super | support | analyst` (`platformadmin/repos/platform-admin.schema.ts`
> `adminRoleEnum`). The former `admin` mid-tier is retired. Per Q8, `analyst` is
> **read-only** (analytics + all reads, no mutation, no impersonation). Enforced by
> `requireAdminTier` (`core/auth/admin-tier.ts`).

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| List/get admins | super, support, analyst | -- | PA (read) |
| Create/invite admin | super | support, analyst | PA |
| Remove admin | super | support, analyst | PA, subject to M3-R6 |
| Create org | super | support, analyst | PA |
| Transition org status | super | support, analyst | PA |
| Create/update association | super | support, analyst | PA |
| Delete association | super | support, analyst | PA |
| Feature flags | super | support, analyst | PA |
| Impersonation | super, support | analyst | PA, MFA required |
| View analytics | super, support, analyst | -- | PA (read) |
| Manage pricing | super | support, analyst | PA |
| Process data breach | super, support | analyst | PA |
| Support tickets (status/comment) | super, support | analyst | PA, analyst read-only |

## 7. Data Requirements

### Entity: Association

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| name | Yes | Association name | Unique globally |
| countryCode | Yes | Country | ISO 3166-1 alpha-2 |
| currency | Yes | Default currency | ISO 4217 |
| localeSettings | No | Locale config | JSONB |
| licenseFormatRegex | Yes | License validation pattern | Valid regex, tested on save |
| creditCyclePeriod | Yes | 1, 2, or 3 years | Enum |
| creditCycleRequired | Yes | Required credits per cycle | Integer > 0 |
| carryoverEnabled | Yes | Excess credit carryover | Boolean, default false |

### Entity: Organization

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| associationId | Yes | Association FK | -- |
| name | Yes | Org name | Unique within association |
| slug | Yes | URL-friendly name | Unique globally |
| orgType | Yes | chapter/society/national/clinic | Enum |
| status | Yes | trial/active/suspended/cancelled | Enum, state machine (M3-R10) |
| healthScore | No | Automated 0-100 score | Computed, cached hourly |
| trialExpiresAt | No | Trial end date | Set on creation |

### Entity: FeatureFlag

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| moduleName | Yes | Module identifier | e.g., M01, M02, ... |
| targetType | Yes | tier or org | Enum |
| targetId | Yes | Tier ID or Org ID | UUID |
| enabled | Yes | Toggle state | Boolean |

### Entity: Subscription

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| organizationId | Yes | Org FK | -- |
| tier | Yes | free/standard/premium | Enum |
| status | Yes | trial/active/pastDue/cancelled | Enum |
| currentPeriodEnd | Yes | Billing period end | Date |
| externalId | No | Stripe subscription ID | -- |

### Entity: ImpersonationSession

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| adminId | Yes | Admin person FK | -- |
| targetPersonId | Yes | Impersonated person FK | Cannot be admin (M3-R5) |
| startedAt | Yes | Session start | -- |
| expiresAt | Yes | startedAt + 30 min | Auto-terminate (M3-R3) |
| endedAt | No | Actual end time | Set on exit or timeout |
| navigationLog | No | Pages visited | JSONB array |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Association | Organization | LocaleSettings | Name unique globally. At least 1 org to be operational. |
| Organization | FeatureFlag (per-org), Subscription | -- | Name unique within association. Status follows state machine. |
| PlatformAdmin | ImpersonationSession | -- | At least 1 Super Admin always (M3-R6). |

Rules:
- Association is the tenant boundary. All orgs belong to exactly one association.
- Organization status transitions are enforced at aggregate level.
- PlatformAdmin is separate from Person -- admin roles are platform-scoped, not org-scoped.

## 8. State Transitions

### Org Lifecycle
```txt
Trial --> Active (payment confirmed or admin action)
Trial --> Cancelled (trial expired, no conversion)
Active --> Suspended (admin action or payment failure)
Active --> Cancelled (admin action)
Suspended --> Active (reactivation within 90 days)
Suspended --> Cancelled (admin action or 90 days elapsed)
Cancelled --> (data preserved 90 days, then eligible for deletion)
```

Rules:
- Only valid transitions allowed (M3-R10).
- Suspension preserves all data. Members see "Organization suspended" message.
- Cancellation starts 90-day data retention countdown.
- Reactivation from Suspended restores full access immediately.

### Subscription Lifecycle
```txt
Trial --> Active (payment recorded)
Trial --> Cancelled (trial expired)
Active --> PastDue (payment failed)
Active --> Cancelled (admin action)
PastDue --> Active (payment recovered)
PastDue --> Cancelled (grace exhausted)
```

## 9. UI/UX Requirements

### Screen: Platform Dashboard (/admin)
Purpose: Actionable items first, vanity metrics secondary
Users: All platform admins
Components: Actionable cards (pending setup, tickets, payment failures, expiring trials), stat cards (associations, orgs, members, MRR), activity feed
States:
- Loading: skeleton
- AllClear: "No items requiring attention" empty state
- Success: cards sorted by urgency
- PermissionError: redirect to login
- UnexpectedError: refresh banner

### Screen: Feature Flags (/admin/feature-flags)
Purpose: Module x tier matrix with per-org overrides
Users: Super Admin, Admin
Components: Matrix table with toggles, org search for overrides, warning dialogs
States:
- Loading: skeleton
- Default: current state matrix
- Warning: disabling with active data shows affected org count
- PermissionError: read-only view for support
- UnexpectedError: revert toggle, retry prompt

### Screen: Impersonation (/admin/impersonate)
Purpose: View platform as a specific user
Users: Super Admin, Support
Components: User search (name/email/license), confirmation dialog, orange banner overlay
States:
- Search: default search input
- Active: orange banner persistent, "Exit" button, timer countdown
- Timeout: auto-redirect to /admin
- Blocked: "Cannot impersonate other administrators"
- UnexpectedError: exit impersonation, return to /admin

### Screen: Admin Team (/admin/team)
Purpose: Manage platform admin accounts
Users: Super Admin
Components: Admin list (name, role, last active), invite form, role selector
States:
- Loading: skeleton
- Default: admin list
- InviteSent: toast confirmation
- BlockedRemoval: "Cannot remove the last Super Admin"
- PermissionError: hidden invite/remove buttons for non-super

## 10. API Expectations

**TypeSpec Coverage:** PARTIAL. `handlers/platformadmin/` (40 handlers) has TypeSpec coverage via `specs/api/src/modules/platformadmin.tsp` for core CRUD (associations, orgs, admin team, impersonation, feature flags). Analytics endpoints (revenue dashboard, org health) and some support ticket operations have spec coverage gaps. 21 of 40 handlers are TypeSpec-covered.

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /admin/associations | Create association | name, country, config | associationId | 409 duplicate |
| GET /admin/associations | List associations | filters, pagination | associations[] | -- |
| PUT /admin/associations/:id | Update association | fields to update | updated association | 400 validation |
| DELETE /admin/associations/:id | Delete association | -- | -- | 409 has active orgs |
| POST /admin/associations/:id/orgs | Create org | name, slug, type, officerEmail | orgId | 409 duplicate |
| PUT /admin/orgs/:id/status | Transition org status | newStatus | updated org | 400 invalid transition |
| PUT /admin/feature-flags | Toggle flag | moduleName, targetType, targetId, enabled | updated flag | 400 M01 blocked |
| GET /admin/feature-flags | Get flag matrix | -- | flags[] | -- |
| POST /admin/impersonate | Start impersonation | targetPersonId | sessionToken, expiresAt | 403 target is admin |
| DELETE /admin/impersonate | End impersonation | -- | -- | -- |
| GET /admin/analytics/revenue | Revenue dashboard | dateRange, filters | MRR, ARR, churn data | -- |
| GET /admin/analytics/health | Org health scores | filters | orgHealthScores[] | -- |
| POST /admin/team/invite | Invite admin | email, role | adminId | 409 duplicate |
| PUT /admin/team/:id/role | Change admin role | newRole | updated admin | 400 last super (M3-R6) |
| DELETE /admin/team/:id | Remove admin | -- | -- | 400 last super (M3-R6) |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| AssociationCreated | New association provisioned | associationId, country, licenseFormatRegex | -- |
| OrganizationCreated | New org provisioned | orgId, associationId, orgType | M01 (onboarding), M04 |
| OrgStatusTransitioned | Lifecycle state change | orgId, oldStatus, newStatus | M04, M05, M07 |
| FeatureFlagChanged | Module toggle | moduleName, targetType, targetId, enabled | All modules |
| ImpersonationStarted | Admin starts impersonation | adminId, targetPersonId, expiresAt | Audit |
| ImpersonationEnded | Admin ends impersonation | adminId, targetPersonId, duration, reason | Audit |
| AdminInvited | New admin invited | adminId, role, invitedBy | -- |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| PaymentRecorded | M06 | Update subscription status | Trial -> Active if applicable |
| PersonAnonymized | M02 | Cleanup references | Remove from support ticket assignments |

## 11. Acceptance Criteria

### AC-M03-001: Impersonation
Given admin initiates impersonation,
When session active,
Then orange banner on every page, all navigation logged, no writes permitted, auto-terminate at 30 minutes.

### AC-M03-002: Feature Flag Disable Warning
Given admin disables module for tier with orgs having active data,
When toggle switched off,
Then warning shows affected org count, module hidden after confirmation, data preserved.

### AC-M03-003: Dashboard Actionable Items
Given pending tasks exist,
When dashboard loads,
Then each actionable item as card with count, description, direct link, sorted by urgency.

### AC-M03-004: Last Super Admin Protection
Given last Super Admin attempts removal or role downgrade,
When action confirmed,
Then blocked with "Cannot remove the last Super Admin."

### AC-M03-005: Org Lifecycle Enforcement
Given an org in Trial status,
When admin attempts to transition to Suspended,
Then transition is rejected with "Invalid status transition" (Trial can only go to Active or Cancelled).

### AC-M03-006: MFA Mandatory
Given a platform admin account,
When admin attempts to disable MFA,
Then the action is blocked with "MFA is mandatory for platform administrators" (M3-R7).

### AC-M03-007: Impersonation Write Block
Given an admin is in an active impersonation session,
When a POST/PUT/DELETE request is made,
Then the API returns 403 with "Write operations are not permitted during impersonation" (M3-R4).

## 12. Test Expectations

Required tests:
- Impersonation: orange banner, read-only enforcement at API level, 30-min timeout, admin-to-admin blocked
- Feature flags: matrix toggle, per-org override, M01 always-on, data preservation on disable
- Org lifecycle: valid transitions only, invalid transitions rejected (state machine)
- Last Super Admin: cannot remove or downgrade (M3-R6)
- SLA tracking: auto-escalation on breach (M3-R12)
- MFA mandatory for all platform admins (M3-R7)
- Association CRUD: create, update, delete (blocked with active orgs)
- Org provisioning: create with officer assignment, slug uniqueness
- Pricing: changes apply to new subs only (M3-R8)
- Admin team: invite, role change, removal

## 13. Edge Cases

- Impersonation network drop: banner shows "reconnecting", then auto-exit.
- Feature flag conflict: per-org override wins over tier setting (M3-R9).
- Org with zero activity: health score 0, flagged for outreach.
- Pricing tier with active subscribers deleted: migration to next tier at renewal (M3-R8).
- Breach notification at 71 hours: red alert on dashboard (M3-R11).
- Two admins impersonating the same user simultaneously: both sessions allowed, independently tracked.
- Association deletion with active orgs: blocked, must cancel all orgs first.
- Org reactivation after 90 days suspended: blocked, must create new org.
- Support admin attempts feature flag change: blocked by permissions.

## 14. Dependencies

### Internal Dependencies
- M01 Auth & Onboarding (admin authentication, MFA enforcement)
- M04 Org Admin (orgs provisioned here, managed there)
- M06 Dues & Payments (subscription payment events)

### External Dependencies
- Payment gateway (platform billing -- separate from org gateways per BR-30)
- Email service (admin invitations, announcements, breach notifications)
- Audit logging service (immutable trail per M3-R13)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Duplicate association | Block creation | "Association with this name already exists." |
| Invalid license regex | Block save | "Invalid regular expression syntax." |
| Impersonation target is admin | Block | "Cannot impersonate other administrators." |
| Feature flag toggle fails | Revert toggle | "Could not update. Try again." |
| Export too large | Suggest filters | "Data set too large. Narrow date range." |
| Invalid org transition | Block | "Invalid status transition from [current] to [target]." |
| Last Super Admin removal | Block | "Cannot remove the last Super Admin." |
| Write during impersonation | Block at API | "Write operations are not permitted during impersonation." |
| Duplicate slug | Block creation | "This URL slug is already taken." |

## 16. Performance Expectations

- Expected data volume: 100s of associations, 1000s of orgs
- Expected concurrent users: 10-20 platform admins
- Acceptable response times: Dashboard < 2s, analytics < 5s, feature flag toggle < 500ms
- Caching requirements: Health scores cached, refreshed hourly; feature flag matrix cached with 1-min invalidation

## 17. Observability Hooks

Structured log events:

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| admin.impersonation.started | WARN | Session begins | adminId, targetId | No |
| admin.impersonation.ended | INFO | Session ends | adminId, targetId, duration, reason | No |
| admin.impersonation.write_blocked | WARN | Write attempt during impersonation | adminId, targetId, endpoint | No |
| admin.org.created | INFO | Org provisioned | orgId, associationId, type | No |
| admin.org.status_changed | INFO | Lifecycle transition | orgId, oldStatus, newStatus | No |
| admin.association.created | INFO | Association created | associationId, country | No |
| admin.feature_flag.changed | INFO | Flag toggled | module, target, enabled | No |
| admin.ticket.sla_breach | ERROR | SLA exceeded | ticketId, slaType, elapsed | No |
| admin.team.invited | INFO | Admin invited | adminId, role | No |
| admin.team.removed | WARN | Admin removed | adminId, removedBy | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| admin_impersonation_duration_seconds | histogram | -- | Session duration |
| admin_impersonation_total | counter | outcome | Impersonation count |
| admin_ticket_sla_compliance | gauge | priority | SLA compliance rate |
| platform_mrr_cents | gauge | -- | Monthly recurring revenue |
| admin_orgs_by_status | gauge | status | Org count by lifecycle status |
| admin_feature_flag_changes_total | counter | module | Flag change count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| admin_health_scoring_enabled | release | true | Org health score computation | -- |
| admin_breach_workflow_enabled | ops | true | DPA breach notification workflow | -- |
| admin_account_merge_enabled | release | false | Member account merge tool | -- |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M03-S1 | Association CRUD | Create/read/update associations | M01 | P0 |
| M03-S2 | Organization Provisioning | Create orgs, assign officers, slug | M03-S1 | P0 |
| M03-S3 | Feature Flag Matrix | Module x tier toggles + per-org overrides | M03-S1 | P0 |
| M03-S4 | Platform Dashboard | Actionable items + stat cards | M03-S1, M03-S2 | P0 |
| M03-S5 | Impersonation | Read-only user view with audit | M03-S2 | P0 |
| M03-S6 | Support Tickets | Inbox, SLA, escalation | M03-S4 | P0 |
| M03-S7 | Revenue Dashboard | MRR, ARR, churn analytics | M03-S1 | P0 |
| M03-S8 | Admin Team Management | Invite/modify/remove admins | M03-S1 | P0 |
| M03-S9 | Org Lifecycle | State machine transitions | M03-S2 | P0 |
| M03-S10 | Subscription Management | Trial-to-paid, payment tracking | M03-S2 | P0 |

## 20. AI Instructions

When implementing this module:
1. **Admin levels**: Platform admin roles are `super`, `admin`, `support` (from types/auth.ts AdminLevel). These are platform-scoped, not org-scoped.
2. **Desktop only**: No mobile responsive layouts needed. Admin app runs on port 3003.
3. **Impersonation enforcement**: Write blocks MUST be at API level (M3-R4), not just UI. Use middleware that checks for active impersonation session.
4. **Separate billing gateway**: Platform subscription billing uses a separate Stripe account from org member payments (BR-30). No cross-contamination.
5. **Spec-first**: Define TypeSpec first, generate OpenAPI + types, then implement handlers. See `services/api-ts/src/handlers/platformadmin/` for existing handler reference.
6. **Handler pattern**: Router -> Validators -> Handlers -> Repositories. Existing platformadmin handlers at `services/api-ts/src/handlers/platformadmin/`.
7. **Vertical slices**: Start with M03-S1 (Association CRUD) and M03-S2 (Org Provisioning) as foundation.
8. **State machine enforcement**: Org lifecycle transitions must be validated against the state machine (M3-R10). Invalid transitions return 400.
9. **Audit everything**: All admin actions logged to immutable audit trail (M3-R13). Use the existing audit module.
10. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | -- |
| 2. Domain Terms | COMPLETE | Added Health Score and SLA terms |
| 3. Workflows | COMPLETE | Aligned with WORKFLOW_MAP.md WF-015 through WF-023 |
| 4. Workflow Details | COMPLETE | Added WF-015, WF-016, WF-022 details |
| 5. Business Rules | COMPLETE | 15 rules including BR-10, BR-30 |
| 6. Permissions | COMPLETE | Expanded from ROLE_PERMISSION_MATRIX.md with admin CRUD |
| 7. Data Requirements | COMPLETE | Added Subscription and ImpersonationSession entities |
| 7b. Aggregate Boundaries | COMPLETE | From DOMAIN_MODEL.md |
| 8. State Transitions | COMPLETE | Added Subscription lifecycle |
| 9. UI/UX Requirements | COMPLETE | Added all required states |
| 10. API Expectations | COMPLETE | Expanded with CRUD endpoints and admin team |
| 10b. Domain Events | COMPLETE | Added ImpersonationStarted/Ended, AdminInvited |
| 11. Acceptance Criteria | COMPLETE | 7 ACs in Given/When/Then |
| 12. Test Expectations | COMPLETE | -- |
| 13. Edge Cases | COMPLETE | -- |
| 14. Dependencies | COMPLETE | -- |
| 15. Error Handling | COMPLETE | Added impersonation write block, slug duplicate |
| 16. Performance Expectations | COMPLETE | Added flag toggle timing |
| 17. Observability Hooks | COMPLETE | Added write_blocked, status_changed, team events |
| 18. Feature Flags | COMPLETE | Added account_merge_enabled flag |
| 19. Vertical Slice Plan | COMPLETE | Added M03-S10 Subscription Management |
| 20. AI Instructions | COMPLETE | Enhanced with platform admin specifics |
| 21. Section Completeness | COMPLETE | -- |
| 22. Downstream Impact | COMPLETE | -- |

## 22. Downstream Impact

- **M01**: Consumes OrganizationCreated event to initialize onboarding wizard state. Association licenseFormatRegex used for registration validation.
- **M04**: Depends on OrganizationCreated and OrgStatusTransitioned events. Org settings management starts after provisioning here.
- **M05**: OrgStatusTransitioned affects membership access. Suspended org means members lose feature access.
- **M07**: OrgStatusTransitioned triggers member notifications about org status changes.
- **All modules**: FeatureFlagChanged event controls module visibility per org. Disabling a flag hides UI but preserves data (M3-R9).
- **M06**: Platform billing is separate from org billing (BR-30). Subscription payment events consumed here.
