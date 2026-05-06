# Phase 3: Data Model Unification - Research

**Researched:** 2026-05-06
**Domain:** Drizzle ORM schema consolidation, PostgreSQL column rename migration, TypeSpec field alignment
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** `organizationId` is the canonical term (used in 15+ modules vs 3 for tenantId)
- **D-02:** Modules with both `tenantId` and `organizationId` — drop `tenantId` column, migrate data to `organizationId` via ALTER TABLE
- **D-03:** `organizationId` represents the association (dental/medical) that a member/resource belongs to
- **D-04:** Multi-org support via membership table (already modeled). Person has no direct org FK
- **D-05:** Dual-source model: Drizzle schemas = DB source of truth, TypeSpec = API contract source of truth. Alignment enforced by contract tests + type assertions
- **D-06:** "Unification" means: remove duplicate type definitions — each entity defined ONCE in Drizzle (DB) and ONCE in TypeSpec (API). No parallel definitions with different field names
- **D-07:** Long-term alignment via contract tests comparing Drizzle `InferSelectModel` types against `@monobase/api-spec` generated types
- **D-08:** Single Drizzle migration with `ALTER TABLE RENAME COLUMN` — atomic, zero data loss
- **D-09:** Update seed scripts post-migration. Tests use Phase 0 deterministic fixture pattern
- **D-10:** Keep per-module enums (genuinely different state machines) but standardize naming convention to camelCase
- **D-11:** SDK regenerated from updated TypeSpec. No backward compat layer (pre-launch)

### Claude's Discretion
- Order of module migration (which modules first)
- Exact type assertion implementation (compile-time vs runtime)
- Whether to batch all renames in one migration or one-per-module

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DATA-01 | Single canonical schema replaces dual custom/TypeSpec-generated schemas | Dual handler modules identified; *.types.ts files not tracked by Drizzle; consolidation path clear |
| DATA-02 | Status enums unified (no more custom vs association contradictions) | Conflicting enum values found across duplicate modules (details below) |
| DATA-03 | Translation glue code removed after schema unification | Glue code located in 4 handlers + org-context middleware |
| DATA-04 | Data migration preserves all existing records during unification | ALTER TABLE RENAME COLUMN is non-destructive; column drop after data verified |
| DATA-05 | All tests updated to verify single unified schema | 298 tenantId references in test files; old *.types.ts based tests must migrate |
</phase_requirements>

## Summary

The codebase has two parallel layers of module implementations. The "new" layer lives under `handlers/association:*` with proper `*.schema.ts` files tracked by Drizzle. The "old" layer lives under plain handler names (`handlers/training/`, `handlers/events/`, `handlers/membership/`, etc.) using `*.types.ts` files that Drizzle does NOT track. Both layers define the same DB tables (`training`, `event`, `membership`, etc.), creating competing schema definitions.

The DB state on disk is governed by the `*.schema.ts` files (via `drizzle.config.ts` glob `./src/**/*schema.ts`). The old `*.types.ts` files are TypeScript-only and do not affect DB structure but DO drive the old route handlers still wired in `app.ts`. The old routes and their repos must be deleted and callers redirected to the `association:*` handlers.

The `tenantId` / `organizationId` conflict exists in 5 schema files with BOTH columns, and 6 schema files with ONLY `tenantId` (no `organizationId`). The `org-context` middleware sets BOTH `ctx.var.orgId` and `ctx.var.tenantId` to the same value, making them semantically identical today. Dropping `tenant_id` columns and renaming the Drizzle field is safe.

**Primary recommendation:** Execute in four waves — (1) migrate DB columns, (2) consolidate *.types.ts handlers into association:* handlers and delete old modules, (3) update TypeSpec primitives.tsp to rename `tenantId` → `organizationId`, (4) regenerate SDK and update tests.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| DB column rename (`tenant_id` → drop) | Database/Storage | — | Drizzle migration; ALTER TABLE |
| Schema consolidation (remove *.types.ts) | API/Backend | — | Delete old handler modules; update imports |
| TypeSpec field rename (`tenantId` → `organizationId`) | API/Backend | — | primitives.tsp + per-module .tsp files |
| Enum value standardization | API/Backend | — | Per-module pgEnum in *.schema.ts files |
| SDK regeneration | API/Backend | Frontend | Rebuilds from updated OpenAPI |
| Test updates | API/Backend | — | 298 tenantId refs in test files |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Drizzle ORM | existing | Schema definition + migration generation | Project standard |
| Drizzle Kit (`bun run db:generate`) | existing | Generates SQL migrations from schema diff | Project standard |
| Bun test | existing | Unit/integration test runner | Project standard |
| TypeSpec | existing | API contract definition | Project standard |

No new dependencies required for this phase.

**Version verification:** Not applicable — no new packages.

## Architecture Patterns

### System Architecture Diagram

```
Drizzle *.schema.ts files (DB truth)
    │
    ├── bun run db:generate → migrations/*.sql
    │                              │
    │                    ALTER TABLE RENAME COLUMN
    │                    (tenant_id → dropped)
    │
    └── handler repos use schema types
            │
            ▼
    TypeSpec *.tsp files (API truth)
            │
            ├── tsp compile → openapi.json
            │
            └── openapi-typescript → api.d.ts (@monobase/api-spec)
                        │
                        └── SDK generation → packages/sdk-ts/
```

### Recommended Project Structure

No new structure — consolidate INTO existing structure:
```
services/api-ts/src/handlers/
├── association:member/     ← CANONICAL (keep, these have *.schema.ts)
├── association:operations/ ← CANONICAL (keep, these have *.schema.ts)
├── dues/                   ← OLD (delete after migrating callers)
├── events/                 ← OLD (delete after migrating callers)
├── membership/             ← OLD (delete after migrating callers)
├── training/               ← OLD (delete after migrating callers)
├── communications/         ← OLD (delete after migrating callers)
├── certificates/           ← OLD (check if association:* equivalent exists)
└── elections/              ← OLD (check if association:* equivalent exists)
```

### Pattern 1: Column Rename Migration

Drizzle Kit does not auto-generate `RENAME COLUMN` — it generates `DROP + ADD`. For zero-data-loss rename, write the migration manually:

```sql
-- Source: Drizzle docs on raw SQL migrations [CITED: drizzle-orm.com/docs/migrations]
ALTER TABLE "training" RENAME COLUMN "tenant_id" TO "organization_id_legacy";
-- Then verify data, then:
ALTER TABLE "training" DROP COLUMN "organization_id_legacy";
```

However, for tables that have BOTH `tenant_id` AND `organization_id`, the correct operation is simply DROP (data already exists in `organization_id`):

```sql
-- Tables with BOTH columns: just drop tenant_id
ALTER TABLE "training" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "training_enrollment" DROP COLUMN IF EXISTS "tenant_id";
-- etc.
```

For tables with ONLY `tenant_id` (no `organization_id` yet):
```sql
-- Tables with ONLY tenant_id: rename to organization_id
ALTER TABLE "chapter_affiliation" RENAME COLUMN "tenant_id" TO "organization_id";
```

After running the migration, update the Drizzle schema files to reflect the new column names, then run `bun run db:generate` — Drizzle will see no diff and generate a no-op migration, confirming alignment.

**IMPORTANT:** Write this migration manually as `0014_data_model_unification.sql` in `src/generated/migrations/`. Do NOT run `bun run db:generate` before making schema changes — that would generate destructive DROP/ADD migrations.

### Pattern 2: Drizzle Schema Field Update

After the DB migration, update each `*.schema.ts` file to rename `tenantId` field and remove it from tables that have `organizationId`:

```typescript
// BEFORE (tables with BOTH columns):
export const trainings = pgTable('training', {
  ...baseEntityFields,
  tenantId: uuid('tenant_id').notNull(),      // DELETE THIS LINE
  organizationId: uuid('organization_id').notNull(),
  ...
```

```typescript
// AFTER:
export const trainings = pgTable('training', {
  ...baseEntityFields,
  organizationId: uuid('organization_id').notNull(),
  ...
```

For tables with ONLY `tenant_id` being renamed to `organization_id`:
```typescript
// BEFORE:
tenantId: uuid('tenant_id').notNull(),

// AFTER:
organizationId: uuid('organization_id').notNull(),
```

### Pattern 3: TypeSpec primitives.tsp Rename

`AssociationBaseEntity` in `specs/api/src/association/core/primitives.tsp` defines `tenantId`. After DB unification, rename to `organizationId`:

```typescript
// BEFORE:
model AssociationBaseEntity extends BaseEntity {
  @doc("Tenant (association) this record belongs to.")
  tenantId: string;
}

// AFTER:
model AssociationBaseEntity extends BaseEntity {
  @doc("Organization (association) this record belongs to.")
  organizationId: string;
}
```

Then cascade this rename across all `.tsp` files in `specs/api/src/association/` that directly declare `tenantId` fields (21 files identified).

### Pattern 4: Old Module Deletion

The old handler modules (`training/`, `events/`, `membership/`, `dues/`, `communications/`, `certificates/`, `elections/`) use `*.types.ts` files NOT tracked by Drizzle. When deleting these, verify:

1. No handler in `app.ts` still routes to old module
2. No other module imports from the old `*.types.ts`
3. If an `association:*` equivalent exists → redirect `app.ts` routes there
4. If no `association:*` equivalent exists → the old module IS the canonical one; rename `*.types.ts` → `*.schema.ts` and add `tenantId` → `organizationId` normalization

### Anti-Patterns to Avoid

- **Running `bun run db:generate` before schema changes:** Drizzle will see stale state and generate DROP+ADD instead of RENAME — data loss.
- **Renaming TypeSpec before DB migration:** Opens a window where API types don't match DB columns, breaking all queries.
- **Deleting old modules before redirecting app.ts routes:** Causes runtime 500 errors on those endpoints.
- **Assuming *.types.ts tables don't exist in DB:** They DO exist — the DB was built from previous migrations that predated the schema rename. The DB has columns matching the OLD `*.types.ts` definitions.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Column rename SQL | Custom schema diff tool | Manual SQL + `bun run db:generate` to verify no-diff | Drizzle handles future migrations; manual migration for rename-in-place |
| Type assertion between Drizzle and TypeSpec | Runtime validation | TypeScript `satisfies` operator at compile time | Zero runtime cost; catches drift at build time |
| SDK rebuild | Custom codegen | `cd specs/api && bun run build` then `cd packages/sdk-ts && bun run generate` | Project standard pipeline |

## Runtime State Inventory

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `tenant_id` column exists in DB tables: `training`, `training_enrollment`, `course`, `course_enrollment`, `quiz_attempt`, `event`, `event_registration`, `check_in`, `waitlist_entry`, `membership_tier`, `membership_category`, `membership`, `membership_application`, `dues_config`, `dues_invoice`, `aging_bucket`, `chapter_affiliation`, `affiliation_transfer`, `royalty_split`, `professional_license`, `renewal_alert`, `credential_template`, `digital_credential`, `position`, `officer_term`, `directory_profile`, `credit_entry`, `message_template`, `message`, `subscription_topic`, `person_subscription`, `document`, `document_version`, `document_tag` (~34 column occurrences across 11 schema files) | ALTER TABLE DROP COLUMN / RENAME COLUMN in migration `0014_*` |
| Live service config | None — single-tenant deployment, no external service config references tenantId | None |
| OS-registered state | None | None |
| Secrets/env vars | None — `tenantId` is a DB field name, not an env var | None |
| Build artifacts | `specs/api/dist/` — regenerated from TypeSpec; `packages/sdk-ts/src/` — regenerated from OpenAPI. Both will be stale after TypeSpec rename | Rebuild: `cd specs/api && bun run build`, then SDK regeneration |

## Common Pitfalls

### Pitfall 1: Tables with BOTH tenant_id AND organization_id (MOST IMPORTANT)
**What goes wrong:** Developer renames `tenant_id` → `organization_id` but table already has `organization_id` column — PostgreSQL throws duplicate column error.
**Why it happens:** 5 schema files have BOTH columns simultaneously: `training`, `training_enrollment`, `course`, `course_enrollment`, `quiz_attempt`, `event`, `event_registration`, `check_in`, `waitlist_entry`, `governance` tables, `credits`. For these, the correct operation is DROP (not RENAME).
**How to avoid:** Query `information_schema.columns` to confirm which tables have both columns before writing migration SQL.
**Warning signs:** `ERROR: column "organization_id" of relation "X" already exists`

### Pitfall 2: Tables with ONLY tenant_id (no organization_id)
**What goes wrong:** Developer drops `tenant_id` without renaming — loses the association scoping entirely.
**Why it happens:** 6 schema files use only `tenantId`: `chapters.schema.ts`, `communication.schema.ts`, `credentials.schema.ts`, `directory.schema.ts`, `documents.schema.ts`, `membership.schema.ts` (tiers/categories/applications use `tenantId` with no `organizationId`).
**How to avoid:** For these, use `RENAME COLUMN tenant_id TO organization_id`. Then update the Drizzle field name.
**Warning signs:** Handlers referencing `.organizationId` getting undefined.

### Pitfall 3: Duplicate pgEnum definitions
**What goes wrong:** Two schema files define `pgEnum('training_status', ...)` with DIFFERENT values — old module (`handlers/training/repos/training.types.ts`) has `['draft', 'published', 'cancelled', 'pending_approval']`, new module (`handlers/association:operations/repos/training.schema.ts`) has `['draft', 'published', 'cancelled', 'completed']`. PostgreSQL only has one enum type — whichever was created first wins.
**Why it happens:** Old `*.types.ts` modules defined enums that were applied to the DB before the `*.schema.ts` refactor.
**How to avoid:** Check which enum values exist in the DB with `SELECT enum_range(NULL::training_status)`. The DB enum is canonical; update both `.tsp` and `.schema.ts` to match.
**Warning signs:** TypeScript enum type mismatch errors; `invalid input value for enum` DB errors.

### Pitfall 4: Old handler modules still routed in app.ts
**What goes wrong:** After deleting `handlers/training/` directory, `app.ts` still imports `trainingRouter` from it — build fails.
**Why it happens:** `app.ts` registers 7 old route groups: `/dues`, `/membership`, `/communications`, `/certificates`, `/events`, `/training`, `/elections`. Each must be re-pointed to `association:*` equivalents or the old route kept while consolidating the underlying schema.
**How to avoid:** Update `app.ts` route registrations as part of the consolidation work, not after.
**Warning signs:** `Cannot find module '@/handlers/training'` TypeScript errors.

### Pitfall 5: Middleware sets both orgId and tenantId
**What goes wrong:** After removing `tenantId` from schemas, handlers that read `ctx.get('tenantId')` stop working.
**Why it happens:** `org-context.ts` middleware sets both `ctx.set('orgId', orgId)` and `ctx.set('tenantId', orgId)`. Many handlers use `ctx.get('tenantId')`. After unification, all handlers must use `ctx.get('orgId')` (or `ctx.get('tenantId')` can stay as an alias — but it creates confusion).
**How to avoid:** As part of this phase, update all handler code that reads `tenantId` from context to use `orgId` instead. Remove `ctx.var.tenantId` from `Variables` type. Remove `ctx.set('tenantId', ...)` from middleware.
**Warning signs:** 298 test references to `tenantId` — many will need updating.

### Pitfall 6: Drizzle migration meta out of sync
**What goes wrong:** Manually writing migration SQL without updating Drizzle meta JSON causes `bun run db:generate` to re-generate the same change on next run.
**Why it happens:** Drizzle tracks schema state in `meta/` JSON snapshots. If you write a raw SQL file without also updating the Drizzle-tracked schema files, Drizzle thinks the change hasn't happened.
**How to avoid:** After writing the manual migration SQL, also update the `*.schema.ts` files to remove `tenantId` fields. Then run `bun run db:generate --name check` — it should produce an empty migration (no diff). This confirms Drizzle's view matches the manual migration.
**Warning signs:** Drizzle generates a migration with `ALTER TABLE ADD COLUMN tenant_id` (re-adding what you just dropped).

## Code Examples

### Check which tables have both columns (run against live DB)
```sql
-- Source: PostgreSQL information_schema [CITED: postgresql.org/docs/current/information-schema.html]
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('tenant_id', 'organization_id')
ORDER BY table_name, column_name;
```

### Manual migration template for Phase 3
```sql
-- 0014_data_model_unification.sql
-- Wave 1: Drop tenant_id from tables that ALSO have organization_id

-- training module (has both tenant_id AND organization_id)
ALTER TABLE "training" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "training_enrollment" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "course" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "course_enrollment" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "quiz_attempt" DROP COLUMN IF EXISTS "tenant_id";

-- events module (has both tenant_id AND organization_id)
ALTER TABLE "event" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "event_registration" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "check_in" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "waitlist_entry" DROP COLUMN IF EXISTS "tenant_id";

-- dues module (has both tenant_id AND organization_id)
ALTER TABLE "dues_config" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "dues_invoice" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "aging_bucket" DROP COLUMN IF EXISTS "tenant_id";

-- governance module (has both)
ALTER TABLE "position" DROP COLUMN IF EXISTS "tenant_id";
ALTER TABLE "officer_term" DROP COLUMN IF EXISTS "tenant_id";

-- credits module (has both)
ALTER TABLE "credit_entry" DROP COLUMN IF EXISTS "tenant_id";

-- Wave 2: Rename tenant_id → organization_id for tables with ONLY tenant_id

-- membership module (only tenant_id, uses orgId separately)
-- NOTE: membership.schema.ts uses BOTH tenantId AND orgId (not organizationId)
-- Needs careful review — orgId column may be the canonical FK here
ALTER TABLE "membership_tier" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "membership_category" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "membership" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "membership_application" RENAME COLUMN "tenant_id" TO "organization_id";

-- Other association:member tables with only tenant_id
ALTER TABLE "chapter_affiliation" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "affiliation_transfer" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "royalty_split" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "professional_license" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "renewal_alert" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "credential_template" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "digital_credential" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "directory_profile" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "message_template" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "message" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "subscription_topic" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "person_subscription" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "document" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "document_version" RENAME COLUMN "tenant_id" TO "organization_id";
ALTER TABLE "document_tag" RENAME COLUMN "tenant_id" TO "organization_id";

-- Wave 3: Drop stale indexes referencing old tenant_id columns
-- (Drop and recreate as organization_id indexes — handled by schema update + db:generate)
```

**WARNING:** The membership.schema.ts uses `orgId` (not `organizationId`) as a separate column alongside `tenantId`. This table structure needs individual review before migration — the `orgId` field may map to chapter/org while `tenantId` maps to the top-level association.

### TypeScript compile-time alignment assertion (D-07)
```typescript
// Source: [ASSUMED] — TypeScript `satisfies` pattern, widely documented
// Place in a *.test.ts or dedicated alignment.ts file
import type { InferSelectModel } from 'drizzle-orm';
import { trainings } from '@/handlers/association:operations/repos/training.schema';
import type { Training as ApiTraining } from '@monobase/api-spec/types';

// This fails to compile if DB type has fields the API type doesn't account for
type _AssertTrainingAligned = InferSelectModel<typeof trainings> extends {
  organizationId: string;
  [K in keyof ApiTraining]: unknown;
} ? true : never;
```

### Updating handler context reads after tenantId removal
```typescript
// BEFORE — handlers using tenantId context:
const tenantId = ctx.get('tenantId');
if (!tenantId) return ctx.json({ error: 'Organization context required' }, 403);
await repo.createOne({ tenantId, organizationId: tenantId, ... });

// AFTER — handlers using organizationId:
const organizationId = ctx.get('orgId');
if (!organizationId) return ctx.json({ error: 'Organization context required' }, 403);
await repo.createOne({ organizationId, ... });
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `*.types.ts` schema files (not tracked by Drizzle) | `*.schema.ts` schema files (Drizzle glob) | During Phase 0 refactor | Old modules bypass Drizzle migration tracking |
| Dual tenantId/organizationId columns | Single organizationId | Phase 3 (this phase) | Removes translation glue |
| `ctx.var.tenantId` alias in middleware | `ctx.var.orgId` only | Phase 3 (this phase) | Simplifies Variables type |

**Deprecated/outdated:**
- `handlers/training/`, `handlers/events/`, `handlers/membership/`, `handlers/dues/`, `handlers/communications/`, `handlers/certificates/`, `handlers/elections/` — old module directories using `*.types.ts`. Status: active in `app.ts` but not tracked by Drizzle. Will be deleted/consolidated in this phase.
- `ctx.var.tenantId` in Variables type — redundant alias for `orgId`. Remove after handler migration.
- `AssociationBaseEntity.tenantId` in `primitives.tsp` — rename to `organizationId` after DB migration.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tables with both `tenant_id` and `organization_id` contain the same value in both columns (making DROP safe) | Migration Strategy | Data loss if tenant_id and organization_id hold different values for any row |
| A2 | Old `*.types.ts` table definitions match what was actually applied to the DB (i.e., old migrations created those columns) | Runtime State Inventory | If DB schema diverged from *.types.ts, the migration SQL will target wrong column names |
| A3 | `membership.schema.ts` `orgId` field maps to the same concept as `organizationId` in other schemas | Migration Strategy | If orgId is chapter-level and tenantId is association-level, dropping tenantId loses association scoping |
| A4 | No production data exists — pre-launch, only dev/seed data | Migration Strategy | If any prod data exists, migration requires backup + rollback plan |

**Validation for A1:** Run `SELECT COUNT(*) FROM training WHERE tenant_id != organization_id` before running migration.
**Validation for A3:** Review `membership.schema.ts` comment line 17-20 — confirms `tenantId` and `orgId` are set to same value in current deployment.

## Open Questions

1. **Does `membership.schema.ts` use `orgId` or `organizationId` as the canonical FK?**
   - What we know: `membership` table has `tenantId` + `orgId` (not `organizationId`). `membershipTiers` + `membershipCategories` + `membershipApplications` use `tenantId` only.
   - What's unclear: Is `orgId` the same concept as `organizationId` in other modules?
   - Recommendation: Check membership.repo.ts comment (line 17): "tenantId and orgId are set to the same value" — confirms they are equivalent. Rename both `tenantId` → `organizationId` and `orgId` → `organizationId` (or keep `orgId` as chapter FK if it represents chapter affiliation).

2. **Which old modules have no `association:*` equivalent yet?**
   - `handlers/certificates/` — `association:member/repos/credentials.schema.ts` exists (covers professional licenses and digital credentials)
   - `handlers/elections/` — no `association:*` equivalent found
   - `handlers/communications/` (announcements) — `association:*` has `communication.schema.ts` (messaging) but not announcements
   - `handlers/dues/` (payments, gateways) — `association:member/dues.schema.ts` exists but covers different tables
   - Recommendation: For modules without `association:*` equivalents, rename `*.types.ts` → `*.schema.ts` and migrate in-place.

## Environment Availability

Step 2.6: SKIPPED — no new external dependencies. Phase uses existing Drizzle, Bun, TypeSpec toolchain.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Bun test |
| Config file | none (bun native) |
| Quick run command | `cd services/api-ts && bun test src/handlers/association:*/**.test.ts` |
| Full suite command | `cd services/api-ts && bun test src/**/*.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DATA-01 | No duplicate pgTable definitions for same DB table name | unit (schema inspection) | `cd services/api-ts && bun test src/schema-alignment.test.ts` | ❌ Wave 0 |
| DATA-02 | Enum values match between Drizzle and TypeSpec | compile-time assertion | `cd services/api-ts && bun run typecheck` | ✅ |
| DATA-03 | No handler uses `tenantId` from context after unification | unit (grep-based or compile) | `cd services/api-ts && bun run typecheck` | ✅ |
| DATA-04 | All rows have non-null `organization_id` after migration | integration (DB query) | `cd services/api-ts && bun test src/migration-verify.test.ts` | ❌ Wave 0 |
| DATA-05 | All existing tests pass against unified schema | unit/integration | `cd services/api-ts && bun test src/**/*.test.ts` | ✅ (tests exist, need updating) |

### Sampling Rate
- **Per task commit:** `cd services/api-ts && bun run typecheck`
- **Per wave merge:** `cd services/api-ts && bun test src/**/*.test.ts`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/schema-alignment.test.ts` — verifies no duplicate pgTable definitions for DATA-01
- [ ] `src/migration-verify.test.ts` — verifies zero null `organization_id` values post-migration for DATA-04

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | org-context middleware enforces org membership before handlers run — removing tenantId alias must not weaken this |
| V5 Input Validation | yes | Drizzle `.notNull()` constraint on `organization_id` columns |
| V6 Cryptography | no | — |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Tenant data leakage (cross-org data access) | Information Disclosure | `organizationId` WHERE clause in all queries — verify every repo query has org scoping after rename |
| Broken access control if `orgId` context lost | Elevation of Privilege | `org-context.ts` middleware must set `orgId` before any association:* handler runs; verify middleware chain |

## Sources

### Primary (HIGH confidence)
- Direct codebase inspection — all file reads verified [VERIFIED: codebase grep]
- `drizzle.config.ts` glob `./src/**/*schema.ts` — confirms which files Drizzle tracks [VERIFIED: file read]
- `services/api-ts/src/middleware/org-context.ts` — confirms tenantId = orgId semantically [VERIFIED: file read]
- `membership.repo.ts` line 17 comment — confirms tenantId = orgId same value [VERIFIED: file read]

### Secondary (MEDIUM confidence)
- Drizzle Kit migration behavior (RENAME vs DROP+ADD) [ASSUMED] — based on Drizzle docs knowledge; verify with `bun run db:generate` dry-run before executing

### Tertiary (LOW confidence)
- None

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, existing toolchain
- Architecture: HIGH — full codebase inspection completed
- Pitfalls: HIGH — directly observed from code patterns
- Migration SQL: MEDIUM — column existence must be verified against live DB before execution

**Research date:** 2026-05-06
**Valid until:** 2026-06-06 (stable codebase, no external deps)
