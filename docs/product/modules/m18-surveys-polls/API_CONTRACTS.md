<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts -- Surveys & Polls (M18)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/org/:organizationId/surveys` (officer), `/my/surveys` (member) |
| Auth default | Authenticated session (GA); officer routes require GA+HG |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | `associationId` from session; `organizationId` from path param |

---

## 2. Endpoints

### 2.1 Surveys (Officer Management)

#### GET `/org/:organizationId/surveys`

**List surveys for the organization**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, secretary, officer) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-100 |
| Business rules | -- |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[status] | string | No | Filter by status: `draft`, `active`, `closed` |
| filter[type] | string | No | Filter by type: `anonymous`, `identified` |
| sort | string | No | Sort field (default: `-createdAt`). Options: `title`, `-title`, `deadline`, `-deadline`, `createdAt`, `-createdAt` |
| limit | number | No | Page size (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Array of survey objects |
| data[].id | string | No | uuid | Survey ID |
| data[].title | string | No | -- | Survey title |
| data[].type | string | No | enum | `anonymous` or `identified` |
| data[].status | string | No | enum | `draft`, `active`, `closed` |
| data[].deadline | string | No | date-time | Response deadline (ISO 8601 UTC) |
| data[].responseCount | number | No | integer | Number of responses received |
| data[].createdBy | string | No | uuid | Officer who created |
| data[].createdAt | string | No | date-time | ISO 8601 UTC |
| meta.cursor | string | Yes | -- | Opaque cursor |
| meta.hasMore | boolean | No | -- | More results exist |
| meta.total | number | Yes | -- | Total count |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer in this org |
| `VALIDATION-007` | 400 | Invalid query parameter |

---

#### POST `/org/:organizationId/surveys`

**Create a new survey**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, secretary, officer) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-100 |
| Business rules | -- |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | Yes | No | -- | 1-300 chars | -- | `"Q3 2026 Member Satisfaction Survey"` |
| description | string | No | Yes | -- | Max 5000 chars | `null` | `"Help us improve our services"` |
| type | string | Yes | No | enum | `anonymous`, `identified` | -- | `"anonymous"` |
| deadline | string | Yes | No | date-time | Must be in the future | -- | `"2026-07-01T00:00:00.000Z"` |
| questions | array | Yes | No | -- | Min 1 question, max 50 | -- | See question schema below |
| questions[].id | string | Yes | No | uuid | Unique within survey | -- | `"q_550e8400..."` |
| questions[].type | string | Yes | No | enum | `multiple_choice`, `rating_scale`, `free_text`, `checkbox` | -- | `"multiple_choice"` |
| questions[].label | string | Yes | No | -- | 1-500 chars | -- | `"How satisfied are you?"` |
| questions[].options | array | Conditional | No | string[] | Required for `multiple_choice`, `checkbox`. Min 2, max 20 | -- | `["Very satisfied", "Satisfied", "Neutral"]` |
| questions[].required | boolean | No | No | -- | -- | `true` | `true` |
| questions[].ratingMin | number | Conditional | No | integer | Required for `rating_scale`. Min 1 | `1` | `1` |
| questions[].ratingMax | number | Conditional | No | integer | Required for `rating_scale`. Max 10 | `5` | `5` |
| distribution | object | Yes | No | -- | Target audience config | -- | See below |
| distribution.type | string | Yes | No | enum | `all`, `category`, `manual` | -- | `"all"` |
| distribution.categoryFilter | string | Conditional | Yes | -- | Required when type is `category` | `null` | `"regular"` |
| distribution.memberIds | array | Conditional | No | uuid[] | Required when type is `manual` | -- | `["uuid1", "uuid2"]` |
| allowReEdit | boolean | No | No | -- | -- | `true` | `true` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Survey ID |
| data.title | string | No | -- | Survey title |
| data.type | string | No | enum | Survey type |
| data.status | string | No | enum | `draft` |
| data.deadline | string | No | date-time | Deadline |
| data.questionCount | number | No | integer | Number of questions |
| data.createdAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `VALIDATION-002` | 400 | Missing required field (title, type, deadline, questions) |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer in this org |

---

#### GET `/org/:organizationId/surveys/:surveyId`

**Get survey detail**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, secretary, officer) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-100 |
| Business rules | -- |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Survey ID |
| data.title | string | No | -- | Survey title |
| data.description | string | Yes | -- | Description |
| data.type | string | No | enum | `anonymous` or `identified` |
| data.status | string | No | enum | Current status |
| data.deadline | string | No | date-time | Deadline |
| data.questions | array | No | -- | Question definitions |
| data.distribution | object | No | -- | Target audience config |
| data.allowReEdit | boolean | No | -- | Whether re-edit is enabled |
| data.responseCount | number | No | integer | Response count |
| data.createdBy | string | No | uuid | Creator person ID |
| data.createdAt | string | No | date-time | ISO 8601 UTC |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Survey not found |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer in this org |

---

#### PUT `/org/:organizationId/surveys/:surveyId`

**Update a draft survey**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, secretary, officer) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-100 |
| Business rules | -- |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| title | string | No | No | -- | 1-300 chars | -- | `"Updated Survey Title"` |
| description | string | No | Yes | -- | Max 5000 chars | -- | `"Updated description"` |
| deadline | string | No | No | date-time | Must be in the future | -- | `"2026-08-01T00:00:00.000Z"` |
| questions | array | No | No | -- | Min 1, max 50 | -- | See create schema |
| distribution | object | No | No | -- | Target audience config | -- | See create schema |
| allowReEdit | boolean | No | No | -- | -- | -- | `false` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Survey ID |
| data.title | string | No | -- | Updated title |
| data.status | string | No | enum | `draft` |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `NOT_FOUND-001` | 404 | Survey not found |
| `CONFLICT-003` | 409 | Survey is not in `draft` status |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer in this org |

---

#### POST `/org/:organizationId/surveys/:surveyId/publish`

**Publish a draft survey (draft -> active)**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, secretary, officer) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-100 |
| Business rules | M18-R5 |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Survey ID |
| data.status | string | No | enum | `active` |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Survey has no questions |
| `VALIDATION-002` | 400 | Survey has no deadline set |
| `CONFLICT-003` | 409 | Survey is not in `draft` status |
| `NOT_FOUND-001` | 404 | Survey not found |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer in this org |

---

#### POST `/org/:organizationId/surveys/:surveyId/close`

**Manually close an active survey**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, secretary, officer) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-100 |
| Business rules | -- |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Survey ID |
| data.status | string | No | enum | `closed` |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `CONFLICT-003` | 409 | Survey is not in `active` status |
| `NOT_FOUND-001` | 404 | Survey not found |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer in this org |

---

### 2.2 Survey Results (Officer)

#### GET `/org/:organizationId/surveys/:surveyId/results`

**Get aggregated survey results**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, secretary, officer) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-102 |
| Business rules | M18-R2 |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.surveyId | string | No | uuid | Survey ID |
| data.title | string | No | -- | Survey title |
| data.type | string | No | enum | `anonymous` or `identified` |
| data.status | string | No | enum | Current status |
| data.totalResponses | number | No | integer | Total response count |
| data.eligibleCount | number | Yes | integer | Eligible member count (if computable) |
| data.questions | array | No | -- | Per-question aggregated results |
| data.questions[].questionId | string | No | uuid | Question ID |
| data.questions[].label | string | No | -- | Question label |
| data.questions[].type | string | No | enum | Question type |
| data.questions[].responseCount | number | No | integer | Responses for this question |
| data.questions[].aggregation | object | No | -- | Type-specific aggregation |
| data.questions[].aggregation.choices | array | Yes | -- | For MC/checkbox: `[{option, count, percentage}]` |
| data.questions[].aggregation.average | number | Yes | decimal | For rating: average score |
| data.questions[].aggregation.distribution | object | Yes | -- | For rating: `{1: count, 2: count, ...}` |
| data.questions[].aggregation.responses | array | Yes | -- | For free text: `[{text, submittedAt}]` |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Survey not found |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer in this org |

---

#### GET `/org/:organizationId/surveys/:surveyId/results/export`

**Export survey results as CSV**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, secretary, officer) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-102 |
| Business rules | M18-R2 |

**Response** `200 OK` (`Content-Type: text/csv`)

Returns CSV file as download. For anonymous surveys, no respondent identification columns are included. For identified surveys, respondent name/email columns are included.

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Survey not found |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer in this org |

---

#### GET `/org/:organizationId/surveys/:surveyId/responses`

**List individual responses (identified surveys only)**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, secretary, officer -- org only, NOT platform admin) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-102 |
| Business rules | M18-R2, BR-40 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | No | Page size (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Array of individual responses |
| data[].id | string | No | uuid | Response ID |
| data[].respondentId | string | No | uuid | Respondent person ID |
| data[].respondentName | string | No | -- | Respondent display name |
| data[].answers | object | No | -- | JSONB keyed by question ID |
| data[].submittedAt | string | No | date-time | Submission timestamp |
| data[].updatedAt | string | Yes | date-time | Last edit timestamp |
| meta.cursor | string | Yes | -- | Opaque cursor |
| meta.hasMore | boolean | No | -- | More results exist |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Survey not found |
| `M18-004` | 422 | Survey is anonymous -- individual responses not available |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer in this org (or platform admin attempting access) |

---

### 2.3 Survey Responses (Member)

#### GET `/my/surveys`

**List surveys available to the current member**

| Property | Value |
|----------|-------|
| Auth | GA (active member) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-101 |
| Business rules | M18-R5 |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[status] | string | No | Filter: `pending` (not yet responded), `responded`, `closed` |
| limit | number | No | Page size (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Surveys targeted at this member |
| data[].id | string | No | uuid | Survey ID |
| data[].title | string | No | -- | Survey title |
| data[].description | string | Yes | -- | Description |
| data[].type | string | No | enum | `anonymous` or `identified` |
| data[].status | string | No | enum | Survey status |
| data[].deadline | string | No | date-time | Response deadline |
| data[].hasResponded | boolean | No | -- | Whether member has responded |
| data[].canEdit | boolean | No | -- | Whether member can edit response |
| data[].organizationName | string | No | -- | Org name (denormalized) |
| meta.cursor | string | Yes | -- | Opaque cursor |
| meta.hasMore | boolean | No | -- | More results exist |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |

---

#### GET `/my/surveys/:surveyId`

**Get survey detail for responding**

| Property | Value |
|----------|-------|
| Auth | GA (active member, targeted) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-101 |
| Business rules | M18-R5 |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Survey ID |
| data.title | string | No | -- | Survey title |
| data.description | string | Yes | -- | Description |
| data.type | string | No | enum | `anonymous` or `identified` |
| data.status | string | No | enum | Survey status |
| data.deadline | string | No | date-time | Deadline |
| data.questions | array | No | -- | Question definitions |
| data.questions[].id | string | No | uuid | Question ID |
| data.questions[].type | string | No | enum | Question type |
| data.questions[].label | string | No | -- | Question label |
| data.questions[].options | array | Yes | string[] | Options (MC/checkbox) |
| data.questions[].required | boolean | No | -- | Whether required |
| data.questions[].ratingMin | number | Yes | integer | Rating min (rating_scale) |
| data.questions[].ratingMax | number | Yes | integer | Rating max (rating_scale) |
| data.hasResponded | boolean | No | -- | Whether already responded |
| data.existingResponse | object | Yes | -- | Previous response (if exists and re-edit allowed) |
| data.existingResponse.answers | object | Yes | -- | Previous answers |
| data.existingResponse.submittedAt | string | Yes | date-time | Previous submission time |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `NOT_FOUND-001` | 404 | Survey not found |
| `AUTHZ-001` | 403 | Member not targeted for this survey |
| `M18-001` | 422 | Survey is closed |
| `AUTH-001` | 401 | No session |

---

#### POST `/my/surveys/:surveyId/respond`

**Submit a survey response**

| Property | Value |
|----------|-------|
| Auth | GA (active member, targeted) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-101 |
| Business rules | BR-40, M18-R1, M18-R3 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| answers | object | Yes | No | -- | JSONB keyed by question ID; all required questions must have answers | -- | `{"q_abc": "Option A", "q_def": 4}` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Response ID |
| data.surveyId | string | No | uuid | Survey ID |
| data.submittedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid answers format |
| `VALIDATION-002` | 400 | Required question not answered |
| `M18-001` | 422 | Survey is closed |
| `M18-002` | 422 | Already responded (re-edit disabled) |
| `M18-003` | 422 | Survey deadline passed |
| `NOT_FOUND-001` | 404 | Survey not found |
| `AUTHZ-001` | 403 | Member not targeted for this survey |
| `AUTH-001` | 401 | No session |

---

#### PUT `/my/surveys/:surveyId/respond`

**Edit an existing survey response**

| Property | Value |
|----------|-------|
| Auth | GA (active member, targeted) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-101 |
| Business rules | BR-40, M18-R1, M18-R3 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| answers | object | Yes | No | -- | JSONB keyed by question ID | -- | `{"q_abc": "Option B", "q_def": 5}` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Response ID |
| data.surveyId | string | No | uuid | Survey ID |
| data.updatedAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid answers format |
| `M18-001` | 422 | Survey is closed |
| `M18-003` | 422 | Survey deadline passed |
| `M18-004` | 422 | Anonymous survey responses cannot be modified |
| `NOT_FOUND-001` | 404 | No existing response found |
| `AUTHZ-001` | 403 | Re-edit disabled for this survey |
| `AUTH-001` | 401 | No session |

---

### 2.4 Quick Polls (Officer/Member)

#### POST `/org/:organizationId/polls`

**Create a quick poll**

| Property | Value |
|----------|-------|
| Auth | GA+HG (president, secretary, officer) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-103 |
| Business rules | -- |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| question | string | Yes | No | -- | 1-500 chars | -- | `"Should we hold the annual gala in December?"` |
| options | array | Yes | No | string[] | Min 2, max 10 options; each 1-200 chars | -- | `["Yes", "No", "Undecided"]` |
| deadline | string | Yes | No | date-time | Must be in the future | -- | `"2026-06-15T00:00:00.000Z"` |

**Response** `201 Created`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.id | string | No | uuid | Poll ID |
| data.question | string | No | -- | Poll question |
| data.options | array | No | string[] | Options |
| data.status | string | No | enum | `active` |
| data.deadline | string | No | date-time | Deadline |
| data.createdAt | string | No | date-time | ISO 8601 UTC |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid request body |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an officer in this org |

---

#### GET `/org/:organizationId/polls`

**List polls for the organization**

| Property | Value |
|----------|-------|
| Auth | GA (active member) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-103 |
| Business rules | -- |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| filter[status] | string | No | Filter: `active`, `closed` |
| limit | number | No | Page size (default: 20, max: 100) |
| after | string | No | Cursor for forward pagination |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data | array | No | -- | Array of poll objects |
| data[].id | string | No | uuid | Poll ID |
| data[].question | string | No | -- | Poll question |
| data[].options | array | No | string[] | Options |
| data[].status | string | No | enum | `active` or `closed` |
| data[].deadline | string | No | date-time | Deadline |
| data[].totalVotes | number | No | integer | Total vote count |
| data[].hasVoted | boolean | No | -- | Whether current member has voted |
| data[].results | object | Yes | -- | Vote distribution (shown after voting, per M18-R4) |
| data[].results.options | array | Yes | -- | `[{option, count, percentage}]` |
| meta.cursor | string | Yes | -- | Opaque cursor |
| meta.hasMore | boolean | No | -- | More results exist |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an active member |

---

#### POST `/org/:organizationId/polls/:pollId/vote`

**Vote on a poll**

| Property | Value |
|----------|-------|
| Auth | GA (active member) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-103 |
| Business rules | M18-R4 |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| option | string | Yes | No | -- | Must match one of the poll options | -- | `"Yes"` |

**Response** `200 OK`

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| data.pollId | string | No | uuid | Poll ID |
| data.totalVotes | number | No | integer | Updated total |
| data.results | object | No | -- | Updated vote distribution |
| data.results.options | array | No | -- | `[{option, count, percentage}]` |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `VALIDATION-001` | 400 | Invalid option |
| `M18-001` | 422 | Poll is closed |
| `M18-002` | 422 | Already voted on this poll |
| `M18-003` | 422 | Poll deadline passed |
| `NOT_FOUND-001` | 404 | Poll not found |
| `AUTH-001` | 401 | No session |
| `AUTHZ-001` | 403 | Not an active member |
