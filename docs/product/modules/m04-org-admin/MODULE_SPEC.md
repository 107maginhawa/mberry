# Module Specification: Organization Admin (M04)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Officers manage their organization's profile, team, operational configuration, and public presence. Administrative backbone that all other org-scoped modules depend on.

### Users
- President, Vice President, Secretary, Treasurer, Officers
- Platform Administrator (super, admin)

### Related Modules
- M01 Auth & Onboarding (authentication), M03 Platform Admin (org provisioning)
- M05 Membership (member roster depends on org admin), M06 Dues & Payments (fund config)
- M12 Elections & Governance (officer transitions via election results)
- M14 National Dashboard (org analytics), M19 Committee Management (org admin)

### In Scope
- Org type designation, org profile management, org dashboard with smart action cards
- Officer role management (assign/remove), officer transition with checklist
- Disciplinary actions (warn/suspend/remove/probation), org public page
- Invite a chapter, admin referral incentive, engagement analytics, benchmarking
- Position management, officer term lifecycle

### Out of Scope
- Membership lifecycle (M05), dues collection (M06), election execution (M12)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Organization | Operational unit within an association. Types: chapter, society, national, clinic. |
| Officer | Member with administrative role assigned via officer_term. |
| President | Org governance leader. Assigns roles, handles disciplinary actions. |
| Position | Governance position definition (president, vice-president, secretary, treasurer, board-member, officer, staff). Referenced by officer_term. |
| Officer Term | Time-bounded role assignment for org governance. Status: upcoming, active, completed, resigned, removed. |
| Org Public Page | Publicly visible URL showing org profile, officers, "Apply to Join." |
| Disciplinary Action | Formal officer action against a member: warning, suspension, removal, or probation. Immutable once created. |
| Transition Checklist | Role-specific checklist items generated during officer handover. Status: pending, completed. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-024: Org Settings | Officer | Update org profile, logo, branding, public page | P0 |
| WF-025: Officer Transition | President | Assign/transfer officer roles with handoff checklist | P0 |
| WF-026: Disciplinary Action | President | Suspend/remove member with mandatory reason | P0 |
| WF-027: Org Dashboard | Officer | Smart action cards, key metrics | P0 |
| WF-028: Org Public Page | Public | Visible profile with "Apply to Join" | P0 |
| Invite Chapter | Officer | Referral with social proof | P1 |

## 4. Workflow Details

### Workflow: Officer Transition (WF-025)

Actor: President
Preconditions: Current officer exists, new officer identified
Steps:
1. President opens /org/[id]/officer/officers.
2. System generates role-specific checklist (pending applications, payments, events).
3. Outgoing officer completes each item with notes.
4. When 100% complete (or President override with reason), role transferred.
5. New officer gets admin access. Old officer becomes regular member. Audit logged.

Exception Flows:
- Outgoing officer unavailable: President overrides with documented reason.
- Accidental transfer: new president can reverse within 24 hours.
- President role reassignment: National Admin or Platform Admin must perform (BR-09).

Postconditions: Role transferred. All data persists. Members notified.

### Workflow: Disciplinary Action (WF-026)

Actor: President
Preconditions: Member exists in org
Steps:
1. Selects member and action type (warning/suspension/removal/probation).
2. Enters reason (mandatory, non-empty).
3. Confirms action.
4. Status updated. Member notified with reason. Action logged.

Postconditions: Immutable audit log entry. Member's access adjusted per action type.

### Workflow: Org Settings (WF-024)

Actor: Officer (any)
Preconditions: Org exists, officer has active term
Steps:
1. Navigate to org settings page.
2. Edit fields: name, description, logo, contact email, meeting schedule.
3. Save. System validates and persists.
4. Public page updated if visibility enabled.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-09 | IF assigning officer role THEN only President can assign; one person per role per org; no dual roles in same org | Role assignment | Block duplicate role assignment; 403 for non-president |
| BR-09e | IF President role needs reassignment THEN National Admin or Platform Admin must perform | President reassignment | President cannot self-reassign |
| BR-29 | IF org exists THEN public page at /org/[slug] | Public page | Configurable visibility |
| BR-31 | IF SVG uploaded THEN validate by magic bytes, sanitize (strip scripts, event handlers, external refs) | Logo security | Not just extension check |
| M4-R1 | IF assigning officer role THEN one per role (except Board Member allows multiple) | Role assignment | Block duplicate role assignment |
| M4-R2 | IF assigning/removing officer THEN only President can do it | Role management | API returns 403 for others |
| M4-R3 | IF officer transition THEN checklist required before transfer | Transition | Role-specific items auto-generated |
| M4-R4 | IF disciplinary action THEN reason required and action immutable. Original disciplinary action and reason are immutable after creation. Override is recorded as a separate audit event with its own reason, not an edit of the original. | Discipline | Warning: no access change. Suspension: lose org features. Removal: terminate membership. Probation: restricted. |
| M4-R5 | IF SVG uploaded as logo THEN sanitize per BR-31 | Logo upload | Strip scripts, event handlers, external refs |
| M4-R6 | IF officer action THEN log to immutable audit trail | All actions | Actor, timestamp, before/after state, IP |
| M4-R7 | IF officer role in org A THEN no effect on org B | Cross-org | Independent per org |

## 6. Permissions

From ROLE_PERMISSION_MATRIX Section 3.2 (Association:Member Module — governance subset):

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| List members | super, admin, support, president, VP, secretary, treasurer, board-member, officer, staff, member (R) | user | GA+OA |
| Governance mutations | super, admin, president (2FA) | All others | GA+HG |
| View org public page | Public (no auth) | -- | Public route |
| Edit org profile | super, admin, president (2FA) | All others | GA+HG |
| Import roster | super, admin, president (2FA), secretary (2FA) | All others | GA+HG |

## 7. Data Requirements

### Entity: Organization

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | Auto-generated |
| associationId | Yes | Parent association FK | -- |
| name | Yes | Org name | 2-100 chars |
| slug | Yes | URL-friendly name | Unique, auto-generated |
| orgType | Yes | chapter/society/national/clinic | Set at creation, not editable |
| description | No | Org description | Max 2,000 chars |
| logoUrl | No | Logo image URL | SVG sanitized per BR-31 |
| contactEmail | No | Contact email | Standard validation |
| meetingSchedule | No | Free text | E.g., "Every 2nd Tuesday, 7PM" |
| foundingDate | No | Founded date | Must not be future |
| featureFlags | No | JSONB feature toggles | Quick-check flags |

### Entity: Position

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | -- |
| organizationId | Yes | Organization FK | -- |
| title | Yes | Position title | president, vice-president, secretary, treasurer, board-member, officer, staff |
| isElected | Yes | Whether filled by election | Boolean |

### Entity: OfficerTerm

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| id | Yes | UUID PK | -- |
| positionId | Yes | Position FK | -- |
| personId | Yes | Person FK (the officer) | -- |
| organizationId | Yes | Organization FK | -- |
| status | Yes | upcoming/active/completed/resigned/removed | Enum: term_status |
| startDate | Yes | Term start | -- |
| endDate | No | Term end | -- |
| assignedBy | Yes | Assigning officer person ID | -- |

### Entity: DisciplinaryAction

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Organization FK | -- |
| personId | Yes | Target member | -- |
| actionType | Yes | warning/suspension/removal/probation | Enum: disciplinary_action_type |
| reason | Yes | Reason text | Non-empty, mandatory |
| performedBy | Yes | Acting officer | Must be President |

### Entity: TransitionChecklist

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| officerTermId | Yes | OfficerTerm FK | -- |
| status | Yes | pending/completed | Enum: transition_checklist_status |
| items | Yes | Checklist items JSONB | Role-specific auto-generated |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Organization | Position, OfficerTerm, DisciplinaryAction, TransitionChecklist, DirectoryProfile, ChapterAffiliation, RoyaltySplit | Address | Slug unique. One active officer per position (except Board Member). |

## 8. State Transitions

### Organization Lifecycle (DOMAIN_MODEL 13a)
```txt
active → suspended (platform admin action)
suspended → active (platform admin restores)
active → archived (platform admin archives)
```

### Officer Term (term_status enum)
```txt
upcoming → active (term start date reached)
active → completed (term end date or transition)
active → resigned (officer voluntarily resigns)
active → removed (president removes officer)
```

### Disciplinary Action
```txt
(No state machine — immutable record created once)
```

## 9. UI / UX Requirements

### Screen: Org Dashboard (/org/[id]/officer/dashboard)
Purpose: Officer home with smart action cards
Users: All officers
Components: Smart action cards ("N members unpaid dues", "N pending applications"), key metrics (members, collection rate, upcoming activities)
States: Loading (skeleton cards), Empty (onboarding prompt), Populated (data-driven cards), Error (retry button), PermissionError (redirect to member view)

### Screen: Officer Management (/org/[id]/officer/officers)
Purpose: View and manage officer assignments
Users: President
Components: Officer list with position, term dates, status; assign/remove buttons; transition checklist modal
States: Loading (skeleton table), Empty ("No officers assigned"), Populated, ValidationError (role conflict), PermissionError ("Only the President can manage officers")

### Screen: Org Public Page (/org/[slug])
Purpose: Public org profile with "Apply to Join"
Users: Public (unauthenticated)
Components: Header (logo, name, type), about, contact, officers list, recent activities, member count, CTA button
States: Loading (skeleton), NotFound (404), Suspended ("Org inactive"), NoActivities (section hidden), Populated

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /org/:id | Get org profile | orgId | Org data | 404 |
| PUT /org/:id | Update org profile | fields | Updated org | 403, 400 |
| POST /org/:id/officers | Assign officer role | personId, positionId | OfficerTerm record | 403 not president, 409 role taken |
| DELETE /org/:id/officers/:termId | Remove officer role | -- | -- | 403 |
| POST /org/:id/officers/:termId/transition | Start officer transition | incomingPersonId | Checklist | 403 |
| POST /org/:id/discipline | Disciplinary action | personId, actionType, reason | Action record | 403, 400 empty reason |
| GET /org/:slug/public | Public page data | slug | Public org data | 404 |
| GET /org/:id/dashboard | Dashboard metrics | orgId | Dashboard data | 403 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| OfficerAssigned | Officer term created | orgId, personId, positionId | M07, M12 |
| OfficerRemoved | Officer term removed | orgId, personId, positionId | M07, M12 |
| OfficerTransitioned | Handover completed | orgId, positionId, outgoingPersonId, incomingPersonId | M07 |
| MemberSuspended | Disciplinary suspension | orgId, personId, reason | M05 |
| MemberRemoved | Disciplinary removal | orgId, personId, reason | M05 |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| ElectionPublished | M12 | Trigger officer transition | Update officer roles from election results |
| OrganizationCreated | M03 | Initialize org dashboard | Default positions created |

## 11. Acceptance Criteria

### AC-M04-001: Org Settings CRUD
**Given** an officer is authenticated
**When** they update org profile fields
**Then** changes are persisted and reflected on public page within 1 second.

### AC-M04-002: Officer Role Constraint
**Given** a non-president officer attempts to assign/remove roles
**When** the API is called
**Then** it returns 403. Only President can assign/remove roles. One per role except Board Member.

### AC-M04-003: Officer Transition with Handoff Checklist
**Given** a President initiates officer transition
**When** the transition starts
**Then** a role-specific checklist is generated and must be completed (or overridden with reason) before transfer.

### AC-M04-004: Disciplinary Action with Mandatory Reason
**Given** a President performs a disciplinary action
**When** the reason field is empty
**Then** the submission is blocked. Non-empty reason is mandatory.

### AC-M04-005: Org Dashboard Metrics
**Given** an officer views the dashboard
**When** underlying data changes (e.g., member pays dues)
**Then** smart action cards reflect current state with no stale data.

### AC-M04-006: Public Page Slug
**Given** an org with slug "manila-dental-chapter"
**When** an unauthenticated visitor navigates to /org/manila-dental-chapter
**Then** the public page loads in under 2 seconds with org profile, officers, and "Apply to Join" CTA.

### AC-M04-007: SVG Sanitization
**Given** a logo SVG containing script elements is uploaded
**When** it is processed
**Then** all script elements, event handlers, and external references are stripped before storage.

## 12. Test Expectations

Required test categories:
- **Officer role assignment**: one-per-role constraint, president-only, Board Member exception, cross-org isolation
- **Officer transition**: checklist generation, completion tracking, override with reason, 24-hour reversal
- **Disciplinary actions**: reason required, immutable audit log, member notification, action type effects
- **SVG sanitization**: script removal, event handler removal, external ref removal, magic byte validation
- **Public page**: loads without auth, correct content, "Apply to Join" flow, 404 for unknown slug
- **Smart action cards**: real-time data accuracy, no stale state after dues payment
- **Permissions**: 403 for non-president on governance mutations, 2FA enforcement

## 13. Edge Cases

- President tries to assign themselves a second role: allowed (President + Board Member).
- Last officer removed from org: Platform Admin can intervene.
- Officer transition with incomplete checklist: President override with reason logged.
- Org with no logo: initials placeholder on public page.
- Disciplinary action on member who belongs to multiple orgs: only affects this org (M4-R7).
- President role itself needs reassignment: requires National Admin or Platform Admin (BR-09).
- Org slug collision: auto-append numeric suffix.
- Officer term that spans election: election results create new term, old term completed.

## 14. Dependencies

### Internal Dependencies
- M01 Auth & Onboarding (authentication, session)
- M03 Platform Admin (org provisioning, organization table)
- M05 Membership (member data for roster, officer must be a member)
- M12 Elections & Governance (election results trigger officer transitions)

### External Dependencies
- File storage (logo uploads via S3/MinIO)
- SVG sanitization library (DOMPurify or equivalent)

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Duplicate role assignment | Block with 409 | "This role is currently held by [Name]." |
| Non-president assigns role | 403 | "Only the President can assign officer roles." |
| Empty disciplinary reason | Block submission | "Reason is required." |
| SVG with scripts | Strip and save | (Transparent to user — sanitized silently) |
| Org not found (public page) | 404 | "Organization not found." |
| Org suspended (public page) | 200 with banner | "This organization is currently inactive." |
| Officer assigns role in another org | 403 | "You do not have permission in this organization." |

## 16. Performance Expectations

- Expected data volume: 200 members per org, 8-12 officer positions per org
- Expected concurrent users: 3-5 officers per org simultaneously
- Acceptable response times: Dashboard < 1s, public page < 2s, officer assignment < 500ms
- Caching: Public page cached (invalidated on profile edit, TTL 5min)

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| org.officer.assigned | INFO | Role assigned | orgId, personId, positionId | No |
| org.officer.removed | INFO | Role removed | orgId, personId, positionId | No |
| org.officer.transitioned | INFO | Handover completed | orgId, positionId, outgoing, incoming | No |
| org.discipline.action | WARN | Disciplinary action | orgId, personId, actionType | No |
| org.profile.updated | INFO | Profile saved | orgId, changedFields[] | No |
| org.public-page.viewed | DEBUG | Public page accessed | slug, visitorIP | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| org_dashboard_load_seconds | histogram | -- | Dashboard load time |
| org_discipline_actions_total | counter | action_type | Discipline count |
| org_officer_transitions_total | counter | -- | Transition count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| org.referralIncentive | release | true | Referral bonus for inviting chapters | -- |
| org.benchmarking | release | false | Anonymized cross-chapter comparison | -- |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M04-S1 | Org Profile CRUD | View/edit org settings | M01, M03 | P0 |
| M04-S2 | Org Dashboard | Smart action cards + metrics | M04-S1, M05 | P0 |
| M04-S3 | Officer Role Management | Assign/remove roles via positions/terms | M04-S1, M05 | P0 |
| M04-S4 | Officer Transition | Checklist-based handover | M04-S3 | P0 |
| M04-S5 | Disciplinary Actions | Warning/suspend/remove/probation | M04-S3 | P0 |
| M04-S6 | Org Public Page | Public profile + Apply to Join | M04-S1 | P0 |
| M04-S7 | Invite Chapter | Referral with social proof | M04-S1 | P1 |
| M04-S8 | Engagement Analytics | Member engagement dashboard | M04-S2, M05 | P1 |

## 20. AI Instructions

When implementing this module:
1. **Entities live in Membership context**: `position`, `officer_term`, `disciplinary_action`, `transition_checklist` are in `association:member/repos/governance.schema.ts`. Organization itself is in `platformadmin/repos/platform-admin.schema.ts`.
2. **Officer hierarchy**: president (0) > vice-president (1) > secretary (2) > treasurer (3) > board-member (4) > officer (5) > staff (6) > member (7). Use `hasMinimumRole()` from `utils/org-auth.ts`.
3. **2FA enforcement**: president, secretary, treasurer require 2FA in production for governance mutations.
4. **Officer auth middleware**: Use `officerAuthMiddleware` from `association:member/` for all mutation routes.
5. **Handler pattern**: Follow `services/api-ts/src/handlers/association:member/` patterns for governance operations (157 handlers exist here).
6. **Public routes**: `/org/:slug/public` must be in the unprotected route list (no auth middleware).
7. **Database**: PostgreSQL + Drizzle ORM. Use transactions for officer transitions (multi-table update).
8. **Spec-first**: If adding new API endpoints, define in TypeSpec first (`specs/api/src/modules/`), then generate.

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | -- |
| 2. Domain Terms | COMPLETE | Updated with Position, OfficerTerm, TransitionChecklist from DOMAIN_MODEL |
| 3. Workflows | COMPLETE | Aligned with WORKFLOW_MAP WF-024 through WF-028 |
| 4. Workflow Details | COMPLETE | 3 workflows detailed |
| 5. Business Rules | COMPLETE | BR-09, BR-29, BR-31 + module rules |
| 6. Permissions | COMPLETE | From ROLE_PERMISSION_MATRIX 3.2 |
| 7. Data Requirements | COMPLETE | Updated with Position, OfficerTerm, TransitionChecklist from DOMAIN_MODEL |
| 7b. Aggregate Boundaries | COMPLETE | From DOMAIN_MODEL section 10 |
| 8. State Transitions | COMPLETE | From DOMAIN_MODEL section 13 (org lifecycle, officer term) |
| 9. UI/UX Requirements | COMPLETE | 3 screens with all states |
| 10. API Expectations | COMPLETE | 8 endpoints |
| 10b. Domain Events | COMPLETE | From DOMAIN_MODEL section 11 + DDD classification |
| 11. Acceptance Criteria | COMPLETE | 7 ACs in Given/When/Then |
| 12. Test Expectations | COMPLETE | 7 categories |
| 13. Edge Cases | COMPLETE | 8 cases |
| 14. Dependencies | COMPLETE | -- |
| 15. Error Handling | COMPLETE | 7 scenarios |
| 16. Performance | COMPLETE | -- |
| 17. Observability | COMPLETE | 6 log events, 3 metrics |
| 18. Feature Flags | COMPLETE | 2 flags |
| 19. Vertical Slice Plan | COMPLETE | 8 slices |
| 20. AI Instructions | COMPLETE | 8 implementation directives |
| 21. Section Completeness | COMPLETE | -- |
| 22. Downstream Impact | COMPLETE | -- |

## 22. Downstream Impact

- **M05 Membership**: Depends on officer roles for application approval. If officer assignment is broken, no applications can be processed.
- **M06 Dues & Payments**: Fund configuration is org-scoped. Treasurer role must be assignable.
- **M12 Elections**: Election results produce officer transitions. `ElectionPublished` event must be consumed.
- **M14 National Dashboard**: Org analytics depend on organization data being consistent.
- **TypeSpec coverage**: Governance handlers are in the mega-module `association:member/` (TypeSpec-covered). New endpoints should go through TypeSpec pipeline.
