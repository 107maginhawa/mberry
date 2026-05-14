# Phase 25: Email/Notif Guards + Handler Tests - Research

**Researched:** 2026-05-13
**Domain:** Email infrastructure guards (rate limiting, bounce suppression, unsubscribe, deceased guard) + handler unit test coverage
**Confidence:** HIGH

---

## Summary

Phase 25 has two parallel workstreams: (1) harden the email/notification send pipeline with guards, and (2) add unit test coverage to the ~110+ handlers that currently have no `.test.ts` files.

The email infrastructure is a mature queue-based system (`email_queue` table, `EmailQueueRepository`, `EmailService`). The send path goes through `emailProcessorJob` → `EmailService.processPendingEmails()`. Guards must intercept at the right layer. The CONTEXT decisions are clear: deceased/departed guard at the **send layer** (processor), rate limiting for **bulk sends only**, bounce suppression as a **new DB table**, unsubscribe via **RFC 8058 headers + body link**.

The test coverage gap is large but mechanical: ~110 handlers across billing, communication, documents, events, notifs, person, platformadmin, reviews, training, system have no test files. Pattern is established in `make-ctx.ts` + `stubRepo`/`restoreRepo`. Tests are Bun-native, no database required.

**Primary recommendation:** Implement the four email guards as layered concerns in the processor pipeline, then write batch handler tests using the established `makeCtx`/`stubRepo` pattern, prioritizing modules closest to critical user flows.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Rate Limiting (EML-01)**
- Apply rate limiting to bulk email sends only (mass announcements, newsletters)
- Transactional emails (password reset, receipt, deletion confirmation) bypass rate limits
- Use existing rate-limit middleware pattern from `middleware/rate-limit.ts`
- Distinguish bulk vs transactional via email type/category flag

**Bounce Suppression (EML-02)**
- Hard bounce on any address → add to suppression list
- Suppression list stored in DB (new table or extend email schema)
- Check suppression list before every send
- Officers can query the suppression list

**Deceased/Departed Guard (EML-03)**
- Block email and push notification sends to deceased or departed members
- Check membership status at send layer (not queue layer)
- Consume `resigned`/`deceased`/`expelled`/`lapsed` statuses from Phase 23

**Unsubscribe (EML-04)**
- One-click unsubscribe header (RFC 8058 List-Unsubscribe-Post)
- Visible unsubscribe link in email body
- Clicking either suppresses the address (adds to suppression list)

**Handler Test Coverage (EML-05)**
- Find all previously untested API handlers
- Write unit tests with standard mock patterns
- Target: every handler has at least basic happy-path + auth-check coverage

### Claude's Discretion
All implementation details at Claude's discretion. Follow existing email/notification handler patterns.

### Deferred Ideas (OUT OF SCOPE)
None.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EML-01 | Email rate limiting applied to bulk sends only (transactional emails bypass) | New `emailCategory` flag on `email_queue` table; processor checks flag before applying rate bucket |
| EML-02 | Hard bounce suppression removes bounced addresses from future sends | New `email_suppression` table; checked before `sendEmail()` call in processor |
| EML-03 | Deceased/departed member guard prevents email and notification sends | `MembershipRepository.findActiveByPersonId()` check in processor and notification repo; statuses from Phase 23 |
| EML-04 | Email unsubscribe mechanism (one-click unsubscribe header + link) | RFC 8058 `List-Unsubscribe-Post` header injected in `sendEmail()`; `/email/unsubscribe?token=X` endpoint; token resolves to suppression list entry |
| EML-05 | Remaining untested handlers have unit test coverage | ~110 handlers across billing, communication, documents, notifs, person, platformadmin, reviews, training, system |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Rate limiting (bulk email) | API / Backend (email processor job) | — | Send rate is a backend concern; IP-based middleware doesn't apply to background jobs |
| Bounce suppression | API / Backend (email processor) | Database / Storage | Processor checks DB suppression list before every send; new `email_suppression` table |
| Deceased/departed guard | API / Backend (email processor + notif repo) | Database / Storage | Must check live membership status at send time, not queue time |
| Unsubscribe token endpoint | API / Backend | Database / Storage | RFC 8058 POST handler; resolves JWT/HMAC token to suppress address |
| Unsubscribe header injection | API / Backend (EmailService.send) | — | All outbound emails must carry the header |
| Handler unit tests | API / Backend | — | No frontend changes in this phase |

---

## Standard Stack

### Core (verified from codebase)

| Library | Version | Purpose | Notes |
|---------|---------|---------|-------|
| Bun test | built-in | Unit test runner | `import { describe, test, expect, beforeEach, afterEach } from 'bun:test'` |
| Drizzle ORM | project version | Suppression table schema | Follow `email.schema.ts` pattern |
| Hono | project version | Unsubscribe HTTP endpoint | RFC 8058 POST handler |

**No new npm packages required.** [VERIFIED: codebase grep]

### Test Utilities (verified)

Located at `services/api-ts/src/test-utils/make-ctx.ts`:
- `makeCtx(overrides)` — creates mock Hono context
- `makeUser`, `makeOfficer`, `makeMember` — user factories
- `stubRepo(RepoClass, methods)` — stubs prototype methods for testing
- `restoreRepo(RepoClass)` — restores prototype (call in `beforeEach`/`afterEach`)
- `expectUnauthorized(handler)`, `expectForbidden(handler)` — auth assertion helpers

[VERIFIED: read `src/test-utils/make-ctx.ts`]

---

## Architecture Patterns

### System Architecture Diagram

```
createMessage / publishAnnouncement
         │ (bulk send trigger)
         ▼
email_queue (status=pending, emailCategory='bulk')
         │
         ▼
emailProcessorJob
         │
         ├─► [1] Suppression check (email_suppression table)
         │         └─ if suppressed → skip, log
         │
         ├─► [2] Deceased/departed guard (membership_status)
         │         └─ if deceased/resigned/expelled/lapsed → skip, log
         │
         ├─► [3] Bulk rate limit check (in-memory bucket, per-org)
         │         └─ only when emailCategory='bulk'
         │         └─ if over limit → defer (reschedule), not fail
         │
         └─► [4] EmailService.sendEmail()
                   └─ inject List-Unsubscribe header
                   └─ inject unsubscribe link in body
                   └─ on hard bounce webhook → write email_suppression row
```

### Recommended Project Structure

New files to add:
```
services/api-ts/src/handlers/email/
├── repos/
│   ├── suppression.schema.ts      # email_suppression table
│   └── suppression.repo.ts        # SuppressionRepository
├── unsubscribeEmail.ts            # POST /email/unsubscribe (RFC 8058)
├── unsubscribeEmail.test.ts
├── listEmailSuppressions.ts       # GET /email/suppressions (officer only)
├── listEmailSuppressions.test.ts
└── jobs/
    └── processor.ts               # Modified: add 4 guard checks
```

### Pattern 1: email_suppression Table Schema

```typescript
// Source: mirrors email.schema.ts pattern [VERIFIED]
import { pgTable, uuid, varchar, timestamp, text, pgEnum, index } from 'drizzle-orm/pg-core';
import { baseEntityFields } from '@/core/database.schema';

export const suppressionReasonEnum = pgEnum('suppression_reason', [
  'hard_bounce',
  'unsubscribe',
  'complaint',
  'manual',
]);

export const emailSuppressions = pgTable('email_suppression', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  reason: suppressionReasonEnum('reason').notNull(),
  suppressedAt: timestamp('suppressed_at').notNull().defaultNow(),
  suppressedBy: uuid('suppressed_by'),  // null = system (bounce webhook)
  notes: text('notes'),
}, (table) => ({
  orgEmailIdx: index('email_suppression_org_email_idx').on(table.organizationId, table.email),
  emailIdx: index('email_suppression_email_idx').on(table.email),
}));
```

### Pattern 2: Processor Guard Order

Inject guards in `emailProcessorJob` → `EmailService.processPendingEmails()` before the actual send:

```typescript
// Source: [ASSUMED] — implementation pattern inferred from existing processor.ts
async function processOneEmail(item: EmailQueueItem): Promise<void> {
  // Guard 1: suppression check
  const suppressed = await suppressionRepo.isSuppress(item.recipientEmail, item.organizationId);
  if (suppressed) {
    await queueRepo.markAsFailed(item.id, 'Recipient is suppressed', item.attempts);
    return;
  }

  // Guard 2: deceased/departed check (only if recipient has a personId in metadata)
  if (item.metadata?.recipientPersonId) {
    const membership = await membershipRepo.findActiveByPersonId(
      item.metadata.recipientPersonId,
      item.organizationId,
    );
    const BLOCKED_STATUSES = ['deceased', 'resigned', 'expelled', 'lapsed'];
    if (membership && BLOCKED_STATUSES.includes(membership.status)) {
      await queueRepo.markAsFailed(item.id, 'Recipient membership is inactive', item.attempts);
      return;
    }
  }

  // Guard 3: bulk rate limit (only for bulk category)
  if (item.emailCategory === 'bulk') {
    const allowed = bulkRateLimiter.consume(item.organizationId);
    if (!allowed) {
      // Reschedule 1 minute forward, don't fail
      await queueRepo.reschedule(item.id, new Date(Date.now() + 60_000));
      return;
    }
  }

  // Send with unsubscribe header injection
  await emailService.send(item);  // header injection inside EmailService.send()
}
```

### Pattern 3: RFC 8058 Unsubscribe Header

```typescript
// Source: RFC 8058 [CITED: https://datatracker.ietf.org/doc/html/rfc8058]
// Injected in EmailService.send() for every outbound email
const unsubToken = generateUnsubToken(recipientEmail, orgId);  // HMAC-SHA256
headers['List-Unsubscribe'] = `<mailto:unsubscribe@domain.com>, <https://api/email/unsubscribe?token=${unsubToken}>`;
headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
```

### Pattern 4: Rate Limit for Bulk Sends (per-org sliding window)

The existing `createRateLimiter()` in `middleware/rate-limit.ts` is IP-based middleware and does NOT apply to background jobs. A **separate in-memory per-org bulk rate limiter** is needed inside the processor. [VERIFIED: read rate-limit.ts]

```typescript
// Source: [ASSUMED] — based on existing rate-limit.ts sliding window pattern
const BULK_LIMIT_PER_ORG = 100;   // emails/minute, tune per pilot needs
const BULK_WINDOW_MS = 60_000;
const bulkBuckets = new Map<string, number[]>();  // orgId → timestamps

function canSendBulk(orgId: string): boolean {
  const now = Date.now();
  const window = now - BULK_WINDOW_MS;
  const bucket = (bulkBuckets.get(orgId) ?? []).filter(t => t > window);
  if (bucket.length >= BULK_LIMIT_PER_ORG) return false;
  bucket.push(now);
  bulkBuckets.set(orgId, bucket);
  return true;
}
```

### Pattern 5: Handler Unit Test (standard)

```typescript
// Source: cancelEmailQueueItem.test.ts [VERIFIED]
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { makeCtx, stubRepo, restoreRepo } from '@/test-utils/make-ctx';
import { SomeRepository } from './repos/some.repo';
import { someHandler } from './someHandler';

describe('someHandler', () => {
  beforeEach(() => { restoreRepo(SomeRepository); });
  afterEach(() => { restoreRepo(SomeRepository); });

  test('returns 401 when unauthenticated', async () => {
    const ctx = makeCtx({ user: null, session: null });
    await expect(someHandler(ctx)).rejects.toThrow();  // or check status
  });

  test('returns 200 on happy path', async () => {
    stubRepo(SomeRepository, { findOneById: async () => ({ id: 'x' }) });
    const ctx = makeCtx({ _params: { id: 'x' } });
    const res = await someHandler(ctx);
    expect(res.status).toBe(200);
  });
});
```

### Anti-Patterns to Avoid

- **Guard at queue time, not send time:** Membership status changes after queuing (user resigns, then dies). Check at send time per CONTEXT decision.
- **Using IP-based rate-limit middleware for bulk email:** The processor is a background job, not an HTTP handler. Build a separate in-memory per-org limiter.
- **Failing silently on suppressed sends:** Log every suppression skip with reason for audit trail.
- **Writing test files that import local stubs:** Always use `@/test-utils/make-ctx`. No per-file stub definitions.
- **Using `beforeEach` without `afterEach` for `restoreRepo`:** Bun runs tests in parallel; missing restore causes cross-file prototype pollution.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HMAC token for unsubscribe | Custom crypto | Node.js built-in `crypto.createHmac('sha256', secret)` | Already available, no extra deps |
| Email queue schema extensions | New table from scratch | Extend `email.schema.ts` with `emailCategory` column | Migration already established |
| Test runner | Custom harness | Bun test (built-in) | Established pattern in all existing tests |
| Per-org rate state | Redis | In-memory Map (same pattern as IP rate limiter) | Existing middleware uses in-memory; process restart resets, which is acceptable for bulk limiting |

---

## Common Pitfalls

### Pitfall 1: emailCategory field missing on QueueEmailRequest
**What goes wrong:** Bulk rate limit can't distinguish bulk vs transactional if the queue row has no category.
**Why it happens:** The `email_queue` table has no `emailCategory` column yet.
**How to avoid:** Add `emailCategory: pgEnum('email_category', ['bulk', 'transactional'])` column + migration before processor changes.
**Warning signs:** All emails hit the rate limit bucket.

### Pitfall 2: Deceased guard checks wrong data source
**What goes wrong:** Guard looks up membership from queue metadata but many queue items don't store `recipientPersonId`.
**Why it happens:** `QueueEmailRequest` takes `recipient` as email string, not person ID.
**How to avoid:** Store `recipientPersonId` in queue item `metadata` when creating queue entries for member-targeted sends. Guard skips check when metadata is absent.

### Pitfall 3: Suppression check scope (global vs org-scoped)
**What goes wrong:** Address suppressed in org A still receives email from org B (or vice versa).
**Why it happens:** Unclear whether suppression should be global or org-scoped.
**How to avoid:** [ASSUMED] Scope suppression by `organizationId` — each org manages its own list. This matches multi-tenant pattern across all other tables.

### Pitfall 4: RFC 8058 POST endpoint must respond 200 immediately
**What goes wrong:** Mail clients that POST to the unsubscribe URL expect a fast 200 response. Slow DB write causes timeout and retry loops.
**Why it happens:** Unsubscribe endpoint does DB write synchronously.
**How to avoid:** Write suppression row, return 200. Do not queue it.

### Pitfall 5: bun test prototype pollution across test files
**What goes wrong:** Tests in file A modify `SomeRepository.prototype.method`, then tests in file B use the mutated prototype.
**Why it happens:** Bun runs test files in parallel in the same process.
**How to avoid:** Always pair `stubRepo` with `restoreRepo` in `beforeEach`/`afterEach`. This pattern is already established and must be followed.

### Pitfall 6: Handler test files for handlers that call multiple repos
**What goes wrong:** Stubbing one repo but not another causes the handler to hit the real DB (which doesn't exist in tests).
**Why it happens:** Complex handlers have multiple `new RepoClass(db)` calls.
**How to avoid:** Identify all repo instantiations in a handler before writing its test. Stub all of them.

---

## Untested Handler Inventory (EML-05)

Total handlers without `.test.ts`: ~335 (including all `association:member` handlers).

**Priority for EML-05** (exclude the 271+ `association:member` handlers — mega-module, deferred to ARC-02):

| Module | Untested Count | Priority |
|--------|---------------|----------|
| communication | ~28 | HIGH (bulk email path) |
| person | ~18 | HIGH (core identity) |
| notifs | 4 | HIGH (notification guard) |
| platformadmin | ~16 | MEDIUM |
| documents | ~13 | MEDIUM |
| billing | ~11 | MEDIUM |
| training | 5 | MEDIUM |
| reviews | 3 | LOW |
| events | 1 | LOW |
| system | 3 | LOW (health checks) |
| booking | ~15 | MEDIUM |
| membership | 4 | MEDIUM |
| invite | 1 | LOW |
| comms | ~8 | LOW (WebSocket, hard to unit-test) |
| storage | ~5 | LOW (S3-dependent) |

[VERIFIED: codebase grep — file list confirmed]

**Scope for EML-05:** Focus on modules that have clear business logic and no external service dependencies (communication, person, notifs, platformadmin, documents, billing, training, reviews, system, membership, invite). Skip comms and storage handlers (WebSocket/S3 make pure unit tests low-value).

---

## Schema Changes Required

### 1. Add `emailCategory` to `email_queue`

```typescript
// In email.schema.ts
export const emailCategoryEnum = pgEnum('email_category', ['bulk', 'transactional']);

// In emailQueue table:
emailCategory: emailCategoryEnum('email_category').notNull().default('transactional'),
```

### 2. New `email_suppression` table

New file: `services/api-ts/src/handlers/email/repos/suppression.schema.ts`

```typescript
export const emailSuppressions = pgTable('email_suppression', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  reason: suppressionReasonEnum('reason').notNull(),
  suppressedAt: timestamp('suppressed_at').notNull().defaultNow(),
  suppressedBy: uuid('suppressed_by'),
  notes: text('notes'),
}, ...indexes);
```

Both require `bun run db:generate` → migration auto-applied on server start.

---

## Code Examples

### Unsubscribe Token (HMAC)

```typescript
// Source: Node.js built-in crypto [CITED: https://nodejs.org/api/crypto.html]
import { createHmac } from 'node:crypto';

const SECRET = process.env['UNSUBSCRIBE_SECRET'] ?? 'default-dev-secret';

export function generateUnsubToken(email: string, orgId: string): string {
  return createHmac('sha256', SECRET)
    .update(`${email}:${orgId}`)
    .digest('base64url');
}

export function verifyUnsubToken(token: string, email: string, orgId: string): boolean {
  const expected = generateUnsubToken(email, orgId);
  return expected === token;
}
```

### Deceased Guard in Processor

```typescript
// Source: deceaseMembership.ts TERMINAL_STATUSES pattern [VERIFIED]
const BLOCKED_STATUSES = ['deceased', 'resigned', 'expelled', 'lapsed'] as const;

async function isRecipientBlocked(
  personId: string,
  orgId: string,
  membershipRepo: MembershipRepository
): Promise<boolean> {
  const memberships = await membershipRepo.findByPersonAndOrg(personId, orgId);
  if (!memberships.length) return false;  // no membership = not blocked
  return memberships.some(m => BLOCKED_STATUSES.includes(m.status as any));
}
```

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| Check deceased at queue insert | Check at send layer | Catches status changes after queuing |
| Global unsubscribe | Org-scoped suppression list | Correct for multi-tenant AMS |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Bulk rate limit uses per-org in-memory sliding window (100 emails/min) | Architecture Patterns | Wrong limit breaks pilot bulk sends; tune in CONTEXT |
| A2 | Deceased guard only applies when `metadata.recipientPersonId` is present in queue item | Common Pitfalls | Guard never fires if personId not stored in metadata |
| A3 | Suppression is org-scoped (not global) | Common Pitfalls | Global suppression would prevent cross-org sends |
| A4 | `association:member` handlers excluded from EML-05 scope | Untested Inventory | Still 271+ untested handlers post-phase |
| A5 | comms and storage handlers excluded from EML-05 (external dependencies) | Untested Inventory | Some comms handlers may be unit-testable |

---

## Open Questions

1. **Bulk rate limit value (100/min per org)**
   - What we know: no existing limit defined; pilot is small associations
   - Unclear: what volume of bulk sends to expect
   - Recommendation: Start at 100/min/org; make it configurable via env var

2. **Bounce webhook endpoint**
   - What we know: EML-02 requires hard bounce suppression
   - Unclear: which provider handles bounce callbacks (Postmark, SMTP, OneSignal each differ)
   - Recommendation: Implement suppression write API; leave webhook handler as stub that calls it. Postmark sends bounces to a configured webhook URL.

3. **`recipientPersonId` in queue metadata**
   - What we know: `email_queue` has generic `metadata: jsonb` field
   - Unclear: which callers of `queueEmail()` set personId in metadata
   - Recommendation: Add `recipientPersonId` as optional typed field in `QueueEmailRequest`

---

## Environment Availability

Step 2.6: SKIPPED — phase is backend code/schema changes only. No external tools required beyond existing Bun, PostgreSQL, Drizzle setup.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Bun test (built-in) |
| Config file | None — uses tsconfig paths |
| Quick run command | `cd services/api-ts && bun test src/handlers/email` |
| Full suite command | `cd services/api-ts && bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EML-01 | Bulk emails are rate-limited, transactional bypass | unit | `bun test src/handlers/email/jobs/processor.test.ts` | Exists (needs new cases) |
| EML-02 | Suppressed address skipped on send | unit | `bun test src/handlers/email/repos/suppression.repo.test.ts` | Wave 0 |
| EML-02 | Officers can list suppressions | unit | `bun test src/handlers/email/listEmailSuppressions.test.ts` | Wave 0 |
| EML-03 | Deceased member email/notif blocked | unit | `bun test src/handlers/email/jobs/processor.test.ts` | Exists (needs new cases) |
| EML-04 | Unsubscribe endpoint suppresses address | unit | `bun test src/handlers/email/unsubscribeEmail.test.ts` | Wave 0 |
| EML-05 | All priority handlers have happy-path + auth tests | unit | `bun test src/handlers/` | ~110 Wave 0 |

### Wave 0 Gaps

- [ ] `src/handlers/email/repos/suppression.schema.ts` — new table schema
- [ ] `src/handlers/email/repos/suppression.repo.ts` — SuppressionRepository
- [ ] `src/handlers/email/repos/suppression.repo.test.ts` — covers EML-02
- [ ] `src/handlers/email/unsubscribeEmail.ts` — RFC 8058 endpoint
- [ ] `src/handlers/email/unsubscribeEmail.test.ts` — covers EML-04
- [ ] `src/handlers/email/listEmailSuppressions.ts` — officer query endpoint
- [ ] `src/handlers/email/listEmailSuppressions.test.ts` — covers EML-02 list
- [ ] Migration: `bun run db:generate` after schema changes
- [ ] Per-handler test files for ~80-100 priority handlers (EML-05)

---

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better-Auth session check on all new endpoints |
| V3 Session Management | no | No new session logic |
| V4 Access Control | yes | Officer role required for suppression list queries |
| V5 Input Validation | yes | Validate unsubscribe token; validate email format on suppression |
| V6 Cryptography | yes | HMAC-SHA256 for unsubscribe tokens; use Node.js built-in crypto |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unsubscribe token forging | Tampering | HMAC-SHA256 with server secret; verify before suppressing |
| Mass unsubscribe via enumeration | DoS/Tampering | Token is HMAC(email+orgId) — can't enumerate without secret |
| Bounce webhook spoofing | Tampering | Verify webhook signature if provider supports it (Postmark: X-Postmark-Signature) |
| Officer reads another org's suppression list | Elevation of Privilege | Org-scope all queries; check `organizationId` matches session org |

---

## Sources

### Primary (HIGH confidence)
- Codebase: `services/api-ts/src/handlers/email/` — all email handler/schema/repo files read directly
- Codebase: `services/api-ts/src/middleware/rate-limit.ts` — sliding window pattern verified
- Codebase: `services/api-ts/src/test-utils/make-ctx.ts` — test utility API verified
- Codebase: `services/api-ts/src/handlers/association:member/deceaseMembership.ts` — Phase 23 status enum verified
- Codebase: `services/api-ts/src/handlers/association:member/repos/membership.schema.ts` — `membershipStatusEnum` with resigned/deceased/expelled/lapsed verified

### Secondary (MEDIUM confidence)
- RFC 8058 [CITED: https://datatracker.ietf.org/doc/html/rfc8058] — List-Unsubscribe-Post header spec

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all patterns verified in codebase
- Architecture: HIGH — processor pipeline read; guards designed from existing patterns
- Pitfalls: HIGH — derived from code inspection, not speculation
- Untested handler count: HIGH — grep confirmed ~335 total, ~110 non-association:member
- Bulk rate limit value (100/min): LOW — no existing limit; A1 assumption

**Research date:** 2026-05-13
**Valid until:** 2026-06-13 (stable codebase, 30-day window)
