<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 | source: MODULE_SPEC.md, API_CONTRACTS.md -->
# UI Blueprint --- Mock Data: Dues & Payments (M06)

> Demonstration data for UI prototyping. Non-authoritative. UUIDs are fake.
> All amounts in PHP. All names and references are fictional.

---

## Entity: DuesPayment (5 records)

```json
[
  {
    "id": "ff0e8400-e29b-41d4-a716-446655440001",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440001",
    "amount": "5000.00",
    "currency": "PHP",
    "status": "completed",
    "paymentMethod": "online",
    "gatewayTransactionId": "pi_3abc123def456",
    "receiptNumber": "PDA-2026-0042",
    "recordedBy": null,
    "paidAt": "2026-05-15T10:30:00.000Z",
    "organizationName": "PDA Manila Chapter",
    "memberName": "Maria Santos",
    "fundAllocations": [
      { "fundId": "aa0e8400-001", "fundName": "Chapter Operating", "amount": "3000.00" },
      { "fundId": "aa0e8400-002", "fundName": "National", "amount": "1500.00" },
      { "fundId": "aa0e8400-003", "fundName": "Activity Fund", "amount": "500.00" }
    ]
  },
  {
    "id": "ff0e8400-e29b-41d4-a716-446655440002",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440003",
    "amount": "5000.00",
    "currency": "PHP",
    "status": "completed",
    "paymentMethod": "cash",
    "gatewayTransactionId": null,
    "receiptNumber": "PDA-2026-0043",
    "recordedBy": "cc0e8400-e29b-41d4-a716-446655440001",
    "paidAt": "2026-05-10T14:00:00.000Z",
    "organizationName": "PDA Manila Chapter",
    "memberName": "Ana Cruz",
    "fundAllocations": [
      { "fundId": "aa0e8400-001", "fundName": "Chapter Operating", "amount": "3000.00" },
      { "fundId": "aa0e8400-002", "fundName": "National", "amount": "1500.00" },
      { "fundId": "aa0e8400-003", "fundName": "Activity Fund", "amount": "500.00" }
    ]
  },
  {
    "id": "ff0e8400-e29b-41d4-a716-446655440003",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440004",
    "amount": "3000.00",
    "currency": "PHP",
    "status": "pending",
    "paymentMethod": "online",
    "gatewayTransactionId": "pi_3xyz789ghi012",
    "receiptNumber": null,
    "recordedBy": null,
    "paidAt": null,
    "organizationName": "PDA Manila Chapter",
    "memberName": "Carlos Mendoza"
  },
  {
    "id": "ff0e8400-e29b-41d4-a716-446655440004",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440006",
    "amount": "5000.00",
    "currency": "PHP",
    "status": "refunded",
    "paymentMethod": "online",
    "gatewayTransactionId": "pi_3ref456abc789",
    "receiptNumber": "PDA-2026-0038",
    "recordedBy": null,
    "paidAt": "2026-04-20T09:15:00.000Z",
    "organizationName": "PDA Manila Chapter",
    "memberName": "Roberto Aquino"
  },
  {
    "id": "ff0e8400-e29b-41d4-a716-446655440005",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "personId": "770e8400-e29b-41d4-a716-446655440007",
    "amount": "1000.00",
    "currency": "PHP",
    "status": "completed",
    "paymentMethod": "gcash",
    "gatewayTransactionId": null,
    "receiptNumber": "PDA-2026-0044",
    "recordedBy": "cc0e8400-e29b-41d4-a716-446655440001",
    "paidAt": "2026-05-18T11:00:00.000Z",
    "organizationName": "PDA Manila Chapter",
    "memberName": "Sofia Ramos"
  }
]
```

---

## Entity: DuesOrgConfig (1 record)

```json
{
  "id": "220e8400-e29b-41d4-a716-446655440001",
  "organizationId": "660e8400-e29b-41d4-a716-446655440000",
  "duesAmount": "5000.00",
  "billingFrequency": "annual",
  "gracePeriodDays": 30,
  "categoryOverrides": [
    { "categoryId": "880e8400-e29b-41d4-a716-446655440003", "categoryName": "Associate", "amount": "3000.00" },
    { "categoryId": "880e8400-e29b-41d4-a716-446655440004", "categoryName": "Student", "amount": "1000.00" },
    { "categoryId": "880e8400-e29b-41d4-a716-446655440002", "categoryName": "Life Member", "amount": "0.00" }
  ]
}
```

---

## Entity: DuesFund (3 records)

```json
[
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440001",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Chapter Operating",
    "percentage": "60.00",
    "sortOrder": 1
  },
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440002",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "National",
    "percentage": "30.00",
    "sortOrder": 2
  },
  {
    "id": "aa0e8400-e29b-41d4-a716-446655440003",
    "organizationId": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Activity Fund",
    "percentage": "10.00",
    "sortOrder": 3
  }
]
```

---

## Entity: DuesGatewayConfig (1 record)

```json
{
  "id": "330e8400-e29b-41d4-a716-446655440001",
  "organizationId": "660e8400-e29b-41d4-a716-446655440000",
  "provider": "paymongo",
  "isActive": true,
  "createdAt": "2026-01-15T10:00:00.000Z"
}
```

---

## Entity: DuesReminderSchedule (5 records)

```json
[
  { "duesConfigId": "220e8400-001", "daysBefore": 60, "daysAfter": null, "channel": "email" },
  { "duesConfigId": "220e8400-001", "daysBefore": 30, "daysAfter": null, "channel": "email" },
  { "duesConfigId": "220e8400-001", "daysBefore": 7, "daysAfter": null, "channel": "email" },
  { "duesConfigId": "220e8400-001", "daysBefore": null, "daysAfter": 7, "channel": "email" },
  { "duesConfigId": "220e8400-001", "daysBefore": null, "daysAfter": 30, "channel": "email" }
]
```

---

## Financial Report: Collection Summary

```json
{
  "type": "collection",
  "period": { "from": "2026-01-01", "to": "2026-05-21" },
  "summary": {
    "totalCollected": "250000.00",
    "totalMembers": 50,
    "collectionRate": 0.72,
    "totalOutstanding": "97500.00"
  }
}
```

---

## Financial Report: Aging Buckets

```json
{
  "type": "aging",
  "period": { "from": "2026-01-01", "to": "2026-05-21" },
  "buckets": [
    { "label": "Current", "dayRange": "0-30", "count": 8, "amount": "40000.00" },
    { "label": "30 Days", "dayRange": "31-60", "count": 5, "amount": "25000.00" },
    { "label": "60 Days", "dayRange": "61-90", "count": 3, "amount": "15000.00" },
    { "label": "90 Days", "dayRange": "91-120", "count": 2, "amount": "10000.00" },
    { "label": "120+ Days", "dayRange": "120+", "count": 1, "amount": "7500.00" }
  ]
}
```

---

## Token-Based Payment Page Data

```json
{
  "organizationName": "PDA Manila Chapter",
  "memberName": "Carlos Mendoza",
  "duesAmount": "3000.00",
  "currency": "PHP",
  "dueDate": "2026-06-30",
  "checkoutUrl": "https://checkout.paymongo.com/cs_live_abc123"
}
```
