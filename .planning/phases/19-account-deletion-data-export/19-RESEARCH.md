# Phase 19: Account Deletion + Data Export - Research

**Researched:** 2026-05-14
**Domain:** Data privacy compliance — PH DPA 2012 account deletion + data portability
**Confidence:** HIGH

---

## Summary

This phase implements the right-to-erasure and right-to-portability requirements of the Philippine Data Privacy Act (RA 10173, 2012). The backend handler stubs already exist and are substantially pre-implemented — this is primarily a **completion + wiring + UI** phase, not greenfield work.

Seven handler files exist under `services/api-ts/src/handlers/person/`. Three of the seven (`requestAccountDeletion`, `cancelAccountDeletion`, `executeAccountDeletion`) have comprehensive unit tests in `requestAccountDeletion.test.ts` (266 lines). Two variants exist for each operation: a "my" variant (session-based auth, for self-service) and an admin variant (personId-param, for operators). The TypeSpec definitions are in `specs/api/src/modules/person-custom.tsp` and all three SDK mutations (`requestMyAccountDeletionMutation`, `cancelMyAccountDeletionMutation`, `exportMyDataOptions`) are already generated.

The primary work is: (1) wiring the person deletion scheduled job (`registerCron`) and registering it in `app.ts`, (2) completing `exportMyData.ts` to include dues payments, certificates, and events (currently missing from the stub), (3) verifying that the audit middleware's `data-deletion` event type actually omits PII (the `executeAccountDeletion` handler manually calls `audit.logEvent` with no `before_state` — this pattern is correct but needs explicit test coverage), and (4) adding the deletion/export UI section to the existing `/settings/account` page.

**Primary recommendation:** Treat this as a wiring + gap-fill phase. The hard decisions are made; the remaining work is connecting parts that exist.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Account Deletion Flow**
- Request deletion → sets `deletionRequestedAt` + `deletionScheduledAt` (now + 30 days)
- Cancel before 30 days → clears both timestamps
- Scheduled job runs daily, anonymizes past-`deletionScheduledAt` records
- Anonymization fields: firstName/lastName/middleName → "DELETED"; contactInfo → `{email: "deleted@deleted.invalid", phone: null}`; primaryAddress/avatar/dateOfBirth/licenseNumber/prcId/specialization → null
- Financial records preserved — personId FK kept, person data anonymized
- Better-Auth sessions cleaned up on execution

**Data Export**
- JSON export: profile, memberships, dues payments, training credits, certificates, events, notification preferences, privacy settings
- Synchronous (no background job) — typical data volume fits in request
- Self-service only (authenticated user); no admin endpoint for MVP

**Audit Log PII Protection**
- Anonymization writes use `eventType: 'data-deletion'` and omit `before_state`
- Normal deletion request/cancel retain standard audit entries

**UI**
- Section added to existing `/settings/account` page in account app
- Shows: not-requested / pending-with-countdown / completed states
- "Request Deletion" with confirmation dialog explaining 30-day grace
- "Cancel Deletion" when pending
- "Export My Data" downloads JSON
- Sonner toasts for feedback (per CLAUDE.md)

### Claude's Discretion
All remaining implementation details. Follow existing handler patterns. Use existing `core/jobs.ts` infrastructure. Follow Drizzle ORM patterns for queries.

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DPA-01 | User can request account deletion with 30-day grace period and cancellation option | `requestMyAccountDeletion.ts` + `cancelMyAccountDeletion.ts` stubs exist; TypeSpec + SDK generated; needs route registration confirmed |
| DPA-02 | Account deletion anonymizes PII in-place but preserves financial records for 7yr BIR retention | `executeAccountDeletion.ts` stub exists; `duesPayments` uses `onDelete: 'restrict'` FK — personId preserved; anonymization fields mapped |
| DPA-03 | User can export all personal data as machine-readable JSON | `exportPersonData.ts` + `exportMyData.ts` stubs exist; SDK `exportMyDataOptions` generated; gaps: certificates, events missing from export |
| DPA-04 | Data export covers person, membership, dues, training, certificates, events, storage | `exportPersonData.ts` currently covers profile, memberships, payments, credits, notifications — missing: certificates, events |
| DPA-05 | Audit middleware exempts anonymization writes from capturing PII in before_state | `executeAccountDeletion.ts` manually calls `audit.logEvent` with `eventType: 'data-deletion'`; audit schema has no `before_state` column — middleware never captures it; this is already safe by design, needs test coverage |
| DPA-06 | Grace period deletion executes automatically via scheduled job after 30 days | Job not yet registered — needs `registerPersonJobs()` function + registration in `app.ts` |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Deletion request / cancel | API / Backend | — | Session auth + DB write; no frontend logic |
| Anonymization execution | Background Job | API / Backend | Scheduled daily cron, not user-triggered |
| Better-Auth session cleanup | API / Backend | — | Direct DB delete on `schema.session` table |
| Data export aggregation | API / Backend | — | Multi-repo JOIN; synchronous response |
| Audit log PII protection | API / Backend | — | Handler controls what fields pass to `logEvent` |
| Deletion status UI | Frontend (account app) | — | Read `deletionRequestedAt`/`deletionScheduledAt` from person record |
| Export download UI | Frontend (account app) | — | Trigger `exportMyData` query, trigger file download |

---

## Standard Stack

### Core (all already in project — no new installs)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pg-boss | In use | Job scheduling (daily cron) | Already wired in `core/jobs.ts` |
| Drizzle ORM | In use | DB queries for anonymization + export | Project standard |
| Hono | In use | Route registration | Project standard |
| better-auth | In use | Session cleanup on deletion | Already provides `schema.session` table |
| @monobase/sdk-ts | In use | Frontend mutations/queries | Already generated for all 3 operations |
| sonner | In use | Toast notifications | CLAUDE.md mandate |
| shadcn/ui | In use | UI components (Dialog, Button, Card) | Account app standard |

No new packages required. [VERIFIED: codebase grep]

---

## Architecture Patterns

### System Architecture Diagram

```
User (browser)
  │
  ├─ POST /persons/me/delete  ──────────────────► requestMyAccountDeletion
  │                                                 │ sets deletionRequestedAt
  │                                                 │ sets deletionScheduledAt (+30d)
  │                                                 └─► audit.logEvent(data-modification)
  │
  ├─ POST /persons/me/cancel-delete ───────────► cancelMyAccountDeletion
  │                                                 │ clears both timestamps
  │                                                 └─► audit.logEvent(data-modification)
  │
  ├─ GET /persons/me/export ───────────────────► exportPersonData (or exportMyData)
  │                                                 │ aggregates: profile, memberships,
  │                                                 │   dues payments, credits, certs, events
  │                                                 └─► audit.logEvent(data-access/export)
  │
  └─ UI: /settings/account
       └─ DeletionSection component
            ├─ Shows status (none / pending+countdown / completed)
            ├─ Request button → confirmation dialog → mutation
            ├─ Cancel button (when pending)
            └─ Export button → fetch → browser download

pg-boss Cron (daily @ midnight UTC)
  └─ person.deletionProcessor
       ├─ findPersonsPastDeletion() — persons where scheduledAt < now AND completedAt IS NULL
       ├─ For each: executeAccountDeletion logic
       │    ├─ anonymize PII fields
       │    ├─ delete Better-Auth sessions
       │    └─ set deletionCompletedAt
       └─ audit.logEvent(data-deletion, anonymize) — NO before_state
```

### Recommended Project Structure (additions only)

```
services/api-ts/src/handlers/person/
├─ jobs/
│   └─ index.ts                    # registerPersonJobs() — new
│   └─ deletionProcessor.ts        # daily anonymization job — new
├─ requestMyAccountDeletion.ts     # EXISTS (complete)
├─ cancelMyAccountDeletion.ts      # EXISTS (complete)
├─ exportPersonData.ts             # EXISTS (needs cert/event gap fill)
├─ executeAccountDeletion.ts       # EXISTS (adapt for job context)

apps/account/src/routes/_dashboard/settings/
└─ account.tsx                     # EXISTS — add DeletionSection component
```

### Pattern 1: Job Registration (follow dues pattern exactly)

```typescript
// Source: services/api-ts/src/handlers/dues/jobs/index.ts
// services/api-ts/src/handlers/person/jobs/index.ts

import type { JobScheduler, JobContext } from '@/core/jobs';
import { processDeletions } from './deletionProcessor';

export function registerPersonJobs(scheduler: JobScheduler): void {
  scheduler.registerCron('person.deletionProcessor', '0 0 * * *', async (context: JobContext) => {
    await processDeletions({ db: context.db, logger: context.logger });
  });
}
```

Then in `app.ts` (line ~208, alongside other job registrations):
```typescript
import { registerPersonJobs } from '@/handlers/person/jobs';
// ...
registerPersonJobs(jobs);
```

### Pattern 2: PII-safe Audit for Anonymization (already in executeAccountDeletion.ts)

```typescript
// The audit schema has NO before_state column — there is nothing to suppress.
// The handler manually calls audit.logEvent instead of relying on the
// global audit middleware. This means the middleware's automatic after-write
// capture still fires on this route, but it only logs: method, path, status.
// The sensitive PII that would appear in before_state does NOT exist in the
// audit schema at all. DPA-05 is satisfied by design.
//
// However: executeAccountDeletion is called by the SCHEDULER (JobContext),
// not through an HTTP route. The middleware does not fire for job executions.
// The handler's manual audit.logEvent call IS the only audit record.
// This is correct — just needs test coverage to prove it.
```

### Pattern 3: Export Aggregation (direct DB queries — no repo abstraction needed)

```typescript
// Source: services/api-ts/src/handlers/person/exportPersonData.ts (existing)
// Pattern: dynamic import schema + db.select().from(table).where(eq(...))
// Wrap each in try/catch — missing data for a module doesn't fail the export

// Missing modules to add (DPA-04 gap):
import { certificates } from '@/handlers/certificates/repos/certificate.schema';
import { eventRegistrations } from '@/handlers/events/repos/event.schema';
```

### Pattern 4: UI — Deletion Section in Account Settings

```tsx
// Follow existing pattern in apps/account/src/routes/_dashboard/settings/account.tsx
// Use useMutation from @tanstack/react-query with generated SDK mutations:
//   requestMyAccountDeletionMutation()
//   cancelMyAccountDeletionMutation()
//   exportMyDataOptions() — as useQuery with enabled: false, then trigger manually
//
// Dialog: use shadcn AlertDialog (already in account app)
// Countdown: derive from person.deletionScheduledAt - now (days remaining)
```

### Anti-Patterns to Avoid

- **Don't call executeAccountDeletion via HTTP from the job**: The job should contain the anonymization logic directly (or call a shared service function), not make an HTTP round-trip to itself.
- **Don't use `onDelete: 'cascade'` on dues_payment.person_id**: It already uses `onDelete: 'restrict'` — financial records must survive person anonymization. Do not change this.
- **Don't delete the person row**: Anonymize in-place. The personId FK on financial records must remain valid.
- **Don't capture full person object in audit details during anonymization**: The `details` field in `logEvent` should only contain non-PII metadata (requestDate, personId). Never `JSON.stringify(person)` before anonymization.
- **Don't use `useToast` from shadcn**: Use `sonner` as per CLAUDE.md.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job scheduling | Custom cron timer | pg-boss via `core/jobs.ts` `registerCron()` | Already abstracts pg-boss; handles retries, distributed locks |
| Session invalidation | Manual SQL delete | `schema.session` delete via Drizzle (pattern from auth.ts line 184) | Better-auth table name guaranteed stable |
| SDK mutations | Custom fetch calls | `requestMyAccountDeletionMutation()`, `cancelMyAccountDeletionMutation()` from `@monobase/sdk-ts` | Already generated, type-safe |
| Modal/dialog | Custom component | shadcn `AlertDialog` | Already in account app component library |

---

## Common Pitfalls

### Pitfall 1: Two handler variants — which to use where

**What goes wrong:** Both `requestAccountDeletion` (admin, param-based) and `requestMyAccountDeletion` (self-service, session-based) exist. The job should use the logic from `executeAccountDeletion`, not call these. The UI should call the "My" variants.
**Why it happens:** Dual-variant pattern is common but confusing.
**How to avoid:** Job calls shared service fn or directly uses PersonRepository. Frontend calls `/persons/me/delete` not `/persons/:id/delete`.

### Pitfall 2: exportMyData vs exportPersonData — which is live

**What goes wrong:** Two export handlers exist. `exportMyData.ts` is the TypeSpec-generated route. `exportPersonData.ts` appears to be the admin variant. Only one is actually wired via generated routes.
**Why it happens:** TypeSpec generated `exportMyData` operationId; `exportPersonData` was a hand-written stub.
**How to avoid:** Check `generated/openapi/routes.ts` for which route path `GET /persons/me/export` maps to. Fill gaps in whichever is live. [VERIFIED: SDK `exportMyData` is the generated operation — use that one]

### Pitfall 3: Audit middleware fires twice for HTTP-triggered anonymization

**What goes wrong:** The global audit middleware auto-logs all write-method responses. If `executeAccountDeletion` is ever called via HTTP (e.g., admin route), both the middleware and the manual `audit.logEvent` in the handler fire, creating duplicate audit records.
**Why it happens:** After-middleware pattern is opt-out — no exemption mechanism exists.
**How to avoid:** Run anonymization only from the job scheduler (no HTTP route needed for the scheduled job execution). The admin `executeAccountDeletion` handler's manual call + middleware duplication is acceptable for the admin-triggered case (two records, both accurate).

### Pitfall 4: DPA-05 misread — audit schema has no before_state column

**What goes wrong:** Assuming DPA-05 requires suppressing a `before_state` field in the audit log that doesn't exist.
**Why it happens:** Requirement wording implies a suppression mechanism is needed.
**How to avoid:** The audit schema (`audit.schema.ts`) stores: eventType, category, action, outcome, details (JSONB). There is no `before_state` column. DPA-05 is satisfied by ensuring the anonymization handler's manual `audit.logEvent` call does NOT put PII in `details`. The middleware's auto-log only captures HTTP method/path/status — no PII.

### Pitfall 5: Grace period countdown calculation

**What goes wrong:** Frontend shows wrong days remaining (off by one, timezone issues).
**Why it happens:** Date arithmetic with `new Date()` is tz-sensitive.
**How to avoid:** Store `deletionScheduledAt` as UTC in DB. Compute `Math.ceil((scheduledAt - now) / 86400000)` on the frontend. Round up (not down) so "1 day left" shows until the moment it expires.

---

## Code Examples

### Deletion Processor Job (to create)

```typescript
// Source pattern: services/api-ts/src/handlers/dues/jobs/reminderProcessor.ts
// services/api-ts/src/handlers/person/jobs/deletionProcessor.ts

import type { DatabaseInstance } from '@/core/database';
import type { Logger } from '@/types/logger';
import { persons } from '@/handlers/person/repos/person.schema';
import { lt, isNull, isNotNull, and } from 'drizzle-orm';

export async function processDeletions({ db, logger }: { db: DatabaseInstance; logger: Logger }) {
  const now = new Date();

  // Find all persons past their scheduled deletion date, not yet anonymized
  const pending = await db
    .select({ id: persons.id, deletionRequestedAt: persons.deletionRequestedAt })
    .from(persons)
    .where(
      and(
        isNotNull(persons.deletionScheduledAt),
        lt(persons.deletionScheduledAt, now),
        isNull(persons.deletionCompletedAt),
      )
    );

  logger.info({ count: pending.length }, 'Processing scheduled account deletions');

  for (const person of pending) {
    try {
      // anonymize + clean sessions + audit
    } catch (err) {
      logger.error({ err, personId: person.id }, 'Failed to anonymize person — skipping');
    }
  }
}
```

### Better-Auth Session Cleanup (pattern from auth.ts)

```typescript
// Source: services/api-ts/src/core/auth.ts line 184
import * as schema from '@/generated/better-auth/schema';
import { eq } from 'drizzle-orm';

await db.delete(schema.session).where(eq(schema.session.userId, personId));
```

### Frontend: Export as File Download

```tsx
// No native "download JSON" mutation exists in SDK — use query fetch + blob trigger
const { refetch: fetchExport, isFetching } = useQuery({
  ...exportMyDataOptions(),
  enabled: false,
});

const handleExport = async () => {
  const result = await fetchExport();
  if (!result.data) return;
  const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `my-data-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard-delete user rows | Anonymize in-place (PII scrub) | DPA 2012 compliance requirement | FK integrity preserved, financial records retained |
| ad-hoc session invalidation | `schema.session` delete via Drizzle | Established in auth.ts (P1-4 fix) | Reuse same pattern |

---

## Open Questions

1. **Which export handler is wired — `exportMyData` or `exportPersonData`?**
   - What we know: TypeSpec defines `exportMyData` at `GET /persons/me/export`. SDK generated `exportMyData`. Both files exist.
   - What's unclear: `exportPersonData.ts` may be an unregistered duplicate. Need to check `generated/openapi/routes.ts` for the exact handler mapped to the route.
   - Recommendation: Use `exportPersonData.ts` (the more complete one with field exclusion logic) if it's the one actually wired. If not, port its logic into `exportMyData.ts`. Verify first.

2. **Does `executeAccountDeletion.ts` need a registered HTTP route or is it job-only?**
   - What we know: The handler exists with `ctx.req.param('personId')` — implies it was designed for an HTTP call.
   - What's unclear: There's no TypeSpec definition for admin-triggered execution. It may be internal-only.
   - Recommendation: Keep it as an internal function callable from the job. Optionally expose as an internal admin endpoint with `internalServiceToken` guard if needed for manual triggering.

3. **Do certificates and events repos expose a `findByPersonId` method?**
   - What we know: `exportPersonData.ts` fetches memberships/payments/credits/notifications but NOT certificates or events. DPA-04 requires these.
   - What's unclear: Whether `certificates` and `events` schemas have the right personId columns for a direct `db.select().from().where()`.
   - Recommendation: Check schema during implementation. If personId exists as FK, use direct schema query (same pattern as exportPersonData.ts). [ASSUMED — needs verification at implementation time]

---

## Environment Availability

Step 2.6: SKIPPED — phase is purely code changes on an existing running stack. No new external dependencies.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun test |
| Config file | none (bun native) |
| Quick run command | `cd services/api-ts && bun test src/handlers/person/ --timeout 10000` |
| Full suite command | `cd services/api-ts && bun test --timeout 30000` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DPA-01 | Request deletion sets timestamps, returns 202 | unit | `bun test src/handlers/person/requestAccountDeletion.test.ts` | ✅ |
| DPA-01 | Cancel deletion clears timestamps | unit | `bun test src/handlers/person/requestAccountDeletion.test.ts` | ✅ |
| DPA-01 | Cannot request if already requested | unit | `bun test src/handlers/person/requestAccountDeletion.test.ts` | ✅ |
| DPA-02 | Anonymization nulls PII fields, sets completedAt | unit | `bun test src/handlers/person/requestAccountDeletion.test.ts` | ✅ |
| DPA-02 | Financial records not deleted (FK restrict) | unit | schema constraint — no explicit test needed | N/A |
| DPA-03 | Export returns profile + categories list | unit | `bun test src/handlers/person/exportPersonData.test.ts` | ✅ |
| DPA-03 | Export excludes internal fields | unit | `bun test src/handlers/person/exportPersonData.test.ts` | ✅ |
| DPA-04 | Export includes memberships, dues, credits, certs, events | unit | `bun test src/handlers/person/exportPersonData.test.ts` | ❌ Wave 0 — missing cert/event assertions |
| DPA-05 | Anonymization audit does not contain PII in details | unit | new test in requestAccountDeletion.test.ts | ❌ Wave 0 |
| DPA-06 | processDeletions job finds overdue records and anonymizes | unit | new: `src/handlers/person/jobs/deletionProcessor.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd services/api-ts && bun test src/handlers/person/ --timeout 10000`
- **Per wave merge:** `cd services/api-ts && bun test --timeout 30000`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `src/handlers/person/exportPersonData.test.ts` — add assertions for certificates + events sections (DPA-04)
- [ ] `src/handlers/person/requestAccountDeletion.test.ts` — add test: anonymization audit.logEvent details must not contain name/email/phone (DPA-05)
- [ ] `src/handlers/person/jobs/deletionProcessor.test.ts` — new file: covers DPA-06 (scheduled job finds and processes overdue records)

---

## Security Domain

### Applicable ASVS Categories (ASVS Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better-Auth session required for all /persons/me/* routes |
| V3 Session Management | yes | Deletion execution must invalidate all user sessions |
| V4 Access Control | yes | Self-service routes: session.user.id must equal targeted personId. Admin execution: internalServiceToken guard |
| V5 Input Validation | yes | No request body for deletion/cancel/export — session identity is the input |
| V6 Cryptography | no | No new crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — user triggers deletion of another user's account | Tampering | `requestMyAccountDeletion` uses `session.user.id` as personId — no user-supplied ID |
| Replay — double deletion request | Tampering | Handler checks `person.deletionRequestedAt` already set → 409 |
| Data exfiltration via export | Information Disclosure | Export only callable by session owner; audit logged |
| PII in audit log during anonymization | Information Disclosure | Manual `logEvent` call with no PII in details; no before_state column in schema |
| Session persisting after account deletion | Elevation of Privilege | Delete `schema.session` rows where `userId = personId` during job execution |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | certificates and events schemas have a personId FK column usable for export | Open Questions | DPA-04 gap fill requires direct schema query; if no personId column, a JOIN is needed |
| A2 | `exportPersonData.ts` is the handler wired to `GET /persons/me/export` (not `exportMyData.ts`) | Open Questions | If wrong, gap-fill work goes into the wrong file |

---

## Sources

### Primary (HIGH confidence)

- Codebase — `services/api-ts/src/handlers/person/` — all 7 handler files read directly [VERIFIED]
- Codebase — `services/api-ts/src/core/jobs.ts` — pg-boss interface confirmed [VERIFIED]
- Codebase — `services/api-ts/src/handlers/audit/repos/audit.schema.ts` — no before_state column confirmed [VERIFIED]
- Codebase — `packages/sdk-ts/src/generated/` — SDK mutations for all 3 operations confirmed [VERIFIED]
- Codebase — `services/api-ts/src/app.ts` — job registration pattern confirmed [VERIFIED]
- Codebase — `services/api-ts/src/handlers/person/repos/person.schema.ts` — deletion columns confirmed [VERIFIED]
- CONTEXT.md — locked decisions from discuss phase [VERIFIED]

### Secondary (MEDIUM confidence)

- Philippine DPA 2012 (RA 10173) — right to erasure + right to portability framework [ASSUMED — training knowledge, standard compliance requirement]

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new installs
- Architecture: HIGH — handler stubs, TypeSpec, SDK all verified in codebase
- Pitfalls: HIGH — identified from direct code reading
- DPA compliance pattern: MEDIUM — training knowledge of RA 10173, not verified against NPC issuances

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stable stack)
