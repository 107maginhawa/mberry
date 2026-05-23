<!-- oli:ui-blueprint v2.0 | generated 2026-05-23 | source: MODULE_SPEC.md, Wave 2a design doc -->

# UI Blueprint — Mock Data: Events (M08) — Wave 2a

> Demonstration data for UI prototyping. **Non-authoritative.** UUIDs are fake.
> All names, locations, and amounts are fictional.
> DO NOT import from production code — mock data lives in test fixtures only.

---

## Events

```typescript
const mockEvents = [
  {
    id: "evt-001",
    organizationId: "org-pda-ncr",
    title: "CPD Seminar: Advances in Prosthodontics 2026",
    eventType: "seminar",
    description: "A full-day seminar covering the latest advances in prosthodontic materials and techniques. Featuring 3 speakers from PDA-accredited institutions.",
    location: "Manila Hotel Ballroom, One Rizal Park, Manila",
    startDate: "2026-07-15T09:00:00+08:00",
    endDate: "2026-07-15T17:00:00+08:00",
    capacity: 150,
    registrationFee: 50000, // PHP 500.00 in cents
    currency: "PHP",
    creditBearing: true,
    creditAmount: 8,
    cpdActivityType: "seminar",
    status: "published",
    visibility: "network",
    eventSlug: "cpd-seminar-advances-in-prosthodontics-2026",
    coverImageUrl: "https://storage.memberry.app/events/prostho-seminar-cover.jpg",
    publishedAt: "2026-06-01T08:00:00+08:00",
  },
  {
    id: "evt-002",
    organizationId: "org-pda-ncr",
    title: "PDA NCR General Assembly & Elections",
    eventType: "generalAssembly",
    description: "Annual general assembly with officer elections. All members in good standing are eligible to vote.",
    location: "Crowne Plaza Manila Galleria, Ortigas",
    startDate: "2026-08-20T14:00:00+08:00",
    endDate: "2026-08-20T18:00:00+08:00",
    capacity: 300,
    registrationFee: 0,
    currency: "PHP",
    creditBearing: false,
    creditAmount: 0,
    cpdActivityType: null,
    status: "draft",
    visibility: "internal",
    eventSlug: "pda-ncr-general-assembly-elections",
    coverImageUrl: null,
  },
  {
    id: "evt-003",
    organizationId: "org-pda-cebu",
    title: "Dental Mission: Brgy. Guadalupe",
    eventType: "other",
    description: "Community dental mission in Barangay Guadalupe. Volunteer dentists needed for extractions, prophylaxis, and oral health education.",
    location: "Guadalupe Community Center, Cebu City",
    startDate: "2026-06-28T07:00:00+08:00",
    endDate: "2026-06-28T15:00:00+08:00",
    capacity: 30,
    registrationFee: 0,
    currency: "PHP",
    creditBearing: true,
    creditAmount: 4,
    cpdActivityType: "community",
    status: "published",
    visibility: "network",
    eventSlug: "dental-mission-brgy-guadalupe",
    coverImageUrl: "https://storage.memberry.app/events/dental-mission-cebu.jpg",
  },
  {
    id: "evt-004",
    organizationId: "org-pda-ncr",
    title: "Hands-On Workshop: Digital Impressions",
    eventType: "other",
    description: "Hands-on workshop using intraoral scanners. Limited to 20 participants. Equipment provided.",
    location: "UST Dental Skills Lab, Manila",
    startDate: "2026-09-10T09:00:00+08:00",
    endDate: "2026-09-10T16:00:00+08:00",
    capacity: 20,
    registrationFee: 250000, // PHP 2,500.00
    currency: "PHP",
    creditBearing: true,
    creditAmount: 6,
    cpdActivityType: "hands_on",
    status: "published",
    visibility: "network",
    eventSlug: "hands-on-workshop-digital-impressions",
    coverImageUrl: "https://storage.memberry.app/events/digital-impressions-workshop.jpg",
  },
];
```

---

## Registrations

```typescript
const mockRegistrations = [
  {
    id: "reg-001",
    eventId: "evt-001",
    personId: "person-maria",
    status: "confirmed",
    registeredAt: "2026-06-15T10:30:00+08:00",
    cancelledAt: null,
  },
  {
    id: "reg-002",
    eventId: "evt-001",
    personId: "person-jose",
    status: "waitlisted",
    registeredAt: "2026-06-20T14:00:00+08:00",
    cancelledAt: null,
  },
  {
    id: "reg-003",
    eventId: "evt-004",
    personId: "person-maria",
    status: "confirmed",
    registeredAt: "2026-07-01T09:00:00+08:00",
    cancelledAt: null,
  },
];
```

---

## Check-Ins

```typescript
const mockCheckIns = [
  {
    id: "ci-001",
    eventId: "evt-001",
    personId: "person-maria",
    method: "manual",
    checkedInAt: "2026-07-15T08:45:00+08:00",
    checkedInBy: "person-officer-anna",
    attestation: {
      officerId: "person-officer-anna",
      method: "manual",
      deviceInfo: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)",
      timestamp: "2026-07-15T08:45:00+08:00",
    },
  },
  {
    id: "ci-002",
    eventId: "evt-001",
    personId: "person-carlos",
    method: "qr",
    checkedInAt: "2026-07-15T08:50:00+08:00",
    checkedInBy: "person-officer-anna",
    attestation: {
      officerId: "person-officer-anna",
      method: "qr",
      deviceInfo: "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X)",
      timestamp: "2026-07-15T08:50:00+08:00",
    },
  },
];
```

---

## Persons (for display context)

```typescript
const mockPersons = [
  { id: "person-maria", firstName: "Maria", lastName: "Santos", email: "maria@example.com" },
  { id: "person-jose", firstName: "Jose", lastName: "Reyes", email: "jose@example.com" },
  { id: "person-carlos", firstName: "Carlos", lastName: "Cruz", email: "carlos@example.com" },
  { id: "person-officer-anna", firstName: "Anna", lastName: "Garcia", email: "anna@example.com" },
];
```

---

## CPD Activity Types

```typescript
const cpdActivityTypes = [
  { value: "seminar", label: "Seminar", description: "Formal presentation" },
  { value: "workshop", label: "Workshop", description: "Hands-on, interactive" },
  { value: "conference", label: "Conference", description: "Multi-session event" },
  { value: "webinar", label: "Webinar", description: "Online live session" },
  { value: "hands_on", label: "Hands-on Training", description: "Clinical skills, lab work" },
  { value: "community", label: "Community Service", description: "Outreach, missions" },
  { value: "research", label: "Research", description: "Paper presentation, poster" },
  { value: "mentorship", label: "Mentorship", description: "Teaching, supervision" },
  { value: "self_directed", label: "Self-Directed Learning", description: "Journal club, reading group" },
  { value: "other", label: "Other", description: "Org-specific" },
];
```

---

## Stripe Checkout (paid registration)

```typescript
const mockStripeCheckout = {
  checkoutUrl: "https://checkout.stripe.com/c/pay/cs_test_a1b2c3d4e5",
  registrationId: "reg-003",
};
```

---

## .ics Calendar Output

```
BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Memberry//Events//EN
BEGIN:VEVENT
DTSTART:20260715T010000Z
DTEND:20260715T090000Z
SUMMARY:CPD Seminar: Advances in Prosthodontics 2026
LOCATION:Manila Hotel Ballroom\, One Rizal Park\, Manila
DESCRIPTION:A full-day seminar covering the latest advances...
UID:evt-001@memberry.app
END:VEVENT
END:VCALENDAR
```
