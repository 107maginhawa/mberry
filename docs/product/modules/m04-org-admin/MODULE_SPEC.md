# Module Specification: Organization Admin (M04)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Officers manage their organization's profile, team, operational configuration, and public presence. Administrative backbone that all other org-scoped modules depend on.

### Users
- President, Vice President, Secretary, Treasurer, Officers
- Platform Administrator

### Related Modules
- M01 Auth & Onboarding (authentication), M03 Platform Admin (org provisioning)
- M05 Membership (member roster depends on org admin), M06 Dues & Payments (fund config)
- M12 Elections & Governance (officer transitions), M14 National Dashboard (org analytics)
- M16 Advertising (org-level config), M18 Surveys (org config), M19 Committee Management (org admin)

### In Scope
- Org type designation, org profile management, org dashboard with smart action cards
- Officer role management (assign/remove), officer transition with checklist
- Disciplinary actions (warn/suspend/remove), org public page
- Invite a chapter, admin referral incentive, engagement analytics, benchmarking

### Out of Scope
- Membership lifecycle (M05), dues collection (M06), election execution (M12)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Organization | Operational unit within an association. Types: chapter, society, national, clinic. |
| Officer | Member with administrative role: President, Treasurer, Secretary, etc. |
| President | Org governance leader. Assigns roles, handles disciplinary actions. |
| Org Public Page | Publicly visible URL showing org profile, officers, "Apply to Join." |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Org Dashboard | Officer | Smart action cards, key metrics | P0 |
| Org Profile Management | Officer | Edit name, logo, description, contact | P0 |
| Officer Role Assignment | President | Assign/remove officer roles | P0 |
| Officer Transition | President | Checklist-based handover | P0 |
| Disciplinary Actions | President | Warn, suspend, remove with reason | P0 |
| Org Public Page | Public | Visible profile with "Apply to Join" | P0 |
| Invite Chapter | Officer | Referral with social proof | P0 |

## 4. Workflow Details

### Workflow: Officer Transition (CO-9, CP-7)

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

Postconditions: Role transferred. All data persists. Members notified.

### Workflow: Disciplinary Action (CP-6)

Actor: President
Preconditions: Member exists in org
Steps:
1. Selects member and action (warn/suspend/remove).
2. Enters reason (mandatory, non-empty).
3. Confirms action.
4. Status updated. Member notified with reason. Action logged.

Postconditions: Immutable audit log entry. Member's access adjusted per action type.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| M4-R1 | IF assigning officer role THEN one per role (except Board Member) | Role assignment | Block duplicate role assignment |
| M4-R2 | IF assigning/removing officer THEN only President can do it | Role management | API returns 403 for others |
| M4-R3 | IF officer transition THEN checklist required before transfer | Transition | Role-specific items auto-generated |
| M4-R4 | IF disciplinary action THEN reason required, action immutable | Discipline | Warn: no access change. Suspend: lose org features. Remove: terminate membership. |
| M4-R5 | IF SVG uploaded as logo THEN sanitize | Logo upload | Strip scripts, event handlers, external refs |
| M4-R6 | IF officer action THEN log to immutable audit trail | All actions | Actor, timestamp, before/after state, IP |
| M4-R7 | IF officer role in org A THEN no effect on org B | Cross-org | Independent per org |
| BR-09 | IF role assigned THEN notify new officer | Role assignment | Outbound notification |
| BR-29 | IF org exists THEN public page at /org/[slug] | Public page | Configurable visibility |
| BR-31 | IF SVG uploaded THEN validate by magic bytes, sanitize | Logo security | Not just extension check |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| View org dashboard | All officers | member | GA+OA |
| Edit org profile | All officers | member | GA+OA |
| Assign/remove officer roles | president only | All others | GA+HG, 2FA |
| Disciplinary actions | president only | All others | GA+HG, 2FA |
| View org public page | Public (no auth) | — | Public route |

## 7. Data Requirements

### Entity: Organization

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| name | Yes | Org name | 2-100 chars |
| slug | Yes | URL-friendly name | Unique, auto-generated |
| orgType | Yes | chapter/society/national/clinic | Set at creation, not editable |
| description | No | Org description | Max 2,000 chars |
| logoUrl | No | Logo image URL | SVG sanitized per M4-R5 |
| contactEmail | No | Contact email | Standard validation |
| meetingSchedule | No | Free text | E.g., "Every 2nd Tuesday, 7PM" |
| foundingDate | No | Founded date | Must not be future |

### Entity: OfficerRole

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| orgId | Yes | Organization FK | — |
| memberId | Yes | Member FK | — |
| role | Yes | Role enum | president/vp/secretary/treasurer/auditor/pro/board_member/custom |
| assignedAt | Yes | Assignment date | — |
| assignedBy | Yes | Assigning officer | — |
| removedAt | No | Removal date | Soft delete |

### Entity: DisciplinaryAction

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| orgId | Yes | Organization FK | — |
| memberId | Yes | Target member | — |
| actionType | Yes | warn/suspend/remove | Enum |
| reason | Yes | Reason text | Non-empty, mandatory |
| performedBy | Yes | Acting officer | Must be President |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Organization | OfficerRole, OfficerTransition, DisciplinaryAction | Address | Slug unique. One active officer per role (except Board Member). |

## 8. State Transitions

### Officer Role
```txt
Assigned → Active → Removed (by president)
Assigned → Active → Transitioned (handover)
```

### Disciplinary Action
```txt
(No state — immutable record created once)
```

## 9. UI / UX Requirements

### Screen: Org Dashboard (/org/[id]/officer/dashboard)
Purpose: Officer home with smart action cards
Components: Smart action cards ("N members unpaid dues", "N pending applications"), key metrics (members, collection rate, upcoming activities)
States: Empty (onboarding prompt), Loading (skeleton), Populated, Error (retry)

### Screen: Org Public Page (/org/[slug])
Purpose: Public org profile with "Apply to Join"
Components: Header (logo, name, type), about, contact, officers list, recent activities, member count, CTA button
States: Not found (404), Suspended ("Org inactive"), No activities (section hidden)

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| GET /org/:id | Get org profile | orgId | Org data | 404 |
| PUT /org/:id | Update org profile | fields | Updated org | 403, 400 |
| POST /org/:id/officers | Assign officer role | memberId, role | Officer record | 403 not president, 409 role taken |
| DELETE /org/:id/officers/:id | Remove officer role | — | — | 403 |
| POST /org/:id/discipline | Disciplinary action | memberId, action, reason | Action record | 403, 400 empty reason |
| GET /org/:slug/public | Public page data | slug | Public org data | 404 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| OfficerAssigned | Role assigned | orgId, memberId, role | M07, M12 |
| OfficerRemoved | Role removed | orgId, memberId, role | M07, M12 |
| MemberSuspended | Disciplinary suspension | orgId, memberId, reason | M05 |
| MemberRemoved | Disciplinary removal | orgId, memberId, reason | M05 |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| ElectionPublished | M12 | Trigger officer transition | Update officer roles from results |
| OrganizationCreated | M03 | Initialize org dashboard | Dashboard ready |

## 11. Acceptance Criteria

### AC-M04-001: Smart Action Cards
Smart action cards update as underlying data changes. No stale cards after member pays dues.

### AC-M04-002: Officer Role Constraint
Only President can assign/remove roles. API returns 403 for other roles. One per role except Board Member.

### AC-M04-003: Disciplinary Reason Required
Disciplinary actions cannot be submitted without non-empty reason.

### AC-M04-004: Public Page Performance
Org public page loads in under 2 seconds for unauthenticated visitors.

### AC-M04-005: SVG Sanitization
Logo SVG sanitization strips all script elements before storage.

## 12. Test Expectations

Required tests:
- Officer role assignment: one-per-role constraint, president-only, Board Member exception
- Officer transition: checklist generation, completion tracking, override with reason
- Disciplinary actions: reason required, audit log, member notification
- SVG sanitization: script removal, event handler removal, external ref removal
- Public page: loads without auth, correct content, "Apply to Join" flow
- Smart action cards: real-time data, no stale state

## 13. Edge Cases

- President tries to assign themselves a second role: allowed (President + Board Member).
- Last officer removed from org: Platform Admin can intervene.
- Officer transition with incomplete checklist: President override with reason logged.
- Org with no logo: initials placeholder on public page.
- Disciplinary action on member who belongs to multiple orgs: only affects this org.

## 14. Dependencies

### Internal Dependencies
- M01 Auth & Onboarding (authentication)
- M03 Platform Admin (org provisioning)
- M05 Membership (member data for roster)
- M12 Elections & Governance (election results trigger transitions)

### External Dependencies
- File storage (logo uploads)
- SVG sanitization library

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| Duplicate role assignment | Block | "This role is currently held by [Name]." |
| Non-president assigns role | 403 | "Only the President can assign officer roles." |
| Empty disciplinary reason | Block submission | "Reason is required." |
| SVG with scripts | Strip and save | (Transparent to user — sanitized silently) |
| Org not found (public page) | 404 | "Organization not found." |

## 16. Performance Expectations

- Expected data volume: 200 members per org, 8 officer roles
- Expected concurrent users: 3-5 officers per org simultaneously
- Acceptable response times: Dashboard < 1s, public page < 2s
- Caching requirements: Public page cached, invalidated on profile edit

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| org.officer.assigned | INFO | Role assigned | orgId, memberId, role | No |
| org.officer.removed | INFO | Role removed | orgId, memberId, role | No |
| org.discipline.action | WARN | Disciplinary action | orgId, memberId, actionType | No |
| org.profile.updated | INFO | Profile saved | orgId, changedFields | No |
| org.transition.started | INFO | Handover begun | orgId, role, outgoing, incoming | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| org_dashboard_load_seconds | histogram | — | Dashboard load time |
| org_discipline_actions_total | counter | action_type | Discipline count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| org_referral_incentive_enabled | release | true | Referral bonus for inviting chapters | — |
| org_benchmarking_enabled | release | false | Anonymized cross-chapter comparison | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M04-S1 | Org Profile CRUD | View/edit org settings | M01, M03 | P0 |
| M04-S2 | Org Dashboard | Smart action cards + metrics | M04-S1, M05 | P0 |
| M04-S3 | Officer Role Management | Assign/remove roles | M04-S1, M05 | P0 |
| M04-S4 | Officer Transition | Checklist-based handover | M04-S3 | P0 |
| M04-S5 | Disciplinary Actions | Warn/suspend/remove | M04-S3 | P0 |
| M04-S6 | Org Public Page | Public profile + Apply to Join | M04-S1 | P0 |
| M04-S7 | Invite Chapter | Referral with social proof | M04-S1 | P1 |
| M04-S8 | Engagement Analytics | Member engagement dashboard | M04-S2, M05 | P1 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
