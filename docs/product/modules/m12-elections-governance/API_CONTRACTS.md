<!-- oli:api-contracts v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, DOMAIN_MODEL.md, WORKFLOW_MAP.md -->
# API Contracts — Elections & Governance (M12)

> Source: MODULE_SPEC.md v2.0 | Conventions: API_CONVENTIONS.md | Errors: ERROR_TAXONOMY.md

---

## 1. Module Summary

| Property | Value |
|----------|-------|
| Base path | `/orgs/:organizationId/elections` |
| Auth default | GA (member reads); GA+HG (officer mutations); GA + BR-33 (voting) |
| Rate limit tier | Authenticated (120 req/min) |
| Tenant scoping | Implicit `associationId` from session; `organizationId` as path param |

---

## 2. Endpoints

### 2.1 Elections

#### GET `/orgs/:organizationId/elections`

**List elections for an organization**

| Property | Value |
|----------|-------|
| Auth | GA — all authenticated org members |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-076: Create & Run Election |
| Business rules | — |

**Query Parameters**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `filter[status]` | string | NO | Comma-separated: `draft,nominationsOpen,votingOpen,awaitingConfirmation,published,cancelled` |
| `filter[type]` | string | NO | `officer`, `bylaw` |
| `sort` | string | NO | Default: `-createdAt`. Allowed: `votingOpenAt`, `createdAt` |
| `limit` | number | NO | Page size (default: 20, max: 100) |
| `after` | string | NO | Cursor for forward pagination |

**Response** `200 OK`

```json
{
  "data": [
    {
      "id": "uuid",
      "organizationId": "uuid",
      "type": "officer",
      "status": "votingOpen",
      "title": "2026 Officer Elections",
      "description": "Annual election of chapter officers",
      "votingMode": "online",
      "nominationsOpenAt": "2026-05-01T00:00:00.000Z",
      "nominationsCloseAt": "2026-05-15T23:59:59.000Z",
      "votingOpenAt": "2026-05-16T00:00:00.000Z",
      "votingCloseAt": "2026-05-31T23:59:59.000Z",
      "createdBy": "uuid",
      "createdAt": "2026-04-15T00:00:00.000Z",
      "updatedAt": "2026-05-16T00:00:00.000Z"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImFiYyJ9",
    "hasMore": false,
    "total": 3
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Election ID |
| organizationId | string | NO | uuid | Organization |
| type | string | NO | enum | `officer` or `bylaw` |
| status | string | NO | enum | `draft`, `nominationsOpen`, `votingOpen`, `awaitingConfirmation`, `published`, `cancelled` |
| title | string | NO | — | Election title |
| description | string | YES | — | Election description |
| votingMode | string | NO | enum | `online`, `inPerson`, `hybrid` |
| nominationsOpenAt | string | NO | ISO 8601 | Nominations start |
| nominationsCloseAt | string | NO | ISO 8601 | Nominations end |
| votingOpenAt | string | NO | ISO 8601 | Voting start |
| votingCloseAt | string | NO | ISO 8601 | Voting end |
| createdBy | string | NO | uuid | Officer who created |
| createdAt | string | NO | ISO 8601 | Creation timestamp |
| updatedAt | string | NO | ISO 8601 | Last modified |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-002` | 403 | Not a member of target org |

---

#### POST `/orgs/:organizationId/elections`

**Create a new election**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-076: Create & Run Election |
| Business rules | — |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| type | string | YES | NO | enum | `officer`, `bylaw` | — | "officer" |
| title | string | YES | NO | — | non-empty, max 300 chars | — | "2026 Officer Elections" |
| description | string | NO | YES | — | max 2000 chars | null | "Annual election..." |
| votingMode | string | YES | NO | enum | `online`, `inPerson`, `hybrid` | — | "online" |
| positions | array | YES (officer) | NO | — | array of position UUIDs; required if type=officer | — | ["uuid-president", "uuid-secretary"] |
| nominationsOpenAt | string | YES | NO | ISO 8601 | must be in the future | — | "2026-05-01T00:00:00.000Z" |
| nominationsCloseAt | string | YES | NO | ISO 8601 | must be after nominationsOpenAt | — | "2026-05-15T23:59:59.000Z" |
| votingOpenAt | string | YES | NO | ISO 8601 | must be >= nominationsCloseAt | — | "2026-05-16T00:00:00.000Z" |
| votingCloseAt | string | YES | NO | ISO 8601 | must be after votingOpenAt | — | "2026-05-31T23:59:59.000Z" |
| bylawProposal | string | YES (bylaw) | NO | — | required if type=bylaw; the proposal text | — | "Amend Article III..." |

**Response** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "status": "draft",
    "...": "full election object"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-001` | 403 | Not authorized (only president/admin/super) |
| `VALIDATION-001` | 400 | Invalid request body |
| `VALIDATION-003` | 400 | Invalid date format |

---

#### GET `/orgs/:organizationId/elections/:electionId`

**Get election detail with nominees and results**

| Property | Value |
|----------|-------|
| Auth | GA — all authenticated org members |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-076, WF-077 |
| Business rules | M12-R2 (results immutable after published) |

**Response** `200 OK`

```json
{
  "data": {
    "id": "uuid",
    "organizationId": "uuid",
    "type": "officer",
    "status": "published",
    "title": "2026 Officer Elections",
    "description": "Annual election of chapter officers",
    "votingMode": "online",
    "nominationsOpenAt": "2026-05-01T00:00:00.000Z",
    "nominationsCloseAt": "2026-05-15T23:59:59.000Z",
    "votingOpenAt": "2026-05-16T00:00:00.000Z",
    "votingCloseAt": "2026-05-31T23:59:59.000Z",
    "createdBy": "uuid",
    "positions": [
      {
        "positionId": "uuid",
        "positionTitle": "President",
        "nominees": [
          {
            "id": "uuid",
            "personId": "uuid",
            "personName": "Dr. Maria Santos",
            "nominatedBy": "uuid",
            "status": "accepted",
            "voteCount": 85
          }
        ],
        "winnerId": "uuid"
      }
    ],
    "totalVoters": 150,
    "totalVotesCast": 120,
    "turnoutPercentage": 80.0,
    "createdAt": "2026-04-15T00:00:00.000Z",
    "updatedAt": "2026-06-01T00:00:00.000Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| positions | array | NO | — | Positions with nominees (officer elections) |
| positions[].positionId | string | NO | uuid | Position ID (from M04) |
| positions[].positionTitle | string | NO | — | Position name |
| positions[].nominees | array | NO | — | Nominees for this position |
| positions[].nominees[].id | string | NO | uuid | Nominee record ID |
| positions[].nominees[].personId | string | NO | uuid | Nominee person ID |
| positions[].nominees[].personName | string | NO | — | Nominee display name |
| positions[].nominees[].nominatedBy | string | NO | uuid | Who nominated (self or other) |
| positions[].nominees[].status | string | NO | enum | `nominated`, `accepted`, `declined`, `withdrawn` |
| positions[].nominees[].voteCount | number | YES | integer | Vote count (only in published/awaitingConfirmation) |
| positions[].winnerId | string | YES | uuid | Winner nominee ID (only in published) |
| totalVoters | number | YES | integer | Eligible voter count (only when voting started) |
| totalVotesCast | number | YES | integer | Ballots submitted |
| turnoutPercentage | number | YES | decimal | Voter turnout % |

**Note:** Individual vote choices are NEVER exposed. Only aggregate counts are returned (secret ballot).

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `NOT_FOUND-001` | 404 | Election not found |
| `AUTHZ-002` | 403 | Not a member of target org |

---

#### PATCH `/orgs/:organizationId/elections/:electionId/status`

**Transition election status**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-076: Create & Run Election, WF-079: Election-to-Officer Transition |
| Business rules | M12-R2 (published immutable), M12-R4 (nomination window), M12-R6 (min 2 candidates) |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| status | string | YES | NO | enum | Valid target per state machine | — | "nominationsOpen" |

**Valid Transitions:**

| From | Allowed Targets |
|------|----------------|
| `draft` | `nominationsOpen`, `cancelled` |
| `nominationsOpen` | `votingOpen`, `cancelled` |
| `votingOpen` | `awaitingConfirmation`, `cancelled` |
| `awaitingConfirmation` | `published`, `cancelled` |
| `published` | (none — terminal) |
| `cancelled` | (none — terminal) |

**Response** `200 OK`

```json
{
  "data": { "id": "uuid", "status": "nominationsOpen", "...": "full election object" }
}
```

**Side Effects**
- `nominationsOpen` or `votingOpen`: Emits `ElectionOpened` event, triggers M07 notification
- `published`: Emits `ElectionPublished` event with winners, triggers M04 officer transition
- `cancelled`: Emits `ElectionCancelled` event, all votes voided, triggers M07 notification

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-001` | 403 | Not authorized |
| `NOT_FOUND-001` | 404 | Election not found |
| `M12-009` | 422 | Invalid election status transition |
| `M12-001` | 422 | Election is not in nomination phase (attempted action requires nominations) |
| `M12-003` | 422 | Voting period not open |
| `M12-006` | 422 | Cannot modify published election results |
| `CONFLICT-003` | 409 | Invalid state transition |

---

#### DELETE `/orgs/:organizationId/elections/:electionId`

**Delete an election (draft or cancelled only)**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), VP, secretary (2FA), treasurer (2FA), board-member, officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-076 |
| Business rules | — |

**Response** `204 No Content`

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-001` | 403 | Not authorized |
| `NOT_FOUND-001` | 404 | Election not found |
| `CONFLICT-003` | 409 | Cannot delete election with active nominations/votes (cancel first) |

---

### 2.2 Nominations

#### POST `/orgs/:organizationId/elections/:electionId/nominate`

**Nominate a candidate for a position**

| Property | Value |
|----------|-------|
| Auth | GA — all members except user, support |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Optional |
| Workflow | WF-076: Create & Run Election (nomination phase) |
| Business rules | M12-R4 (nomination window), BR-34 (nominee eligibility) |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| positionId | string | YES | NO | uuid | valid position in election | — | "uuid-president" |
| personId | string | YES | NO | uuid | active member in org | — | "550e8400-..." |

**Response** `201 Created`

```json
{
  "data": {
    "id": "uuid",
    "electionId": "uuid",
    "positionId": "uuid",
    "personId": "uuid",
    "personName": "Dr. Maria Santos",
    "nominatedBy": "uuid",
    "status": "nominated",
    "createdAt": "2026-05-03T10:00:00.000Z"
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| id | string | NO | uuid | Nominee record ID |
| electionId | string | NO | uuid | Parent election |
| positionId | string | NO | uuid | Target position |
| personId | string | NO | uuid | Nominee person ID |
| personName | string | NO | — | Nominee display name |
| nominatedBy | string | NO | uuid | Person who nominated |
| status | string | NO | enum | `nominated` (initial) |
| createdAt | string | NO | ISO 8601 | Nomination timestamp |

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `NOT_FOUND-001` | 404 | Election or position not found |
| `M12-001` | 422 | Election is not in nomination phase |
| `M12-002` | 422 | Already nominated for this position |
| `M12-005` | 422 | Nominee does not meet eligibility criteria |
| `M12-011` | 422 | Only active members can be nominated (BR-33/BR-34) |

---

#### PATCH `/orgs/:organizationId/elections/:electionId/nominees/:nomineeId`

**Accept, decline, or withdraw a nomination**

| Property | Value |
|----------|-------|
| Auth | GA — nominee only (own nomination) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | N/A |
| Workflow | WF-076 |
| Business rules | — |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| status | string | YES | NO | enum | `accepted`, `declined`, `withdrawn` | — | "accepted" |

**Valid Transitions:**

| From | Allowed Targets |
|------|----------------|
| `nominated` | `accepted`, `declined` |
| `accepted` | `withdrawn` (before votingOpen only) |
| `declined` | (none — terminal) |
| `withdrawn` | (none — terminal) |

**Response** `200 OK`

```json
{
  "data": { "id": "uuid", "status": "accepted", "...": "full nominee object" }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-003` | 403 | Not the nominee (cannot modify others' nominations) |
| `NOT_FOUND-001` | 404 | Nominee not found |
| `M12-009` | 422 | Invalid nominee status transition |
| `M12-008` | 422 | Candidate withdrawal after voting started — runner-up advances |

---

### 2.3 Voting

#### POST `/orgs/:organizationId/elections/:electionId/vote`

**Cast a secret ballot**

| Property | Value |
|----------|-------|
| Auth | GA — all active members (BR-33) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Required (Idempotency-Key recommended) |
| Workflow | WF-077: Member Votes |
| Business rules | M12-R1 (one vote per voter per position), BR-33 (active members only), M12-R5 (hybrid mode) |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| votes | array | YES | NO | — | one entry per position | — | (see below) |
| votes[].positionId | string | YES | NO | uuid | valid position in election | — | "uuid-president" |
| votes[].nomineeId | string | YES | NO | uuid | accepted nominee for position | — | "uuid-nominee" |

```json
{
  "votes": [
    { "positionId": "uuid-president", "nomineeId": "uuid-nominee-1" },
    { "positionId": "uuid-secretary", "nomineeId": "uuid-nominee-2" }
  ]
}
```

**Response** `201 Created`

```json
{
  "data": {
    "message": "Your vote has been recorded.",
    "electionId": "uuid",
    "positionsVoted": 2
  }
}
```

| Field | Type | Nullable | Format | Description |
|-------|------|----------|--------|-------------|
| message | string | NO | — | Confirmation message |
| electionId | string | NO | uuid | Election voted in |
| positionsVoted | number | NO | integer | Number of positions voted on |

**Note:** Response deliberately omits which nominees were chosen (secret ballot).

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `NOT_FOUND-001` | 404 | Election not found |
| `M12-003` | 422 | Voting period not open |
| `M12-004` | 422 | Already voted in this election (409 Conflict) |
| `M12-011` | 422 | Only active members can vote (BR-33) |
| `M12-005` | 422 | Nominee does not exist or is not accepted |
| `VALIDATION-001` | 400 | Invalid request body (missing positions) |

---

### 2.4 Bylaw Voting

#### POST `/orgs/:organizationId/elections/:electionId/vote` (type=bylaw)

**Cast a yes/no vote on a bylaw proposal**

| Property | Value |
|----------|-------|
| Auth | GA — all active members (BR-33) |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Required (Idempotency-Key recommended) |
| Workflow | WF-077, WF-078: Bylaw Ratification |
| Business rules | M12-R1 (one vote per voter), BR-33 (active members only) |

Shares the same endpoint as officer election voting. For bylaw elections, the request body differs:

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| vote | string | YES | NO | enum | `yes`, `no` | — | "yes" |

```json
{
  "vote": "yes"
}
```

**Response** `201 Created`

```json
{
  "data": {
    "message": "Your vote has been recorded.",
    "electionId": "uuid"
  }
}
```

**Error Codes** — Same as section 2.3.

---

### 2.5 Hybrid Voting (In-Person Entry)

#### POST `/orgs/:organizationId/elections/:electionId/vote/in-person`

**Record an in-person vote with witness attestation**

| Property | Value |
|----------|-------|
| Auth | GA+HG — president (2FA), officer, admin, super |
| Rate limit | Authenticated (120 req/min) |
| Idempotency | Required |
| Workflow | WF-076 (hybrid voting) |
| Business rules | M12-R5 (hybrid votes counted), M12-R1 (one vote per voter per position) |

**Request Body**

| Field | Type | Required | Nullable | Format | Constraints | Default | Example |
|-------|------|----------|----------|--------|-------------|---------|---------|
| voterId | string | YES | NO | uuid | active member in org | — | "550e8400-..." |
| votes | array | YES | NO | — | one per position (officer) or single vote (bylaw) | — | (same as online) |
| witnessPersonId | string | YES | NO | uuid | second officer confirming entry | — | "660e8400-..." |

**Response** `201 Created`

```json
{
  "data": {
    "message": "In-person vote recorded with witness attestation.",
    "electionId": "uuid",
    "voterId": "uuid",
    "witnessPersonId": "uuid"
  }
}
```

**Error Codes**

| Code | Status | When |
|------|--------|------|
| `AUTH-001` | 401 | Not authenticated |
| `AUTHZ-001` | 403 | Not an officer |
| `M12-003` | 422 | Voting period not open |
| `M12-004` | 422 | Voter already voted |
| `M12-010` | 422 | Hybrid election requires witness attestation |
| `M12-011` | 422 | Only active members can vote |

---

## 3. Domain Events (API Triggers)

| Endpoint | Event Emitted | Payload |
|----------|--------------|---------|
| PATCH .../status (nominationsOpen/votingOpen) | `ElectionOpened` | `{ electionId, orgId, status }` |
| PATCH .../status (published) | `ElectionPublished` | `{ electionId, orgId, winners: [{ positionId, winnerId }] }` |
| PATCH .../status (cancelled) | `ElectionCancelled` | `{ electionId, orgId }` |

---

## 4. Consumed Events

| Event | Source | Effect |
|-------|--------|--------|
| `MembershipStatusChanged` | M05 | Update voter eligibility for active elections |

---

## 5. State Machine Reference

### Election Status

```
draft ──► nominationsOpen ──► votingOpen ──► awaitingConfirmation ──► published (terminal)
  │              │                 │                   │
  └──► cancelled └──► cancelled    └──► cancelled      └──► cancelled (terminal)
```

### Nominee Status

```
nominated ──► accepted ──► withdrawn
    │
    └──► declined
```

Guards:
- `votingOpen` transition: minimum 2 accepted candidates per position (M12-R6)
- `published`: immutable, no further transitions (M12-R2)
- `withdrawn`: only before votingOpen; after voting, withdrawn candidate's votes go to runner-up (M12-008)
