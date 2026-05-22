<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M12 Elections & Governance -- Mock Data

> Non-authoritative. For demonstration and UI prototyping only.

---

## Elections List Response (GET /orgs/:orgId/elections)

```json
{
  "data": [
    {
      "id": "elec-001",
      "organizationId": "org-pda-manila",
      "title": "2027 PDA Manila Chapter Officer Election",
      "type": "officer",
      "status": "votingOpen",
      "votingMode": "hybrid",
      "nominationStartDate": "2026-10-01T00:00:00.000Z",
      "nominationEndDate": "2026-10-31T23:59:59.000Z",
      "votingStartDate": "2026-11-15T00:00:00.000Z",
      "votingEndDate": "2026-11-30T23:59:59.000Z",
      "positions": [
        { "id": "pos-pres", "title": "President" },
        { "id": "pos-vp", "title": "Vice President" },
        { "id": "pos-sec", "title": "Secretary" },
        { "id": "pos-treas", "title": "Treasurer" }
      ],
      "createdAt": "2026-09-15T10:00:00.000Z"
    },
    {
      "id": "elec-002",
      "organizationId": "org-pda-manila",
      "title": "Bylaw Amendment: Remote Meeting Attendance",
      "type": "bylaw",
      "status": "published",
      "votingMode": "online",
      "nominationStartDate": null,
      "nominationEndDate": null,
      "votingStartDate": "2026-08-01T00:00:00.000Z",
      "votingEndDate": "2026-08-15T23:59:59.000Z",
      "positions": [],
      "createdAt": "2026-07-15T10:00:00.000Z"
    },
    {
      "id": "elec-003",
      "organizationId": "org-pda-manila",
      "title": "2026 Board Member Election (Special)",
      "type": "officer",
      "status": "cancelled",
      "votingMode": "online",
      "nominationStartDate": "2026-06-01T00:00:00.000Z",
      "nominationEndDate": "2026-06-15T23:59:59.000Z",
      "votingStartDate": "2026-07-01T00:00:00.000Z",
      "votingEndDate": "2026-07-15T23:59:59.000Z",
      "positions": [
        { "id": "pos-board1", "title": "Board Member (Seat 3)" }
      ],
      "createdAt": "2026-05-20T10:00:00.000Z"
    },
    {
      "id": "elec-004",
      "organizationId": "org-pda-manila",
      "title": "Bylaw Amendment: Dues Increase Proposal",
      "type": "bylaw",
      "status": "draft",
      "votingMode": "online",
      "nominationStartDate": null,
      "nominationEndDate": null,
      "votingStartDate": "2027-01-15T00:00:00.000Z",
      "votingEndDate": "2027-01-31T23:59:59.000Z",
      "positions": [],
      "createdAt": "2026-12-01T10:00:00.000Z"
    }
  ],
  "meta": {
    "cursor": null,
    "hasMore": false,
    "total": 4
  }
}
```

---

## Election Detail Response (GET /orgs/:orgId/elections/:electionId)

```json
{
  "data": {
    "id": "elec-001",
    "organizationId": "org-pda-manila",
    "title": "2027 PDA Manila Chapter Officer Election",
    "type": "officer",
    "status": "votingOpen",
    "votingMode": "hybrid",
    "nominationStartDate": "2026-10-01T00:00:00.000Z",
    "nominationEndDate": "2026-10-31T23:59:59.000Z",
    "votingStartDate": "2026-11-15T00:00:00.000Z",
    "votingEndDate": "2026-11-30T23:59:59.000Z",
    "positions": [
      {
        "id": "pos-pres",
        "title": "President",
        "nominees": [
          {
            "id": "nom-001",
            "personId": "person-maria-santos",
            "personName": "Dr. Maria Santos",
            "status": "accepted",
            "nominatedByName": "Dr. Carlos Reyes"
          },
          {
            "id": "nom-002",
            "personId": "person-elena-cruz",
            "personName": "Dr. Elena Cruz",
            "status": "accepted",
            "nominatedByName": "Dr. Ana Villanueva"
          },
          {
            "id": "nom-003",
            "personId": "person-ramon-santos",
            "personName": "Dr. Ramon Santos",
            "status": "declined",
            "nominatedByName": "Dr. Juan Dela Cruz"
          }
        ]
      },
      {
        "id": "pos-vp",
        "title": "Vice President",
        "nominees": [
          {
            "id": "nom-004",
            "personId": "person-carlos-reyes",
            "personName": "Dr. Carlos Reyes",
            "status": "accepted",
            "nominatedByName": "Dr. Maria Santos"
          },
          {
            "id": "nom-005",
            "personId": "person-ana-villanueva",
            "personName": "Dr. Ana Villanueva",
            "status": "accepted",
            "nominatedByName": "Dr. Elena Cruz"
          }
        ]
      },
      {
        "id": "pos-sec",
        "title": "Secretary",
        "nominees": [
          {
            "id": "nom-006",
            "personId": "person-juan-dela-cruz",
            "personName": "Dr. Juan Dela Cruz",
            "status": "accepted",
            "nominatedByName": "Self-nominated"
          },
          {
            "id": "nom-007",
            "personId": "person-luisa-garcia",
            "personName": "Dr. Luisa Garcia",
            "status": "accepted",
            "nominatedByName": "Dr. Maria Santos"
          }
        ]
      },
      {
        "id": "pos-treas",
        "title": "Treasurer",
        "nominees": [
          {
            "id": "nom-008",
            "personId": "person-ramon-santos",
            "personName": "Dr. Ramon Santos",
            "status": "accepted",
            "nominatedByName": "Dr. Carlos Reyes"
          },
          {
            "id": "nom-009",
            "personId": "person-diego-lim",
            "personName": "Dr. Diego Lim",
            "status": "accepted",
            "nominatedByName": "Self-nominated"
          }
        ]
      }
    ],
    "createdAt": "2026-09-15T10:00:00.000Z",
    "updatedAt": "2026-11-15T00:00:00.000Z"
  }
}
```

---

## Vote Request (POST /orgs/:orgId/elections/:electionId/vote)

### Officer Election

```json
{
  "votes": [
    { "positionId": "pos-pres", "nomineeId": "nom-001" },
    { "positionId": "pos-vp", "nomineeId": "nom-005" },
    { "positionId": "pos-sec", "nomineeId": "nom-007" },
    { "positionId": "pos-treas", "nomineeId": "nom-008" }
  ]
}
```

### Vote Response

```json
{
  "data": {
    "message": "Your vote has been recorded.",
    "electionId": "elec-001"
  }
}
```

### Bylaw Election

```json
{
  "vote": "yes"
}
```

---

## In-Person Vote Request

```json
{
  "voterId": "person-senior-member",
  "votes": [
    { "positionId": "pos-pres", "nomineeId": "nom-002" },
    { "positionId": "pos-vp", "nomineeId": "nom-004" },
    { "positionId": "pos-sec", "nomineeId": "nom-006" },
    { "positionId": "pos-treas", "nomineeId": "nom-009" }
  ],
  "witnessPersonId": "person-ana-villanueva"
}
```

### In-Person Vote Response

```json
{
  "data": {
    "message": "In-person vote recorded with witness attestation.",
    "electionId": "elec-001",
    "voterId": "person-senior-member",
    "witnessPersonId": "person-ana-villanueva"
  }
}
```

---

## Election Results (Published)

### Officer Election Results

```json
{
  "data": {
    "electionId": "elec-001",
    "title": "2027 PDA Manila Chapter Officer Election",
    "type": "officer",
    "status": "published",
    "totalEligibleVoters": 187,
    "totalVotesCast": 142,
    "turnoutPercentage": 75.9,
    "onlineVotes": 118,
    "inPersonVotes": 24,
    "positions": [
      {
        "id": "pos-pres",
        "title": "President",
        "totalVotes": 142,
        "results": [
          { "nomineeId": "nom-001", "personName": "Dr. Maria Santos", "voteCount": 89, "percentage": 62.7, "isWinner": true },
          { "nomineeId": "nom-002", "personName": "Dr. Elena Cruz", "voteCount": 53, "percentage": 37.3, "isWinner": false }
        ]
      },
      {
        "id": "pos-vp",
        "title": "Vice President",
        "totalVotes": 142,
        "results": [
          { "nomineeId": "nom-005", "personName": "Dr. Ana Villanueva", "voteCount": 78, "percentage": 54.9, "isWinner": true },
          { "nomineeId": "nom-004", "personName": "Dr. Carlos Reyes", "voteCount": 64, "percentage": 45.1, "isWinner": false }
        ]
      },
      {
        "id": "pos-sec",
        "title": "Secretary",
        "totalVotes": 142,
        "results": [
          { "nomineeId": "nom-007", "personName": "Dr. Luisa Garcia", "voteCount": 81, "percentage": 57.0, "isWinner": true },
          { "nomineeId": "nom-006", "personName": "Dr. Juan Dela Cruz", "voteCount": 61, "percentage": 43.0, "isWinner": false }
        ]
      },
      {
        "id": "pos-treas",
        "title": "Treasurer",
        "totalVotes": 142,
        "results": [
          { "nomineeId": "nom-008", "personName": "Dr. Ramon Santos", "voteCount": 71, "percentage": 50.0, "isWinner": false },
          { "nomineeId": "nom-009", "personName": "Dr. Diego Lim", "voteCount": 71, "percentage": 50.0, "isWinner": false }
        ],
        "isTie": true
      }
    ]
  }
}
```

### Bylaw Election Results

```json
{
  "data": {
    "electionId": "elec-002",
    "title": "Bylaw Amendment: Remote Meeting Attendance",
    "type": "bylaw",
    "status": "published",
    "totalEligibleVoters": 187,
    "totalVotesCast": 98,
    "turnoutPercentage": 52.4,
    "yesVotes": 72,
    "noVotes": 26,
    "yesPercentage": 73.5,
    "noPercentage": 26.5,
    "result": "approved"
  }
}
```

---

## Nomination Request

```json
{
  "positionId": "pos-sec",
  "personId": "person-luisa-garcia"
}
```

### Self-Nomination

```json
{
  "positionId": "pos-sec",
  "personId": "person-juan-dela-cruz"
}
```

### Nomination Response

```json
{
  "data": {
    "id": "nom-006",
    "electionId": "elec-001",
    "positionId": "pos-sec",
    "personId": "person-juan-dela-cruz",
    "personName": "Dr. Juan Dela Cruz",
    "status": "nominated",
    "nominatedByName": "Self-nominated",
    "createdAt": "2026-10-05T14:00:00.000Z"
  }
}
```

---

## Accept/Decline Nomination

```json
{
  "request": { "status": "accepted" },
  "response": {
    "data": {
      "id": "nom-006",
      "status": "accepted",
      "updatedAt": "2026-10-06T09:00:00.000Z"
    }
  }
}
```
