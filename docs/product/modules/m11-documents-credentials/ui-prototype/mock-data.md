<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M11 Documents & Credentials -- Mock Data

> Non-authoritative. For demonstration and UI prototyping only.

---

## Member ID Card Response (GET /my/id-card)

```json
{
  "data": {
    "memberName": "Dr. Juan Dela Cruz, DMD",
    "memberPhoto": "https://storage.memberry.com/photos/person-juan-dela-cruz.jpg",
    "membershipNumber": "PDA-2024-00142",
    "organizationName": "PDA Manila Chapter",
    "organizationLogo": "https://storage.memberry.com/logos/org-pda-manila.svg",
    "memberSince": "2024-03-15T00:00:00.000Z",
    "membershipStatus": "active",
    "expiryDate": "2027-03-14T23:59:59.000Z",
    "qrCodeUrl": "/verify/member/PDA-2024-00142"
  }
}
```

---

## Certificates Response (GET /my/certificates)

```json
{
  "data": [
    {
      "id": "cert-001",
      "certificateNumber": "CERT-2026-PDA-00451",
      "trainingTitle": "Infection Control in Dental Practice (Online)",
      "trainingDate": "2026-04-01T00:00:00.000Z",
      "creditAmount": 6,
      "organizationName": "PDA Manila Chapter",
      "issuedAt": "2026-05-01T10:00:00.000Z"
    },
    {
      "id": "cert-002",
      "certificateNumber": "CERT-2026-PDA-00320",
      "trainingTitle": "PDA 2026 Annual Convention",
      "trainingDate": "2026-09-10T00:00:00.000Z",
      "creditAmount": 24,
      "organizationName": "Philippine Dental Association",
      "issuedAt": "2026-09-13T08:00:00.000Z"
    },
    {
      "id": "cert-003",
      "certificateNumber": "CERT-2025-PDA-00089",
      "trainingTitle": "Pediatric Dentistry Workshop",
      "trainingDate": "2025-11-20T00:00:00.000Z",
      "creditAmount": 4,
      "organizationName": "PDA Manila Chapter",
      "issuedAt": "2025-11-21T14:00:00.000Z"
    }
  ],
  "meta": {
    "cursor": null,
    "hasMore": false,
    "total": 3
  }
}
```

---

## Verification Response -- Valid (GET /verify/:token)

```json
{
  "data": {
    "status": "valid",
    "credentialType": "certificate",
    "memberName": "Dr. Juan Dela Cruz, DMD",
    "organizationName": "PDA Manila Chapter",
    "issuedDate": "2026-05-01T10:00:00.000Z",
    "trainingTitle": "Infection Control in Dental Practice (Online)",
    "creditAmount": 6,
    "hmacValid": true
  }
}
```

## Verification Response -- Invalid

```json
{
  "data": {
    "status": "invalid",
    "hmacValid": false
  }
}
```

## Verification Response -- Not Found

```json
{
  "error": {
    "code": "NOT_FOUND-001",
    "message": "No credential found for this verification code."
  }
}
```

---

## Organization Documents Response (GET /orgs/:orgId/documents)

```json
{
  "data": [
    {
      "id": "doc-001",
      "title": "PDA Manila Chapter Bylaws (2026 Revision)",
      "status": "published",
      "tags": ["bylaws", "governance", "official"],
      "currentVersion": 3,
      "uploadedByName": "Dr. Maria Santos",
      "updatedAt": "2026-04-15T10:00:00.000Z",
      "fileSize": 2457600,
      "mimeType": "application/pdf"
    },
    {
      "id": "doc-002",
      "title": "Annual Financial Report FY2025",
      "status": "published",
      "tags": ["finance", "annual-report"],
      "currentVersion": 1,
      "uploadedByName": "Dr. Carlos Reyes",
      "updatedAt": "2026-03-01T08:00:00.000Z",
      "fileSize": 5242880,
      "mimeType": "application/pdf"
    },
    {
      "id": "doc-003",
      "title": "CPD Credit Policy Update (Draft)",
      "status": "draft",
      "tags": ["cpd", "policy"],
      "currentVersion": 1,
      "uploadedByName": "Dr. Ana Villanueva",
      "updatedAt": "2026-05-18T14:00:00.000Z",
      "fileSize": 819200,
      "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    },
    {
      "id": "doc-004",
      "title": "Membership Directory 2025",
      "status": "archived",
      "tags": ["directory", "membership"],
      "currentVersion": 2,
      "uploadedByName": "Dr. Maria Santos",
      "updatedAt": "2025-12-31T00:00:00.000Z",
      "fileSize": 1048576,
      "mimeType": "application/pdf"
    },
    {
      "id": "doc-005",
      "title": "Event Planning Guidelines",
      "status": "published",
      "tags": ["events", "guidelines"],
      "currentVersion": 1,
      "uploadedByName": "Dr. Elena Cruz",
      "updatedAt": "2026-02-10T09:00:00.000Z",
      "fileSize": 409600,
      "mimeType": "application/pdf"
    }
  ],
  "meta": {
    "cursor": "eyJpZCI6ImRvYy0wMDUifQ",
    "hasMore": false,
    "total": 5
  }
}
```

---

## Document Version History

```json
{
  "documentId": "doc-001",
  "versions": [
    {
      "id": "ver-003",
      "versionNumber": 3,
      "uploadedByName": "Dr. Maria Santos",
      "createdAt": "2026-04-15T10:00:00.000Z",
      "fileSize": 2457600,
      "notes": "Updated Article IV - Election Procedures per 2026 General Assembly resolution"
    },
    {
      "id": "ver-002",
      "versionNumber": 2,
      "uploadedByName": "Dr. Maria Santos",
      "createdAt": "2025-08-01T14:00:00.000Z",
      "fileSize": 2400000,
      "notes": "Added dues payment schedule amendment"
    },
    {
      "id": "ver-001",
      "versionNumber": 1,
      "uploadedByName": "Dr. Ana Villanueva",
      "createdAt": "2024-06-15T09:00:00.000Z",
      "fileSize": 2200000,
      "notes": "Initial bylaws document"
    }
  ]
}
```

---

## Document Access Log

```json
{
  "documentId": "doc-001",
  "logs": [
    {
      "id": "log-001",
      "personName": "Dr. Juan Dela Cruz",
      "action": "download",
      "timestamp": "2026-05-20T15:30:00.000Z",
      "ipAddress": "203.177.xx.xx"
    },
    {
      "id": "log-002",
      "personName": "Dr. Ana Villanueva",
      "action": "view",
      "timestamp": "2026-05-19T10:00:00.000Z",
      "ipAddress": "120.28.xx.xx"
    },
    {
      "id": "log-003",
      "personName": "Dr. Carlos Reyes",
      "action": "download",
      "timestamp": "2026-05-18T08:45:00.000Z",
      "ipAddress": "175.176.xx.xx"
    }
  ]
}
```

---

## Document Tags (Commonly Used)

```json
["bylaws", "governance", "official", "finance", "annual-report", "cpd", "policy", "directory", "membership", "events", "guidelines", "minutes", "newsletter", "training", "compliance"]
```
