# Architecture Research

**Domain:** Healthcare Association Management System — v1.2.0 Pilot Launch integrations
**Researched:** 2026-05-13
**Confidence:** HIGH (all findings from direct codebase inspection)

## Standard Architecture

### System Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                     Three-App Frontend Layer                        │
│  ┌─────────────┐  ┌──────────────────┐  ┌────────────────────┐    │
│  │  apps/      │  │  apps/memberry   │  │  apps/admin        │    │
│  │  account    │  │  (product app)   │  │  (ops dashboard)   │    │
│  │  :3002      │  │  :3004           │  │  :3003             │    │
│  └──────┬──────┘  └────────┬─────────┘  └─────────┬──────────┘    │
│         │                  │                       │               │
│         └──────────────────┴───────────────────────┘               │
│                            │  /api/* (Vite proxy strips prefix)     │
├────────────────────────────┼───────────────────────────────────────┤
│              services/api-ts (Hono, :7213)                         │
│  ┌──────────────────────────────────────────────────────────┐      │
│  │  Auth middleware (Better-Auth)  +  RBAC middleware        │      │
│  │  Audit middleware (auto-capture writes)                   │      │
│  └───────────┬──────────────────────────────────────────────┘      │
│              │                                                       │
│  ┌───────────▼──────────────────────────────────────────────┐      │
│  │  Router → Validators (Zod, generated) → Handler stubs    │      │
│  │    → Handler business logic → Repository                 │      │
│  └───────────┬──────────────────────────────────────────────┘      │
├──────────────┼─────────────────────────────────────────────────────┤
│              │             Data Layer                                │
│  ┌───────────▼──────────────┐  ┌───────────┐  ┌───────────────┐   │
│  │  PostgreSQL (Drizzle ORM)│  │ S3/MinIO  │  │ SMTP/Postmark │   │
│  │  22 handler schema sets  │  │ (storage) │  │ (email queue) │   │
│  └──────────────────────────┘  └───────────┘  └───────────────┘   │
└────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical Implementation |
|-----------|----------------|------------------------|
| person module | Central PII hub, account deletion lifecycle, data export | `handlers/person/`, Person schema with deletion timestamps |
| association:member | Membership lifecycle, dues invoices, chapter affiliations, credits | 157 handlers, multiple repos under `repos/` |
| association:operations | Analytics rollups, training schema (shared) | `repos/training.schema.ts` is canonical training schema |
| dues module (standalone) | DuesPayment ledger for cash/OTC payments | Separate from association:member dues invoices |
| training module | Training events, enrollment, credit-bearing CPD | Re-uses `association:operations/repos/training.schema.ts` |
| email module | Template store + async queue + retry processor | `emailTemplates`, `emailQueue` tables, job processor |
| audit module | Append-only compliance log | Auto-captured by middleware; manual `auditAction()` helper |

## v1.2.0 Feature Integration Map

### 1. PII Anonymization (Account Deletion)

**Status:** Schema and handler skeleton exists. Two gaps remain.

**Existing:**
- `person.schema.ts` has `deletionRequestedAt`, `deletionScheduledAt`, `deletionCompletedAt`
- `requestAccountDeletion.ts`, `executeAccountDeletion.ts`, `cancelAccountDeletion.ts` handlers exist
- `executeAccountDeletion` nulls all PII fields in-place, sets `deletionCompletedAt`

**What's missing / needs v1.2.0 work:**
- Dues payment records (`dues-payments.schema.ts` in the standalone dues module and `duesInvoices` in `association:member`) reference `personId` as a bare `varchar` — no FK constraint, which is correct for 7-yr retention. But there is no automated job to trigger `executeAccountDeletion` after the 30-day grace window. A Bun cron job scanning `deletionScheduledAt <= NOW()` is needed.
- `exportPersonData.ts` already collects profile, memberships, payments, credits, notifications. Training enrollments are NOT yet included. Add a fetch from `trainingEnrollments` table and certificates.

**Integration points:**
- `person module` owns the deletion lifecycle
- All financial tables retain the `personId` FK value; the person row itself is anonymized (not deleted), so FK integrity is preserved at zero cost
- Financial records in both `duesPayments` (standalone dues) and `duesInvoices` (association:member) survive anonymization untouched

**Build order note:** No new tables needed. Requires a scheduled job (cron) and an incremental update to `exportPersonData.ts`.

---

### 2. Data Export

**Status:** Handler exists (`GET /persons/me/export`), partially complete.

**Existing:** `exportPersonData.ts` aggregates profile, memberships, payments, credits, notifications via dynamic imports.

**Gaps:**
- Missing: training enrollments (`trainingEnrollments` table in `association:operations/repos/training.schema.ts`)
- Missing: certificates (query `certificates` module handlers/repos)
- Missing: dues invoices from `association:member` (it collects from the standalone `dues-payments.schema` but not the `duesInvoices` invoice table)

**Integration points:**
- `exportPersonData.ts` uses dynamic imports — add two more `try/catch` blocks following the existing pattern
- No new endpoints needed; extend the single handler

---

### 3. Payment Flow (markDuesInvoicePaid)

**Status:** Handler exists and is well-implemented.

**Existing:**
- `markDuesInvoicePaid.ts` in `association:member` handles `POST /association/member/dues-invoices/{invoiceId}/mark-paid`
- Uses a DB transaction: marks invoice paid + calls `membershipLifecycle.extendMembershipExpiry()`
- Refs: `DuesInvoiceRepository` in `association:member/repos/dues.repo.ts`
- Audit via `auditAction()` helper

**Auth bypass gap (critical, v1.2.0 P0):**
- Handler checks session exists but does NOT verify the caller is an officer or admin for the invoice's organization. Any authenticated user can call it with any invoiceId. Fix: add RBAC middleware check (`requireOfficer` or `requireAdmin`) before handler executes.

**No new tables needed.** The fix is middleware/guard, not schema.

---

### 4. Officer Bulk Ops

**Status:** Bulk ops do NOT exist in `association:member`. The `generateDuesInvoicesForOrg.ts` is the only org-wide batch handler currently.

**What needs to be built:**
- `batchApproveMembershipApplications.ts` — iterate array of applicationIds, call approve logic transactionally
- `batchTerminateMemberships.ts` — array of membershipIds + reason
- `batchUpdateMemberStatus.ts` — generic status transition for officer daily ops

**Integration points:**
- All three fit inside `association:member` module (same router, same repo layer)
- Use existing `MembershipRepository.updateOneById()` inside a single `db.transaction()` wrapping the loop
- Must fire `auditAction()` per record or a single bulk audit entry
- Pattern to follow: `generateDuesInvoicesForOrg.ts` for org-scoped batch logic

**TypeSpec work:** Add three new operations to the association/member TypeSpec definitions, run `bun run build` + `bun run generate` to get stubs.

---

### 5. PRC Compliance / Accreditation Storage

**Status:** TypeSpec defines `AccreditedProvider` model in `specs/api/src/association/member/certification.tsp`. No DB table exists yet (only the TypeSpec model and generated validators have `accreditationType`).

**What needs to be built:**
- New schema: `accredited_providers` table (maps `organizationId`, provider name, `accreditationType`, `approvedActivities[]`, `status`, `approvedDate`, `expirationDate`, `maxCreditsPerActivity`)
- The existing `credit_entry` table already has `provider` varchar — sufficient for "who issued the credit" but not for validated provider registry lookup
- New handlers: CRUD for AccreditedProvider under `association:member` module (or a new `association:member/accreditation/` subfolder)

**Integration points:**
- `createCreditEntry` should optionally validate `provider` against `accredited_providers` if a registry is present
- `training` schema (`trainingEnrollments`) feeds `creditEntries` via `auto` type — the accreditation context (which PRC-approved provider ran the training) should be stored on the `training` record, not on individual credit entries
- Add `accreditedProviderId` nullable FK to `trainings` table

**Migration path:** New table + nullable FK column on `trainings`. No breaking changes.

---

### 6. Cross-Org Transfers

**Status:** Intra-org chapter-to-chapter transfer is fully implemented. Cross-org (different organizationId) transfer is NOT.

**Existing:**
- `chapterAffiliations` table has `organizationId`
- `affiliationTransfers` table has `organizationId`, `fromChapterId`, `toChapterId` — all within same org
- Transfer workflow: `createAffiliationTransfer` → `approveTransferBySource` → `approveTransferByTarget` → `completeAffiliationTransfer`

**What cross-org transfer requires:**
- The current schema assumes single-org scope. True cross-org transfer (member moving from Org A to Org B) requires either:
  - **Option A (simpler):** "departure" from Org A (`terminateMembership` + `updateChapterAffiliation` to `withdrawn`) + fresh membership application in Org B. No schema changes. Uses existing handlers.
  - **Option B (fuller audit trail):** A new `cross_org_transfer` table with `sourceOrgId`, `targetOrgId`, bi-org approval workflow, and training credit portability flag.

**Recommendation for v1.2.0:** Option A. Departure + re-application covers the pilot use case without new schema. Cross-org credit portability (training credits from Org A count toward Org B's CPD requirement) is a separate concern: add a `sourceOrganizationId` nullable column to `credit_entry` to record where a manually-entered credit originated.

**Integration points:**
- Uses existing `terminateMembership`, `createAffiliationTransfer` for intra-chapter moves
- For inter-org: `terminateMembership` (Org A) + `createMembershipApplication` (Org B)
- Credit portability: extend `credit_entry` schema with nullable `sourceOrganizationId`

---

### 7. Deceased / Departure Handling

**Status:** `terminateMembership.ts` exists. Reason codes are free-text `terminationReason` varchar.

**What's missing:**
- No structured departure reason enum (`deceased`, `resigned`, `expelled`, `retired`, `transferred`)
- No `isDeceased` flag on the person record (needed to block login attempts and exclude from communications)
- No suppression logic in email/notification pipelines for deceased members

**Recommended approach:**
- Add `terminationReasonCode` pgEnum to `membership` table (alongside existing `terminationReason` text for notes)
- Add `isDeceased boolean default false` to `persons` table
- Email/notification handlers should check `person.isDeceased` before enqueue

**Integration points:**
- `terminateMembership.ts`: extend body validator to accept `terminationReasonCode`
- `person.schema.ts`: add `isDeceased` column
- Email send path: add guard in `email/jobs/processor.ts` — fetch person record before send, skip if `isDeceased`
- Notification send path: same guard in `notifs` handler

**Migration:** Two `ALTER TABLE` migrations (addColumn on both tables). Non-breaking.

---

### 8. Email Guards / Rate Limits

**Status:** The email queue has retry logic (exponential backoff: 5min, 30min, 2hr, then dead-letter after 3 attempts). There is NO per-recipient rate limiting or per-org daily send cap.

**What exists:**
- `email_queue` table: `attempts`, `nextRetryAt`, `lastAttemptAt`, `cancelledAt`
- `emailQueue` table does NOT have a per-recipient daily count
- `processor.ts` job: processes queue items, handles retries

**What needs to be built:**
- Rate guard table or counter: `email_rate_limit` (or use Redis/Valkey if available; otherwise PostgreSQL counter is fine for pilot scale)
- Simplest approach for v1.2.0: add a `checkEmailRateLimit(recipientEmail, orgId)` utility called by the processor before send. Query count of `sentAt IS NOT NULL AND sentAt > NOW() - INTERVAL '24 hours'` for the recipient. Configurable threshold (env var `EMAIL_DAILY_LIMIT_PER_RECIPIENT`, default 10).
- No new table required if using the existing `email_queue` table as the counter source.

**Integration points:**
- `email/jobs/processor.ts`: add guard call before each send attempt
- `email/repos/queue.repo.ts`: add `countSentToday(recipientEmail, orgId)` query method
- Config: add `EMAIL_DAILY_LIMIT_PER_RECIPIENT` to `core/config.ts`

---

## Recommended Project Structure Changes

No structural changes to monorepo layout needed. All v1.2.0 features fit within existing module boundaries:

```
services/api-ts/src/handlers/
├── person/
│   ├── executeAccountDeletion.ts       # exists — add cron trigger
│   └── exportPersonData.ts             # exists — add training/cert/invoice
├── association:member/
│   ├── batchApproveMembershipApplications.ts   # NEW
│   ├── batchTerminateMemberships.ts            # NEW
│   ├── markDuesInvoicePaid.ts          # exists — add RBAC guard
│   ├── repos/
│   │   ├── credits.schema.ts           # exists — add sourceOrganizationId
│   │   └── accredited-providers.schema.ts      # NEW
│   └── [accreditation handlers]        # NEW (CRUD for AccreditedProvider)
├── training/
│   └── repos/ (uses association:operations schema)
│       └── training.schema.ts          # exists — add accreditedProviderId FK
└── email/
    ├── jobs/
    │   └── processor.ts                # exists — add rate guard + deceased check
    └── repos/
        └── queue.repo.ts               # exists — add countSentToday()
```

## Architectural Patterns

### Pattern 1: Anonymize-in-Place (not hard delete)

**What:** Person record kept with PII scrubbed to NULL/placeholder. All FK references remain valid.
**When to use:** Any time financial or compliance records must survive 7 years (DPA 2012 / PRC).
**Trade-offs:** Slightly larger tables; avoids FK cascade headaches; audit log remains intact.

**Existing implementation:**
```typescript
// executeAccountDeletion.ts
await repo.updateOneById(personId, {
  firstName: 'Deleted', lastName: 'User',
  contactInfo: null, primaryAddress: null,
  licenseNumber: null, prcId: null,
  deletionCompletedAt: now,
});
```

### Pattern 2: Transaction-Wrapped Lifecycle Mutations

**What:** Multi-table updates (e.g., mark invoice paid + extend membership expiry) wrapped in a single Drizzle transaction.
**When to use:** Any state change that must be atomic across two or more tables.
**Trade-offs:** Correct for correctness; watch for long-running transactions in bulk ops.

**Existing implementation:**
```typescript
// markDuesInvoicePaid.ts
await db.transaction(async (tx) => {
  await txInvoiceRepo.markPaid(invoiceId, paymentId, new Date());
  await membershipLifecycle.extendMembershipExpiry(tx, { membershipId, orgId });
});
```

### Pattern 3: Soft-Delete via Status Enum

**What:** Membership lifecycle uses a `membershipStatusEnum` with `terminated` state plus `terminatedAt` timestamp. No row deletion.
**When to use:** Any entity with compliance/audit significance.
**Trade-offs:** Queries must filter by status; indexes on `(organizationId, status)` exist and keep this fast.

### Pattern 4: Dynamic Import Aggregation for Export

**What:** `exportPersonData.ts` aggregates cross-module data via `try/catch` dynamic imports to avoid circular dependencies.
**When to use:** Admin-scope reads that span module boundaries.
**Trade-offs:** Less type-safe than direct imports; the `try/catch` ensures a failure in one module doesn't fail the whole export.

## Data Flow

### Dues Payment → Membership Activation

```
Officer: POST /association/member/dues-invoices/{id}/mark-paid
  ↓
markDuesInvoicePaid handler
  ↓ (transaction)
DuesInvoiceRepository.markPaid() → duesInvoices.status = 'paid', paidAt = now
  +
membershipLifecycle.extendMembershipExpiry() → memberships.duesExpiryDate += billing cycle
  ↓
auditAction() → audit_log row
  ↓
Response 200 with updated invoice
```

### Account Deletion Flow

```
Member: POST /persons/me/request-deletion
  ↓
requestAccountDeletion → sets deletionRequestedAt, deletionScheduledAt = now+30d
  ↓
[30-day grace period]
  ↓
Cron job: scan persons WHERE deletionScheduledAt <= NOW() AND deletionCompletedAt IS NULL
  ↓
executeAccountDeletion → nulls PII, sets deletionCompletedAt
  ↓
Audit log: data-deletion / anonymize
```
Note: The cron trigger is currently MISSING. A Bun scheduled job is needed.

### Cross-Chapter Transfer Flow

```
Officer: POST /association/member/affiliation-transfers
  ↓
createAffiliationTransfer → affiliationTransfers.status = 'requested'
  ↓
Source chapter officer: POST .../approve-by-source → status = 'pendingTargetApproval'
  ↓
Target chapter officer: POST .../approve-by-target → status = 'approved'
  ↓
completeAffiliationTransfer → chapterAffiliations old row.status = 'transferred'
                            + new chapterAffiliations row.status = 'active'
```

## Integration Points

### New vs. Modified by Feature

| Feature | New Components | Modified Components |
|---------|---------------|---------------------|
| PII anonymization cron | `services/api-ts/src/jobs/deletion-sweep.ts` (new cron) | None |
| Data export (complete) | None | `exportPersonData.ts` (+3 data sources) |
| Payment flow auth fix | None | `markDuesInvoicePaid.ts` (+RBAC guard middleware) |
| Officer bulk ops | 2-3 new handler files in `association:member/` + TypeSpec ops | `association:member` router registration |
| PRC accreditation | `accredited-providers.schema.ts`, CRUD handlers, nullable FK on `trainings` | `training.schema.ts`, `createCreditEntry.ts` |
| Cross-org transfers | None (Option A) OR `cross_org_transfer` table (Option B) | `credit_entry` schema (+`sourceOrganizationId`) |
| Deceased/departure | New pgEnum `terminationReasonCode`, `isDeceased` column | `terminateMembership.ts`, `person.schema.ts`, `processor.ts` |
| Email guards | None (use existing queue table for counting) | `queue.repo.ts` (+`countSentToday`), `processor.ts` (+guard), `config.ts` |

### Internal Module Boundaries

| Boundary | Communication Pattern | Notes |
|----------|-----------------------|-------|
| person ↔ association:member | Direct repo import across handler dirs | `exportPersonData.ts` imports membership.schema dynamically |
| training ↔ association:member | Shared schema — training.schema owned by association:operations, imported by training handlers | Both `training/repos/training.repo.ts` and `association:operations/repos/training.repo.ts` import same schema |
| dues (standalone) ↔ association:member dues | TWO separate dues subsystems | `dues/repos/dues-payments.schema.ts` (cash ledger) vs `association:member/repos/dues.schema.ts` (invoices). Export must pull from both. |
| email ↔ person | No direct link today | Add deceased guard: processor fetches person before send |

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k users (pilot) | Current monolith fine; PostgreSQL counts for email rate limiting is sufficient |
| 1k-10k users | Bulk ops need batching with cursor pagination (not array of all IDs); consider Valkey/Redis for rate limit counters |
| 10k+ users | Separate email processor to worker process; read replicas for reporting queries |

## Anti-Patterns

### Anti-Pattern 1: Hard-Deleting Financial Records

**What people do:** Call `DELETE FROM dues_invoice WHERE personId = X` when processing account deletion.
**Why it's wrong:** PH DPA 2012 + BIR regulations require 7-year financial record retention. Also breaks audit trail.
**Do this instead:** Anonymize the person row in-place. Leave all financial records intact. The `personId` FK still resolves to the anonymized "Deleted User" row.

### Anti-Pattern 2: Separate Dues Models for the Same Invoice

**What people do:** Add new invoice handling code to `services/api-ts/src/handlers/dues/` (the standalone module).
**Why it's wrong:** Invoice lifecycle (generate → send → paid → overdue) lives in `association:member/repos/dues.schema.ts`. The standalone `dues/` module is a cash-payment ledger with a separate `duesPayments` table. Adding invoice logic there creates a third dues subsystem.
**Do this instead:** All invoice-related work goes in `association:member`. Cash payment recording goes in `dues/`.

### Anti-Pattern 3: Officer Bulk Ops Without Pagination

**What people do:** Accept an array of all membershipIds in request body.
**Why it's wrong:** 500+ members → payload too large, DB transaction too long.
**Do this instead:** Accept max 50 IDs per request body. Caller batches client-side. Or implement cursor-based background job.

### Anti-Pattern 4: Crossing Module Boundaries via Direct DB Queries in Handlers

**What people do:** Import `duesInvoices` schema directly into person handler to fetch financial data.
**Why it's wrong:** Creates invisible coupling; bypasses repository layer (no logging, no test stubbing).
**Do this instead:** Use dynamic imports with try/catch as `exportPersonData.ts` does, or create a cross-module service function in `utils/`.

## Sources

- Direct inspection of `services/api-ts/src/handlers/` (all 22 handler directories)
- `specs/api/src/association/member/certification.tsp` — AccreditedProvider TypeSpec model
- `services/api-ts/src/handlers/person/executeAccountDeletion.ts` — PII anonymization implementation
- `services/api-ts/src/handlers/person/exportPersonData.ts` — data export aggregation pattern
- `services/api-ts/src/handlers/association:member/markDuesInvoicePaid.ts` — payment flow
- `services/api-ts/src/handlers/association:member/repos/dues.schema.ts` — invoice schema
- `services/api-ts/src/handlers/dues/repos/dues-payments.schema.ts` — cash payment schema
- `services/api-ts/src/handlers/association:member/repos/credits.schema.ts` — CPD credit entries
- `services/api-ts/src/handlers/email/repos/email.schema.ts` — email queue schema
- `services/api-ts/src/handlers/association:member/repos/chapters.schema.ts` — transfer workflow schema

---
*Architecture research for: Memberry v1.2.0 Pilot Launch integrations*
*Researched: 2026-05-13*
