# Stack Research

**Domain:** Healthcare AMS — v1.2.0 Pilot Launch features
**Researched:** 2026-05-13
**Confidence:** HIGH (most capabilities already exist in codebase; additions are minimal)

---

## What NOT to Add

The existing stack already covers most v1.2.0 needs. The correct answer for most features is **use what's there**, not add a library.

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `hono-rate-limiter` npm package | Already have hand-rolled in-memory sliding window at `src/middleware/rate-limit.ts` that skips test/dev and handles IP + write/read tiers | Extend existing `createRateLimiter()` with per-route override config or a new `createEmailRateLimiter()` using the same pattern |
| `postgresql-anonymizer` extension | Railway-hosted PostgreSQL — extensions require approval + superuser. Not needed: anonymization is 10 lines of Drizzle `update()` setting fields to null/constant | Application-level anonymization already implemented in `executeAccountDeletion.ts` |
| `archiver` / `jszip` for data export | `exportMyData` already returns JSON. A zip file is optional UX polish, not a PH DPA compliance requirement. GDPR/DPA requires "machine-readable format" — JSON satisfies this | Keep current `ctx.json()` response; add `Content-Disposition` header for download if needed |
| `pg-anonymizer` CLI tool | One-off tooling. Anonymization happens at account deletion time, not in bulk. Already handled | `executeAccountDeletion.ts` pattern |
| Separate job queue for deletion | `pg-boss` is already installed (`^10.3.2`) | Schedule `executeAccountDeletion` via pg-boss after grace period |
| `flat-file` CSV export libraries | PH DPA does not mandate CSV — JSON is compliant and already implemented | Extend `exportMyData.ts` to include training records, CPD entries, affiliations |

---

## Recommended Stack

### Core Technologies (unchanged)

| Technology | Version | Purpose | Notes |
|------------|---------|---------|-------|
| Bun | 1.2.21 | Runtime + test runner | Locked. Do not change. |
| Hono | ^4.0.0 | API framework | Already installed |
| Drizzle ORM | ^0.44.6 | Database ORM | Already installed |
| PostgreSQL | managed (Railway) | Persistence | Already wired |
| pg-boss | ^10.3.2 | Background jobs | Already installed — use for grace-period deletion scheduler |

### Supporting Libraries (additions needed for v1.2.0)

None are strictly required. The features map to existing primitives. However, two optional enhancements are worth considering:

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| `archiver` or `fflate` | `fflate@^0.8` | ZIP archive for data export | Only if pilot users request downloadable archive instead of raw JSON. `fflate` is 7KB, Bun-native, no native bindings | LOW priority — add in v1.3 if requested |
| `@hono-rate-limiter/redis` | `^0.5` | Distributed rate limiting across Railway instances | Only needed if Railway scales to 2+ API replicas. Current in-memory limiter does not sync across processes | Defer until horizontal scaling needed |

### Development Tools (unchanged)

| Tool | Purpose | Notes |
|------|---------|-------|
| drizzle-kit | Migration generation | `^0.31.0` already installed |
| TypeSpec | API contract generation | Already wired |

---

## Feature-to-Stack Mapping

### 1. Account Deletion + PII Anonymization

**Stack: Pure Drizzle + pg-boss. Nothing to add.**

Already implemented:
- `executeAccountDeletion.ts` — anonymizes 12 PII fields via `repo.updateOneById()`, sets them to null/constant
- `requestAccountDeletion.ts` / `cancelAccountDeletion.ts` — grace period flow
- `person.schema.ts` — `deletionRequestedAt`, `deletionScheduledAt`, `deletionCompletedAt` columns exist

Gap: Grace-period scheduler. Implement as a pg-boss recurring job that queries `persons` where `deletionScheduledAt < now() AND deletionCompletedAt IS NULL` and calls `executeAccountDeletion` for each.

**Financial record retention (7yr):** Already handled. `executeAccountDeletion.ts` keeps the person row (anonymized) so `dues`/`payment` FK references resolve. No schema change needed.

**Anonymization strategy (already in codebase):**
```typescript
// Fields set to null: contactInfo, primaryAddress, avatar, licenseNumber,
//                     specialization, prcId, dateOfBirth, languagesSpoken, middleName, gender
// Fields set to constant: firstName = 'Deleted', lastName = 'User'
// Fields retained: id, organizationId, deletionCompletedAt (audit trail)
```

### 2. Data Export (GDPR/PH DPA style)

**Stack: Extend existing `exportMyData.ts`. Nothing to add.**

PH DPA 2012 (RA 10173) requires: "structured, commonly used, machine-readable format." JSON satisfies this. No mandate for ZIP or CSV.

Current `exportMyData.ts` returns: `person`, `memberships`, `creditEntries`. Needs expansion to include:
- Training enrollments
- Professional licenses
- Chapter affiliations
- Dues invoices (omit payment card data)
- Documents owned

Implementation: Add parallel `Promise.all()` fetches in same handler. Add `Content-Disposition: attachment; filename="my-data.json"` header for browser download.

No new libraries. No new schema.

### 3. Payment Recording Flow

**Stack: Existing dues handlers. Nothing to add.**

`recordManualPayment.ts`, `confirmPaymentProof.ts`, `submitPaymentProof.ts`, `markDuesInvoicePaid.ts` already exist. The v1.2.0 gap is the **payment flow UI** in `apps/memberry`, not a backend stack gap.

### 4. Officer Bulk Operations

**Stack: Drizzle batch queries. Nothing to add.**

Drizzle supports multi-row `insert()` and `update().where(inArray(...))` natively. No bulk-operation library needed.

Pattern: Add `bulkApproveMembershipApplications.ts` handler using:
```typescript
await db.update(membershipApplications)
  .set({ status: 'approved', reviewedAt: new Date(), reviewedBy: officerId })
  .where(inArray(membershipApplications.id, applicationIds))
```

No new schema. No new packages.

### 5. PRC CPD Credit Compliance Tracking

**Stack: Existing `credit_entry` schema + `professional_license` schema. Schema additions needed, no new packages.**

PRC CPD requirements for dentistry (RA 10912): 45 units per 3-year renewal cycle.

Existing `credit_entry` table already has: `personId`, `organizationId`, `activityName`, `creditAmount`, `cycleStart`, `cycleEnd`, `activityDate`.

Gaps that need **schema additions** (Drizzle migration only):

```typescript
// On credit_entry table — add:
cpdCategory: varchar('cpd_category', { length: 100 })  // 'scientific', 'professional_practice', etc.
prcApprovalCode: varchar('prc_approval_code', { length: 100 })  // PRC-issued program approval code
providerAccreditationNumber: varchar('provider_accreditation_no', { length: 100 })
isVerified: boolean('is_verified').default(false)
verifiedAt: timestamp('verified_at')
verifiedBy: uuid('verified_by')  // officer who verified

// On professional_license table — no changes needed:
// licenseNumber, expirationDate, issuingAuthority already exist
```

PRC CPDAS is a web portal for manual submission — no public API. Memberry tracks the data locally; members submit to CPDAS manually. No API integration needed.

Confidence: MEDIUM — PRC CPD category definitions sourced from RA 10912 IRR. PRC has no public data API (verified via prc.gov.ph inspection).

### 6. Cross-Org Training Record Transfers

**Stack: Existing affiliation transfer pattern. Possibly schema addition.**

`createAffiliationTransfer.ts`, `approveTransferBySource.ts`, `approveTransferByTarget.ts`, `completeAffiliationTransfer.ts` already exist for membership transfers.

Training credit transfer is the same pattern: source org officer approves release, target org officer accepts. Use same two-step approval flow.

Gap: Need to verify if `credit_entry` has an `organizationId` FK already (it does — confirmed in `credits.schema.ts`). Transfer = update `organizationId` on accepted `credit_entry` records.

No new packages. Possibly one migration to add a `training_record_transfer` table modeled on the affiliation transfer pattern.

### 7. Member Departure + Deceased Handling

**Stack: Drizzle enum extension + migration. Nothing to add.**

`membership.schema.ts` has `terminationReason` varchar. Currently no enum for reason type.

Add `terminationReasonEnum`:
```typescript
export const terminationReasonEnum = pgEnum('termination_reason_type', [
  'voluntary_resignation',
  'non_payment',
  'deceased',
  'expelled',
  'relocated',
  'other',
])
```

Add `terminationReasonType` column to `membership` table. Add `deceasedAt` to `person` schema for deceased handling.

No new packages.

### 8. Email/Notification Rate Limiting and Guards

**Stack: Extend existing `rate-limit.ts` middleware + pg-boss job deduplication. Nothing to add.**

Existing `src/middleware/rate-limit.ts` is in-memory sliding window, IP-keyed. For email guards, need **send-side rate limiting** (per-person, per-template) rather than HTTP-level limiting.

Approach: Add a `lastEmailSentAt` + `emailSendCount` tracking on the `email_queue` table (already exists in `email/repos/`) or use a simple guard in the email dispatch job:

```typescript
// Guard: check last N emails to same recipient in window before enqueueing
const recentCount = await db.select({ count: count() })
  .from(emailQueue)
  .where(and(
    eq(emailQueue.toAddress, recipient),
    gte(emailQueue.createdAt, subHours(new Date(), 24))
  ))
// Throw if count >= EMAIL_DAILY_LIMIT (configurable via env)
```

No `hono-rate-limiter` package needed. No Redis needed. This is business-logic throttling, not HTTP-level rate limiting.

---

## What Actually Needs Installing

**Nothing new for v1.2.0.** Every feature maps to existing stack capabilities.

| Feature | New Package? | Actual Need |
|---------|-------------|-------------|
| Account deletion | No | pg-boss job (already installed) |
| Data export | No | Extend existing handler |
| Payment recording | No | Existing handlers, UI work |
| Officer bulk ops | No | Drizzle `inArray()` |
| PRC CPD tracking | No | Schema migration only |
| Training transfers | No | Pattern exists, new table |
| Departure/deceased | No | Schema migration only |
| Email rate limiting | No | In-handler guard query |

---

## Schema Migrations Required

These are Drizzle `db:generate` migrations, not new packages:

1. `credit_entry` — add `cpdCategory`, `prcApprovalCode`, `providerAccreditationNumber`, `isVerified`, `verifiedAt`, `verifiedBy`
2. `membership` — add `terminationReasonType` enum + column
3. `person` — add `deceasedAt` timestamp
4. New table: `training_record_transfer` (modeled on affiliation transfer pattern)
5. New table: `membership_bulk_action` (optional audit log for officer bulk operations)

---

## PH DPA 2012 Compliance Notes

**Confidence: MEDIUM** (based on RA 10173 text + NPC implementing rules, no NPC circular mandates specific format)

Key requirements satisfied by existing implementation:
- Right to access: `exportMyData` endpoint
- Right to erasure: `requestAccountDeletion` + `executeAccountDeletion` flow
- Data minimization: Anonymization nullifies all non-required PII
- Retention: 7-year financial record retention via anonymized person rows
- Breach notification: Covered by audit middleware + Pino logging (existing)

No format mandate from NPC beyond "machine-readable." JSON satisfies this. ZIP/CSV is optional UX improvement.

---

## Sources

- `services/api-ts/src/middleware/rate-limit.ts` — existing rate limiter implementation
- `services/api-ts/src/handlers/person/executeAccountDeletion.ts` — existing anonymization
- `services/api-ts/src/handlers/person/exportMyData.ts` — existing data export
- `services/api-ts/src/handlers/person/repos/person.schema.ts` — deletion columns
- `services/api-ts/src/handlers/association:member/repos/credits.schema.ts` — CPD credit schema
- `services/api-ts/src/handlers/association:member/repos/credentials.schema.ts` — PRC license schema
- `services/api-ts/package.json` — confirms pg-boss, drizzle-orm, date-fns versions
- [RA 10173 — Philippines Data Privacy Act of 2012](https://privacy.gov.ph/data-privacy-act/) — compliance reference
- [rhinobase/hono-rate-limiter](https://github.com/rhinobase/hono-rate-limiter) — confirmed NOT needed (in-memory pattern sufficient)
- [Drizzle ORM soft deletes discussion](https://github.com/drizzle-team/drizzle-orm/discussions/4031) — confirmed Drizzle has no built-in soft delete, application-level pattern is idiomatic

---

*Stack research for: Memberry v1.2.0 Pilot Launch*
*Researched: 2026-05-13*
