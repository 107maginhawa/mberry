# Phase 22: PRC CPD Compliance - Research

**Researched:** 2026-05-14
**Domain:** Training schema extensions, credit entry enhancements, accredited providers registry, CPD compliance reporting
**Confidence:** HIGH

## Summary

Phase 22 extends three existing subsystems — the `training` schema, the `credit_entry` schema, and the `getCreditCompliance` handler — plus adds a new `accredited_provider` table. No new API surface needs TypeSpec authoring for the compliance summary (endpoint already exists). New endpoints are needed for the provider registry CRUD. The credit entry schema extension and training schema extension both require Drizzle migrations plus handler updates. The frontend already has a credit compliance report page at `/org/$orgId/officer/reports/credits`; that page needs category-breakdown columns. A new provider registry page is the main new frontend surface.

The PRC CPD cycle is 3 years, 45 hours required (General + Major + Self-Directed categories). The existing `getCreditCompliance` handler uses a 2-year cycle and 40-hour default — these defaults must stay configurable but the PRC-accurate defaults should be surfaced in the UI.

**Primary recommendation:** Extend schemas first (migration), update handlers to accept/expose new fields, add provider registry as a standalone handler set, then wire the frontend. Four distinct work areas, each vertically testable.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PRC accreditation fields on training | API / Database | — | Schema extension + handler patch |
| CPD category/verificationStatus on credit entries | API / Database | — | Schema extension, handler accepts new fields |
| CPD compliance summary (per-member, by category) | API / Backend | Frontend (display) | Existing endpoint extended to group by category |
| Accredited providers registry CRUD | API / Database | Frontend (UI) | New table + new handler set |
| Officer compliance view (frontend) | Browser / Client | API (data) | Existing `/officer/reports/credits` page extended |
| Provider registry UI | Browser / Client | API (data) | New route under officer section |

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Accreditation Metadata on Training Events**
- Extend training schema: `prcAccreditationNumber` (varchar), `accreditedProviderId` (FK to provider registry)
- Officers set accreditation info when creating/editing training events

**CPD Credit Entry Enhancement**
- Extend credit entry schema: `category` (enum: General, Major, Self-Directed), `approvalCode` (varchar), `verificationStatus` (enum: pending/verified/rejected)
- Officers can set verification status

**Compliance Summary**
- 40 hours per 3-year cycle (PRC standard)
- Group by category
- Officer view: all chapter members; member self-service: own only

**Accredited Providers Registry**
- New table: name, accreditationNumber, status (active/suspended/expired), expiryDate
- List with status filter; highlight expiring within 30 days
- CRUD for admin/officer

### Claude's Discretion
All implementation details at Claude's discretion. Follow existing training handler patterns. Use Drizzle ORM for schema extensions. TypeSpec-first if new API endpoints needed.

### Deferred Ideas (OUT OF SCOPE)
None.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PRC-01 | Training events store PRC accreditation number and accredited provider reference | Add `prcAccreditationNumber` varchar + `accreditedProviderId` FK to `training` table; update createTraining/updateTraining handlers |
| PRC-02 | Credit entries include CPD category, approval code, and verification status | Add `category` enum + `approvalCode` varchar + `verificationStatus` enum to `credit_entry` table; update createCreditEntry handler |
| PRC-03 | Officer can view CPD compliance summary per member (credits earned vs required) | Existing `getCreditCompliance` endpoint extended to group by category; existing `/officer/reports/credits` page enhanced |
| PRC-04 | Accredited providers registry with status tracking and expiry warnings | New `accredited_provider` table + CRUD handlers + officer settings page |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | project standard | Schema definition + migrations | Established pattern, all existing schemas use it |
| hono | project standard | API handlers | All handlers use Hono Context pattern |
| @tanstack/react-query | project standard | Frontend data fetching | All existing pages use useQuery/useMutation |
| @tanstack/react-router | project standard | File-based routing | All routes are file-based in `apps/memberry/src/routes/` |

No new dependencies needed.

## Architecture Patterns

### System Architecture Diagram

```
Officer creates/edits training
  → TrainingForm (frontend, extended with PRC fields)
    → PATCH /training/:trainingId (handler: updateTraining.ts)
      → training table (schema extended: prcAccreditationNumber, accreditedProviderId FK)

Officer creates credit entry / auto-credit on training completion
  → createCreditEntry.ts / markComplete.ts
    → credit_entry table (schema extended: category, approvalCode, verificationStatus)

Officer views compliance
  → /officer/reports/credits (frontend, extended with category breakdown)
    → GET /credit-compliance/:orgId (getCreditCompliance.ts, returns category sums)
      → credit_entry table (group by category in sumCreditsForCycle variant)

Officer manages providers
  → /officer/settings/providers (new frontend page)
    → GET/POST/PATCH/DELETE /accredited-providers (new handler set)
      → accredited_provider table (new)

Officer selects provider when creating training
  → provider list populates accreditedProviderId dropdown in TrainingForm
```

### Recommended Project Structure

New files:
```
services/api-ts/src/handlers/training/
├── repos/
│   └── accredited-provider.schema.ts   # new table definition
│   └── accredited-provider.repo.ts     # new repo
├── listAccreditedProviders.ts           # GET /accredited-providers
├── createAccreditedProvider.ts          # POST
├── updateAccreditedProvider.ts          # PATCH /:providerId
├── deleteAccreditedProvider.ts          # DELETE /:providerId
└── accredited-providers.test.ts         # unit tests

apps/memberry/src/routes/_authenticated/org/$orgId/officer/settings/
└── providers.tsx                        # provider registry page (new)
```

Modified files:
```
services/api-ts/src/handlers/association:operations/repos/training.schema.ts
  → add prcAccreditationNumber, accreditedProviderId columns

services/api-ts/src/handlers/association:member/repos/credits.schema.ts
  → add cpdCategoryEnum, category, approvalCode, verificationStatus columns

services/api-ts/src/handlers/training/createTraining.ts
services/api-ts/src/handlers/training/updateTraining.ts
  → accept prcAccreditationNumber, accreditedProviderId in body

services/api-ts/src/handlers/association:member/createCreditEntry.ts
  → accept category, approvalCode; default verificationStatus = 'pending'

services/api-ts/src/handlers/association:member/getCreditCompliance.ts
  → extend to return category-grouped sums per member

apps/memberry/src/features/training/components/training-form.tsx
  → add PRC Accreditation section (accreditation number + provider dropdown)

apps/memberry/src/routes/_authenticated/org/$orgId/officer/reports/credits.tsx
  → add category breakdown columns to table

apps/memberry/src/components/layout/officer-sidebar.tsx
  → add Providers link under SETTINGS section
```

### Pattern 1: Schema Extension with Enum (Drizzle)

**What:** Add new pgEnum + columns to existing table
**When to use:** Adding typed fields to existing schema without breaking existing rows

```typescript
// Source: [VERIFIED: existing credits.schema.ts pattern]
export const cpdCategoryEnum = pgEnum('cpd_category', [
  'General',
  'Major',
  'Self-Directed',
]);

export const verificationStatusEnum = pgEnum('cpd_verification_status', [
  'pending',
  'verified',
  'rejected',
]);

// Add to creditEntries table:
category: cpdCategoryEnum('category'),
approvalCode: varchar('approval_code', { length: 100 }),
verificationStatus: verificationStatusEnum('verification_status').default('pending'),
```

### Pattern 2: Handler Update for New Optional Fields

**What:** Accept new optional body fields, pass to repo, ignore if absent
**When to use:** Extending existing handlers without breaking existing callers

```typescript
// Source: [VERIFIED: existing createTraining.ts pattern]
const training = await repo.create({
  // ... existing fields ...
  prcAccreditationNumber: body.prcAccreditationNumber,
  accreditedProviderId: body.accreditedProviderId,
});
```

### Pattern 3: New Handler Set for Registry CRUD

**What:** Standalone handler files following Router → Validators → Handlers → Repositories
**When to use:** New domain entity with full CRUD

```typescript
// Source: [VERIFIED: existing handler pattern e.g. createTraining.ts]
export async function createAccreditedProvider(ctx: Context): Promise<Response> {
  const db = ctx.get('database');
  const session = ctx.get('session') as Session;
  const orgId = ctx.req.param('organizationId');
  const body = await ctx.req.json();
  const repo = new AccreditedProviderRepository(db);

  const provider = await repo.create({ ...body, organizationId: orgId });
  return ctx.json({ data: provider }, 201);
}
```

### Pattern 4: Compliance Query Extension for Category Grouping

**What:** Extend `sumCreditsForCycle` to also group by `category`
**When to use:** Compliance summary needs category breakdown without changing existing API shape

```typescript
// Source: [VERIFIED: existing getCreditCompliance.ts + credits.repo.ts]
async sumCreditsByCategory(
  personId: string,
  cycleStart: Date,
  cycleEnd: Date,
  orgId: string,
): Promise<Record<string, number>> {
  const result = await this.db
    .select({
      category: creditEntries.category,
      total: sql<number>`coalesce(sum(${creditEntries.creditAmount}), 0)`,
    })
    .from(creditEntries)
    .where(and(
      eq(creditEntries.personId, personId),
      between(creditEntries.activityDate, cycleStart, cycleEnd),
      eq(creditEntries.organizationId, orgId),
    ))
    .groupBy(creditEntries.category);

  return Object.fromEntries(result.map(r => [r.category ?? 'uncategorized', Number(r.total)]));
}
```

### Pattern 5: Expiry Warning Query

**What:** Filter providers expiring within 30 days in list endpoint
**When to use:** Status indicator for upcoming expiry

```typescript
// Source: [ASSUMED - standard SQL date arithmetic pattern]
const thirtyDaysOut = new Date();
thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

// In repo list method, annotate results:
const expiringsSoon = expiryDate <= thirtyDaysOut && expiryDate > now;
```

### Anti-Patterns to Avoid

- **Adding FK constraint without nullable:** `accreditedProviderId` must be nullable — existing trainings have no provider. Always add with `.references(() => accreditedProviders.id)` as nullable optional.
- **Breaking API shape on compliance endpoint:** Add `byCategory` as an extra field on each member result, don't change existing fields (`earned`, `required`, `remaining`, `compliance_status`).
- **Enum migration order:** Create the pgEnum before referencing it in the table definition. Drizzle generates this correctly but verify migration SQL order.
- **Route registration without `/api` prefix:** Register custom handler routes WITHOUT `/api` prefix per CLAUDE.md. Frontend fetch calls keep `/api/`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date arithmetic for expiry warnings | Custom date math | Standard JS Date | Already used everywhere in codebase |
| Enum validation | Manual string checks | Drizzle pgEnum | Type-safe, migration-backed |
| Credit cycle calculation | New cycle logic | Existing `getCycleForDate` in `credit-cycle.ts` | Already handles registration-based cycles |
| RBAC checks | Custom role logic | `requirePosition` util + `POSITION_TITLES` constants | Already enforced in getCreditCompliance |

**Key insight:** ~80% of this phase is schema migration + wiring existing patterns. Avoid reimplementing cycle logic or compliance calculation from scratch.

## Common Pitfalls

### Pitfall 1: Forgetting `accreditedProviderId` is Cross-Table FK
**What goes wrong:** FK references `accredited_provider.id` but that table lives in the training handler, not `association:operations`. Schema import path matters.
**Why it happens:** `training.schema.ts` lives under `association:operations/repos/` but the new provider schema lives under `training/repos/`. Circular import risk if provider schema imports training schema.
**How to avoid:** Keep `accredited-provider.schema.ts` standalone. Training schema imports provider schema (not vice versa). Or skip FK constraint at DB level and validate in handler (simpler, consistent with how `accreditedProviderId` is already in TypeSpec without enforcement).
**Warning signs:** TypeScript import errors at build time.

### Pitfall 2: Existing `getCreditCompliance` Loads All Members (N+1)
**What goes wrong:** For each member, one `sumCreditsForCycle` call. Adding `sumCreditsByCategory` doubles the DB calls.
**Why it happens:** Current implementation: `Promise.all(members.map(m => creditRepo.sumCreditsForCycle(...)))`. Adding a second per-member query doubles load.
**How to avoid:** Add a single `sumCreditsByCategoryBatch(personIds, cycleStart, cycleEnd, orgId)` that returns a map, queried once with `IN` clause. Or combine both sums into one query that returns total + category breakdown together.
**Warning signs:** Slow compliance page on orgs with 50+ members.

### Pitfall 3: `verificationStatus` Default on Existing Credit Entries
**What goes wrong:** Migration adds `verification_status` column; existing rows get NULL. Handler code that checks `entry.verificationStatus === 'pending'` breaks for old entries.
**Why it happens:** Drizzle `default('pending')` only applies to new inserts, not existing rows.
**How to avoid:** In migration SQL, add `DEFAULT 'pending'` and also `SET DEFAULT 'pending'` for existing rows: `ALTER TABLE credit_entry ALTER COLUMN verification_status SET DEFAULT 'pending'; UPDATE credit_entry SET verification_status = 'pending' WHERE verification_status IS NULL;` — or handle null as 'pending' in handler logic.
**Warning signs:** Compliance status checks fail silently for legacy entries.

### Pitfall 4: Enum Name Collision
**What goes wrong:** `pgEnum('cpd_category', ...)` — PostgreSQL enum names are global per schema. If another module already uses `'cpd_category'` name, migration fails.
**Why it happens:** Drizzle generates `CREATE TYPE cpd_category AS ENUM (...)`. Name collision = migration error.
**How to avoid:** Use descriptive, namespaced names: `'credit_cpd_category'` and `'credit_verification_status'` to avoid collision.
**Warning signs:** Migration run fails with `type already exists`.

### Pitfall 5: Route Registration for New Provider Endpoints
**What goes wrong:** Register provider routes under `/api/accredited-providers` — Vite proxy strips `/api/`, so handler must be at `/accredited-providers`.
**Why it happens:** CLAUDE.md critical convention — routes registered WITHOUT `/api` prefix.
**How to avoid:** In app.ts (or generated routes): `app.route('/accredited-providers', providersRouter)`.
**Warning signs:** Frontend gets 404 on provider API calls.

## Code Examples

### Accredited Provider Schema
```typescript
// Source: [VERIFIED: existing credits.schema.ts pattern]
export const providerStatusEnum = pgEnum('accredited_provider_status', [
  'active',
  'suspended',
  'expired',
]);

export const accreditedProviders = pgTable('accredited_provider', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  name: varchar('name', { length: 300 }).notNull(),
  accreditationNumber: varchar('accreditation_number', { length: 100 }).notNull(),
  status: providerStatusEnum('status').notNull().default('active'),
  expiryDate: timestamp('expiry_date'),
}, (table) => [
  index('idx_accredited_provider_org').on(table.organizationId),
  index('idx_accredited_provider_status').on(table.status),
]);
```

### Training Schema Extension
```typescript
// Source: [VERIFIED: existing training.schema.ts in association:operations/repos/]
// Add to trainings table definition:
prcAccreditationNumber: varchar('prc_accreditation_number', { length: 100 }),
accreditedProviderId: uuid('accredited_provider_id'),
// Note: nullable by default (no .notNull())
```

### Credit Entry Schema Extension
```typescript
// Source: [VERIFIED: existing credits.schema.ts pattern]
export const cpdCategoryEnum = pgEnum('credit_cpd_category', [
  'General',
  'Major',
  'Self-Directed',
]);

export const verificationStatusEnum = pgEnum('credit_verification_status', [
  'pending',
  'verified',
  'rejected',
]);

// Add to creditEntries table:
category: cpdCategoryEnum('category'),
approvalCode: varchar('approval_code', { length: 100 }),
verificationStatus: verificationStatusEnum('verification_status').notNull().default('pending'),
```

### Frontend: Provider Expiry Warning Badge
```tsx
// Source: [VERIFIED: existing STATUS_BADGE pattern in credits.tsx]
function expiryBadge(expiryDate: string | null) {
  if (!expiryDate) return null;
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded">Expired</span>;
  if (days <= 30) return <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Expiring in {days}d</span>;
  return null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| PRC CPD not tracked | Phase 22 adds PRC metadata | This phase | Training events gain accreditation fields |
| Credit entries have no category | Phase 22 adds category enum | This phase | Enables category-grouped compliance report |
| No provider registry | Phase 22 adds `accredited_provider` table | This phase | Officers can track approved providers |

**Existing compliance route:** `/credit-compliance/:organizationId` already exists and is used by the frontend. This phase extends the response shape (add `byCategory` object per member), not the route.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | PRC CPD cycle is 3 years, 45 hours total required | Standard Stack, Architecture | May be 40 hrs (some sources say 45 for dentists). The endpoint's `requiredCredits` param is already configurable — UI default should be verified with user before hardcoding |
| A2 | Provider registry is org-scoped (not platform-global) | Architecture | If providers should be shared across orgs, schema needs no `organizationId` and RBAC changes. CONTEXT.md says "admin/officer management" — assumed org-scoped |
| A3 | Skipping FK enforcement at DB level for `accreditedProviderId` on `training` | Common Pitfalls | If hard FK is required, migration is slightly more complex (ordering constraint) |

## Open Questions

1. **PRC required credit hours: 40 or 45?**
   - What we know: CONTEXT.md says "40 hours per 3-year cycle"; PRC Resolution 2013-774 specifies 45 units for dental practitioners
   - What's unclear: Which number should be the UI default?
   - Recommendation: Keep configurable param, default to 45 in UI for dental (matches PRC regulation), document override for other healthcare professions

2. **Provider registry: org-scoped or platform-global?**
   - What we know: PRC maintains a national accredited providers list
   - What's unclear: Should all orgs share providers, or each org maintain their own?
   - Recommendation: Start org-scoped (consistent with all other tables); can be converted to platform-global in v2

3. **TypeSpec coverage for new provider endpoints**
   - What we know: CONTEXT.md says "TypeSpec-first if new API endpoints needed"
   - What's unclear: Phase has hand-wired training routes already; provider CRUD could be hand-wired like dues module
   - Recommendation: Hand-wire for speed (consistent with `training/` module pattern which is partially hand-wired); document TypeSpec gap for v1.3.0 ARC-01

## Environment Availability

Step 2.6: SKIPPED — phase is schema/handler/frontend changes within existing Bun/PostgreSQL/Drizzle stack. No new external dependencies.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test |
| Config file | none (Bun built-in) |
| Quick run command | `cd /Users/elad-mini/Desktop/memberry/services/api-ts && bun test --filter training` |
| Full suite command | `cd /Users/elad-mini/Desktop/memberry/services/api-ts && bun test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PRC-01 | Training handler accepts prcAccreditationNumber + accreditedProviderId | unit | `bun test --filter training/createTraining` | ✅ createTraining.test.ts |
| PRC-01 | Training handler accepts prcAccreditationNumber + accreditedProviderId on update | unit | `bun test --filter training/updateTraining` | ✅ updateTraining.test.ts |
| PRC-02 | createCreditEntry accepts category + approvalCode, defaults verificationStatus=pending | unit | `bun test --filter credits` | ✅ credits.test.ts |
| PRC-02 | Officer can update verificationStatus on credit entry | unit | `bun test --filter credits` | ✅ credits.test.ts (extend) |
| PRC-03 | getCreditCompliance returns byCategory breakdown per member | unit | `bun test --filter getCreditCompliance` | ❌ Wave 0 — add to credits.test.ts |
| PRC-04 | createAccreditedProvider returns 401 without session | unit | `bun test --filter accredited-providers` | ❌ Wave 0 — accredited-providers.test.ts |
| PRC-04 | listAccreditedProviders flags expiring within 30 days | unit | `bun test --filter accredited-providers` | ❌ Wave 0 — accredited-providers.test.ts |
| PRC-04 | Provider status filter (active/suspended/expired) works | unit | `bun test --filter accredited-providers` | ❌ Wave 0 — accredited-providers.test.ts |

### Sampling Rate
- **Per task commit:** `cd services/api-ts && bun test --filter training`
- **Per wave merge:** `cd services/api-ts && bun test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `services/api-ts/src/handlers/training/accredited-providers.test.ts` — covers PRC-04 (auth guard, list, expiry flag, status filter)
- [ ] Extend `services/api-ts/src/handlers/association:member/credits.test.ts` — add PRC-02 category/approvalCode/verificationStatus tests and PRC-03 byCategory compliance tests
- [ ] DB migration: `cd services/api-ts && bun run db:generate` after each schema change

## Security Domain

### Applicable ASVS Categories (Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Better-Auth session check (all handlers) |
| V3 Session Management | no | Handled by platform |
| V4 Access Control | yes | `requirePosition` for officer-only endpoints; org-scoped queries |
| V5 Input Validation | yes | Zod validators on request bodies; enum validation via Drizzle pgEnum |
| V6 Cryptography | no | No new crypto requirements |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Officer viewing other org's provider data | Information Disclosure | `eq(accreditedProviders.organizationId, orgId)` on all queries |
| Member self-service modifying verificationStatus | Elevation of Privilege | `verificationStatus` field only writable by officer role; member createCreditEntry does not accept it |
| SQL injection on provider name search | Tampering | Drizzle parameterized queries (existing pattern) |
| Expired provider still selectable in training form | Tampering | Validate `accreditedProviderId` points to active provider in createTraining handler |

## Sources

### Primary (HIGH confidence)
- Existing codebase — `training.schema.ts`, `credits.schema.ts`, `credits.repo.ts`, `getCreditCompliance.ts`, `createCreditEntry.ts`, `training-form.tsx`, `credits.tsx` — direct inspection
- CLAUDE.md — route registration convention, toast system, test commands

### Secondary (MEDIUM confidence)
- CONTEXT.md — locked decisions for schema field names and enums

### Tertiary (LOW confidence)
- A1: PRC CPD 3-year/45-hour cycle — training knowledge, not verified against current PRC regulation text in this session

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — existing codebase verified
- Architecture: HIGH — follows established patterns, no new dependencies
- Pitfalls: HIGH — derived from direct schema + handler inspection
- PRC regulatory numbers: LOW — A1 flagged above

**Research date:** 2026-05-14
**Valid until:** 2026-06-14 (stable tech stack)
