# API Surface, State Machines & Domain Model Drift Audit

**Generated:** 2026-05-20
**Scope:** Steps 6, 6b, 7, 9b of codebase audit
**Branch:** feature/phase0-foundation

---

## Step 6: API Surface Catalogue

### 6.1 OpenAPI Endpoint Summary

**Total endpoints in OpenAPI spec:** 360

| Tag | Count | Handler Module |
|-----|-------|----------------|
| Association:Member | 151 | `association:member/` |
| Association:Operations | 54 | `association:operations/` |
| Communication | 28 | `communication/` |
| PlatformAdmin | 21 | `platformadmin/` |
| Booking | 18 | `booking/` |
| Person | 17 | `person/` |
| Billing | 16 | `billing/` |
| Documents | 15 | `documents/` |
| Comms | 10 | `comms/` |
| Email | 9 | `email/` |
| Storage | 6 | `storage/` |
| Notifs | 5 | `notifs/` |
| Membership | 4 | `membership/` |
| Reviews | 4 | `reviews/` |
| Audit | 1 | `audit/` |
| Dues | 1 | `dues/` |

### 6.2 Route Registration Architecture

Routes registered via two mechanisms:

1. **Generated routes** (`services/api-ts/src/generated/openapi/routes.ts`): Uses `registry.ts` which maps operationIds to handler function imports. All 360 OpenAPI endpoints are registered through this pipeline.
2. **Hand-wired routes** (`services/api-ts/src/app.ts`): 8 additional routes registered manually.

### 6.3 Hand-Wired Routes NOT in OpenAPI Spec

| Method | Path | Handler | Reason |
|--------|------|---------|--------|
| GET | `/accredited-providers/:organizationId` | `listAccreditedProviders` | Org-scoped training, not in provider.tsp |
| POST | `/accredited-providers/:organizationId` | `createAccreditedProvider` | Same as above |
| PATCH | `/accredited-providers/:organizationId/:providerId` | `updateAccreditedProvider` | Same as above |
| DELETE | `/accredited-providers/:organizationId/:providerId` | `deleteAccreditedProvider` | Same as above |
| GET | `/email/unsubscribe` | `unsubscribeEmail` | RFC 8058 public access — before auth middleware |
| POST | `/email/unsubscribe` | `unsubscribeEmail` | Same as above |
| GET | `/email/suppressions` | `listEmailSuppressions` | After auth middleware — officer-only |
| DELETE | `/email/suppressions/:email` | (implied) | After auth middleware |

**Finding:** 8 hand-wired routes exist outside OpenAPI spec. These are intentional (middleware ordering requirements or missing TypeSpec definitions), but create spec drift. The accredited-providers routes should be migrated to TypeSpec.

### 6.4 Handler Modules Without OpenAPI Tags

The following handler directories have **code** but **no corresponding OpenAPI tag**:

| Handler Module | Handler Count | Schema | Status |
|----------------|--------------|--------|--------|
| `advertising/` | 7 handlers | Yes (`advertising.schema.ts`) | No TypeSpec, no OpenAPI endpoints |
| `marketplace/` | 9 handlers | Yes (`marketplace repos`) | No TypeSpec, no OpenAPI endpoints |
| `jobs/` | Background jobs + job board handlers | Yes (`jobs.schema.ts`) | No TypeSpec, no OpenAPI endpoints |
| `training/` | 4 hand-wired handlers | Yes (accredited providers) | Partially hand-wired only |
| `events/` | Module dir exists | Shares with `association:operations` | Events tag absent in OpenAPI (uses Association:Operations) |
| `certificates/` | Module dir exists | Yes | Covered under other tags |

### 6.5 Error Handling Pattern Analysis

**Error class usage across all handlers:**

| Error Class | Count | HTTP Status |
|-------------|-------|-------------|
| `NotFoundError` | 295 | 404 |
| `UnauthorizedError` | 171 | 401 |
| `BusinessLogicError` | 159 | 422/400 |
| `Error` (generic) | 130 | 500 |
| `ValidationError` | 129 | 400 |
| `ForbiddenError` | 104 | 403 |
| `ConflictError` | 37 | 409 |
| `DeferredScopeError` | 8 | varies |
| `ExternalServiceError` | 2 | 502/503 |

**Direct `c.json()` error responses (bypassing error classes):**

| HTTP Status | Count |
|-------------|-------|
| 401 | 170 |
| 403 | 101 |
| 400 | 21 |
| 404 | 18 |
| 409 | 5 |
| 500 | 4 |
| 503 | 1 |
| 410 | 3 |
| 200 (error in body) | 2 |

**Inconsistencies Found:**

1. **MIXED ERROR PATTERNS** — 130 uses of generic `throw new Error()` instead of domain-specific error classes. These bypass the structured error handler and produce inconsistent 500 responses.
2. **DUAL ERROR PATHS** — 325 direct `c.json({ error: ... }, status)` responses coexist with `throw new XxxError()` pattern. The `platformadmin/transitionOrgStatus.ts` uses both: `throw new BusinessLogicError(...)` for transition errors but `return ctx.json({ error: 'Unauthorized' }, 401)` for auth.
3. **200-STATUS ERRORS** — 2 instances return HTTP 200 with error content in body.

---

## Step 6b: API Contract Drift

**No per-module `API_CONTRACTS.md` files exist** under `docs/product/modules/*/`.

Module specs exist at `docs/product/modules/m01-m19/MODULE_SPEC.md` but these are product specs, not API contract docs. Pure extraction mode.

**Module spec coverage:**

| Module Spec | Corresponding Handler |
|-------------|----------------------|
| m01-auth-onboarding | Better-Auth (integrated) |
| m02-member-profile | `person/` |
| m03-platform-admin | `platformadmin/` |
| m04-org-admin | `association:member/` (partial) |
| m05-membership | `membership/` |
| m06-dues-payments | `dues/` |
| m07-communications | `communication/`, `comms/`, `email/`, `notifs/` |
| m08-events | `association:operations/` (events subset) |
| m09-training | `association:operations/` (training subset), `training/` |
| m10-credit-tracking | `association:member/` (credits) |
| m11-documents-credentials | `documents/`, `certificates/` |
| m12-elections-governance | `elections/` |
| m13-professional-feed | No handler module |
| m14-national-dashboard | `association:operations/` (analytics) |
| m15-job-board | `jobs/` (no OpenAPI) |
| m16-advertising | `advertising/` (no OpenAPI) |
| m17-marketplace | `marketplace/` (no OpenAPI) |
| m18-surveys-polls | No handler module |
| m19-committee-management | `association:member/` (governance subset) |

**Gap:** m13, m18 have specs but no handler implementations. m15-m17 have handlers but no OpenAPI endpoints.

---

## Step 7: State Machine Trace

### 7.1 Explicit VALID_TRANSITIONS Maps (Guarded)

#### 7.1a Organization Lifecycle
**Source:** `services/api-ts/src/handlers/platformadmin/transitionOrgStatus.ts:9`

```
trial ──→ active
active ──→ suspended, cancelled
suspended ──→ active, cancelled
cancelled ──→ active (within 90 days only)
published, terminal — no transitions
```

**Guards:**
- Transition validation via `VALID_TRANSITIONS` map
- `cancelled → active`: 90-day reactivation window check (`REACTIVATION_WINDOW_EXPIRED`)
- Error: `BusinessLogicError` with code `INVALID_TRANSITION`

#### 7.1b Membership Status (Officer-Initiated)
**Source:** `services/api-ts/src/handlers/membership/updateMember.ts:25`

```
active ──→ suspended, removed
grace ──→ suspended
lapsed ──→ suspended, active
suspended ──→ active
```

**Guards:**
- `isValidTransition()` function with no-op passthrough (`from === to`)
- `pendingPayment → active/removed` handled by `reviewApplication`, not `updateMember`
- `active → grace` and `grace → lapsed` are **automatic** (computed from `dues_expiry_date`)
- `lapsed → active` also via payment recording (BR-07)

**Missing Guards:**
- `removed` has NO outbound transitions — terminal state, but no explicit guard prevents re-creation
- `pendingPayment` is not in the VALID_TRANSITIONS map — transitions handled by different handler (`reviewApplication`), creating a split state machine

#### 7.1c Election Status
**Source:** `services/api-ts/src/handlers/elections/updateElectionStatus.ts:5`

```
draft ──→ nominationsOpen, cancelled
nominationsOpen ──→ votingOpen, cancelled
votingOpen ──→ awaitingConfirmation, cancelled
awaitingConfirmation ──→ published, cancelled
published ──→ (terminal)
cancelled ──→ (terminal)
```

**Guards:**
- Transition validation via `VALID_TRANSITIONS` map
- `nominationsOpen → votingOpen`: checks minimum nominee count per position via `countNomineesByPosition`
- Error: `BusinessLogicError` with code `INVALID_ELECTION_TRANSITION` or `INSUFFICIENT_CANDIDATES`

### 7.2 Enum-Only Status Fields (No Explicit Transition Guards)

These entities have status enums but **no `VALID_TRANSITIONS` map** — transitions are implicit, meaning any value can be set if the handler allows it:

| Entity | Enum | Values | Risk |
|--------|------|--------|------|
| `booking` | `booking_status` | pending, confirmed, rejected, cancelled, completed, no_show_client, no_show_host | **HIGH** — 7 states, no guard. Could go `completed → pending` |
| `event` | `event_status` | draft, published, cancelled, completed | **MEDIUM** — 4 states, could revive cancelled events |
| `training` | `training_status` | draft, published, cancelled, completed | **MEDIUM** — same pattern as events |
| `dues_payment` | `dues_payment_status` | pending, completed, failed, refunded, partiallyRefunded, expired, submitted, underReview, confirmed, rejected | **HIGH** — 10 states, financial entity with no transition guard |
| `notification` | `notification_status` | queued, sent, delivered, read, failed, expired | **LOW** — system-managed, not user-facing |
| `email_queue` | `email_queue_status` | pending, processing, sent, failed, cancelled | **LOW** — system-managed |
| `invitation_token` | `invite_status` | pending, claimed, expired, revoked | **MEDIUM** — could re-claim expired invite |
| `affiliation_transfer` | `transfer_status` | requested, pendingSourceApproval, pendingTargetApproval, approved, denied, completed, cancelled | **HIGH** — 7 states, multi-party approval with no guard |
| `campaign` | `campaign_status` | draft, pending_review, active, paused, completed | **MEDIUM** — no OpenAPI endpoints yet |
| `creative` | `creative_status` | pending, approved, rejected | **LOW** — review workflow |
| `job_posting` | `job_posting_status` | draft, active, filled, expired, closed | **MEDIUM** — no OpenAPI endpoints |
| `job_application` | `job_application_status` | applied, screening, interviewed, offered, hired, rejected, withdrawn | **MEDIUM** — no OpenAPI endpoints |
| `vendor` | `vendor_status` | pending, verified, suspended, rejected | **MEDIUM** — no OpenAPI endpoints |
| `marketplace_listing` | `listing_status` | draft, active, sold, expired, removed | **LOW** — no OpenAPI endpoints |
| `marketplace_order` | `order_status` | pending, paid, shipped, delivered, cancelled, refunded | **MEDIUM** — financial, no OpenAPI endpoints |
| `committee_task` | `committee_task_status` | todo, in_progress, review, done, cancelled | **LOW** — internal workflow |
| `transition_checklist` | `transition_checklist_status` | pending, completed, skipped, overdue | **LOW** — governance workflow |

### 7.3 Critical Missing Guards Summary

| Priority | Entity | Issue |
|----------|--------|-------|
| **P0** | `dues_payment` | 10-state financial entity with no VALID_TRANSITIONS guard. Allows `completed → pending` or `refunded → completed`. |
| **P0** | `booking` | 7-state entity allows backward transitions (e.g., `completed → pending`). |
| **P1** | `affiliation_transfer` | 7-state multi-party approval flow with no guard — could skip approvals. |
| **P1** | `event` | Could transition `cancelled → draft`, reviving cancelled events. |
| **P1** | `training` | Same issue as events — cancelled → draft possible. |
| **P2** | `invitation_token` | Could re-claim expired/revoked invites without guard. |
| **P2** | `marketplace_order` | Financial entity — `refunded → pending` possible. No OpenAPI yet. |

---

## Step 9b: Domain Model Drift

### 9b.1 Entities in Code but NOT in DOMAIN_MODEL.md

18 tables exist in schema files but are absent from the DOMAIN_MODEL table index:

| Table | Module | Context | Notes |
|-------|--------|---------|-------|
| `advertiser` | advertising | -- | New module, no DOMAIN_MODEL entry |
| `ad_campaign` | advertising | -- | New module |
| `ad_creative` | advertising | -- | New module |
| `ad_report` | advertising | -- | New module |
| `member_ad_opt_out` | advertising | -- | New module |
| `committee` | association:member | Membership | Governance sub-entity |
| `committee_member` | association:member | Membership | Governance sub-entity |
| `committee_task` | association:member | Membership | Governance sub-entity |
| `disciplinary_action` | association:member | Membership | Ethics/compliance |
| `transition_checklist` | association:member | Membership | Governance sub-entity |
| `time_slot` | booking | Activities | Child of booking_event |
| `webhook_retry_log` | dues | Financial | Idempotency/retry tracking |
| `job_posting` | jobs | -- | New module, no DOMAIN_MODEL entry |
| `job_application` | jobs | -- | New module |
| `vendor` | marketplace | -- | New module |
| `marketplace_listing` | marketplace | -- | New module |
| `marketplace_order` | marketplace | -- | New module |
| `billing_config` | billing | Financial | Org-level billing configuration |

### 9b.2 DOMAIN_MODEL Table Index Format Issue

The DOMAIN_MODEL.md `Complete Table Index` section stores **file paths** (e.g., `person/repos/person.schema.ts`) rather than actual table names in some rows. This makes programmatic comparison unreliable. The index needs reformatting to use consistent `table_name` values.

### 9b.3 Aggregate Boundary Violations

**Cross-context direct imports (from DOMAIN_MODEL.md Section 12):**

| From Context | To Context | Import | Risk |
|-------------|-----------|--------|------|
| Financial (dues) | Membership | `membership_category` for `dues_category_override` | **MEDIUM** — Financial reads Membership schema directly |
| Activities (booking) | Membership | `OfficerTermRepository` for role checks | **HIGH** — Direct repo import crosses context boundary |
| Activities (events) | Membership | `OfficerTermRepository` for role checks | **HIGH** — Same pattern |
| Content (certificates) | Activities | `training` FK for certificate issuance | **MEDIUM** — FK crosses context |
| Governance (elections) | Membership | `position` FK for nominees | **MEDIUM** — FK crosses context |
| Platform (organization) | Referenced by 10+ tables | N/A | By design — organization is a shared kernel |

**Proper boundaries (ID-based references):**
- All contexts reference `person.id` via UUID (no FK, no direct import) — correct
- `organization.id` is referenced via UUID in most cases — correct

### 9b.4 Missing Domain Events

DOMAIN_MODEL.md Section 11 documents an event catalog, but code shows domain events are implemented as **direct notification repo calls**, not as a formal event bus:

| Expected Domain Event | Implementation | Gap |
|----------------------|----------------|-----|
| `MembershipApproved` | Direct `notificationRepo.createNotificationForModule()` | No event bus — tight coupling |
| `DuesPaymentReceived` | Direct repo call in webhook handler | Same pattern |
| `BookingConfirmed` | Direct `createNotificationForModule()` in `confirmBooking.ts` | Same |
| `EventPublished` | Direct call in `publishEvent.ts` | Same |
| `ElectionStatusChanged` | No notification at all | **Missing entirely** |
| `TrainingCompleted` | No notification observed | **Missing entirely** |
| `TransferApproved` | No notification observed | **Missing entirely** |

**Pattern:** All "domain events" are synchronous notification calls within the handler. No event emitter, no pub/sub, no eventual consistency. This is adequate for current scale but creates tight coupling between bounded contexts.

### 9b.5 State Machine Drift vs DOMAIN_MODEL

| Entity | DOMAIN_MODEL Says | Code Says | Drift |
|--------|------------------|-----------|-------|
| Organization | trial→active→suspended→cancelled (with guards) | Matches — `transitionOrgStatus.ts` | **ALIGNED** |
| Membership (officer) | active→suspended, grace→suspended, etc. | Matches — `updateMember.ts` | **ALIGNED** |
| Membership (computed) | Computed from `dues_expiry_date` at query time | Matches — BR-01 | **ALIGNED** |
| Election | draft→nominations→voting→confirmation→published | Matches — `updateElectionStatus.ts` | **ALIGNED** |
| Booking | "No explicit transition map" | Confirmed — no guard in code | **ALIGNED (both acknowledge gap)** |
| Dues Payment | "No explicit transition map" | Confirmed — no guard in code | **ALIGNED (both acknowledge gap)** |
| Event/Training | "No explicit transition map" | Confirmed — no guard | **ALIGNED** |

The DOMAIN_MODEL accurately reflects the current state of transition guards (or lack thereof). No drift detected between documented and actual state machines.

---

## Summary of Findings

### Critical Issues

| # | Severity | Finding | Location |
|---|----------|---------|----------|
| 1 | **P0** | `dues_payment` has 10 status values with no transition guard — financial risk | `dues/repos/dues-payments.schema.ts` |
| 2 | **P0** | `booking` has 7 status values with no transition guard — backward transitions possible | `booking/repos/booking.schema.ts` |
| 3 | **P1** | 130 uses of generic `throw new Error()` produce inconsistent 500 responses | Across all handler modules |
| 4 | **P1** | 325 direct `c.json({ error }, status)` responses bypass centralized error handling | Across all handler modules |
| 5 | **P1** | 8 hand-wired routes not in OpenAPI spec — spec drift | `app.ts:130-184` |
| 6 | **P1** | 18 tables in code not in DOMAIN_MODEL — model drift | advertising, marketplace, jobs, committee, etc. |
| 7 | **P1** | 3 handler modules (advertising, marketplace, jobs) have no OpenAPI endpoints | `handlers/advertising/`, `handlers/marketplace/`, `handlers/jobs/` |
| 8 | **P2** | Domain events implemented as direct repo calls, not event bus — tight coupling | All notification trigger points |
| 9 | **P2** | `affiliation_transfer` 7-state approval flow has no transition guard | `association:member/repos/chapters.schema.ts` |
| 10 | **P2** | DOMAIN_MODEL table index mixes file paths and table names — unreliable for automation | `docs/product/DOMAIN_MODEL.md` |
| 11 | **P2** | 3 module specs (m13, m18) have no handler implementations | `docs/product/modules/` |
| 12 | **P2** | `OfficerTermRepository` imported directly across context boundaries | booking, events handlers |

### Metrics

| Metric | Value |
|--------|-------|
| OpenAPI endpoints | 360 |
| Hand-wired routes (not in spec) | 8 |
| Handler modules | 24 (incl. `__tests__`) |
| OpenAPI tags | 16 |
| Modules with no OpenAPI coverage | 3 (advertising, marketplace, jobs) |
| Module specs (m01-m19) | 19 |
| Explicit state machines (guarded) | 3 (org, membership, election) |
| Unguarded status enums | 17 |
| P0 unguarded state machines | 2 (dues_payment, booking) |
| Tables in code not in DOMAIN_MODEL | 18 |
| Domain events missing notifications | 3 (election, training, transfer) |
| Error handling inconsistencies | 455 (130 generic + 325 direct json) |
