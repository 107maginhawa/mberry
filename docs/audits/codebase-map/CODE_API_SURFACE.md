---
oli-version: "1.0"
last-modified: 2026-05-30T12:00:00.000Z
last-modified-by: oli-codebase-map
---

# Code API Surface

Total endpoints: 421 (source: OpenAPI + hand-wired Hono routes)
Phantom (frontend calls w/o backend route): **0** (down from 9 — Wave G1 S-G1-07 reconciliation)
Unauthed/unknown-auth endpoints: 12

<!-- oli:regen:api-summary:begin -->
| Module | Endpoints | Authed | Unprotected/Unknown |
|---|---|---|---|
| association:member | 168 | 166 | 2 |
| association:operations | 60 | 60 | 0 |
| communication | 31 | 31 | 0 |
| platformadmin | 28 | 26 | 2 |
| booking | 18 | 18 | 0 |
| person | 18 | 18 | 0 |
| billing | 16 | 15 | 1 |
| documents | 15 | 15 | 0 |
| surveys | 13 | 13 | 0 |
| email | 12 | 10 | 2 |
| comms | 10 | 10 | 0 |
| storage | 6 | 6 | 0 |
| notifs | 5 | 5 | 0 |
| dues | 4 | 2 | 2 |
| invite | 4 | 3 | 1 |
| membership | 4 | 4 | 0 |
| reviews | 4 | 4 | 0 |
| onboarding | 2 | 2 | 0 |
| events | 2 | 0 | 2 |
| audit | 1 | 1 | 0 |
<!-- oli:regen:api-summary:end -->

## Phantom reconciliation (Wave G1 / S-G1-07)

All 9 phantom endpoints were resolved:

**Real drift fixes (4)** — frontend was calling a path the backend never served:

| Phantom (FE call) | Resolution |
|---|---|
| `GET /api/admin/organizations/{id}/status` | FE updated to `POST /admin/organizations/{id}/transition` (matches handler `transitionOrgStatus`) |
| `POST /api/communications/subscriptions/bulk` | FE re-routed to `POST /association/person-subscriptions/bulk-update` |
| `GET /api/association/member/credits/void-event` | New BE route added: `POST /association/member/credits/void-event` → `voidCreditEntry` (handler self-enforces officer position) |
| `GET /association/member/dues-member-summary/{orgId}/{memberId}` | New BE route added: `GET /association/member/dues-member-summary/{organizationId}/{personId}` → `getDuesMemberSummary` (handler self-enforces TREASURER/PRESIDENT) |

**False positives (5)** — already served by existing routes; FE path strings were misparsed by the phantom detector:

| Phantom (mis-parsed) | Actual route |
|---|---|
| `GET /api/admin/surveys?{params}` | `GET /admin/surveys` (line 621 of app.ts) |
| `GET /api/association/member/applications/bulk-approve` | Existing TypeSpec route |
| `GET /api/persons/me` | Existing `/persons/me/*` family of sub-routes |
| `GET /api/association/member/compliance/{orgId}{statusFilter ...}` | Existing compliance route (template-literal mis-parse) |
| `GET /api/public/orgs{qs ?...}` | `GET /public/orgs` (line 312 of app.ts) |

## Wave G3 — TypeSpec coverage push (not yet routed)

TypeSpec contracts were added for `advertising`, `jobs`, and `marketplace` (15 contract-only operations across 9 namespace interfaces). These are surfaced in the OpenAPI spec but **routes are NOT mounted in app.ts** pending product decision — see comment block at line ~670 of `specs/api/src/main.tsp`. They therefore do not appear in this CODE_API_SURFACE count, which catalogues actually-mounted Hono routes only.

| Namespace | Method/Path |
|---|---|
| AdvertisingModule | POST /association/advertising/advertisers |
| AdvertisingModule | POST /association/advertising/campaigns |
| AdvertisingModule | POST /association/advertising/creatives |
| AdvertisingModule | POST /association/advertising/creatives/{creativeId}/review |
| AdvertisingModule | POST /association/advertising/creatives/{creativeId}/report |
| AdvertisingModule | GET /association/advertising/placement |
| AdvertisingModule | POST /association/advertising/opt-out |
| JobsModule | POST /association/jobs/postings, GET, GET/{id}, PATCH/{id}, DELETE/{id} |
| JobsModule | POST /association/jobs/applications, PATCH/{applicationId} |
| MarketplaceModule | POST /association/marketplace/vendors, GET, GET/{id}, PATCH/{id} |
| MarketplaceModule | POST /association/marketplace/vendors/{vendorId}/verify |
| MarketplaceModule | POST /association/marketplace/listings, GET |
| MarketplaceModule | POST /association/marketplace/orders |
| MarketplaceModule | POST /association/marketplace/orders/{orderId}/fulfill |
