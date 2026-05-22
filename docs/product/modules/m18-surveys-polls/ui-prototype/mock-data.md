<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M18 Surveys & Polls -- Mock Data

> Non-authoritative. For UI prototyping only. Does not define business rules.

---

## Surveys (4 records)

```json
[
  {
    "id": "surv-001-aaaa-bbbb-cccc-ddddeeee0001",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "title": "2026 Member Satisfaction Survey",
    "type": "anonymous",
    "status": "active",
    "deadline": "2026-06-30T23:59:59.000Z",
    "totalResponses": 47,
    "eligibleCount": 120,
    "distribution": "all_members",
    "questions": [
      {
        "id": "q-001",
        "label": "How satisfied are you with your association membership?",
        "type": "rating",
        "required": true,
        "ratingScale": 5
      },
      {
        "id": "q-002",
        "label": "Which services do you use most?",
        "type": "checkbox",
        "required": true,
        "options": ["Continuing Education", "Networking Events", "Marketplace", "Job Board", "Insurance Programs"]
      },
      {
        "id": "q-003",
        "label": "What improvements would you suggest?",
        "type": "text",
        "required": false
      }
    ],
    "createdAt": "2026-05-01T10:00:00.000Z"
  },
  {
    "id": "surv-001-aaaa-bbbb-cccc-ddddeeee0002",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "title": "Annual Conference Topic Preferences",
    "type": "identified",
    "status": "closed",
    "deadline": "2026-04-15T23:59:59.000Z",
    "totalResponses": 89,
    "eligibleCount": 120,
    "distribution": "all_members",
    "questions": [
      {
        "id": "q-004",
        "label": "Which topics interest you for the 2026 conference?",
        "type": "checkbox",
        "required": true,
        "options": ["Digital Dentistry", "Practice Management", "Pediatric Dentistry", "Implantology", "Cosmetic Dentistry", "Public Health"]
      },
      {
        "id": "q-005",
        "label": "Preferred conference format",
        "type": "multiple_choice",
        "required": true,
        "options": ["In-person only", "Hybrid (in-person + virtual)", "Virtual only"]
      },
      {
        "id": "q-006",
        "label": "How many CPD hours would justify attending?",
        "type": "rating",
        "required": true,
        "ratingScale": 10
      }
    ],
    "createdAt": "2026-03-01T08:00:00.000Z"
  },
  {
    "id": "surv-001-aaaa-bbbb-cccc-ddddeeee0003",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "title": "Ethics Committee Feedback (Draft)",
    "type": "anonymous",
    "status": "draft",
    "deadline": null,
    "totalResponses": 0,
    "eligibleCount": null,
    "distribution": "all_members",
    "questions": [
      {
        "id": "q-007",
        "label": "Rate the ethics committee's responsiveness",
        "type": "rating",
        "required": true,
        "ratingScale": 5
      }
    ],
    "createdAt": "2026-05-18T14:00:00.000Z"
  },
  {
    "id": "surv-001-aaaa-bbbb-cccc-ddddeeee0004",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "title": "New Member Onboarding Experience",
    "type": "identified",
    "status": "active",
    "deadline": "2026-07-15T23:59:59.000Z",
    "totalResponses": 12,
    "eligibleCount": 30,
    "distribution": "category_filter",
    "distributionFilter": ["new_member_2026"],
    "questions": [
      {
        "id": "q-008",
        "label": "How easy was the membership registration process?",
        "type": "rating",
        "required": true,
        "ratingScale": 5
      },
      {
        "id": "q-009",
        "label": "What was the most helpful resource during onboarding?",
        "type": "multiple_choice",
        "required": true,
        "options": ["Welcome email", "Orientation webinar", "Mentor assignment", "Member handbook", "Chapter meetup"]
      },
      {
        "id": "q-010",
        "label": "Any additional feedback on your onboarding experience?",
        "type": "text",
        "required": false
      }
    ],
    "createdAt": "2026-05-10T09:00:00.000Z"
  }
]
```

## Survey Results -- Aggregation Example (for surv-001)

```json
{
  "surveyId": "surv-001-aaaa-bbbb-cccc-ddddeeee0001",
  "title": "2026 Member Satisfaction Survey",
  "type": "anonymous",
  "status": "active",
  "totalResponses": 47,
  "eligibleCount": 120,
  "questions": [
    {
      "questionId": "q-001",
      "label": "How satisfied are you with your association membership?",
      "type": "rating",
      "responseCount": 47,
      "aggregation": {
        "average": 4.2,
        "distribution": { "1": 1, "2": 3, "3": 5, "4": 18, "5": 20 }
      }
    },
    {
      "questionId": "q-002",
      "label": "Which services do you use most?",
      "type": "checkbox",
      "responseCount": 47,
      "aggregation": {
        "choices": [
          { "option": "Continuing Education", "count": 38, "percentage": 80.9 },
          { "option": "Networking Events", "count": 29, "percentage": 61.7 },
          { "option": "Marketplace", "count": 15, "percentage": 31.9 },
          { "option": "Job Board", "count": 11, "percentage": 23.4 },
          { "option": "Insurance Programs", "count": 8, "percentage": 17.0 }
        ]
      }
    },
    {
      "questionId": "q-003",
      "label": "What improvements would you suggest?",
      "type": "text",
      "responseCount": 31,
      "aggregation": {
        "textResponses": [
          "More online CPD options for rural practitioners.",
          "Better mobile app for tracking credits.",
          "Would love regional networking events, not just national.",
          "Marketplace needs more local suppliers.",
          "The dues reminder system is very helpful, keep it up."
        ]
      }
    }
  ]
}
```

## Survey Responses (3 records -- member view)

```json
[
  {
    "id": "resp-001-aaaa-bbbb-cccc-ddddeeee0001",
    "surveyId": "surv-001-aaaa-bbbb-cccc-ddddeeee0001",
    "respondentId": null,
    "answers": {
      "q-001": 5,
      "q-002": ["Continuing Education", "Networking Events"],
      "q-003": "More online CPD options for rural practitioners."
    },
    "submittedAt": "2026-05-15T09:30:00.000Z"
  },
  {
    "id": "resp-001-aaaa-bbbb-cccc-ddddeeee0002",
    "surveyId": "surv-001-aaaa-bbbb-cccc-ddddeeee0004",
    "respondentId": "p-001-aaaa-bbbb-cccc-ddddeeee0010",
    "answers": {
      "q-008": 4,
      "q-009": "Orientation webinar",
      "q-010": "The mentor program was unexpectedly helpful."
    },
    "submittedAt": "2026-05-12T14:00:00.000Z"
  },
  {
    "id": "resp-001-aaaa-bbbb-cccc-ddddeeee0003",
    "surveyId": "surv-001-aaaa-bbbb-cccc-ddddeeee0002",
    "respondentId": "p-001-aaaa-bbbb-cccc-ddddeeee0011",
    "answers": {
      "q-004": ["Digital Dentistry", "Implantology"],
      "q-005": "Hybrid (in-person + virtual)",
      "q-006": 8
    },
    "submittedAt": "2026-04-10T11:00:00.000Z"
  }
]
```

## Quick Polls (3 records)

```json
[
  {
    "id": "poll-001-aaaa-bbbb-cccc-ddddeeee0001",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "question": "Should we move the annual gala to a Saturday evening?",
    "options": ["Yes", "No", "No preference"],
    "status": "active",
    "deadline": "2026-06-01T23:59:59.000Z",
    "totalVotes": 34,
    "results": {
      "options": [
        { "option": "Yes", "count": 21, "percentage": 61.8 },
        { "option": "No", "count": 8, "percentage": 23.5 },
        { "option": "No preference", "count": 5, "percentage": 14.7 }
      ]
    },
    "createdAt": "2026-05-15T10:00:00.000Z"
  },
  {
    "id": "poll-001-aaaa-bbbb-cccc-ddddeeee0002",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "question": "Preferred CPD session length?",
    "options": ["1 hour", "2 hours", "Half day", "Full day"],
    "status": "closed",
    "deadline": "2026-04-30T23:59:59.000Z",
    "totalVotes": 65,
    "results": {
      "options": [
        { "option": "1 hour", "count": 10, "percentage": 15.4 },
        { "option": "2 hours", "count": 28, "percentage": 43.1 },
        { "option": "Half day", "count": 19, "percentage": 29.2 },
        { "option": "Full day", "count": 8, "percentage": 12.3 }
      ]
    },
    "createdAt": "2026-04-01T08:00:00.000Z"
  },
  {
    "id": "poll-001-aaaa-bbbb-cccc-ddddeeee0003",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "question": "Would you attend a virtual-only national convention?",
    "options": ["Definitely", "Maybe", "Unlikely", "No"],
    "status": "active",
    "deadline": null,
    "totalVotes": 18,
    "results": {
      "options": [
        { "option": "Definitely", "count": 5, "percentage": 27.8 },
        { "option": "Maybe", "count": 7, "percentage": 38.9 },
        { "option": "Unlikely", "count": 4, "percentage": 22.2 },
        { "option": "No", "count": 2, "percentage": 11.1 }
      ]
    },
    "createdAt": "2026-05-20T14:00:00.000Z"
  }
]
```
