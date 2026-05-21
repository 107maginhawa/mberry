# Module Specification: Committee Management (M19)

---
oli_version: "Phase B -- Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 2.0
Last Updated: 2026-05-21
Last Validated Against: MASTER_PRD.md v3.0, DOMAIN_MODEL.md v1.0, WORKFLOW_MAP.md v1.0
---

## 1. Module Overview

### Purpose
Create and manage committees within organizations -- standing committees, ad-hoc task forces, and special committees. Covers full committee lifecycle: creation, membership, terms, meetings, task tracking, reports, and dissolution with historical preservation.

### Users
- President (create/dissolve committees), Officers (create committees), Committee Chairperson (manage members, tasks, meetings, reports), Committee Member (view tasks, update task status)

### Related Modules
- M04 (Org Admin -- committee creation authority, officer roles)
- M05 (Membership -- committee eligibility requires active membership)

### In Scope
- Committee creation with type (standing, ad-hoc, special), purpose, and term dates
- Chairperson assignment (required)
- Committee membership management (add/remove members, role assignment)
- Task management: create, assign, track status, due dates, overdue flagging
- Meeting management: schedule, agenda, minutes recording
- Committee reports to org leadership
- Dissolution lifecycle with historical data preservation (BR-39)
- Standing committee auto-renewal

### Out of Scope
- Election of committee members (M12 Elections if needed)
- Budget/financial management for committees (M06 Dues & Payments)
- Committee-level communications (use M07 Communications)

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| **Association** | Top-level tenant organization. Scoped by `association_id`. |
| **Organization** | Operational unit within an association. Scoped by `organization_id`. |
| **Member** | A healthcare professional using the platform. Can belong to multiple organizations. |
| **Officer** | A member assigned an administrative role within an organization: President, Treasurer, or Secretary. |
| **President** | Org governance role. Assigns officer roles, manages officer transitions, handles disciplinary actions. |
| **Active** | Dues are current. Full access to org features. |
| **Committee** | Group of members with a defined purpose, chairperson, and term. [INFERRED -- not in DOMAIN_GLOSSARY] |
| **Chairperson** | Committee leader responsible for meetings, tasks, and reports. [INFERRED] |

## 3. Workflows

| Workflow | Actor | Description | Priority |
|----------|-------|-------------|----------|
| WF-104: Create Committee | President/Officer | Standing or ad-hoc, assign chairperson | P0 |
| WF-105: Manage Committee Members | Chairperson/President | Add/remove members, assign roles | P0 |
| WF-106: Manage Tasks | Chairperson/Member | Create, assign, track committee tasks | P0 |
| WF-107: Committee Meetings | Chairperson | Schedule and record meetings | P1 |
| WF-108: Committee Dissolution | President/Chairperson | Dissolve ad-hoc committee, cascade cleanup | P1 |

## 4. Workflow Details

### WF-104: Create Committee
**Actor:** President or authorized officer
**Preconditions:** User has president or officer role in the organization
**Steps:**
1. Opens `/org/[id]/officer/committees/new`.
2. Enters: committee name, type (standing/ad-hoc/special), purpose description.
3. Sets term: start date, end date (null for standing = ongoing).
4. Assigns chairperson from active org members (required -- M19-R1).
5. Adds initial committee members (optional at creation).
6. Saves. Committee appears in org committee list with status `active`.
**Alternate Flows:** Save without initial members -- chairperson is the only member.
**Exception Flows:** No chairperson selected -- validation error blocks creation.
**Postconditions:** Committee record created. Domain event `CommitteeCreated` emitted.

### WF-105: Manage Committee Members
**Actor:** Chairperson or President
**Preconditions:** Committee is active (not dissolved)
**Steps:**
1. Opens committee detail page.
2. Adds member: selects from active org members.
3. Optionally assigns role label (e.g., "Secretary", "Vice Chair").
4. To remove: sets member as inactive (preserves history).
**Alternate Flows:** Bulk add members.
**Exception Flows:** Non-org-member selected -- blocked. Dissolved committee -- blocked.
**Postconditions:** CommitteeMember records created/updated.

### WF-106: Manage Tasks
**Actor:** Chairperson or committee member (configurable per committee)
**Preconditions:** Committee is active
**Steps:**
1. Opens committee detail page, task board tab.
2. Creates task: title, description, assignee (optional), due date, priority (low/medium/high).
3. Assignee sees task in their committee dashboard.
4. Assignee updates status: open -> in progress -> completed.
5. Overdue tasks flagged visually in dashboard (M19-R3).
**Alternate Flows:** Unassigned tasks visible to all committee members.
**Exception Flows:** Task assigned to non-committee-member -- blocked.
**Postconditions:** CommitteeTask record created/updated. Overdue event emitted if past due.

### WF-107: Committee Meetings
**Actor:** Chairperson
**Preconditions:** Committee is active
**Steps:**
1. Opens committee detail page, meetings tab.
2. Creates meeting: date/time, agenda text.
3. After meeting: records minutes.
4. Meeting visible to all committee members.
**Postconditions:** CommitteeMeeting record created.

### WF-108: Committee Dissolution
**Actor:** President or Chairperson
**Preconditions:** Committee is active or expired
**Steps:**
1. Opens committee detail page.
2. Initiates dissolution: provides reason.
3. System sets `status = dissolved`, records `dissolvedAt`, `dissolvedBy`, `dissolutionReason`.
4. All committee data preserved read-only (BR-39).
5. Members lose committee workspace access but officers/admins retain read access.
**Alternate Flows:** Standing committees: warn that dissolution is permanent (no auto-renew after).
**Exception Flows:** Committee has open tasks -- warn but allow dissolution (tasks archived).
**Postconditions:** Committee dissolved. Domain event `CommitteeDissolved` emitted. Member access revoked.

## 5. Business Rules

| Rule ID | Rule | Applies To | Expected Behavior |
|---------|------|-----------|-------------------|
| BR-39 | IF committee dissolved THEN all data (meetings, minutes, tasks, reports) retained indefinitely for audit; members lose workspace access; officers/platform admins retain read access | Dissolution | Historical preservation; read-only archive |
| M19-R1 | IF committee created THEN must have a chairperson assigned | Creation | Required field; validation error if missing |
| M19-R2 | IF term end date reached THEN standing committees auto-renew; ad-hoc/special marked expired | Terms | Automatic status transition |
| M19-R3 | IF task past due date THEN flag as overdue in dashboard | Tasks | Visual indicator; domain event emitted |
| M19-R4 | IF member removed from org THEN remove from all org committees | Membership cascade | Set `removedAt` on CommitteeMember; preserve history |
| M19-R5 | IF committee dissolved THEN preserve all history as read-only | Dissolution | No data deletion; status change only |
| M19-R6 | IF chairperson removed from org THEN new chairperson must be assigned before committee can operate | Chairperson continuity | Block mutations until new chairperson set. Committee enters `leaderless` state; only officer/admin can assign new chairperson. |

## 6. Permissions

| Action | Allowed Roles | Restricted Roles | Notes |
|--------|--------------|-----------------|-------|
| Create committee | president, officers | member, staff | GA+HG |
| Dissolve committee | president, chairperson | member, officer (non-president) | GA+HG |
| Manage committee members | chairperson, president | regular members | GA+HG |
| Create/manage tasks | chairperson, committee members (configurable) | non-members | GA |
| Update own task status | assigned committee member | non-members | GA |
| Schedule meetings | chairperson | -- | GA |
| Record meeting minutes | chairperson | -- | GA |
| Submit reports | chairperson | -- | GA |
| View committee (active) | All org members | non-members | GA |
| View committee (dissolved) | Officers, platform admin | regular members | GA+OA [INFERRED] |

## 7. Data Requirements

### Entity: Committee

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | uuid |
| name | Yes | Committee name | varchar(200) |
| description | No | Committee purpose/description | text |
| status | Yes | Current status | Enum: `active`, `expired`, `dissolved` (default: active) |
| dissolvedAt | No | Dissolution timestamp | timestamp |
| dissolvedBy | No | Person who dissolved | uuid FK |
| dissolutionReason | No | Reason for dissolution | text |

### Entity: CommitteeMember

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | uuid |
| committeeId | Yes | Committee FK | uuid |
| personId | Yes | Person FK | uuid; must be active org member |
| role | No | Role within committee | Enum: `chairperson`, `vice_chair`, `secretary`, `member` (default: member) |
| assignedAt | Yes | Date added | timestamp (default: now) |
| removedAt | No | Date removed | timestamp |
| active | Yes | Currently active | boolean (default: true) |

### Entity: CommitteeTask

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | uuid |
| committeeId | Yes | Committee FK | uuid |
| title | Yes | Task name | varchar(300) |
| description | No | Task details | text |
| assigneeId | No | Person FK | uuid; optional, task can be unassigned |
| status | Yes | Task status | Enum: `pending`, `in_progress`, `completed` (default: pending) |
| priority | Yes | Task priority | Enum: `low`, `medium`, `high` (default: medium) |
| dueDate | No | Due date | timestamp |
| completedAt | No | Completion timestamp | timestamp |
| completedBy | No | Person who completed | uuid |

### Entity: CommitteeMeeting [INFERRED -- not in DOMAIN_MODEL]

| Field | Required | Description | Validation / Notes |
|-------|---------|-------------|-------------------|
| organizationId | Yes | Org FK | uuid |
| committeeId | Yes | Committee FK | uuid |
| scheduledAt | Yes | Meeting date/time | timestamp |
| agenda | No | Meeting agenda | text |
| minutes | No | Meeting minutes (post-meeting) | text |
| createdBy | Yes | Person who scheduled | uuid FK |

## 7b. Aggregate Boundaries

| Aggregate Root | Owned Entities | Owned Value Objects | Key Invariants |
|---|---|---|---|
| Committee | CommitteeMember, CommitteeTask, CommitteeMeeting | -- | Must have chairperson (M19-R1). All members must be active org members. Dissolved committees are read-only. |

## 8. State Transitions

### Committee Status
```txt
Active --> Expired (term end date reached for ad-hoc/special; M19-R2)
Active --> Dissolved (president/chairperson action; BR-39)
Expired --> Renewed (standing committees auto-renew; M19-R2)
Expired --> Dissolved (president/chairperson action)
```
Dissolved is terminal. No transitions out of Dissolved.

### Task Status
```txt
Pending --> In Progress (assignee starts work)
In Progress --> Completed (assignee finishes)
Pending --> Completed (direct completion for simple tasks)
```
No reverse transitions. Completed tasks are immutable.

## 9. UI/UX Requirements

### Screen: Committee List (/org/[id]/officer/committees)
**Purpose:** View and manage all committees
**Users:** Officers (manage), Members (view)
**Components:** Committee cards (name, type badge, chairperson, member count, status indicator), create button (officers only), filter by type/status
**States:** Loading (skeleton cards), Empty ("No committees yet. Create your first committee."), Success (card grid), UnexpectedError (generic retry)

### Screen: Committee Detail (/org/[id]/officer/committees/[id])
**Purpose:** Full committee management
**Users:** Chairperson (full control), Officers (manage), Members (view tasks)
**Components:** Header (name, type, status, chairperson), Members tab (list, add/remove), Tasks tab (kanban board: pending/in-progress/completed, create task), Meetings tab (schedule list, add meeting, record minutes), Reports tab (submit report), Dissolve button (president/chairperson only)
**States:** Loading, Success (tabs), NotFound ("Committee not found."), PermissionError ("You don't have access to this committee."), Dissolved (read-only banner: "This committee has been dissolved. Viewing historical data.")

### Screen: My Committees (/my/committees)
**Purpose:** Member view of their committee assignments
**Users:** Committee members
**Components:** Committee cards with assigned tasks summary, overdue task count badge
**States:** Loading, Empty ("You are not assigned to any committees."), Success

## 10. API Expectations

| API Need | Purpose | Inputs | Outputs | Errors |
|----------|---------|--------|---------|--------|
| POST /org/:id/committees | Create committee | name, description, type, chairpersonId | committeeId | 403, 400 (no chairperson) |
| GET /org/:id/committees | List org committees | status?, type?, page | Paginated committee list | 403 |
| GET /org/:id/committees/:id | Committee detail | -- | Committee + members + recent tasks | 404, 403 |
| PUT /org/:id/committees/:id | Update committee | name?, description? | Updated committee | 403, 400, 409 (dissolved) |
| POST /org/:id/committees/:id/dissolve | Dissolve committee | reason | Updated committee | 403, 409 (already dissolved) |
| POST /org/:id/committees/:id/members | Add member | personId, role? | memberId | 400 (not org member), 409 (dissolved) |
| DELETE /org/:id/committees/:id/members/:id | Remove member | -- | -- | 403, 409 (dissolved) |
| POST /org/:id/committees/:id/tasks | Create task | title, description?, assigneeId?, dueDate?, priority | taskId | 403, 409 (dissolved) |
| PUT /org/:id/committees/:id/tasks/:id | Update task | status?, assigneeId?, dueDate? | Updated task | 403, 400 |
| POST /org/:id/committees/:id/meetings | Schedule meeting | scheduledAt, agenda? | meetingId | 403, 409 (dissolved) |
| PUT /org/:id/committees/:id/meetings/:id | Update meeting (add minutes) | minutes? | Updated meeting | 403 |
| GET /my/committees | My committee assignments | -- | Committee list with task summaries | -- |

## 10b. Domain Events

### Published Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| CommitteeCreated | Committee created | committeeId, orgId, type, chairpersonId | -- |
| CommitteeDissolved | Committee dissolved | committeeId, orgId, reason | -- |
| CommitteeMemberAdded | Member added to committee | committeeId, personId, role | Notifications [INFERRED] |
| CommitteeMemberRemoved | Member removed from committee | committeeId, personId | -- |
| TaskOverdue | Task past due date | taskId, committeeId, assigneeId | Notifications |
| TaskCompleted | Task marked completed | taskId, committeeId, completedBy | -- [INFERRED] |

### Consumed Events

| Event Name | Source Module | Handler | Side Effect |
|---|---|---|---|
| MemberRemoved | M05 | Remove from all org committees | Set `removedAt` + `active = false` on CommitteeMember (M19-R4) |

## 11. Acceptance Criteria

**AC-M19-001:** Given committee creation form, when no chairperson is selected, then creation is blocked with "Chairperson is required."

**AC-M19-002:** Given an ad-hoc committee, when the president dissolves it, then status becomes `dissolved`, all data is preserved read-only, and members lose write access (BR-39).

**AC-M19-003:** Given a task with dueDate of 2026-06-01, when current date is 2026-06-02, then the task is visually flagged as overdue in the committee dashboard.

**AC-M19-004:** Given a member removed from the organization, when the membership removal event fires, then the member is automatically removed from all committees in that org.

**AC-M19-005:** Given a standing committee with term end date reached, when the system checks terms, then the committee is auto-renewed (status remains active, term dates extended).

**AC-M19-006:** Given a dissolved committee, when any user attempts to create a task or add a member, then the action is blocked with "Committee has been dissolved."

## 12. Test Expectations

- **Committee CRUD:** create (standing/ad-hoc/special), edit, dissolve per type
- **Chairperson required:** creation blocked without chairperson (M19-R1)
- **Membership:** add/remove members, org-member-only validation, role assignment
- **Tasks:** create, assign, status transitions (pending -> in_progress -> completed), overdue flagging
- **Meetings:** schedule, record agenda, add minutes post-meeting
- **Term management:** standing auto-renew (M19-R2), ad-hoc expiry, special expiry
- **Dissolution:** dissolve sets status, preserves data read-only (BR-39), blocks mutations
- **Cascading removal:** org member removal cascades to all committees (M19-R4)
- **Dissolved committee mutations:** all write operations blocked with 409
- **Access control:** president/officer creates, chairperson manages, members view

## 13. Edge Cases

- Committee with 1 member (chairperson only): valid, operational.
- Chairperson removed from org: committee enters `leaderless` state. All mutations blocked until officer/admin assigns new chairperson. Committee visible but read-only.
- All tasks completed for ad-hoc committee: prompt dissolution suggestion (not automatic).
- Meeting scheduled for dissolved committee: creation blocked with "Committee has been dissolved."
- Member added to committee who is then suspended from org: cascading removal triggers.
- Committee name already exists in org: allow (no uniqueness constraint). [INFERRED]
- Dissolve standing committee: warn that this is permanent (standing committees normally auto-renew).

## 14. Dependencies

### Internal Dependencies
- M04 (Org Admin -- committee creation authority, officer role verification)
- M05 (Membership -- member eligibility, cascading removal on MemberRemoved event)

### External Dependencies
- None

## 15. Error Handling

| Error Scenario | Expected Behavior | User-Facing Message |
|---------------|-------------------|---------------------|
| No chairperson on creation | 400 | "Chairperson is required." |
| Non-org member added | 400 | "Person must be a member of this organization." |
| Action on dissolved committee | 409 | "Committee has been dissolved." |
| Task assigned to non-committee-member | 400 | "Assignee must be a committee member." |
| Committee not found | 404 | "Committee not found." |
| Insufficient permissions | 403 | "You don't have permission to perform this action." |

## 16. Performance Expectations

- **Data volume:** 5-20 committees per org, 5-30 members per committee, 10-50 tasks per committee
- **Concurrent users:** 10-20 per committee dashboard
- **Response times:** Committee list < 500ms, task board < 300ms
- **Caching:** Committee list cacheable (short TTL); task board real-time (no cache)

## 17. Observability Hooks

| Event | Level | When | Fields | PII? |
|---|---|---|---|---|
| committee.created | INFO | Committee created | committeeId, orgId, type | No |
| committee.dissolved | INFO | Committee dissolved | committeeId, reason | No |
| committee.member.added | INFO | Member added | committeeId, personId, role | No |
| committee.member.removed | INFO | Member removed | committeeId, personId | No |
| committee.task.overdue | WARN | Task past due date | taskId, committeeId, assigneeId | No |
| committee.task.completed | INFO | Task completed | taskId, committeeId | No |

Metrics:

| Metric | Type | Labels | Description |
|---|---|---|---|
| committees_total | gauge | type, status | Committee count by type and status |
| committee_members_total | gauge | committeeId | Members per committee |
| committee_tasks_total | counter | status | Task count by status |
| committee_tasks_overdue | gauge | committeeId | Overdue task count |

## 18. Feature Flags

| Flag Name | Type | Default | Description | Cleanup Date |
|---|---|---|---|---|
| committee_management_enabled | release | false | Gates entire committee module | -- |
| committee_task_management | release | true | Task tracking within committees | -- |
| committee_meetings | release | true | Meeting scheduling and minutes | -- |

## 19. Vertical Slice Plan

| Slice ID | Slice Name | Description | Dependencies | Priority |
|----------|-----------|-------------|-------------|----------|
| M19-S1 | Committee CRUD | Create, edit, dissolve committees | M04, M05 | P0 |
| M19-S2 | Committee Membership | Add/remove members, chairperson assignment, role labels | M19-S1 | P0 |
| M19-S3 | Task Management | Create, assign, track tasks, overdue flagging | M19-S2 | P0 |
| M19-S4 | Meetings | Schedule meetings, record agenda and minutes | M19-S2 | P1 |
| M19-S5 | Reports | Periodic committee reports to org leadership | M19-S2 | P1 |
| M19-S6 | Term Management | Standing auto-renew, ad-hoc/special expiry | M19-S1 | P1 |
| M19-S7 | Cascading Removal | MemberRemoved event handler for cross-module cleanup | M19-S2, M05 | P1 |

## 20. AI Instructions

When implementing this module:
1. Schema files: `services/api-ts/src/handlers/association:operations/repos/committee.schema.ts` (committee, committee_member) and `committee-task.schema.ts` (committee_task). Meeting schema may need a new file.
2. TypeSpec first: define endpoints in `specs/api/src/modules/committee.tsp`.
3. Follow Router -> Validators -> Handlers -> Repositories pattern per ARCHITECTURE.md.
4. Chairperson is required on creation (M19-R1) -- enforce in both validator and handler.
5. Dissolution (BR-39): set status to `dissolved`, populate `dissolvedAt`/`dissolvedBy`/`dissolutionReason`. Do NOT delete any records.
6. Task overdue detection: implement as a scheduled job (cron) that checks `dueDate < now()` for non-completed tasks and emits `TaskOverdue` events.
7. Standing committee auto-renewal (M19-R2): scheduled job extends term dates before expiry.
8. Cascading member removal (M19-R4): subscribe to `MemberRemoved` domain event from M05; set `active = false` and `removedAt` on all matching CommitteeMember records.
9. Implement vertical slices: M19-S1 first (CRUD), then M19-S2 (membership), then M19-S3 (tasks).

## 21. Section Completeness

| Section | Status | Notes |
|---------|--------|-------|
| 1. Module Overview | COMPLETE | |
| 2. Domain Terms | PARTIAL | Committee, Chairperson not in DOMAIN_GLOSSARY -- tagged [INFERRED] |
| 3. Workflows | COMPLETE | From WORKFLOW_MAP |
| 4. Workflow Details | COMPLETE | All 5 workflows detailed |
| 5. Business Rules | COMPLETE | BR-39 from upstream; M19-R1 through R6 module-specific |
| 6. Permissions | COMPLETE | From existing v1.0 spec (matches WORKFLOW_MAP CRUD matrix) |
| 7. Data Requirements | COMPLETE | From DOMAIN_MODEL section 4d |
| 7b. Aggregate Boundaries | COMPLETE | |
| 8. State Transitions | COMPLETE | Committee + Task state machines |
| 9. UI/UX Requirements | COMPLETE | Full state coverage, 3 screens |
| 10. API Expectations | COMPLETE | Expanded with full CRUD endpoints |
| 10b. Domain Events | COMPLETE | Published + consumed events |
| 11. Acceptance Criteria | COMPLETE | Given/When/Then format |
| 12. Test Expectations | COMPLETE | |
| 13. Edge Cases | COMPLETE | |
| 14. Dependencies | COMPLETE | From MODULE_MAP |
| 15. Error Handling | COMPLETE | |
| 16. Performance | COMPLETE | |
| 17. Observability | COMPLETE | |
| 18. Feature Flags | COMPLETE | |
| 19. Vertical Slice Plan | COMPLETE | Added M19-S7 cascading removal |
| 20. AI Instructions | COMPLETE | |
| 21. Section Completeness | COMPLETE | |
| 22. Downstream Impact | COMPLETE | |

## 22. Downstream Impact

- **DOMAIN_GLOSSARY.md**: Needs `Committee`, `Standing Committee`, `Ad-Hoc Committee`, `Special Committee`, `Chairperson` term definitions
- **DOMAIN_MODEL.md**: `CommitteeMeeting` table not yet defined -- needs addition
- **ROLE_PERMISSION_MATRIX.md**: Needs section 3.x for Committee Management module
- **M05 (Membership)**: Must publish `MemberRemoved` event for cascading committee removal
- **API_CONTRACTS.md**: Committee endpoints not yet defined -- will need TypeSpec definitions
