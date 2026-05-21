<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts -- Committee Management (M19)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/org/:organizationId/committees` (org-scoped), `/my/committees` (member) |
| Auth default | Authenticated session (GA); mutations require GA+HG |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | `associationId` from session; `organizationId` from path param |

---

## 2. Endpoints

### 2.1 Committees

#### GET `/org/:organizationId/committees`

**List committees for the organization**

| Property | Value |
|----------|-------|
| Auth | GA (active org member; dissolved committees: officers only) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-104 |
| Business rules | BR-39 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[status] | string | No | Filter by status: `active`, `expired`, `dissolved` |
| filter[type] | string | No | Filter by type: `standing`, `ad_hoc`, `special` |
| search | string | No | Search by committee name (min 2 chars) |
| sort | string | No | Sort field (default: `-createdAt`). Options: `name`, `-name`, `createdAt`, `-createdAt` |
| limit | number | No | Page size (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Array of committee objects |
| data[].id | string | No | uuid | Committee ID |
| data[].name | string | No | -- | Committee name |
| data[].description | string | Yes | -- | Purpose description |
| data[].type | string | No | enum | `standing`, `ad_hoc`, `special` |
| data[].status | string | No | enum | `active`, `expired`, `dissolved` |
| data[].chairpersonId | string | Yes | uuid | Chairperson person ID |
| data[].chairpersonName | string | Yes | -- | Chairperson display name |
| data[].memberCount | number | No | integer | Active member count |
| data[].openTaskCount | number | No | integer | Non-completed task count |
| data[].termStartDate | string | Yes | date | Term start (YYYY-MM-DD) |
| data[].termEndDate | string | Yes | date | Term end (YYYY-MM-DD), null for standing |
| data[].createdAt | string | No | date-time | ISO 8601 UTC |
| meta.cursor | string | Yes | -- | Opaque cursor |
| meta.hasMore | boolean | No | -- | More results exist |
| meta.total | number | Yes | -- | Total count |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an org member |
| `VALIDATION-007` | 400 | Invalid query parameter |

---

#### GET `/org/:organizationId/committees/:committeeId`

**Get committee detail with members and recent tasks**

| Property | Value |
|----------|-------|
| Auth | GA (active org member for active committees; officers for dissolved) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-104 |
| Business rules | BR-39 |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Committee ID |
| data.name | string | No | -- | Committee name |
| data.description | string | Yes | -- | Purpose description |
| data.type | string | No | enum | `standing`, `ad_hoc`, `special` |
| data.status | string | No | enum | Current status |
| data.chairpersonId | string | Yes | uuid | Chairperson person ID |
| data.chairpersonName | string | Yes | -- | Chairperson display name |
| data.termStartDate | string | Yes | date | Term start |
| data.termEndDate | string | Yes | date | Term end |
| data.dissolvedAt | string | Yes | date-time | Dissolution timestamp |
| data.dissolvedBy | string | Yes | uuid | Person who dissolved |
| data.dissolutionReason | string | Yes | -- | Reason for dissolution |
| data.members | array | No | -- | Active committee members |
| data.members[].id | string | No | uuid | CommitteeMember ID |
| data.members[].personId | string | No | uuid | Person ID |
| data.members[].personName | string | No | -- | Display name |
| data.members[].role | string | No | enum | `chairperson`, `vice_chair`, `secretary`, `member` |
| data.members[].assignedAt | string | No | date-time | Date added |
| data.recentTasks | array | No | -- | Recent tasks (last 10) |
| data.recentTasks[].id | string | No | uuid | Task ID |
| data.recentTasks[].title | string | No | -- | Task title |
| data.recentTasks[].status | string | No | enum | Task status |
| data.recentTasks[].priority | string | No | enum | Priority |
| data.recentTasks[].dueDate | string | Yes | date-time | Due date |
| data.recentTasks[].isOverdue | boolean | No | -- | Whether past due |
| data.createdAt | string | No | date-time | ISO 8601 UTC |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Committee not found |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an org member (or member viewing dissolved committee) |

---

#### POST `/org/:organizationId/committees`

**Create a new committee**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, vice-president, secretary) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-104 |
| Business rules | M19-R1 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| name | string | Yes | No | -- | 1-200 chars | -- | `"Ethics Review Committee"` |
| description | string | No | Yes | -- | Max 5000 chars | `null` | `"Reviews ethics complaints and recommends actions"` |
| type | string | Yes | No | enum | `standing`, `ad_hoc`, `special` | -- | `"standing"` |
| chairpersonId | string | Yes | No | uuid | Must be active org member | -- | `"550e8400-e29b-41d4-a716-446655440000"` |
| termStartDate | string | No | Yes | date | YYYY-MM-DD | Today | `"2026-06-01"` |
| termEndDate | string | No | Yes | date | YYYY-MM-DD, must be after start | `null` (standing = ongoing) | `"2027-05-31"` |
| initialMemberIds | array | No | No | uuid[] | Active org member UUIDs | `[]` | `["uuid1", "uuid2"]` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Committee ID |
| data.name | string | No | -- | Committee name |
| data.type | string | No | enum | Committee type |
| data.status | string | No | enum | `active` |
| data.chairpersonId | string | No | uuid | Chairperson person ID |
| data.memberCount | number | No | integer | Initial member count |
| data.createdAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `VALIDATION-002` | 400 | Missing required field (name, type, chairpersonId) |
| `M19-001` | 422 | No chairperson specified (BR-39) |
| `NOT_FOUND-001` | 404 | Chairperson person ID not found in org |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not president or authorized officer |

---

#### PUT `/org/:organizationId/committees/:committeeId`

**Update committee details**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, vice-president, secretary, chairperson) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-104 |
| Business rules | M19-R5 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| name | string | No | No | -- | 1-200 chars | -- | `"Updated Committee Name"` |
| description | string | No | Yes | -- | Max 5000 chars | -- | `"Updated purpose"` |
| termEndDate | string | No | Yes | date | YYYY-MM-DD | -- | `"2027-12-31"` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Committee ID |
| data.name | string | No | -- | Updated name |
| data.description | string | Yes | -- | Updated description |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `NOT_FOUND-001` | 404 | Committee not found |
| `M19-005` | 422 | Committee expired -- renewal required |
| `M19-007` | 422 | Committee is dissolved |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Insufficient permissions |

---

#### POST `/org/:organizationId/committees/:committeeId/dissolve`

**Dissolve a committee**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, chairperson) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-108 |
| Business rules | BR-39, M19-R5 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| reason | string | Yes | No | -- | 1-2000 chars | -- | `"Committee objectives achieved"` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Committee ID |
| data.status | string | No | enum | `dissolved` |
| data.dissolvedAt | string | No | date-time | Dissolution timestamp |
| data.dissolvedBy | string | No | uuid | Person who dissolved |
| data.dissolutionReason | string | No | -- | Reason |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `NOT_FOUND-001` | 404 | Committee not found |
| `CONFLICT-003` | 409 | Committee already dissolved |
| `M19-003` | 422 | Committee has open tasks (warning -- proceed with confirmation) |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not president or chairperson |

---

### 2.2 Committee Members

#### GET `/org/:organizationId/committees/:committeeId/members`

**List committee members**

| Property | Value |
|----------|-------|
| Auth | GA (active org member) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-105 |
| Business rules | -- |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[active] | boolean | No | Filter active/inactive members (default: `true`) |
| limit | number | No | Page size (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Array of committee member objects |
| data[].id | string | No | uuid | CommitteeMember ID |
| data[].personId | string | No | uuid | Person ID |
| data[].personName | string | No | -- | Display name |
| data[].role | string | No | enum | `chairperson`, `vice_chair`, `secretary`, `member` |
| data[].active | boolean | No | -- | Currently active |
| data[].assignedAt | string | No | date-time | Date added |
| data[].removedAt | string | Yes | date-time | Date removed (if inactive) |
| meta.cursor | string | Yes | -- | Opaque cursor |
| meta.hasMore | boolean | No | -- | More results exist |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Committee not found |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an org member |

---

#### POST `/org/:organizationId/committees/:committeeId/members`

**Add a member to the committee**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, vice-president, secretary, chairperson) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-105 |
| Business rules | M19-R6 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| personId | string | Yes | No | uuid | Must be active org member | -- | `"550e8400-e29b-41d4-a716-446655440000"` |
| role | string | No | No | enum | `chairperson`, `vice_chair`, `secretary`, `member` | `"member"` | `"secretary"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | CommitteeMember ID |
| data.committeeId | string | No | uuid | Committee ID |
| data.personId | string | No | uuid | Person ID |
| data.role | string | No | enum | Assigned role |
| data.assignedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `NOT_FOUND-001` | 404 | Committee or person not found |
| `M19-002` | 422 | Person already a member of this committee |
| `M19-007` | 422 | Committee is dissolved -- cannot add members |
| `M19-004` | 422 | Person is not an active org member |
| `M19-006` | 422 | Chairperson removal blocked -- leaderless state (when reassigning) |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not president, VP, secretary, or chairperson |

---

#### DELETE `/org/:organizationId/committees/:committeeId/members/:memberId`

**Remove a member from the committee**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, vice-president, secretary, chairperson) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-105 |
| Business rules | M19-R6 |

**Response** `204 No Content`

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Committee or member not found |
| `M19-006` | 422 | Cannot remove chairperson -- leaderless state would result. Assign new chairperson first. |
| `M19-007` | 422 | Committee is dissolved |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not president, VP, secretary, or chairperson |

---

### 2.3 Committee Tasks

#### GET `/org/:organizationId/committees/:committeeId/tasks`

**List tasks for a committee**

| Property | Value |
|----------|-------|
| Auth | GA (committee member or org officer) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-106 |
| Business rules | M19-R3 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[status] | string | No | Filter: `pending`, `in_progress`, `completed` |
| filter[priority] | string | No | Filter: `low`, `medium`, `high` |
| filter[assigneeId] | string | No | Filter by assignee person ID |
| filter[isOverdue] | boolean | No | Filter overdue tasks only |
| sort | string | No | Sort field (default: `-createdAt`). Options: `dueDate`, `-dueDate`, `priority`, `-priority`, `createdAt`, `-createdAt` |
| limit | number | No | Page size (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Array of task objects |
| data[].id | string | No | uuid | Task ID |
| data[].committeeId | string | No | uuid | Committee ID |
| data[].title | string | No | -- | Task title |
| data[].description | string | Yes | -- | Task description |
| data[].assigneeId | string | Yes | uuid | Assignee person ID |
| data[].assigneeName | string | Yes | -- | Assignee display name |
| data[].status | string | No | enum | `pending`, `in_progress`, `completed` |
| data[].priority | string | No | enum | `low`, `medium`, `high` |
| data[].dueDate | string | Yes | date-time | Due date |
| data[].isOverdue | boolean | No | -- | Whether past due and not completed |
| data[].completedAt | string | Yes | date-time | Completion timestamp |
| data[].createdAt | string | No | date-time | ISO 8601 UTC |
| meta.cursor | string | Yes | -- | Opaque cursor |
| meta.hasMore | boolean | No | -- | More results exist |
| meta.total | number | Yes | -- | Total count |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Committee not found |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not a committee member or org officer |
| `VALIDATION-007` | 400 | Invalid query parameter |

---

#### POST `/org/:organizationId/committees/:committeeId/tasks`

**Create a task**

| Property | Value |
|----------|-------|
| Auth | GA+HG (chairperson, or committee member if configured) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-106 |
| Business rules | M19-R5 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | Yes | No | -- | 1-300 chars | -- | `"Draft ethics guidelines document"` |
| description | string | No | Yes | -- | Max 5000 chars | `null` | `"Create initial draft for review"` |
| assigneeId | string | No | Yes | uuid | Must be active committee member | `null` | `"550e8400-e29b-41d4-a716-446655440000"` |
| dueDate | string | No | Yes | date-time | Must be in the future | `null` | `"2026-07-15T00:00:00.000Z"` |
| priority | string | No | No | enum | `low`, `medium`, `high` | `"medium"` | `"high"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Task ID |
| data.committeeId | string | No | uuid | Committee ID |
| data.title | string | No | -- | Task title |
| data.status | string | No | enum | `pending` |
| data.priority | string | No | enum | Priority |
| data.assigneeId | string | Yes | uuid | Assignee |
| data.dueDate | string | Yes | date-time | Due date |
| data.createdAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `NOT_FOUND-001` | 404 | Committee not found |
| `M19-004` | 422 | Assignee is not an active committee member |
| `M19-007` | 422 | Committee is dissolved -- cannot create tasks |
| `M19-005` | 422 | Committee expired -- renewal required |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not chairperson or authorized committee member |

---

#### PUT `/org/:organizationId/committees/:committeeId/tasks/:taskId`

**Update a task (status, assignee, details)**

| Property | Value |
|----------|-------|
| Auth | GA+HG (chairperson, board-member, officer, or assigned member for status only) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-106 |
| Business rules | M19-R3 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | No | No | -- | 1-300 chars | -- | `"Updated title"` |
| description | string | No | Yes | -- | Max 5000 chars | -- | `"Updated description"` |
| assigneeId | string | No | Yes | uuid | Must be active committee member | -- | `"uuid"` |
| status | string | No | No | enum | `pending`, `in_progress`, `completed` | -- | `"in_progress"` |
| priority | string | No | No | enum | `low`, `medium`, `high` | -- | `"high"` |
| dueDate | string | No | Yes | date-time | -- | -- | `"2026-08-01T00:00:00.000Z"` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Task ID |
| data.title | string | No | -- | Updated title |
| data.status | string | No | enum | Updated status |
| data.priority | string | No | enum | Updated priority |
| data.assigneeId | string | Yes | uuid | Assignee |
| data.dueDate | string | Yes | date-time | Due date |
| data.completedAt | string | Yes | date-time | Set when status becomes `completed` |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `NOT_FOUND-001` | 404 | Task not found |
| `CONFLICT-003` | 409 | Invalid status transition (e.g., completed -> pending) |
| `M19-004` | 422 | Assignee is not an active committee member |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Insufficient permissions |

---

### 2.4 Committee Meetings

#### GET `/org/:organizationId/committees/:committeeId/meetings`

**List meetings for a committee**

| Property | Value |
|----------|-------|
| Auth | GA (committee member or org officer) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-107 |
| Business rules | -- |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| sort | string | No | Sort field (default: `-scheduledAt`) |
| limit | number | No | Page size (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Array of meeting objects |
| data[].id | string | No | uuid | Meeting ID |
| data[].committeeId | string | No | uuid | Committee ID |
| data[].scheduledAt | string | No | date-time | Meeting date/time |
| data[].agenda | string | Yes | -- | Meeting agenda |
| data[].minutes | string | Yes | -- | Meeting minutes (null if not yet recorded) |
| data[].hasMinutes | boolean | No | -- | Whether minutes have been recorded |
| data[].createdBy | string | No | uuid | Person who scheduled |
| data[].createdAt | string | No | date-time | ISO 8601 UTC |
| meta.cursor | string | Yes | -- | Opaque cursor |
| meta.hasMore | boolean | No | -- | More results exist |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Committee not found |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not a committee member or org officer |

---

#### POST `/org/:organizationId/committees/:committeeId/meetings`

**Schedule a meeting**

| Property | Value |
|----------|-------|
| Auth | GA+HG (chairperson) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-107 |
| Business rules | M19-R5 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| scheduledAt | string | Yes | No | date-time | Must be in the future | -- | `"2026-07-01T14:00:00.000Z"` |
| agenda | string | No | Yes | -- | Max 10000 chars | `null` | `"1. Review ethics cases\n2. Draft guidelines"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Meeting ID |
| data.committeeId | string | No | uuid | Committee ID |
| data.scheduledAt | string | No | date-time | Meeting date/time |
| data.agenda | string | Yes | -- | Agenda |
| data.createdAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `NOT_FOUND-001` | 404 | Committee not found |
| `M19-007` | 422 | Committee is dissolved |
| `M19-005` | 422 | Committee expired -- renewal required |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not chairperson |

---

#### PUT `/org/:organizationId/committees/:committeeId/meetings/:meetingId`

**Update meeting (add minutes)**

| Property | Value |
|----------|-------|
| Auth | GA+HG (chairperson) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-107 |
| Business rules | -- |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| scheduledAt | string | No | No | date-time | -- | -- | `"2026-07-01T15:00:00.000Z"` |
| agenda | string | No | Yes | -- | Max 10000 chars | -- | `"Updated agenda"` |
| minutes | string | No | Yes | -- | Max 50000 chars | -- | `"Meeting called to order at 2pm..."` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Meeting ID |
| data.scheduledAt | string | No | date-time | Meeting date/time |
| data.agenda | string | Yes | -- | Agenda |
| data.minutes | string | Yes | -- | Minutes |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `NOT_FOUND-001` | 404 | Meeting not found |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not chairperson |

---

### 2.5 My Committees (Member)

#### GET `/my/committees`

**List committees the current member belongs to**

| Property | Value |
|----------|-------|
| Auth | GA (any authenticated member) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | -- |
| Business rules | -- |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[status] | string | No | Filter: `active`, `expired` |
| limit | number | No | Page size (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Committees the member belongs to |
| data[].id | string | No | uuid | Committee ID |
| data[].name | string | No | -- | Committee name |
| data[].type | string | No | enum | Committee type |
| data[].status | string | No | enum | Committee status |
| data[].role | string | No | enum | Member's role in this committee |
| data[].organizationId | string | No | uuid | Org ID |
| data[].organizationName | string | No | -- | Org name |
| data[].chairpersonName | string | Yes | -- | Chairperson name |
| data[].assignedTaskCount | number | No | integer | Tasks assigned to this member |
| data[].overdueTaskCount | number | No | integer | Overdue tasks assigned to this member |
| meta.cursor | string | Yes | -- | Opaque cursor |
| meta.hasMore | boolean | No | -- | More results exist |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
