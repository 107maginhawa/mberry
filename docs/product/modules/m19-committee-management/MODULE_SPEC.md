# Module Specification: Committee Management (M19)

---
Spec Version: 1.0
Last Updated: 2026-05-20
Last Validated Against: MASTER_PRD.md v3.0
---

## 1. Module Overview

### Purpose
Create and manage committees within organizations — standing committees, ad-hoc task forces, and special committees. Covers committee lifecycle, membership, terms, meetings, tasks, and reports.

### Users
- President, Officers, Committee Chairperson, Committee Member

### Related Modules
- M04 (Org Admin — committee creation authority), M05 (Membership — committee eligibility)

### In Scope
- Committee creation (name, type, purpose, term dates)
- Committee types: standing, ad-hoc, special
- Committee membership management (add/remove members, assign chairperson)
- Term management (start/end dates, term limits)
- Committee meetings (schedule, agenda, minutes)
- Committee tasks (assign, track, status)
- Committee reports (periodic reports to org leadership)

### Out of Scope
- Election of committee members (M12 if needed), budget management (M06)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Committee | Group of members with a defined purpose, chairperson, and term. |
| Standing Committee | Permanent committee with ongoing responsibilities (e.g., Ethics, Education). |
| Ad-Hoc Committee | Temporary committee for a specific task. Dissolved when complete. |
| Special Committee | Committee with a defined scope and timeline but may be renewed. |
| Chairperson | Committee leader responsible for meetings, tasks, and reports. |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| Create Committee | President/Officer | Set up committee with type, purpose, members | P0 |
| Manage Members | Chairperson | Add/remove committee members | P0 |
| Schedule Meeting | Chairperson | Set agenda, time, attendees | P0 |
| Manage Tasks | Chairperson/Member | Create, assign, track tasks | P0 |
| Submit Report | Chairperson | Periodic committee report to org | P1 |

## 4. Workflow Details

### Workflow: Create Committee

Actor: President or authorized officer
Steps:
1. Opens /org/[id]/officer/committees/new.
2. Enters: committee name, type (standing/ad-hoc/special), purpose description.
3. Sets term: start date, end date (or ongoing for standing).
4. Assigns chairperson from org members.
5. Adds initial committee members.
6. Saves. Committee appears in org committee list.

### Workflow: Manage Tasks

Actor: Chairperson or committee member (configurable)
Steps:
1. Opens committee detail page.
2. Creates task: title, description, assignee, due date.
3. Assignee sees task in their committee dashboard.
4. Assignee updates status: open → in progress → completed.
5. Overdue tasks flagged in committee dashboard.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-39 | IF ad-hoc committee purpose fulfilled THEN dissolve | Ad-hoc lifecycle | Chairperson or President dissolves |
| M19-R1 | IF committee created THEN must have chairperson | Creation | Required field |
| M19-R2 | IF term end date reached THEN committee marked expired (standing auto-renews) | Terms | Standing: auto-renew. Ad-hoc: dissolve. |
| M19-R3 | IF task overdue THEN flag in dashboard | Tasks | Visual indicator |
| M19-R4 | IF member removed from org THEN remove from all committees | Membership | Cascading removal |
| M19-R5 | IF committee dissolved THEN preserve history (read-only) | Dissolution | Historical record |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Create committee | president, officers | member | GA+HG |
| Manage committee members | chairperson, president | regular members | GA+HG |
| Create/manage tasks | chairperson, committee members (configurable) | non-members | GA |
| Schedule meetings | chairperson | — | GA |
| Submit reports | chairperson | — | GA |

## 7. Data Requirements

### Entity: Committee

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | — |
| name | Yes | Committee name | — |
| type | Yes | standing/ad-hoc/special | Enum |
| purpose | Yes | Description | — |
| chairpersonId | Yes | Person FK | Must be org member |
| termStart | Yes | Start date | — |
| termEnd | No | End date (null for standing) | — |
| status | Yes | active/expired/dissolved | Enum |

### Entity: CommitteeMember

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| committeeId | Yes | Committee FK | — |
| personId | Yes | Person FK | Must be org member |
| role | No | Optional role label | — |
| joinedAt | Yes | Date added | — |
| leftAt | No | Date removed | — |

### Entity: CommitteeTask

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| committeeId | Yes | Committee FK | — |
| title | Yes | Task name | — |
| description | No | Task details | — |
| assigneeId | Yes | Person FK | Must be committee member |
| dueDate | Yes | Due date | — |
| status | Yes | open/in_progress/completed | Enum |

### Entity: CommitteeMeeting

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| committeeId | Yes | Committee FK | — |
| scheduledAt | Yes | Meeting date/time | — |
| agenda | No | Meeting agenda | — |
| minutes | No | Meeting minutes (post-meeting) | — |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Committee | CommitteeMember, CommitteeTask, CommitteeMeeting | — | Must have chairperson. Members must be org members. |

## 8. State Transitions

### Committee Status
```txt
Active → Expired (term end reached, non-standing)
Active → Dissolved (president/chairperson action)
Expired → Renewed (standing committees)
```

### Task Status
```txt
Open → In Progress → Completed
```

## 9. UI / UX Requirements

### Screen: Committee List (/org/[id]/officer/committees)
Purpose: View all committees
Components: Committee cards (name, type, chairperson, member count, status), create button

### Screen: Committee Detail (/org/[id]/officer/committees/[id])
Purpose: Manage committee
Components: Members list, task board, meeting schedule, reports, edit committee

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /org/:id/committees | Create committee | Committee data | committeeId | 403, 400 |
| POST /org/:id/committees/:id/members | Add member | personId | memberId | 400 not org member |
| POST /org/:id/committees/:id/tasks | Create task | Task data | taskId | 403 |
| PUT /org/:id/committees/:id/tasks/:id | Update task | status | Updated task | 400 |
| POST /org/:id/committees/:id/meetings | Schedule meeting | Meeting data | meetingId | 403 |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| CommitteeCreated | Committee created | committeeId, orgId, type | — |
| CommitteeDissolved | Committee dissolved | committeeId | — |
| TaskOverdue | Task past due date | taskId, committeeId, assigneeId | Notifications |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MemberRemoved | M04 | Remove from all committees | CommitteeMember.leftAt set |

## 11. Acceptance Criteria

### AC-M19-001: Chairperson Required
Cannot create committee without assigning a chairperson.

### AC-M19-002: Ad-Hoc Dissolution
Ad-hoc committees can be dissolved when purpose fulfilled. History preserved read-only.

### AC-M19-003: Overdue Tasks
Overdue tasks visually flagged in committee dashboard.

### AC-M19-004: Cascading Removal
Member removed from org is automatically removed from all org committees.

## 12. Test Expectations

Required tests:
- Committee CRUD: create, edit, dissolve per type
- Membership: add/remove, chairperson required, org member only
- Tasks: create, assign, status updates, overdue flagging
- Meetings: schedule, agenda, minutes
- Term management: standing auto-renew, ad-hoc expiry
- Cascading removal: org member removal cascades to committees

## 13. Edge Cases

- Committee with 1 member (chairperson only): valid.
- Chairperson removed from org: new chairperson must be assigned. [VERIFY]
- All tasks completed for ad-hoc committee: prompt dissolution.
- Meeting scheduled for dissolved committee: rejected.

## 14. Dependencies

### Internal Dependencies
- M04 (Org Admin — committee authority), M05 (Membership — member eligibility)

### External Dependencies
- None

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| No chairperson | Block creation | "Chairperson is required." |
| Non-org member added | Block | "Person must be a member of this organization." |
| Task for dissolved committee | Block | "Committee has been dissolved." |

## 16. Performance Expectations

- Expected data volume: 5-20 committees per org, 10-30 members per committee
- Acceptable response times: Committee list < 500ms

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| committee.created | INFO | Committee created | committeeId, orgId, type | No |
| committee.dissolved | INFO | Dissolved | committeeId | No |
| committee.task.overdue | WARN | Task past due | taskId, assigneeId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| committees_total | gauge | type, status | Active committees |
| committee_tasks_total | counter | status | Task count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| committee_management_enabled | release | false | Gates committee module | — |
| committee_task_management | release | true | Task tracking within committees | — |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M19-S1 | Committee CRUD | Create, edit, dissolve | M04, M05 | P0 |
| M19-S2 | Committee Membership | Add/remove members, chairperson | M19-S1 | P0 |
| M19-S3 | Task Management | Create, assign, track tasks | M19-S2 | P0 |
| M19-S4 | Meetings | Schedule, agenda, minutes | M19-S2 | P1 |
| M19-S5 | Reports | Periodic committee reports | M19-S2 | P1 |
| M19-S6 | Term Management | Auto-renew standing, expire ad-hoc | M19-S1 | P1 |

## 20. AI Instructions

When implementing this module:
1. Do not implement the entire module at once.
2. Convert workflows into vertical slice specs.
3. Implement one slice at a time.
4. Keep terminology consistent with the Domain Glossary.
5. Use acceptance criteria as test basis.
6. Follow ARCHITECTURE.md, CONTRIBUTING.md, and CLAUDE.md.
