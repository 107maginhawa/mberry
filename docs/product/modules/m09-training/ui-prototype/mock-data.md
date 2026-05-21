<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M09 Training -- Mock Data

> Non-authoritative. For demonstration and UI prototyping only.

---

## Trainings

```json
[
  {
    "id": "t-001-seminar-oral",
    "organizationId": "org-pda-manila",
    "title": "CPD Seminar on Oral Surgery Advances",
    "description": "A comprehensive seminar covering the latest minimally invasive oral surgery techniques, including piezoelectric surgery and guided bone regeneration.",
    "trainingType": "seminar",
    "status": "published",
    "instructorName": "Dr. Maria Santos",
    "instructorId": "person-maria-santos",
    "location": "PDA Conference Hall, Manila",
    "startDate": "2026-06-15T09:00:00.000Z",
    "endDate": "2026-06-15T17:00:00.000Z",
    "capacity": 100,
    "enrollmentCount": 45,
    "registrationFee": 250000,
    "currency": "PHP",
    "creditBearing": true,
    "creditAmount": 8,
    "accreditedProviderId": "prov-001",
    "createdAt": "2026-05-10T08:00:00.000Z",
    "updatedAt": "2026-05-12T14:30:00.000Z"
  },
  {
    "id": "t-002-workshop-endo",
    "organizationId": "org-pda-manila",
    "title": "Hands-On Endodontics Workshop",
    "description": "Practical workshop on rotary endodontics with NiTi files. Participants will perform procedures on extracted teeth under supervision.",
    "trainingType": "workshop",
    "status": "draft",
    "instructorName": "Dr. Carlos Reyes",
    "instructorId": "person-carlos-reyes",
    "location": "UST Dental Skills Lab",
    "startDate": "2026-07-20T08:00:00.000Z",
    "endDate": "2026-07-20T12:00:00.000Z",
    "capacity": 30,
    "enrollmentCount": 0,
    "registrationFee": 500000,
    "currency": "PHP",
    "creditBearing": true,
    "creditAmount": 4,
    "accreditedProviderId": "prov-002",
    "createdAt": "2026-05-18T10:00:00.000Z",
    "updatedAt": "2026-05-18T10:00:00.000Z"
  },
  {
    "id": "t-003-convention-annual",
    "organizationId": "org-pda-national",
    "title": "PDA 2026 Annual Convention",
    "description": "The 108th Annual Convention of the Philippine Dental Association featuring keynote speakers, breakout sessions, and an exhibit hall.",
    "trainingType": "convention",
    "status": "published",
    "instructorName": null,
    "instructorId": null,
    "location": "SMX Convention Center, Pasay City",
    "startDate": "2026-09-10T08:00:00.000Z",
    "endDate": "2026-09-12T18:00:00.000Z",
    "capacity": 2000,
    "enrollmentCount": 834,
    "registrationFee": 800000,
    "currency": "PHP",
    "creditBearing": true,
    "creditAmount": 24,
    "accreditedProviderId": "prov-001",
    "createdAt": "2026-03-01T00:00:00.000Z",
    "updatedAt": "2026-05-15T09:00:00.000Z"
  },
  {
    "id": "t-004-online-infection",
    "organizationId": "org-pda-manila",
    "title": "Infection Control in Dental Practice (Online)",
    "description": "Self-paced online module covering infection control protocols, sterilization procedures, and PPE guidelines for dental professionals.",
    "trainingType": "onlineCourse",
    "status": "completed",
    "instructorName": "Dr. Ana Villanueva",
    "instructorId": "person-ana-villanueva",
    "location": null,
    "startDate": "2026-04-01T00:00:00.000Z",
    "endDate": "2026-04-30T23:59:59.000Z",
    "capacity": null,
    "enrollmentCount": 212,
    "registrationFee": 0,
    "currency": "PHP",
    "creditBearing": true,
    "creditAmount": 6,
    "accreditedProviderId": "prov-001",
    "createdAt": "2026-03-15T00:00:00.000Z",
    "updatedAt": "2026-05-01T00:00:00.000Z"
  },
  {
    "id": "t-005-skills-cpr",
    "organizationId": "org-pda-cebu",
    "title": "BLS/CPR Skills Training for Dental Teams",
    "description": "Basic Life Support and CPR certification course designed for dental practitioners and their clinic staff.",
    "trainingType": "skillsTraining",
    "status": "cancelled",
    "instructorName": "Dr. Ramon Cruz",
    "instructorId": null,
    "location": "Cebu Doctors' University Hospital",
    "startDate": "2026-05-25T13:00:00.000Z",
    "endDate": "2026-05-25T17:00:00.000Z",
    "capacity": 40,
    "enrollmentCount": 12,
    "registrationFee": 150000,
    "currency": "PHP",
    "creditBearing": false,
    "creditAmount": 0,
    "accreditedProviderId": null,
    "createdAt": "2026-05-01T00:00:00.000Z",
    "updatedAt": "2026-05-20T08:00:00.000Z"
  }
]
```

---

## Training Enrollments

```json
[
  {
    "id": "enr-001",
    "trainingId": "t-001-seminar-oral",
    "personId": "person-juan-dela-cruz",
    "personName": "Dr. Juan Dela Cruz",
    "status": "enrolled",
    "enrolledAt": "2026-05-12T10:00:00.000Z"
  },
  {
    "id": "enr-002",
    "trainingId": "t-001-seminar-oral",
    "personId": "person-ana-villanueva",
    "personName": "Dr. Ana Villanueva",
    "status": "enrolled",
    "enrolledAt": "2026-05-13T08:30:00.000Z"
  },
  {
    "id": "enr-003",
    "trainingId": "t-004-online-infection",
    "personId": "person-juan-dela-cruz",
    "personName": "Dr. Juan Dela Cruz",
    "status": "completed",
    "enrolledAt": "2026-04-02T14:00:00.000Z"
  },
  {
    "id": "enr-004",
    "trainingId": "t-005-skills-cpr",
    "personId": "person-maria-santos",
    "personName": "Dr. Maria Santos",
    "status": "cancelled",
    "enrolledAt": "2026-05-05T09:00:00.000Z"
  },
  {
    "id": "enr-005",
    "trainingId": "t-004-online-infection",
    "personId": "person-carlos-reyes",
    "personName": "Dr. Carlos Reyes",
    "status": "noShow",
    "enrolledAt": "2026-04-03T11:00:00.000Z"
  }
]
```

---

## Accredited Providers

```json
[
  {
    "id": "prov-001",
    "organizationId": "org-pda-national",
    "name": "Philippine Dental Association - CPD Council",
    "accreditationNumber": "PRC-ACC-2026-0001",
    "status": "active",
    "validUntil": "2027-12-31T23:59:59.000Z",
    "createdAt": "2026-01-01T00:00:00.000Z"
  },
  {
    "id": "prov-002",
    "organizationId": "org-pda-manila",
    "name": "UST Faculty of Dentistry CE Program",
    "accreditationNumber": "PRC-ACC-2026-0042",
    "status": "active",
    "validUntil": "2027-06-30T23:59:59.000Z",
    "createdAt": "2026-02-15T00:00:00.000Z"
  },
  {
    "id": "prov-003",
    "organizationId": "org-pda-cebu",
    "name": "Cebu Dental Chapter CE Committee",
    "accreditationNumber": "PRC-ACC-2025-0088",
    "status": "expired",
    "validUntil": "2025-12-31T23:59:59.000Z",
    "createdAt": "2025-03-01T00:00:00.000Z"
  }
]
```

---

## Certificates

```json
[
  {
    "id": "cert-001",
    "certificateNumber": "CERT-2026-PDA-00451",
    "trainingId": "t-004-online-infection",
    "personId": "person-juan-dela-cruz",
    "memberName": "Dr. Juan Dela Cruz, DMD",
    "trainingTitle": "Infection Control in Dental Practice (Online)",
    "trainingDate": "2026-04-01T00:00:00.000Z",
    "creditAmount": 6,
    "organizationName": "PDA Manila Chapter",
    "issuedAt": "2026-05-01T10:00:00.000Z",
    "qrCodeUrl": "/verify/certificate/CERT-2026-PDA-00451"
  },
  {
    "id": "cert-002",
    "certificateNumber": "CERT-2026-PDA-00320",
    "trainingId": "t-003-convention-annual",
    "personId": "person-ana-villanueva",
    "memberName": "Dr. Ana Villanueva, DMD, FPDS",
    "trainingTitle": "PDA 2026 Annual Convention",
    "trainingDate": "2026-09-10T00:00:00.000Z",
    "creditAmount": 24,
    "organizationName": "Philippine Dental Association",
    "issuedAt": "2026-09-13T08:00:00.000Z",
    "qrCodeUrl": "/verify/certificate/CERT-2026-PDA-00320"
  },
  {
    "id": "cert-003",
    "certificateNumber": "CERT-2026-PDA-00198",
    "trainingId": "t-001-seminar-oral",
    "personId": "person-carlos-reyes",
    "memberName": "Dr. Carlos Reyes, DMD, MDS",
    "trainingTitle": "CPD Seminar on Oral Surgery Advances",
    "trainingDate": "2026-06-15T00:00:00.000Z",
    "creditAmount": 8,
    "organizationName": "PDA Manila Chapter",
    "issuedAt": "2026-06-16T14:00:00.000Z",
    "qrCodeUrl": "/verify/certificate/CERT-2026-PDA-00198"
  }
]
```

---

## Courses (Feature-flagged: `training_courses`)

```json
[
  {
    "id": "course-001",
    "organizationId": "org-pda-national",
    "title": "Infection Control Best Practices",
    "description": "Self-paced module covering standard precautions, hand hygiene, instrument processing, and environmental infection control in dental settings.",
    "creditValue": 4,
    "status": "published",
    "createdAt": "2026-03-01T00:00:00.000Z"
  },
  {
    "id": "course-002",
    "organizationId": "org-pda-manila",
    "title": "Ethics in Dental Practice",
    "description": "Explores ethical dilemmas in dentistry, informed consent, patient autonomy, and the PRC Code of Ethics.",
    "creditValue": 2,
    "status": "draft",
    "createdAt": "2026-05-10T00:00:00.000Z"
  }
]
```

---

## My Training Response (GET /my/training)

```json
{
  "data": [
    {
      "trainingId": "t-001-seminar-oral",
      "title": "CPD Seminar on Oral Surgery Advances",
      "trainingType": "seminar",
      "startDate": "2026-06-15T09:00:00.000Z",
      "organizationName": "PDA Manila Chapter",
      "enrollmentStatus": "enrolled",
      "creditAmount": 8,
      "certificateId": null
    },
    {
      "trainingId": "t-004-online-infection",
      "title": "Infection Control in Dental Practice (Online)",
      "trainingType": "onlineCourse",
      "startDate": "2026-04-01T00:00:00.000Z",
      "organizationName": "PDA Manila Chapter",
      "enrollmentStatus": "completed",
      "creditAmount": 6,
      "certificateId": "cert-001"
    },
    {
      "trainingId": "t-003-convention-annual",
      "title": "PDA 2026 Annual Convention",
      "trainingType": "convention",
      "startDate": "2026-09-10T08:00:00.000Z",
      "organizationName": "Philippine Dental Association",
      "enrollmentStatus": "enrolled",
      "creditAmount": 24,
      "certificateId": null
    }
  ]
}
```

---

## Analytics Summary (Dashboard)

```json
{
  "totalTrainings": 5,
  "activeTrainings": 2,
  "completionRate": 72,
  "totalCreditsAwarded": 1268,
  "totalEnrollments": 1103
}
```
