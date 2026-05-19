# Module Specification: Platform Administration (M03)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Give the platform operations team full control over the multi-tenant platform: association provisioning, subscription billing, pricing, feature flags, analytics, impersonation, support tickets, and admin team management. Desktop only.

### Users
- Platform Administrator (Super, Support, Analyst)

### Related Modules
- M01 Auth & Onboarding (admin authentication)
- M04 Org Admin (orgs created here, managed there)
- M05 Membership (member data visible via impersonation)
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
- Multi-admin role management
- Platform-wide announcements
- Org lifecycle management (Trial → Active → Suspended → Cancelled)
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
| Platform Administrator | Memberry employee/super-admin. Not affiliated with any association. |
| Feature Flag | Module-level toggle per tier or per org. |
| Monetization Tier | Subscription level: Free, Standard, Premium, Add-on. |
| Impersonation | Admin views platform as a specific user. Read-only, logged, 30-min limit. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Onboard Association | Super Admin | Create association tenant with locale, license regex, credit config | P0 |
| Provision Organization | Super Admin | Create org within association, assign initial officer | P0 |
| Manage Subscriptions | Super Admin | Trial-to-paid conversion, payment management | P0 |
| Feature Flag Management | Super Admin | Module x tier matrix + per-org overrides | P0 |
| User Impersonation | Super/Support | View as user, read-only, 30-min | P0 |
| Support Ticket Resolution | Super/Support | Ticket inbox, SLA tracking, escalation | P0 |
| Revenue Dashboard | Super/Analyst | MRR, ARR, churn, growth metrics | P0 |
| Admin Team Management | Super Admin | Invite/modify/remove platform admins | P0 |

## 4. Workflow Details

### Workflow: User Impersonation (PA-6)

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
- Impersonating another admin: blocked.
- Write attempt during impersonation: blocked at API level.
- 30-min timeout: auto-redirect to /admin.

Postconditions: Full navigation log in audit trail.

### Workflow: Feature Flag Management (PA-5)

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

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| M3-R1 | IF impersonating THEN display orange banner on every page | Impersonation | Banner cannot be dismissed |
| M3-R2 | IF action during impersonation THEN log with admin ID and user ID | Impersonation | Dual-identity audit |
| M3-R3 | IF impersonation session > 30 min THEN auto-terminate | Impersonation | No extension without re-initiation |
| M3-R4 | IF write attempted during impersonation THEN block at API level | Impersonation | Not just UI — API enforcement |
| M3-R5 | IF target is another admin THEN block impersonation | Impersonation | API-level block |
| M3-R6 | IF removing last Super Admin THEN block | Admin team | System must always have >= 1 Super Admin |
| M3-R7 | IF platform admin THEN MFA mandatory | Admin accounts | Cannot disable MFA |
| M3-R8 | IF pricing changed THEN apply to new subscriptions only | Pricing | Existing subs keep current tier until renewal |
| M3-R9 | IF feature flag disabled THEN hide UI, preserve data | Feature flags | Re-enabling restores access |
| M3-R10 | IF org lifecycle transition THEN follow state machine | Org lifecycle | Trial→Active→Suspended→Cancelled |
| M3-R11 | IF data breach THEN initiate within 72 hours | DPA compliance | Track timeline, alert on approaching deadline |
| M3-R12 | IF support ticket THEN first response within 4h, resolution within 24h (high) / 72h (standard) | Support | Auto-escalation on breach |
| M3-R13 | IF admin action THEN log to immutable audit trail | All admin actions | Comprehensive audit |
| BR-10 | IF impersonation THEN read-only, logged, constrained | Impersonation | Global rule |
| BR-30 | IF platform billing THEN separate gateway from org member payments | Billing | No cross-contamination |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| List/get admins | super, admin, support | analyst | PA |
| Create org | super, admin | support, analyst | PA |
| Transition org status | super, admin | support, analyst | PA |
| Create/update association | super, admin | support, analyst | PA |
| Delete association | super | All others | PA |
| Feature flags | super, admin | support, analyst | PA |
| Impersonation | super | support (read-only dashboards) | PA |
| View analytics | super, admin, support, analyst | — | PA |

## 7. Data Requirements

### Entity: Association

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | — |
| name | Yes | Association name | Unique |
| countryCode | Yes | Country | ISO 3166-1 |
| currency | Yes | Default currency | ISO 4217 |
| localeSettings | No | Locale config | JSONB |
| licenseFormatRegex | Yes | License validation pattern | Valid regex |
| creditCyclePeriod | Yes | 1, 2, or 3 years | Enum |
| creditCycleRequired | Yes | Required credits per cycle | Integer |
| carryoverEnabled | Yes | Excess credit carryover | Boolean |

### Entity: Organization

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | — |
| associationId | Yes | Association FK | — |
| name | Yes | Org name | Unique within association |
| slug | Yes | URL-friendly name | Unique globally |
| orgType | Yes | chapter/society/national/clinic | Enum |
| status | Yes | trial/active/suspended/cancelled | Enum, state machine |
| healthScore | No | Automated 0-100 score | Computed |

### Entity: FeatureFlag

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | — |
| moduleName | Yes | Module identifier | — |
| targetType | Yes | tier or org | — |
| targetId | Yes | Tier ID or Org ID | — |
| enabled | Yes | Toggle state | Boolean |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Association | Organization | LocaleSettings | Name unique globally |
| Organization | FeatureFlag (per-org), Subscription | — | Name unique within association |
| PlatformAdmin | ImpersonationSession | — | At least 1 Super Admin always |

## 8. State Transitions

### Org Lifecycle
```txt
Trial → Active (payment confirmed)
Trial → Cancelled (trial expired, no conversion)
Active → Suspended (admin action or payment failure)
Active → Cancelled (admin action)
Suspended → Active (reactivation within 90 days)
Suspended → Cancelled (admin action)
Cancelled → (data preserved 90 days, then eligible for deletion)
```

## 9. UI / UX Requirements

### Screen: Platform Dashboard (/admin)
Purpose: Actionable items first, vanity metrics secondary
Users: All platform admins
Components: Actionable cards (pending setup, tickets, payment failures, expiring trials), stat cards (associations, orgs, members, MRR), activity feed
States: Loading (skeleton), All clear ("No items requiring attention"), Error (refresh banner)

### Screen: Feature Flags (/admin/feature-flags)
Purpose: Module x tier matrix with per-org overrides
Users: Super Admin
Components: Matrix table with toggles, org search for overrides, warning dialogs
States: Loading, Default (current state), Warning (disabling with active data)

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /admin/associations | Create association | name, country, config | associationId | 409 duplicate |
| POST /admin/associations/:id/orgs | Create org | name, type, officerEmail | orgId | 409 duplicate |
| PUT /admin/feature-flags | Toggle flag | moduleName, targetType, targetId, enabled | updated flag | 400 M01 blocked |
| POST /admin/impersonate | Start impersonation | targetPersonId | sessionToken | 403 target is admin |
| GET /admin/analytics/revenue | Revenue dashboard | dateRange, filters | MRR, ARR, churn data | — |
| PUT /admin/orgs/:id/status | Transition org status | newStatus | updated org | 400 invalid transition |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| AssociationCreated | New association provisioned | associationId, country | — |
| OrganizationCreated | New org provisioned | orgId, associationId, type | M01 (onboarding), M04 |
| OrgStatusTransitioned | Lifecycle state change | orgId, oldStatus, newStatus | M04, M05, M07 |
| FeatureFlagChanged | Module toggle | moduleName, targetType, targetId, enabled | All modules |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| PaymentRecorded | M06 | Update subscription status | Trial→Active if applicable |

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
Given last Super Admin attempts removal,
When action confirmed,
Then blocked with "Cannot remove the last Super Admin."

## 12. Test Expectations

Required tests:
- Impersonation: orange banner, read-only enforcement at API level, 30-min timeout, admin-to-admin blocked
- Feature flags: matrix toggle, per-org override, M01 always-on, data preservation on disable
- Org lifecycle: valid transitions only, invalid transitions rejected
- Last Super Admin: cannot remove or downgrade
- SLA tracking: auto-escalation on breach
- MFA mandatory for all platform admins

## 13. Edge Cases

- Impersonation network drop: banner shows "reconnecting", then auto-exit.
- Feature flag conflict: per-org override wins over tier setting.
- Org with zero activity: health score 0, flagged for outreach.
- Pricing tier with active subscribers deleted: migration to next tier at renewal.
- Breach notification at 71 hours: red alert on dashboard.

## 14. Dependencies

### Internal Dependencies
- M01 Auth & Onboarding (admin authentication, MFA)
- M04 Org Admin (orgs provisioned here, managed there)

### External Dependencies
- Payment gateway (platform billing — separate from org gateways)
- Email service (admin invitations, announcements)
- Audit logging service

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Duplicate association | Block creation | "Association with this name already exists." |
| Invalid license regex | Block save | "Invalid regular expression syntax." |
| Impersonation target is admin | Block | "Cannot impersonate other administrators." |
| Feature flag toggle fails | Revert toggle | "Could not update. Try again." |
| Export too large | Suggest filters | "Data set too large. Narrow date range." |

## 16. Performance Expectations

- Expected data volume: 100s of associations, 1000s of orgs
- Expected concurrent users: 10-20 platform admins
- Acceptable response times: Dashboard < 2s, analytics < 5s
- Caching requirements: Health scores cached, refreshed hourly

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| admin.impersonation.started | WARN | Session begins | adminId, targetId | No |
| admin.impersonation.ended | INFO | Session ends | adminId, targetId, duration, reason | No |
| admin.org.created | INFO | Org provisioned | orgId, associationId, type | No |
| admin.feature_flag.changed | INFO | Flag toggled | module, target, enabled | No |
| admin.ticket.sla_breach | ERROR | SLA exceeded | ticketId, slaType | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| admin_impersonation_duration_seconds | histogram | — | Session duration |
| admin_ticket_sla_compliance | gauge | priority | SLA compliance rate |
| platform_mrr_cents | gauge | — | Monthly recurring revenue |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| admin_health_scoring_enabled | release | true | Org health score computation | — |
| admin_breach_workflow_enabled | ops | true | DPA breach notification workflow | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M03-S1 | Association CRUD | Create/read/update associations | M01 | P0 |
| M03-S2 | Organization Provisioning | Create orgs, assign officers | M03-S1 | P0 |
| M03-S3 | Feature Flag Matrix | Module x tier toggles | M03-S1 | P0 |
| M03-S4 | Platform Dashboard | Actionable items + metrics | M03-S1, M03-S2 | P0 |
| M03-S5 | Impersonation | Read-only user view | M03-S2 | P0 |
| M03-S6 | Support Tickets | Inbox, SLA, escalation | M03-S4 | P0 |
| M03-S7 | Revenue Dashboard | MRR, ARR, churn analytics | M03-S1 | P0 |
| M03-S8 | Admin Team Management | Invite/modify/remove admins | M03-S1 | P0 |
| M03-S9 | Org Lifecycle | State machine transitions | M03-S2 | P0 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
