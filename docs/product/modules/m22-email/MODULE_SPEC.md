# Module Specification: Email (M22)

---
oli_version: "Phase B — Module Specs"
oli_artifact: MODULE_SPEC
Spec Version: 1.0
Last Updated: 2026-05-29
Last Validated Against: DOMAIN_MODEL.md v1.0, EVENT_CONTRACTS.md v1.0
---

## 1. Module Overview

### Purpose
Transactional and bulk email infrastructure. Manages Handlebars-based email templates, an async processing queue with retry logic, and a suppression list for bounces/unsubscribes/complaints. Provides the email delivery rail that other modules (M07 Communications, M06 Dues, M08 Events) use to send emails. Supports multiple providers: SMTP, Postmark, OneSignal.

### Users
- Admin — manage email templates, view queue status, manage suppressions
- System — enqueue emails, process queue, handle bounces/complaints, retry failures
- Other modules — enqueue transactional emails via template tags

### Related Modules
- M07 (Communications — triggers transactional emails for announcements, messages)
- M06 (Dues — payment receipts, dunning emails)
- M08 (Events — registration confirmations, cancellation notices)
- M05 (Membership — welcome emails, renewal reminders)

### In Scope
- Email template CRUD with Handlebars variables, status lifecycle (draft/active/archived)
- Email queue with async processing, retry logic (configurable attempts), provider routing
- Suppression list management (hard bounce, unsubscribe, complaint, manual)
- Multi-provider support (SMTP, Postmark, OneSignal)
- Queue item cancellation with reason tracking
- Template variable type validation (string, number, boolean, date, datetime, url, email, array)
- Bulk vs transactional email category classification

### Out of Scope
- Email content authoring UI (admin uses template management API)
- Marketing automation / drip campaigns
- Push notifications (M22 notifs module)
- SMS delivery

## 2. Domain Terms Used in This Module

| Term | Definition |
|------|-----------|
| Email Template | Reusable Handlebars template with subject, HTML body, optional text body, and typed variable definitions. |
| Email Queue Item | Pending email in the async processing queue. Tracks status, retry attempts, provider, and delivery metadata. |
| Suppression | Email address blocked from receiving emails due to bounce, unsubscribe, complaint, or manual block. |
| Template Tags | String array for categorizing templates (e.g., `['appointment', 'billing']`). Used for resolution during queue processing. |
| Variable Definition | Schema for template variables — name, type (string/number/boolean/date/etc.), required flag, default value. |
| Email Category | Classification: `bulk` (marketing/newsletters) or `transactional` (receipts, confirmations). |
| Email Provider | Delivery service: `smtp` (default), `postmark` (transactional), `onesignal` (multi-channel). |

## 3. Workflows

| Workflow | WF-ID | Actor | Description | Priority |
|----------|-------|-------|-------------|----------|
| Create Template | WF-115 | Admin | Define reusable email template with variables | P0 |
| Enqueue Email | WF-116 | System | Add email to processing queue with template and variables | P0 |
| Process Queue | WF-110 | System | Pick pending items, render template, send via provider; queue lifecycle pending -> sent/failed, 30-day cleanup | P0 |
| Handle Bounce | WF-117 | System | Process hard bounce, add to suppression list | P0 |
| Manage Suppressions | WF-118 | Admin | View/remove suppressed addresses | P0 |
| Cancel Queued Email | WF-119 | Admin | Cancel pending email before processing | P1 |
| Retry Failed Email | WF-120 | System | Re-attempt failed delivery up to max retries | P0 |

**Note:** WF-110 (Email Queue Processing) is the canonical cross-cutting workflow listed in `docs/product/WORKFLOW_MAP.md` §1.20. WF-115..WF-120 are minted in this spec for module-local admin/system workflows; they are owned by M22 and registered alongside this revision.

## 4. Business Rules

| Rule ID | Global BR-ID | Rule | Applies To | Expected Behavior |
|---------|--------------|------|-----------|-------------------|
| M22-R1 | BR-52 | IF recipient email is on suppression list THEN skip delivery | Queue processing | Suppressed emails silently dropped |
| M22-R2 | BR-53 | IF template status is not `active` THEN reject queue item creation | Enqueue | Only active templates can send |
| M22-R3 | BR-54 | IF retry attempts exceed max THEN mark queue item `failed` | Queue processing | Stop retrying after threshold |
| M22-R4 | BR-55 | IF hard bounce received THEN add to suppression with reason `hard_bounce` | Bounce handling | Auto-suppress bad addresses |
| M22-R5 | BR-56 | IF complaint received THEN add to suppression with reason `complaint` | Complaint handling | CAN-SPAM compliance |
| M22-R6 | BR-57 | IF email category is `transactional` THEN check suppression but allow override | Queue processing | Transactional may bypass marketing suppression |
| M22-R7 | BR-58 | IF template has required variables THEN validate all present before enqueue | Enqueue | Prevent rendering errors |
| M22-R8 | BR-59 | IF queue item cancelled THEN record canceller ID, reason, and timestamp | Cancellation | Audit trail for cancellations |

**Note:** Module-local IDs (M22-R*) are aliased to global IDs (BR-52..BR-59) for cross-spec traceability. New global IDs are registered in `docs/ver-3/business/br-registry.json` in this revision.

## 5. Permissions

| Action | Allowed Roles | Notes |
|--------|--------------|-------|
| List/get email templates | Admin | Admin-only template management |
| Create email template | Admin | Admin-only |
| Update email template | Admin | Admin-only |
| Delete email template | Admin | Admin-only |
| List email queue items | Admin | View queue status |
| Get email queue item | Admin | View item details |
| Cancel email queue item | Admin | Before processing |
| Retry email queue item | Admin | Re-attempt failed |
| Send email (direct) | Admin | Immediate send |
| List suppressions | Admin | View blocked addresses |
| Remove suppression | Admin | Unblock address |

## 6. Data Requirements

### Entity: EmailTemplate (13 columns excl. base)

| Field | Required | Description | Validation |
|-------|---------|-------------|------------|
| organizationId | Yes | Multi-tenant scope | UUID |
| name | Yes | Template name | Unique per org |
| slug | Yes | URL-friendly identifier | Unique per org |
| tags | No | Categorization tags | String array |
| subject | Yes | Email subject (Handlebars) | Max 998 chars (RFC 2822) |
| bodyHtml | Yes | HTML body (Handlebars) | Text |
| bodyText | No | Plain text fallback | Text |
| variables | No | Variable definitions | JSONB array of {name, type, required, default} |
| status | Yes | draft/active/archived | Enum |
| fromName | No | Sender display name | String |
| fromEmail | No | Sender email | Valid email |
| replyTo | No | Reply-to address | Valid email |
| metadata | No | Additional template data | JSONB |

### Entity: EmailQueue (16 columns excl. base)

| Field | Required | Description | Validation |
|-------|---------|-------------|------------|
| organizationId | Yes | Multi-tenant scope | UUID |
| templateId | No | Template FK | UUID (nullable for direct send) |
| templateTags | No | Tags for template resolution | String array |
| recipientEmail | Yes | Destination address | Valid email |
| recipientName | No | Recipient display name | Max 255 chars |
| variables | Yes | Template rendering data | JSONB |
| metadata | No | Tracking metadata | JSONB |
| status | Yes | pending/processing/sent/failed/cancelled | Enum |
| category | Yes | bulk/transactional | Enum |
| priority | Yes | Processing priority | Integer, default 0 |
| attempts | Yes | Retry count | Integer, default 0 |
| lastAttemptAt | No | Last attempt timestamp | Timestamptz |
| nextRetryAt | No | Scheduled retry time | Timestamptz |
| lastError | No | Failure message | Text |
| sentAt | No | Delivery timestamp | Timestamptz |
| provider | No | Delivery provider used | Enum: smtp/postmark/onesignal |
| providerMessageId | No | Provider tracking ID | String |
| cancelledAt/cancelledBy/cancellationReason | No | Cancellation audit | Timestamptz/UUID/Text |

### Entity: EmailSuppression (5 columns excl. base)

| Field | Required | Description | Validation |
|-------|---------|-------------|------------|
| organizationId | Yes | Multi-tenant scope | UUID |
| email | Yes | Suppressed address | Valid email, unique per org |
| reason | Yes | hard_bounce/unsubscribe/complaint/manual | Enum |
| source | No | How suppression was added | Text |
| metadata | No | Additional context | JSONB |

## 7. State Transitions

### Template Status
```
Draft ──activate──► Active ──archive──► Archived
Draft ──archive──► Archived
Archived ──reactivate──► Active
```

### Queue Item Status
```
Pending ──process──► Processing ──success──► Sent
Processing ──fail──► Failed (if attempts < max, nextRetryAt set → Pending)
Processing ──fail──► Failed (if attempts >= max, terminal)
Pending ──cancel──► Cancelled
```

## 8. API Expectations

Each endpoint is anchored to ≥1 WF (workflow) and/or BR (business rule) for traceability per `docs/audits/TRACEABILITY_REPORT.md` TR-P1-003.

| API Need | Method | Route | Auth | Anchors | Notes |
|----------|--------|-------|------|---------|-------|
| List email templates | GET | /email/templates | Required (admin) | WF-115 | Filter by status, tags |
| Get email template | GET | /email/templates/:id | Required (admin) | WF-115 | — |
| Create email template | POST | /email/templates | Required (admin) | WF-115, BR-58 | Required-variable validation (BR-58) |
| Update email template | PUT | /email/templates/:id | Required (admin) | WF-115, BR-58 | Required-variable validation (BR-58) |
| Delete email template | DELETE | /email/templates/:id | Required (admin) | WF-115 | — |
| List email queue items | GET | /email/queue | Required (admin) | WF-110 | Filter by status |
| Get email queue item | GET | /email/queue/:id | Required (admin) | WF-110 | — |
| Cancel email queue item | PUT | /email/queue/:id/cancel | Required (admin) | WF-119, BR-59 | Records canceller/reason/timestamp (BR-59) |
| Retry email queue item | POST | /email/queue/:id/retry | Required (admin) | WF-120, BR-54 | Bounded by max-attempts threshold (BR-54) |
| Send email (direct) | POST | /email/send | Required (admin) | WF-116, BR-52, BR-53, BR-57, BR-58 | Suppression check (BR-52), active-template check (BR-53), transactional override (BR-57), variable validation (BR-58) |
| List suppressions | GET | /email/suppressions | Required (admin) | WF-118 | — |
| Remove suppression | DELETE | /email/suppressions/:id | Required (admin) | WF-118 | Unblock address |

**Anchor coverage:** 12/12 endpoints anchored. WF-110 (cross-cutting queue lifecycle from WORKFLOW_MAP §1.20) covers queue read paths; WF-115..WF-120 (minted in this spec) cover module-local admin workflows; BR-52..BR-59 (minted in this spec, registered in `br-registry.json`) cover per-endpoint business-rule constraints.

**Handler mapping:** 13 handlers under `services/api-ts/src/handlers/email/`:
- Template CRUD (5): `listEmailTemplates`, `getEmailTemplate`, `createEmailTemplate`, `updateEmailTemplate`, `testEmailTemplate` — anchored to WF-115, BR-58.
- Queue management (4): `listEmailQueueItems`, `getEmailQueueItem`, `cancelEmailQueueItem`, `retryEmailQueueItem` — anchored to WF-110, WF-119, WF-120, BR-54, BR-59.
- Suppression management (1): `listEmailSuppressions` — anchored to WF-118.
- Unsubscribe endpoints (3): `unsubscribeEmail`, `unsubscribeEmailGet`, `unsubscribeEmailPost` — anchored to WF-117 (bounce/unsubscribe handling), BR-55, BR-56.

**TypeSpec:** `specs/api/src/modules/email.tsp` — COMPLETE (all 12 operations defined across EmailTemplateManagement, EmailQueueManagement, EmailSuppressionManagement, and EmailUnsubscribeEndpoints interfaces)

## 9. Domain Events

| Event Name | Trigger | Payload | Consumers |
|---|---|---|---|
| EmailSent | Queue item delivered | queueItemId, recipientEmail, templateId | — (logging) |
| EmailFailed | Max retries exceeded | queueItemId, recipientEmail, lastError | M07 (alert admin) |
| EmailBounced | Hard bounce received | email, reason | Suppression list (auto-add) |
| EmailComplaint | Complaint received | email, reason | Suppression list (auto-add) |

## 10. Dependencies

| Module | Why Needed |
|--------|------------|
| person (M02) | Recipient identity for personalization |
| Postmark (external) | Transactional email provider |
| SMTP (external) | Default email provider |
| OneSignal (external) | Multi-channel provider option |

## 11. AI Instructions

When implementing this module:
1. **Schema location:** `services/api-ts/src/handlers/email/repos/email.schema.ts` (templates + queue) and `suppression.schema.ts`.
2. **TypeSpec:** `specs/api/src/modules/email.tsp` — fully defined with 3 interfaces (Template, Queue, Suppression management).
3. **Handlebars rendering:** Templates use Handlebars syntax. Variables are validated against type definitions before enqueue.
4. **Queue processing:** Background job picks pending items, renders template, sends via configured provider. Retry with exponential backoff.
5. **Suppression check:** Always check suppression list before sending. Transactional emails may override marketing suppressions per M22-R6.
6. **Multi-provider:** Provider selection per queue item. Default to SMTP, use Postmark for transactional, OneSignal for multi-channel.
7. **Admin-only:** All email management endpoints require admin role. No member-facing UI.
8. **12 handlers** already implemented — template CRUD, queue management, suppression management, direct send.

## 12. Section Completeness

| Section | Status |
|---------|--------|
| 1. Module Overview | COMPLETE |
| 2. Domain Terms | COMPLETE |
| 3. Workflows | COMPLETE (7 WFs: WF-110 + WF-115..WF-120) |
| 4. Business Rules | COMPLETE (8 rules: M22-R1..R8 = BR-52..BR-59) |
| 5. Permissions | COMPLETE |
| 6. Data Requirements | COMPLETE (3 entities) |
| 7. State Transitions | COMPLETE (2 state machines) |
| 8. API Expectations | COMPLETE (12 endpoints, all anchored to WF/BR, TypeSpec COMPLETE) |
| 9. Domain Events | COMPLETE |
| 10. Dependencies | COMPLETE |
| 11. AI Instructions | COMPLETE |

## 13. Revision History

| Version | Date | Author | Summary |
|---------|------|--------|---------|
| 1.0 | 2026-05-29 | Claude | Initial spec from existing codebase (Wave 8 coverage) |
| 1.1 | 2026-06-02 | Claude | Add spec-ID anchors to satisfy TR-P1-003: mint BR-52..BR-59 (alias M22-R1..R8) and WF-115..WF-120; reuse WF-110 (cross-cutting); anchor 12/12 endpoints and 13 handlers in §3 + §8 |
