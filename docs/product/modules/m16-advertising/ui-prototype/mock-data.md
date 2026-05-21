<!-- oli:ui-blueprint v1.0 | generated 2026-05-21 -->
# UI Blueprint -- Mock Data: Advertising (M16)

> Mock data is for UI demonstration only. It must not be treated as final schema, API contract, lifecycle state, or business rule.

---

## Mock Entity: Advertiser

```json
[
  {
    "id": "adv-001-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "companyName": "PhilDental Supplies Inc.",
    "contactEmail": "ads@phildental.com",
    "contactPersonId": "person-advertiser-reyes-uuid",
    "status": "active",
    "createdAt": "2026-03-15T08:00:00Z",
    "updatedAt": "2026-03-15T08:00:00Z"
  },
  {
    "id": "adv-002-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "companyName": "MedEquip Asia Corp.",
    "contactEmail": "marketing@medequip.asia",
    "contactPersonId": null,
    "status": "active",
    "createdAt": "2026-04-01T10:00:00Z",
    "updatedAt": "2026-04-01T10:00:00Z"
  },
  {
    "id": "adv-003-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "companyName": "DentaCare Insurance PH",
    "contactEmail": "partnerships@dentacare.ph",
    "contactPersonId": null,
    "status": "active",
    "createdAt": "2026-04-20T14:00:00Z",
    "updatedAt": "2026-04-20T14:00:00Z"
  }
]
```

---

## Mock Entity: AdCampaign

```json
[
  {
    "id": "camp-001-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "advertiserId": "adv-001-uuid",
    "advertiserName": "PhilDental Supplies Inc.",
    "name": "May Dental Equipment Sale",
    "description": "Promote 50% off premium dental instruments for association members.",
    "status": "active",
    "targetSegmentId": "segment-general-dentistry",
    "targetSegmentSize": 2840,
    "budgetCents": 5000000,
    "spentCents": 3245000,
    "adSlot": "feed_banner",
    "startsAt": "2026-05-01T00:00:00Z",
    "endsAt": "2026-05-31T23:59:59Z",
    "impressions": 12483,
    "clicks": 847,
    "ctr": 6.79,
    "createdAt": "2026-04-28T09:00:00Z",
    "updatedAt": "2026-05-21T06:00:00Z"
  },
  {
    "id": "camp-002-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "advertiserId": "adv-002-uuid",
    "advertiserName": "MedEquip Asia Corp.",
    "name": "CAD/CAM Systems Launch",
    "description": "Introducing next-generation CAD/CAM dental systems. Book a demo at the annual convention.",
    "status": "draft",
    "targetSegmentId": "segment-orthodontics",
    "targetSegmentSize": 620,
    "budgetCents": 10000000,
    "spentCents": 0,
    "adSlot": "sidebar",
    "startsAt": "2026-06-01T00:00:00Z",
    "endsAt": "2026-06-30T23:59:59Z",
    "impressions": 0,
    "clicks": 0,
    "ctr": 0,
    "createdAt": "2026-05-18T11:00:00Z",
    "updatedAt": "2026-05-18T11:00:00Z"
  },
  {
    "id": "camp-003-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "advertiserId": "adv-003-uuid",
    "advertiserName": "DentaCare Insurance PH",
    "name": "Professional Liability Insurance",
    "description": "Malpractice coverage designed for dental professionals. Members get 15% discount.",
    "status": "paused",
    "targetSegmentId": null,
    "targetSegmentSize": null,
    "budgetCents": 3000000,
    "spentCents": 1875000,
    "adSlot": "email_footer",
    "startsAt": "2026-04-01T00:00:00Z",
    "endsAt": "2026-06-30T23:59:59Z",
    "impressions": 8921,
    "clicks": 312,
    "ctr": 3.50,
    "createdAt": "2026-03-25T14:00:00Z",
    "updatedAt": "2026-05-15T10:00:00Z"
  },
  {
    "id": "camp-004-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "advertiserId": "adv-001-uuid",
    "advertiserName": "PhilDental Supplies Inc.",
    "name": "Convention Booth Sponsor",
    "description": "Gold sponsor placement at the 2026 Annual Convention.",
    "status": "completed",
    "targetSegmentId": null,
    "targetSegmentSize": null,
    "budgetCents": 15000000,
    "spentCents": 15000000,
    "adSlot": "event_sponsor",
    "startsAt": "2026-05-16T00:00:00Z",
    "endsAt": "2026-05-18T23:59:59Z",
    "impressions": 4520,
    "clicks": 189,
    "ctr": 4.18,
    "createdAt": "2026-04-10T08:00:00Z",
    "updatedAt": "2026-05-19T00:00:00Z"
  }
]
```

### Mock Status Values (AdCampaign)
- **draft:** Campaign created, not yet active. Editable.
- **pending_review:** Awaiting admin review (if workflow requires).
- **active:** Campaign serving ads to members.
- **paused:** Manually paused by admin, or auto-paused due to budget exhaustion (M16-R6).
- **completed:** Campaign end date reached or manually completed. Terminal.
- **rejected:** Campaign rejected during review. Terminal.

---

## Mock Entity: AdCreative

```json
[
  {
    "id": "creative-001-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "campaignId": "camp-001-uuid",
    "title": "50% Off Dental Instruments",
    "bodyText": "Premium dental instruments at half price. Exclusive offer for PDA members. Shop now at phildental.com.",
    "imageUrl": "https://cdn.example.com/ads/phildental-sale-banner.jpg",
    "clickUrl": "https://phildental.com/promo/pda-may2026",
    "status": "approved",
    "sponsoredLabel": true,
    "reviewedBy": "person-admin-uuid",
    "reviewedAt": "2026-04-29T14:00:00Z",
    "rejectionReason": null,
    "createdAt": "2026-04-28T09:30:00Z",
    "updatedAt": "2026-04-29T14:00:00Z"
  },
  {
    "id": "creative-002-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "campaignId": "camp-002-uuid",
    "title": "Next-Gen CAD/CAM Demo",
    "bodyText": "See the future of digital dentistry. Book a live demo of our new CAD/CAM system at the convention booth.",
    "imageUrl": "https://cdn.example.com/ads/medequip-cadcam.jpg",
    "clickUrl": "https://medequip.asia/demo-booking",
    "status": "pending",
    "sponsoredLabel": true,
    "reviewedBy": null,
    "reviewedAt": null,
    "rejectionReason": null,
    "createdAt": "2026-05-18T11:30:00Z",
    "updatedAt": "2026-05-18T11:30:00Z"
  },
  {
    "id": "creative-003-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "campaignId": "camp-002-uuid",
    "title": "CAD/CAM Early Bird Pricing",
    "bodyText": "Order before June 15 and save 20% on our flagship system. Financing available for PDA members.",
    "imageUrl": null,
    "clickUrl": "https://medequip.asia/early-bird",
    "status": "rejected",
    "sponsoredLabel": true,
    "reviewedBy": "person-admin-uuid",
    "reviewedAt": "2026-05-19T10:00:00Z",
    "rejectionReason": "Pricing claims must include disclaimer about terms and conditions. Please revise body text.",
    "createdAt": "2026-05-18T12:00:00Z",
    "updatedAt": "2026-05-19T10:00:00Z"
  },
  {
    "id": "creative-004-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "campaignId": "camp-003-uuid",
    "title": "Protect Your Practice",
    "bodyText": "Professional liability insurance from PHP 2,500/month. 15% PDA member discount. Get a free quote today.",
    "imageUrl": "https://cdn.example.com/ads/dentacare-shield.jpg",
    "clickUrl": "https://dentacare.ph/dental-professional",
    "status": "approved",
    "sponsoredLabel": true,
    "reviewedBy": "person-admin-uuid",
    "reviewedAt": "2026-03-27T09:00:00Z",
    "rejectionReason": null,
    "createdAt": "2026-03-25T14:30:00Z",
    "updatedAt": "2026-03-27T09:00:00Z"
  }
]
```

### Mock Status Values (AdCreative)
- **pending:** Creative submitted, awaiting admin review (M16-R1).
- **approved:** Reviewed and approved by admin. Ready to serve.
- **rejected:** Reviewed and rejected with reason.

---

## Mock Entity: AdReport

```json
[
  {
    "id": "report-001-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "creativeId": "creative-001-uuid",
    "reporterPersonId": "person-dr-mendoza-uuid",
    "reason": "This ad appears to be making unverified health claims about dental instruments.",
    "isSuppressed": false,
    "createdAt": "2026-05-10T16:00:00Z"
  },
  {
    "id": "report-002-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "creativeId": "creative-004-uuid",
    "reporterPersonId": "person-dr-cruz-uuid",
    "reason": "Insurance pricing shown does not match the actual quote I received.",
    "isSuppressed": false,
    "createdAt": "2026-05-12T09:30:00Z"
  }
]
```

---

## Mock Entity: MemberAdOptOut

```json
[
  {
    "id": "optout-001-uuid",
    "organizationId": "org-cebu-dental-uuid",
    "personId": "person-dr-lim-uuid",
    "optedOutAt": "2026-05-08T11:00:00Z"
  }
]
```

---

## Mock Ad Opt-Out Status Response

```json
{
  "data": {
    "isOptedOut": true,
    "optedOutAt": "2026-05-08T11:00:00Z"
  }
}
```

---

### Prototype-Only Assumptions
- Budget values are in cents (PHP centavos); UI converts to PHP for display (e.g., 5000000 cents = PHP 50,000)
- CTR is pre-calculated by the API as a float percentage; UI formats to 2 decimal places
- sponsoredLabel is always true per M16-R5; included in mock for completeness
- targetSegmentId is an opaque identifier; no PII is exposed (M16-R2)
- Impression and click tracking endpoints (POST /ads/{creativeId}/impression, POST /ads/{creativeId}/click) are fire-and-forget from the client; no response data needed
- Ad display components (feed banner, sidebar widget, email footer) are not defined in this module's screens as they are embedded in other module UIs; only the report/opt-out interactions are M16-owned
