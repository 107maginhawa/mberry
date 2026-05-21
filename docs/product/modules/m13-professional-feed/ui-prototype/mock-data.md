<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Mock Data: Professional Feed (M13)

> Mock data is for UI demonstration only. It must not be treated as final schema, API contract, lifecycle state, or business rule.

---

## Mock Entity: Post

```json
[
  {
    "id": "post-001-uuid-abcd-1234",
    "organizationId": "org-cebu-dental-uuid",
    "authorId": "person-dr-reyes-uuid",
    "postType": "announcement",
    "body": "Important reminder: The annual dues payment deadline is May 31, 2026. Please ensure your payments are up to date to maintain active membership status. Contact the treasurer for any concerns.",
    "imageUrls": null,
    "visibility": "org",
    "status": "published",
    "createdAt": "2026-05-20T09:15:00Z",
    "updatedAt": "2026-05-20T09:15:00Z",
    "author": {
      "displayName": "Dr. Maria Reyes",
      "avatarUrl": "https://cdn.example.com/avatars/dr-reyes.jpg"
    }
  },
  {
    "id": "post-002-uuid-efgh-5678",
    "organizationId": "org-cebu-dental-uuid",
    "authorId": "person-dr-santos-uuid",
    "postType": "event_highlight",
    "body": "What an incredible turnout at the Cebu Dental Chapter Annual Convention! Over 200 members attended three days of lectures, workshops, and networking. Special thanks to our speakers Dr. Cruz and Dr. Lim for their presentations on digital dentistry trends.",
    "imageUrls": [
      "https://cdn.example.com/posts/convention-01.jpg",
      "https://cdn.example.com/posts/convention-02.jpg",
      "https://cdn.example.com/posts/convention-03.jpg"
    ],
    "visibility": "network",
    "status": "published",
    "createdAt": "2026-05-18T14:30:00Z",
    "updatedAt": "2026-05-18T14:30:00Z",
    "author": {
      "displayName": "Dr. Carlos Santos",
      "avatarUrl": "https://cdn.example.com/avatars/dr-santos.jpg"
    }
  },
  {
    "id": "post-003-uuid-ijkl-9012",
    "organizationId": "org-cebu-dental-uuid",
    "authorId": "person-dr-garcia-uuid",
    "postType": "training_opportunity",
    "body": "New CPD opportunity: Advanced Endodontics Workshop on June 15, 2026. Earn 8 CPD credits. Limited to 30 participants. Register through the events page.",
    "imageUrls": [
      "https://cdn.example.com/posts/endo-workshop.jpg"
    ],
    "visibility": "org",
    "status": "published",
    "createdAt": "2026-05-17T08:00:00Z",
    "updatedAt": "2026-05-17T08:00:00Z",
    "author": {
      "displayName": "Dr. Ana Garcia",
      "avatarUrl": null
    }
  },
  {
    "id": "post-004-uuid-mnop-3456",
    "organizationId": "org-cebu-dental-uuid",
    "authorId": "person-dr-reyes-uuid",
    "postType": "achievement",
    "body": "Congratulations to Dr. Jose Mendoza for being named Philippine Dental Association Researcher of the Year! His work on biocompatible materials has been recognized nationally.",
    "imageUrls": [
      "https://cdn.example.com/posts/award-mendoza.jpg",
      "https://cdn.example.com/posts/award-ceremony.jpg"
    ],
    "visibility": "network",
    "status": "published",
    "createdAt": "2026-05-15T11:45:00Z",
    "updatedAt": "2026-05-15T11:45:00Z",
    "author": {
      "displayName": "Dr. Maria Reyes",
      "avatarUrl": "https://cdn.example.com/avatars/dr-reyes.jpg"
    }
  },
  {
    "id": "post-005-uuid-qrst-7890",
    "organizationId": "org-cebu-dental-uuid",
    "authorId": "person-dr-santos-uuid",
    "postType": "clinical_update",
    "body": "The FDA Philippines has issued updated guidelines for amalgam use in pediatric patients. Key change: amalgam is no longer recommended for patients under 15 years. Full document available in the documents section.",
    "imageUrls": null,
    "visibility": "org",
    "status": "hidden",
    "createdAt": "2026-05-14T16:20:00Z",
    "updatedAt": "2026-05-19T10:00:00Z",
    "author": {
      "displayName": "Dr. Carlos Santos",
      "avatarUrl": "https://cdn.example.com/avatars/dr-santos.jpg"
    }
  }
]
```

### Mock Status Values
- **draft:** Post saved but not yet published. Visible only to the author (officer).
- **published:** Post visible to organization members (or network if visibility=network).
- **hidden:** Post moderated/hidden by officer. Reversible. Visible only to officers with "Hidden" badge.
- **removed:** Post permanently removed by officer. Terminal state. Not displayed.

---

## Mock Entity: MutePreference

```json
[
  {
    "id": "mute-001-uuid-abcd",
    "personId": "person-dr-lim-uuid",
    "mutedPersonId": "person-dr-santos-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "createdAt": "2026-05-10T08:30:00Z"
  },
  {
    "id": "mute-002-uuid-efgh",
    "personId": "person-dr-cruz-uuid",
    "mutedPersonId": "person-dr-garcia-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "createdAt": "2026-05-12T14:15:00Z"
  },
  {
    "id": "mute-003-uuid-ijkl",
    "personId": "person-dr-lim-uuid",
    "mutedPersonId": "person-dr-reyes-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "createdAt": "2026-05-16T09:00:00Z"
  }
]
```

---

## Mock Paginated Feed Response

```json
{
  "data": [
    { "...post-001..." : "..." },
    { "...post-002..." : "..." },
    { "...post-003..." : "..." }
  ],
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalCount": 47,
    "hasMore": true
  }
}
```

---

### Prototype-Only Assumptions
- Like count and bookmark status are shown in mock PostCard but marked [INFERRED] in MODULE_SPEC; actual implementation depends on confirmed entity design
- Author avatarUrl may be null; UI falls back to initials circle
- Feed pagination uses cursor-based infinite scroll; mock uses offset for simplicity
- Post body truncation at 280 chars is a UI-only decision, not a business rule
