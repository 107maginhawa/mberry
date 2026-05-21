<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# M17 Marketplace -- Mock Data

> Non-authoritative. For UI prototyping only. Does not define business rules.

---

## Vendors (5 records)

```json
[
  {
    "id": "v-001-aaaa-bbbb-cccc-ddddeeee0001",
    "personId": "p-001-aaaa-bbbb-cccc-ddddeeee0001",
    "businessName": "HealthTech Solutions Inc.",
    "category": "emr",
    "description": "EMR solutions for dental clinics with cloud-based patient management.",
    "contactEmail": "info@healthtech-solutions.com",
    "websiteUrl": "https://healthtech-solutions.com",
    "verificationStatus": "verified",
    "createdAt": "2026-03-15T08:00:00.000Z"
  },
  {
    "id": "v-001-aaaa-bbbb-cccc-ddddeeee0002",
    "personId": "p-001-aaaa-bbbb-cccc-ddddeeee0002",
    "businessName": "DentalSupply PH",
    "category": "supplies",
    "description": "Premium dental supplies and instruments for Filipino dental professionals.",
    "contactEmail": "orders@dentalsupply.ph",
    "websiteUrl": "https://dentalsupply.ph",
    "verificationStatus": "verified",
    "createdAt": "2026-03-20T10:30:00.000Z"
  },
  {
    "id": "v-001-aaaa-bbbb-cccc-ddddeeee0003",
    "personId": "p-001-aaaa-bbbb-cccc-ddddeeee0003",
    "businessName": "InsureWell Health",
    "category": "insurance",
    "description": "Professional liability insurance for healthcare practitioners.",
    "contactEmail": "partners@insurewell.com",
    "websiteUrl": "https://insurewell.com",
    "verificationStatus": "pending",
    "createdAt": "2026-05-01T14:00:00.000Z"
  },
  {
    "id": "v-001-aaaa-bbbb-cccc-ddddeeee0004",
    "personId": "p-001-aaaa-bbbb-cccc-ddddeeee0004",
    "businessName": "TeleDent Connect",
    "category": "telehealth",
    "description": "Telehealth platform for remote dental consultations.",
    "contactEmail": "sales@teledent.io",
    "websiteUrl": "https://teledent.io",
    "verificationStatus": "suspended",
    "createdAt": "2026-02-10T09:00:00.000Z"
  },
  {
    "id": "v-001-aaaa-bbbb-cccc-ddddeeee0005",
    "personId": "p-001-aaaa-bbbb-cccc-ddddeeee0005",
    "businessName": "MedEquip Direct",
    "category": "supplies",
    "description": "Direct-to-clinic medical equipment at wholesale prices.",
    "contactEmail": "info@medequip-direct.com",
    "websiteUrl": null,
    "verificationStatus": "rejected",
    "createdAt": "2026-04-05T16:00:00.000Z"
  }
]
```

## Marketplace Listings (5 records)

```json
[
  {
    "id": "ml-001-aaaa-bbbb-cccc-ddddeeee0001",
    "vendorId": "v-001-aaaa-bbbb-cccc-ddddeeee0001",
    "vendorName": "HealthTech Solutions Inc.",
    "vendorVerified": true,
    "title": "Dental X-Ray Machine Model DX-500",
    "description": "High-resolution digital dental X-ray with panoramic capability. FDA-approved, CE-marked. Includes installation and 1-year warranty.",
    "price": 45000.00,
    "currency": "USD",
    "categoryTags": ["equipment", "imaging", "digital"],
    "imageUrl": null,
    "status": "active",
    "createdAt": "2026-04-01T10:00:00.000Z"
  },
  {
    "id": "ml-001-aaaa-bbbb-cccc-ddddeeee0002",
    "vendorId": "v-001-aaaa-bbbb-cccc-ddddeeee0001",
    "vendorName": "HealthTech Solutions Inc.",
    "vendorVerified": true,
    "title": "CloudDent EMR - Annual License",
    "description": "Cloud-based dental EMR with patient scheduling, charting, and billing integration. Per-clinic annual license.",
    "price": 2400.00,
    "currency": "USD",
    "categoryTags": ["software", "emr", "cloud"],
    "imageUrl": null,
    "status": "active",
    "createdAt": "2026-04-05T14:00:00.000Z"
  },
  {
    "id": "ml-001-aaaa-bbbb-cccc-ddddeeee0003",
    "vendorId": "v-001-aaaa-bbbb-cccc-ddddeeee0002",
    "vendorName": "DentalSupply PH",
    "vendorVerified": true,
    "title": "Composite Resin Kit (20 Shades)",
    "description": "Professional-grade composite resin kit with 20 shades for anterior and posterior restorations. Light-cure, radiopaque.",
    "price": 350.00,
    "currency": "USD",
    "categoryTags": ["materials", "restorative"],
    "imageUrl": null,
    "status": "active",
    "createdAt": "2026-04-10T08:00:00.000Z"
  },
  {
    "id": "ml-001-aaaa-bbbb-cccc-ddddeeee0004",
    "vendorId": "v-001-aaaa-bbbb-cccc-ddddeeee0002",
    "vendorName": "DentalSupply PH",
    "vendorVerified": true,
    "title": "Autoclave Sterilizer Class B",
    "description": "EU Class B autoclave sterilizer for dental instruments. 18L capacity, vacuum drying, USB data logging.",
    "price": 3200.00,
    "currency": "USD",
    "categoryTags": ["equipment", "sterilization", "infection-control"],
    "imageUrl": null,
    "status": "active",
    "createdAt": "2026-04-12T11:00:00.000Z"
  },
  {
    "id": "ml-001-aaaa-bbbb-cccc-ddddeeee0005",
    "vendorId": "v-001-aaaa-bbbb-cccc-ddddeeee0001",
    "vendorName": "HealthTech Solutions Inc.",
    "vendorVerified": true,
    "title": "Patient Kiosk Check-In Terminal",
    "description": "Touchscreen kiosk for patient self-check-in. Integrates with CloudDent EMR. Includes tablet and stand.",
    "price": 1200.00,
    "currency": "USD",
    "categoryTags": ["hardware", "patient-facing"],
    "imageUrl": null,
    "status": "draft",
    "createdAt": "2026-05-01T09:00:00.000Z"
  }
]
```

## Marketplace Orders (4 records)

```json
[
  {
    "id": "mo-001-aaaa-bbbb-cccc-ddddeeee0001",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "listingId": "ml-001-aaaa-bbbb-cccc-ddddeeee0003",
    "listingTitle": "Composite Resin Kit (20 Shades)",
    "vendorId": "v-001-aaaa-bbbb-cccc-ddddeeee0002",
    "vendorName": "DentalSupply PH",
    "buyerPersonId": "p-001-aaaa-bbbb-cccc-ddddeeee0010",
    "buyerName": "Dr. Maria Santos",
    "quantity": 3,
    "totalPrice": 1050.00,
    "currency": "USD",
    "status": "confirmed",
    "notes": "Please ship to clinic address on file.",
    "fulfilledAt": null,
    "createdAt": "2026-05-10T09:30:00.000Z"
  },
  {
    "id": "mo-001-aaaa-bbbb-cccc-ddddeeee0002",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "listingId": "ml-001-aaaa-bbbb-cccc-ddddeeee0001",
    "listingTitle": "Dental X-Ray Machine Model DX-500",
    "vendorId": "v-001-aaaa-bbbb-cccc-ddddeeee0001",
    "vendorName": "HealthTech Solutions Inc.",
    "buyerPersonId": "p-001-aaaa-bbbb-cccc-ddddeeee0011",
    "buyerName": "Dr. Juan Reyes",
    "quantity": 1,
    "totalPrice": 45000.00,
    "currency": "USD",
    "status": "pending",
    "notes": "Need installation scheduling after delivery.",
    "fulfilledAt": null,
    "createdAt": "2026-05-15T14:00:00.000Z"
  },
  {
    "id": "mo-001-aaaa-bbbb-cccc-ddddeeee0003",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "listingId": "ml-001-aaaa-bbbb-cccc-ddddeeee0004",
    "listingTitle": "Autoclave Sterilizer Class B",
    "vendorId": "v-001-aaaa-bbbb-cccc-ddddeeee0002",
    "vendorName": "DentalSupply PH",
    "buyerPersonId": "p-001-aaaa-bbbb-cccc-ddddeeee0010",
    "buyerName": "Dr. Maria Santos",
    "quantity": 1,
    "totalPrice": 3200.00,
    "currency": "USD",
    "status": "fulfilled",
    "notes": null,
    "fulfilledAt": "2026-05-08T16:00:00.000Z",
    "createdAt": "2026-04-28T10:00:00.000Z"
  },
  {
    "id": "mo-001-aaaa-bbbb-cccc-ddddeeee0004",
    "organizationId": "org-001-aaaa-bbbb-cccc-ddddeeee0001",
    "listingId": "ml-001-aaaa-bbbb-cccc-ddddeeee0002",
    "listingTitle": "CloudDent EMR - Annual License",
    "vendorId": "v-001-aaaa-bbbb-cccc-ddddeeee0001",
    "vendorName": "HealthTech Solutions Inc.",
    "buyerPersonId": "p-001-aaaa-bbbb-cccc-ddddeeee0012",
    "buyerName": "Dr. Ana Cruz",
    "quantity": 1,
    "totalPrice": 2400.00,
    "currency": "USD",
    "status": "cancelled",
    "notes": "Changed to multi-year plan instead.",
    "fulfilledAt": null,
    "createdAt": "2026-05-05T11:00:00.000Z"
  }
]
```
